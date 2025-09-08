# 🚀 Quantum NLP Platform - Quick Deployment Guide

## One-Command Deployment

```bash
# Full deployment with cleanup
./scripts/deploy-platform.sh

# Production deployment
./scripts/deploy-platform.sh --env production --force

# Dry run to see what would happen
./scripts/deploy-platform.sh --dry-run
```

## Step-by-Step Manual Deployment

### 1. Prerequisites Check
```bash
kubectl cluster-info
kubectl get nodes
docker version
```

### 2. Clean Existing Resources
```bash
./scripts/k8s-cleanup.sh --list      # See current resources
./scripts/k8s-cleanup.sh             # Interactive cleanup
./scripts/k8s-cleanup.sh --force     # Force cleanup
```

### 3. Deploy Platform
```bash
./scripts/k8s-deploy.sh --env development
./scripts/k8s-deploy.sh --env staging
./scripts/k8s-deploy.sh --env production
```

## Quick Access Commands

### Check Deployment Status
```bash
kubectl get pods -n quantum-nlp -w
kubectl get services -n quantum-nlp
kubectl get ingress -n quantum-nlp
```

### Access Applications
```bash
# API Gateway
kubectl port-forward svc/nlp-gateway 8080:8080 -n quantum-nlp
curl http://localhost:8080/health

# Web Portal
kubectl port-forward svc/web-portal 3000:3000 -n quantum-nlp

# Admin Dashboard  
kubectl port-forward svc/admin-dashboard 3001:3001 -n quantum-nlp

# Monitoring
kubectl port-forward svc/prometheus 9090:9090 -n quantum-nlp-monitoring
kubectl port-forward svc/grafana 3030:3000 -n quantum-nlp-monitoring
```

### Database Access
```bash
# PostgreSQL
kubectl port-forward svc/postgresql 5432:5432 -n quantum-nlp
psql -h localhost -U quantum_user -d quantum_nlp

# Redis
kubectl port-forward svc/redis 6379:6379 -n quantum-nlp
redis-cli -h localhost

# Neo4j
kubectl port-forward svc/neo4j 7474:7474 -n quantum-nlp
# Open http://localhost:7474 in browser
```

## Troubleshooting

### Common Issues
```bash
# Check pod status and logs
kubectl get pods -n quantum-nlp
kubectl logs -f deployment/nlp-gateway -n quantum-nlp
kubectl describe pod <pod-name> -n quantum-nlp

# Check resources
kubectl top nodes
kubectl top pods -n quantum-nlp

# Check events
kubectl get events -n quantum-nlp --sort-by=.metadata.creationTimestamp

# Check storage
kubectl get pvc -n quantum-nlp
kubectl get pv
```

### Resource Issues
```bash
# Scale down if needed
kubectl scale deployment nlp-gateway --replicas=1 -n quantum-nlp

# Restart deployments
kubectl rollout restart deployment/nlp-gateway -n quantum-nlp

# Force delete stuck pods
kubectl delete pod <pod-name> -n quantum-nlp --force --grace-period=0
```

## Environment Configurations

### Development
- 1 replica per service
- Minimal resources (256Mi RAM, 100m CPU)
- Local storage
- Basic monitoring

### Staging  
- 2 replicas per service
- Moderate resources (512Mi RAM, 250m CPU)
- Persistent storage
- Full monitoring

### Production
- 3+ replicas with auto-scaling
- High resources (1Gi+ RAM, 500m+ CPU)
- Premium storage
- Complete monitoring & alerting
- Security hardening

## Resource Requirements

| Environment | CPU Cores | Memory | Storage | Nodes |
|-------------|-----------|--------|---------|-------|
| Development | 4+        | 8GB+   | 20GB+   | 2+    |
| Staging     | 8+        | 16GB+  | 100GB+  | 3+    |
| Production  | 16+       | 32GB+  | 500GB+  | 5+    |

## Security Checklist

- [ ] Update secrets.yaml with real credentials
- [ ] Enable TLS/SSL certificates
- [ ] Configure network policies
- [ ] Set up RBAC properly
- [ ] Enable audit logging
- [ ] Configure backup automation
- [ ] Test disaster recovery

## Monitoring & Observability

### Prometheus Metrics
```bash
# Custom metrics endpoints
curl http://localhost:8080/metrics          # NLP Gateway
curl http://localhost:8081/metrics          # QLAFS Fingerprint
curl http://localhost:8082/metrics          # QLAFS Consensus
```

### Grafana Dashboards
- System Overview
- QLAFS Trust Metrics
- Application Performance
- Cost Analytics
- Agent Performance

## Backup & Recovery

### Database Backups
```bash
# PostgreSQL backup
kubectl exec -it postgresql-0 -n quantum-nlp -- pg_dump -U quantum_user quantum_nlp > backup.sql

# Restore
kubectl exec -i postgresql-0 -n quantum-nlp -- psql -U quantum_user quantum_nlp < backup.sql
```

### Configuration Backups
```bash
# Export all configurations
kubectl get all,configmap,secret,pvc -n quantum-nlp -o yaml > quantum-nlp-backup.yaml

# Restore
kubectl apply -f quantum-nlp-backup.yaml
```

## Scaling Operations

### Manual Scaling
```bash
# Scale specific service
kubectl scale deployment nlp-gateway --replicas=5 -n quantum-nlp

# Scale all services
for deployment in $(kubectl get deployments -n quantum-nlp -o name); do
  kubectl scale $deployment --replicas=3 -n quantum-nlp
done
```

### Auto-scaling
```bash
# Check HPA status
kubectl get hpa -n quantum-nlp

# Adjust HPA
kubectl patch hpa nlp-gateway-hpa -n quantum-nlp -p '{"spec":{"maxReplicas":10}}'
```

## Useful Aliases

Add to your `.bashrc` or `.zshrc`:

```bash
# Quantum NLP aliases
alias k='kubectl'
alias kqn='kubectl -n quantum-nlp'
alias kqm='kubectl -n quantum-nlp-monitoring'

# Quick status checks  
alias qnl-status='kubectl get pods,svc,ingress -n quantum-nlp'
alias qnl-logs='kubectl logs -f deployment/nlp-gateway -n quantum-nlp'
alias qnl-health='curl -f http://localhost:8080/health'

# Port forwarding shortcuts
alias qnl-api='kubectl port-forward svc/nlp-gateway 8080:8080 -n quantum-nlp'
alias qnl-web='kubectl port-forward svc/web-portal 3000:3000 -n quantum-nlp'
alias qnl-grafana='kubectl port-forward svc/grafana 3030:3000 -n quantum-nlp-monitoring'
```

## Support

For issues and questions:
1. Check the logs: `kubectl logs -f deployment/<service> -n quantum-nlp`
2. Review the troubleshooting section in `docs/deployment-guide.md`
3. Check resource usage: `kubectl top pods -n quantum-nlp`
4. Verify configuration: `kubectl get configmap,secret -n quantum-nlp`

---

🎯 **Ready to deploy?** Run: `./scripts/deploy-platform.sh`