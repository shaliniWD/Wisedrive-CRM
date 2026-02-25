# WiseDrive CRM & Mechanic App - Product Requirements

## Original Problem Statement
Build and maintain a CRM system for WiseDrive with an integrated React Native mechanic mobile app. The mechanic app allows field mechanics to perform vehicle inspections by answering configured questions (text, photo, video, multiple choice) and sub-questions.

## Current Status (v1.4.2) - 2026-02-26
**Critical fixes for file upload stability:**
- Fixed profile version display (now shows correct version from app.json)
- Fixed backend inspection_status bug (was "IN_PROGRESS" → now "INSPECTION_STARTED")
- **NEW**: Implemented sequential answer saving (one-by-one instead of batch)
- **NEW**: Added video size limit (5MB max) with clear error messages
- **NEW**: Video duration limited to 10 seconds max for reliable uploads
- **NEW**: Removed expo-file-system dependency (was causing build failures)

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
  - Video capture (max 10 seconds, 5MB limit)
  - Combined types (MCQ + Photo, MCQ + Video)
  - Sub-questions with independent answer types
- Offline capability (future)
- Real-time sync with backend

## What's Been Implemented

### Recent Fixes (v1.4.2) - 2026-02-26
- **Sequential Save**: Answers are now saved one-by-one instead of in a batch
- **Video Limits**: Max 10 seconds duration, 5MB file size limit
- **Video Processing**: Uses fetch/blob API instead of expo-file-system (more reliable)
- **Better Error Messages**: Shows exactly which answer failed and why
- **Diagnostic Logger**: Profile → Diagnostics → View Debug Logs for troubleshooting

### Build History
- v1.4.2: Sequential saves, video limits, removed expo-file-system (current)
- v1.4.1: Added diagnostic logger
- v1.4.0: Profile version fix, image compression, status bug fix
- v1.3.1: Aggressive image compression, API retry logic
- v1.3.0: Removed custom logger, added expo-image-manipulator, questionnaire caching
- v1.2.0: "Save & Next" with AsyncStorage drafts

## Architecture

```
/app/
├── backend/
│   └── server.py           # FastAPI backend (v2.4.6)
├── frontend/
│   └── src/pages/          # React CRM pages
│       └── InspectionsPage.jsx
└── mechanic-app-native/
    ├── app.json            # Version: 1.4.2
    ├── app/
    │   ├── profile.tsx     # Shows version + debug logs viewer
    │   ├── home.tsx        # Inspection list with status logic
    │   └── category/[...params].tsx  # Question answering with sequential saves
    └── src/
        ├── lib/api.ts      # API client with retry logic
        └── lib/diagLogger.ts # Diagnostic logging system
```

## Key API Endpoints
- `POST /api/mechanic/inspections/{id}/progress` - Save single answer (sets status to INSPECTION_STARTED)
- `GET /api/mechanic/inspections/{id}` - Get inspection with answers
- `GET /api/mechanic/inspections` - List inspections (maps status for app)
- `GET /api/inspections/{id}/questionnaire` - Get questions
- `GET /api/inspections/{id}/live-progress` - CRM live progress view

## Third-Party Integrations
- Fast2SMS: Mechanic OTP
- Twilio: WhatsApp messages
- Razorpay: Payments
- Google Maps Places API: Address editing
- EAS (Expo Application Services): APK builds
- expo-image-manipulator: Client-side image compression

## Known Issues / Limitations
- **Environment Mismatch**: Mechanic app saves to production (crmdev.wisedrive.com), CRM reads from preview backend. User must change REACT_APP_BACKEND_URL in /app/frontend/.env to production to test live progress.
- **Video Size Limit**: Videos must be under 5MB (roughly 10 seconds at low quality)

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

## APK Downloads
- **v1.4.2**: https://expo.dev/artifacts/eas/8tTXCPUSazLu82nih2tAJA.apk
- Build page: https://expo.dev/accounts/kalyandhar/projects/wisedrive-mechanic/builds/3c9512cb-9312-4f50-a7e4-c8713048af76
