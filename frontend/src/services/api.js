import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Leads API
export const leadsApi = {
  getAll: (params) => axios.get(`${API_URL}/leads`, { params }),
  create: (data) => axios.post(`${API_URL}/leads`, data),
  update: (id, data) => axios.put(`${API_URL}/leads/${id}`, data),
  updateStatus: (id, status) => axios.patch(`${API_URL}/leads/${id}/status`, { status }),
  delete: (id) => axios.delete(`${API_URL}/leads/${id}`),
  reassign: (id, data) => axios.post(`${API_URL}/leads/${id}/reassign`, data),
  getReassignmentHistory: (id) => axios.get(`${API_URL}/leads/${id}/reassignment-history`),
};

// Customers API
export const customersApi = {
  getAll: (params) => axios.get(`${API_URL}/customers`, { params }),
  getById: (id) => axios.get(`${API_URL}/customers/${id}`),
  create: (data) => axios.post(`${API_URL}/customers`, data),
  update: (id, data) => axios.put(`${API_URL}/customers/${id}`, data),
  delete: (id) => axios.delete(`${API_URL}/customers/${id}`),
};

// Transactions API
export const transactionsApi = {
  getByCustomer: (customerId) => axios.get(`${API_URL}/transactions/${customerId}`),
  create: (data) => axios.post(`${API_URL}/transactions`, data),
};

// Inspections API
export const inspectionsApi = {
  getAll: (params) => axios.get(`${API_URL}/inspections`, { params }),
  getById: (id) => axios.get(`${API_URL}/inspections/${id}`),
  create: (data) => axios.post(`${API_URL}/inspections`, data),
  update: (id, data) => axios.put(`${API_URL}/inspections/${id}`, data),
  delete: (id) => axios.delete(`${API_URL}/inspections/${id}`),
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
  getCities: () => axios.get(`${API_URL}/cities`),
  getLeadSources: () => axios.get(`${API_URL}/lead-sources`),
  getLeadStatuses: () => axios.get(`${API_URL}/lead-statuses`),
};

// Seed API
export const seedApi = {
  seed: () => axios.post(`${API_URL}/seed`),
  clearAndSeed: () => axios.post(`${API_URL}/seed/clear`),
};

// Comprehensive HR API
export const hrApi = {
  // Employees
  getEmployees: (params) => axios.get(`${API_URL}/hr/employees`, { params }),
  getEmployee: (id) => axios.get(`${API_URL}/hr/employees/${id}`),
  createEmployee: (data) => axios.post(`${API_URL}/hr/employees`, data),
  updateEmployee: (id, data) => axios.put(`${API_URL}/hr/employees/${id}`, data),
  deleteEmployee: (id) => axios.delete(`${API_URL}/hr/employees/${id}`),
  
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
  
  // Documents
  getEmployeeDocuments: (id) => axios.get(`${API_URL}/hr/employees/${id}/documents`),
  addEmployeeDocument: (id, data) => axios.post(`${API_URL}/hr/employees/${id}/documents`, data),
  updateEmployeeDocument: (id, docId, data) => axios.put(`${API_URL}/hr/employees/${id}/documents/${docId}`, data),
  deleteEmployeeDocument: (id, docId) => axios.delete(`${API_URL}/hr/employees/${id}/documents/${docId}`),
  
  // Audit
  getEmployeeAudit: (id) => axios.get(`${API_URL}/hr/employees/${id}/audit`),
  
  // Lead Assignment Control
  toggleLeadAssignment: (id, data) => axios.patch(`${API_URL}/hr/employees/${id}/lead-assignment`, data),
  updateWeeklyOff: (id, data) => axios.patch(`${API_URL}/hr/employees/${id}/weekly-off`, data),
  
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
