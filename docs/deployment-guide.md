# Deployment Guide

## Overview

This guide covers deploying the Quantum NLP Platform with QLAFS in various environments, from local development to production-scale deployments.

## Prerequisites

### System Requirements

**Development Environment:**
- OS: Linux, macOS, or Windows with WSL2
- RAM: 16GB minimum, 32GB recommended
- CPU: 4+ cores
- Storage: 50GB available space
- Docker: 20.10+
- Kubernetes: 1.28+

**Production Environment:**
- Kubernetes cluster (EKS, AKS, or GKE)
- Node pools with 8GB+ RAM per node
- Persistent storage (SSD recommended)
- Load balancer (ALB, NLB, or equivalent)
- Certificate management (cert-manager)

### Required Tools

```bash
# Install required tools
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
sudo install kubectl /usr/local/bin/

# Helm
curl https://get.helm.sh/helm-v3.13.0-linux-amd64.tar.gz | tar -xz
sudo mv linux-amd64/helm /usr/local/bin/

# Terraform (optional, for cloud resources)
wget https://releases.hashicorp.com/terraform/1.6.0/terraform_1.6.0_linux_amd64.zip
unzip terraform_1.6.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/
```

## Quick Start (Local Development)

### 1. Clone and Setup

```bash
git clone https://github.com/your-org/quantum-nlp-platform.git
cd quantum-nlp-platform

# Copy environment template
cp .env.example .env

# Edit .env with your configuration
nano .env
```

### 2. Start with Docker Compose

```bash
# Start all services
make dev

# Or manually:
docker-compose up -d

# Check status
docker-compose ps
```

### 3. Verify Installation

```bash
# Check health endpoints
curl http://localhost:8080/health
curl http://localhost:3000  # Web portal

# Run smoke tests
make test-smoke
```

## Production Deployment

### Option 1: Cloud-Native (Recommended)

#### AWS EKS Deployment

```bash
# 1. Set up cloud resources with Terraform
cd terraform/
terraform init
terraform plan -var-file=production.tfvars
terraform apply

# 2. Configure kubectl
aws eks update-kubeconfig --region us-east-1 --name quantum-nlp-production

# 3. Deploy platform
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/database.yaml
kubectl apply -f k8s/nlp-gateway.yaml
kubectl apply -f k8s/monitoring.yaml

# 4. Verify deployment
kubectl get pods -n quantum-nlp
kubectl get services -n quantum-nlp
```

#### Azure AKS Deployment

```bash
# 1. Create resource group and AKS cluster
az group create --name quantum-nlp-rg --location eastus
az aks create --resource-group quantum-nlp-rg --name quantum-nlp-cluster \
  --node-count 3 --node-vm-size Standard_D4s_v3 --enable-addons monitoring

# 2. Get credentials
az aks get-credentials --resource-group quantum-nlp-rg --name quantum-nlp-cluster

# 3. Continue with Kubernetes deployment steps...
```

### Option 2: Helm Charts (Simplified)

```bash
# Add Helm repository
helm repo add quantum-nlp https://charts.quantum-nlp.example.com
helm repo update

# Install with custom values
helm install quantum-nlp quantum-nlp/platform \
  --namespace quantum-nlp \
  --create-namespace \
  -f values-production.yaml

# Upgrade deployment
helm upgrade quantum-nlp quantum-nlp/platform \
  -f values-production.yaml
```

## Environment-Specific Configuration

### Development Environment

```yaml
# values-dev.yaml
global:
  environment: development
  replicaCount: 1
  
database:
  postgresql:
    persistence:
      size: 10Gi
  
resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
  limits:
    memory: "1Gi"
    cpu: "500m"

monitoring:
  enabled: true
  grafana:
    adminPassword: "dev-password"
```

### Staging Environment

```yaml
# values-staging.yaml
global:
  environment: staging
  replicaCount: 2
  
database:
  postgresql:
    persistence:
      size: 50Gi
      storageClass: "fast-ssd"
  
resources:
  requests:
    memory: "512Mi"
    cpu: "250m"
  limits:
    memory: "2Gi"
    cpu: "1000m"

ingress:
  enabled: true
  hosts:
    - staging.quantum-nlp.example.com
  tls:
    enabled: true
```

### Production Environment

```yaml
# values-production.yaml
global:
  environment: production
  replicaCount: 5
  
database:
  postgresql:
    persistence:
      size: 200Gi
      storageClass: "premium-ssd"
    backup:
      enabled: true
      retention: "30d"
  
resources:
  requests:
    memory: "1Gi"
    cpu: "500m"
  limits:
    memory: "4Gi"
    cpu: "2000m"

autoscaling:
  enabled: true
  minReplicas: 5
  maxReplicas: 50
  targetCPUUtilization: 70

security:
  podSecurityContext:
    runAsNonRoot: true
    runAsUser: 1000
    fsGroup: 1000

monitoring:
  enabled: true
  alerting:
    enabled: true
    pagerduty:
      integrationKey: "your-pagerduty-key"

backup:
  enabled: true
  schedule: "0 2 * * *"
  retention: "30d"
```

## Database Setup

### PostgreSQL Setup

```bash
# Create database and user
kubectl exec -it postgresql-0 -n quantum-nlp -- psql -U postgres
```

```sql
-- Create database and user
CREATE DATABASE quantum_nlp;
CREATE USER quantum_user WITH PASSWORD 'your-secure-password';
GRANT ALL PRIVILEGES ON DATABASE quantum_nlp TO quantum_user;

-- Create extensions
\c quantum_nlp;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "btree_gin";
```

### Run Migrations

```bash
# Run database migrations
kubectl create job --from=cronjob/db-migration db-migration-manual -n quantum-nlp

# Or run manually
kubectl run migrate --image=quantumnlp/migrations:latest --rm -it --restart=Never \
  --env="DB_HOST=postgresql" \
  --env="DB_USER=quantum_user" \
  --env="DB_PASSWORD=your-password" \
  --env="DB_NAME=quantum_nlp" \
  -- /migrate up
```

## SSL/TLS Configuration

### cert-manager Setup

```bash
# Install cert-manager
helm install cert-manager jetstack/cert-manager \
  --namespace cert-manager \
  --create-namespace \
  --set installCRDs=true

# Create ClusterIssuer
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@quantum-nlp.example.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

## Monitoring Setup

### Prometheus and Grafana

```bash
# Install monitoring stack
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --create-namespace \
  --set grafana.adminPassword=your-admin-password

# Import Quantum NLP dashboards
kubectl create configmap grafana-dashboards \
  --from-file=monitoring/grafana/dashboards/ \
  -n monitoring
```

### Custom Metrics Configuration

```yaml
# monitoring/servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: quantum-nlp-metrics
  namespace: quantum-nlp
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: quantum-nlp
  endpoints:
  - port: metrics
    interval: 15s
    path: /metrics
```

## Security Hardening

### Network Policies

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: quantum-nlp-netpol
  namespace: quantum-nlp
spec:
  podSelector:
    matchLabels:
      app.kubernetes.io/part-of: quantum-nlp
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 8080
  egress:
  - to: []
    ports:
    - protocol: TCP
      port: 443  # HTTPS
    - protocol: TCP
      port: 53   # DNS
    - protocol: UDP
      port: 53   # DNS
```

### Pod Security Standards

```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: quantum-nlp
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### Secret Management

```bash
# Use external secrets operator (recommended)
helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets-system \
  --create-namespace

# Configure AWS Secrets Manager integration
kubectl apply -f - <<EOF
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secrets-manager
  namespace: quantum-nlp
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets-sa
EOF
```

## Scaling Configuration

### Horizontal Pod Autoscaling

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: nlp-gateway-hpa
  namespace: quantum-nlp
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nlp-gateway
  minReplicas: 3
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: "100"
```

### Vertical Pod Autoscaling

```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: nlp-gateway-vpa
  namespace: quantum-nlp
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: nlp-gateway
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: nlp-gateway
      maxAllowed:
        cpu: "4"
        memory: "8Gi"
      minAllowed:
        cpu: "100m"
        memory: "256Mi"
```

## Disaster Recovery

### Database Backup

```bash
# Automated backup with CronJob
kubectl apply -f - <<EOF
apiVersion: batch/v1
kind: CronJob
metadata:
  name: postgres-backup
  namespace: quantum-nlp
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: postgres-backup
            image: postgres:15
            command:
            - /bin/bash
            - -c
            - |
              pg_dump -h postgresql -U quantum_user -d quantum_nlp > /backup/quantum_nlp_$(date +%Y%m%d_%H%M%S).sql
              aws s3 cp /backup/quantum_nlp_*.sql s3://your-backup-bucket/database/
            env:
            - name: PGPASSWORD
              valueFrom:
                secretKeyRef:
                  name: quantum-nlp-secrets
                  key: DB_PASSWORD
            volumeMounts:
            - name: backup-storage
              mountPath: /backup
          volumes:
          - name: backup-storage
            emptyDir: {}
          restartPolicy: OnFailure
EOF
```

### Cross-Region Replication

```yaml
# Setup read replica in different region
apiVersion: postgresql.cnpg.io/v1
kind: Cluster
metadata:
  name: postgres-replica
  namespace: quantum-nlp
spec:
  instances: 2
  primaryUpdateStrategy: unsupervised
  
  replica:
    enabled: true
    source: "postgres-primary"
    
  bootstrap:
    replica:
      source: postgres-primary
      
  externalClusters:
  - name: postgres-primary
    connectionParameters:
      host: postgres-primary.quantum-nlp.svc.cluster.local
      user: streaming_replica
      dbname: postgres
      sslmode: require
    password:
      name: postgres-replica-secret
      key: password
```

## Health Checks and Monitoring

### Application Health Checks

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 8080
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /ready
    port: 8080
  initialDelaySeconds: 5
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

### Custom Alerts

```yaml
# alerts/quantum-nlp-alerts.yaml
groups:
- name: quantum-nlp
  rules:
  - alert: HighErrorRate
    expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
    for: 2m
    labels:
      severity: warning
    annotations:
      summary: "High error rate detected"
      description: "Error rate is {{ $value }} for service {{ $labels.service }}"
      
  - alert: QLAFSSecurityIncident
    expr: qlafs_security_incidents_total > 0
    for: 0m
    labels:
      severity: critical
    annotations:
      summary: "QLAFS security incident detected"
      description: "{{ $value }} security incidents detected in QLAFS system"
```

## Troubleshooting

### Common Issues

#### Pods Stuck in Pending State

```bash
# Check node resources
kubectl top nodes

# Check pod events
kubectl describe pod <pod-name> -n quantum-nlp

# Check storage availability
kubectl get pv,pvc -n quantum-nlp
```

#### Database Connection Issues

```bash
# Test database connectivity
kubectl run -it --rm debug --image=postgres:15 --restart=Never -- \
  psql -h postgresql.quantum-nlp.svc.cluster.local -U quantum_user -d quantum_nlp

# Check database logs
kubectl logs postgresql-0 -n quantum-nlp
```

#### High Memory Usage

```bash
# Check memory usage per pod
kubectl top pods -n quantum-nlp

# Analyze memory usage
kubectl exec -it <pod-name> -n quantum-nlp -- cat /proc/meminfo

# Check for memory leaks
kubectl logs <pod-name> -n quantum-nlp | grep -i "out of memory\|oom"
```

### Debug Commands

```bash
# Get detailed cluster information
kubectl cluster-info dump

# Check all resources in namespace
kubectl get all -n quantum-nlp

# Port forward for local debugging
kubectl port-forward svc/nlp-gateway 8080:8080 -n quantum-nlp

# Execute into running container
kubectl exec -it deployment/nlp-gateway -n quantum-nlp -- /bin/sh

# View real-time logs
kubectl logs -f deployment/nlp-gateway -n quantum-nlp
```

## Performance Tuning

### JVM Tuning (for Java services)

```yaml
env:
- name: JAVA_OPTS
  value: "-Xmx2g -Xms1g -XX:+UseG1GC -XX:MaxGCPauseMillis=200"
```

### Connection Pool Tuning

```yaml
database:
  maxOpenConns: 50
  maxIdleConns: 10
  connMaxLifetime: "1h"
  
redis:
  poolSize: 20
  minIdleConns: 5
  maxRetries: 3
```

### Resource Optimization

```bash
# Analyze resource usage over time
kubectl top pods -n quantum-nlp --containers

# Use VPA recommendations
kubectl get vpa nlp-gateway-vpa -n quantum-nlp -o yaml
```

## Maintenance

### Rolling Updates

```bash
# Update image version
kubectl set image deployment/nlp-gateway nlp-gateway=quantumnlp/nlp-gateway:v1.2.0 -n quantum-nlp

# Check rollout status
kubectl rollout status deployment/nlp-gateway -n quantum-nlp

# Rollback if needed
kubectl rollout undo deployment/nlp-gateway -n quantum-nlp
```

### Database Maintenance

```bash
# Create maintenance window
kubectl scale deployment nlp-gateway --replicas=0 -n quantum-nlp

# Run database maintenance
kubectl exec -it postgresql-0 -n quantum-nlp -- psql -U postgres -c "VACUUM ANALYZE;"

# Scale back up
kubectl scale deployment nlp-gateway --replicas=3 -n quantum-nlp
```

For additional support and advanced configuration options, consult the [Architecture Guide](architecture.md) and [API Reference](api-guide.md).