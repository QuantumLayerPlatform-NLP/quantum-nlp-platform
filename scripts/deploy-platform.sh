#!/bin/bash

# Quantum NLP Platform - Complete Deployment Orchestrator
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

print_header() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════════════════════╗"
    echo "║                     Quantum NLP Platform with QLAFS                         ║"
    echo "║                         Complete Deployment Script                          ║"
    echo "╚══════════════════════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

print_status() {
    echo -e "${GREEN}[DEPLOY]${NC} $1"
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
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CLEANUP_SCRIPT="$SCRIPT_DIR/k8s-cleanup.sh"
DEPLOY_SCRIPT="$SCRIPT_DIR/k8s-deploy.sh"

# Default values
ENVIRONMENT="development"
CLEANUP_FIRST=true
FORCE_MODE=false
DRY_RUN=false
SKIP_BUILD=false
NO_MONITORING=false
NO_INGRESS=false

# Function to show help
show_help() {
    print_header
    echo
    echo "Complete deployment orchestrator for Quantum NLP Platform with QLAFS"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -h, --help              Show this help message"
    echo "  -e, --env ENV           Environment (development|staging|production) [default: development]"
    echo "  --no-cleanup            Skip cleanup phase"
    echo "  --cleanup-only          Only run cleanup, skip deployment"
    echo "  -f, --force             Skip all confirmation prompts"
    echo "  --dry-run              Show what would be done without making changes"
    echo "  --skip-build           Skip Docker image builds"
    echo "  --no-monitoring        Skip monitoring stack deployment"
    echo "  --no-ingress           Skip ingress controller setup"
    echo "  --list-resources       List current Kubernetes resources and exit"
    echo
    echo "Environment-specific configurations:"
    echo "  development    - Single replica, minimal resources, local development"
    echo "  staging        - 2 replicas, moderate resources, staging environment"
    echo "  production     - HA setup, auto-scaling, production resources"
    echo
    echo "Examples:"
    echo "  $0                                    # Full deployment (cleanup + deploy)"
    echo "  $0 --env production --force           # Production deployment without prompts"
    echo "  $0 --dry-run --env staging            # Preview staging deployment"
    echo "  $0 --cleanup-only                     # Only cleanup existing resources"
    echo "  $0 --no-cleanup                       # Skip cleanup, deploy only"
    echo "  $0 --list-resources                   # Show current K8s resources"
    echo
    echo "Pre-deployment checklist:"
    echo "  ✓ Kubernetes cluster is accessible (kubectl cluster-info)"
    echo "  ✓ Docker is available for image builds"
    echo "  ✓ Sufficient cluster resources (8GB+ RAM recommended)"
    echo "  ✓ Storage class configured (fast-ssd preferred)"
    echo "  ✓ Load balancer available for ingress"
    echo
    echo "Post-deployment steps:"
    echo "  1. Update DNS records for ingress endpoints"
    echo "  2. Configure SSL certificates (cert-manager recommended)"
    echo "  3. Update secrets with production credentials"
    echo "  4. Set up database backups"
    echo "  5. Configure monitoring alerts"
}

# Function to check prerequisites
check_prerequisites() {
    print_step "Checking system prerequisites..."
    
    local errors=0
    
    # Check if we're in the right directory
    if [ ! -f "$PROJECT_ROOT/go.mod" ] || [ ! -d "$PROJECT_ROOT/k8s" ]; then
        print_error "Not in the correct project directory. Please run from quantum-nlp-platform root."
        errors=$((errors + 1))
    fi
    
    # Check required scripts
    if [ ! -f "$CLEANUP_SCRIPT" ]; then
        print_error "Cleanup script not found: $CLEANUP_SCRIPT"
        errors=$((errors + 1))
    fi
    
    if [ ! -f "$DEPLOY_SCRIPT" ]; then
        print_error "Deployment script not found: $DEPLOY_SCRIPT"
        errors=$((errors + 1))
    fi
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is required but not installed"
        errors=$((errors + 1))
    else
        # Check cluster connectivity
        if ! kubectl cluster-info &> /dev/null; then
            print_error "Cannot connect to Kubernetes cluster"
            print_info "Please check your kubeconfig configuration"
            errors=$((errors + 1))
        else
            local cluster_info=$(kubectl cluster-info | head -1)
            print_info "Connected to: $cluster_info"
        fi
    fi
    
    # Check Docker (optional for deployment)
    if [ "$SKIP_BUILD" = false ] && ! command -v docker &> /dev/null; then
        print_warning "Docker not found - image builds will be skipped"
        SKIP_BUILD=true
    fi
    
    # Check Helm (optional)
    if command -v helm &> /dev/null; then
        print_info "Helm available - enhanced deployment features enabled"
    fi
    
    if [ $errors -gt 0 ]; then
        print_error "Prerequisites check failed with $errors errors"
        exit 1
    fi
    
    print_status "Prerequisites check passed ✓"
}

# Function to display current cluster status
show_cluster_status() {
    print_step "Current Kubernetes cluster status:"
    echo
    
    print_info "Cluster Information:"
    kubectl cluster-info --request-timeout=10s || print_warning "Could not retrieve cluster info"
    
    echo
    print_info "Node Status:"
    kubectl get nodes -o wide | head -10
    
    echo
    print_info "Quantum NLP Namespaces:"
    kubectl get namespaces | grep -E "(quantum-nlp|NAME)" || echo "No quantum-nlp namespaces found"
    
    echo
    print_info "Resource Usage:"
    kubectl top nodes --no-headers 2>/dev/null | head -5 || print_warning "Metrics server not available"
    
    echo
    print_info "Storage Classes:"
    kubectl get storageclass | head -5
}

# Function to validate environment configuration
validate_environment() {
    print_step "Validating environment configuration..."
    
    case $ENVIRONMENT in
        "development")
            print_info "Development environment selected:"
            print_info "  - Single replica deployments"
            print_info "  - Minimal resource allocation"
            print_info "  - Local storage (hostPath/local)"
            print_info "  - Basic monitoring"
            ;;
        "staging")
            print_info "Staging environment selected:"
            print_info "  - 2 replica deployments"
            print_info "  - Moderate resource allocation"
            print_info "  - Persistent storage required"
            print_info "  - Full monitoring stack"
            ;;
        "production")
            print_info "Production environment selected:"
            print_info "  - High availability (3+ replicas)"
            print_info "  - Auto-scaling enabled"
            print_info "  - Premium storage required"
            print_info "  - Complete monitoring & alerting"
            print_info "  - Security hardening"
            
            if [ "$FORCE_MODE" = false ]; then
                print_warning "Production deployment requires careful planning!"
                echo "Ensure you have:"
                echo "  - Sufficient cluster resources (16GB+ RAM recommended)"
                echo "  - Premium storage class configured"
                echo "  - Load balancer for external access"
                echo "  - Backup strategy planned"
                echo "  - Production credentials ready"
                echo
                read -p "Are you sure you want to proceed with production deployment? (y/N): " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    print_info "Production deployment cancelled"
                    exit 0
                fi
            fi
            ;;
        *)
            print_error "Invalid environment: $ENVIRONMENT"
            print_info "Valid environments: development, staging, production"
            exit 1
            ;;
    esac
}

# Function to estimate resource requirements
show_resource_estimates() {
    print_step "Resource requirements estimate for $ENVIRONMENT:"
    echo
    
    case $ENVIRONMENT in
        "development")
            echo "Minimum cluster resources needed:"
            echo "  CPU:     4 cores"
            echo "  Memory:  8 GB"
            echo "  Storage: 20 GB"
            echo "  Nodes:   2"
            ;;
        "staging")
            echo "Recommended cluster resources:"
            echo "  CPU:     8 cores"
            echo "  Memory:  16 GB"
            echo "  Storage: 100 GB"
            echo "  Nodes:   3"
            ;;
        "production")
            echo "Production cluster resources:"
            echo "  CPU:     16+ cores"
            echo "  Memory:  32+ GB"
            echo "  Storage: 500+ GB"
            echo "  Nodes:   5+"
            echo "  Load Balancer: Required"
            echo "  Backup Storage: Required"
            ;;
    esac
    
    echo
    print_info "Checking current cluster capacity..."
    
    # Check available resources
    local nodes_output=$(kubectl get nodes --no-headers 2>/dev/null)
    local node_count=$(echo "$nodes_output" | wc -l)
    
    if [ "$node_count" -gt 0 ]; then
        print_info "Current cluster: $node_count nodes"
        
        # Try to get resource information
        if command -v jq &> /dev/null; then
            kubectl get nodes -o json 2>/dev/null | jq -r '.items[] | "\(.metadata.name): \(.status.allocatable.cpu) CPU, \(.status.allocatable.memory) memory"' | head -5
        else
            kubectl describe nodes | grep -A 5 "Allocatable:" | head -10 || true
        fi
    else
        print_warning "Could not determine cluster capacity"
    fi
}

# Function to run cleanup
run_cleanup() {
    if [ "$CLEANUP_FIRST" = false ]; then
        return 0
    fi
    
    print_step "Running Kubernetes cleanup..."
    
    local cleanup_args=""
    
    if [ "$FORCE_MODE" = true ]; then
        cleanup_args="$cleanup_args --force"
    fi
    
    if [ "$DRY_RUN" = true ]; then
        cleanup_args="$cleanup_args --dry-run"
    fi
    
    # Make sure cleanup script is executable
    chmod +x "$CLEANUP_SCRIPT"
    
    # Run cleanup script
    "$CLEANUP_SCRIPT" $cleanup_args
    
    if [ $? -eq 0 ]; then
        print_status "Cleanup completed successfully ✓"
    else
        print_error "Cleanup failed!"
        exit 1
    fi
}

# Function to run deployment
run_deployment() {
    print_step "Running Kubernetes deployment..."
    
    local deploy_args="--env $ENVIRONMENT"
    
    if [ "$FORCE_MODE" = true ]; then
        deploy_args="$deploy_args --force"
    fi
    
    if [ "$DRY_RUN" = true ]; then
        deploy_args="$deploy_args --dry-run"
    fi
    
    if [ "$SKIP_BUILD" = true ]; then
        deploy_args="$deploy_args --skip-build"
    fi
    
    if [ "$NO_MONITORING" = true ]; then
        deploy_args="$deploy_args --no-monitoring"
    fi
    
    if [ "$NO_INGRESS" = true ]; then
        deploy_args="$deploy_args --no-ingress"
    fi
    
    # Make sure deployment script is executable
    chmod +x "$DEPLOY_SCRIPT"
    
    # Run deployment script
    "$DEPLOY_SCRIPT" $deploy_args
    
    if [ $? -eq 0 ]; then
        print_status "Deployment completed successfully ✓"
    else
        print_error "Deployment failed!"
        exit 1
    fi
}

# Function to show post-deployment information
show_post_deployment_info() {
    if [ "$DRY_RUN" = true ]; then
        return 0
    fi
    
    print_step "Post-deployment information:"
    echo
    
    print_info "🎉 Quantum NLP Platform deployment completed!"
    echo
    
    # Show access information
    print_info "🔗 Access URLs (use kubectl port-forward):"
    cat << 'EOF'
# Main Application
kubectl port-forward svc/nlp-gateway 8080:8080 -n quantum-nlp
  → API Gateway: http://localhost:8080

kubectl port-forward svc/web-portal 3000:3000 -n quantum-nlp
  → Web Portal: http://localhost:3000

kubectl port-forward svc/admin-dashboard 3001:3001 -n quantum-nlp
  → Admin Dashboard: http://localhost:3001

# QLAFS Services
kubectl port-forward svc/qlafs-fingerprint 8081:8080 -n quantum-nlp
  → Fingerprint Service: http://localhost:8081

kubectl port-forward svc/qlafs-consensus 8082:8080 -n quantum-nlp
  → Consensus Service: http://localhost:8082

kubectl port-forward svc/qlafs-transparency 8083:8080 -n quantum-nlp
  → Transparency Service: http://localhost:8083

# Monitoring (if enabled)
kubectl port-forward svc/prometheus 9090:9090 -n quantum-nlp-monitoring
  → Prometheus: http://localhost:9090

kubectl port-forward svc/grafana 3030:3000 -n quantum-nlp-monitoring
  → Grafana: http://localhost:3030

# Databases
kubectl port-forward svc/postgresql 5432:5432 -n quantum-nlp
  → PostgreSQL: localhost:5432

kubectl port-forward svc/redis 6379:6379 -n quantum-nlp
  → Redis: localhost:6379

kubectl port-forward svc/neo4j 7474:7474 -n quantum-nlp
  → Neo4j Browser: http://localhost:7474
EOF
    
    echo
    print_info "📋 Next Steps:"
    echo "1. Test API endpoints: curl http://localhost:8080/health"
    echo "2. Access web portal and create your first agent"
    echo "3. Configure monitoring dashboards in Grafana"
    echo "4. Set up domain names and SSL certificates"
    echo "5. Update secrets with production credentials"
    echo "6. Configure backup schedules"
    
    if [ "$ENVIRONMENT" = "production" ]; then
        echo
        print_warning "🔒 Production Security Checklist:"
        echo "□ Update all default passwords in secrets.yaml"
        echo "□ Enable network policies"
        echo "□ Configure SSL/TLS certificates"
        echo "□ Set up monitoring alerts"
        echo "□ Configure log aggregation"
        echo "□ Test disaster recovery procedures"
        echo "□ Enable audit logging"
        echo "□ Configure backup automation"
    fi
    
    echo
    print_info "📚 Documentation:"
    echo "  Architecture: docs/architecture.md"
    echo "  API Guide:    docs/api-guide.md"
    echo "  Deployment:   docs/deployment-guide.md"
    
    echo
    print_info "🆘 Troubleshooting:"
    echo "  Check pod status:    kubectl get pods -n quantum-nlp"
    echo "  View logs:           kubectl logs -f deployment/nlp-gateway -n quantum-nlp"
    echo "  Describe resources:  kubectl describe pod <pod-name> -n quantum-nlp"
}

# Parse command line arguments
CLEANUP_ONLY=false
LIST_RESOURCES=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -e|--env)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --no-cleanup)
            CLEANUP_FIRST=false
            shift
            ;;
        --cleanup-only)
            CLEANUP_ONLY=true
            shift
            ;;
        -f|--force)
            FORCE_MODE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --no-monitoring)
            NO_MONITORING=true
            shift
            ;;
        --no-ingress)
            NO_INGRESS=true
            shift
            ;;
        --list-resources)
            LIST_RESOURCES=true
            shift
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main execution function
main() {
    print_header
    
    # Change to project root directory
    cd "$PROJECT_ROOT"
    
    check_prerequisites
    
    if [ "$LIST_RESOURCES" = true ]; then
        show_cluster_status
        exit 0
    fi
    
    show_cluster_status
    validate_environment
    show_resource_estimates
    
    # Final confirmation for non-dry-run deployments
    if [ "$FORCE_MODE" = false ] && [ "$DRY_RUN" = false ]; then
        echo
        print_warning "⚠️  This will modify your Kubernetes cluster!"
        read -p "Do you want to continue? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Deployment cancelled by user"
            exit 0
        fi
    fi
    
    # Execute deployment phases
    if [ "$CLEANUP_ONLY" = true ]; then
        run_cleanup
        print_status "Cleanup-only mode completed!"
        exit 0
    fi
    
    run_cleanup
    run_deployment
    show_post_deployment_info
    
    echo
    print_status "🚀 Quantum NLP Platform deployment orchestration completed!"
}

# Handle script interruption
cleanup_on_exit() {
    echo
    print_warning "Deployment interrupted!"
    print_info "You can resume by running the script again"
    exit 1
}

trap cleanup_on_exit SIGINT SIGTERM

# Run main function
main "$@"