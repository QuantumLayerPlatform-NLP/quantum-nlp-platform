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
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/agent-orchestrator/internal/config"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/agent-orchestrator/internal/handlers"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/agent-orchestrator/internal/middleware"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/agent-orchestrator/internal/services"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize logger
	logger := common.NewLogger(cfg.LogLevel, cfg.LogFormat)
	logger.Info("Starting Agent Orchestrator Service", "version", cfg.Version, "port", cfg.Port)

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

	// Initialize Neo4j client for agent relationships
	neo4jClient, err := common.NewNeo4jClient(cfg.Neo4j)
	if err != nil {
		logger.Fatal("Failed to connect to Neo4j", "error", err)
	}
	defer neo4jClient.Close()

	// Initialize agent services
	metaPromptService := services.NewMetaPromptService(logger, db, redisClient)
	agentFactoryService := services.NewAgentFactoryService(logger, azureClient, bedrockClient, metaPromptService)
	ensembleService := services.NewEnsembleService(logger, db, redisClient)
	selfCriticService := services.NewSelfCriticService(logger, azureClient, bedrockClient)
	validationService := services.NewTreeSitterValidationService(logger, cfg.TreeSitter)
	
	// Initialize orchestrator service
	orchestratorService := services.NewAgentOrchestratorService(
		logger,
		agentFactoryService,
		ensembleService,
		selfCriticService,
		validationService,
		db,
		neo4jClient,
		redisClient,
	)

	// Initialize WebSocket hub for real-time updates
	wsHub := services.NewWebSocketHub(logger)
	go wsHub.Run()

	// Initialize HTTP handlers
	healthHandler := handlers.NewHealthHandler(logger)
	agentHandler := handlers.NewAgentHandler(logger, orchestratorService, wsHub)
	orchestratorHandler := handlers.NewOrchestratorHandler(logger, orchestratorService)
	ensembleHandler := handlers.NewEnsembleHandler(logger, ensembleService)
	validationHandler := handlers.NewValidationHandler(logger, validationService)
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

	// WebSocket endpoint
	router.GET("/ws", wsHandler.HandleWebSocket)

	// API routes
	api := router.Group("/api/v1")
	{
		// Authentication middleware for API routes
		api.Use(middleware.Auth(logger, redisClient))

		// Agent lifecycle endpoints
		agents := api.Group("/agents")
		{
			agents.POST("/create", agentHandler.CreateAgent)
			agents.GET("/:id", agentHandler.GetAgent)
			agents.PUT("/:id", agentHandler.UpdateAgent)
			agents.DELETE("/:id", agentHandler.DeleteAgent)
			agents.GET("", agentHandler.ListAgents)
			agents.POST("/:id/execute", agentHandler.ExecuteAgent)
			agents.GET("/:id/status", agentHandler.GetAgentStatus)
			agents.POST("/:id/stop", agentHandler.StopAgent)
		}

		// Orchestration endpoints
		orchestration := api.Group("/orchestration")
		{
			orchestration.POST("/process", orchestratorHandler.ProcessTask)
			orchestration.GET("/tasks/:id", orchestratorHandler.GetTaskStatus)
			orchestration.GET("/tasks", orchestratorHandler.ListTasks)
			orchestration.POST("/tasks/:id/cancel", orchestratorHandler.CancelTask)
			orchestration.GET("/pipeline/:id", orchestratorHandler.GetPipelineStatus)
		}

		// Ensemble endpoints
		ensemble := api.Group("/ensemble")
		{
			ensemble.POST("/create", ensembleHandler.CreateEnsemble)
			ensemble.GET("/:id", ensembleHandler.GetEnsemble)
			ensemble.PUT("/:id", ensembleHandler.UpdateEnsemble)
			ensemble.DELETE("/:id", ensembleHandler.DeleteEnsemble)
			ensemble.POST("/:id/execute", ensembleHandler.ExecuteEnsemble)
			ensemble.GET("/:id/results", ensembleHandler.GetEnsembleResults)
		}

		// Self-critic endpoints
		critic := api.Group("/critic")
		{
			critic.POST("/analyze", agentHandler.AnalyzeOutput)
			critic.POST("/improve", agentHandler.ImproveOutput)
			critic.GET("/feedback/:id", agentHandler.GetCriticFeedback)
			critic.POST("/validate", agentHandler.ValidateOutput)
		}

		// Validation endpoints
		validation := api.Group("/validation")
		{
			validation.POST("/code", validationHandler.ValidateCode)
			validation.POST("/syntax", validationHandler.ValidateSyntax)
			validation.POST("/structure", validationHandler.ValidateStructure)
			validation.GET("/languages", validationHandler.GetSupportedLanguages)
		}

		// Meta-prompt endpoints
		metaprompts := api.Group("/metaprompts")
		{
			metaprompts.POST("", agentHandler.CreateMetaPrompt)
			metaprompts.GET("/:id", agentHandler.GetMetaPrompt)
			metaprompts.PUT("/:id", agentHandler.UpdateMetaPrompt)
			metaprompts.DELETE("/:id", agentHandler.DeleteMetaPrompt)
			metaprompts.GET("", agentHandler.ListMetaPrompts)
			metaprompts.POST("/:id/generate", agentHandler.GenerateFromMetaPrompt)
		}

		// Analytics endpoints
		analytics := api.Group("/analytics")
		{
			analytics.GET("/performance", orchestratorHandler.GetPerformanceMetrics)
			analytics.GET("/usage", orchestratorHandler.GetUsageStatistics)
			analytics.GET("/costs", orchestratorHandler.GetCostAnalysis)
			analytics.GET("/trends", orchestratorHandler.GetTrendAnalysis)
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

	// Stop WebSocket hub
	wsHub.Stop()

	// Attempt graceful shutdown
	if err := server.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown", "error", err)
	}

	logger.Info("Server exited")
}