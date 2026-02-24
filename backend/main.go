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

	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/hex"
	"io"

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

func encrypt(text string) (string, error) {
	keyHex := os.Getenv("ENCRYPTION_KEY")
	key, err := hex.DecodeString(keyHex)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err = io.ReadFull(rand.Reader, nonce); err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(text), nil)
	return hex.EncodeToString(ciphertext), nil
}

func decrypt(ciphertextHex string) (string, error) {
	keyHex := os.Getenv("ENCRYPTION_KEY")
	key, err := hex.DecodeString(keyHex)
	if err != nil {
		return "", err
	}

	ciphertext, err := hex.DecodeString(ciphertextHex)
	if err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", err
	}

	nonceSize := gcm.NonceSize()
	if len(ciphertext) < nonceSize {
		return "", fmt.Errorf("ciphertext too short")
	}

	nonce, actualCiphertext := ciphertext[:nonceSize], ciphertext[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, actualCiphertext, nil)
	if err != nil {
		return "", err
	}

	return string(plaintext), nil
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

	if os.Getenv("ENCRYPTION_KEY") == "" {
		log.Fatal("ENCRYPTION_KEY must be set")
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
		origin := c.Request.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
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

		// Decrypt messages
		for i, m := range messages {
			msgMap := m.(map[string]interface{})
			if content, ok := msgMap["content"].(string); ok {
				if dec, err := decrypt(content); err == nil {
					msgMap["content"] = dec
				}
			}
			messages[i] = msgMap
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

		// Decrypt messages and their replies
		for i, m := range messages {
			msgMap := m.(map[string]interface{})
			if content, ok := msgMap["content"].(string); ok {
				if dec, err := decrypt(content); err == nil {
					msgMap["content"] = dec
				}
			}

			if replies, ok := msgMap["replies"].([]interface{}); ok {
				for j, r := range replies {
					replyMap := r.(map[string]interface{})
					if rContent, ok := replyMap["content"].(string); ok {
						if dec, err := decrypt(rContent); err == nil {
							replyMap["content"] = dec
						}
					}
					replies[j] = replyMap
				}
			}
			messages[i] = msgMap
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

		// Encrypt the content
		encryptedContent, err := encrypt(body.Content)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Encryption failed"})
			return
		}

		// 1. Create the reply
		replyData := map[string]interface{}{
			"message_id": body.MessageID,
			"sender_id":  supabaseUser.ID.String(),
			"content":    encryptedContent,
		}

		var newReply []interface{}
		_, err = client.From("replies").Insert(replyData, false, "", "", "").ExecuteTo(&newReply)
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
			ThreadID   string `json:"thread_id"`
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

		// Decrypt email for notification
		if receiverProfile.Email != "" {
			if decryptedEmail, err := decrypt(receiverProfile.Email); err == nil {
				receiverProfile.Email = decryptedEmail
			} else {
				log.Printf("Failed to decrypt email for %s: %v", receiverProfile.Username, err)
			}
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

		// 🛡️ Safety check 4: For threaded follow-ups, verify sender
		if body.ThreadID != "" {
			var originalThread []map[string]interface{}
			_, err := client.From("messages").
				Select("sender_id", "", false).
				Eq("thread_id", body.ThreadID).
				Order("created_at", &postgrest.OrderOpts{Ascending: true}).
				Limit(1, "").
				ExecuteTo(&originalThread)

			if err == nil && len(originalThread) > 0 {
				rootSenderID := originalThread[0]["sender_id"]
				// If the original sender was logged in, we must ensure the follow-up is from them
				if rootSenderID != nil {
					currID := ""
					if senderID != nil {
						currID = *senderID
					}
					if rootSenderID.(string) != currID {
						c.JSON(http.StatusForbidden, gin.H{"error": "Only the original sender can ask a follow-up"})
						return
					}
				} else {
					// Root was anonymous and not logged in - technically anyone could follow up if they have the thread_id
					// but we'll allow it for now as "thread_id" is a secure UUID.
				}
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
		if body.ThreadID != "" {
			messageData["thread_id"] = body.ThreadID
		}

		// Encrypt message content
		encryptedContent, err := encrypt(body.Content)
		if err == nil {
			messageData["content"] = encryptedContent
		} else {
			log.Printf("Encryption error: %v", err)
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

	// Public Profile: Fetch profile and decrypted conversations
	r.GET("/profile/:username", func(c *gin.Context) {
		username := c.Param("username")

		var profile struct {
			ID          string `json:"id"`
			Username    string `json:"username"`
			DisplayName string `json:"display_name"`
			AvatarURL   string `json:"avatar_url"`
			Bio         string `json:"bio"`
			IsPaused    bool   `json:"is_paused"`
		}

		_, err := client.From("profiles").
			Select("*", "", false).
			Eq("username", username).
			Single().
			ExecuteTo(&profile)

		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Profile not found"})
			return
		}

		var messages []interface{}
		_, err = client.From("messages").
			Select("id, content, created_at, thread_id, sender_id, replies(content, created_at), likes(count), bookmarks(count)", "exact", false).
			Eq("receiver_id", profile.ID).
			Eq("status", "replied").
			Order("created_at", &postgrest.OrderOpts{Ascending: false}).
			ExecuteTo(&messages)

		if err != nil {
			log.Printf("Supabase error fetching profile messages: %v", err)
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch messages"})
			return
		}

		// Optional: Fetch user's own likes/bookmarks if logged in
		userLikes := make(map[string]bool)
		userBookmarks := make(map[string]bool)
		authHeader := c.GetHeader("Authorization")
		if authHeader != "" && strings.HasPrefix(authHeader, "Bearer ") {
			token := authHeader[len("Bearer "):]
			userResponse, err := client.Auth.WithToken(token).GetUser()
			if err == nil {
				uid := userResponse.User.ID.String()

				// Fetch user likes for these messages
				var likesData []struct {
					MessageID string `json:"message_id"`
				}
				client.From("likes").Select("message_id", "", false).Eq("user_id", uid).ExecuteTo(&likesData)
				for _, l := range likesData {
					userLikes[l.MessageID] = true
				}

				// Fetch user bookmarks for these messages
				var bookmarksData []struct {
					MessageID string `json:"message_id"`
				}
				client.From("bookmarks").Select("message_id", "", false).Eq("user_id", uid).ExecuteTo(&bookmarksData)
				for _, b := range bookmarksData {
					userBookmarks[b.MessageID] = true
				}
			}
		}

		// Decrypt public conversations
		for i, m := range messages {
			msgMap := m.(map[string]interface{})
			if content, ok := msgMap["content"].(string); ok {
				if dec, err := decrypt(content); err == nil {
					msgMap["content"] = dec
				}
			}

			if repliesVal, ok := msgMap["replies"]; ok && repliesVal != nil {
				if repliesList, ok := repliesVal.([]interface{}); ok {
					for j, r := range repliesList {
						if rMap, ok := r.(map[string]interface{}); ok {
							if rContent, ok := rMap["content"].(string); ok {
								if dec, err := decrypt(rContent); err == nil {
									rMap["content"] = dec
								} else {
									log.Printf("Failed to decrypt reply content: %v", err)
								}
							}
							repliesList[j] = rMap
						}
					}
					msgMap["replies"] = repliesList
				} else if rMap, ok := repliesVal.(map[string]interface{}); ok {
					if rContent, ok := rMap["content"].(string); ok {
						if dec, err := decrypt(rContent); err == nil {
							rMap["content"] = dec
						} else {
							log.Printf("Failed to decrypt single reply content: %v", err)
						}
					}
					msgMap["replies"] = rMap
				}
			}
			msgMap["is_liked"] = userLikes[msgMap["id"].(string)]
			msgMap["is_bookmarked"] = userBookmarks[msgMap["id"].(string)]

			// Extract counts
			if lVal, ok := msgMap["likes"].([]interface{}); ok && len(lVal) > 0 {
				if lMap, ok := lVal[0].(map[string]interface{}); ok {
					msgMap["likes_count"] = lMap["count"]
				}
			} else {
				msgMap["likes_count"] = 0
			}

			if bVal, ok := msgMap["bookmarks"].([]interface{}); ok && len(bVal) > 0 {
				if bMap, ok := bVal[0].(map[string]interface{}); ok {
					msgMap["bookmarks_count"] = bMap["count"]
				}
			} else {
				msgMap["bookmarks_count"] = 0
			}

			messages[i] = msgMap
		}

		c.JSON(http.StatusOK, gin.H{
			"profile":  profile,
			"messages": messages,
		})
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

	// Like Message
	r.POST("/messages/:id/like", authMiddleware, func(c *gin.Context) {
		messageID := c.Param("id")
		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		_, _, err := client.From("likes").
			Insert(map[string]interface{}{
				"message_id": messageID,
				"user_id":    supabaseUser.ID.String(),
			}, false, "", "", "").
			Execute()

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to like"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "liked"})
	})

	// Unlike Message
	r.DELETE("/messages/:id/like", authMiddleware, func(c *gin.Context) {
		messageID := c.Param("id")
		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		_, _, err := client.From("likes").
			Delete("", "").
			Eq("message_id", messageID).
			Eq("user_id", supabaseUser.ID.String()).
			Execute()

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unlike"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "unliked"})
	})

	// Bookmark Message
	r.POST("/messages/:id/bookmark", authMiddleware, func(c *gin.Context) {
		messageID := c.Param("id")
		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		_, _, err := client.From("bookmarks").
			Insert(map[string]interface{}{
				"message_id": messageID,
				"user_id":    supabaseUser.ID.String(),
			}, false, "", "", "").
			Execute()

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to bookmark"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "bookmarked"})
	})

	// Remove Bookmark
	r.DELETE("/messages/:id/bookmark", authMiddleware, func(c *gin.Context) {
		messageID := c.Param("id")
		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		_, _, err := client.From("bookmarks").
			Delete("", "").
			Eq("message_id", messageID).
			Eq("user_id", supabaseUser.ID.String()).
			Execute()

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to remove bookmark"})
			return
		}
	})

	// Get user's bookmarked messages
	r.GET("/bookmarks", authMiddleware, func(c *gin.Context) {
		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		var bookmarkData []struct {
			MessageID string      `json:"message_id"`
			Message   interface{} `json:"message"`
		}

		_, err := client.From("bookmarks").
			Select("message_id, message:messages(*, profiles:receiver_id(username, avatar_url), replies(*))", "exact", false).
			Eq("user_id", supabaseUser.ID.String()).
			Order("created_at", &postgrest.OrderOpts{Ascending: false}).
			ExecuteTo(&bookmarkData)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch bookmarks: " + err.Error()})
			return
		}

		messages := make([]interface{}, 0)
		for _, b := range bookmarkData {
			if b.Message != nil {
				msgMap := b.Message.(map[string]interface{})
				// Decrypt message content
				if content, ok := msgMap["content"].(string); ok {
					if dec, err := decrypt(content); err == nil {
						msgMap["content"] = dec
					}
				}
				// Decrypt replies
				if repliesVal, ok := msgMap["replies"]; ok && repliesVal != nil {
					if replies, ok := repliesVal.([]interface{}); ok {
						for j, r := range replies {
							replyMap := r.(map[string]interface{})
							if rContent, ok := replyMap["content"].(string); ok {
								if dec, err := decrypt(rContent); err == nil {
									replyMap["content"] = dec
								}
							}
							replies[j] = replyMap
						}
					}
				}
				messages = append(messages, msgMap)
			}
		}

		c.JSON(http.StatusOK, messages)
	})

	// Get user's liked messages
	r.GET("/likes", authMiddleware, func(c *gin.Context) {
		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		var likedData []struct {
			MessageID string      `json:"message_id"`
			Message   interface{} `json:"message"`
		}

		_, err := client.From("likes").
			Select("message_id, message:messages(*, profiles:receiver_id(username, avatar_url), replies(*))", "exact", false).
			Eq("user_id", supabaseUser.ID.String()).
			Order("created_at", &postgrest.OrderOpts{Ascending: false}).
			ExecuteTo(&likedData)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch liked messages: " + err.Error()})
			return
		}

		messages := make([]interface{}, 0)
		for _, l := range likedData {
			if l.Message != nil {
				msgMap := l.Message.(map[string]interface{})
				// Decrypt message content
				if content, ok := msgMap["content"].(string); ok {
					if dec, err := decrypt(content); err == nil {
						msgMap["content"] = dec
					}
				}
				// Decrypt replies
				if repliesVal, ok := msgMap["replies"]; ok && repliesVal != nil {
					if replies, ok := repliesVal.([]interface{}); ok {
						for j, r := range replies {
							replyMap := r.(map[string]interface{})
							if rContent, ok := replyMap["content"].(string); ok {
								if dec, err := decrypt(rContent); err == nil {
									replyMap["content"] = dec
								}
							}
							replies[j] = replyMap
						}
					}
				}
				messages = append(messages, msgMap)
			}
		}

		c.JSON(http.StatusOK, messages)
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

	// Get My Profile (Decrypted)
	r.GET("/profile", authMiddleware, func(c *gin.Context) {
		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		var profile map[string]interface{}
		_, err := client.From("profiles").
			Select("*", "", false).
			Eq("id", supabaseUser.ID.String()).
			Single().
			ExecuteTo(&profile)

		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Profile not found"})
			return
		}

		// Decrypt email if present
		if email, ok := profile["email"].(string); ok && email != "" {
			if dec, err := decrypt(email); err == nil {
				profile["email"] = dec
			}
		}

		c.JSON(http.StatusOK, profile)
	})

	// Search Users
	r.GET("/users/search", authMiddleware, func(c *gin.Context) {
		query := c.Query("q")
		if len(query) < 2 {
			c.JSON(http.StatusOK, []interface{}{})
			return
		}

		var users []interface{}
		_, err := client.From("profiles").
			Select("id, username, display_name, avatar_url", "", false).
			Ilike("username", "%"+query+"%").
			Limit(10, "").
			ExecuteTo(&users)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Search failed"})
			return
		}
		c.JSON(http.StatusOK, users)
	})

	// Send Friend Request
	r.POST("/friends/request", authMiddleware, func(c *gin.Context) {
		var body struct {
			ReceiverID string `json:"receiver_id" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		if body.ReceiverID == supabaseUser.ID.String() {
			c.JSON(http.StatusBadRequest, gin.H{"error": "You cannot add yourself"})
			return
		}

		// Check if already friends or request pending
		var existing []interface{}
		_, err := client.From("friendships").
			Select("*", "", false).
			Or(fmt.Sprintf("and(sender_id.eq.%s,receiver_id.eq.%s),and(sender_id.eq.%s,receiver_id.eq.%s)",
				supabaseUser.ID.String(), body.ReceiverID, body.ReceiverID, supabaseUser.ID.String()), "").
			ExecuteTo(&existing)

		if len(existing) > 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Request already exists or already friends"})
			return
		}

		_, _, err = client.From("friendships").
			Insert(map[string]interface{}{
				"sender_id":   supabaseUser.ID.String(),
				"receiver_id": body.ReceiverID,
				"status":      "pending",
			}, false, "", "", "").
			Execute()

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to send request"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "request_sent"})
	})

	// Get Friend Requests
	r.GET("/friends/requests", authMiddleware, func(c *gin.Context) {
		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		var requests []interface{}
		_, err := client.From("friendships").
			Select("*, profiles!sender_id(username, display_name, avatar_url)", "", false).
			Eq("receiver_id", supabaseUser.ID.String()).
			Eq("status", "pending").
			ExecuteTo(&requests)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch requests"})
			return
		}
		c.JSON(http.StatusOK, requests)
	})

	// Accept Friend Request
	r.POST("/friends/accept", authMiddleware, func(c *gin.Context) {
		var body struct {
			RequestID string `json:"request_id" binding:"required"`
		}
		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request"})
			return
		}

		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		_, _, err := client.From("friendships").
			Update(map[string]interface{}{"status": "accepted"}, "", "").
			Eq("id", body.RequestID).
			Eq("receiver_id", supabaseUser.ID.String()).
			Execute()

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to accept request"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"status": "accepted"})
	})

	// Friends Feed: Get public conversations from friends
	r.GET("/friends/feed", authMiddleware, func(c *gin.Context) {
		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		// 1. Get friend IDs
		var friendships []map[string]interface{}
		_, err := client.From("friendships").
			Select("sender_id, receiver_id", "", false).
			Eq("status", "accepted").
			Or(fmt.Sprintf("sender_id.eq.%s,receiver_id.eq.%s", supabaseUser.ID.String(), supabaseUser.ID.String()), "").
			ExecuteTo(&friendships)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch friendships"})
			return
		}

		friendIDs := make([]string, 0)
		for _, f := range friendships {
			sID := f["sender_id"].(string)
			rID := f["receiver_id"].(string)
			if sID != supabaseUser.ID.String() {
				friendIDs = append(friendIDs, sID)
			} else if rID != supabaseUser.ID.String() {
				friendIDs = append(friendIDs, rID)
			}
		}

		if len(friendIDs) == 0 {
			c.JSON(http.StatusOK, []interface{}{})
			return
		}

		// 2. Fetch public messages for those friends
		var messages []interface{}
		_, err = client.From("messages").
			Select("*, profiles!receiver_id(username, display_name, avatar_url), replies(*)", "exact", false).
			In("receiver_id", friendIDs).
			Eq("status", "replied").
			Order("created_at", &postgrest.OrderOpts{Ascending: false}).
			Limit(30, "").
			ExecuteTo(&messages)

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch feed"})
			return
		}

		// Decrypt everything
		for i, m := range messages {
			msgMap := m.(map[string]interface{})
			if content, ok := msgMap["content"].(string); ok {
				if dec, err := decrypt(content); err == nil {
					msgMap["content"] = dec
				}
			}
			if replies, ok := msgMap["replies"].([]interface{}); ok {
				for j, r := range replies {
					replyMap := r.(map[string]interface{})
					if rContent, ok := replyMap["content"].(string); ok {
						if dec, err := decrypt(rContent); err == nil {
							replyMap["content"] = dec
						}
					}
					replies[j] = replyMap
				}
			}
			messages[i] = msgMap
		}

		c.JSON(http.StatusOK, messages)
	})

	// Update Profile: Set bio, display name, etc. (Can be used for setup)
	r.PUT("/profile", authMiddleware, func(c *gin.Context) {
		var body struct {
			Username       string   `json:"username"`
			DisplayName    string   `json:"display_name"`
			Bio            string   `json:"bio"`
			AvatarURL      string   `json:"avatar_url"`
			Email          string   `json:"email"`
			IsPaused       bool     `json:"is_paused"`
			BlockedPhrases []string `json:"blocked_phrases"`
		}

		if err := c.ShouldBindJSON(&body); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		user, _ := c.Get("user")
		supabaseUser := user.(types.User)

		// Encrypt email if provided
		finalEmail := body.Email
		if finalEmail != "" {
			encrypted, err := encrypt(finalEmail)
			if err == nil {
				finalEmail = encrypted
			} else {
				log.Printf("Email encryption error: %v", err)
			}
		}

		updateData := map[string]interface{}{
			"id":              supabaseUser.ID.String(),
			"display_name":    body.DisplayName,
			"bio":             body.Bio,
			"avatar_url":      body.AvatarURL,
			"is_paused":       body.IsPaused,
			"blocked_phrases": body.BlockedPhrases,
			"updated_at":      "now()",
		}

		if body.Username != "" {
			updateData["username"] = body.Username
		}
		if finalEmail != "" {
			updateData["email"] = finalEmail
		}

		var updatedProfile []interface{}
		_, err := client.From("profiles").
			Upsert(updateData, "", "", "").
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
