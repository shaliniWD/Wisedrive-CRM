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
- **Current Version:** 1.6.9
- **Key Files:**
  - `app/scanner.tsx` - OBD Scanner (modified)
  - `app/inspection-categories.tsx` - Categories page (modified)
  - `src/context/InspectionContext.tsx` - State management

## Third-Party Integrations
- Firebase (Storage + Admin SDK)
- Fast2SMS (OTP)
- Twilio (WhatsApp)
- Razorpay (Payments)
- Google Maps Places API
- EAS (Expo Application Services)

## Recent Implementations (Dec 2025)

### OBD Rescan Prevention (v1.6.9)
- Added backend check on mount to detect if OBD was already submitted
- Shows "Already Submitted" state instead of allowing rescan
- Categories page shows non-interactive OBD card when already submitted
- Removed ability to rescan after successful submission

### MongoDB 16MB Document Limit Fix
- OBD data now stored in separate `inspection_obd_results` collection
- Main inspection document only stores reference (`obd_results_ref`)
- Endpoint: `POST /api/mechanic/inspections/{id}/obd-results`

### Firebase Streaming Upload
- Fixed OutOfMemoryError for large video uploads
- Uses backend-generated signed URLs
- Streaming upload via `FileSystem.uploadAsync`

## Known Issues & Status

| Issue | Status | Priority |
|-------|--------|----------|
| OBD 16MB limit fix | Backend ready, pending production deploy | P0 |
| OBD rescan prevention | Implemented in v1.6.9, pending test | P0 |
| Media display in CRM | Implemented, pending verification | P1 |
| Status consistency | Implemented, pending verification | P1 |

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
- Verify all recent fixes on production
- Add local persistence for OBD data (AsyncStorage)

### P2 (Medium Priority)
- PDF export for inspection reports
- WhatsApp sharing functionality
- Customer reminders feature

### P3 (Low Priority - Refactoring)
- Break down `server.py` into modular routers
- Refactor `InspectionsPage.jsx` into components
- Refactor `scanner.tsx` into smaller components
- Implement offline mode for mechanic app
