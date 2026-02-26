# WiseDrive CRM + Mechanic App PRD

## Original Problem Statement
Build and maintain a CRM system for WiseDrive along with a React Native mechanic mobile app. The system includes:
- CRM for managing inspections, customers, and mechanics
- Mobile app for mechanics to perform vehicle inspections with OBD scanning capabilities
- Razorpay payment integration
- Activity logs and real-time progress tracking

## Current Architecture

### Backend (FastAPI)
- **Location:** `/app/backend/server.py` (~16k lines - needs refactoring)
- **Database:** MongoDB
- **Key Collections:** `inspections`, `inspection_obd_results`, `users`, `mechanics`

### Frontend (React)
- **Location:** `/app/frontend/`
- **Key Page:** `InspectionsPage.jsx` (~3.5k lines - needs refactoring)

### Mobile App (React Native/Expo)
- **Location:** `/app/mechanic-app-native/`
- **Current Version:** 1.7.0
- **Key Files:**
  - `app/scanner.tsx` - OBD Scanner (modified for persistence)
  - `app/inspection-categories.tsx` - Categories page (checks backend OBD status)
  - `src/context/InspectionContext.tsx` - State management

## Third-Party Integrations
- Firebase (Storage + Admin SDK)
- Fast2SMS (OTP)
- Twilio (WhatsApp)
- Razorpay (Payments)
- Google Maps Places API
- EAS (Expo Application Services)

## Recent Implementations (Dec 2025)

### AsyncStorage Persistence for OBD Data (v1.7.0)
- OBD data saved to AsyncStorage BEFORE backend submission as backup
- Shows "Pending OBD Data" card if local unsubmitted data exists
- "Upload Saved Data" button to retry failed submissions
- Data marked as submitted after successful backend upload

### OBD Rescan Prevention (v1.6.9)
- Backend check on mount to detect if OBD was already submitted
- Shows "Already Submitted" state instead of allowing rescan
- Categories page shows non-interactive OBD card when already submitted

### MongoDB 16MB Document Limit Fix (VERIFIED)
- OBD data stored in separate `inspection_obd_results` collection
- Main inspection document only stores reference (`obd_results_ref`)
- Endpoint: `POST /api/mechanic/inspections/{id}/obd-results`
- Tested successfully on preview server

### Firebase Streaming Upload
- Fixed OutOfMemoryError for large video uploads
- Uses backend-generated signed URLs
- Streaming upload via `FileSystem.uploadAsync`

## Known Issues & Status

| Issue | Status | Priority |
|-------|--------|----------|
| Production server 520 error | Needs investigation | P0 |
| OBD persistence | Implemented in v1.7.0 | P0 |
| OBD rescan prevention | Implemented in v1.6.9 | P0 |
| Media display in CRM | Pending verification | P1 |

## API Endpoints

### OBD Related
- `POST /api/mechanic/inspections/{id}/obd-results` - Submit OBD data
- `GET /api/inspections/{id}/live-progress` - Get progress with OBD data

### Media Related
- `POST /api/media/generate-upload-url` - Get signed URL for upload
- `POST /api/media/get-download-url` - Get signed URL for viewing

## Testing Credentials
- **CRM Admin:** kalyan@wisedrive.com / password123
- **Mechanic Test:** +919187458748
- **Firebase:** `/app/ess/api/firebase-credentials.json`

## Backlog

### P1 (High Priority)
- Deploy backend to production and verify all fixes
- Test offline OBD scan and retry scenario

### P2 (Medium Priority)
- PDF export for inspection reports
- WhatsApp sharing functionality
- Customer reminders feature
- Automatic retry for pending uploads (background sync)

### P3 (Low Priority - Refactoring)
- Break down `server.py` into modular routers
- Refactor `InspectionsPage.jsx` into components
- Refactor `scanner.tsx` into smaller components
- Implement offline mode for mechanic app
