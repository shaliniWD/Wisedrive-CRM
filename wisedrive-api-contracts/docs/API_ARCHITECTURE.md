# Wisedrive Platform - API Architecture

## Overview

This document describes the API architecture for the Wisedrive platform, following contract-first development principles.

## Architecture Principles

### 1. Contract-First Development
- All APIs are defined in OpenAPI 3.0 specifications first
- Backend and frontend implementations are generated/derived from contracts
- No direct database-to-API exposure without contract definition

### 2. Single Source of Truth
- `wisedrive-api-contracts` repository is the authoritative source
- All consuming applications use generated SDKs
- Changes flow: Contract → SDK → Application

### 3. Backend Abstraction
- External services (Razorpay, Invincible Ocean) are NEVER called from frontend
- All external calls go through `wisedrive-api-services`
- Response normalization happens server-side

### 4. Multi-tenancy by Design
- Country-level data isolation
- Role-based access control (RBAC)
- Data filtered at API level, not frontend

## API Layers

```
┌─────────────────────────────────────────────────────────────────┐
│                       CLIENT APPLICATIONS                        │
│  (CRM Web, Website, Mechanic App, Dashboard, ESS)               │
└─────────────────────────────────────────────────────────────────┘
                               │
                               │ Generated SDK
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY / LOAD BALANCER                 │
│                    (api.wisedrive.com)                          │
├─────────────────────────────────────────────────────────────────┤
│  • Authentication (JWT validation)                              │
│  • Rate limiting                                                 │
│  • Request logging                                               │
│  • CORS handling                                                 │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API SERVICES LAYER                           │
│                  (wisedrive-api-services)                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ Auth Service │ │ CRM Service  │ │ HR Service   │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ Inspection   │ │ OBD Service  │ │ Payment      │             │
│  │ Service      │ │              │ │ Service      │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
│                                                                  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐             │
│  │ Report       │ │ CarData      │ │ Media        │             │
│  │ Service      │ │ Service      │ │ Service      │             │
│  └──────────────┘ └──────────────┘ └──────────────┘             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │   Database   │  │   External   │  │   CDN        │
    │   MongoDB    │  │   APIs       │  │   Emergent   │
    │              │  │              │  │              │
    │ • Users      │  │ • Razorpay   │  │ • Images     │
    │ • Leads      │  │ • Invincible │  │ • Videos     │
    │ • Customers  │  │   Ocean      │  │ • Documents  │
    │ • Vehicles   │  │ • OBD Lib    │  │ • Reports    │
    │ • Inspections│  │              │  │              │
    │ • OBD Data   │  │              │  │              │
    └──────────────┘  └──────────────┘  └──────────────┘
```

## Service Boundaries

### Auth Service
- User authentication (login, logout)
- Token management (issue, refresh, revoke)
- Session tracking
- Password reset

### CRM Service
- Lead management
- Customer management
- Sales workflow

### HR Service
- Employee management
- Attendance tracking
- Document management
- Salary structures

### Inspection Service
- Inspection scheduling
- Mechanic assignment
- Category management
- Inspection completion

### OBD Service
- OBD session storage
- DTC management
- VIN decoding
- Analytics

### Payment Service
- Internal payments (salary, vendor)
- External payments (Razorpay)
- Reconciliation
- Refunds

### Report Service
- Report generation
- PDF creation
- Report storage

### CarData Service
- Invincible Ocean integration
- Response caching
- Data normalization

### Media Service
- File upload
- CDN management
- Thumbnail generation

## Authentication Flow

```
┌────────┐          ┌─────────┐          ┌──────────┐
│ Client │          │   API   │          │   Auth   │
│  App   │          │ Gateway │          │ Service  │
└───┬────┘          └────┬────┘          └────┬─────┘
    │                    │                    │
    │ 1. Login Request   │                    │
    │ ─────────────────► │                    │
    │                    │ 2. Validate        │
    │                    │ ─────────────────► │
    │                    │                    │
    │                    │ 3. JWT + Refresh   │
    │                    │ ◄───────────────── │
    │ 4. Tokens          │                    │
    │ ◄───────────────── │                    │
    │                    │                    │
    │ 5. API Request     │                    │
    │ + Bearer Token     │                    │
    │ ─────────────────► │                    │
    │                    │                    │
    │                    │ 6. Validate JWT    │
    │                    │ (local or cache)   │
    │                    │                    │
    │ 7. Response        │                    │
    │ ◄───────────────── │                    │
```

## External Integration Pattern

All external services follow this pattern:

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│   Client    │     │  Wisedrive   │     │  External    │
│    App      │     │    API       │     │   Service    │
└──────┬──────┘     └──────┬───────┘     └──────┬───────┘
       │                   │                    │
       │ 1. Request        │                    │
       │ ─────────────────►│                    │
       │                   │                    │
       │                   │ 2. Check Cache     │
       │                   │ (if applicable)    │
       │                   │                    │
       │                   │ 3. External Call   │
       │                   │ ─────────────────► │
       │                   │                    │
       │                   │ 4. Raw Response    │
       │                   │ ◄───────────────── │
       │                   │                    │
       │                   │ 5. Normalize       │
       │                   │    Store           │
       │                   │    Log             │
       │                   │                    │
       │ 6. Normalized     │                    │
       │    Response       │                    │
       │ ◄─────────────────│                    │
```

## Error Handling

### Standard Error Response
```json
{
  "code": "RESOURCE_NOT_FOUND",
  "message": "Lead with ID xyz not found",
  "details": {
    "resource": "lead",
    "id": "xyz"
  }
}
```

### Error Codes
| Code | HTTP Status | Description |
|------|-------------|-------------|
| VALIDATION_ERROR | 400 | Request validation failed |
| UNAUTHORIZED | 401 | Authentication required |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT | 409 | Resource conflict |
| RATE_LIMITED | 429 | Too many requests |
| INTERNAL_ERROR | 500 | Server error |
| SERVICE_UNAVAILABLE | 503 | External service down |

## Rate Limiting

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Standard | 100 | 1 minute |
| Bulk operations | 10 | 1 minute |
| File uploads | 20 | 1 minute |
| External lookups | 30 | 1 minute |

## Caching Strategy

| Data Type | Cache Duration | Invalidation |
|-----------|----------------|--------------|
| User profile | 5 minutes | On update |
| Permissions | 5 minutes | On role change |
| Vehicle lookup | 24 hours | Manual |
| DTC library | 7 days | On update |
| Static data | 24 hours | Deploy |
