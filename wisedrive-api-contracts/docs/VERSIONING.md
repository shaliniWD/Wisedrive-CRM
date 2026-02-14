# API Versioning Policy

## Version Format

All Wisedrive APIs follow semantic versioning:

```
/v{major}
```

Example: `/v1/employees`, `/v2/employees`

## Version Lifecycle

### Active Versions
| Version | Status | Deprecation Date | Sunset Date |
|---------|--------|------------------|-------------|
| v1 | **Current** | - | - |

### Version States

1. **Current**: Latest stable version, recommended for all new integrations
2. **Deprecated**: Still functional but will be removed. Migration required.
3. **Sunset**: No longer available

## Breaking vs Non-Breaking Changes

### Non-Breaking Changes (Same Version)
✅ Can be deployed to current version:
- Adding new optional fields to responses
- Adding new optional parameters to requests
- Adding new endpoints
- Adding new enum values (with safe defaults)
- Improving error messages
- Performance improvements
- Bug fixes

### Breaking Changes (New Version Required)
❌ Requires new version:
- Removing fields from responses
- Renaming fields
- Changing field types
- Making optional fields required
- Removing endpoints
- Changing authentication mechanism
- Changing error response format
- Removing enum values

## Version Migration Process

### For API Consumers

1. **Monitor Deprecation Headers**
   ```
   X-API-Deprecated: true
   X-API-Sunset-Date: 2026-06-01
   X-API-Migration-Guide: https://docs.wisedrive.com/migration/v1-to-v2
   ```

2. **Review Migration Guide**
   - Field mappings
   - New requirements
   - Code examples

3. **Test in Sandbox**
   - Use test environment with new version
   - Validate all integrations

4. **Deploy**
   - Update API version in production
   - Monitor for issues

### For API Providers

1. **Document Changes**
   - Changelog entry
   - Migration guide
   - Breaking change notice

2. **Implement New Version**
   - Create new version endpoint
   - Maintain backward compatibility during transition

3. **Notify Consumers**
   - Email notification
   - In-app notification
   - API deprecation headers

4. **Support Period**
   - Minimum 3 months overlap
   - Extended support for major consumers

## Headers

### Request Headers
```
X-API-Version: 1  (optional, defaults to latest)
```

### Response Headers
```
X-API-Version: 1
X-API-Deprecated: false
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1699999999
```

## URL Structure

```
https://api.wisedrive.com/v1/{resource}
https://api.wisedrive.com/v2/{resource}  (future)
```

## Changelog

### v1.0.0 (Initial Release)
- Authentication (login, refresh, me)
- Employees (CRUD, salary, attendance, documents)
- Leads (CRUD, status update, reassignment)
- Customers (CRUD)
- Vehicles (CRUD, lookup)
- Inspections (CRUD, categories, assignment)
- OBD (sessions, DTC library)
- Payments (CRUD, Razorpay integration)
- Reports (list, detail, PDF)
- CarData (Invincible Ocean lookup)
