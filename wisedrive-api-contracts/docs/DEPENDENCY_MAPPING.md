# Wisedrive Platform - Dependency Mapping

## Repository Dependencies

This document defines which repositories depend on which API contracts and how changes propagate through the system.

## Dependency Graph

```
                    ┌─────────────────────────┐
                    │  wisedrive-api-contracts │
                    │    (Source of Truth)     │
                    └───────────┬─────────────┘
                                │
            ┌───────────────────┼───────────────────┐
            │                   │                   │
            ▼                   ▼                   ▼
    ┌───────────────┐   ┌───────────────┐   ┌───────────────┐
    │ wisedrive-api │   │   Generated   │   │   Generated   │
    │   -services   │   │   TypeScript  │   │    Kotlin     │
    │   (Backend)   │   │     SDK       │   │     SDK       │
    └───────┬───────┘   └───────┬───────┘   └───────┬───────┘
            │                   │                   │
            │           ┌───────┴───────┐           │
            │           │               │           │
            ▼           ▼               ▼           ▼
    ┌───────────┐ ┌───────────┐ ┌───────────────┐ ┌──────────────┐
    │  CRM Web  │ │  Website  │ │ Inspection    │ │ Mechanic App │
    │           │ │   v2.0    │ │ Report v1.0   │ │    v1.0      │
    └───────────┘ └───────────┘ └───────────────┘ └──────────────┘
```

## Entity Dependencies by Application

### wisedrive-crm-web
| Entity | Operations | Priority |
|--------|------------|----------|
| Employee | Full CRUD, Salary, Attendance, Documents | P0 |
| Lead | Full CRUD, Status, Reassign | P0 |
| Customer | Full CRUD | P0 |
| Vehicle | Full CRUD, Lookup | P0 |
| Inspection | Full CRUD, Assign, Categories | P0 |
| Payment | Full CRUD, Approve | P0 |
| Report | Read, Generate PDF | P1 |
| OBD | Read sessions | P1 |
| CarData | Lookup | P1 |

### Wisedrive-new-website-v2.0
| Entity | Operations | Priority |
|--------|------------|----------|
| Auth | Login, Register | P0 |
| Payment | Create Order, Verify | P0 |
| Vehicle | Lookup | P0 |
| Customer | Create | P1 |

### Mechanic-app-new-v1.0
| Entity | Operations | Priority |
|--------|------------|----------|
| Auth | Login | P0 |
| Inspection | Read assigned, Update, Complete | P0 |
| OBD | Create session, Read | P0 |
| Vehicle | Read | P1 |

### wisedrive-new-inspeciton-report-v1.0
| Entity | Operations | Priority |
|--------|------------|----------|
| Report | Read, Generate | P0 |
| Inspection | Read | P0 |
| OBD | Read session | P0 |
| Vehicle | Read | P1 |
| Customer | Read | P1 |

### wisedrive-dashboard-rn
| Entity | Operations | Priority |
|--------|------------|----------|
| All Entities | Read (Dashboard views) | P0 |
| Analytics | Aggregate queries | P0 |

### wisedrive-ess-rn (Employee Self Service)
| Entity | Operations | Priority |
|--------|------------|----------|
| Auth | Login | P0 |
| Employee | Read own, Update profile | P0 |
| Attendance | Mark, Read own | P0 |
| Payment | Read own | P1 |

## Change Impact Matrix

When a schema changes, the following applications need to be updated:

| Schema | CRM | Website | Mechanic | Report | Dashboard | ESS |
|--------|-----|---------|----------|--------|-----------|-----|
| Employee | ✓ | | | | ✓ | ✓ |
| Lead | ✓ | | | | ✓ | |
| Customer | ✓ | ✓ | | ✓ | ✓ | |
| Vehicle | ✓ | ✓ | ✓ | ✓ | ✓ | |
| Inspection | ✓ | | ✓ | ✓ | ✓ | |
| OBD | ✓ | | ✓ | ✓ | ✓ | |
| Payment | ✓ | ✓ | | | ✓ | ✓ |
| Report | ✓ | | | ✓ | ✓ | |
| CarData | ✓ | | | | | |

## CI/CD Triggers

### On Contract Change
1. Validate OpenAPI specs
2. Generate all SDKs
3. Run contract tests
4. Publish SDKs to package registry
5. Trigger dependent repo builds

### On SDK Update
1. Update SDK dependency in consuming app
2. Run integration tests
3. Deploy to DEV environment
4. Run regression tests

## Release Coordination

### Major Version Release (Breaking Changes)
1. **T-3 months**: Announce deprecation
2. **T-2 months**: New version available in DEV
3. **T-1 month**: New version available in TEST
4. **T-0**: Old version deprecated (still functional)
5. **T+3 months**: Old version sunset

### Minor Version Release (Non-Breaking)
1. Update contracts
2. Regenerate SDKs
3. Auto-update dependencies
4. Deploy across environments
