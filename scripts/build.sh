#!/bin/bash

# Quantum NLP Platform Build Script
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[BUILD]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Build configuration
BUILD_TIME=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
GIT_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
VERSION=${VERSION:-"dev"}
REGISTRY=${REGISTRY:-"quantumnlp"}

# Go services to build
GO_SERVICES=(
    "nlp-gateway"
    "qlafs-fingerprint"
    "qlafs-transparency" 
    "qlafs-consensus"
    "agent-orchestrator"
    "metrics-collector"
    "notification-service"
)

# Frontend applications to build
FRONTEND_APPS=(
    "web-portal"
    "admin-dashboard"
    "developer-portal"
)

# Build Go service
build_go_service() {
    local service=$1
    local service_dir="backend/services/$service"
    
    if [ ! -d "$service_dir" ]; then
        print_warning "Service directory $service_dir not found, skipping..."
        return
    fi
    
    print_status "Building Go service: $service"
    
    # Create output directory
    mkdir -p "bin/$service"
    
    # Build with ldflags for version info
    go build -ldflags "
        -X main.version=$VERSION
        -X main.commit=$GIT_COMMIT
        -X main.buildTime=$BUILD_TIME
        -s -w
    " -o "bin/$service/$service" "./$service_dir/cmd/"
    
    print_status "✓ Built $service successfully"
}

# Build all Go services
build_go_services() {
    print_status "Building Go services..."
    
    # Ensure go.mod is up to date
    go mod tidy
    
    for service in "${GO_SERVICES[@]}"; do
        build_go_service "$service"
    done
}

# Build frontend application
build_frontend_app() {
    local app=$1
    local app_dir="frontend/$app"
    
    if [ ! -d "$app_dir" ]; then
        print_warning "Frontend app directory $app_dir not found, skipping..."
        return
    fi
    
    print_status "Building frontend app: $app"
    
    cd "$app_dir"
    
    # Install dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        print_status "Installing dependencies for $app..."
        npm install
    fi
    
    # Build the application
    npm run build
    
    cd "../.."
    
    print_status "✓ Built $app successfully"
}

# Build all frontend applications
build_frontend_apps() {
    print_status "Building frontend applications..."
    
    for app in "${FRONTEND_APPS[@]}"; do
        build_frontend_app "$app"
    done
}

# Build Docker image for a service
build_docker_image() {
    local service=$1
    local tag="$REGISTRY/quantum-nlp-$service:$VERSION"
    local latest_tag="$REGISTRY/quantum-nlp-$service:latest"
    
    print_status "Building Docker image: $tag"
    
    docker build \
        --build-arg SERVICE_NAME="$service" \
        --build-arg VERSION="$VERSION" \
        --build-arg BUILD_TIME="$BUILD_TIME" \
        --build-arg GIT_COMMIT="$GIT_COMMIT" \
        -t "$tag" \
        -t "$latest_tag" \
        .
    
    print_status "✓ Built Docker image $tag"
}

# Build all Docker images
build_docker_images() {
    print_status "Building Docker images..."
    
    for service in "${GO_SERVICES[@]}"; do
        build_docker_image "$service"
    done
    
    # Build frontend images
    for app in "${FRONTEND_APPS[@]}"; do
        local tag="$REGISTRY/quantum-nlp-$app:$VERSION"
        local latest_tag="$REGISTRY/quantum-nlp-$app:latest"
        
        print_status "Building Docker image for frontend: $app"
        
        docker build \
            -f "frontend/$app/Dockerfile" \
            --build-arg VERSION="$VERSION" \
            --build-arg BUILD_TIME="$BUILD_TIME" \
            -t "$tag" \
            -t "$latest_tag" \
            "frontend/$app"
        
        print_status "✓ Built Docker image $tag"
    done
}

# Clean build artifacts
clean() {
    print_status "Cleaning build artifacts..."
    
    # Clean Go binaries
    rm -rf bin/
    
    # Clean frontend build artifacts
    for app in "${FRONTEND_APPS[@]}"; do
        if [ -d "frontend/$app/dist" ]; then
            rm -rf "frontend/$app/dist"
        fi
        if [ -d "frontend/$app/.next" ]; then
            rm -rf "frontend/$app/.next"
        fi
        if [ -d "frontend/$app/out" ]; then
            rm -rf "frontend/$app/out"
        fi
    done
    
    print_status "✓ Cleaned build artifacts"
}

# Run linting
lint() {
    print_status "Running linters..."
    
    # Go linting
    if command -v golangci-lint >/dev/null 2>&1; then
        print_status "Running Go linters..."
        golangci-lint run ./...
    else
        print_warning "golangci-lint not found, running basic go vet..."
        go vet ./...
    fi
    
    # Frontend linting
    for app in "${FRONTEND_APPS[@]}"; do
        if [ -d "frontend/$app" ]; then
            print_status "Running linter for $app..."
            cd "frontend/$app"
            
            if [ -f "package.json" ] && grep -q '"lint"' package.json; then
                npm run lint
            fi
            
            cd "../.."
        fi
    done
    
    print_status "✓ Linting completed"
}

# Run tests
test() {
    print_status "Running tests..."
    
    # Go tests
    print_status "Running Go tests..."
    go test -v -race -coverprofile=coverage.out ./...
    
    # Frontend tests
    for app in "${FRONTEND_APPS[@]}"; do
        if [ -d "frontend/$app" ]; then
            print_status "Running tests for $app..."
            cd "frontend/$app"
            
            if [ -f "package.json" ] && grep -q '"test"' package.json; then
                npm test
            fi
            
            cd "../.."
        fi
    done
    
    print_status "✓ All tests passed"
}

# Generate build info
generate_build_info() {
    print_status "Generating build information..."
    
    cat > build-info.json << EOF
{
    "version": "$VERSION",
    "commit": "$GIT_COMMIT",
    "buildTime": "$BUILD_TIME",
    "goVersion": "$(go version | cut -d' ' -f3)",
    "platform": "$(uname -s)/$(uname -m)",
    "services": [$(printf '"%s",' "${GO_SERVICES[@]}" | sed 's/,$//')]],
    "frontendApps": [$(printf '"%s",' "${FRONTEND_APPS[@]}" | sed 's/,$//')]
}
EOF
    
    print_status "✓ Generated build-info.json"
}

# Main function
main() {
    print_info "Quantum NLP Platform Build System"
    print_info "Version: $VERSION"
    print_info "Commit: $GIT_COMMIT"
    print_info "Build Time: $BUILD_TIME"
    echo
    
    case "${1:-all}" in
        "go"|"backend")
            build_go_services
            ;;
        "frontend")
            build_frontend_apps
            ;;
        "docker")
            build_docker_images
            ;;
        "clean")
            clean
            ;;
        "lint")
            lint
            ;;
        "test")
            test
            ;;
        "info")
            generate_build_info
            ;;
        "all")
            clean
            lint
            build_go_services
            build_frontend_apps
            test
            generate_build_info
            ;;
        *)
            print_error "Usage: $0 [go|frontend|docker|clean|lint|test|info|all]"
            echo "  go       - Build Go services only"
            echo "  frontend - Build frontend applications only"
            echo "  docker   - Build Docker images"
            echo "  clean    - Clean build artifacts"
            echo "  lint     - Run linters"
            echo "  test     - Run tests"
            echo "  info     - Generate build information"
            echo "  all      - Full build pipeline (default)"
            exit 1
            ;;
    esac
    
    print_status "Build completed successfully! 🚀"
}

# Trap errors and cleanup
trap 'print_error "Build failed!"; exit 1' ERR

# Run main function
main "$@"