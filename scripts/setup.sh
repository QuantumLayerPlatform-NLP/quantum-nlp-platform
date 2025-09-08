#!/bin/bash

# Quantum NLP Platform Setup Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    local missing_tools=()
    
    if ! command_exists "go"; then
        missing_tools+=("Go 1.21+")
    else
        go_version=$(go version | grep -o 'go[0-9]\+\.[0-9]\+' | sed 's/go//')
        if [[ "$(printf '%s\n' "1.21" "$go_version" | sort -V | head -n1)" != "1.21" ]]; then
            missing_tools+=("Go 1.21+ (current: $go_version)")
        fi
    fi
    
    if ! command_exists "node"; then
        missing_tools+=("Node.js 18+")
    else
        node_version=$(node --version | sed 's/v//')
        if [[ "$(printf '%s\n' "18.0.0" "$node_version" | sort -V | head -n1)" != "18.0.0" ]]; then
            missing_tools+=("Node.js 18+ (current: $node_version)")
        fi
    fi
    
    if ! command_exists "docker"; then
        missing_tools+=("Docker")
    fi
    
    if ! command_exists "docker-compose"; then
        missing_tools+=("Docker Compose")
    fi
    
    if [ ${#missing_tools[@]} -ne 0 ]; then
        print_error "Missing required tools:"
        for tool in "${missing_tools[@]}"; do
            echo "  - $tool"
        done
        exit 1
    fi
    
    print_status "All prerequisites met!"
}

# Setup environment
setup_environment() {
    print_status "Setting up environment..."
    
    if [ ! -f ".env" ]; then
        print_status "Creating .env file from template..."
        cp .env.example .env
        print_warning "Please edit .env file with your actual configuration values"
    else
        print_status ".env file already exists"
    fi
}

# Install Go dependencies
install_go_deps() {
    print_status "Installing Go dependencies..."
    go mod download
    go mod tidy
}

# Install Node.js dependencies
install_node_deps() {
    print_status "Installing Node.js dependencies..."
    
    # Web Portal
    if [ -d "frontend/web-portal" ]; then
        print_status "Installing web portal dependencies..."
        cd frontend/web-portal
        npm install
        cd ../..
    fi
    
    # Admin Dashboard
    if [ -d "frontend/admin-dashboard" ]; then
        print_status "Installing admin dashboard dependencies..."
        cd frontend/admin-dashboard
        npm install
        cd ../..
    fi
    
    # Developer Portal
    if [ -d "frontend/developer-portal" ]; then
        print_status "Installing developer portal dependencies..."
        cd frontend/developer-portal
        npm install
        cd ../..
    fi
}

# Setup databases
setup_databases() {
    print_status "Setting up databases with Docker Compose..."
    
    # Start only database services
    docker-compose up -d postgres redis neo4j
    
    print_status "Waiting for databases to be ready..."
    sleep 10
    
    # Check database connections
    print_status "Checking database connections..."
    
    # Wait for PostgreSQL
    until docker-compose exec postgres pg_isready -U quantum_user -d quantum_nlp; do
        print_status "Waiting for PostgreSQL..."
        sleep 2
    done
    
    # Wait for Redis
    until docker-compose exec redis redis-cli ping | grep -q "PONG"; do
        print_status "Waiting for Redis..."
        sleep 2
    done
    
    # Wait for Neo4j
    until docker-compose exec neo4j cypher-shell -u neo4j -p password "RETURN 1" >/dev/null 2>&1; do
        print_status "Waiting for Neo4j..."
        sleep 2
    done
    
    print_status "All databases are ready!"
}

# Run database migrations
run_migrations() {
    print_status "Running database migrations..."
    
    # PostgreSQL migrations
    if [ -d "migrations/postgres" ]; then
        print_status "Running PostgreSQL migrations..."
        # Add migration command here
    fi
    
    # Neo4j constraints and indexes
    if [ -d "migrations/neo4j" ]; then
        print_status "Setting up Neo4j constraints and indexes..."
        # Add Neo4j setup commands here
    fi
}

# Build applications
build_apps() {
    print_status "Building applications..."
    
    # Build Go services
    print_status "Building Go services..."
    make build-all
    
    # Build frontend applications
    print_status "Building frontend applications..."
    make build-frontend
}

# Run tests
run_tests() {
    print_status "Running tests..."
    
    # Go tests
    print_status "Running Go tests..."
    make test
    
    # Frontend tests
    print_status "Running frontend tests..."
    make test-frontend
}

# Start development environment
start_dev() {
    print_status "Starting development environment..."
    docker-compose up -d
    
    print_status "Development environment started!"
    print_status "Services available at:"
    echo "  - Web Portal: http://localhost:3000"
    echo "  - Admin Dashboard: http://localhost:3001"
    echo "  - Developer Portal: http://localhost:3002"
    echo "  - API Gateway: http://localhost:8080"
    echo "  - Grafana: http://localhost:3030"
    echo "  - Prometheus: http://localhost:9090"
}

# Main setup function
main() {
    print_status "Starting Quantum NLP Platform setup..."
    
    case "${1:-full}" in
        "check")
            check_prerequisites
            ;;
        "env")
            setup_environment
            ;;
        "deps")
            check_prerequisites
            install_go_deps
            install_node_deps
            ;;
        "db")
            setup_databases
            run_migrations
            ;;
        "build")
            build_apps
            ;;
        "test")
            run_tests
            ;;
        "dev")
            start_dev
            ;;
        "full")
            check_prerequisites
            setup_environment
            install_go_deps
            install_node_deps
            setup_databases
            run_migrations
            build_apps
            run_tests
            start_dev
            ;;
        *)
            print_error "Usage: $0 [check|env|deps|db|build|test|dev|full]"
            echo "  check  - Check prerequisites"
            echo "  env    - Setup environment files"
            echo "  deps   - Install dependencies"
            echo "  db     - Setup databases"
            echo "  build  - Build applications"
            echo "  test   - Run tests"
            echo "  dev    - Start development environment"
            echo "  full   - Run complete setup (default)"
            exit 1
            ;;
    esac
    
    print_status "Setup completed successfully!"
}

# Run main function with arguments
main "$@"