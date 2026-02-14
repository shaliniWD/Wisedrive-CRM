# Wisedrive API Contracts v1.0

## Overview

This repository serves as the **single source of truth** for all Wisedrive platform APIs. All applications must use contracts defined here to ensure consistency, backward compatibility, and governed evolution.

## Repository Structure

```
wisedrive-api-contracts/
├── openapi/                    # OpenAPI 3.0 specifications
│   ├── wisedrive-api-v1.yaml   # Main API specification
│   ├── auth-api-v1.yaml        # Authentication API
│   ├── crm-api-v1.yaml         # CRM operations
│   ├── inspection-api-v1.yaml  # Inspection operations
│   ├── obd-api-v1.yaml         # OBD integration
│   ├── payment-api-v1.yaml     # Payment operations
│   └── cardata-api-v1.yaml     # Vehicle data (Invincible Ocean)
├── schemas/                    # JSON Schema definitions
│   ├── entities/               # Core entity schemas
│   ├── requests/               # Request payload schemas
│   ├── responses/              # Response payload schemas
│   └── common/                 # Shared types and enums
├── examples/                   # Example payloads
├── docs/                       # Documentation
└── generated/                  # Auto-generated SDKs (gitignored)
```

## Entities Covered

| Entity | Description | Used By |
|--------|-------------|---------|
| Employee | Staff records, roles, departments | CRM, ESS, Dashboard |
| Role | RBAC definitions, permissions | All apps |
| Lead | Sales leads management | CRM, Website |
| Customer | Customer records | CRM, Website, Reports |
| Vehicle | Vehicle information | CRM, Inspection, Reports |
| Inspection | Inspection assignments & results | CRM, Mechanic App, Reports |
| OBDSession | OBD scan data | Mechanic App, Reports |
| DTC | Diagnostic Trouble Codes | Mechanic App, Reports |
| Payment | Payment transactions | Website, CRM |
| Order | Service orders | Website, CRM |
| Report | Inspection reports | Reports, CRM |
| CarData | External vehicle data | CRM, Inspection |

## API Versioning Policy

1. **Non-breaking changes** → Same version (v1)
   - Adding optional fields
   - Adding new endpoints
   - Adding new enum values (with defaults)

2. **Breaking changes** → New version (v2)
   - Removing fields
   - Changing field types
   - Changing required fields
   - Removing endpoints

3. **Deprecation Process**
   - Minimum 3-month notice
   - Deprecation header in responses
   - Documentation update
   - Migration guide provided

## Consumer Applications

| Application | Repository | Consumes |
|-------------|------------|----------|
| Website | Wisedrive-new-website-v2.0 | Auth, Payment, CarData |
| CRM Web | wisedrive-crm-web | All APIs |
| Mechanic App | Mechanic-app-new-v1.0 | Auth, Inspection, OBD |
| Inspection Report | wisedrive-new-inspeciton-report-v1.0 | Inspection, OBD, Customer |
| Dashboard RN | wisedrive-dashboard-rn | All APIs (read) |
| ESS RN | wisedrive-ess-rn | Auth, Employee |

## Governance Rules

1. **No silent changes** - All changes must be documented
2. **Backward compatibility** - Required for same version
3. **Impact analysis** - Required before modifying shared schemas
4. **Regression testing** - Mandatory for all changes
5. **Review process** - Contract changes need architecture approval

## SDK Generation

```bash
# Generate TypeScript SDK
npm run generate:typescript

# Generate Python SDK
npm run generate:python

# Generate Kotlin SDK (Android)
npm run generate:kotlin

# Generate Swift SDK (iOS)
npm run generate:swift
```

## Validation

```bash
# Validate all OpenAPI specs
npm run validate

# Run contract tests
npm run test:contracts
```
