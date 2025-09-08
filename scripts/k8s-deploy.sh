#!/bin/bash

# Kubernetes Deployment Script for Quantum NLP Platform
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

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
NAMESPACE="quantum-nlp"
MONITORING_NAMESPACE="quantum-nlp-monitoring"
K8S_DIR="k8s"
FORCE_MODE=false
DRY_RUN=false
SKIP_BUILD=false
ENVIRONMENT="development"

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check kubectl
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check cluster connectivity
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        print_info "Please ensure your kubeconfig is properly configured"
        exit 1
    fi
    
    # Check if we're in the right directory
    if [ ! -d "$K8S_DIR" ]; then
        print_error "k8s directory not found. Please run this script from the project root."
        exit 1
    fi
    
    # Check Helm (optional)
    if command -v helm &> /dev/null; then
        print_info "Helm found - enhanced deployment options available"
    else
        print_info "Helm not found - using kubectl only"
    fi
    
    # Check Docker (for building)
    if [ "$SKIP_BUILD" = false ] && ! command -v docker &> /dev/null; then
        print_warning "Docker not found - skipping image builds"
        SKIP_BUILD=true
    fi
    
    print_status "Prerequisites check passed"
}

# Function to build Docker images
build_images() {
    if [ "$SKIP_BUILD" = true ]; then
        print_info "Skipping image builds"
        return
    fi
    
    print_step "Building Docker images..."
    
    # Services to build
    local services=(
        "nlp-gateway"
        "qlafs-fingerprint"
        "qlafs-consensus"
        "qlafs-transparency"
        "agent-orchestrator"
        "metrics-collector"
        "notification-service"
    )
    
    for service in "${services[@]}"; do
        print_info "Building $service image..."
        
        if [ "$DRY_RUN" = true ]; then
            print_info "[DRY RUN] Would build: quantumnlp/quantum-nlp-$service:latest"
            continue
        fi
        
        docker build \
            --build-arg SERVICE_NAME="$service" \
            --build-arg VERSION="$(date +%Y%m%d-%H%M%S)" \
            --build-arg BUILD_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
            -t "quantumnlp/quantum-nlp-$service:latest" \
            -f Dockerfile . || {
            print_warning "Failed to build $service, continuing with existing image..."
        }
    done
    
    # Build frontend images
    local frontend_apps=(
        "web-portal"
        "admin-dashboard"
        "developer-portal"
    )
    
    for app in "${frontend_apps[@]}"; do
        print_info "Building $app frontend image..."
        
        if [ "$DRY_RUN" = true ]; then
            print_info "[DRY RUN] Would build: quantumnlp/quantum-nlp-$app:latest"
            continue
        fi
        
        if [ -f "frontend/$app/Dockerfile" ]; then
            docker build \
                --build-arg VERSION="$(date +%Y%m%d-%H%M%S)" \
                -t "quantumnlp/quantum-nlp-$app:latest" \
                "frontend/$app/" || {
                print_warning "Failed to build $app, continuing..."
            }
        else
            print_warning "Dockerfile not found for $app, skipping..."
        fi
    done
}

# Function to create namespaces
create_namespaces() {
    print_step "Creating namespaces..."
    
    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would create namespaces: $NAMESPACE, $MONITORING_NAMESPACE"
        return
    fi
    
    kubectl apply -f "$K8S_DIR/namespace.yaml"
    
    # Verify namespaces were created
    for ns in $NAMESPACE $MONITORING_NAMESPACE; do
        if kubectl get namespace $ns &> /dev/null; then
            print_status "✅ Namespace $ns created/verified"
        else
            print_error "Failed to create namespace $ns"
            exit 1
        fi
    done
}

# Function to apply secrets
apply_secrets() {
    print_step "Applying secrets..."
    
    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would apply secrets"
        return
    fi
    
    # Check if secrets file exists
    if [ ! -f "$K8S_DIR/secrets.yaml" ]; then
        print_error "secrets.yaml not found in $K8S_DIR/"
        print_info "Please create secrets.yaml with your actual credentials"
        exit 1
    fi
    
    # Warn about using example secrets
    if grep -q "your_secure_password_here" "$K8S_DIR/secrets.yaml"; then
        print_warning "⚠️  Detected placeholder passwords in secrets.yaml!"
        print_warning "Please update secrets.yaml with actual credentials before deployment"
        
        if [ "$FORCE_MODE" = false ]; then
            read -p "Continue with placeholder credentials? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_info "Deployment cancelled. Please update secrets.yaml"
                exit 1
            fi
        fi
    fi
    
    kubectl apply -f "$K8S_DIR/secrets.yaml"
    print_status "✅ Secrets applied"
}

# Function to apply configuration
apply_configuration() {
    print_step "Applying configuration..."
    
    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would apply configmaps"
        return
    fi
    
    kubectl apply -f "$K8S_DIR/configmap.yaml"
    print_status "✅ Configuration applied"
}

# Function to deploy databases
deploy_databases() {
    print_step "Deploying databases (PostgreSQL, Redis, Neo4j)..."
    
    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would deploy databases"
        return
    fi
    
    kubectl apply -f "$K8S_DIR/database.yaml"
    
    # Wait for databases to be ready
    print_info "Waiting for databases to be ready..."
    
    # Wait for PostgreSQL
    print_info "Waiting for PostgreSQL..."
    kubectl wait --for=condition=ready pod -l app=postgresql -n $NAMESPACE --timeout=300s || {
        print_warning "PostgreSQL pod not ready within 5 minutes, continuing..."
    }
    
    # Wait for Redis
    print_info "Waiting for Redis..."
    kubectl wait --for=condition=ready pod -l app=redis -n $NAMESPACE --timeout=180s || {
        print_warning "Redis pod not ready within 3 minutes, continuing..."
    }
    
    print_status "✅ Databases deployed"
}

# Function to deploy Neo4j
deploy_neo4j() {
    print_step "Deploying Neo4j graph database..."
    
    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would deploy Neo4j"
        return
    fi
    
    # Check if Neo4j manifest exists, if not create it
    if [ ! -f "$K8S_DIR/neo4j.yaml" ]; then
        print_info "Creating Neo4j deployment manifest..."
        cat > "$K8S_DIR/neo4j.yaml" << 'EOF'
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: neo4j-pvc
  namespace: quantum-nlp
  labels:
    app: neo4j
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
  storageClassName: fast-ssd
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: neo4j
  namespace: quantum-nlp
  labels:
    app: neo4j
spec:
  replicas: 1
  selector:
    matchLabels:
      app: neo4j
  template:
    metadata:
      labels:
        app: neo4j
    spec:
      containers:
        - name: neo4j
          image: neo4j:5.15-community
          env:
            - name: NEO4J_AUTH
              value: "neo4j/password"
            - name: NEO4J_PLUGINS
              value: '["apoc"]'
            - name: NEO4J_dbms_security_procedures_unrestricted
              value: "apoc.*"
          ports:
            - containerPort: 7474
              name: http
            - containerPort: 7687
              name: bolt
          volumeMounts:
            - name: neo4j-storage
              mountPath: /data
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "2Gi"
              cpu: "1000m"
      volumes:
        - name: neo4j-storage
          persistentVolumeClaim:
            claimName: neo4j-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: neo4j
  namespace: quantum-nlp
  labels:
    app: neo4j
spec:
  type: ClusterIP
  ports:
    - port: 7474
      targetPort: 7474
      protocol: TCP
      name: http
    - port: 7687
      targetPort: 7687
      protocol: TCP
      name: bolt
  selector:
    app: neo4j
EOF
    fi
    
    kubectl apply -f "$K8S_DIR/neo4j.yaml"
    
    # Wait for Neo4j to be ready
    print_info "Waiting for Neo4j to be ready..."
    kubectl wait --for=condition=ready pod -l app=neo4j -n $NAMESPACE --timeout=300s || {
        print_warning "Neo4j pod not ready within 5 minutes, continuing..."
    }
    
    print_status "✅ Neo4j deployed"
}

# Function to deploy core services
deploy_core_services() {
    print_step "Deploying core services..."
    
    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would deploy core services"
        return
    fi
    
    # Deploy NLP Gateway
    kubectl apply -f "$K8S_DIR/nlp-gateway.yaml"
    
    # Create additional service manifests if they don't exist
    local services=(
        "qlafs-fingerprint"
        "qlafs-consensus"
        "qlafs-transparency"
        "agent-orchestrator"
        "metrics-collector"
        "notification-service"
    )
    
    for service in "${services[@]}"; do
        if [ ! -f "$K8S_DIR/$service.yaml" ]; then
            print_info "Creating manifest for $service..."
            create_service_manifest "$service"
        fi
        kubectl apply -f "$K8S_DIR/$service.yaml"
    done
    
    print_status "✅ Core services deployed"
}

# Function to create service manifest
create_service_manifest() {
    local service_name=$1
    local port=${2:-8080}
    
    cat > "$K8S_DIR/$service_name.yaml" << EOF
apiVersion: apps/v1
kind: Deployment
metadata:
  name: $service_name
  namespace: $NAMESPACE
  labels:
    app: $service_name
    app.kubernetes.io/name: $service_name
    app.kubernetes.io/component: service
spec:
  replicas: 2
  selector:
    matchLabels:
      app: $service_name
  template:
    metadata:
      labels:
        app: $service_name
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "$port"
        prometheus.io/path: "/metrics"
    spec:
      containers:
        - name: $service_name
          image: quantumnlp/quantum-nlp-$service_name:latest
          ports:
            - containerPort: $port
              name: http
          env:
            - name: ENVIRONMENT
              value: "$ENVIRONMENT"
            - name: PORT
              value: "$port"
            - name: DB_HOST
              value: "postgresql"
            - name: REDIS_HOST
              value: "redis"
            - name: NEO4J_URI
              value: "bolt://neo4j:7687"
          envFrom:
            - secretRef:
                name: quantum-nlp-secrets
          livenessProbe:
            httpGet:
              path: /health
              port: $port
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: $port
            initialDelaySeconds: 5
            periodSeconds: 5
          resources:
            requests:
              memory: "256Mi"
              cpu: "100m"
            limits:
              memory: "1Gi"
              cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: $service_name
  namespace: $NAMESPACE
  labels:
    app: $service_name
spec:
  type: ClusterIP
  ports:
    - port: $port
      targetPort: $port
      protocol: TCP
      name: http
  selector:
    app: $service_name
EOF
}

# Function to deploy monitoring
deploy_monitoring() {
    print_step "Deploying monitoring stack..."
    
    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would deploy monitoring"
        return
    fi
    
    kubectl apply -f "$K8S_DIR/monitoring.yaml"
    
    # Wait for Prometheus to be ready
    print_info "Waiting for monitoring services to be ready..."
    kubectl wait --for=condition=ready pod -l app=prometheus -n $MONITORING_NAMESPACE --timeout=300s || {
        print_warning "Prometheus not ready within 5 minutes, continuing..."
    }
    
    print_status "✅ Monitoring deployed"
}

# Function to setup ingress
setup_ingress() {
    print_step "Setting up ingress..."
    
    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would setup ingress"
        return
    fi
    
    # Check if NGINX ingress controller is installed
    if ! kubectl get namespace ingress-nginx &> /dev/null; then
        print_info "Installing NGINX Ingress Controller..."
        
        if command -v helm &> /dev/null; then
            # Install using Helm
            helm repo add ingress-nginx https://kubernetes.github.io/ingress-nginx
            helm repo update
            helm install ingress-nginx ingress-nginx/ingress-nginx \
                --namespace ingress-nginx \
                --create-namespace \
                --set controller.metrics.enabled=true
        else
            # Install using kubectl
            kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.8.2/deploy/static/provider/cloud/deploy.yaml
        fi
        
        # Wait for ingress controller
        print_info "Waiting for NGINX Ingress Controller..."
        kubectl wait --namespace ingress-nginx \
            --for=condition=ready pod \
            --selector=app.kubernetes.io/component=controller \
            --timeout=300s
    else
        print_info "NGINX Ingress Controller already installed"
    fi
    
    print_status "✅ Ingress configured"
}

# Function to wait for deployments
wait_for_deployments() {
    print_step "Waiting for all deployments to be ready..."
    
    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would wait for deployments"
        return
    fi
    
    local deployments=(
        "postgresql"
        "redis" 
        "neo4j"
        "nlp-gateway"
        "qlafs-fingerprint"
        "qlafs-consensus"
        "qlafs-transparency"
        "agent-orchestrator"
        "metrics-collector"
        "notification-service"
    )
    
    for deployment in "${deployments[@]}"; do
        print_info "Waiting for $deployment..."
        if kubectl get deployment $deployment -n $NAMESPACE &> /dev/null; then
            kubectl wait --for=condition=available deployment/$deployment -n $NAMESPACE --timeout=300s || {
                print_warning "$deployment not ready within 5 minutes"
            }
        else
            print_info "$deployment not found, skipping..."
        fi
    done
    
    print_status "✅ All deployments processed"
}

# Function to verify deployment
verify_deployment() {
    print_step "Verifying deployment..."
    
    print_info "Deployment Status:"
    echo
    
    # Show pods
    print_info "Pods in $NAMESPACE namespace:"
    kubectl get pods -n $NAMESPACE -o wide
    
    echo
    print_info "Services in $NAMESPACE namespace:"
    kubectl get services -n $NAMESPACE
    
    echo
    print_info "Ingress resources:"
    kubectl get ingress -n $NAMESPACE 2>/dev/null || echo "No ingress resources found"
    
    echo
    print_info "Storage:"
    kubectl get pvc -n $NAMESPACE
    
    # Health check
    echo
    print_status "Health Checks:"
    
    # Check if NLP Gateway is accessible
    if kubectl get service nlp-gateway -n $NAMESPACE &> /dev/null; then
        print_info "Testing NLP Gateway health endpoint..."
        kubectl port-forward service/nlp-gateway 8080:8080 -n $NAMESPACE &
        local pf_pid=$!
        sleep 3
        
        if curl -f http://localhost:8080/health &> /dev/null; then
            print_status "✅ NLP Gateway health check passed"
        else
            print_warning "❌ NLP Gateway health check failed"
        fi
        
        kill $pf_pid 2>/dev/null || true
    fi
    
    # Show monitoring URLs
    if kubectl get service prometheus -n $MONITORING_NAMESPACE &> /dev/null; then
        echo
        print_info "🔍 Monitoring URLs (use kubectl port-forward):"
        echo "Prometheus:  kubectl port-forward svc/prometheus 9090:9090 -n $MONITORING_NAMESPACE"
        echo "Grafana:     kubectl port-forward svc/grafana 3000:3000 -n $MONITORING_NAMESPACE"
    fi
    
    # Show application URLs
    echo
    print_info "🚀 Application URLs (use kubectl port-forward):"
    echo "NLP Gateway:     kubectl port-forward svc/nlp-gateway 8080:8080 -n $NAMESPACE"
    echo "Web Portal:      kubectl port-forward svc/web-portal 3000:3000 -n $NAMESPACE"
    echo "Admin Dashboard: kubectl port-forward svc/admin-dashboard 3001:3001 -n $NAMESPACE"
}

# Function to show help
show_help() {
    echo "Kubernetes Deployment Script for Quantum NLP Platform"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -h, --help          Show this help message"
    echo "  -e, --env ENV       Set environment (development|staging|production) [default: development]"
    echo "  -f, --force         Skip confirmation prompts"
    echo "  --dry-run          Show what would be deployed without actually deploying"
    echo "  --skip-build       Skip Docker image builds"
    echo "  --no-monitoring    Skip monitoring stack deployment"
    echo "  --no-ingress       Skip ingress setup"
    echo
    echo "Examples:"
    echo "  $0                          # Interactive deployment"
    echo "  $0 --env production         # Production deployment"
    echo "  $0 --force --skip-build     # Force deployment without rebuilding"
    echo "  $0 --dry-run                # Preview deployment actions"
}

# Parse command line arguments
NO_MONITORING=false
NO_INGRESS=false

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
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main deployment function
main_deploy() {
    print_status "🚀 Starting Quantum NLP Platform deployment..."
    print_info "Environment: $ENVIRONMENT"
    print_info "Namespace: $NAMESPACE"
    
    if [ "$DRY_RUN" = true ]; then
        print_info "🧪 DRY RUN MODE - No actual changes will be made"
    fi
    
    # Confirmation
    if [ "$FORCE_MODE" = false ] && [ "$DRY_RUN" = false ]; then
        echo
        read -p "Do you want to proceed with the deployment? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Deployment cancelled by user"
            exit 0
        fi
    fi
    
    # Deployment steps
    build_images
    create_namespaces
    apply_secrets
    apply_configuration
    deploy_databases
    deploy_neo4j
    deploy_core_services
    
    if [ "$NO_MONITORING" = false ]; then
        deploy_monitoring
    fi
    
    if [ "$NO_INGRESS" = false ]; then
        setup_ingress
    fi
    
    wait_for_deployments
    verify_deployment
    
    print_status "🎉 Deployment completed successfully!"
    
    if [ "$DRY_RUN" = false ]; then
        print_info "Next steps:"
        echo "1. Update DNS records to point to your ingress load balancer"
        echo "2. Configure SSL certificates if using cert-manager"
        echo "3. Update secrets.yaml with production credentials"
        echo "4. Set up backup schedules for databases"
        echo "5. Configure alerting rules in Prometheus"
    fi
}

# Main execution
main() {
    check_prerequisites
    main_deploy
}

# Run main function
main "$@"