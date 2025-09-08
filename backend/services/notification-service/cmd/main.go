package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/quantumlayer/quantum-nlp-platform/backend/pkg/common"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/notification-service/internal/config"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/notification-service/internal/handlers"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/notification-service/internal/middleware"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/notification-service/internal/services"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize logger
	logger := common.NewLogger(cfg.LogLevel, cfg.LogFormat)
	logger.Info("Starting Notification Service", "version", cfg.Version, "port", cfg.Port)

	// Initialize database connection
	db, err := common.NewDatabase(cfg.Database)
	if err != nil {
		logger.Fatal("Failed to connect to database", "error", err)
	}
	defer db.Close()

	// Initialize Redis client for message queuing
	redisClient, err := common.NewRedisClient(cfg.Redis)
	if err != nil {
		logger.Fatal("Failed to connect to Redis", "error", err)
	}
	defer redisClient.Close()

	// Initialize notification services
	emailService := services.NewEmailService(logger, cfg.Email)
	smsService := services.NewSMSService(logger, cfg.SMS)
	pushService := services.NewPushNotificationService(logger, cfg.Push)
	webhookService := services.NewWebhookService(logger, cfg.Webhook)
	slackService := services.NewSlackService(logger, cfg.Slack)
	teamsService := services.NewTeamsService(logger, cfg.Teams)
	
	// Initialize template service
	templateService := services.NewTemplateService(logger, db)
	
	// Initialize orchestrator service
	orchestratorService := services.NewNotificationOrchestratorService(
		logger,
		emailService,
		smsService,
		pushService,
		webhookService,
		slackService,
		teamsService,
		templateService,
		db,
		redisClient,
	)

	// Initialize queue processor
	queueProcessor := services.NewQueueProcessor(logger, orchestratorService, redisClient, cfg.Queue)
	go queueProcessor.Start()

	// Initialize retry service
	retryService := services.NewRetryService(logger, orchestratorService, db, cfg.Retry)
	go retryService.Start()

	// Initialize WebSocket hub for real-time notifications
	wsHub := services.NewWebSocketHub(logger)
	go wsHub.Run()

	// Initialize HTTP handlers
	healthHandler := handlers.NewHealthHandler(logger)
	notificationHandler := handlers.NewNotificationHandler(logger, orchestratorService, wsHub)
	templateHandler := handlers.NewTemplateHandler(logger, templateService)
	subscriptionHandler := handlers.NewSubscriptionHandler(logger, orchestratorService)
	wsHandler := handlers.NewWebSocketHandler(logger, wsHub)

	// Set up Gin router
	if cfg.Environment == "production" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Middleware
	router.Use(middleware.Logger(logger))
	router.Use(middleware.Recovery(logger))
	router.Use(middleware.CORS())
	router.Use(middleware.RequestID())
	router.Use(middleware.RateLimit(cfg.RateLimit))

	// Health check endpoints
	router.GET("/health", healthHandler.Health)
	router.GET("/ready", healthHandler.Ready)

	// WebSocket endpoint for real-time notifications
	router.GET("/ws/notifications", wsHandler.HandleNotificationWebSocket)

	// API routes
	api := router.Group("/api/v1")
	{
		// Authentication middleware for API routes
		api.Use(middleware.Auth(logger, redisClient))

		// Notification sending endpoints
		notifications := api.Group("/notifications")
		{
			notifications.POST("/send", notificationHandler.SendNotification)
			notifications.POST("/send-batch", notificationHandler.SendBatchNotifications)
			notifications.GET("/:id", notificationHandler.GetNotification)
			notifications.GET("", notificationHandler.ListNotifications)
			notifications.GET("/:id/status", notificationHandler.GetNotificationStatus)
			notifications.POST("/:id/retry", notificationHandler.RetryNotification)
			notifications.DELETE("/:id", notificationHandler.CancelNotification)
		}

		// Channel-specific endpoints
		email := api.Group("/email")
		{
			email.POST("/send", notificationHandler.SendEmail)
			email.POST("/send-template", notificationHandler.SendEmailTemplate)
			email.GET("/status/:id", notificationHandler.GetEmailStatus)
		}

		sms := api.Group("/sms")
		{
			sms.POST("/send", notificationHandler.SendSMS)
			sms.GET("/status/:id", notificationHandler.GetSMSStatus)
		}

		push := api.Group("/push")
		{
			push.POST("/send", notificationHandler.SendPushNotification)
			push.POST("/register-device", notificationHandler.RegisterDevice)
			push.DELETE("/device/:token", notificationHandler.UnregisterDevice)
		}

		webhook := api.Group("/webhook")
		{
			webhook.POST("/send", notificationHandler.SendWebhook)
			webhook.GET("/status/:id", notificationHandler.GetWebhookStatus)
		}

		slack := api.Group("/slack")
		{
			slack.POST("/send", notificationHandler.SendSlackMessage)
			slack.GET("/channels", notificationHandler.ListSlackChannels)
		}

		teams := api.Group("/teams")
		{
			teams.POST("/send", notificationHandler.SendTeamsMessage)
			teams.GET("/channels", notificationHandler.ListTeamsChannels)
		}

		// Template management endpoints
		templates := api.Group("/templates")
		{
			templates.GET("", templateHandler.ListTemplates)
			templates.POST("", templateHandler.CreateTemplate)
			templates.GET("/:id", templateHandler.GetTemplate)
			templates.PUT("/:id", templateHandler.UpdateTemplate)
			templates.DELETE("/:id", templateHandler.DeleteTemplate)
			templates.POST("/:id/test", templateHandler.TestTemplate)
			templates.GET("/:id/preview", templateHandler.PreviewTemplate)
		}

		// Subscription management endpoints
		subscriptions := api.Group("/subscriptions")
		{
			subscriptions.GET("", subscriptionHandler.ListSubscriptions)
			subscriptions.POST("", subscriptionHandler.CreateSubscription)
			subscriptions.GET("/:id", subscriptionHandler.GetSubscription)
			subscriptions.PUT("/:id", subscriptionHandler.UpdateSubscription)
			subscriptions.DELETE("/:id", subscriptionHandler.DeleteSubscription)
			subscriptions.POST("/:id/activate", subscriptionHandler.ActivateSubscription)
			subscriptions.POST("/:id/deactivate", subscriptionHandler.DeactivateSubscription)
		}

		// Event endpoints for triggering notifications
		events := api.Group("/events")
		{
			events.POST("/agent-created", notificationHandler.HandleAgentCreatedEvent)
			events.POST("/agent-failed", notificationHandler.HandleAgentFailedEvent)
			events.POST("/task-completed", notificationHandler.HandleTaskCompletedEvent)
			events.POST("/alert-triggered", notificationHandler.HandleAlertTriggeredEvent)
			events.POST("/system-error", notificationHandler.HandleSystemErrorEvent)
			events.POST("/custom", notificationHandler.HandleCustomEvent)
		}

		// Analytics endpoints
		analytics := api.Group("/analytics")
		{
			analytics.GET("/delivery-rates", notificationHandler.GetDeliveryRates)
			analytics.GET("/channel-usage", notificationHandler.GetChannelUsage)
			analytics.GET("/failure-analysis", notificationHandler.GetFailureAnalysis)
			analytics.GET("/performance", notificationHandler.GetPerformanceMetrics)
		}

		// Configuration endpoints
		config := api.Group("/config")
		{
			config.GET("/channels", notificationHandler.GetChannelConfigurations)
			config.PUT("/channels/:channel", notificationHandler.UpdateChannelConfiguration)
			config.GET("/preferences/:userId", notificationHandler.GetUserPreferences)
			config.PUT("/preferences/:userId", notificationHandler.UpdateUserPreferences)
		}
	}

	// Webhook endpoints for external services
	webhooks := router.Group("/webhooks")
	{
		webhooks.POST("/email/status", notificationHandler.HandleEmailWebhook)
		webhooks.POST("/sms/status", notificationHandler.HandleSMSWebhook)
		webhooks.POST("/push/status", notificationHandler.HandlePushWebhook)
		webhooks.POST("/slack/events", notificationHandler.HandleSlackWebhook)
		webhooks.POST("/teams/events", notificationHandler.HandleTeamsWebhook)
	}

	// Prometheus metrics endpoint
	router.GET("/metrics", gin.WrapH(common.PrometheusHandler()))

	// Create HTTP server
	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", cfg.Port),
		Handler:      router,
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
		IdleTimeout:  cfg.IdleTimeout,
	}

	// Start server in goroutine
	go func() {
		logger.Info("Starting HTTP server", "port", cfg.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Failed to start server", "error", err)
		}
	}()

	// Wait for interrupt signal to gracefully shut down the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	// Give outstanding requests a deadline for completion
	ctx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()

	// Stop background services
	queueProcessor.Stop()
	retryService.Stop()
	wsHub.Stop()

	// Attempt graceful shutdown
	if err := server.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown", "error", err)
	}

	logger.Info("Server exited")
}