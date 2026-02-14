# Kubernetes Deployment Configuration

## 1. Namespace Isolation Strategy

**Answer: Separate Namespaces within Shared Cluster**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EMERGENT KUBERNETES CLUSTER                               │
│                                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │  namespace: wd-dev  │  │ namespace: wd-test  │  │ namespace: wd-prod  │  │
│  │                     │  │                     │  │                     │  │
│  │  ┌───────────────┐  │  │  ┌───────────────┐  │  │  ┌───────────────┐  │  │
│  │  │ api-services  │  │  │  │ api-services  │  │  │  │ api-services  │  │  │
│  │  │ replicas: 1   │  │  │  │ replicas: 2   │  │  │  │ replicas: 3   │  │  │
│  │  └───────────────┘  │  │  └───────────────┘  │  │  └───────────────┘  │  │
│  │                     │  │                     │  │                     │  │
│  │  ┌───────────────┐  │  │  ┌───────────────┐  │  │  ┌───────────────┐  │  │
│  │  │  crm-web      │  │  │  │  crm-web      │  │  │  │  crm-web      │  │  │
│  │  │  replicas: 1  │  │  │  │  replicas: 1  │  │  │  │  replicas: 2  │  │  │
│  │  └───────────────┘  │  │  └───────────────┘  │  │  └───────────────┘  │  │
│  │                     │  │                     │  │                     │  │
│  │  ConfigMap: dev     │  │  ConfigMap: test    │  │  ConfigMap: prod    │  │
│  │  Secrets: dev       │  │  Secrets: test      │  │  Secrets: prod      │  │
│  │                     │  │                     │  │                     │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
│                                                                              │
│  Network Policies: No cross-namespace communication allowed                  │
│  Resource Quotas: Enforced per namespace                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Namespace Configuration

```yaml
# namespaces.yaml
---
apiVersion: v1
kind: Namespace
metadata:
  name: wd-dev
  labels:
    environment: dev
    team: wisedrive
---
apiVersion: v1
kind: Namespace
metadata:
  name: wd-test
  labels:
    environment: test
    team: wisedrive
---
apiVersion: v1
kind: Namespace
metadata:
  name: wd-prod
  labels:
    environment: prod
    team: wisedrive
```

### Network Policy (Namespace Isolation)

```yaml
# network-policy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: deny-cross-namespace
  namespace: wd-prod
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              environment: prod
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              environment: prod
    - to:  # Allow external (DB, CDN, APIs)
        - ipBlock:
            cidr: 0.0.0.0/0
            except:
              - 10.0.0.0/8  # Block internal cross-namespace
```

---

## 2. Automatic DB Backup Before PROD Migration

**Answer: YES - Mandatory automatic backup before any PROD migration**

```yaml
# migration-job.yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: db-migration-${VERSION}
  namespace: wd-prod
spec:
  template:
    spec:
      initContainers:
        # STEP 1: Create backup BEFORE migration
        - name: pre-migration-backup
          image: mongo:6.0
          command:
            - /bin/sh
            - -c
            - |
              echo "Creating pre-migration backup..."
              mongodump --uri="${MONGO_URL}" \
                --archive=/backups/pre-migration-$(date +%Y%m%d-%H%M%S).archive \
                --gzip
              
              # Verify backup was created
              if [ $? -ne 0 ]; then
                echo "ERROR: Backup failed. Aborting migration."
                exit 1
              fi
              
              echo "Backup completed successfully."
          env:
            - name: MONGO_URL
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: MONGO_URL
          volumeMounts:
            - name: backup-volume
              mountPath: /backups
      
      containers:
        # STEP 2: Run migration only after backup succeeds
        - name: run-migration
          image: wisedrive/api-services:${VERSION}
          command:
            - python
            - -m
            - migrations
            - up
            - --version=${MIGRATION_VERSION}
          env:
            - name: MONGO_URL
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: MONGO_URL
            - name: ENVIRONMENT
              value: "prod"
      
      restartPolicy: Never
      volumes:
        - name: backup-volume
          persistentVolumeClaim:
            claimName: migration-backups-pvc
```

### Backup Verification Script

```python
# scripts/verify_backup.py
async def verify_backup_before_migration():
    """Verify backup exists and is valid before migration"""
    
    # 1. Check backup was created in last 5 minutes
    latest_backup = await get_latest_backup()
    if not latest_backup:
        raise MigrationError("No backup found. Aborting.")
    
    backup_age = datetime.now() - latest_backup.created_at
    if backup_age > timedelta(minutes=5):
        raise MigrationError(f"Backup too old: {backup_age}. Create fresh backup.")
    
    # 2. Verify backup integrity
    if not await verify_backup_integrity(latest_backup):
        raise MigrationError("Backup integrity check failed.")
    
    # 3. Log backup details for audit
    await log_audit(
        action="pre_migration_backup_verified",
        backup_id=latest_backup.id,
        size=latest_backup.size,
        collections=latest_backup.collections
    )
    
    return True
```

---

## 3. Horizontal Pod Autoscaling (HPA)

**Answer: YES - HPA enabled for production**

```yaml
# hpa-api-services.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-services-hpa
  namespace: wd-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-services
  
  # Scaling limits
  minReplicas: 3
  maxReplicas: 10
  
  metrics:
    # Scale on CPU
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    
    # Scale on Memory
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
    
    # Scale on request rate (custom metric)
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "100"
  
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
        - type: Percent
          value: 50
          periodSeconds: 60
      selectPolicy: Max
    
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120
      selectPolicy: Min
```

### HPA for Web Applications

```yaml
# hpa-crm-web.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: crm-web-hpa
  namespace: wd-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: crm-web
  minReplicas: 2
  maxReplicas: 6
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---

## 4. Maximum Pod Scaling Limits

**Answer: Defined per service with resource quotas**

### Per-Service Limits

| Service | Min Pods | Max Pods | CPU/Pod | Memory/Pod | Max Total CPU | Max Total Memory |
|---------|----------|----------|---------|------------|---------------|------------------|
| api-services | 3 | 10 | 1 vCPU | 1 GB | 10 vCPU | 10 GB |
| crm-web | 2 | 6 | 0.5 vCPU | 512 MB | 3 vCPU | 3 GB |
| website | 2 | 6 | 0.5 vCPU | 512 MB | 3 vCPU | 3 GB |
| dashboard | 2 | 4 | 0.25 vCPU | 256 MB | 1 vCPU | 1 GB |

### Namespace Resource Quotas

```yaml
# resource-quota-prod.yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: prod-quota
  namespace: wd-prod
spec:
  hard:
    # Pod limits
    pods: "40"
    
    # CPU limits
    requests.cpu: "20"
    limits.cpu: "30"
    
    # Memory limits
    requests.memory: "20Gi"
    limits.memory: "30Gi"
    
    # Storage limits
    requests.storage: "100Gi"
    persistentvolumeclaims: "10"
```

### Limit Ranges (Per Pod)

```yaml
# limit-range-prod.yaml
apiVersion: v1
kind: LimitRange
metadata:
  name: prod-limits
  namespace: wd-prod
spec:
  limits:
    - type: Pod
      max:
        cpu: "2"
        memory: "2Gi"
      min:
        cpu: "100m"
        memory: "128Mi"
    - type: Container
      default:
        cpu: "500m"
        memory: "512Mi"
      defaultRequest:
        cpu: "250m"
        memory: "256Mi"
      max:
        cpu: "2"
        memory: "2Gi"
      min:
        cpu: "100m"
        memory: "128Mi"
```

---

## 5. Rate Limiting at API Gateway Level

**Answer: YES - Configured at NGINX Ingress Controller**

```yaml
# ingress-with-rate-limit.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-services-ingress
  namespace: wd-prod
  annotations:
    # Rate limiting annotations
    nginx.ingress.kubernetes.io/limit-rps: "100"
    nginx.ingress.kubernetes.io/limit-rpm: "1000"
    nginx.ingress.kubernetes.io/limit-connections: "50"
    
    # Rate limit response
    nginx.ingress.kubernetes.io/limit-rate-after: "10m"
    nginx.ingress.kubernetes.io/limit-rate: "1000"
    
    # Custom error page for rate limit
    nginx.ingress.kubernetes.io/server-snippet: |
      limit_req_status 429;
      
    # Enable rate limit logging
    nginx.ingress.kubernetes.io/enable-access-log: "true"
    
    # SSL/TLS
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/force-ssl-redirect: "true"
    
    # Security headers
    nginx.ingress.kubernetes.io/configuration-snippet: |
      add_header X-Frame-Options "SAMEORIGIN" always;
      add_header X-Content-Type-Options "nosniff" always;
      add_header X-XSS-Protection "1; mode=block" always;
      
spec:
  ingressClassName: nginx
  tls:
    - hosts:
        - api.wisedrive.com
      secretName: wisedrive-tls
  rules:
    - host: api.wisedrive.com
      http:
        paths:
          - path: /api
            pathType: Prefix
            backend:
              service:
                name: api-services
                port:
                  number: 8001
```

### Rate Limit Configuration Map

```yaml
# rate-limit-configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: nginx-rate-limit-config
  namespace: ingress-nginx
data:
  # Global rate limits
  limit-req-zone: |
    $binary_remote_addr zone=global_limit:10m rate=100r/s;
    $binary_remote_addr zone=api_limit:10m rate=50r/s;
    $binary_remote_addr zone=upload_limit:10m rate=10r/s;
  
  # Burst handling
  limit-req-burst: "20"
  limit-req-nodelay: "true"
  
  # Connection limits
  limit-conn-zone: "$binary_remote_addr zone=conn_limit:10m"
  limit-conn: "50"
```

### Endpoint-Specific Rate Limits

| Endpoint Pattern | Rate Limit | Burst | Notes |
|-----------------|------------|-------|-------|
| `/api/auth/*` | 10/min | 5 | Prevent brute force |
| `/api/leads` | 100/min | 20 | Standard |
| `/api/payments/*` | 30/min | 5 | Sensitive |
| `/api/*/upload` | 20/min | 5 | File uploads |
| `/api/cardata/*` | 30/min | 10 | External API calls |
| `*` (default) | 100/min | 20 | Fallback |

---

## Summary Confirmation

| Question | Answer | Configuration |
|----------|--------|---------------|
| 1. Namespace isolation | ✅ Separate namespaces (`wd-dev`, `wd-test`, `wd-prod`) | Network policies block cross-namespace |
| 2. Auto backup before PROD migration | ✅ YES - Mandatory init container | Backup verified before migration runs |
| 3. HPA enabled | ✅ YES - CPU, Memory, Request rate | Configured per service |
| 4. Max pod scaling limit | ✅ api-services: 10, crm-web: 6 | Resource quotas enforced |
| 5. Rate limiting at gateway | ✅ YES - NGINX Ingress | 100 rps default, endpoint-specific |
