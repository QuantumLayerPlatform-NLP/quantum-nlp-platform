#!/bin/bash

# Kubernetes Cleanup Script for Quantum NLP Platform
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}[CLEANUP]${NC} $1"
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

# Function to check if kubectl is available
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command -v kubectl &> /dev/null; then
        print_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if kubectl can connect to cluster
    if ! kubectl cluster-info &> /dev/null; then
        print_error "Cannot connect to Kubernetes cluster"
        print_info "Please ensure your kubeconfig is properly configured"
        exit 1
    fi
    
    print_status "Prerequisites check passed"
}

# Function to list resources before cleanup
list_current_resources() {
    print_info "Current Kubernetes resources:"
    echo
    
    print_info "Namespaces:"
    kubectl get namespaces | grep -E "(quantum-nlp|NAME)" || echo "No quantum-nlp namespaces found"
    
    echo
    print_info "Deployments in quantum-nlp namespace:"
    kubectl get deployments -n quantum-nlp 2>/dev/null || echo "No deployments found"
    
    echo
    print_info "Services in quantum-nlp namespace:"
    kubectl get services -n quantum-nlp 2>/dev/null || echo "No services found"
    
    echo
    print_info "Persistent Volume Claims:"
    kubectl get pvc -n quantum-nlp 2>/dev/null || echo "No PVCs found"
    
    echo
    print_info "ConfigMaps and Secrets:"
    kubectl get configmaps,secrets -n quantum-nlp 2>/dev/null || echo "No configmaps/secrets found"
}

# Function to cleanup specific resource types
cleanup_resource_type() {
    local resource_type=$1
    local namespace=${2:-"quantum-nlp"}
    
    print_status "Cleaning up $resource_type in namespace $namespace..."
    
    resources=$(kubectl get $resource_type -n $namespace --no-headers 2>/dev/null | awk '{print $1}' || echo "")
    
    if [ -z "$resources" ]; then
        print_info "No $resource_type found in namespace $namespace"
        return
    fi
    
    echo "$resources" | while read -r resource; do
        if [ -n "$resource" ]; then
            print_info "Deleting $resource_type/$resource"
            kubectl delete $resource_type $resource -n $namespace --grace-period=30 --timeout=60s || {
                print_warning "Force deleting $resource_type/$resource"
                kubectl delete $resource_type $resource -n $namespace --force --grace-period=0 || true
            }
        fi
    done
}

# Function to cleanup Helm releases
cleanup_helm_releases() {
    print_status "Checking for Helm releases..."
    
    if ! command -v helm &> /dev/null; then
        print_info "Helm not found, skipping Helm cleanup"
        return
    fi
    
    # Check for releases in quantum-nlp namespace
    helm_releases=$(helm list -n quantum-nlp --short 2>/dev/null || echo "")
    
    if [ -n "$helm_releases" ]; then
        print_status "Found Helm releases to cleanup:"
        echo "$helm_releases" | while read -r release; do
            if [ -n "$release" ]; then
                print_info "Uninstalling Helm release: $release"
                helm uninstall $release -n quantum-nlp || true
            fi
        done
    else
        print_info "No Helm releases found in quantum-nlp namespace"
    fi
    
    # Check for cert-manager and ingress-nginx
    for namespace in cert-manager ingress-nginx; do
        helm_releases=$(helm list -n $namespace --short 2>/dev/null || echo "")
        if [ -n "$helm_releases" ]; then
            print_warning "Found releases in $namespace namespace:"
            echo "$helm_releases"
            read -p "Do you want to cleanup $namespace namespace? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                echo "$helm_releases" | while read -r release; do
                    if [ -n "$release" ]; then
                        print_info "Uninstalling $release from $namespace"
                        helm uninstall $release -n $namespace || true
                    fi
                done
            fi
        fi
    done
}

# Function to cleanup custom resource definitions
cleanup_crds() {
    print_status "Checking for Custom Resource Definitions..."
    
    # List CRDs that might be related to our platform
    crds=$(kubectl get crd 2>/dev/null | grep -E "(quantum-nlp|qlafs)" | awk '{print $1}' || echo "")
    
    if [ -n "$crds" ]; then
        print_warning "Found related CRDs:"
        echo "$crds"
        read -p "Do you want to delete these CRDs? This will remove all custom resources! (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "$crds" | while read -r crd; do
                if [ -n "$crd" ]; then
                    print_info "Deleting CRD: $crd"
                    kubectl delete crd $crd || true
                fi
            done
        fi
    else
        print_info "No related CRDs found"
    fi
}

# Function to cleanup persistent volumes
cleanup_persistent_volumes() {
    print_status "Checking for orphaned Persistent Volumes..."
    
    # Find PVs that were bound to our PVCs
    orphaned_pvs=$(kubectl get pv --no-headers 2>/dev/null | \
        grep -E "(quantum-nlp|Available)" | \
        awk '{print $1}' || echo "")
    
    if [ -n "$orphaned_pvs" ]; then
        print_warning "Found potentially orphaned Persistent Volumes:"
        kubectl get pv | head -1  # Show header
        echo "$orphaned_pvs" | while read -r pv; do
            if [ -n "$pv" ]; then
                kubectl get pv $pv 2>/dev/null || true
            fi
        done
        
        read -p "Do you want to delete these Persistent Volumes? This will permanently delete data! (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo "$orphaned_pvs" | while read -r pv; do
                if [ -n "$pv" ]; then
                    print_info "Deleting PV: $pv"
                    kubectl delete pv $pv || true
                fi
            done
        fi
    else
        print_info "No orphaned Persistent Volumes found"
    fi
}

# Function to wait for resource cleanup
wait_for_cleanup() {
    local namespace=$1
    print_status "Waiting for resources to be fully cleaned up..."
    
    # Wait for pods to terminate
    local max_wait=120  # 2 minutes
    local wait_time=0
    
    while [ $wait_time -lt $max_wait ]; do
        pod_count=$(kubectl get pods -n $namespace --no-headers 2>/dev/null | wc -l)
        if [ "$pod_count" -eq "0" ]; then
            print_status "All pods have been terminated"
            break
        fi
        
        print_info "Waiting for $pod_count pods to terminate... (${wait_time}s/${max_wait}s)"
        sleep 5
        wait_time=$((wait_time + 5))
    done
    
    if [ $wait_time -ge $max_wait ]; then
        print_warning "Some resources may still be terminating"
        kubectl get pods -n $namespace 2>/dev/null || true
    fi
}

# Main cleanup function
main_cleanup() {
    print_status "Starting Kubernetes cleanup for Quantum NLP Platform..."
    
    # List current resources
    list_current_resources
    
    echo
    read -p "Do you want to proceed with cleanup? This will delete ALL resources in quantum-nlp namespace! (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Cleanup cancelled by user"
        exit 0
    fi
    
    # Cleanup Helm releases first
    cleanup_helm_releases
    
    # Check if quantum-nlp namespace exists
    if kubectl get namespace quantum-nlp &> /dev/null; then
        print_status "Found quantum-nlp namespace, proceeding with cleanup..."
        
        # Cleanup resources in specific order
        print_status "Phase 1: Cleanup applications and services..."
        cleanup_resource_type "ingress"
        cleanup_resource_type "horizontalpodautoscaler"
        cleanup_resource_type "poddisruptionbudget"
        cleanup_resource_type "deployment"
        cleanup_resource_type "statefulset"
        cleanup_resource_type "daemonset"
        cleanup_resource_type "job"
        cleanup_resource_type "cronjob"
        cleanup_resource_type "service"
        
        print_status "Phase 2: Cleanup storage and configuration..."
        cleanup_resource_type "persistentvolumeclaim"
        cleanup_resource_type "configmap"
        cleanup_resource_type "secret"
        
        print_status "Phase 3: Cleanup RBAC and networking..."
        cleanup_resource_type "serviceaccount"
        cleanup_resource_type "role"
        cleanup_resource_type "rolebinding"
        cleanup_resource_type "networkpolicy"
        
        # Wait for cleanup to complete
        wait_for_cleanup "quantum-nlp"
        
        # Delete the namespace
        print_status "Deleting quantum-nlp namespace..."
        kubectl delete namespace quantum-nlp --timeout=120s || {
            print_warning "Force deleting namespace quantum-nlp"
            kubectl delete namespace quantum-nlp --force --grace-period=0 || true
        }
    else
        print_info "quantum-nlp namespace not found"
    fi
    
    # Cleanup quantum-nlp-monitoring namespace
    if kubectl get namespace quantum-nlp-monitoring &> /dev/null; then
        print_status "Cleaning up quantum-nlp-monitoring namespace..."
        kubectl delete namespace quantum-nlp-monitoring --timeout=120s || true
    fi
    
    # Cleanup cluster-wide resources
    print_status "Cleaning up cluster-wide resources..."
    
    # Cleanup ClusterRoles and ClusterRoleBindings
    cluster_roles=$(kubectl get clusterrole --no-headers 2>/dev/null | grep "quantum-nlp" | awk '{print $1}' || echo "")
    if [ -n "$cluster_roles" ]; then
        echo "$cluster_roles" | while read -r role; do
            if [ -n "$role" ]; then
                print_info "Deleting ClusterRole: $role"
                kubectl delete clusterrole $role || true
            fi
        done
    fi
    
    cluster_role_bindings=$(kubectl get clusterrolebinding --no-headers 2>/dev/null | grep "quantum-nlp" | awk '{print $1}' || echo "")
    if [ -n "$cluster_role_bindings" ]; then
        echo "$cluster_role_bindings" | while read -r binding; do
            if [ -n "$binding" ]; then
                print_info "Deleting ClusterRoleBinding: $binding"
                kubectl delete clusterrolebinding $binding || true
            fi
        done
    fi
    
    # Cleanup CRDs
    cleanup_crds
    
    # Cleanup orphaned PVs
    cleanup_persistent_volumes
    
    print_status "✅ Cleanup completed!"
    
    # Final verification
    print_info "Final verification:"
    kubectl get namespace | grep -E "(quantum-nlp|NAME)" || echo "No quantum-nlp namespaces remaining"
}

# Function to show help
show_help() {
    echo "Kubernetes Cleanup Script for Quantum NLP Platform"
    echo
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  -h, --help     Show this help message"
    echo "  -l, --list     List current resources without cleanup"
    echo "  -f, --force    Skip confirmation prompts (use with caution!)"
    echo "  --dry-run      Show what would be deleted without actually deleting"
    echo
    echo "Examples:"
    echo "  $0              # Interactive cleanup with confirmations"
    echo "  $0 --list       # List resources only"
    echo "  $0 --force      # Force cleanup without prompts"
    echo "  $0 --dry-run    # Preview cleanup actions"
}

# Parse command line arguments
FORCE_MODE=false
LIST_ONLY=false
DRY_RUN=false

while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            exit 0
            ;;
        -l|--list)
            LIST_ONLY=true
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
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Main execution
main() {
    check_prerequisites
    
    if [ "$LIST_ONLY" = true ]; then
        list_current_resources
        exit 0
    fi
    
    if [ "$DRY_RUN" = true ]; then
        print_info "DRY RUN MODE - No resources will actually be deleted"
        list_current_resources
        print_info "This is what would be cleaned up in a real run"
        exit 0
    fi
    
    if [ "$FORCE_MODE" = true ]; then
        print_warning "FORCE MODE ENABLED - Skipping confirmations!"
        sleep 2
    fi
    
    main_cleanup
    
    print_status "🎉 Kubernetes cleanup completed successfully!"
    print_info "The cluster is now ready for a fresh deployment of Quantum NLP Platform"
}

# Run main function
main "$@"