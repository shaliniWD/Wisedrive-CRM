# Wisedrive Platform - Deployment Architecture

## System Architecture Diagram

```
                                    ┌─────────────────────────────────────┐
                                    │           CLOUDFLARE DNS            │
                                    │        (DDoS Protection + CDN)      │
                                    └─────────────────┬───────────────────┘
                                                      │
                    ┌─────────────────────────────────┼─────────────────────────────────┐
                    │                                 │                                  │
                    ▼                                 ▼                                  ▼
         ┌──────────────────┐            ┌──────────────────┐            ┌──────────────────┐
         │ www.wisedrive.com│            │ api.wisedrive.com│            │ crm.wisedrive.com│
         │    (Website)     │            │    (API Gateway) │            │     (CRM Web)    │
         └────────┬─────────┘            └────────┬─────────┘            └────────┬─────────┘
                  │                               │                               │
                  │                               │                               │
    ┌─────────────┴─────────────────────────────────────────────────────────────┴─────────────┐
    │                                                                                          │
    │                              EMERGENT KUBERNETES CLUSTER                                 │
    │                                                                                          │
    │  ┌─────────────────────────────────────────────────────────────────────────────────┐   │
    │  │                              INGRESS CONTROLLER                                  │   │
    │  │                         (NGINX + SSL Termination)                               │   │
    │  └─────────────────────────────────────────────────────────────────────────────────┘   │
    │                                         │                                               │
    │           ┌─────────────────────────────┼─────────────────────────────┐                │
    │           │                             │                             │                │
    │           ▼                             ▼                             ▼                │
    │  ┌─────────────────┐          ┌─────────────────┐          ┌─────────────────┐       │
    │  │   Website Pod   │          │ API Services Pod│          │   CRM Web Pod   │       │
    │  │  (React SSR)    │          │   (FastAPI)     │          │    (React)      │       │
    │  │                 │          │                 │          │                 │       │
    │  │  Replicas: 2    │          │  Replicas: 3    │          │  Replicas: 2    │       │
    │  │  CPU: 0.5       │          │  CPU: 1.0       │          │  CPU: 0.5       │       │
    │  │  RAM: 512MB     │          │  RAM: 1GB       │          │  RAM: 512MB     │       │
    │  └─────────────────┘          └────────┬────────┘          └─────────────────┘       │
    │                                        │                                              │
    │                                        │                                              │
    │  ┌─────────────────────────────────────┼─────────────────────────────────────────┐  │
    │  │                           INTERNAL SERVICES                                    │  │
    │  │                                                                                │  │
    │  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │  │
    │  │  │  Auth Svc    │  │  RBAC Svc    │  │  Queue Svc   │  │  Cache Svc   │      │  │
    │  │  │  (JWT)       │  │              │  │  (Redis)     │  │  (Redis)     │      │  │
    │  │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘      │  │
    │  │                                                                                │  │
    │  └────────────────────────────────────────────────────────────────────────────────┘  │
    │                                                                                       │
    └───────────────────────────────────────────────────────────────────────────────────────┘
                                              │
                    ┌─────────────────────────┼─────────────────────────┐
                    │                         │                         │
                    ▼                         ▼                         ▼
         ┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
         │   MongoDB Atlas  │      │   Emergent CDN   │      │ External APIs    │
         │   (Database)     │      │   (Media Store)  │      │                  │
         │                  │      │                  │      │ - Razorpay       │
         │ - wisedrive_dev  │      │ - dev-assets     │      │ - Invincible     │
         │ - wisedrive_test │      │ - test-assets    │      │   Ocean          │
         │ - wisedrive_prod │      │ - prod-assets    │      │ - SMS Gateway    │
         └──────────────────┘      └──────────────────┘      └──────────────────┘
```

## Server Specifications

### API Services (FastAPI)

| Environment | Pods | CPU/Pod | RAM/Pod | Total Resources |
|-------------|------|---------|---------|-----------------|
| DEV | 1 | 0.5 vCPU | 512 MB | 0.5 vCPU, 512 MB |
| TEST | 2 | 0.5 vCPU | 512 MB | 1.0 vCPU, 1 GB |
| PROD | 3 | 1.0 vCPU | 1 GB | 3.0 vCPU, 3 GB |

### Web Applications (React)

| Application | Environment | Pods | CPU/Pod | RAM/Pod |
|-------------|-------------|------|---------|---------|
| CRM Web | PROD | 2 | 0.5 vCPU | 512 MB |
| Website | PROD | 2 | 0.5 vCPU | 512 MB |
| Dashboard | PROD | 2 | 0.25 vCPU | 256 MB |

### Database (MongoDB Atlas)

| Environment | Cluster Tier | vCPU | RAM | Storage | IOPS |
|-------------|--------------|------|-----|---------|------|
| DEV | M10 | 2 | 2 GB | 10 GB | 100 |
| TEST | M10 | 2 | 2 GB | 10 GB | 100 |
| PROD | M30 | 2 | 8 GB | 40 GB | 3000 |

### Scaling Thresholds

| Metric | Scale Up | Scale Down |
|--------|----------|------------|
| CPU | > 70% for 5 min | < 30% for 10 min |
| Memory | > 80% | < 40% |
| Request rate | > 1000/min | < 200/min |

## Backup Strategy

### Database Backups

```
┌─────────────────────────────────────────────────────────────────┐
│                    BACKUP SCHEDULE                               │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ CONTINUOUS BACKUP (PROD)                                    │ │
│  │                                                             │ │
│  │  Point-in-Time Recovery: Last 7 days                       │ │
│  │  Snapshot Interval: Every 6 hours                          │ │
│  │  Retention: 30 days                                        │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ DAILY BACKUP (ALL ENVIRONMENTS)                            │ │
│  │                                                             │ │
│  │  Time: 02:00 UTC                                           │ │
│  │  Retention: DEV=7 days, TEST=14 days, PROD=90 days        │ │
│  │  Storage: Cross-region (ap-south-1 → ap-southeast-1)       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ WEEKLY FULL BACKUP (PROD)                                  │ │
│  │                                                             │ │
│  │  Day: Sunday 03:00 UTC                                     │ │
│  │  Retention: 1 year                                         │ │
│  │  Storage: Cold storage (Glacier equivalent)                │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Backup Components

| Component | Frequency | Retention | Location |
|-----------|-----------|-----------|----------|
| MongoDB PROD | Continuous PITR | 7 days | Atlas |
| MongoDB PROD | Daily snapshot | 90 days | Atlas + S3 |
| MongoDB PROD | Weekly full | 1 year | S3 Glacier |
| MongoDB TEST | Daily snapshot | 14 days | Atlas |
| CDN Assets | Daily sync | 30 days | Cross-region |
| Config/Secrets | On change | Versioned | Vault |

### Restore Procedures

```bash
# Restore to point in time (PROD)
mongorestore --uri=$PROD_MONGO_URL \
  --oplogReplay \
  --oplogLimit="2026-02-14T10:00:00Z"

# Restore from daily snapshot
mongorestore --uri=$PROD_MONGO_URL \
  --archive=backup-2026-02-14.archive \
  --gzip

# Restore specific collection
mongorestore --uri=$PROD_MONGO_URL \
  --collection=users \
  --archive=backup-2026-02-14.archive
```

## Log Monitoring Strategy

### Log Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      LOG FLOW                                    │
│                                                                  │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐  │
│  │ App Pods │───►│ Fluentd  │───►│ Elastic  │───►│ Kibana   │  │
│  │ (stdout) │    │ (DaemonSet)   │ Search   │    │ Dashboard│  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘  │
│       │                                               │         │
│       │                                               │         │
│       ▼                                               ▼         │
│  ┌──────────┐                                   ┌──────────┐   │
│  │ Metrics  │──────────────────────────────────►│ Grafana  │   │
│  │(Prometheus)                                  │ Dashboard│   │
│  └──────────┘                                   └──────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Log Levels

| Level | Usage | Retention |
|-------|-------|-----------|
| ERROR | Errors requiring attention | 90 days |
| WARN | Potential issues | 30 days |
| INFO | General operations | 14 days |
| DEBUG | Debugging (DEV only) | 7 days |

### Alerts Configuration

| Alert | Condition | Severity | Channel |
|-------|-----------|----------|---------|
| Error rate spike | > 1% errors in 5 min | Critical | PagerDuty |
| High latency | p99 > 2s for 5 min | High | Slack #ops |
| Pod restart | Any restart | Medium | Slack #ops |
| Database connection | Connection errors | Critical | PagerDuty |
| Memory pressure | > 90% for 10 min | High | Slack #ops |
| Disk space | < 20% free | Medium | Slack #ops |

### Log Queries

```
# Find all errors in last hour
level:ERROR AND @timestamp:[now-1h TO now]

# Track specific user's requests
user_id:"abc123" AND @timestamp:[now-1d TO now]

# API latency issues
path:"/api/*" AND response_time_ms:>1000

# Failed payments
path:"/api/payments/*" AND status_code:>=400
```

## Rollback Plan

### Deployment Rollback Matrix

| Scenario | Detection | Rollback Method | Time |
|----------|-----------|-----------------|------|
| Failed deployment | CI/CD health check | Automatic | 30 sec |
| Post-deploy errors | Error rate alert | Manual trigger | 2 min |
| Performance degradation | Latency alert | Manual trigger | 2 min |
| Data corruption | Data validation | Restore backup | 15-30 min |

### Rollback Commands

```bash
# Immediate rollback to previous version
kubectl rollout undo deployment/api-services -n production

# Rollback to specific revision
kubectl rollout undo deployment/api-services --to-revision=5 -n production

# Check rollback status
kubectl rollout status deployment/api-services -n production

# View rollback history
kubectl rollout history deployment/api-services -n production
```

### Database Rollback

```bash
# Migration rollback
python -m migrations rollback --version 004

# Point-in-time recovery (if data corruption)
# 1. Stop application
kubectl scale deployment/api-services --replicas=0 -n production

# 2. Restore database to point before issue
# (Via MongoDB Atlas console or CLI)

# 3. Verify data integrity
python scripts/verify_data_integrity.py

# 4. Restart application
kubectl scale deployment/api-services --replicas=3 -n production
```

## Expected Downtime

### Planned Maintenance

| Operation | Expected Downtime | Window |
|-----------|-------------------|--------|
| Code deployment | 0 (rolling update) | Any time |
| Database migration (non-breaking) | 0 | Any time |
| Database migration (breaking) | 5-15 min | Maintenance window |
| Kubernetes upgrade | 0 (rolling) | Scheduled |
| Certificate renewal | 0 (automatic) | N/A |

### Maintenance Windows

```
PRODUCTION MAINTENANCE WINDOWS:
- Primary: Sunday 02:00-06:00 UTC (India: 07:30-11:30 IST)
- Emergency: Any time with owner approval

COMMUNICATION:
- 48 hours notice for planned maintenance
- Status page update at maintenance start
- Completion notification to all stakeholders
```

### Zero-Downtime Deployment Strategy

```yaml
# Kubernetes deployment strategy
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
      maxSurge: 1
  template:
    spec:
      containers:
        - name: api-services
          readinessProbe:
            httpGet:
              path: /health
              port: 8001
            initialDelaySeconds: 10
            periodSeconds: 5
          livenessProbe:
            httpGet:
              path: /health
              port: 8001
            initialDelaySeconds: 30
            periodSeconds: 10
```

## Disaster Recovery

### Recovery Time Objectives

| Scenario | RTO | RPO |
|----------|-----|-----|
| Pod failure | 30 seconds | 0 |
| Node failure | 2 minutes | 0 |
| Zone failure | 5 minutes | 0 |
| Region failure | 30 minutes | 1 hour |
| Complete data loss | 4 hours | 6 hours |

### DR Procedures

1. **Pod Failure**: Kubernetes auto-recovery
2. **Node Failure**: Kubernetes reschedules pods
3. **Zone Failure**: Multi-AZ deployment handles automatically
4. **Region Failure**: Manual failover to secondary region
5. **Data Loss**: Restore from latest backup
