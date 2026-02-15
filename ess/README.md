# WiseDrive ESS Mobile API

Employee Self-Service (ESS) Mobile API for WiseDrive.

## Overview

This is a **separate, independent API** designed specifically for the WiseDrive mobile application. It provides employees with self-service capabilities while maintaining complete separation from the main CRM API.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     WiseDrive Platform                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────┐           ┌──────────────────────────────┐│
│  │   CRM Web App    │           │      ESS Mobile App          ││
│  │  (React + CRM    │           │   (React Native / Flutter)   ││
│  │   Backend API)   │           │                              ││
│  └────────┬─────────┘           └────────────┬─────────────────┘│
│           │                                   │                  │
│           ▼                                   ▼                  │
│  ┌──────────────────┐           ┌──────────────────────────────┐│
│  │   CRM Backend    │           │      ESS Backend API         ││
│  │   (FastAPI)      │           │      (FastAPI - Separate)    ││
│  │   Port: 8001     │           │      Port: 8002              ││
│  └────────┬─────────┘           └────────────┬─────────────────┘│
│           │                                   │                  │
│           └───────────────┬───────────────────┘                  │
│                           │                                      │
│                           ▼                                      │
│                ┌────────────────────┐                            │
│                │     MongoDB        │                            │
│                │  (Shared Database) │                            │
│                └────────────────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Features

### 1. **Single Active Device Policy**
- Only one device can be logged in per user at a time
- New login invalidates all previous sessions
- Prevents unauthorized access from multiple devices

### 2. **Independent Release Cycle**
- ESS API can be updated without affecting CRM
- Mobile app updates don't require CRM changes
- Separate versioning (currently v1)

### 3. **Push Notifications**
- FCM (Firebase Cloud Messaging) for Android
- APNS (Apple Push Notification Service) for iOS
- User-configurable notification preferences
- Quiet hours support

### 4. **Contract-First Development**
- OpenAPI 3.0 specification at `/app/ess/docs/ess-api-v1.yaml`
- SDK generation support
- Stable API contracts

## API Modules

| Module | Description | Endpoints |
|--------|-------------|-----------|
| Auth | Mobile authentication with device management | `/ess/v1/auth/*` |
| Profile | Employee profile and personal info | `/ess/v1/profile/*` |
| Leave | Leave application and approval | `/ess/v1/leave/*` |
| Payslips | Salary and payslip access | `/ess/v1/payslips/*` |
| Documents | Employee document management | `/ess/v1/documents/*` |
| Notifications | Push and in-app notifications | `/ess/v1/notifications/*` |

## Project Structure

```
/app/ess/api/
├── main.py                 # FastAPI application entry point
├── .env                    # Environment configuration
├── requirements.txt        # Python dependencies
├── models/                 # Pydantic models
│   ├── auth.py            # Authentication models
│   ├── leave.py           # Leave management models
│   ├── profile.py         # Profile models
│   ├── payslip.py         # Payslip models
│   ├── document.py        # Document models
│   └── notification.py    # Notification models
├── routes/                 # API endpoints
│   ├── auth.py            # Authentication routes
│   ├── leave.py           # Leave routes
│   ├── profile.py         # Profile routes
│   ├── payslips.py        # Payslip routes
│   ├── documents.py       # Document routes
│   └── notifications.py   # Notification routes
├── services/               # Business logic
│   ├── notification_service.py    # In-app notifications
│   └── push_notification_service.py # FCM/APNS push
└── middleware/             # Request middleware
    └── device_session.py  # Device tracking
```

## Running the API

### Development

```bash
cd /app/ess/api
pip install -r requirements.txt
python main.py
```

The API will be available at:
- API: http://localhost:8002/ess/v1
- Docs: http://localhost:8002/ess/v1/docs
- ReDoc: http://localhost:8002/ess/v1/redoc

### Production

Add to supervisor configuration:

```ini
[program:ess-api]
command=uvicorn main:app --host 0.0.0.0 --port 8002
directory=/app/ess/api
autostart=true
autorestart=true
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGO_URL` | MongoDB connection string | Yes |
| `DB_NAME` | Database name | Yes |
| `JWT_SECRET` | Secret for JWT access tokens | Yes |
| `REFRESH_SECRET` | Secret for refresh tokens | Yes |
| `FCM_SERVER_KEY` | Firebase server key (push notifications) | No |
| `APNS_KEY_ID` | Apple key ID (iOS push) | No |
| `APNS_TEAM_ID` | Apple team ID (iOS push) | No |

## Authentication Flow

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  Mobile App │       │   ESS API   │       │   MongoDB   │
└──────┬──────┘       └──────┬──────┘       └──────┬──────┘
       │                     │                     │
       │  POST /auth/login   │                     │
       │  (email, password,  │                     │
       │   device_info)      │                     │
       │─────────────────────>                     │
       │                     │                     │
       │                     │  Invalidate old     │
       │                     │  sessions for user  │
       │                     │─────────────────────>
       │                     │                     │
       │                     │  Create new session │
       │                     │─────────────────────>
       │                     │                     │
       │  access_token,      │                     │
       │  refresh_token      │                     │
       │<─────────────────────                     │
       │                     │                     │
       │  Authenticated      │                     │
       │  requests with      │                     │
       │  Bearer token       │                     │
       │─────────────────────>                     │
       │                     │                     │
       │                     │  Validate session   │
       │                     │  is still active    │
       │                     │─────────────────────>
       │                     │                     │
```

## Data Sharing with CRM

The ESS API shares the same MongoDB database as the CRM. Collections used:

| Collection | CRM Access | ESS Access | Description |
|------------|------------|------------|-------------|
| `users` | Read/Write | Read | Employee data |
| `leave_requests` | Read/Write | Read/Write | Leave management |
| `payroll_records` | Write | Read | Payslip data |
| `employee_documents` | Read/Write | Read | Documents |
| `roles` | Read/Write | Read | Role info |
| `countries` | Read/Write | Read | Country config |
| `ess_device_sessions` | - | Read/Write | ESS only |
| `ess_refresh_tokens` | - | Read/Write | ESS only |
| `ess_push_tokens` | - | Read/Write | ESS only |
| `ess_notifications` | - | Read/Write | ESS only |
| `ess_notification_settings` | - | Read/Write | ESS only |

## Future Roadmap

### Phase 1: Foundation ✅ (Current)
- [x] ESS API project structure
- [x] Authentication with device management
- [x] API contract (OpenAPI spec)
- [x] Core modules (Profile, Leave, Payslips, Documents, Notifications)

### Phase 2: Push Notifications
- [ ] Integrate Firebase Admin SDK
- [ ] Implement APNS for iOS
- [ ] Add CRM triggers for notifications (leave approved, payslip ready)
- [ ] Notification templates in CRM

### Phase 3: Mobile App Development
- [ ] React Native / Flutter project setup
- [ ] Authentication screens
- [ ] Dashboard and navigation
- [ ] Leave management UI
- [ ] Payslip viewer
- [ ] Profile management
- [ ] Push notification handling

### Phase 4: CRM Integration
- [ ] Notification Configuration UI in CRM
- [ ] HR triggers for mobile notifications
- [ ] Mobile app version management
- [ ] Force update capability

## Testing

### Run API Tests
```bash
cd /app/ess/api
pytest tests/ -v
```

### Test Login
```bash
curl -X POST http://localhost:8002/ess/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john.sales@wisedrive.com",
    "password": "password123",
    "device": {
      "device_id": "test-device-001",
      "platform": "android",
      "app_version": "1.0.0"
    }
  }'
```

## Support

For questions or issues, contact the WiseDrive Platform Team.
