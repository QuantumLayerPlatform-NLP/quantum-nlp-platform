#!/bin/bash

# Setup GitHub Repository and Container Registry Integration
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[SETUP]${NC} $1"
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

print_step() {
    echo -e "${PURPLE}[STEP]${NC} $1"
}

# Configuration
GITHUB_ORG="QuantumLayerPlatform-NLP"
REPO_NAME="quantum-nlp-platform"
GITHUB_URL="https://github.com/${GITHUB_ORG}/${REPO_NAME}"
REGISTRY="ghcr.io"
IMAGE_PREFIX="${REGISTRY}/${GITHUB_ORG,,}/quantum-nlp"

print_header() {
    echo -e "${BLUE}"
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║              GitHub Repository Setup for Quantum NLP Platform               ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    print_step "Checking prerequisites..."
    
    # Check if we're in a git repository
    if [ ! -d ".git" ]; then
        print_info "Initializing Git repository..."
        git init
    fi
    
    # Check if GitHub CLI is available
    if command -v gh &> /dev/null; then
        print_info "GitHub CLI available - enhanced setup options"
    else
        print_warning "GitHub CLI not found - manual setup required"
    fi
    
    print_status "Prerequisites checked"
}

# Function to update Kubernetes manifests for GitHub Container Registry
update_k8s_manifests() {
    print_step "Updating Kubernetes manifests for GitHub Container Registry..."
    
    local services=(
        "nlp-gateway"
        "qlafs-fingerprint" 
        "qlafs-consensus"
        "qlafs-transparency"
        "agent-orchestrator"
        "metrics-collector"
        "notification-service"
    )
    
    # Update main gateway manifest
    if [ -f "k8s/nlp-gateway.yaml" ]; then
        print_info "Updating nlp-gateway.yaml..."
        sed -i.bak "s|quantumnlp/quantum-nlp-nlp-gateway:latest|${IMAGE_PREFIX}-nlp-gateway:latest|g" k8s/nlp-gateway.yaml
    fi
    
    # Update other service manifests
    for service in "${services[@]}"; do
        if [ -f "k8s/${service}.yaml" ]; then
            print_info "Updating ${service}.yaml..."
            sed -i.bak "s|quantumnlp/quantum-nlp-${service}:latest|${IMAGE_PREFIX}-${service}:latest|g" k8s/${service}.yaml
        fi
    done
    
    # Update frontend manifests if they exist
    local frontend_apps=("web-portal" "admin-dashboard" "developer-portal")
    for app in "${frontend_apps[@]}"; do
        if [ -f "k8s/${app}.yaml" ]; then
            print_info "Updating ${app}.yaml..."
            sed -i.bak "s|quantumnlp/quantum-nlp-${app}:latest|${IMAGE_PREFIX}-${app}:latest|g" k8s/${app}.yaml
        fi
    done
    
    print_status "Kubernetes manifests updated for GitHub Container Registry"
}

# Function to create image pull secret for private registry
create_image_pull_secret() {
    print_step "Creating template for image pull secret..."
    
    cat > k8s/image-pull-secret.yaml << EOF
apiVersion: v1
kind: Secret
metadata:
  name: ghcr-secret
  namespace: quantum-nlp
type: kubernetes.io/dockerconfigjson
data:
  .dockerconfigjson: |
    # Base64 encoded Docker config JSON
    # Generate this with: 
    # echo -n '{"auths":{"ghcr.io":{"username":"YOUR_GITHUB_USERNAME","password":"YOUR_GITHUB_TOKEN","auth":"BASE64_USERNAME:TOKEN"}}}' | base64 -w 0
    
---
# To generate the secret, run:
# kubectl create secret docker-registry ghcr-secret \\
#   --docker-server=ghcr.io \\
#   --docker-username=YOUR_GITHUB_USERNAME \\
#   --docker-password=YOUR_GITHUB_TOKEN \\
#   --namespace=quantum-nlp
EOF
    
    print_info "Created image pull secret template at k8s/image-pull-secret.yaml"
    print_warning "You'll need to update this with your actual GitHub credentials"
}

# Function to create Docker configuration files
create_docker_configs() {
    print_step "Creating Docker configuration files..."
    
    # Create .dockerignore
    cat > .dockerignore << 'EOF'
.git
.gitignore
README.md
.env
.env.local
.env.production
.env.test
Dockerfile*
docker-compose*
.dockerignore
node_modules
npm-debug.log
.next
.nuxt
dist
coverage
.nyc_output
*.log
docs/
scripts/
k8s/
terraform/
.github/
tests/load/
*.md
EOF
    
    # Create multi-stage Dockerfile for development
    cat > Dockerfile.dev << 'EOF'
# Development Dockerfile with hot reload
FROM golang:1.21-alpine AS dev

RUN apk add --no-cache git ca-certificates

WORKDIR /app

# Install air for hot reload
RUN go install github.com/cosmtrek/air@latest

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Expose port
EXPOSE 8080

# Run with air for hot reload
CMD ["air", "-c", ".air.toml"]
EOF
    
    print_status "Docker configuration files created"
}

# Function to update deployment script for GitHub images
update_deployment_script() {
    print_step "Updating deployment script for GitHub Container Registry..."
    
    # Create updated deployment script that uses GitHub images
    cat > scripts/deploy-from-github.sh << EOF
#!/bin/bash

# Deploy Quantum NLP Platform using GitHub Container Registry images
set -e

GITHUB_ORG="QuantumLayerPlatform-NLP"
REGISTRY="ghcr.io"
IMAGE_PREFIX="\${REGISTRY}/\${GITHUB_ORG,,}/quantum-nlp"
TAG="\${1:-latest}"

echo "Deploying Quantum NLP Platform from GitHub Container Registry"
echo "Registry: \${REGISTRY}"
echo "Image Prefix: \${IMAGE_PREFIX}"
echo "Tag: \${TAG}"

# Update image tags in manifests
echo "Updating image tags..."
find k8s/ -name "*.yaml" -exec sed -i.bak "s|:latest|:\${TAG}|g" {} \;

# Apply manifests
echo "Applying Kubernetes manifests..."
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/image-pull-secret.yaml  # Make sure this exists with your credentials
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/database.yaml
kubectl apply -f k8s/nlp-gateway.yaml

# Wait for deployment
echo "Waiting for deployments to be ready..."
kubectl wait --for=condition=available deployment/nlp-gateway -n quantum-nlp --timeout=300s

echo "Deployment completed!"
echo "Access the application with: kubectl port-forward svc/nlp-gateway 8080:8080 -n quantum-nlp"

# Restore original manifests
find k8s/ -name "*.bak" -exec bash -c 'mv "\$1" "\${1%.bak}"' _ {} \;
EOF
    
    chmod +x scripts/deploy-from-github.sh
    
    print_status "Created GitHub deployment script"
}

# Function to setup Git repository
setup_git_repo() {
    print_step "Setting up Git repository..."
    
    # Set up Git configuration if not already done
    if [ -z "$(git config --global user.name)" ]; then
        print_warning "Git user.name not configured. Please run:"
        echo "git config --global user.name 'Your Name'"
    fi
    
    if [ -z "$(git config --global user.email)" ]; then
        print_warning "Git user.email not configured. Please run:"
        echo "git config --global user.email 'your.email@example.com'"
    fi
    
    # Add remote if it doesn't exist
    if ! git remote get-url origin &> /dev/null; then
        print_info "Adding GitHub remote..."
        git remote add origin "${GITHUB_URL}.git"
    fi
    
    # Initial commit
    git add .
    
    if git diff --cached --quiet; then
        print_info "No changes to commit"
    else
        print_info "Creating initial commit..."
        git commit -m "Initial commit: Quantum NLP Platform with QLAFS

- Complete microservices architecture with Go backend
- Multi-frontend applications (React, Next.js)
- QLAFS cryptographic agent verification system
- Kubernetes deployment manifests
- GitHub Actions CI/CD pipeline
- Comprehensive documentation and testing

Features:
- Multi-dimensional agent fingerprinting
- Byzantine fault-tolerant consensus
- Blockchain-anchored transparency logs
- Real-time metrics and monitoring
- Enterprise-grade security and scalability"
    fi
    
    print_status "Git repository configured"
}

# Function to show next steps
show_next_steps() {
    print_step "Next Steps:"
    echo
    print_info "1. Create GitHub repository:"
    echo "   - Go to https://github.com/${GITHUB_ORG}/quantum-nlp-platform"
    echo "   - Create new repository (if not exists)"
    echo "   - Or use GitHub CLI: gh repo create ${GITHUB_ORG}/quantum-nlp-platform --public"
    
    echo
    print_info "2. Push code to GitHub:"
    echo "   git branch -M main"
    echo "   git push -u origin main"
    
    echo
    print_info "3. Set up GitHub Container Registry:"
    echo "   - Go to GitHub repository settings"
    echo "   - Enable GitHub Packages"
    echo "   - Create Personal Access Token with packages:write permissions"
    
    echo
    print_info "4. Update image pull secret:"
    echo "   - Edit k8s/image-pull-secret.yaml"
    echo "   - Add your GitHub credentials"
    echo "   - Or run: kubectl create secret docker-registry ghcr-secret \\"
    echo "     --docker-server=ghcr.io \\"
    echo "     --docker-username=YOUR_GITHUB_USERNAME \\"
    echo "     --docker-password=YOUR_GITHUB_TOKEN \\"
    echo "     --namespace=quantum-nlp"
    
    echo
    print_info "5. Trigger first build:"
    echo "   - Push to main branch or create a tag"
    echo "   - GitHub Actions will build and publish images"
    echo "   - Use scripts/deploy-from-github.sh to deploy"
    
    echo
    print_info "6. Configure secrets for CI/CD (if using AWS/Azure):"
    echo "   - AWS_ACCESS_KEY_ID"
    echo "   - AWS_SECRET_ACCESS_KEY"
    echo "   - Or Azure credentials for AKS deployment"
}

# Main execution
main() {
    print_header
    
    check_prerequisites
    update_k8s_manifests
    create_image_pull_secret
    create_docker_configs
    update_deployment_script
    setup_git_repo
    show_next_steps
    
    echo
    print_status "🎉 GitHub repository setup completed!"
    print_info "Repository URL: ${GITHUB_URL}"
    print_info "Container Registry: ${IMAGE_PREFIX}"
}

# Run main function
main "$@"
EOF