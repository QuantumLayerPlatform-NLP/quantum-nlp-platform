#!/bin/bash

# Setup GitHub Container Registry Secret for Kubernetes
set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "🔐 Setting up GitHub Container Registry authentication for Kubernetes"
echo

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    print_error "kubectl is required but not installed"
    exit 1
fi

# Check if we can connect to cluster
if ! kubectl cluster-info &> /dev/null; then
    print_error "Cannot connect to Kubernetes cluster"
    exit 1
fi

print_info "For public repositories, you can often pull images without authentication."
print_info "However, for better rate limits and private repos, authentication is recommended."
echo

read -p "Do you have a GitHub Personal Access Token for container registry access? (y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo
    print_info "Please provide your GitHub credentials:"
    read -p "GitHub Username: " GITHUB_USERNAME
    read -s -p "GitHub Personal Access Token (with packages:read permissions): " GITHUB_TOKEN
    echo
    echo
    
    if [ -z "$GITHUB_USERNAME" ] || [ -z "$GITHUB_TOKEN" ]; then
        print_error "Username and token are required"
        exit 1
    fi
    
    print_info "Creating Docker registry secret..."
    
    # Create the secret
    kubectl create secret docker-registry ghcr-secret \
        --docker-server=ghcr.io \
        --docker-username="$GITHUB_USERNAME" \
        --docker-password="$GITHUB_TOKEN" \
        --namespace=quantum-nlp \
        --dry-run=client -o yaml | kubectl apply -f -
    
    if [ $? -eq 0 ]; then
        print_success "✅ GitHub Container Registry secret created successfully!"
        
        print_info "Updating deployment manifests to use the secret..."
        
        # Update the nlp-gateway manifest to use the secret
        if [ -f "k8s/nlp-gateway.yaml" ]; then
            if ! grep -q "imagePullSecrets" k8s/nlp-gateway.yaml; then
                sed -i '/spec:/a\      imagePullSecrets:\n        - name: ghcr-secret' k8s/nlp-gateway.yaml
                print_info "Updated nlp-gateway.yaml to use image pull secret"
            fi
        fi
        
        print_success "🎉 Setup completed! Your cluster can now pull images from GitHub Container Registry."
    else
        print_error "Failed to create secret"
        exit 1
    fi
    
else
    print_warning "Skipping authentication setup."
    print_info "If you encounter image pull errors, run this script again with credentials."
    print_info "You can create a GitHub Personal Access Token at:"
    print_info "https://github.com/settings/tokens/new"
    print_info "Required permissions: packages:read"
    
    # Try to pull without authentication
    print_info "Testing image pull without authentication..."
    kubectl run test-pull --image=ghcr.io/quantumlayerplatform-nlp/quantum-nlp-nlp-gateway:latest \
        --dry-run=client -o yaml --namespace=quantum-nlp > /dev/null 2>&1
    
    if [ $? -eq 0 ]; then
        print_success "✅ Public access should work fine"
    else
        print_warning "⚠️  You may need authentication for reliable access"
    fi
fi

echo
print_info "📚 Next steps:"
print_info "1. Wait for GitHub Actions to finish building images"
print_info "2. Run: ./scripts/deploy-from-github.sh"
print_info "3. Monitor deployment: kubectl get pods -n quantum-nlp -w"

echo
print_info "🔍 Check build status at:"
print_info "https://github.com/QuantumLayerPlatform-NLP/quantum-nlp-platform/actions"