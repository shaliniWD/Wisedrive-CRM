# WiseDrive CRM - Product Requirements Document

## Original Problem Statement
Build a custom CRM for WiseDrive to manage leads from Meta (Facebook/Instagram) ads via WhatsApp, with flawless lead attribution and data integrity.

## Core Requirements
1. **Lead Attribution** - Capture Meta Ad ID (`ReferralSourceId`) for city mapping
2. **City Mapping** - Auto-assign cities based on Ad ID/Name mappings
3. **Ad Performance Sync** - Sync data from Meta Marketing API
4. **Authentication** - Manual token-paste flow for Meta API
5. **Debugging Tools** - Lead Investigator with Audit Trail

## User Personas
- **Admin/CEO** - Full access, lead management, analytics
- **Sales Team** - Lead follow-up, status updates, notes
- **Mechanics** - Mobile app for inspections (future)

---

## Completed Features (Feb 2026)

### Lead Attribution Engine ✅
- Twilio webhook captures `ReferralSourceId` as primary Ad ID
- Fallbacks: `ReferralCtwaClid` → auto-generated from ad_name
- City mapping from `ad_city_mappings` collection

### Lead Investigator & Audit Trail ✅
- Raw Twilio payload display
- Step-by-step processing log
- Debugging tool for attribution issues

### Meta Token Management ✅
- Manual token paste modal with Graph API Explorer guide
- Token status badge on Ad Analytics page
- Persistent storage in settings collection

### "Sync from Meta" Mappings ✅
- Auto-create ad-to-city mappings from Meta API
- "Remap All" for historical leads

### Questionnaire Category Reordering ✅
- Drag-and-drop with @dnd-kit library
- `category_order` array in inspection_templates

### Leads Page Enhancements (Feb 22, 2026) ✅
- "New Leads" card shows all-time total (not just today)
- Date range filter with Reset button
- Employee dropdown filtered to sales roles
- City dropdown filtered to cities with leads
- Quick filter buttons (Today, Yesterday, This Week, etc.)
- Activity Log tab in Notes drawer

---

## Pending Issues

### P1: Activity Log Scroll Height
- **Status:** Recurring issue
- **Problem:** Log area not using full vertical space
- **Location:** `/app/frontend/src/pages/LeadsPage.jsx` lines 3183-3290

### P2: Table Column Symmetry
- **Status:** Not started
- **Problem:** Columns not aligned properly
- **Location:** `/app/frontend/src/pages/LeadsPage.jsx`

---

## Technical Architecture

### Backend
- **Framework:** FastAPI
- **Database:** MongoDB
- **Main file:** `/app/backend/server.py` (>12,000 lines - needs refactoring)

### Frontend
- **Framework:** React with Shadcn/UI
- **Main file:** `/app/frontend/src/pages/LeadsPage.jsx` (>3,000 lines - needs refactoring)
- **Dependencies:** @dnd-kit/core for drag-and-drop

### Key Collections
- `leads` - Lead data with ad_id, city, status
- `ad_city_mappings` - Ad ID/Name to city mappings
- `settings` - Meta API token storage
- `inspection_templates` - With category_order

### Key Endpoints
- `POST /api/webhooks/twilio/whatsapp` - Lead capture
- `POST /api/meta-ads/sync-ad-name-mappings` - Sync mappings
- `POST /api/leads/auto-remap-by-ad-id` - Bulk city fix
- `GET /api/meta-ads/token-info` - Token status

---

## Future Roadmap

### P0 - Technical Debt
- Refactor `server.py` into APIRouter modules
- Refactor `LeadsPage.jsx` into components

### P1 - Mechanic Mobile App
- Fix APK build process
- Implement questionnaire flow
- Add "Reject Reason" modal

### P2 - CRM Enhancements
- PDF export for inspection reports
- "Share via WhatsApp" feature
- Customer reminders

---

## Test Credentials
- **CRM:** kalyan@wisedrive.com / password123 (India)
- **Mechanic App:** 9611188788 / OTP: 123456
