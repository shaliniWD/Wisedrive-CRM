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

### Partner Assignment from Ad Mapping - Option C (Feb 22, 2026) ✅
- Extended Ad City Mappings with `partner_id` and `partner_name` fields
- Webhook assigns partner from ad_mapping if set, otherwise B2C Default
- Frontend: Partner dropdown in Create Ad form
- Frontend: Partner column in Ad Mappings table
- Complete flow: Ad Campaign → Ad Mapping → Lead gets Partner automatically

### Sales Executive Role Permissions (Feb 23, 2026) ✅
Tested and verified all 10 role-based permissions:
1. ✅ View only assigned leads
2. ✅ View only Leads Tab (sidebar restricted)
3. ✅ Edit lead details (name, mobile, notes)
4. ✅ Cannot reassign leads (button hidden)
5. ✅ Cannot change city (read-only field)
6. ✅ Admin buttons hidden (Assign Unassigned, Remap City, Investigate Lead)
7. ✅ Reminder functionality works
8. ✅ Status change works (any to any)
9. ✅ Notes and activity log works
10. ✅ Payment modal full functionality

### Leads Page 8-Point UI Fix (Feb 23, 2026) ✅
1. **Date filter above stat cards** - Date Range filter now positioned above stats
2. **Stat cards update with date filter** - Stats calculate from filtered leads
3. **Partner details removed from table** - City column shows only city name
4. **Source column simplified** - Shows source type + truncated Ad ID only (no ad_name)
5. **Notes column at end** - Column order: Date|Lead Details|City|Assigned|Reminder|Status|Source|Payment|Notes
6. **Reduced column gaps** - Lead Details 180px, City 90px
7. **Assigned column truncation** - Uses truncate class with max-w-[90px]
8. **City dropdown filtering** - Shows AD mapped cities + cities from leads

### Critical Bug Fix (Feb 23, 2026) ✅
- Fixed "Cannot access 'filteredLeads' before initialization" error
- Moved statsLeads calculation after filteredLeads declaration

---

## Pending Issues

### P1: Activity Log Scroll Height
- **Status:** Minor - recurring cosmetic issue
- **Problem:** Log area not using full vertical space
- **Location:** `/app/frontend/src/pages/LeadsPage.jsx`

### P2: City Filter by User Role
- **Status:** Needs verification
- **Problem:** Country Manager should see only their country's cities, CEO sees all
- **Location:** `/app/frontend/src/pages/LeadsPage.jsx` - filteredCities logic

---

## Technical Architecture

### Backend
- **Framework:** FastAPI
- **Database:** MongoDB
- **Main file:** `/app/backend/server.py` (~13,800 lines - refactoring in progress)
- **New Route Structure:** `/app/backend/routes/` (templates created)
  - `auth.py` - Authentication routes
  - `leads.py` - Lead management (26+ endpoints)
  - `partners.py` - Partner CRUD
  - `webhooks.py` - Twilio webhooks
  - `meta_ads.py` - Meta API integration
  - `inspections.py` - Inspection management

### Frontend
- **Framework:** React with Shadcn/UI
- **Main file:** `/app/frontend/src/pages/LeadsPage.jsx` (~3,278 lines - refactored)
- **Extracted Components:** `/app/frontend/src/components/leads/`
  - `StatusDropdown.jsx` - Lead status dropdown (imported)
  - `ActivityLog.jsx` - Activity history (imported)
  - `LeadStats.jsx` - Stats cards (ready)
  - `LeadFilters.jsx` - Filter UI (ready)
- **Custom Hooks:** `/app/frontend/src/hooks/`
  - `useLeads.js` - Lead data management (ready)
- **Dependencies:** @dnd-kit/core for drag-and-drop, date-fns-tz for timezone

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
