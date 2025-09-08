# Quantum NLP Platform Makefile

.PHONY: help install-deps build test clean deploy docker-build

# Variables
DOCKER_REGISTRY ?= quantumlayer
VERSION ?= $(shell git rev-parse --short HEAD)
ENVIRONMENT ?= development

# Help
help: ## Display this help message
	@echo "Quantum NLP Platform - Available Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'
	@echo ""

# Dependencies
install-deps: ## Install all dependencies
	@echo "Installing dependencies..."
	@cd frontend/web-portal && npm install
	@cd frontend/admin-dashboard && npm install
	@cd frontend/developer-portal && npm install
	@cd frontend/mobile-app && npm install
	@cd frontend/shared-ui && npm install
	@go mod tidy
	@echo "Dependencies installed ✅"

# Development
dev-frontend: ## Start frontend development servers
	@echo "Starting frontend development servers..."
	@cd frontend/web-portal && npm run dev &
	@cd frontend/admin-dashboard && npm run dev &
	@cd frontend/developer-portal && npm run dev &
	@echo "Frontend servers started 🚀"

dev-backend: ## Start backend development servers
	@echo "Starting backend development servers..."
	@docker-compose -f docker-compose.dev.yml up -d
	@echo "Backend services started 🚀"

dev: ## Start full development environment
	@echo "Starting full development environment..."
	@make dev-backend
	@sleep 10
	@make dev-frontend
	@echo "Development environment ready! 🚀"

# Build
build-frontend: ## Build all frontend applications
	@echo "Building frontend applications..."
	@cd frontend/web-portal && npm run build
	@cd frontend/admin-dashboard && npm run build
	@cd frontend/developer-portal && npm run build
	@cd frontend/shared-ui && npm run build
	@echo "Frontend built ✅"

build-backend: ## Build all backend services
	@echo "Building backend services..."
	@cd backend/services/nlp-gateway && go build -o ../../../bin/nlp-gateway ./cmd/main.go
	@cd backend/services/intent-classifier && go build -o ../../../bin/intent-classifier ./cmd/main.go
	@cd backend/services/agent-orchestrator && go build -o ../../../bin/agent-orchestrator ./cmd/main.go
	@cd backend/services/qlafs-fingerprint && go build -o ../../../bin/qlafs-fingerprint ./cmd/main.go
	@cd backend/services/qlafs-transparency && go build -o ../../../bin/qlafs-transparency ./cmd/main.go
	@cd backend/services/qlafs-consensus && go build -o ../../../bin/qlafs-consensus ./cmd/main.go
	@cd backend/services/qlafs-verification && go build -o ../../../bin/qlafs-verification ./cmd/main.go
	@echo "Backend built ✅"

build: build-frontend build-backend ## Build all applications

# Docker
docker-build: ## Build all Docker images
	@echo "Building Docker images..."
	@docker build -t $(DOCKER_REGISTRY)/nlp-gateway:$(VERSION) -f backend/services/nlp-gateway/Dockerfile .
	@docker build -t $(DOCKER_REGISTRY)/intent-classifier:$(VERSION) -f backend/services/intent-classifier/Dockerfile .
	@docker build -t $(DOCKER_REGISTRY)/agent-orchestrator:$(VERSION) -f backend/services/agent-orchestrator/Dockerfile .
	@docker build -t $(DOCKER_REGISTRY)/qlafs-fingerprint:$(VERSION) -f backend/services/qlafs-fingerprint/Dockerfile .
	@docker build -t $(DOCKER_REGISTRY)/web-portal:$(VERSION) -f frontend/web-portal/Dockerfile .
	@docker build -t $(DOCKER_REGISTRY)/admin-dashboard:$(VERSION) -f frontend/admin-dashboard/Dockerfile .
	@echo "Docker images built ✅"

# Testing
test-unit: ## Run unit tests
	@echo "Running unit tests..."
	@cd frontend/web-portal && npm test -- --coverage
	@cd frontend/admin-dashboard && npm test -- --coverage
	@go test -v -race -coverprofile=coverage.out ./backend/...
	@echo "Unit tests completed ✅"

test-integration: ## Run integration tests
	@echo "Running integration tests..."
	@docker-compose -f docker-compose.test.yml up --abort-on-container-exit
	@echo "Integration tests completed ✅"

test: test-unit test-integration ## Run all tests

# Deployment
deploy-dev: ## Deploy to development environment
	@echo "Deploying to development..."
	@kubectl apply -f infrastructure/kubernetes/development/ --context=dev-cluster
	@echo "Development deployment completed ✅"

deploy-staging: ## Deploy to staging environment
	@echo "Deploying to staging..."
	@kubectl apply -f infrastructure/kubernetes/staging/ --context=staging-cluster
	@echo "Staging deployment completed ✅"

deploy-prod: ## Deploy to production environment
	@echo "Deploying to production..."
	@kubectl apply -f infrastructure/kubernetes/production/ --context=prod-cluster
	@echo "Production deployment completed ✅"

# Utilities
clean: ## Clean build artifacts
	@echo "Cleaning build artifacts..."
	@rm -rf bin/
	@rm -rf frontend/*/node_modules
	@rm -rf frontend/*/dist
	@rm -rf frontend/*/build
	@docker system prune -f
	@echo "Clean completed ✅"

health-check: ## Check system health
	@echo "Checking system health..."
	@curl -s http://localhost:8080/health | jq .
	@echo "Health check completed ✅"

# Default target
.DEFAULT_GOAL := help