package integration

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/suite"
	"github.com/quantumlayer/quantum-nlp-platform/backend/pkg/common"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/nlp-gateway/internal/config"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/nlp-gateway/internal/handlers"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/nlp-gateway/internal/middleware"
	"github.com/quantumlayer/quantum-nlp-platform/backend/services/nlp-gateway/internal/services"
)

type APITestSuite struct {
	suite.Suite
	router     *gin.Engine
	server     *httptest.Server
	db         *common.Database
	redis      *common.RedisClient
	neo4j      *common.Neo4jClient
	logger     common.Logger
	authToken  string
}

func TestAPITestSuite(t *testing.T) {
	suite.Run(t, new(APITestSuite))
}

func (s *APITestSuite) SetupSuite() {
	// Set Gin to test mode
	gin.SetMode(gin.TestMode)
	
	// Initialize test configuration
	cfg := &config.Config{
		Environment: "test",
		Port:        8080,
		LogLevel:    "info",
		LogFormat:   "json",
		Database: config.DatabaseConfig{
			Host:         os.Getenv("TEST_DB_HOST"),
			Port:         5432,
			Name:         "quantum_nlp_test",
			User:         "test_user",
			Password:     os.Getenv("TEST_DB_PASSWORD"),
			SSLMode:      "disable",
			MaxOpenConns: 5,
			MaxIdleConns: 2,
		},
		Redis: config.RedisConfig{
			Host:     os.Getenv("TEST_REDIS_HOST"),
			Port:     6379,
			DB:       1, // Use different DB for tests
			PoolSize: 5,
		},
		Neo4j: config.Neo4jConfig{
			URI:      os.Getenv("TEST_NEO4J_URI"),
			Username: "neo4j",
			Password: os.Getenv("TEST_NEO4J_PASSWORD"),
			Database: "quantum_nlp_test",
		},
	}
	
	// Initialize logger
	s.logger = common.NewLogger(cfg.LogLevel, cfg.LogFormat)
	
	// Initialize databases
	var err error
	s.db, err = common.NewDatabase(cfg.Database)
	s.Require().NoError(err)
	
	s.redis, err = common.NewRedisClient(cfg.Redis)
	s.Require().NoError(err)
	
	s.neo4j, err = common.NewNeo4jClient(cfg.Neo4j)
	s.Require().NoError(err)
	
	// Run database migrations
	err = s.runMigrations()
	s.Require().NoError(err)
	
	// Initialize services
	intentService := services.NewIntentService(s.logger, s.redis)
	mockAzureClient := &MockAzureClient{}
	mockBedrockClient := &MockBedrockClient{}
	
	orchestratorService := services.NewOrchestratorService(
		s.logger,
		mockAzureClient,
		mockBedrockClient,
		s.redis,
	)
	
	qlafsService := services.NewQlafsService(s.logger, s.db, s.neo4j, s.redis)
	metricsService := services.NewMetricsService(s.logger, s.db, s.redis)
	
	// Initialize WebSocket hub
	wsHub := services.NewWebSocketHub(s.logger)
	
	// Initialize handlers
	healthHandler := handlers.NewHealthHandler(s.logger)
	nlpHandler := handlers.NewNLPHandler(s.logger, intentService, orchestratorService, qlafsService, wsHub)
	agentHandler := handlers.NewAgentHandler(s.logger, qlafsService)
	metricsHandler := handlers.NewMetricsHandler(s.logger, metricsService)
	
	// Set up router
	s.router = gin.New()
	s.router.Use(middleware.Logger(s.logger))
	s.router.Use(middleware.Recovery(s.logger))
	s.router.Use(middleware.CORS())
	s.router.Use(middleware.RequestID())
	
	// Health endpoints
	s.router.GET("/health", healthHandler.Health)
	s.router.GET("/ready", healthHandler.Ready)
	
	// API routes with auth
	api := s.router.Group("/api/v1")
	api.Use(middleware.Auth(s.logger, s.redis))
	
	// NLP endpoints
	api.POST("/process", nlpHandler.Process)
	api.POST("/process-stream", nlpHandler.ProcessStream)
	
	// Agent endpoints
	agents := api.Group("/agents")
	{
		agents.GET("", agentHandler.ListAgents)
		agents.POST("", agentHandler.CreateAgent)
		agents.GET("/:id", agentHandler.GetAgent)
		agents.PUT("/:id", agentHandler.UpdateAgent)
		agents.DELETE("/:id", agentHandler.DeleteAgent)
		agents.GET("/:id/verify", agentHandler.VerifyAgent)
	}
	
	// Metrics endpoints
	metrics := api.Group("/metrics")
	{
		metrics.GET("/dashboard", metricsHandler.GetDashboardMetrics)
		metrics.GET("/models", metricsHandler.GetModelMetrics)
	}
	
	// Create test server
	s.server = httptest.NewServer(s.router)
	
	// Get auth token for tests
	s.authToken, err = s.getTestAuthToken()
	s.Require().NoError(err)
}

func (s *APITestSuite) TearDownSuite() {
	if s.server != nil {
		s.server.Close()
	}
	
	if s.db != nil {
		s.cleanupDatabase()
		s.db.Close()
	}
	
	if s.redis != nil {
		s.redis.Close()
	}
	
	if s.neo4j != nil {
		s.neo4j.Close()
	}
}

func (s *APITestSuite) SetupTest() {
	// Clean up data before each test
	s.cleanupTestData()
}

func (s *APITestSuite) TestHealthEndpoints() {
	// Test health endpoint
	resp, err := http.Get(s.server.URL + "/health")
	s.NoError(err)
	s.Equal(http.StatusOK, resp.StatusCode)
	
	// Test ready endpoint
	resp, err = http.Get(s.server.URL + "/ready")
	s.NoError(err)
	s.Equal(http.StatusOK, resp.StatusCode)
}

func (s *APITestSuite) TestNLPProcessing() {
	// Test NLP processing endpoint
	payload := map[string]interface{}{
		"text": "Create a new agent for sentiment analysis",
		"user_id": "test-user-123",
		"session_id": "test-session-456",
	}
	
	resp, body := s.makeAuthenticatedRequest("POST", "/api/v1/process", payload)
	s.Equal(http.StatusOK, resp.StatusCode)
	
	var result map[string]interface{}
	err := json.Unmarshal(body, &result)
	s.NoError(err)
	
	// Verify response structure
	s.Contains(result, "intent")
	s.Contains(result, "confidence")
	s.Contains(result, "response")
	s.Contains(result, "task_id")
	
	// Verify intent classification
	intent, ok := result["intent"].(string)
	s.True(ok)
	s.NotEmpty(intent)
	
	// Verify confidence score
	confidence, ok := result["confidence"].(float64)
	s.True(ok)
	s.GreaterOrEqual(confidence, 0.0)
	s.LessOrEqual(confidence, 1.0)
}

func (s *APITestSuite) TestAgentManagement() {
	// Test creating an agent
	agentData := map[string]interface{}{
		"name": "Test Agent",
		"description": "A test agent for integration testing",
		"type": "nlp",
		"capabilities": []string{"sentiment_analysis", "text_classification"},
		"configuration": map[string]interface{}{
			"model": "azure-gpt-4",
			"temperature": 0.7,
		},
	}
	
	resp, body := s.makeAuthenticatedRequest("POST", "/api/v1/agents", agentData)
	s.Equal(http.StatusCreated, resp.StatusCode)
	
	var createdAgent map[string]interface{}
	err := json.Unmarshal(body, &createdAgent)
	s.NoError(err)
	
	agentID, ok := createdAgent["id"].(string)
	s.True(ok)
	s.NotEmpty(agentID)
	
	// Test getting the agent
	resp, body = s.makeAuthenticatedRequest("GET", fmt.Sprintf("/api/v1/agents/%s", agentID), nil)
	s.Equal(http.StatusOK, resp.StatusCode)
	
	var retrievedAgent map[string]interface{}
	err = json.Unmarshal(body, &retrievedAgent)
	s.NoError(err)
	
	s.Equal(agentData["name"], retrievedAgent["name"])
	s.Equal(agentData["description"], retrievedAgent["description"])
	
	// Test updating the agent
	updateData := map[string]interface{}{
		"description": "Updated test agent description",
	}
	
	resp, _ = s.makeAuthenticatedRequest("PUT", fmt.Sprintf("/api/v1/agents/%s", agentID), updateData)
	s.Equal(http.StatusOK, resp.StatusCode)
	
	// Test agent verification
	resp, body = s.makeAuthenticatedRequest("GET", fmt.Sprintf("/api/v1/agents/%s/verify", agentID), nil)
	s.Equal(http.StatusOK, resp.StatusCode)
	
	var verificationResult map[string]interface{}
	err = json.Unmarshal(body, &verificationResult)
	s.NoError(err)
	
	s.Contains(verificationResult, "verified")
	s.Contains(verificationResult, "trust_score")
	s.Contains(verificationResult, "fingerprint")
	
	// Test listing agents
	resp, body = s.makeAuthenticatedRequest("GET", "/api/v1/agents", nil)
	s.Equal(http.StatusOK, resp.StatusCode)
	
	var agentsList map[string]interface{}
	err = json.Unmarshal(body, &agentsList)
	s.NoError(err)
	
	agents, ok := agentsList["agents"].([]interface{})
	s.True(ok)
	s.GreaterOrEqual(len(agents), 1)
	
	// Test deleting the agent
	resp, _ = s.makeAuthenticatedRequest("DELETE", fmt.Sprintf("/api/v1/agents/%s", agentID), nil)
	s.Equal(http.StatusNoContent, resp.StatusCode)
}

func (s *APITestSuite) TestMetricsEndpoints() {
	// Test dashboard metrics
	resp, body := s.makeAuthenticatedRequest("GET", "/api/v1/metrics/dashboard", nil)
	s.Equal(http.StatusOK, resp.StatusCode)
	
	var metrics map[string]interface{}
	err := json.Unmarshal(body, &metrics)
	s.NoError(err)
	
	// Verify metrics structure
	s.Contains(metrics, "system_health")
	s.Contains(metrics, "agent_metrics")
	s.Contains(metrics, "nlp_metrics")
	s.Contains(metrics, "qlafs_metrics")
	
	// Test model metrics
	resp, body = s.makeAuthenticatedRequest("GET", "/api/v1/metrics/models", nil)
	s.Equal(http.StatusOK, resp.StatusCode)
	
	var modelMetrics map[string]interface{}
	err = json.Unmarshal(body, &modelMetrics)
	s.NoError(err)
	
	s.Contains(modelMetrics, "models")
}

func (s *APITestSuite) TestConcurrentRequests() {
	// Test multiple concurrent requests
	numRequests := 10
	results := make(chan error, numRequests)
	
	payload := map[string]interface{}{
		"text": "Test concurrent processing",
		"user_id": "test-user-concurrent",
	}
	
	for i := 0; i < numRequests; i++ {
		go func() {
			resp, _ := s.makeAuthenticatedRequest("POST", "/api/v1/process", payload)
			if resp.StatusCode != http.StatusOK {
				results <- fmt.Errorf("request failed with status %d", resp.StatusCode)
			} else {
				results <- nil
			}
		}()
	}
	
	// Wait for all requests to complete
	for i := 0; i < numRequests; i++ {
		select {
		case err := <-results:
			s.NoError(err)
		case <-time.After(30 * time.Second):
			s.Fail("Request timed out")
		}
	}
}

func (s *APITestSuite) TestErrorHandling() {
	// Test invalid JSON
	resp, err := s.makeRawRequest("POST", "/api/v1/process", "invalid json")
	s.NoError(err)
	s.Equal(http.StatusBadRequest, resp.StatusCode)
	
	// Test missing authentication
	req, err := http.NewRequest("POST", s.server.URL+"/api/v1/process", bytes.NewBufferString("{}"))
	s.NoError(err)
	req.Header.Set("Content-Type", "application/json")
	
	client := &http.Client{}
	resp, err = client.Do(req)
	s.NoError(err)
	s.Equal(http.StatusUnauthorized, resp.StatusCode)
	
	// Test non-existent agent
	resp, _ = s.makeAuthenticatedRequest("GET", "/api/v1/agents/non-existent-id", nil)
	s.Equal(http.StatusNotFound, resp.StatusCode)
}

// Helper methods

func (s *APITestSuite) makeAuthenticatedRequest(method, path string, payload interface{}) (*http.Response, []byte) {
	var body []byte
	var err error
	
	if payload != nil {
		body, err = json.Marshal(payload)
		s.Require().NoError(err)
	}
	
	req, err := http.NewRequest(method, s.server.URL+path, bytes.NewBuffer(body))
	s.Require().NoError(err)
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.authToken)
	
	client := &http.Client{}
	resp, err := client.Do(req)
	s.Require().NoError(err)
	
	responseBody, err := io.ReadAll(resp.Body)
	s.Require().NoError(err)
	resp.Body.Close()
	
	return resp, responseBody
}

func (s *APITestSuite) makeRawRequest(method, path, body string) (*http.Response, error) {
	req, err := http.NewRequest(method, s.server.URL+path, strings.NewReader(body))
	if err != nil {
		return nil, err
	}
	
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+s.authToken)
	
	client := &http.Client{}
	return client.Do(req)
}

func (s *APITestSuite) getTestAuthToken() (string, error) {
	// Create a test user and get auth token
	// This would typically involve creating a user in the database
	// and generating a valid JWT token
	return "test-jwt-token-12345", nil
}

func (s *APITestSuite) runMigrations() error {
	// Run database migrations
	// This would execute SQL scripts to create tables
	return nil
}

func (s *APITestSuite) cleanupDatabase() {
	// Clean up test database
	tables := []string{
		"agents",
		"tasks",
		"metrics",
		"qlafs_fingerprints",
		"qlafs_trust_scores",
	}
	
	for _, table := range tables {
		_, err := s.db.Exec(fmt.Sprintf("TRUNCATE TABLE %s CASCADE", table))
		if err != nil {
			s.logger.Warn("Failed to truncate table", "table", table, "error", err)
		}
	}
}

func (s *APITestSuite) cleanupTestData() {
	// Clean up test data before each test
	s.redis.FlushDB(context.Background())
}

// Mock implementations for testing

type MockAzureClient struct{}

func (m *MockAzureClient) GetCompletion(ctx context.Context, req interface{}) (interface{}, error) {
	return map[string]interface{}{
		"choices": []map[string]interface{}{
			{
				"message": map[string]interface{}{
					"content": "Mock response from Azure OpenAI",
				},
			},
		},
		"usage": map[string]interface{}{
			"total_tokens": 50,
		},
	}, nil
}

type MockBedrockClient struct{}

func (m *MockBedrockClient) InvokeModel(ctx context.Context, req interface{}) (interface{}, error) {
	return map[string]interface{}{
		"completion": "Mock response from AWS Bedrock",
		"input_tokens": 25,
		"output_tokens": 25,
	}, nil
}