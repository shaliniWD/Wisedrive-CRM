# WiseDrive CRM & Mechanic App - Product Requirements

## Original Problem Statement
Build and maintain a CRM system for WiseDrive with an integrated React Native mechanic mobile app. The mechanic app allows field mechanics to perform vehicle inspections by answering configured questions (text, photo, video, multiple choice) and sub-questions.

## Current Focus (P0)
**Answer saving issue in Mechanic App**: Answers appear saved on-screen but don't persist in the database. Debug logging system has been implemented in v1.1.4 to track the issue.

## User Personas
1. **Admins**: Use CRM to manage inspections, configure questionnaires, track mechanics
2. **Mechanics**: Use mobile app to perform inspections, answer questions, capture photos/videos
3. **Customers**: Vehicle owners receiving inspection reports

## Core Requirements

### CRM (Web Application)
- Admin dashboard with inspection management
- Questionnaire builder with complex question types
- Live progress tracking of inspections
- Mechanic management
- Activity logging

### Mechanic App (React Native)
- OTP-based login for mechanics
- View assigned inspections
- Answer questions with multiple input types:
  - Multiple Choice
  - Photo capture
  - Video capture
  - Combined types (MCQ + Photo, MCQ + Video)
  - Sub-questions with independent answer types
- Offline capability (future)
- Real-time sync with backend

## What's Been Implemented

### Completed Features
- ✅ CRM frontend with inspections management (InspectionsPage.jsx)
- ✅ Backend API (server.py) with all inspection endpoints
- ✅ Mechanic app with OTP login
- ✅ Question rendering for all answer types
- ✅ Sub-question rendering (fixed in v1.1.3)
- ✅ Combined answer types (MCQ + Photo/Video)
- ✅ **Debug logging system (v1.1.4)** for tracking answer saving lifecycle

### Pending Issues (P0)
- 🔴 **Answers not persisting**: UI shows saved but data not in database
  - Debug logging added in v1.1.4 to diagnose
  - Awaiting user logs to identify root cause

## Architecture

```
/app/
├── backend/
│   └── server.py           # FastAPI backend (monolithic)
├── frontend/
│   └── src/pages/          # React CRM pages
│       └── InspectionsPage.jsx
└── mechanic-app-native/
    ├── app/
    │   ├── category/[...params].tsx  # Question answering screen
    │   └── inspection-categories.tsx
    └── src/
        ├── lib/
        │   ├── api.ts      # API client with logging
        │   └── logger.ts   # Debug logging utility
        └── components/
            └── LogViewer.tsx  # Debug log viewer UI
```

## Key API Endpoints
- `POST /api/mechanic/inspections/{id}/progress` - Save answer
- `GET /api/mechanic/inspections/{id}` - Get inspection with answers
- `GET /api/inspections/{id}/questionnaire` - Get questions

## Third-Party Integrations
- Fast2SMS: Mechanic OTP
- Twilio: WhatsApp messages
- Razorpay: Payments
- Google Maps Places API: Address editing
- EAS (Expo Application Services): APK builds

## Build History
- v1.1.1: Navigation fix
- v1.1.2: Combined answer types
- v1.1.3: Sub-question rendering fix
- v1.1.4: **Debug logging system** (current)

## Future Tasks (Backlog)
- PDF export for inspection reports
- WhatsApp sharing for reports
- Customer reminders
- Refactor InspectionsPage.jsx (3000+ lines)
- Refactor server.py into routers
- Offline mode for mechanic app

## Test Credentials
- CRM Admin: kalyan@wisedrive.com / password123
- Mechanic Test: +919187458748 (Sai Bharath)

---
Last Updated: 2025-02-25
Current Version: v1.1.4
