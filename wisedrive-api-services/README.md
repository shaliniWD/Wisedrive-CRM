# Wisedrive API Services v1.0

## Architecture Overview

This repository implements the backend services for the Wisedrive platform following a **modular monolith** architecture with strict separation of concerns.

## Directory Structure

```
wisedrive-api-services/
├── main.py                     # Application entry point
├── config/                     # Configuration management
│   ├── __init__.py
│   ├── settings.py             # Environment-specific settings
│   └── database.py             # Database connection
├── controllers/                # HTTP layer (FastAPI routers)
│   ├── auth/                   # Authentication endpoints
│   ├── hr/                     # HR management endpoints
│   ├── crm/                    # CRM (leads, customers) endpoints
│   ├── inspection/             # Inspection endpoints
│   ├── obd/                    # OBD data endpoints
│   ├── payment/                # Payment endpoints
│   ├── report/                 # Report endpoints
│   ├── cardata/                # Vehicle data lookup endpoints
│   └── media/                  # Media upload endpoints
├── services/                   # Business logic layer
│   ├── auth/                   # Auth service
│   ├── hr/                     # HR service
│   ├── crm/                    # CRM service
│   ├── inspection/             # Inspection service
│   ├── obd/                    # OBD service
│   ├── payment/                # Payment service
│   ├── report/                 # Report service
│   ├── cardata/                # CarData service
│   └── media/                  # Media service
├── repositories/               # Data access layer
│   └── base.py                 # Base repository
├── integrations/               # External service integrations
│   ├── razorpay/               # Razorpay payment gateway
│   ├── invincible_ocean/       # Car data API
│   └── obd/                    # OBD SDK wrapper
├── middleware/                 # Request/response middleware
│   ├── auth.py                 # JWT authentication
│   ├── rbac.py                 # Role-based access control
│   └── logging.py              # Request logging
├── migrations/                 # Database migrations
│   └── versions/               # Migration scripts
└── utils/                      # Shared utilities
    ├── validators.py
    └── formatters.py
```

## Architecture Layers

### 1. Controller Layer (HTTP)
- Handles HTTP requests/responses
- Input validation using Pydantic
- Route definitions with FastAPI
- **NO business logic here**

### 2. Service Layer (Business Logic)
- Contains all business rules
- Orchestrates repository calls
- Handles transactions
- Calls external integrations

### 3. Repository Layer (Data Access)
- Database operations (CRUD)
- MongoDB queries
- Data serialization
- **NO business logic here**

### 4. Integration Layer (External APIs)
- Wraps external service SDKs
- Handles retries and errors
- Normalizes responses
- Caches where appropriate

## Service Boundaries

| Service | Responsibilities |
|---------|------------------|
| Auth | Login, JWT tokens, sessions, password reset |
| HR | Employees, attendance, salary, documents |
| CRM | Leads, customers, sales workflow |
| Inspection | Scheduling, assignment, categories, completion |
| OBD | OBD sessions, DTC codes, VIN decoding |
| Payment | Internal payments, external payments (Razorpay) |
| Report | Report generation, PDF creation |
| CarData | Vehicle lookup (Invincible Ocean) |
| Media | File uploads, CDN management |

## RBAC Enforcement

All endpoints enforce RBAC at the controller level:
1. JWT token validated in middleware
2. User permissions loaded from database
3. Permission check before service call
4. Data filtered by scope (all/country/team/own)

## Environment Configuration

| Environment | Database | CDN Bucket | API URL |
|-------------|----------|------------|---------|
| DEV | wisedrive_dev | dev-assets | api-dev.wisedrive.com |
| TEST | wisedrive_test | test-assets | api-test.wisedrive.com |
| PROD | wisedrive_prod | prod-assets | api.wisedrive.com |

## Migration from Monolith

The current `server.py` will be gradually migrated to this structure:
1. Create service interfaces
2. Extract business logic to services
3. Create repositories for data access
4. Move routes to controllers
5. Add integration wrappers
6. Enable feature flags for gradual rollout
