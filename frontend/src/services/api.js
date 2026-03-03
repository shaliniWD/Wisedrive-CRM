import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Get user's timezone offset in minutes (positive for IST, negative for western timezones)
export const getTimezoneOffset = () => {
  // JavaScript's getTimezoneOffset returns the opposite sign, so we negate it
  // IST (UTC+5:30) returns -330 from getTimezoneOffset(), we need +330 for the backend
  return -new Date().getTimezoneOffset();
};

// Leads API
export const leadsApi = {
  getAll: (params) => axios.get(`${API_URL}/leads`, { params: { ...params, timezone_offset: getTimezoneOffset() } }),
  getById: (id) => axios.get(`${API_URL}/leads/${id}`),
  getStatuses: () => axios.get(`${API_URL}/leads/statuses`),
  create: (data) => axios.post(`${API_URL}/leads`, data),
  update: (id, data) => axios.put(`${API_URL}/leads/${id}`, data),
  updateStatus: (id, status) => axios.patch(`${API_URL}/leads/${id}/status`, { status }),
  delete: (id) => axios.delete(`${API_URL}/leads/${id}`),
  reassign: (id, data) => axios.post(`${API_URL}/leads/${id}/reassign`, data),
  getReassignmentHistory: (id) => axios.get(`${API_URL}/leads/${id}/reassignment-history`),
  // Sales reps for assignment
  getSalesRepsByCity: (city) => axios.get(`${API_URL}/leads/sales-reps-by-city`, { params: { city } }),
  // Bulk assign unassigned leads
  assignUnassigned: () => axios.post(`${API_URL}/leads/assign-unassigned`),
  // Bulk city remap (manual from->to)
  bulkRemapCity: (data) => axios.post(`${API_URL}/leads/bulk-remap-city`, data),
  // Auto remap by AD ID (automatic based on ad_city_mappings)
  autoRemapByAdId: (reassignToSalesRep = true) => axios.post(`${API_URL}/leads/auto-remap-by-ad-id?reassign_to_sales_rep=${reassignToSalesRep}`),
  // City summary
  getCitySummary: () => axios.get(`${API_URL}/leads/city-summary`),
  // Notes
  getNotes: (id) => axios.get(`${API_URL}/leads/${id}/notes`),
  addNote: (id, note) => axios.post(`${API_URL}/leads/${id}/notes`, { note }),
  // Activities
  getActivities: (id) => axios.get(`${API_URL}/leads/${id}/activities`),
  // Reminder
  setReminder: (id, data) => axios.post(`${API_URL}/leads/${id}/reminder`, data),
  // Payment
  createPaymentLink: (id, data) => axios.post(`${API_URL}/leads/${id}/payment-link`, data),
  // Check payment status manually (Plan B)
  checkPaymentStatus: (id) => axios.get(`${API_URL}/leads/${id}/check-payment-status`),
};

// Vehicle API (Vaahan Integration)
export const vehicleApi = {
  // Fetch vehicle details from Vaahan API
  getDetails: (vehicleNumber) => axios.get(`${API_URL}/vehicle/details/${encodeURIComponent(vehicleNumber)}`),
  // Save vehicle to database
  save: (data) => axios.post(`${API_URL}/vehicles`, data),
  // Get vehicle by ID
  getById: (id) => axios.get(`${API_URL}/vehicles/${id}`),
  // Get vehicle by registration number
  getByRegistration: (regNumber) => axios.get(`${API_URL}/vehicles/by-registration/${encodeURIComponent(regNumber)}`),
};

// Ad-City Mappings API
export const adCityMappingsApi = {
  getAll: () => axios.get(`${API_URL}/settings/ad-city-mappings`),
  create: (data) => axios.post(`${API_URL}/settings/ad-city-mappings`, data),
  update: (id, data) => axios.put(`${API_URL}/settings/ad-city-mappings/${id}`, data),
  toggleStatus: (id) => axios.patch(`${API_URL}/settings/ad-city-mappings/${id}/toggle-status`),
  delete: (id) => axios.delete(`${API_URL}/settings/ad-city-mappings/${id}`),
};

// Meta Ads Analytics API
export const metaAdsApi = {
  getStatus: () => axios.get(`${API_URL}/meta-ads/status`),
  getTokenInfo: () => axios.get(`${API_URL}/meta-ads/token-info`),
  refreshToken: () => axios.post(`${API_URL}/meta-ads/refresh-token`),
  autoRefresh: (daysThreshold = 7) => axios.post(`${API_URL}/meta-ads/auto-refresh`, null, { params: { days_threshold: daysThreshold } }),
  updateToken: (accessToken) => axios.post(`${API_URL}/meta-ads/update-token`, { access_token: accessToken }),
  getInsights: (params) => axios.get(`${API_URL}/meta-ads/insights`, { params }),
  getCampaigns: () => axios.get(`${API_URL}/meta-ads/campaigns`),
  getAds: () => axios.get(`${API_URL}/meta-ads/ads`),
  getPerformance: (params) => axios.get(`${API_URL}/meta-ads/performance`, { params }),
  // OAuth endpoints
  initOAuth: () => axios.get(`${API_URL}/meta-ads/oauth/init`),
  handleOAuthCallback: (code) => axios.post(`${API_URL}/meta-ads/oauth/callback`, null, { params: { code } }),
  // Advanced features - sync and unmapped ads
  syncStatus: () => axios.post(`${API_URL}/meta-ads/sync-status`),
  forceSync: () => axios.post(`${API_URL}/meta-ads/force-sync`),
  getCachedPerformance: () => axios.get(`${API_URL}/meta-ads/cached-performance`),
  getUnmappedAds: () => axios.get(`${API_URL}/meta-ads/unmapped-ads`),
  getAdsWithTargeting: () => axios.get(`${API_URL}/meta-ads/ads-with-targeting`),
  // Auto-map from targeting
  autoMapFromTargeting: () => axios.post(`${API_URL}/meta-ads/auto-map-from-targeting`),
  // ONE-CLICK SYNC: Fetch all Meta ads and create comprehensive ad_name -> city mappings
  syncAllAdMappings: () => axios.post(`${API_URL}/meta-ads/sync-all-ad-mappings`),
  // Auto-map from current cities (based on lead data)
  autoMapFromCurrentCities: () => axios.post(`${API_URL}/meta-ads/auto-map-from-current-cities`),
  // Scan leads for unmapped ads (works without Meta token)
  scanLeadsForUnmappedAds: () => axios.post(`${API_URL}/meta-ads/scan-leads-for-unmapped-ads`),
  // Unmapped ads from WhatsApp leads (works without Meta token)
  getUnmappedAdsFromLeads: () => axios.get(`${API_URL}/meta-ads/unmapped-ads-from-leads`),
  mapAdFromLeads: (unmappedId, city) => axios.post(`${API_URL}/meta-ads/map-ad-from-leads/${unmappedId}?city=${encodeURIComponent(city)}`),
};

// Customers API
export const customersApi = {
  getAll: (params) => axios.get(`${API_URL}/customers`, { params: { ...params, timezone_offset: getTimezoneOffset() } }),
  getById: (id) => axios.get(`${API_URL}/customers/${id}`),
  create: (data) => axios.post(`${API_URL}/customers`, data),
  update: (id, data) => axios.put(`${API_URL}/customers/${id}`, data),
  delete: (id) => axios.delete(`${API_URL}/customers/${id}`),
  // Payment history
  getPaymentHistory: (id) => axios.get(`${API_URL}/customers/${id}/payment-history`),
  getDetailedPayments: (id) => axios.get(`${API_URL}/customers/${id}/detailed-payments`),
  // Notes & Activities
  getNotes: (id) => axios.get(`${API_URL}/customers/${id}/notes`),
  addNote: (id, note) => axios.post(`${API_URL}/customers/${id}/notes`, { note }),
  updateNote: (customerId, noteId, note) => axios.put(`${API_URL}/customers/${customerId}/notes/${noteId}`, { note }),
  deleteNote: (customerId, noteId) => axios.delete(`${API_URL}/customers/${customerId}/notes/${noteId}`),
  getActivities: (id) => axios.get(`${API_URL}/customers/${id}/activities`),
  // Sales reps with counts
  getSalesRepsWithCounts: () => axios.get(`${API_URL}/customers/sales-reps-with-counts`),
  // Seed sample data
  seedSampleData: () => axios.post(`${API_URL}/customers/seed-sample-data`),
  // Repair data - link orphaned inspections, create missing inspections
  repair: (id) => axios.post(`${API_URL}/customers/${id}/repair`),
  repairByMobile: (mobile) => axios.post(`${API_URL}/customers/repair-by-mobile/${encodeURIComponent(mobile)}`),
};

// Transactions API
export const transactionsApi = {
  getByCustomer: (customerId) => axios.get(`${API_URL}/transactions/${customerId}`),
  create: (data) => axios.post(`${API_URL}/transactions`, data),
};

// Inspections API
export const inspectionsApi = {
  getAll: (params) => axios.get(`${API_URL}/inspections`, { params: { ...params, timezone_offset: getTimezoneOffset() } }),
  getById: (id) => axios.get(`${API_URL}/inspections/${id}`),
  create: (data) => axios.post(`${API_URL}/inspections`, data),
  update: (id, data) => axios.put(`${API_URL}/inspections/${id}`, data),
  delete: (id) => axios.delete(`${API_URL}/inspections/${id}`),
  collectBalance: (id, data) => axios.post(`${API_URL}/inspections/${id}/collect-balance`, data),
  checkPaymentStatus: (id, linkId) => axios.get(`${API_URL}/inspections/${id}/check-payment-status`, { params: { link_id: linkId } }),
  updateStatus: (id, status, reason = null) => axios.patch(`${API_URL}/inspections/${id}/status`, null, { params: { inspection_status: status, reason: reason } }),
  sendReport: (id, data) => axios.post(`${API_URL}/inspections/${id}/send-report`, data),
  updateVehicle: (id, data) => axios.patch(`${API_URL}/inspections/${id}/vehicle`, data),
  assignMechanic: (id, mechanicId) => axios.patch(`${API_URL}/inspections/${id}/assign-mechanic`, { mechanic_id: mechanicId }),
  updateSchedule: (id, data) => axios.patch(`${API_URL}/inspections/${id}/schedule`, data),
  updateLocation: (id, data) => axios.patch(`${API_URL}/inspections/${id}/location`, data),
  getLiveProgress: (id) => axios.get(`${API_URL}/inspections/${id}/live-progress`),
  toggleOBDRescan: (id, enableRescan) => axios.post(`${API_URL}/inspections/${id}/obd-rescan`, { enable_rescan: enableRescan }),
  requestObdRescan: (id) => axios.post(`${API_URL}/inspections/${id}/obd-rescan`, { enable_rescan: true }),
  // Vaahan API integration
  fetchVaahanData: (id) => axios.post(`${API_URL}/inspections/${id}/fetch-vaahan-data`),
  // Notes & Activities
  getNotes: (id) => axios.get(`${API_URL}/inspections/${id}/notes`),
  addNote: (id, data) => axios.post(`${API_URL}/inspections/${id}/notes`, data),
  getActivities: (id) => axios.get(`${API_URL}/inspections/${id}/activities`),
  // Answer Editing (CRM)
  editAnswer: (id, questionId, data) => axios.put(`${API_URL}/inspections/${id}/answers/${questionId}`, data),
  getAnswerHistory: (id, questionId) => axios.get(`${API_URL}/inspections/${id}/answers/${questionId}/history`),
  getEditHistory: (id) => axios.get(`${API_URL}/inspections/${id}/edit-history`),
  // AI Report Generation
  generateAIReport: (id, forceRegenerate = false) => axios.post(`${API_URL}/inspections/${id}/generate-ai-report`, { force_regenerate: forceRegenerate }),
  getReport: (id) => axios.get(`${API_URL}/inspections/${id}/report`),
  // Report URL (short URL for customer access)
  getShortUrl: (id) => axios.get(`${API_URL}/inspections/${id}/short-url`),
};

// Users API (V2)
export const usersApi = {
  getAll: (params) => axios.get(`${API_URL}/users`, { params }),
  getById: (id) => axios.get(`${API_URL}/users/${id}`),
  toggleStatus: (id) => axios.patch(`${API_URL}/users/${id}/toggle-status`),
  toggleAssignment: (id) => axios.patch(`${API_URL}/users/${id}/toggle-assignment`),
};

// Employees API (V1 compatibility)
export const employeesApi = {
  getAll: () => axios.get(`${API_URL}/employees`),
  create: (data) => axios.post(`${API_URL}/employees`, data),
  update: (id, data) => axios.put(`${API_URL}/employees/${id}`, data),
  toggleStatus: (id) => axios.patch(`${API_URL}/employees/${id}/toggle-status`),
  assignCity: (id, city) => axios.patch(`${API_URL}/employees/${id}/assign-city`, null, { params: { city } }),
};

// Mechanics API
export const mechanicsApi = {
  getAll: (params) => axios.get(`${API_URL}/mechanics`, { params }),
};

// Countries API
export const countriesApi = {
  getAll: () => axios.get(`${API_URL}/countries`),
  getById: (id) => axios.get(`${API_URL}/countries/${id}`),
};

// Departments API
export const departmentsApi = {
  getAll: () => axios.get(`${API_URL}/departments`),
};

// Roles API
export const rolesApi = {
  getAll: () => axios.get(`${API_URL}/roles`),
  getPermissions: (id) => axios.get(`${API_URL}/roles/${id}/permissions`),
  create: (data) => axios.post(`${API_URL}/roles`, data),
  update: (id, data) => axios.put(`${API_URL}/roles/${id}`, data),
  delete: (id) => axios.delete(`${API_URL}/roles/${id}`),
};

// Teams API
export const teamsApi = {
  getAll: (params) => axios.get(`${API_URL}/teams`, { params }),
};

// Round Robin API
export const roundRobinApi = {
  getNextAgent: (countryId, teamId) => axios.get(`${API_URL}/round-robin/next/${countryId}`, { params: { team_id: teamId } }),
  getStats: (countryId, teamId) => axios.get(`${API_URL}/round-robin/stats/${countryId}`, { params: { team_id: teamId } }),
};

// Digital Ads API
export const digitalAdsApi = {
  getAll: () => axios.get(`${API_URL}/digital-ads`),
  create: (data) => axios.post(`${API_URL}/digital-ads`, data),
  update: (id, data) => axios.put(`${API_URL}/digital-ads/${id}`, data),
  toggleStatus: (id) => axios.patch(`${API_URL}/digital-ads/${id}/toggle-status`),
  delete: (id) => axios.delete(`${API_URL}/digital-ads/${id}`),
};

// Garage Employees API
export const garageEmployeesApi = {
  getAll: () => axios.get(`${API_URL}/garage-employees`),
  create: (data) => axios.post(`${API_URL}/garage-employees`, data),
  update: (id, data) => axios.put(`${API_URL}/garage-employees/${id}`, data),
  toggleStatus: (id) => axios.patch(`${API_URL}/garage-employees/${id}/toggle-status`),
  delete: (id) => axios.delete(`${API_URL}/garage-employees/${id}`),
};

// Dashboard API
export const dashboardApi = {
  getStats: () => axios.get(`${API_URL}/dashboard/stats`),
};

// Utility API
export const utilityApi = {
  getCities: () => axios.get(`${API_URL}/cities/names`),
  getLeadSources: () => axios.get(`${API_URL}/lead-sources`),
  getLeadStatuses: () => axios.get(`${API_URL}/leads/statuses`),
};

// Cities Management API
export const citiesApi = {
  getAll: (includeInactive = true) => axios.get(`${API_URL}/cities`, { params: { include_inactive: includeInactive } }),
  getNames: () => axios.get(`${API_URL}/cities/names`),
  create: (data) => axios.post(`${API_URL}/cities`, data),  // JSON body for proper array handling
  update: (id, data) => axios.put(`${API_URL}/cities/${id}`, data),  // JSON body for proper array handling
  resolve: (cityName) => axios.get(`${API_URL}/cities/resolve/${encodeURIComponent(cityName)}`),
  normalizeAll: () => axios.post(`${API_URL}/cities/normalize-all`),
};

// Seed API
export const seedApi = {
  seed: () => axios.post(`${API_URL}/seed`),
  clearAndSeed: () => axios.post(`${API_URL}/seed/clear`),
};

// Inspection Q&A API
export const inspectionQAApi = {
  getQuestions: (params) => axios.get(`${API_URL}/inspection-qa/questions`, { params }),
  getQuestion: (id) => axios.get(`${API_URL}/inspection-qa/questions/${id}`),
  createQuestion: (data) => axios.post(`${API_URL}/inspection-qa/questions`, data),
  updateQuestion: (id, data) => axios.put(`${API_URL}/inspection-qa/questions/${id}`, data),
  deleteQuestion: (id) => axios.delete(`${API_URL}/inspection-qa/questions/${id}`),
  toggleQuestion: (id) => axios.patch(`${API_URL}/inspection-qa/questions/${id}/toggle`),
  getCategories: () => axios.get(`${API_URL}/inspection-qa/categories`),
  reorderQuestions: (questionIds) => axios.patch(`${API_URL}/inspection-qa/questions/reorder`, { question_ids: questionIds }),
};

// Partners API
export const partnersApi = {
  getPartners: (params) => axios.get(`${API_URL}/partners`, { params }),
  getPartner: (id) => axios.get(`${API_URL}/partners/${id}`),
  createPartner: (data) => axios.post(`${API_URL}/partners`, data),
  updatePartner: (id, data) => axios.put(`${API_URL}/partners/${id}`, data),
  deletePartner: (id) => axios.delete(`${API_URL}/partners/${id}`),
  togglePartner: (id) => axios.patch(`${API_URL}/partners/${id}/toggle`),
};

// Inspection Templates API
export const inspectionTemplatesApi = {
  getTemplates: (params) => axios.get(`${API_URL}/inspection-templates`, { params }),
  getTemplate: (id) => axios.get(`${API_URL}/inspection-templates/${id}`),
  createTemplate: (data) => axios.post(`${API_URL}/inspection-templates`, data),
  updateTemplate: (id, data) => axios.put(`${API_URL}/inspection-templates/${id}`, data),
  deleteTemplate: (id) => axios.delete(`${API_URL}/inspection-templates/${id}`),
  toggleTemplate: (id) => axios.patch(`${API_URL}/inspection-templates/${id}/toggle`),
  setDefault: (id) => axios.patch(`${API_URL}/inspection-templates/${id}/set-default`),
  seedDefault: () => axios.post(`${API_URL}/inspection-templates/seed-default`),
};

// Report Templates API
export const reportTemplatesApi = {
  getTemplates: (params) => axios.get(`${API_URL}/report-templates`, { params }),
  getTemplate: (id) => axios.get(`${API_URL}/report-templates/${id}`),
  createTemplate: (data) => axios.post(`${API_URL}/report-templates`, data),
  updateTemplate: (id, data) => axios.put(`${API_URL}/report-templates/${id}`, data),
  deleteTemplate: (id) => axios.delete(`${API_URL}/report-templates/${id}`),
  toggleTemplate: (id) => axios.patch(`${API_URL}/report-templates/${id}/toggle`),
  setDefault: (id) => axios.patch(`${API_URL}/report-templates/${id}/set-default`),
  getStyles: () => axios.get(`${API_URL}/report-templates/styles`),
  seedSamples: () => axios.post(`${API_URL}/report-templates/seed-samples`),
  getByPartner: (partnerId) => axios.get(`${API_URL}/report-templates/by-partner/${partnerId}`),
};

// Comprehensive HR API
export const hrApi = {
  // Dashboard Stats
  getDashboardStats: (countryId) => axios.get(`${API_URL}/hr/dashboard-stats`, { params: { country_id: countryId } }),
  getEmployeesOnLeaveToday: (countryId) => axios.get(`${API_URL}/hr/employees/on-leave-today`, { params: { country_id: countryId } }),
  
  // Employees
  getEmployees: (params) => axios.get(`${API_URL}/hr/employees`, { params }),
  getEmployee: (id) => axios.get(`${API_URL}/hr/employees/${id}`),
  createEmployee: (data) => axios.post(`${API_URL}/hr/employees`, data),
  updateEmployee: (id, data) => axios.put(`${API_URL}/hr/employees/${id}`, data),
  deleteEmployee: (id) => axios.delete(`${API_URL}/hr/employees/${id}`),
  
  // Password Management
  resetPassword: (id, newPassword) => axios.post(`${API_URL}/hr/employees/${id}/reset-password`, { new_password: newPassword }),
  
  // Salary Structure
  getEmployeeSalary: (id) => axios.get(`${API_URL}/hr/employees/${id}/salary`),
  saveEmployeeSalary: (id, data) => axios.post(`${API_URL}/hr/employees/${id}/salary`, data),
  
  // Salary Payments (History)
  getSalaryPayments: (id, params) => axios.get(`${API_URL}/hr/employees/${id}/salary-payments`, { params }),
  saveSalaryPayment: (id, data) => axios.post(`${API_URL}/hr/employees/${id}/salary-payments`, data),
  
  // Leave Summary
  getLeaveSummary: (id, params) => axios.get(`${API_URL}/hr/employees/${id}/leave-summary`, { params }),
  
  // Attendance
  getEmployeeAttendance: (id, params) => axios.get(`${API_URL}/hr/employees/${id}/attendance`, { params }),
  saveEmployeeAttendance: (id, data) => axios.post(`${API_URL}/hr/employees/${id}/attendance`, data),
  markAttendance: (data) => axios.post(`${API_URL}/hr/attendance/mark`, data),
  
  // Documents
  getEmployeeDocuments: (id) => axios.get(`${API_URL}/hr/employees/${id}/documents`),
  addEmployeeDocument: (id, data) => axios.post(`${API_URL}/hr/employees/${id}/documents`, data),
  uploadEmployeeDocument: (id, formData) => axios.post(`${API_URL}/hr/employees/${id}/documents/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  downloadEmployeeDocument: (id, filename) => axios.get(`${API_URL}/hr/employees/${id}/documents/file/${filename}`, {
    responseType: 'blob'
  }),
  verifyEmployeeDocument: (id, docId) => axios.put(`${API_URL}/hr/employees/${id}/documents/${docId}/verify`),
  updateEmployeeDocument: (id, docId, data) => axios.put(`${API_URL}/hr/employees/${id}/documents/${docId}`, data),
  deleteEmployeeDocument: (id, docId) => axios.delete(`${API_URL}/hr/employees/${id}/documents/${docId}`),
  
  // Audit
  getEmployeeAudit: (id) => axios.get(`${API_URL}/hr/employees/${id}/audit`),
  
  // Lead Assignment Control
  toggleLeadAssignment: (id, data) => axios.patch(`${API_URL}/hr/employees/${id}/lead-assignment`, data),
  updateWeeklyOff: (id, data) => axios.patch(`${API_URL}/hr/employees/${id}/weekly-off`, data),
  
  // Assigned Cities (for Sales reps)
  getAssignedCities: (id) => axios.get(`${API_URL}/hr/employees/${id}/assigned-cities`),
  updateAssignedCities: (id, cities) => axios.put(`${API_URL}/hr/employees/${id}/assigned-cities`, { employee_id: id, cities }),
  
  // Inspection Cities (for Mechanics)
  getInspectionCities: (id) => axios.get(`${API_URL}/hr/employees/${id}/inspection-cities`),
  updateInspectionCities: (id, cities) => axios.put(`${API_URL}/hr/employees/${id}/inspection-cities`, { employee_id: id, cities }),
  
  // Countries
  getCountries: () => axios.get(`${API_URL}/hr/countries`),
  getAllCountries: () => axios.get(`${API_URL}/hr/countries/all`),
  createCountry: (data) => axios.post(`${API_URL}/hr/countries`, data),
  updateCountry: (id, data) => axios.put(`${API_URL}/hr/countries/${id}`, data),
  deleteCountry: (id) => axios.delete(`${API_URL}/hr/countries/${id}`),
};

// Public Countries API (for login)
export const publicApi = {
  getLoginCountries: () => axios.get(`${API_URL}/countries/login`),
};

// Leave Rules API
export const leaveRulesApi = {
  get: () => axios.get(`${API_URL}/leave-rules`),
  update: (data) => axios.put(`${API_URL}/leave-rules`, data),
};

// Legacy Salary/HR API (for backward compatibility)
export const salaryApi = {
  getAll: (params) => axios.get(`${API_URL}/salaries`, { params }),
  getByUser: (userId) => axios.get(`${API_URL}/salaries/${userId}`),
  create: (data) => axios.post(`${API_URL}/salaries`, data),
  update: (id, data) => axios.put(`${API_URL}/salaries/${id}`, data),
};

// Audit Logs API
export const auditLogsApi = {
  getAll: (params) => axios.get(`${API_URL}/audit-logs`, { params }),
  getByEntity: (entityType, entityId) => axios.get(`${API_URL}/audit-logs/entity/${entityType}/${entityId}`),
  getStats: () => axios.get(`${API_URL}/audit-logs/stats`),
};

// Finance API
export const financeApi = {
  // Payments
  getPayments: (params) => axios.get(`${API_URL}/finance/payments`, { params }),
  getPayment: (id) => axios.get(`${API_URL}/finance/payments/${id}`),
  createPayment: (data) => axios.post(`${API_URL}/finance/payments`, data),
  updatePayment: (id, data) => axios.put(`${API_URL}/finance/payments/${id}`, data),
  deletePayment: (id) => axios.delete(`${API_URL}/finance/payments/${id}`),
  
  // Workflow
  submitForApproval: (id) => axios.patch(`${API_URL}/finance/payments/${id}/submit`),
  approvePayment: (id, data) => axios.patch(`${API_URL}/finance/payments/${id}/approve`, data),
  markAsPaid: (id, params) => axios.patch(`${API_URL}/finance/payments/${id}/mark-paid`, null, { params }),
  
  // Proofs
  getProofs: (paymentId) => axios.get(`${API_URL}/finance/payments/${paymentId}/proofs`),
  addProof: (paymentId, params) => axios.post(`${API_URL}/finance/payments/${paymentId}/proofs`, null, { params }),
  deleteProof: (paymentId, proofId) => axios.delete(`${API_URL}/finance/payments/${paymentId}/proofs/${proofId}`),
  
  // Payslip
  getPayslip: (paymentId) => axios.get(`${API_URL}/finance/payments/${paymentId}/payslip`),
  
  // Summary
  getSummary: (params) => axios.get(`${API_URL}/finance/summary`, { params }),
  
  // Employees for payment
  getEmployees: (params) => axios.get(`${API_URL}/finance/employees`, { params }),
  
  // Payment modes
  getPaymentModes: () => axios.get(`${API_URL}/finance/payment-modes`),
};

// ==================== HOLIDAY CALENDAR APIs ====================

export const holidayApi = {
  getAll: (params) => axios.get(`${API_URL}/hr/holidays`, { params }),
  create: (data) => axios.post(`${API_URL}/hr/holidays`, data),
  update: (id, data) => axios.put(`${API_URL}/hr/holidays/${id}`, data),
  delete: (id) => axios.delete(`${API_URL}/hr/holidays/${id}`),
};

// ==================== HR MODULE APIs ====================

export const attendanceApi = {
  // Session management
  startSession: () => axios.post(`${API_URL}/hr/session/start`),
  heartbeat: () => axios.post(`${API_URL}/hr/session/heartbeat`),
  endSession: () => axios.post(`${API_URL}/hr/session/end`),
  
  // Active sessions (HR view)
  getActiveSessions: (countryId) => axios.get(`${API_URL}/hr/sessions/active`, { params: { country_id: countryId } }),
  forceLogout: (sessionId) => axios.post(`${API_URL}/hr/sessions/${sessionId}/force-logout`),
  
  // Attendance records
  getAttendance: (params) => axios.get(`${API_URL}/hr/attendance`, { params }),
  getAttendanceSummary: (employeeId, month, year) => axios.get(`${API_URL}/hr/attendance/summary/${employeeId}`, { params: { month, year } }),
  getPendingApprovals: (countryId) => axios.get(`${API_URL}/hr/attendance/pending-approvals`, { params: { country_id: countryId } }),
  overrideAttendance: (recordId, data) => axios.post(`${API_URL}/hr/attendance/${recordId}/override`, data),
  calculateDaily: (date) => axios.post(`${API_URL}/hr/attendance/calculate-daily`, null, { params: { date } }),
  
  // Attendance Calendar (consolidated view)
  getCalendar: (month, year, countryId, search) => axios.get(`${API_URL}/hr/attendance/calendar`, { 
    params: { month, year, country_id: countryId, search } 
  }),
  
  // HR: Update individual day attendance status
  updateDayStatus: (data) => axios.post(`${API_URL}/hr/attendance/update-day`, data),
};

export const payrollApi = {
  // Payroll generation (legacy - kept for backward compatibility)
  generate: (data) => axios.post(`${API_URL}/hr/payroll/generate`, data),
  generateBulk: (data) => axios.post(`${API_URL}/hr/payroll/generate-bulk`, data),
  
  // Payroll records
  getAll: (params) => axios.get(`${API_URL}/hr/payroll`, { params }),
  getById: (payrollId) => axios.get(`${API_URL}/hr/payroll/${payrollId}`),
  getSummary: (month, year, countryId) => axios.get(`${API_URL}/hr/payroll/summary/${month}/${year}`, { params: { country_id: countryId } }),
  
  // Payment marking (legacy)
  markPaid: (payrollId, data) => axios.post(`${API_URL}/hr/payroll/${payrollId}/mark-paid`, data),
  
  // Adjustments
  createAdjustment: (payrollId, data) => axios.post(`${API_URL}/hr/payroll/${payrollId}/adjustment`, data),
  getAdjustments: (payrollId) => axios.get(`${API_URL}/hr/payroll/${payrollId}/adjustments`),
  
  // Payslip
  generatePayslip: (payrollId) => axios.post(`${API_URL}/hr/payroll/${payrollId}/generate-payslip`),
  downloadPayslip: (payrollId) => axios.get(`${API_URL}/hr/payroll/${payrollId}/payslip`, { responseType: 'blob' }),
  
  // Employee payslips (for employee modal)
  getEmployeePayslips: (employeeId) => axios.get(`${API_URL}/hr/payroll/employee/${employeeId}/payslips`),
  
  // ==================== BATCH-BASED PAYROLL (NEW GOVERNANCE) ====================
  
  // Preview payroll (no DB save)
  preview: (data) => axios.post(`${API_URL}/hr/payroll/preview`, data),
  
  // Batch management
  createBatch: (data) => axios.post(`${API_URL}/hr/payroll/batch`, data),
  getBatches: (params) => axios.get(`${API_URL}/hr/payroll/batches`, { 
    params: {
      country_id: params?.country_id,
      batch_status: params?.status,  // Map status to batch_status
      year: params?.year
    } 
  }),
  getBatch: (batchId) => axios.get(`${API_URL}/hr/payroll/batch/${batchId}`),
  
  // Update record in DRAFT batch
  updateBatchRecord: (batchId, recordId, data) => axios.put(`${API_URL}/hr/payroll/batch/${batchId}/record/${recordId}`, data),
  
  // Batch lifecycle
  confirmBatch: (batchId, data) => axios.post(`${API_URL}/hr/payroll/batch/${batchId}/confirm`, data || {}),
  markBatchPaid: (batchId, data) => axios.post(`${API_URL}/hr/payroll/batch/${batchId}/mark-paid`, data),
  deleteBatch: (batchId) => axios.delete(`${API_URL}/hr/payroll/batch/${batchId}`),
};

export const leaveApi = {
  // Apply for leave
  apply: (data) => axios.post(`${API_URL}/hr/leave/apply`, data),
  
  // My requests & balance
  getMyRequests: (year, status) => axios.get(`${API_URL}/hr/leave/my-requests`, { params: { year, leave_status: status } }),
  getMyBalance: (year) => axios.get(`${API_URL}/hr/leave/my-balance`, { params: { year } }),
  
  // Approval workflow
  getPendingApprovals: (countryId, teamId) => axios.get(`${API_URL}/hr/leave/pending-approvals`, { params: { country_id: countryId, team_id: teamId } }),
  approve: (requestId, data) => axios.post(`${API_URL}/hr/leave/${requestId}/approve`, data),
  cancel: (requestId, reason) => axios.post(`${API_URL}/hr/leave/${requestId}/cancel`, null, { params: { reason } }),
  
  // Employee leave info
  getEmployeeLeaves: (employeeId, year) => axios.get(`${API_URL}/hr/leave/employee/${employeeId}`, { params: { year } }),
  getEmployeeBalance: (employeeId, year) => axios.get(`${API_URL}/hr/leave/employee/${employeeId}/balance`, { params: { year } }),
  
  // Team summary
  getTeamSummary: (teamId, countryId) => axios.get(`${API_URL}/hr/leave/team-summary`, { params: { team_id: teamId, country_id: countryId } }),
};

// ==================== INSPECTION PACKAGES APIs ====================

export const inspectionPackagesApi = {
  // Categories
  getCategories: (countryId) => axios.get(`${API_URL}/inspection-categories`, { params: { country_id: countryId } }),
  createCategory: (data, countryId) => axios.post(`${API_URL}/inspection-categories`, data, { params: { country_id: countryId } }),
  updateCategory: (id, data) => axios.put(`${API_URL}/inspection-categories/${id}`, data),
  toggleCategoryStatus: (id) => axios.patch(`${API_URL}/inspection-categories/${id}/toggle-status`),
  deleteCategory: (id) => axios.delete(`${API_URL}/inspection-categories/${id}`),
  
  // Packages
  getPackages: (countryId) => axios.get(`${API_URL}/inspection-packages`, { params: { country_id: countryId } }),
  createPackage: (data) => axios.post(`${API_URL}/inspection-packages`, data),
  updatePackage: (id, data) => axios.put(`${API_URL}/inspection-packages/${id}`, data),
  togglePackageStatus: (id) => axios.patch(`${API_URL}/inspection-packages/${id}/toggle-status`),
  deletePackage: (id) => axios.delete(`${API_URL}/inspection-packages/${id}`),
  
  // Offers
  getOffers: (countryId) => axios.get(`${API_URL}/offers`, { params: { country_id: countryId } }),
  getActiveOffers: (countryId) => axios.get(`${API_URL}/offers/active`, { params: { country_id: countryId } }),
  createOffer: (data) => axios.post(`${API_URL}/offers`, data),
  updateOffer: (id, data) => axios.put(`${API_URL}/offers/${id}`, data),
  toggleOfferStatus: (id) => axios.patch(`${API_URL}/offers/${id}/toggle-status`),
  deleteOffer: (id) => axios.delete(`${API_URL}/offers/${id}`),
};

// Repairs Module API
export const repairsApi = {
  // Repair Parts
  getParts: (params) => axios.get(`${API_URL}/repair-parts`, { params }),
  getPartCategories: () => axios.get(`${API_URL}/repair-parts/categories`),
  getPart: (id) => axios.get(`${API_URL}/repair-parts/${id}`),
  createPart: (data) => axios.post(`${API_URL}/repair-parts`, data),
  updatePart: (id, data) => axios.put(`${API_URL}/repair-parts/${id}`, data),
  deletePart: (id) => axios.delete(`${API_URL}/repair-parts/${id}`),
  
  // Repair Rules
  getRules: (params) => axios.get(`${API_URL}/repair-rules`, { params }),
  getRule: (id) => axios.get(`${API_URL}/repair-rules/${id}`),
  createRule: (data) => axios.post(`${API_URL}/repair-rules`, data),
  updateRule: (id, data) => axios.put(`${API_URL}/repair-rules/${id}`, data),
  deleteRule: (id) => axios.delete(`${API_URL}/repair-rules/${id}`),
  
  // Helper endpoints
  getAvailableQuestions: (countryId) => axios.get(`${API_URL}/repair-rules/available-questions`, { params: { country_id: countryId } }),
  calculateCost: (data) => axios.post(`${API_URL}/repair-parts/calculate-cost`, data),
};

// SMS Logs API
export const smsLogsApi = {
  getLogs: (params = {}) => axios.get(`${API_URL}/sms/logs`, { params }),
  getWalletBalance: () => axios.get(`${API_URL}/sms/wallet`),
  getStats: () => axios.get(`${API_URL}/sms/stats`),
  testSend: (phone) => axios.post(`${API_URL}/sms/test`, null, { params: { phone } }),
};

// Settings & Token Management API
export const settingsApi = {
  getTokenStatus: () => axios.get(`${API_URL}/settings/tokens`),
  updateToken: (tokenType, token) => axios.post(`${API_URL}/settings/tokens/update`, { token_type: tokenType, token }),
  testToken: (tokenType) => axios.post(`${API_URL}/settings/tokens/test/${tokenType}`),
  getTwilioBalance: () => axios.get(`${API_URL}/twilio/balance`),
  getFast2SmsBalance: () => axios.get(`${API_URL}/sms/wallet`),
};

// Loans API
export const loansApi = {
  // Loan Leads
  getAll: (params) => axios.get(`${API_URL}/loan-leads`, { params: { ...params, timezone_offset: getTimezoneOffset() } }),
  getById: (id) => axios.get(`${API_URL}/loan-leads/${id}`),
  update: (id, data) => axios.put(`${API_URL}/loan-leads/${id}`, data),
  syncCustomers: () => axios.get(`${API_URL}/loan-leads/sync-customers`),
  getStats: () => axios.get(`${API_URL}/loan-leads/stats`),
  
  // Documents
  getDocumentRequirements: (leadId) => axios.get(`${API_URL}/loan-leads/${leadId}/document-requirements`),
  generateUploadUrl: (leadId, data) => {
    return axios.post(`${API_URL}/loan-leads/${leadId}/documents/generate-upload-url`, {
      document_type: data.document_type,
      file_name: data.filename || data.file_name,
      content_type: data.content_type
    });
  },
  uploadDocument: (leadId, data) => {
    return axios.post(`${API_URL}/loan-leads/${leadId}/documents`, {
      document_type: data.document_type,
      file_url: data.file_url,
      file_name: data.file_name
    });
  },
  getDocumentDownloadUrl: (leadId, docId) => axios.post(`${API_URL}/loan-leads/${leadId}/documents/${docId}/download-url`),
  deleteDocument: (leadId, docId) => axios.delete(`${API_URL}/loan-leads/${leadId}/documents/${docId}`),
  
  // Credit Score
  requestCreditScoreOTP: (leadId, data) => axios.post(`${API_URL}/loan-leads/${leadId}/credit-score/request-otp`, data),
  verifyCreditScoreOTP: (leadId, data) => axios.post(`${API_URL}/loan-leads/${leadId}/credit-score/verify-otp`, data),
  getCreditScore: (leadId) => axios.get(`${API_URL}/loan-leads/${leadId}/credit-score`),
  
  // Vehicles
  addVehicle: (leadId, data) => axios.post(`${API_URL}/loan-leads/${leadId}/vehicles`, data),
  updateVehicle: (leadId, vehicleId, data) => axios.put(`${API_URL}/loan-leads/${leadId}/vehicles/${vehicleId}`, data),
  removeVehicle: (leadId, vehicleId) => axios.delete(`${API_URL}/loan-leads/${leadId}/vehicles/${vehicleId}`),
  fetchVaahanForVehicle: (leadId, vehicleId) => axios.post(`${API_URL}/loan-leads/${leadId}/vehicles/${vehicleId}/fetch-vaahan`),
  
  // Loan Processing
  checkEligibility: (leadId, vehicleId) => axios.post(`${API_URL}/loan-leads/${leadId}/vehicles/${vehicleId}/check-eligibility`),
  createApplication: (leadId, data) => axios.post(`${API_URL}/loan-leads/${leadId}/applications`, data),
  updateApplication: (leadId, appId, data) => axios.put(`${API_URL}/loan-leads/${leadId}/applications/${appId}`, data),
  
  // Loan Offers
  getOffers: (leadId) => axios.get(`${API_URL}/loan-leads/${leadId}/offers`),
  getOffer: (leadId, offerId) => axios.get(`${API_URL}/loan-leads/${leadId}/offers/${offerId}`),
  createOffer: (leadId, data) => axios.post(`${API_URL}/loan-leads/${leadId}/offers`, data),
  updateOffer: (leadId, offerId, data) => axios.put(`${API_URL}/loan-leads/${leadId}/offers/${offerId}`, data),
  acceptOffer: (leadId, offerId) => axios.post(`${API_URL}/loan-leads/${leadId}/offers/${offerId}/accept`),
  addChargeToOffer: (leadId, offerId, params) => axios.post(`${API_URL}/loan-leads/${leadId}/offers/${offerId}/add-charge`, null, { params }),
  removeChargeFromOffer: (leadId, offerId, chargeType) => axios.delete(`${API_URL}/loan-leads/${leadId}/offers/${offerId}/charges/${chargeType}`),
  createManualOffer: (leadId, params) => axios.post(`${API_URL}/loan-leads/${leadId}/manual-offer`, null, { params }),
  
  // Charge Types
  getChargeTypes: (includeInactive = false) => axios.get(`${API_URL}/charge-types`, { params: { include_inactive: includeInactive } }),
  createChargeType: (data) => axios.post(`${API_URL}/charge-types`, data),
  updateChargeType: (id, params) => axios.put(`${API_URL}/charge-types/${id}`, null, { params }),
  deleteChargeType: (id) => axios.delete(`${API_URL}/charge-types/${id}`),
  
  // Customer Profile
  getProfile: (leadId) => axios.get(`${API_URL}/loan-leads/${leadId}/profile`),
  updateProfile: (leadId, data) => axios.put(`${API_URL}/loan-leads/${leadId}/profile`, data),
  analyzeBankStatement: (leadId, documentId) => axios.post(`${API_URL}/loan-leads/${leadId}/profile/analyze-bank-statement?document_id=${documentId}`),
  syncCreditReport: (leadId) => axios.post(`${API_URL}/loan-leads/${leadId}/profile/sync-credit-report`),
  calculateEligibility: (leadId) => axios.post(`${API_URL}/loan-leads/${leadId}/profile/calculate-eligibility`),
  
  // Credit Reports (Surepass)
  fetchCibilReport: (data) => axios.post(`${API_URL}/credit-report/cibil`, data),
  fetchEquifaxReport: (data) => axios.post(`${API_URL}/credit-report/equifax`, data),
  fetchExperianReport: (data) => axios.post(`${API_URL}/credit-report/experian`, data),
  fetchCrifReport: (data) => axios.post(`${API_URL}/credit-report/crif`, data),
  getLatestReports: (pan) => axios.get(`${API_URL}/credit-report/latest/${pan}`),
};

// Bank Master API
export const banksApi = {
  getAll: (params) => axios.get(`${API_URL}/banks`, { params }),
  getById: (id) => axios.get(`${API_URL}/banks/${id}`),
  create: (data) => axios.post(`${API_URL}/banks`, data),
  update: (id, data) => axios.put(`${API_URL}/banks/${id}`, data),
  delete: (id) => axios.delete(`${API_URL}/banks/${id}`),
  addPOC: (bankId, data) => axios.post(`${API_URL}/banks/${bankId}/poc`, data),
};

// Credit Report API (Surepass Integration)
export const creditReportApi = {
  checkStatus: () => axios.get(`${API_URL}/credit-report/check-status`),
  
  // Get latest reports for a PAN (cached data)
  getLatestReports: (pan) => axios.get(`${API_URL}/credit-report/latest/${pan}`),
  
  // CIBIL Reports
  fetchCibilReport: (data) => axios.post(`${API_URL}/credit-report/cibil`, data),
  fetchCibilPdf: (data) => axios.post(`${API_URL}/credit-report/cibil/pdf`, data),
  
  // Equifax Reports
  fetchEquifaxReport: (data) => axios.post(`${API_URL}/credit-report/equifax`, data),
  fetchEquifaxPdf: (data) => axios.post(`${API_URL}/credit-report/equifax/pdf`, data),
  
  // Experian Reports
  fetchExperianReport: (data) => axios.post(`${API_URL}/credit-report/experian`, data),
  fetchExperianPdf: (data) => axios.post(`${API_URL}/credit-report/experian/pdf`, data),
  
  // CRIF Commercial Reports
  fetchCrifReport: (data) => axios.post(`${API_URL}/credit-report/crif`, data),
  fetchCrifPdf: (data) => axios.post(`${API_URL}/credit-report/crif/pdf`, data),
  
  // Get Reports
  getReport: (reportId) => axios.get(`${API_URL}/credit-report/${reportId}`),
  getReportHistory: (pan) => axios.get(`${API_URL}/credit-report/history/${pan}`),
  getByLoanLead: (loanLeadId) => axios.get(`${API_URL}/credit-report/by-loan-lead/${loanLeadId}`),
};

