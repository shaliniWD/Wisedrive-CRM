# Wisedrive CRM & ESS Mobile App - Product Requirements Document

## Original Problem Statement
Build a scalable automotive platform "Wisedrive" that evolved into a monolithic CRM application with an Employee Self-Service (ESS) mobile application.

## Core Applications
1. **CRM Web Application** - Employee and HR management
2. **ESS Mobile App** - Employee self-service (React Native/Expo)

## User Personas
- **CEO** - Full system access
- **HR Manager** - Employee, payroll, leave management
- **Employees** - Self-service access via mobile app

---

## Bug Fixes (December 2025)

### BUG FIX #1: Password Reset Issue ✅ FIXED
**Problem:** Passwords were being reset to "password123" on every server restart
**Root Cause:** `auto_fix_password_hashes()` was resetting ALL passwords that didn't match "password123"
**Fix Location:** `/app/backend/server.py` lines 154-220
**Solution:** Modified to only fix truly corrupted/missing hashes, not override valid bcrypt passwords

### BUG FIX #2: Documents Not Showing in ESS ✅ FIXED
**Problem:** Documents uploaded in CRM were not showing in ESS mobile app
**Root Cause:** ESS API looked for `url` field but CRM stores as `document_url`
**Fix Location:** `/app/backend/routes_ess/documents.py` lines 44-68
**Solution:** ESS now checks: `url` OR `document_url` OR `file_url`

### BUG FIX #3: Salary Tab Persistence ✅ FIXED
**Problem:** Salary data disappeared when switching tabs in CRM
**Root Cause:** Frontend didn't reload salary data when returning to salary tab
**Fix Location:** `/app/frontend/src/pages/AdminPage.jsx` lines 1914-1925
**Solution:** Added useEffect to reload salary when switching to salary tab

### ADDITIONAL FIX: Gross/Net Salary Calculation ✅ FIXED
**Problem:** Gross and Net salary were 0 in some records
**Root Cause:** Code checked for `full_time` but some data had `fulltime` (no underscore)
**Fix Location:** `/app/backend/server.py` line 2238
**Solution:** Support both variations: `full_time`, `fulltime`, `part_time`, `parttime`

### ROLES TAB FIXES (5 bugs) ✅ ALL FIXED

**BUG #4: Delete Role Feature** ✅ FIXED
- Added DELETE /api/roles/{role_id} endpoint
- Protects preset roles (CEO, HR_MANAGER, etc.)
- Protects roles with assigned employees
- Delete button shown in edit modal (red, with confirmation)

**BUG #5: Copy Role Not Copying Permissions** ✅ FIXED
- Added `permissions` field to RoleCreate/RoleUpdate models
- Fixed RoleModal to use role.permissions instead of PRESET_ROLES
- Permissions now properly copied when using "Copy" action

**BUG #6: Unable to Edit Role** ✅ FIXED
- Backend PUT endpoint now accepts and updates permissions
- Frontend properly sends permissions in update request

**BUG #7: Modal Overflow** ✅ FIXED
- Added `max-h-[90vh]` and `overflow-y-auto` to DialogContent
- Modal is now scrollable and contained within viewport

**BUG #8: Button Text (Update vs Create)** ✅ VERIFIED
- Button shows "Create" for new roles, "Update" for edit mode
- Already working correctly

**BUG #9: Custom Role Users Can't Access Pages** ✅ FIXED
- **Problem:** Users with custom roles (e.g., CTO) could only see dashboard
- **Root Cause:** `get_visible_tabs()` in `rbac.py` only checked hardcoded `TAB_VISIBILITY` dictionary
- **Fix Location:** `/app/backend/services/rbac.py` lines 177-230
- **Solution:** Modified to check role's stored `permissions` field and convert to visible tabs using `PAGE_TO_TAB` mapping

---

## CRM-to-ESS Field Mapping Reference

### Personal Profile Fields (20 fields) ✅ VERIFIED
### Bank Details Fields (4 fields) ✅ VERIFIED  
### Salary Fields (14 fields) ✅ VERIFIED

---

## Test Results

### Latest Test: Iteration 40
- **Total Tests:** 16 tests
- **Pass Rate:** 100%
- All three bug fixes verified

### Test Credentials
- **CRM URL:** https://crmdev.wisedrive.com
- **HR User:** hr@wisedrive.com / password123
- **Admin User:** kalyan@wisedrive.com / password123

---

## Mobile App Builds

### Latest Build: v1.2.0 (with Leave Rules)
- **Android APK:** https://expo.dev/artifacts/eas/7W4cXsbCUAyC8bSdcbFL63.apk
- **iOS IPA:** https://expo.dev/artifacts/eas/3Z4u5m65Ykd7UteqTZa22V.ipa

### Features in v1.2.0:
- Period-based leave balance (monthly/quarterly)
- No carry forward policy
- Disabled Apply button when leaves exhausted
- LOP days tracking
- Error messages for insufficient leaves

---

## Future Tasks (Backlog)

### ✅ COMPLETED - Leads Management Module (Phase 1-4)

**Phase 1 - Lead Creation via Twilio WhatsApp:**
- Webhook: `/api/webhooks/twilio/whatsapp`
- Receives Meta ad clicks, extracts ad_id, maps to city
- Creates lead with status "NEW LEAD"

**Phase 2 - Lead Management:**
- 22 lead statuses implemented
- Round-robin assignment to sales reps by city
- Filtering by status, city, search

**Phase 3 - Follow-up:**
- Lead notes with activity logging
- Reminder system with scheduled notifications
- Status change tracking

**Phase 4 - Payment (Razorpay):**
- Payment link creation: `/api/leads/{id}/payment-link`
- WhatsApp send via Twilio
- Webhook: `/api/webhooks/razorpay/payment`
- Auto-creates customer on payment confirmation

### P1 - Frontend UI for Leads Module
- [ ] Leads listing page with filters
- [ ] Lead detail view with notes/activities
- [ ] Payment link generation UI
- [ ] AD-City mapping settings UI

### P2 - CRM Modules
- [ ] Leads Module
- [ ] Inspections Module
- [ ] Customer Module

### P3 - Integrations
- [ ] OBD-Integration-v1.0
- [ ] Razorpay payment integration

---

## Document History
- **Created:** December 2025
- **Last Updated:** December 2025 (Bug fixes)
- **Version:** 1.6
