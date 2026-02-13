# WiseDrive CRM - Product Requirements Document

## Original Problem Statement
Recreate WiseDrive CRM (https://crm.wisedrive.com) design with a modern UI. Create a full CRM with all modules including:
- Full functional CRM with backend/database
- JWT-based custom auth (email/password)
- Light theme design

## UX Redesign Requirements (Feb 13, 2026)
1. **Navigation**: Moved from sidebar to horizontal top navigation for more column space
2. **Date Format**: Changed from DD/MM/YYYY to "3 Jan '26" format everywhere
3. **Modern 2026 UX**: Glassmorphism navbar, cleaner tables, improved spacing

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
4. Customers Management (CRUD, payment status)
5. Inspections Management (Scheduled/Unscheduled views)
6. Admin/Employee Management (status toggles, city assignments)

## What's Been Implemented (Feb 13, 2026)

### Backend
- [x] JWT Authentication (login, register, token validation)
- [x] Leads CRUD API with filtering
- [x] Customers CRUD API with filtering
- [x] Inspections CRUD API with filtering
- [x] Employees CRUD API with status toggle
- [x] Dashboard Stats API
- [x] Utility APIs (cities, sources, statuses)
- [x] Seed data endpoint

### Frontend
- [x] Login Page with modern design matching original
- [x] Dashboard with stats cards and quick actions
- [x] Leads Page with filters, table, Add/Edit modal
- [x] Customers Page with filters, payment status badges
- [x] Inspections Page with Scheduled/Unscheduled tabs
- [x] Admin Page with Employee, Digital Ad Meta Data, Garage Employee tabs
- [x] Sidebar navigation with active states
- [x] Header with user dropdown and logout
- [x] Protected routes with auth redirects

### Design System
- [x] Outfit font for headings, Inter for body
- [x] Primary color: #4F46E5 (Indigo)
- [x] Light theme with #F8FAFC background
- [x] Status badges with color coding
- [x] Modern card-based layouts

## Prioritized Backlog

### P0 - Critical (Done)
- [x] Authentication system
- [x] All main modules (Dashboard, Leads, Customers, Inspections, Admin)

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

### P3 - Low Priority (Future)
- [ ] Dark mode toggle
- [ ] Mobile responsive improvements
- [ ] Activity logs/audit trail
- [ ] Multi-language support

## Next Tasks
1. Add pagination to all data tables
2. Implement chart visualizations on dashboard
3. Add export functionality for reports
4. Implement reminder notification system
