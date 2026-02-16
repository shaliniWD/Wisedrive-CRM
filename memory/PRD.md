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

## CRM-to-ESS Field Mapping Reference

### Personal Profile Fields (ESS API: GET /api/ess/v1/profile)

| # | CRM Field | ESS Field | Status |
|---|-----------|-----------|--------|
| 1 | id | id | ✅ VERIFIED |
| 2 | name | name | ✅ VERIFIED |
| 3 | email | email | ✅ VERIFIED |
| 4 | phone | phone | ✅ VERIFIED |
| 5 | employee_code | employee_code | ✅ VERIFIED |
| 6 | photo_url / profile_photo / avatar_url | photo_url | ✅ VERIFIED |
| 7 | department_id → lookup | department_name | ✅ VERIFIED |
| 8 | role_id → lookup | role_name | ✅ VERIFIED |
| 9 | country_id → lookup | country_name | ✅ VERIFIED |
| 10 | team_id → lookup | team_name | ✅ VERIFIED |
| 11 | joining_date / date_of_joining | date_of_joining | ✅ VERIFIED |
| 12 | employment_type | employment_type | ✅ VERIFIED |
| 13 | employment_status | employment_status | ✅ VERIFIED |
| 14 | reporting_manager_id / reports_to | reporting_manager_id | ✅ VERIFIED |
| 15 | lookup from reporting_manager_id | reporting_manager_name | ✅ VERIFIED |
| 16 | date_of_birth | date_of_birth | ✅ VERIFIED |
| 17 | gender | gender | ✅ VERIFIED |
| 18 | blood_group | blood_group | ✅ VERIFIED |
| 19 | emergency_contact_name | emergency_contact_name | ✅ VERIFIED |
| 20 | emergency_contact_phone | emergency_contact_phone | ✅ VERIFIED |

### Bank Details Fields (ESS API: GET /api/ess/v1/profile/bank-details)

| # | CRM Field | ESS Field | Status |
|---|-----------|-----------|--------|
| 1 | bank_name / bank | bank_name | ✅ VERIFIED |
| 2 | bank_account_number → masked | account_number_masked | ✅ VERIFIED |
| 3 | ifsc_code / ifsc / bank_ifsc | ifsc_code | ✅ VERIFIED |
| 4 | bank_account_holder_name / account_holder_name / beneficiary_name | account_holder_name | ✅ VERIFIED |

### Salary Fields (ESS API: GET /api/ess/v1/profile/salary)

| # | CRM Field | ESS Field | Status |
|---|-----------|-----------|--------|
| 1 | basic_salary | basic_salary | ✅ VERIFIED |
| 2 | hra | hra | ✅ VERIFIED |
| 3 | variable_pay / incentives | variable_pay | ✅ VERIFIED |
| 4 | conveyance_allowance / conveyance | conveyance | ✅ VERIFIED |
| 5 | medical_allowance / medical | medical | ✅ VERIFIED |
| 6 | special_allowance | special_allowance | ✅ VERIFIED |
| 7 | pf_employee | pf_employee | ✅ VERIFIED |
| 8 | professional_tax | professional_tax | ✅ VERIFIED |
| 9 | income_tax / tds | income_tax | ✅ VERIFIED |
| 10 | other_deductions | other_deductions | ✅ VERIFIED |
| 11 | calculated | gross_salary | ✅ VERIFIED |
| 12 | calculated | net_salary | ✅ VERIFIED |
| 13 | country → lookup | currency | ✅ VERIFIED |
| 14 | country → lookup | currency_symbol | ✅ VERIFIED |

---

## Implemented Features

### Authentication & Security ✅
- [x] JWT-based CRM authentication
- [x] ESS Mobile App authentication with device management
- [x] Automatic password validation on server startup
- [x] Removed dangerous `/reset-users` endpoint

### CRM Features ✅
- [x] Employee CRUD operations
- [x] Role management with permissions
- [x] Country/Department/Team management
- [x] Salary structure management
- [x] Document management
- [x] Leave management
- [x] Inspection Packages feature

### ESS Mobile App Features ✅
- [x] Login/Logout with device tracking
- [x] Profile view (Personal, Bank, Salary tabs)
- [x] Leave application and history
- [x] Payslip viewing
- [x] Holiday calendar
- [x] Notifications
- [x] Push notifications (FCM)

### Data Sync (CRM → ESS) ✅
- [x] All profile fields sync correctly
- [x] Bank details sync with proper masking
- [x] Salary components sync with field name mapping
- [x] Photo URL sync
- [x] Reporting manager sync with name lookup

---

## Testing Status

### Last Test Run: Iteration 37
- **Total Tests:** 63 tests
- **Pass Rate:** 100%
- **Test Categories:**
  - CRM Authentication: 2 tests ✅
  - ESS Authentication: 1 test ✅
  - Personal Profile Fields: 14 tests ✅
  - Bank Details Fields: 6 tests ✅
  - Salary Fields: 15 tests ✅
  - Edit and Sync: 5 tests ✅

### Test Data Verified
```json
{
  "profile": {
    "id": "0cfacef0-e48f-4023-b7ca-1fcc0b700ff7",
    "name": "Priya Sharma",
    "email": "hr@wisedrive.com",
    "phone": "+919498297673",
    "photo_url": "https://storage.wisedrive.com/photos/test-c39344e5-9ef7-4999-87db-31761fcd3ae5.jpg",
    "department_name": "Human Resources",
    "role_name": "HR Manager",
    "country_name": "India",
    "date_of_joining": "2024-03-15",
    "reporting_manager_id": "7cf43310-c14c-45d0-aa2d-6eb99b04ea1b",
    "reporting_manager_name": "Kalyan Kumar"
  },
  "bank_details": {
    "bank_name": "Test Bank",
    "account_number_masked": "XXXX XX78 90",
    "ifsc_code": "TEST0001234",
    "account_holder_name": "Test HR User"
  },
  "salary": {
    "gross_salary": 102500.0,
    "net_salary": 89900.0,
    "basic_salary": 55000.0,
    "hra": 22000.0,
    "variable_pay": 12000.0,
    "conveyance": 4000.0,
    "medical": 3500.0,
    "special_allowance": 6000.0,
    "pf_employee": 6600.0,
    "professional_tax": 200.0,
    "income_tax": 5500.0,
    "other_deductions": 300.0
  }
}
```

---

## Test Credentials
- **CRM URL:** https://crmdev.wisedrive.com
- **HR User:** hr@wisedrive.com / password123
- **Admin User:** kalyan@wisedrive.com / password123

---

## Future Tasks (Backlog)

### P1 - Upcoming
- [ ] Generate final Android APK and iOS IPA builds

### P2 - CRM Modules
- [ ] Leads Module
- [ ] Inspections Module (performing inspections)
- [ ] Customer Module

### P3 - Integrations
- [ ] OBD-Integration-v1.0
- [ ] Razorpay payment integration
- [ ] Invincible Ocean clients

---

## Code Architecture

```
/app/
├── backend/                  # FastAPI Backend (CRM & ESS)
│   ├── models/
│   │   ├── inspection_package.py
│   │   └── employee.py
│   ├── models_ess/
│   │   └── profile.py        # ESS data models
│   ├── routes_ess/
│   │   └── profile.py        # ESS profile API with field mappings
│   ├── tests/
│   │   └── test_ess_comprehensive_sync.py  # Comprehensive sync tests
│   └── server.py             # Main backend server
├── ess-mobile-app/           # React Native (Expo) mobile app
│   └── src/
│       ├── screens/
│       │   └── ProfileScreen.tsx
│       └── services/
│           └── api.ts
└── frontend/                 # React Frontend (CRM)
    └── src/
        ├── pages/
        │   ├── AdminPage.jsx
        │   └── InspectionPackagesPage.jsx
        └── services/
            └── api.js
```

---

## Document History
- **Created:** December 2025
- **Last Updated:** December 2025
- **Version:** 1.5
