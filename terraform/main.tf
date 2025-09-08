terraform {
  required_version = ">= 1.5"
  
  required_providers {
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.23"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.11"
    }
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.0"
    }
  }
  
  backend "s3" {
    bucket         = "quantum-nlp-terraform-state"
    key            = "terraform/quantum-nlp-platform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "quantum-nlp-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region
  
  default_tags {
    tags = {
      Project     = "quantum-nlp-platform"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.azure_subscription_id
  tenant_id       = var.azure_tenant_id
}

provider "kubernetes" {
  config_path = var.kubeconfig_path
}

provider "helm" {
  kubernetes {
    config_path = var.kubeconfig_path
  }
}

# Local variables
locals {
  name_prefix = "quantum-nlp-${var.environment}"
  
  common_tags = {
    Project     = "quantum-nlp-platform"
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

# Data sources
data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# VPC and Networking (if deploying to AWS)
module "vpc" {
  source = "./modules/vpc"
  count  = var.cloud_provider == "aws" ? 1 : 0
  
  name_prefix = local.name_prefix
  cidr_block  = var.vpc_cidr
  
  availability_zones = var.availability_zones
  private_subnets    = var.private_subnets
  public_subnets     = var.public_subnets
  
  enable_nat_gateway   = true
  enable_vpn_gateway   = false
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = local.common_tags
}

# EKS Cluster (if using AWS)
module "eks" {
  source = "./modules/eks"
  count  = var.cloud_provider == "aws" ? 1 : 0
  
  cluster_name    = local.name_prefix
  cluster_version = var.kubernetes_version
  
  vpc_id          = module.vpc[0].vpc_id
  subnet_ids      = module.vpc[0].private_subnets
  
  node_groups = var.eks_node_groups
  
  cluster_endpoint_private_access = true
  cluster_endpoint_public_access  = true
  cluster_endpoint_public_access_cidrs = var.cluster_endpoint_public_access_cidrs
  
  enable_irsa                = true
  cluster_encryption_config_enabled = true
  
  tags = local.common_tags
}

# AKS Cluster (if using Azure)
module "aks" {
  source = "./modules/aks"
  count  = var.cloud_provider == "azure" ? 1 : 0
  
  cluster_name        = local.name_prefix
  resource_group_name = var.azure_resource_group
  location           = var.azure_location
  
  kubernetes_version = var.kubernetes_version
  
  default_node_pool = var.aks_default_node_pool
  additional_node_pools = var.aks_additional_node_pools
  
  network_plugin    = "azure"
  network_policy    = "calico"
  load_balancer_sku = "standard"
  
  rbac_enabled               = true
  azure_active_directory_enabled = true
  
  tags = local.common_tags
}

# RDS PostgreSQL (if using AWS)
module "rds" {
  source = "./modules/rds"
  count  = var.cloud_provider == "aws" ? 1 : 0
  
  identifier = "${local.name_prefix}-postgres"
  
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.rds_instance_class
  
  allocated_storage     = var.rds_allocated_storage
  max_allocated_storage = var.rds_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true
  
  db_name  = "quantum_nlp"
  username = "quantum_user"
  
  vpc_security_group_ids = [module.security_groups[0].rds_security_group_id]
  db_subnet_group_name   = module.vpc[0].database_subnet_group
  
  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  deletion_protection       = var.environment == "production"
  skip_final_snapshot      = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "${local.name_prefix}-final-snapshot" : null
  
  performance_insights_enabled = true
  monitoring_interval         = 60
  
  tags = local.common_tags
}

# ElastiCache Redis (if using AWS)
module "elasticache" {
  source = "./modules/elasticache"
  count  = var.cloud_provider == "aws" ? 1 : 0
  
  cluster_id = "${local.name_prefix}-redis"
  
  engine               = "redis"
  engine_version       = "7.0"
  node_type           = var.redis_node_type
  num_cache_nodes     = var.redis_num_nodes
  parameter_group_name = "default.redis7"
  port                = 6379
  
  subnet_group_name  = module.vpc[0].elasticache_subnet_group
  security_group_ids = [module.security_groups[0].redis_security_group_id]
  
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  
  maintenance_window = "sun:05:00-sun:06:00"
  snapshot_retention_limit = 7
  snapshot_window         = "06:00-07:00"
  
  tags = local.common_tags
}

# Security Groups (if using AWS)
module "security_groups" {
  source = "./modules/security-groups"
  count  = var.cloud_provider == "aws" ? 1 : 0
  
  name_prefix = local.name_prefix
  vpc_id      = module.vpc[0].vpc_id
  vpc_cidr    = var.vpc_cidr
  
  tags = local.common_tags
}

# IAM roles and policies
module "iam" {
  source = "./modules/iam"
  count  = var.cloud_provider == "aws" ? 1 : 0
  
  name_prefix = local.name_prefix
  
  tags = local.common_tags
}

# S3 buckets for storage and logging
module "s3" {
  source = "./modules/s3"
  count  = var.cloud_provider == "aws" ? 1 : 0
  
  name_prefix = local.name_prefix
  environment = var.environment
  
  tags = local.common_tags
}

# Azure Database for PostgreSQL (if using Azure)
module "azure_database" {
  source = "./modules/azure-database"
  count  = var.cloud_provider == "azure" ? 1 : 0
  
  name                = "${local.name_prefix}-postgres"
  resource_group_name = var.azure_resource_group
  location           = var.azure_location
  
  server_version = "15"
  sku_name      = var.azure_db_sku_name
  storage_mb    = var.azure_db_storage_mb
  
  administrator_login    = "quantum_admin"
  database_name         = "quantum_nlp"
  
  backup_retention_days = 30
  geo_redundant_backup_enabled = var.environment == "production"
  
  ssl_enforcement_enabled = true
  ssl_minimal_tls_version_enforced = "TLS1_2"
  
  tags = local.common_tags
}

# Azure Cache for Redis (if using Azure)
module "azure_redis" {
  source = "./modules/azure-redis"
  count  = var.cloud_provider == "azure" ? 1 : 0
  
  name                = "${local.name_prefix}-redis"
  resource_group_name = var.azure_resource_group
  location           = var.azure_location
  
  capacity = var.azure_redis_capacity
  family   = var.azure_redis_family
  sku_name = var.azure_redis_sku_name
  
  enable_non_ssl_port = false
  redis_version      = "6"
  
  tags = local.common_tags
}

# Monitoring and logging
module "monitoring" {
  source = "./modules/monitoring"
  
  name_prefix = local.name_prefix
  environment = var.environment
  
  # CloudWatch (AWS) or Azure Monitor configuration
  cloud_provider = var.cloud_provider
  
  tags = local.common_tags
}

# Cert-manager for TLS certificates
resource "helm_release" "cert_manager" {
  name       = "cert-manager"
  repository = "https://charts.jetstack.io"
  chart      = "cert-manager"
  version    = "v1.13.0"
  namespace  = "cert-manager"
  
  create_namespace = true
  
  set {
    name  = "installCRDs"
    value = "true"
  }
  
  depends_on = [
    module.eks,
    module.aks
  ]
}

# NGINX Ingress Controller
resource "helm_release" "nginx_ingress" {
  name       = "ingress-nginx"
  repository = "https://kubernetes.github.io/ingress-nginx"
  chart      = "ingress-nginx"
  version    = "4.7.1"
  namespace  = "ingress-nginx"
  
  create_namespace = true
  
  set {
    name  = "controller.service.type"
    value = "LoadBalancer"
  }
  
  set {
    name  = "controller.metrics.enabled"
    value = "true"
  }
  
  depends_on = [
    module.eks,
    module.aks
  ]
}

# External DNS (optional)
resource "helm_release" "external_dns" {
  count = var.enable_external_dns ? 1 : 0
  
  name       = "external-dns"
  repository = "https://kubernetes-sigs.github.io/external-dns"
  chart      = "external-dns"
  version    = "1.13.0"
  namespace  = "external-dns"
  
  create_namespace = true
  
  set {
    name  = "provider"
    value = var.dns_provider
  }
  
  set {
    name  = "domainFilters[0]"
    value = var.dns_domain
  }
  
  depends_on = [
    module.eks,
    module.aks
  ]
}