package main

import (
	"log"
	"net/http"
	"os"

	"strings"

	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/supabase-community/gotrue-go/types"
	"github.com/supabase-community/postgrest-go"
	"github.com/supabase-community/supabase-go"
)

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

	// Public: Send a message to a user
	r.POST("/send", authMiddleware, func(c *gin.Context) {
		var body struct {
			ReceiverID string `json:"receiver_id" binding:"required"`
			Content    string `json:"content" binding:"required"`
		}

		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		// 🛡️ Safety check: Profanity
		if containsProfanity(body.Content) {
			c.JSON(http.StatusForbidden, gin.H{"error": "Message contains prohibited content"})
			return
		}

		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		messageData := map[string]interface{}{
			"receiver_id": body.ReceiverID,
			"sender_id":   supabaseUser.ID.String(),
			"content":     body.Content,
			"status":      "pending",
		}

		var newMessage []interface{}
		_, err := client.From("messages").Insert(messageData, false, "", "", "").ExecuteTo(&newMessage)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send: " + err.Error()})
			return
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

	// Update Profile: Set bio, display name, etc.
	r.PUT("/profile", authMiddleware, func(c *gin.Context) {
		var body struct {
			DisplayName string `json:"display_name"`
			Bio         string `json:"bio"`
			AvatarURL   string `json:"avatar_url"`
		}

		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		updateData := map[string]interface{}{
			"display_name": body.DisplayName,
			"bio":          body.Bio,
			"avatar_url":   body.AvatarURL,
			"updated_at":   "now()",
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

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("failed to run server: %v", err)
	}
}
