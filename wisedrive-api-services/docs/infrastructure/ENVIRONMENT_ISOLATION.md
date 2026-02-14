# Environment Isolation Strategy

## Overview

Wisedrive Platform maintains **completely isolated environments** with no shared resources between DEV, TEST, and PROD.

## Environment Matrix

| Component | DEV | TEST | PROD |
|-----------|-----|------|------|
| **API URL** | api-dev.wisedrive.com | api-test.wisedrive.com | api.wisedrive.com |
| **MongoDB** | wisedrive_dev (separate cluster) | wisedrive_test (separate cluster) | wisedrive_prod (separate cluster) |
| **CDN Bucket** | wisedrive-dev-assets | wisedrive-test-assets | wisedrive-prod-assets |
| **JWT Secret** | DEV_JWT_SECRET_xxx | TEST_JWT_SECRET_xxx | PROD_JWT_SECRET_xxx |
| **Razorpay** | Test Mode Keys | Test Mode Keys | Live Mode Keys |
| **Invincible Ocean** | Sandbox API | Sandbox API | Production API |

## ❌ Strictly Prohibited

- Sharing database credentials between environments
- Using PROD data in DEV/TEST
- Deploying directly to PROD without approval
- Hardcoding any secrets in code
- Using same JWT secret across environments

## Environment Variable Management

### Secret Storage Strategy

| Secret Type | Storage Method | Access Pattern |
|-------------|----------------|----------------|
| JWT_SECRET | Environment Variable (Emergent Secrets) | Injected at runtime |
| MONGO_URL | Environment Variable (Emergent Secrets) | Injected at runtime |
| RAZORPAY_KEY_ID | Environment Variable (Emergent Secrets) | Injected at runtime |
| RAZORPAY_KEY_SECRET | Environment Variable (Emergent Secrets) | Injected at runtime |
| INVINCIBLE_OCEAN_KEY | Environment Variable (Emergent Secrets) | Injected at runtime |
| CDN_ACCESS_KEY | Environment Variable (Emergent Secrets) | Injected at runtime |

### How Secrets Are Managed

```
┌─────────────────────────────────────────────────────────────────┐
│                    EMERGENT SECRETS MANAGER                      │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ DEV Secrets │  │ TEST Secrets│  │ PROD Secrets│              │
│  │             │  │             │  │             │              │
│  │ JWT_SECRET  │  │ JWT_SECRET  │  │ JWT_SECRET  │              │
│  │ MONGO_URL   │  │ MONGO_URL   │  │ MONGO_URL   │              │
│  │ RAZORPAY_*  │  │ RAZORPAY_*  │  │ RAZORPAY_*  │              │
│  │ ...         │  │ ...         │  │ ...         │              │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                │                │                      │
└─────────┼────────────────┼────────────────┼─────────────────────┘
          │                │                │
          ▼                ▼                ▼
    ┌──────────┐     ┌──────────┐     ┌──────────┐
    │ DEV Pod  │     │ TEST Pod │     │ PROD Pod │
    │ (K8s)    │     │ (K8s)    │     │ (K8s)    │
    └──────────┘     └──────────┘     └──────────┘
```

### Secret Injection Process

1. **Never in code**: Secrets are NEVER committed to git
2. **Environment-specific**: Each environment has its own secret set
3. **Runtime injection**: Secrets injected via Kubernetes secrets/ConfigMaps
4. **Rotation support**: Secrets can be rotated without code changes
5. **Audit logging**: All secret access is logged

## CDN Bucket Isolation

### Bucket Structure

```
wisedrive-dev-assets/
├── uploads/
│   ├── inspection-photos/
│   ├── employee-documents/
│   └── payment-proofs/
├── reports/
│   └── generated-pdfs/
└── temp/

wisedrive-test-assets/
├── uploads/
│   ├── inspection-photos/
│   ├── employee-documents/
│   └── payment-proofs/
├── reports/
│   └── generated-pdfs/
└── temp/

wisedrive-prod-assets/
├── uploads/
│   ├── inspection-photos/
│   ├── employee-documents/
│   └── payment-proofs/
├── reports/
│   └── generated-pdfs/
└── temp/
```

### CDN Access Rules

| Environment | Read Access | Write Access | Public Access |
|-------------|-------------|--------------|---------------|
| DEV | Dev team only | Dev team only | None |
| TEST | QA team | QA + Dev team | None |
| PROD | Authenticated users | API only | Signed URLs |

## Database Isolation

### MongoDB Cluster Configuration

```yaml
# DEV Cluster
cluster_name: wisedrive-dev-cluster
region: ap-south-1
tier: M10 (shared)
backup: Daily
encryption: At rest

# TEST Cluster  
cluster_name: wisedrive-test-cluster
region: ap-south-1
tier: M10 (shared)
backup: Daily
encryption: At rest

# PROD Cluster
cluster_name: wisedrive-prod-cluster
region: ap-south-1
tier: M30 (dedicated)
backup: Continuous + PITR
encryption: At rest + In transit
replicas: 3
```

### Connection Strings (Template)

```bash
# DEV
MONGO_URL=mongodb+srv://dev-user:${DEV_DB_PASSWORD}@wisedrive-dev-cluster.mongodb.net/wisedrive_dev

# TEST
MONGO_URL=mongodb+srv://test-user:${TEST_DB_PASSWORD}@wisedrive-test-cluster.mongodb.net/wisedrive_test

# PROD
MONGO_URL=mongodb+srv://prod-user:${PROD_DB_PASSWORD}@wisedrive-prod-cluster.mongodb.net/wisedrive_prod
```

## Environment Detection

The application detects environment via `ENVIRONMENT` variable:

```python
# config/settings.py
class Environment(str, Enum):
    DEV = "dev"
    TEST = "test"
    PROD = "prod"

# Set via environment variable
ENVIRONMENT=dev   # or test, prod
```

## Verification Checklist

Before any deployment, verify:

- [ ] Environment variable `ENVIRONMENT` is set correctly
- [ ] MONGO_URL points to correct cluster
- [ ] JWT_SECRET is environment-specific
- [ ] CDN bucket matches environment
- [ ] Razorpay keys are test/live as appropriate
- [ ] No PROD data copied to lower environments
- [ ] All secrets injected (not hardcoded)
