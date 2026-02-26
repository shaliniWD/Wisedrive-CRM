# WiseDrive CRM & Mechanic App - Product Requirements

## Original Problem Statement
Build and maintain a CRM system for WiseDrive with an integrated React Native mechanic mobile app. The mechanic app allows field mechanics to perform vehicle inspections by answering configured questions (text, photo, video, multiple choice) and sub-questions.

## Current Status (v1.6.6) - 2026-02-26

### ✅ COMPLETED: Video Upload & Playback
- Firebase streaming upload for large videos (fixes OutOfMemoryError)
- Video thumbnail with play button in mobile app
- Full-screen video player modal

### ✅ COMPLETED: CRM Live Progress Enhancements
1. **Mechanic info at top** - Shows mechanic name and start time prominently
2. **Removed Recent Answers section** - Cleaner UI
3. **Accordion-style Q&A** - Categories expandable with questions/answers inside
4. **OBD Data section** - Shows diagnostic results when available
5. **Glowing Live button** - Green animated button for in-progress inspections
6. **Grey Live button** - For completed inspections (still clickable)

## Architecture

### Media Upload Flow (Firebase):
1. Mechanic records video → App calls `/api/media/generate-upload-url`
2. Backend returns Firebase signed URL
3. App uses `FileSystem.uploadAsync` to stream file directly
4. App saves Firebase path (`gs://...`) via `/progress` endpoint
5. CRM converts `gs://` to HTTPS via `/api/media/get-download-url`

### Key Endpoints:
- `POST /api/media/generate-upload-url` - Get Firebase signed URL
- `POST /api/media/get-download-url` - Convert gs:// to HTTPS
- `GET /api/inspections/{id}/live-progress` - Get live progress with Q&A

## Build History
- **v1.6.6**: Video playback modal + CRM Live Progress UI enhancements
- v1.6.5: Media URL resolution for displaying saved photos
- v1.6.4: Firebase streaming upload (fixes OutOfMemoryError)
- v1.5.0: Separate media storage
- v1.4.x: Image compression, diagnostic logger

## Third-Party Integrations
- **Firebase Storage**: Media file storage
- Fast2SMS: Mechanic OTP
- Twilio: WhatsApp messages
- Razorpay: Payments
- Google Maps Places API
- EAS (Expo): APK builds

## Pending Tasks
- [ ] PDF export for inspection reports
- [ ] WhatsApp sharing for reports
- [ ] Customer reminders
- [ ] Refactor InspectionsPage.jsx
- [ ] Refactor server.py into routers
- [ ] Offline mode for mechanic app

## Test Credentials
- CRM Admin: kalyan@wisedrive.com / password123
- Mechanic Test: +919187458748

## APK Downloads
- **v1.6.6**: https://expo.dev/artifacts/eas/uXtgAUDj8Js222jvzuFemm.apk
- v1.6.5: https://expo.dev/artifacts/eas/vzfCihashY2iByump9apdX.apk
- v1.6.4: https://expo.dev/artifacts/eas/s7tQ5bbrUARubMbq759YdB.apk

## Firebase Configuration
- Project: wisedrive-ess-app
- Storage Bucket: wisedrive-ess-app.firebasestorage.app
- Credentials: /app/ess/api/firebase-credentials.json
