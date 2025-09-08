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
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/qlafs-consensus/internal/config"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/qlafs-consensus/internal/handlers"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/qlafs-consensus/internal/middleware"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/qlafs-consensus/internal/services"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize logger
	logger := common.NewLogger(cfg.LogLevel, cfg.LogFormat)
	logger.Info("Starting QLAFS Consensus Service", "version", cfg.Version, "port", cfg.Port)

	// Initialize database connection
	db, err := common.NewDatabase(cfg.Database)
	if err != nil {
		logger.Fatal("Failed to connect to database", "error", err)
	}
	defer db.Close()

	// Initialize Redis client for coordination
	redisClient, err := common.NewRedisClient(cfg.Redis)
	if err != nil {
		logger.Fatal("Failed to connect to Redis", "error", err)
	}
	defer redisClient.Close()

	// Initialize consensus services
	byzantineService := services.NewByzantineConsensusService(logger, cfg.Consensus, redisClient)
	validatorService := services.NewValidatorService(logger, db, redisClient)
	orchestratorService := services.NewConsensusOrchestratorService(
		logger,
		byzantineService,
		validatorService,
		db,
		redisClient,
	)

	// Start consensus engine
	consensusEngine := services.NewConsensusEngine(logger, orchestratorService, cfg.Consensus)
	go consensusEngine.Start()

	// Initialize HTTP handlers
	healthHandler := handlers.NewHealthHandler(logger)
	consensusHandler := handlers.NewConsensusHandler(logger, orchestratorService)
	validatorHandler := handlers.NewValidatorHandler(logger, validatorService)

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

		// Consensus endpoints
		consensus := api.Group("/consensus")
		{
			consensus.POST("/propose", consensusHandler.ProposeValidation)
			consensus.GET("/status/:proposalId", consensusHandler.GetConsensusStatus)
			consensus.POST("/vote", consensusHandler.SubmitVote)
			consensus.GET("/results/:proposalId", consensusHandler.GetConsensusResult)
			consensus.GET("/history", consensusHandler.GetConsensusHistory)
		}

		// Validator management endpoints
		validators := api.Group("/validators")
		{
			validators.GET("", validatorHandler.ListValidators)
			validators.POST("", validatorHandler.RegisterValidator)
			validators.GET("/:id", validatorHandler.GetValidator)
			validators.PUT("/:id", validatorHandler.UpdateValidator)
			validators.DELETE("/:id", validatorHandler.DeregisterValidator)
			validators.POST("/:id/challenge", validatorHandler.ChallengeValidator)
			validators.GET("/:id/reputation", validatorHandler.GetValidatorReputation)
		}

		// Network health endpoints
		network := api.Group("/network")
		{
			network.GET("/status", consensusHandler.GetNetworkStatus)
			network.GET("/metrics", consensusHandler.GetNetworkMetrics)
			network.POST("/sync", consensusHandler.SynchronizeNetwork)
		}

		// Byzantine fault tolerance endpoints
		bft := api.Group("/bft")
		{
			bft.GET("/status", consensusHandler.GetByzantineStatus)
			bft.POST("/suspect", consensusHandler.ReportSuspiciousNode)
			bft.GET("/blacklist", consensusHandler.GetBlacklistedNodes)
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

	// Stop consensus engine
	consensusEngine.Stop()

	// Attempt graceful shutdown
	if err := server.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown", "error", err)
	}

	logger.Info("Server exited")
}