# WiseDrive CRM & Mechanic App - Product Requirements

## Original Problem Statement
Build and maintain a CRM system for WiseDrive with an integrated React Native mechanic mobile app. The mechanic app allows field mechanics to perform vehicle inspections by answering configured questions (text, photo, video, multiple choice) and sub-questions.

## Current Status (v1.6.4) - 2026-02-26

### ✅ FIXED: Firebase Streaming Upload for Large Videos
**Root Cause:** Previous implementations tried to load entire video files into memory (as base64 or Blob), causing `java.lang.OutOfMemoryError` on mobile devices.

**Solution Implemented:**
1. **Backend Signed URL Endpoint** (`/api/media/generate-upload-url`): 
   - Uses Firebase Admin SDK to generate V4 signed URLs
   - Mobile app can upload directly to Firebase Storage
   - No file data passes through the backend

2. **Streaming Upload in Mobile App**:
   - Uses `FileSystem.uploadAsync` from `expo-file-system`
   - Streams file directly from device storage to Firebase
   - Never loads entire file into memory
   - Eliminates OutOfMemoryError completely

3. **Firebase URL Storage**:
   - Backend stores `gs://bucket/path` URLs instead of base64
   - CRM can retrieve download URLs via `/api/media/get-download-url`

## Architecture Changes (Firebase Integration)

### New Endpoints:
- `POST /api/media/generate-upload-url` - Get signed URL for upload
- `POST /api/media/get-download-url` - Convert gs:// URL to HTTPS

### Upload Flow:
1. Mechanic records video → App calls `/media/generate-upload-url`
2. Backend returns signed Firebase URL
3. App uses `FileSystem.uploadAsync` to stream file to Firebase
4. App saves Firebase path (gs://...) via `/progress` endpoint
5. CRM converts gs:// to HTTPS via `/media/get-download-url` when displaying

## Build History
- **v1.6.4**: Firebase streaming upload (fixes OutOfMemoryError for large videos)
- v1.6.3: Attempted chunked blob upload (still caused OOM)
- v1.6.2: expo-file-system based upload (incomplete)
- v1.6.1: XMLHttpRequest approach (failed)
- v1.6.0: Initial Firebase integration
- v1.5.0: Separate media storage (fixes MongoDB 16MB limit)
- v1.4.x: Image compression, diagnostic logger, etc.

## Key API Endpoints
- `POST /api/mechanic/inspections/{id}/progress` - Save answer (now accepts Firebase URLs)
- `POST /api/media/generate-upload-url` - Get Firebase signed URL for upload
- `POST /api/media/get-download-url` - Convert gs:// to HTTPS download URL
- `GET /api/inspection-media/{media_id}` - Retrieve stored media (legacy base64)
- `GET /api/mechanic/inspections/{id}` - Get inspection with answers

## Third-Party Integrations
- **Firebase Storage**: Media file storage (photos, videos)
- Fast2SMS: Mechanic OTP
- Twilio: WhatsApp messages
- Razorpay: Payments
- Google Maps Places API: Address editing
- EAS (Expo Application Services): APK builds

## Pending Tasks

### P1 - After Video Upload Verification
- [ ] Update CRM to display Firebase media (convert gs:// URLs to HTTPS)
- [ ] Verify mechanic app status consistency ("Continue" vs "Accept")

### Backlog
- PDF export for inspection reports
- WhatsApp sharing for reports
- Customer reminders
- Refactor InspectionsPage.jsx
- Refactor server.py into routers
- Offline mode for mechanic app

## Test Credentials
- CRM Admin: kalyan@wisedrive.com / password123
- Mechanic Test: +919187458748 (Sai Bharath)

## APK Downloads
- **v1.6.4 (Firebase Streaming Upload)**: https://expo.dev/artifacts/eas/s7tQ5bbrUARubMbq759YdB.apk
- v1.5.0: https://expo.dev/artifacts/eas/LmHP31p3Gj21ek7V4RRzw.apk

## Firebase Configuration
- Project: wisedrive-ess-app
- Storage Bucket: wisedrive-ess-app.firebasestorage.app
- Credentials: /app/ess/api/firebase-credentials.json
