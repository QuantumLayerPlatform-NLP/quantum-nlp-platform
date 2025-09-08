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
	"github.com/quantumlayer/quantum-nlp-platform/backend/pkg/azure"
	"github.com/quantumlayer/quantum-nlp-platform/backend/pkg/bedrock"
	"github.com/quantumlayer/quantum-nlp-platform/backend/pkg/common"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/nlp-gateway/internal/config"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/nlp-gateway/internal/handlers"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/nlp-gateway/internal/middleware"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/nlp-gateway/internal/services"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize logger
	logger := common.NewLogger(cfg.LogLevel, cfg.LogFormat)
	logger.Info("Starting NLP Gateway", "version", cfg.Version, "port", cfg.Port)

	// Initialize Azure OpenAI client
	azureClient, err := azure.NewClient(cfg.Azure, logger)
	if err != nil {
		logger.Fatal("Failed to initialize Azure client", "error", err)
	}

	// Initialize AWS Bedrock client
	bedrockClient, err := bedrock.NewClient(cfg.AWS, logger)
	if err != nil {
		logger.Fatal("Failed to initialize Bedrock client", "error", err)
	}

	// Initialize database connection
	db, err := common.NewDatabase(cfg.Database)
	if err != nil {
		logger.Fatal("Failed to connect to database", "error", err)
	}
	defer db.Close()

	// Initialize Redis client
	redisClient, err := common.NewRedisClient(cfg.Redis)
	if err != nil {
		logger.Fatal("Failed to connect to Redis", "error", err)
	}
	defer redisClient.Close()

	// Initialize Neo4j client
	neo4jClient, err := common.NewNeo4jClient(cfg.Neo4j)
	if err != nil {
		logger.Fatal("Failed to connect to Neo4j", "error", err)
	}
	defer neo4jClient.Close()

	// Initialize services
	intentService := services.NewIntentService(logger, redisClient)
	orchestratorService := services.NewOrchestratorService(logger, azureClient, bedrockClient, redisClient)
	qlafsService := services.NewQlafsService(logger, db, neo4jClient, redisClient)
	metricsService := services.NewMetricsService(logger, db, redisClient)
	
	// Initialize WebSocket hub
	wsHub := services.NewWebSocketHub(logger)
	go wsHub.Run()

	// Initialize HTTP handlers
	healthHandler := handlers.NewHealthHandler(logger)
	nlpHandler := handlers.NewNLPHandler(logger, intentService, orchestratorService, qlafsService, wsHub)
	agentHandler := handlers.NewAgentHandler(logger, qlafsService)
	metricsHandler := handlers.NewMetricsHandler(logger, metricsService)
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

	// Health check endpoint
	router.GET("/health", healthHandler.Health)
	router.GET("/ready", healthHandler.Ready)

	// WebSocket endpoint
	router.GET("/ws", wsHandler.HandleWebSocket)

	// API routes
	api := router.Group("/api/v1")
	{
		// Authentication middleware for API routes
		api.Use(middleware.Auth(logger, redisClient))

		// NLP processing endpoints
		api.POST("/process", nlpHandler.Process)
		api.POST("/process-stream", nlpHandler.ProcessStream)

		// Agent management endpoints
		agents := api.Group("/agents")
		{
			agents.GET("", agentHandler.ListAgents)
			agents.POST("", agentHandler.CreateAgent)
			agents.GET("/:id", agentHandler.GetAgent)
			agents.PUT("/:id", agentHandler.UpdateAgent)
			agents.DELETE("/:id", agentHandler.DeleteAgent)
			agents.GET("/:id/verify", agentHandler.VerifyAgent)
			agents.GET("/:id/fingerprint", agentHandler.GetFingerprint)
			agents.GET("/:id/lineage", agentHandler.GetLineage)
			agents.POST("/:id/zkproof", agentHandler.GenerateZKProof)
		}

		// Metrics endpoints
		metrics := api.Group("/metrics")
		{
			metrics.GET("/dashboard", metricsHandler.GetDashboardMetrics)
			metrics.GET("/models", metricsHandler.GetModelMetrics)
			metrics.GET("/costs", metricsHandler.GetCostMetrics)
		}

		// Model management endpoints
		models := api.Group("/models")
		{
			models.GET("/status", nlpHandler.GetModelStatus)
			models.POST("/preference", nlpHandler.SetModelPreference)
		}
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

	// Attempt graceful shutdown
	if err := server.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown", "error", err)
	}

	logger.Info("Server exited")
}