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

### Web Scraping for Market Prices - NEW (Feb 28, 2026)
- **Feature:** Scrape Indian used car websites for real market price data
- **Sources:** CarDekho, CarWale, Cars24, Spinny, OLX (with fallback to depreciation model)
- **Implementation:**
  - `/app/backend/services/car_price_scraper.py` - UsedCarPriceScraper class
  - Async scraping using aiohttp + BeautifulSoup4
  - Price validation with age-based bounds (prevents outliers)
  - Outlier filtering using IQR method
  - Fallback depreciation model for common Indian car models
- **Data Fields Stored:** market_average, market_min, market_max, recommended_min/max, sources_count, sources (with URLs), estimation_method
- **Integration:** Automatically called during AI report generation to enhance market value estimates
- **Frontend Display:** Market avg with sources count shown below market value inputs in Inspection Editor

### AI Report Generation - Enhanced (Feb 28, 2026)
- **Feature:** Generate AI-powered insights for inspection reports using OpenAI GPT-5.2
- **AI Generates:**
  - Overall Rating (1-5)
  - Recommended Market Value (min/max with confidence) - now backed by web scraping data
  - Assessment Summary (professional paragraph with section-wise breakdown)
  - Condition Ratings (Engine, Interior, Exterior, Transmission)
  - Category-wise Ratings and Status
  - Risk Factors and Recommendations
- **Auto-Generation:** AI report automatically generates at milestones (25%, 50%, 75%, 100% completion) when mechanic submits answers
- **Manual Regeneration:** When CRM user edits an answer, report is marked as "stale" and shows "Update AI Report" button
- **Endpoint:** `POST /api/inspections/{id}/generate-ai-report`
- **UI:** Dynamic AI Report section in Live Progress modal with status indicators
- **Storage:** 
  - AI insights stored in `inspection.ai_insights` field
  - Market research stored in `inspection.market_price_research` field
  - Stale status in `inspection.ai_report_stale`

### Dual-Access Report System - NEW (Feb 27, 2026)
- **Customer Access URL:** `/r/{encrypted_short_code}` - OTP-protected
  - Short, encrypted URL using HMAC signature
  - Customer verifies with OTP sent to registered phone
  - Session token valid for 1 hour after verification
- **Internal CRM URL:** `/inspection-report/{id}` - CRM authenticated
- **New Endpoints:**
  - `GET /api/inspections/{id}/short-url` - Generate customer URL
  - `GET /api/report/public/{code}` - Get basic report info (no auth)
  - `POST /api/report/public/{code}/send-otp` - Send OTP to customer
  - `POST /api/report/public/{code}/verify-otp` - Verify OTP, get access token
  - `GET /api/report/public/{code}/data?token=` - Get full report with token
- **New Files:**
  - `/app/backend/services/report_url_service.py` - URL encryption/decryption
  - `/app/frontend/src/pages/CustomerReportPage.jsx` - OTP verification UI

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
- Restrict answer editing to predefined options only in Inspection Editor (no free-form text for dropdowns/radio buttons)
- Add "Share Report" button to CRM for generating customer-facing short URLs
- Test OBD rescan flow end-to-end
- Fix video upload in mechanic app
- Build retry UI in mechanic app for failed uploads saved in AsyncStorage

### P2 (Medium Priority)
- PDF export for inspection reports
- WhatsApp sharing functionality
- Customer reminders feature

### P3 (Low Priority - Refactoring)
- Break down `server.py` into modular routers (~17,500 lines)
- Refactor `InspectionsPage.jsx` into components (~4,100 lines)
- Refactor `scanner.tsx` into smaller components
