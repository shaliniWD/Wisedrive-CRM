# WiseDrive CRM + Mechanic App PRD

## Original Problem Statement
Build and maintain a CRM system for WiseDrive along with a React Native mechanic mobile app. The system includes:
- CRM for managing inspections, customers, and mechanics
- Mobile app for mechanics to perform vehicle inspections with OBD scanning capabilities
- Razorpay payment integration
- Activity logs and real-time progress tracking
- AI-powered inspection report generation

## Current Architecture

### Backend (FastAPI)
- **Location:** `/app/backend/server.py` (~17k lines - needs refactoring)
- **Database:** MongoDB
- **Key Collections:** `inspections`, `inspection_obd_results`, `inspection_answer_edits`, `users`, `mechanics`
- **AI Service:** `/app/backend/services/ai_report_service.py`

### Frontend (React)
- **Location:** `/app/frontend/`
- **Key Pages:** 
  - `InspectionsPage.jsx` (~4k lines - needs refactoring)
  - `InspectionReportPage.jsx` (Report viewing with AI insights)

### Mobile App (React Native/Expo)
- **Location:** `/app/mechanic-app-native/`
- **Current Version:** 1.7.2
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
- **OpenAI GPT-5.2** (AI Report Generation via Emergent LLM Key)

## Recent Implementations (Feb 2026)

### AI Report Generation - NEW (Feb 27, 2026)
- **Feature:** Generate AI-powered insights for inspection reports using OpenAI GPT-5.2
- **AI Generates:**
  - Overall Rating (1-5)
  - Recommended Market Value (min/max with confidence)
  - Assessment Summary (professional paragraph)
  - Condition Ratings (Engine, Interior, Exterior, Transmission)
  - Category-wise Ratings and Status
  - Risk Factors and Recommendations
- **New Endpoint:** `POST /api/inspections/{id}/generate-ai-report`
- **UI:** "Generate AI Report" button in Live Progress modal
- **Storage:** AI insights stored in `inspection.ai_insights` field

### Editable Inspection Answers (CRM) - Feb 27, 2026
- **Feature:** CRM users can edit inspection answers directly from Live Progress modal
- **Allowed Roles:** CEO, INSPECTION_COORDINATOR, INSPECTION_HEAD, COUNTRY_HEAD_CE, COUNTRY_HEAD
- **Audit Trail:** All edits tracked in `inspection_answer_edits` collection
- **Endpoints:**
  - `PUT /api/inspections/{id}/answers/{question_id}` - Edit answer
  - `GET /api/inspections/{id}/answers/{question_id}/history` - Get edit history

### Unscheduled Inspections Date Filter Fix - Feb 27, 2026
- Fixed bug where unscheduled inspections were hidden when date filters applied
- Now correctly filters by `created_at` for unscheduled and `scheduled_date` for scheduled

## Previous Implementations (Dec 2025)

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

### Answer Editing (CRM) - NEW
- `PUT /api/inspections/{id}/answers/{question_id}` - Edit answer (role-restricted)
- `GET /api/inspections/{id}/answers/{question_id}/history` - Get edit history for question
- `GET /api/inspections/{id}/edit-history` - Get all edits for inspection

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
- Build retry UI in mechanic app for failed uploads saved in AsyncStorage

### P2 (Medium Priority)
- PDF export for inspection reports
- WhatsApp sharing functionality
- Customer reminders feature

### P3 (Low Priority - Refactoring)
- Break down `server.py` into modular routers
- Refactor `InspectionsPage.jsx` into components
- Refactor `scanner.tsx` into smaller components
