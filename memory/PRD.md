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
- **Key Page:** `InspectionsPage.jsx` (~3.7k lines - needs refactoring)

### Mobile App (React Native/Expo)
- **Location:** `/app/mechanic-app-native/`
- **Current Version:** 1.7.1
- **Key Files:**
  - `app/scanner.tsx` - OBD Scanner (rescan support added)
  - `app/inspection-categories.tsx` - Categories page (rescan UI)
  - `src/lib/api.ts` - API helpers (new OBD status endpoint)

## Third-Party Integrations
- Firebase (Storage + Admin SDK)
- Fast2SMS (OTP)
- Twilio (WhatsApp)
- Razorpay (Payments)
- Google Maps Places API
- EAS (Expo Application Services)

## Recent Implementations (Dec 2025)

### OBD Re-scan Feature (v1.7.1)
- CRM toggle in Live Progress modal to enable/disable rescan
- New backend endpoints: `/obd-rescan`, `/obd-status`
- Mechanic app checks rescan permission on load
- Shows "Re-scan Mode" warning when enabled

### Media Display Fix (CRM)
- Handle `file://` local paths with warning message
- Error fallback UI for failed image loads
- Better video file detection

### AsyncStorage Persistence for OBD Data (v1.7.0)
- OBD data saved locally BEFORE backend submission as backup
- Shows "Pending OBD Data" card if local unsubmitted data exists

### MongoDB 16MB Document Limit Fix (VERIFIED)
- OBD data stored in separate `inspection_obd_results` collection
- Tested successfully on preview server

## Known Issues & Status

| Issue | Status | Priority |
|-------|--------|----------|
| Video `file://` paths | Under investigation | P1 |
| OBD rescan feature | Implemented | P0 |
| Media upload failures | Shows warning now | P1 |

## API Endpoints

### OBD Related
- `POST /api/mechanic/inspections/{id}/obd-results` - Submit OBD data
- `GET /api/mechanic/inspections/{id}/obd-status` - Check OBD status + rescan permission
- `POST /api/inspections/{id}/obd-rescan` - Toggle rescan (CRM only)
- `GET /api/inspections/{id}/live-progress` - Get progress with OBD data

### Media Related
- `POST /api/media/generate-upload-url` - Get signed URL for upload
- `POST /api/media/get-download-url` - Get signed URL for viewing

## Testing Credentials
- **CRM Admin:** kalyan@wisedrive.com / password123
- **Mechanic Test:** +919187458748
- **Firebase:** `/app/ess/api/firebase-credentials.json`

## Backlog

### P0 (Critical)
- Deploy backend to production and verify all fixes
- Investigate video upload failure (why file:// paths)

### P1 (High Priority)  
- Test OBD rescan flow end-to-end
- Fix video upload in mechanic app

### P2 (Medium Priority)
- PDF export for inspection reports
- WhatsApp sharing functionality
- Customer reminders feature

### P3 (Low Priority - Refactoring)
- Break down `server.py` into modular routers
- Refactor `InspectionsPage.jsx` into components
- Refactor `scanner.tsx` into smaller components
