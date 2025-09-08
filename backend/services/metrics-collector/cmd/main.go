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
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/metrics-collector/internal/config"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/metrics-collector/internal/handlers"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/metrics-collector/internal/middleware"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/metrics-collector/internal/services"
)

func main() {
	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("Failed to load configuration: %v", err)
	}

	// Initialize logger
	logger := common.NewLogger(cfg.LogLevel, cfg.LogFormat)
	logger.Info("Starting Metrics Collector Service", "version", cfg.Version, "port", cfg.Port)

	// Initialize database connection
	db, err := common.NewDatabase(cfg.Database)
	if err != nil {
		logger.Fatal("Failed to connect to database", "error", err)
	}
	defer db.Close()

	// Initialize Redis client for real-time metrics
	redisClient, err := common.NewRedisClient(cfg.Redis)
	if err != nil {
		logger.Fatal("Failed to connect to Redis", "error", err)
	}
	defer redisClient.Close()

	// Initialize time series database connection
	timeSeriesDB, err := common.NewTimeSeriesDatabase(cfg.TimeSeriesDB)
	if err != nil {
		logger.Fatal("Failed to connect to time series database", "error", err)
	}
	defer timeSeriesDB.Close()

	// Initialize metrics services
	collectorService := services.NewMetricsCollectorService(logger, db, timeSeriesDB, redisClient)
	aggregationService := services.NewAggregationService(logger, timeSeriesDB, redisClient)
	alertingService := services.NewAlertingService(logger, cfg.Alerting, redisClient)
	dashboardService := services.NewDashboardService(logger, db, timeSeriesDB, redisClient)
	
	// Initialize orchestrator service
	orchestratorService := services.NewMetricsOrchestratorService(
		logger,
		collectorService,
		aggregationService,
		alertingService,
		dashboardService,
		cfg.Metrics,
	)

	// Start background collection services
	go collectorService.StartSystemMetricsCollection()
	go collectorService.StartApplicationMetricsCollection()
	go collectorService.StartBusinessMetricsCollection()
	
	// Start aggregation services
	go aggregationService.StartRealTimeAggregation()
	go aggregationService.StartBatchAggregation()
	
	// Start alerting service
	go alertingService.StartAlertProcessing()

	// Initialize WebSocket hub for real-time metrics streaming
	wsHub := services.NewWebSocketHub(logger)
	go wsHub.Run()

	// Initialize HTTP handlers
	healthHandler := handlers.NewHealthHandler(logger)
	metricsHandler := handlers.NewMetricsHandler(logger, orchestratorService, wsHub)
	dashboardHandler := handlers.NewDashboardHandler(logger, dashboardService)
	alertHandler := handlers.NewAlertHandler(logger, alertingService)
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

	// WebSocket endpoint for real-time metrics
	router.GET("/ws/metrics", wsHandler.HandleMetricsWebSocket)

	// API routes
	api := router.Group("/api/v1")
	{
		// Authentication middleware for API routes
		api.Use(middleware.Auth(logger, redisClient))

		// Metrics collection endpoints
		metrics := api.Group("/metrics")
		{
			metrics.POST("/collect", metricsHandler.CollectMetric)
			metrics.POST("/batch", metricsHandler.CollectBatchMetrics)
			metrics.GET("/query", metricsHandler.QueryMetrics)
			metrics.GET("/current", metricsHandler.GetCurrentMetrics)
			metrics.GET("/history", metricsHandler.GetMetricsHistory)
		}

		// Dashboard endpoints
		dashboard := api.Group("/dashboard")
		{
			dashboard.GET("/overview", dashboardHandler.GetOverviewMetrics)
			dashboard.GET("/performance", dashboardHandler.GetPerformanceMetrics)
			dashboard.GET("/costs", dashboardHandler.GetCostMetrics)
			dashboard.GET("/usage", dashboardHandler.GetUsageMetrics)
			dashboard.GET("/availability", dashboardHandler.GetAvailabilityMetrics)
			dashboard.GET("/custom/:dashboardId", dashboardHandler.GetCustomDashboard)
		}

		// Aggregation endpoints
		aggregation := api.Group("/aggregation")
		{
			aggregation.GET("/summary", metricsHandler.GetAggregatedSummary)
			aggregation.GET("/trends", metricsHandler.GetTrendAnalysis)
			aggregation.GET("/comparisons", metricsHandler.GetComparativeMetrics)
			aggregation.POST("/custom", metricsHandler.CreateCustomAggregation)
		}

		// Alerting endpoints
		alerts := api.Group("/alerts")
		{
			alerts.GET("", alertHandler.ListAlerts)
			alerts.POST("", alertHandler.CreateAlert)
			alerts.GET("/:id", alertHandler.GetAlert)
			alerts.PUT("/:id", alertHandler.UpdateAlert)
			alerts.DELETE("/:id", alertHandler.DeleteAlert)
			alerts.POST("/:id/acknowledge", alertHandler.AcknowledgeAlert)
			alerts.GET("/rules", alertHandler.ListAlertRules)
			alerts.POST("/rules", alertHandler.CreateAlertRule)
		}

		// System metrics endpoints
		system := api.Group("/system")
		{
			system.GET("/cpu", metricsHandler.GetCPUMetrics)
			system.GET("/memory", metricsHandler.GetMemoryMetrics)
			system.GET("/disk", metricsHandler.GetDiskMetrics)
			system.GET("/network", metricsHandler.GetNetworkMetrics)
			system.GET("/health", metricsHandler.GetSystemHealth)
		}

		// Application metrics endpoints
		application := api.Group("/application")
		{
			application.GET("/requests", metricsHandler.GetRequestMetrics)
			application.GET("/errors", metricsHandler.GetErrorMetrics)
			application.GET("/latency", metricsHandler.GetLatencyMetrics)
			application.GET("/throughput", metricsHandler.GetThroughputMetrics)
			application.GET("/services", metricsHandler.GetServiceMetrics)
		}

		// Business metrics endpoints
		business := api.Group("/business")
		{
			business.GET("/agents", metricsHandler.GetAgentMetrics)
			business.GET("/tasks", metricsHandler.GetTaskMetrics)
			business.GET("/costs", metricsHandler.GetBusinessCostMetrics)
			business.GET("/usage", metricsHandler.GetBusinessUsageMetrics)
			business.GET("/satisfaction", metricsHandler.GetSatisfactionMetrics)
		}

		// Export endpoints
		export := api.Group("/export")
		{
			export.GET("/csv", metricsHandler.ExportCSV)
			export.GET("/json", metricsHandler.ExportJSON)
			export.GET("/prometheus", metricsHandler.ExportPrometheus)
			export.GET("/grafana", metricsHandler.ExportGrafana)
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

	// Stop background services
	collectorService.Stop()
	aggregationService.Stop()
	alertingService.Stop()
	wsHub.Stop()

	// Attempt graceful shutdown
	if err := server.Shutdown(ctx); err != nil {
		logger.Fatal("Server forced to shutdown", "error", err)
	}

	logger.Info("Server exited")
}