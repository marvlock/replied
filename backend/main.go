package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"strings"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/redis/go-redis/v9"
	"github.com/supabase-community/gotrue-go/types"
	"github.com/supabase-community/postgrest-go"
	"github.com/supabase-community/supabase-go"
)

var rdb *redis.Client
var ctx = context.Background()

var bannedWords = []string{"badword1", "badword2", "spamlink", "offensive"} // We can expand this

func containsProfanity(text string) bool {
	lowered := strings.ToLower(text)
	for _, word := range bannedWords {
		if strings.Contains(lowered, word) {
			return true
		}
	}
	return false
}

func sendEmailNotification(toEmail, username, content string) {
	apiKey := os.Getenv("RESEND_API_KEY")
	if apiKey == "" {
		log.Println("RESEND_API_KEY not set, skipping email notification")
		return
	}

	url := "https://api.resend.com/emails"

	body := map[string]interface{}{
		"from":    "Replied <noreply@marvlock.dev>",
		"to":      []string{toEmail},
		"subject": "New Anonymous Message Received!",
		"html":    fmt.Sprintf("<strong>Hi %s!</strong><br><br>You just received a new anonymous message:<br><br><em>\"%s\"</em><br><br><a href=\"http://localhost:3000/inbox\">Go to your inbox to reply</a>", username, content),
	}

	jsonBody, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonBody))
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	httpClient := &http.Client{}
	resp, err := httpClient.Do(req)
	if err != nil {
		log.Printf("Failed to send email: %v", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		log.Printf("Resend API error: status %d", resp.StatusCode)
	} else {
		log.Println("Email notification sent successfully")
	}
}

func main() {
	// Load environment variables
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, using system environment variables")
	}

	supabaseURL := os.Getenv("SUPABASE_URL")
	supabaseKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")

	if supabaseURL == "" || supabaseKey == "" {
		log.Fatal("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set")
	}

	// Initialize Supabase client
	client, err := supabase.NewClient(supabaseURL, supabaseKey, nil)
	if err != nil {
		log.Fatalf("cannot initialize supabase client: %v", err)
	}

	// Initialize Redis for rate limiting
	redisURL := os.Getenv("UPSTASH_REDIS_URL")
	if redisURL != "" {
		opt, err := redis.ParseURL(redisURL)
		if err != nil {
			log.Printf("Warning: Invalid Redis URL: %v", err)
		} else {
			rdb = redis.NewClient(opt)
			log.Println("Connected to Redis for rate limiting")
		}
	} else {
		log.Println("Warning: UPSTASH_REDIS_URL not set. Rate limiting will be disabled.")
	}

	r := gin.Default()

	// CORS Middleware
	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "http://localhost:3000")
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, accept, origin, Cache-Control, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS, GET, PUT, DELETE")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	// Middleware to check Supabase JWT
	authMiddleware := func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header required"})
			c.Abort()
			return
		}

		// In a real app, you'd verify the JWT here using a library or Supabase Auth.
		// For now, we'll assume the header is "Bearer <token>" and use the client's User method if available,
		// but since we're using service role key, we can also manually check or rely on the frontend passing the user ID for simplicity in this V1,
		// but let's try to do it properly by extracting the token.
		token := authHeader[len("Bearer "):]

		// Map token to user using Gotrue (Supabase Auth)
		user, err := client.Auth.WithToken(token).GetUser()
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token: " + err.Error()})
			c.Abort()
			return
		}

		c.Set("user", user.User)
		c.Next()
	}

	// Inbox: Get pending messages
	r.GET("/inbox", authMiddleware, func(c *gin.Context) {
		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		var messages []interface{}
		_, err := client.From("messages").
			Select("*", "exact", false).
			Eq("receiver_id", supabaseUser.ID.String()).
			Eq("status", "pending").
			Order("created_at", &postgrest.OrderOpts{Ascending: false}).
			ExecuteTo(&messages)

		if err != nil {
			log.Printf("Supabase error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, messages)
	})
	// History: Get non-pending messages (replied, archived)
	r.GET("/history", authMiddleware, func(c *gin.Context) {
		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		var messages []interface{}
		_, err := client.From("messages").
			Select("*, replies(*)", "exact", false).
			Eq("receiver_id", supabaseUser.ID.String()).
			Neq("status", "pending").
			Order("created_at", &postgrest.OrderOpts{Ascending: false}).
			ExecuteTo(&messages)

		if err != nil {
			log.Printf("Supabase error: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, messages)
	})

	// Reply: Publish a response
	r.POST("/reply", authMiddleware, func(c *gin.Context) {
		var body struct {
			MessageID string `json:"message_id" binding:"required"`
			Content   string `json:"content" binding:"required"`
		}

		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		// 1. Create the reply
		replyData := map[string]interface{}{
			"message_id": body.MessageID,
			"sender_id":  supabaseUser.ID.String(),
			"content":    body.Content,
		}

		var newReply []interface{}
		_, err := client.From("replies").Insert(replyData, false, "", "", "").ExecuteTo(&newReply)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create reply: " + err.Error()})
			return
		}

		// 2. Update message status to 'replied'
		_, _, err = client.From("messages").
			Update(map[string]interface{}{"status": "replied"}, "", "").
			Eq("id", body.MessageID).
			Execute()

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update message: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "published", "reply": newReply})
	})

	// Public: Send a message to a user (Allows anonymous if rate limited)
	r.POST("/send", func(c *gin.Context) {
		// 🛡️ Rate Limiting Check
		if rdb != nil {
			ip := c.ClientIP()
			key := "ratelimit:send:" + ip

			// Allow 5 messages per 10 minutes
			limit := 5
			window := 10 * time.Minute

			count, err := rdb.Incr(ctx, key).Result()
			if err != nil {
				log.Printf("Redis error: %v", err)
			} else {
				if count == 1 {
					rdb.Expire(ctx, key, window)
				}
				if count > int64(limit) {
					c.JSON(http.StatusTooManyRequests, gin.H{"error": "Too many messages. Please wait 10 minutes."})
					return
				}
			}
		}

		var body struct {
			ReceiverID string `json:"receiver_id" binding:"required"`
			Content    string `json:"content" binding:"required"`
		}

		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// 🛡️ Safety check 1: Global Profanity
		if containsProfanity(body.Content) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Message contains prohibited content"})
			return
		}

		// 🛡️ Safety check 2: Check if receiver is paused or has custom blocks
		var receiverProfile struct {
			IsPaused       bool     `json:"is_paused"`
			BlockedPhrases []string `json:"blocked_phrases"`
			Email          string   `json:"email"`
			Username       string   `json:"username"`
		}

		_, err := client.From("profiles").
			Select("is_paused, blocked_phrases, email, username", "", false).
			Eq("id", body.ReceiverID).
			Single().
			ExecuteTo(&receiverProfile)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Could not verify receiver status"})
			return
		}

		if receiverProfile.IsPaused {
			c.JSON(http.StatusForbidden, gin.H{"error": "This inbox is currently paused by the owner"})
			return
		}

		// 🛡️ Safety check 3: User-specific blocked phrases
		contentLower := strings.ToLower(body.Content)
		for _, phrase := range receiverProfile.BlockedPhrases {
			if strings.Contains(contentLower, strings.ToLower(phrase)) {
				c.JSON(http.StatusForbidden, gin.H{"error": "Message contains a phrase blocked by the user"})
				return
			}
		}

		// Optional Auth: If token provided, link to sender
		var senderID *string
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
			token := authHeader[len("Bearer "):]
			userResponse, err := client.Auth.WithToken(token).GetUser()
			if err == nil {
				id := userResponse.User.ID.String()
				senderID = &id
			}
		}

		messageData := map[string]interface{}{
			"receiver_id": body.ReceiverID,
			"content":     body.Content,
			"status":      "pending",
		}
		if senderID != nil {
			messageData["sender_id"] = *senderID
		}

		var newMessage []interface{}
		_, err = client.From("messages").Insert(messageData, false, "", "", "").ExecuteTo(&newMessage)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send: " + err.Error()})
			return
		}

		// 📧 Send Email Notification (Non-blocking)
		if receiverProfile.Email != "" {
			go sendEmailNotification(receiverProfile.Email, receiverProfile.Username, body.Content)
		}

		c.JSON(http.StatusCreated, gin.H{"status": "sent"})
	})

	// Report: Flag a message for review
	r.POST("/report", authMiddleware, func(c *gin.Context) {
		var body struct {
			MessageID string `json:"message_id" binding:"required"`
		}

		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		_, _, err := client.From("messages").
			Update(map[string]interface{}{"status": "reported"}, "", "").
			Eq("id", body.MessageID).
			Execute()

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to report: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "reported"})
	})
	// Archive Message (Discard)
	r.POST("/messages/:id/archive", authMiddleware, func(c *gin.Context) {
		id := c.Param("id")
		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		_, _, err = client.From("messages").
			Update(map[string]interface{}{"status": "archived"}, "", "").
			Eq("id", id).
			Eq("receiver_id", supabaseUser.ID.String()).
			Execute()

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to archive message"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "archived"})
	})

	// Delete Message
	r.DELETE("/messages/:id", authMiddleware, func(c *gin.Context) {
		id := c.Param("id")
		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		_, _, err = client.From("messages").
			Delete("", "").
			Eq("id", id).
			Eq("receiver_id", supabaseUser.ID.String()).
			Execute()

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete message"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "deleted"})
	})

	// Toggle Inbox Pause
	r.POST("/profile/toggle-pause", authMiddleware, func(c *gin.Context) {
		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		var body struct {
			IsPaused bool `json:"is_paused"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid body"})
			return
		}

		_, _, err = client.From("profiles").
			Update(map[string]interface{}{"is_paused": body.IsPaused}, "", "").
			Eq("id", supabaseUser.ID.String()).
			Execute()

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to toggle pause"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "updated"})
	})

	// Update Blocked Phrases
	r.POST("/profile/blocked-phrases", authMiddleware, func(c *gin.Context) {
		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		var body struct {
			Phrases []string `json:"phrases"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid body"})
			return
		}

		_, _, err := client.From("profiles").
			Update(map[string]interface{}{"blocked_phrases": body.Phrases}, "", "").
			Eq("id", supabaseUser.ID.String()).
			Execute()

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update blocked phrases"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "updated"})
	})

	// Update Profile: Set bio, display name, etc.
	r.PUT("/profile", authMiddleware, func(c *gin.Context) {
		var body struct {
			DisplayName    string   `json:"display_name"`
			Bio            string   `json:"bio"`
			AvatarURL      string   `json:"avatar_url"`
			IsPaused       bool     `json:"is_paused"`
			BlockedPhrases []string `json:"blocked_phrases"`
		}

		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		updateData := map[string]interface{}{
			"display_name":    body.DisplayName,
			"bio":             body.Bio,
			"avatar_url":      body.AvatarURL,
			"is_paused":       body.IsPaused,
			"blocked_phrases": body.BlockedPhrases,
			"updated_at":      "now()",
		}

		var updatedProfile []interface{}
		_, err := client.From("profiles").
			Update(updateData, "", "").
			Eq("id", supabaseUser.ID.String()).
			ExecuteTo(&updatedProfile)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update profile: " + err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "updated", "profile": updatedProfile})
	})

	// Delete Profile (Account)
	r.DELETE("/profile", authMiddleware, func(c *gin.Context) {
		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		// Delete from auth.users (Admin API) via direct HTTP
		supabaseURL := os.Getenv("SUPABASE_URL")
		serviceRoleKey := os.Getenv("SUPABASE_SERVICE_ROLE_KEY")

		url := fmt.Sprintf("%s/auth/v1/admin/users/%s", supabaseURL, supabaseUser.ID.String())
		req, _ := http.NewRequest("DELETE", url, nil)
		req.Header.Set("apikey", serviceRoleKey)
		req.Header.Set("Authorization", "Bearer "+serviceRoleKey)

		httpClient := &http.Client{}
		resp, err := httpClient.Do(req)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to connect to auth service"})
			return
		}
		defer resp.Body.Close()

		if resp.StatusCode >= 300 {
			c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Auth service error: %d", resp.StatusCode)})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "deleted"})
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("failed to run server: %v", err)
	}
}
