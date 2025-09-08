#!/bin/bash

# Deploy Quantum NLP Platform using GitHub Container Registry images
set -e

GITHUB_ORG="QuantumLayerPlatform-NLP"
REGISTRY="ghcr.io"
IMAGE_PREFIX="${REGISTRY}/${GITHUB_ORG,,}/quantum-nlp"
TAG="${1:-latest}"

echo "Deploying Quantum NLP Platform from GitHub Container Registry"
echo "Registry: ${REGISTRY}"
echo "Image Prefix: ${IMAGE_PREFIX}"
echo "Tag: ${TAG}"

# Update image tags in manifests
echo "Updating image tags..."
find k8s/ -name "*.yaml" -exec sed -i.bak "s|:latest|:${TAG}|g" {} \;

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
find k8s/ -name "*.bak" -exec bash -c 'mv "$1" "${1%.bak}"' _ {} \;
