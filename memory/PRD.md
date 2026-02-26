# WiseDrive CRM & Mechanic App - Product Requirements

## Original Problem Statement
Build and maintain a CRM system for WiseDrive with an integrated React Native mechanic mobile app. The mechanic app allows field mechanics to perform vehicle inspections by answering configured questions (text, photo, video, multiple choice) and sub-questions.

## Current Status (v1.5.0) - 2026-02-26

### 🔴 CRITICAL FIX: MongoDB Document Size Limit
**Root Cause Found:** The inspection document exceeded MongoDB's 16MB limit because all images/videos were stored as base64 directly in the document.

**Solution Implemented (Backend v2.5.0):**
- Media (images/videos) now stored in separate `inspection_media` collection
- Inspection document only stores reference IDs (`media_ref:uuid`)
- New endpoint `/api/inspection-media/{media_id}` to retrieve media
- This completely eliminates the document size limit issue

## Architecture Changes

### New Collection: `inspection_media`
```javascript
{
  "id": "uuid",
  "inspection_id": "inspection-uuid",
  "question_id": "question-uuid", 
  "field_name": "answer|sub_answer_1|sub_answer_2",
  "media_type": "image|video",
  "data": "data:image/jpeg;base64,...",
  "created_at": "ISO timestamp",
  "created_by": "mechanic-id"
}
```

### How It Works:
1. Mechanic takes photo → App sends base64 to `/progress` endpoint
2. Backend detects base64 data → Stores in `inspection_media` collection
3. Backend stores `media_ref:uuid` in inspection_answers (tiny reference)
4. CRM retrieves media via `/inspection-media/{media_id}` when displaying

## Build History
- **v1.5.0**: Separate media storage (fixes document size limit)
- v1.4.2: Sequential saves, video limits
- v1.4.1: Diagnostic logger
- v1.4.0: Profile version fix, image compression, status bug fix
- v1.3.0: Removed custom logger, questionnaire caching

## Key API Endpoints
- `POST /api/mechanic/inspections/{id}/progress` - Save answer (media stored separately)
- `GET /api/inspection-media/{media_id}` - Retrieve stored media
- `GET /api/mechanic/inspections/{id}` - Get inspection with answers
- `GET /api/inspections/{id}/live-progress` - CRM live progress view

## Third-Party Integrations
- Fast2SMS: Mechanic OTP
- Twilio: WhatsApp messages
- Razorpay: Payments
- Google Maps Places API: Address editing
- EAS (Expo Application Services): APK builds
- expo-image-manipulator: Client-side image compression

## Known Issues / Limitations
- **Video Size Limit**: Videos must be under 5MB (~10 seconds at low quality)
- `videoMaxDuration` in ImagePicker is just a hint, doesn't force-stop recording

## Future Tasks (Backlog)
- Implement proper video compression library
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
- **v1.5.0-test (Preview Backend)**: https://expo.dev/artifacts/eas/LmHP31p3Gj21ek7V4RRzw.apk
- **v1.4.2 (Production)**: https://expo.dev/artifacts/eas/8tTXCPUSazLu82nih2tAJA.apk
