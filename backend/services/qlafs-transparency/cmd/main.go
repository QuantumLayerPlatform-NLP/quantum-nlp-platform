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
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/qlafs-transparency/internal/config"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/qlafs-transparency/internal/handlers"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/qlafs-transparency/internal/middleware"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/qlafs-transparency/internal/services"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize logger
	logger := common.NewLogger(cfg.LogLevel, cfg.LogFormat)
	logger.Info("Starting QLAFS Transparency Service", "version", cfg.Version, "port", cfg.Port)

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

	// Initialize blockchain client for anchoring
	blockchainClient, err := services.NewBlockchainClient(cfg.Blockchain, logger)
	if err != nil {
		logger.Fatal("Failed to initialize blockchain client", "error", err)
	}
	defer blockchainClient.Close()

	// Initialize transparency services
	logService := services.NewTransparencyLogService(logger, db, blockchainClient)
	auditService := services.NewAuditService(logger, db, redisClient)
	merkleService := services.NewMerkleTreeService(logger)
	
	// Initialize orchestrator service
	orchestratorService := services.NewTransparencyOrchestratorService(
		logger,
		logService,
		auditService,
		merkleService,
		db,
		redisClient,
	)

	// Start background services
	anchorService := services.NewAnchoringService(logger, logService, blockchainClient, cfg.Anchoring)
	go anchorService.Start()

	compactionService := services.NewLogCompactionService(logger, logService, cfg.Compaction)
	go compactionService.Start()

	// Initialize HTTP handlers
	healthHandler := handlers.NewHealthHandler(logger)
	logHandler := handlers.NewLogHandler(logger, orchestratorService)
	auditHandler := handlers.NewAuditHandler(logger, auditService)
	verificationHandler := handlers.NewVerificationHandler(logger, orchestratorService)

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

		// Transparency log endpoints
		logs := api.Group("/logs")
		{
			logs.POST("/entries", logHandler.AddLogEntry)
			logs.GET("/entries/:id", logHandler.GetLogEntry)
			logs.GET("/entries", logHandler.ListLogEntries)
			logs.GET("/proof/:id", logHandler.GetInclusionProof)
			logs.GET("/consistency", logHandler.GetConsistencyProof)
			logs.GET("/root", logHandler.GetSignedTreeHead)
		}

		// Audit endpoints
		audit := api.Group("/audit")
		{
			audit.POST("/trails", auditHandler.CreateAuditTrail)
			audit.GET("/trails/:id", auditHandler.GetAuditTrail)
			audit.GET("/trails", auditHandler.ListAuditTrails)
			audit.POST("/events", auditHandler.LogAuditEvent)
			audit.GET("/events", auditHandler.QueryAuditEvents)
		}

		// Verification endpoints
		verification := api.Group("/verification")
		{
			verification.POST("/verify-entry", verificationHandler.VerifyLogEntry)
			verification.POST("/verify-proof", verificationHandler.VerifyInclusionProof)
			verification.POST("/verify-consistency", verificationHandler.VerifyConsistency)
			verification.GET("/integrity/:id", verificationHandler.CheckIntegrity)
		}

		// Blockchain anchoring endpoints
		anchoring := api.Group("/anchoring")
		{
			anchoring.GET("/status", logHandler.GetAnchoringStatus)
			anchoring.GET("/anchors", logHandler.ListBlockchainAnchors)
			anchoring.GET("/anchors/:hash", logHandler.GetAnchorDetails)
			anchoring.POST("/anchor", logHandler.TriggerAnchoring)
		}

		// Merkle tree endpoints
		merkle := api.Group("/merkle")
		{
			merkle.GET("/tree/:id", logHandler.GetMerkleTree)
			merkle.GET("/tree/:id/proof", logHandler.GetMerkleProof)
			merkle.POST("/tree/verify", logHandler.VerifyMerkleProof)
		}
	}

	// Public verification endpoints (no auth required)
	public := router.Group("/public/v1")
	{
		public.GET("/verify/:hash", verificationHandler.PublicVerifyEntry)
		public.GET("/tree-head", logHandler.GetPublicTreeHead)
		public.GET("/entry/:id", logHandler.GetPublicEntry)
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
	anchorService.Stop()
	compactionService.Stop()

	// Attempt graceful shutdown
	if err := server.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown", "error", err)
	}

	logger.Info("Server exited")
}