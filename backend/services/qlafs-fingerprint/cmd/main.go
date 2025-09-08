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
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/qlafs-fingerprint/internal/config"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/qlafs-fingerprint/internal/handlers"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/qlafs-fingerprint/internal/middleware"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/qlafs-fingerprint/internal/services"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize logger
	logger := common.NewLogger(cfg.LogLevel, cfg.LogFormat)
	logger.Info("Starting QLAFS Fingerprint Service", "version", cfg.Version, "port", cfg.Port)

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

	// Initialize Neo4j client for lineage tracking
	neo4jClient, err := common.NewNeo4jClient(cfg.Neo4j)
	if err != nil {
		logger.Fatal("Failed to connect to Neo4j", "error", err)
	}
	defer neo4jClient.Close()

	// Initialize cryptographic services
	cryptoService, err := services.NewCryptoService(cfg.Crypto, logger)
	if err != nil {
		logger.Fatal("Failed to initialize crypto service", "error", err)
	}

	// Initialize fingerprinting services
	staticService := services.NewStaticFingerprintService(logger, cryptoService)
	behavioralService := services.NewBehavioralFingerprintService(logger, db, redisClient)
	cognitiveService := services.NewCognitiveFingerprintService(logger, db)
	compositionalService := services.NewCompositionalFingerprintService(logger, neo4jClient)
	
	// Initialize orchestrator service
	orchestratorService := services.NewFingerprintOrchestratorService(
		logger, 
		staticService, 
		behavioralService, 
		cognitiveService, 
		compositionalService,
		db,
		redisClient,
	)

	// Initialize HTTP handlers
	healthHandler := handlers.NewHealthHandler(logger)
	fingerprintHandler := handlers.NewFingerprintHandler(logger, orchestratorService)
	agentHandler := handlers.NewAgentHandler(logger, orchestratorService)

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

	// API routes
	api := router.Group("/api/v1")
	{
		// Authentication middleware for API routes
		api.Use(middleware.Auth(logger, redisClient))

		// Fingerprint generation endpoints
		api.POST("/fingerprint/static", fingerprintHandler.GenerateStaticFingerprint)
		api.POST("/fingerprint/behavioral", fingerprintHandler.GenerateBehavioralFingerprint)
		api.POST("/fingerprint/cognitive", fingerprintHandler.GenerateCognitiveFingerprint)
		api.POST("/fingerprint/compositional", fingerprintHandler.GenerateCompositionalFingerprint)
		api.POST("/fingerprint/complete", fingerprintHandler.GenerateCompleteFingerprint)

		// Agent management endpoints
		agents := api.Group("/agents")
		{
			agents.POST("/:id/fingerprint", agentHandler.FingerprintAgent)
			agents.GET("/:id/fingerprint", agentHandler.GetAgentFingerprint)
			agents.PUT("/:id/fingerprint", agentHandler.UpdateAgentFingerprint)
			agents.DELETE("/:id/fingerprint", agentHandler.DeleteAgentFingerprint)
			agents.GET("/:id/fingerprint/history", agentHandler.GetFingerprintHistory)
		}

		// Verification endpoints
		verification := api.Group("/verification")
		{
			verification.POST("/verify", fingerprintHandler.VerifyFingerprint)
			verification.POST("/compare", fingerprintHandler.CompareFingerprints)
			verification.GET("/integrity/:id", fingerprintHandler.CheckIntegrity)
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