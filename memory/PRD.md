# WiseDrive CRM - Product Requirements Document

## Original Problem Statement
Recreate WiseDrive CRM (https://crm.wisedrive.com) design with a modern UI. Create a full CRM with all modules including:
- Full functional CRM with backend/database
- JWT-based custom auth (email/password)
- Light theme design

## UX Redesign Requirements (Feb 13, 2026)
1. **Navigation**: Moved from sidebar to horizontal top navigation for more column space
2. **Date Format**: Changed from DD/MM/YYYY to "13 Feb '26" format everywhere
3. **Modern 2026 UX**: Matched exact original WiseDrive CRM design

## Design Elements Implemented (Based on Screenshots)
- **Header**: Dark blue (#2E3192) with WISEDRIVE logo + yellow bars
- **Top Nav Tabs**: Leads, Customers, Inspections, Admin, Dashboard
- **Buttons**: Purple (#6366F1) for Submit/Add/Find, Yellow (#FFD700) for Send Pay Link
- **Status Badges**: Green (Completed), Yellow (Pending), Purple (Request NewSlot), Blue (Scheduled)
- **Tables**: Full-width with hover effects, all columns visible
- **Payment Modal**: 3-step stepper (Car Info → Book Inspection → Billing Details)
- **Admin Tab - Employee**: Name, Assigned Cities, Assign City button, Status toggle, Edit
- **Admin Tab - Digital Ad Meta Data**: Ad Id, Ad Name, City, Language, Campaign Type, Source, Status toggle, Copy/Edit/Delete actions
- **Admin Tab - Garage Employee**: Grg Owner Name, Grg Employee Name, Grg Name, City, Preferred Language, Phone Number, Status toggle, Edit
- **Customer Details Modal**: Shows customer info + transaction history table (added Feb 13, 2026)

## Architecture
- **Frontend**: React.js with Tailwind CSS, shadcn/ui components
- **Backend**: FastAPI with Python
- **Database**: MongoDB
- **Authentication**: JWT-based with bcrypt password hashing

## User Personas
1. **Admin Users**: Full access to all modules, can manage employees
2. **Employee Users**: Can manage leads, customers, inspections assigned to them

## Core Requirements (Static)
1. Login/Authentication system
2. Dashboard with analytics
3. Leads Management (CRUD, filters, status tracking)
4. Customers Management (CRUD, payment status, details modal with transaction history)
5. Inspections Management (Scheduled/Unscheduled views)
6. Admin/Employee Management (status toggles, city assignments)

## What's Been Implemented

### Backend (Updated Feb 13, 2026)
- [x] JWT Authentication (login, register, token validation)
- [x] Leads CRUD API with filtering
- [x] Customers CRUD API with filtering
- [x] GET /api/customers/{customer_id} - Get single customer
- [x] GET /api/transactions/{customer_id} - Get customer transactions
- [x] POST /api/transactions - Create transaction
- [x] Inspections CRUD API with filtering
- [x] Employees CRUD API with status toggle
- [x] Digital Ads CRUD API with status toggle
- [x] Garage Employees CRUD API with status toggle
- [x] Dashboard Stats API
- [x] Utility APIs (cities, sources, statuses)
- [x] Seed data endpoint (includes transactions)

### Frontend - UX Redesign Complete (Updated Feb 13, 2026)
- [x] **Horizontal Top Navigation** - Glassmorphism effect, search, notifications, user menu
- [x] **Split-screen Login Page** - Modern design with branding on left
- [x] **Dashboard** - Clean stat cards with icons
- [x] **Leads Page** - Full-width table, inline filters, date format "13 Feb '26", **Edit Lead modal with all fields**
- [x] **Customers Page** - ID/Date column, payment badges, action menus, **Customer Details Modal**
- [x] **Customer Details Modal** - Shows customer info (name, mobile, city, status) + transaction history table
- [x] **Inspections Page** - Scheduled/Unscheduled tabs, report buttons
- [x] **Admin Page** - Employees, Digital Ad Meta Data, Garage Employee tabs with toggles and modals
- [x] **Date Utility** - formatDate, formatDateTime, formatTime helpers

### Design System
- [x] Inter + Outfit fonts
- [x] Primary color: Indigo (#4F46E5)
- [x] Glassmorphism navbar (bg-white/80 backdrop-blur)
- [x] Clean badge styles (success, warning, danger, info, purple)
- [x] Full-width responsive tables

## Prioritized Backlog

### P0 - Critical (Done)
- [x] Authentication system
- [x] All main modules (Dashboard, Leads, Customers, Inspections, Admin)
- [x] Customer Details Modal with transaction history

### P1 - High Priority (Next)
- [ ] Search/filter persistence across page navigation
- [ ] Pagination for large datasets
- [ ] Export data to CSV/Excel
- [ ] Bulk actions (delete multiple, status update)

### P2 - Medium Priority
- [ ] Dashboard charts and graphs (recharts)
- [ ] Email notifications for reminders
- [ ] Payment link generation integration
- [ ] Report generation and download
- [ ] Real-time updates via WebSockets

### P3 - Low Priority (Future)
- [ ] Dark mode toggle
- [ ] Mobile responsive improvements
- [ ] Activity logs/audit trail
- [ ] Multi-language support
- [ ] Keyboard shortcuts (Cmd+N for new lead)

## Next Tasks
1. Add pagination to all data tables
2. Implement chart visualizations on dashboard
3. Add export functionality for reports
4. Implement reminder notification system
