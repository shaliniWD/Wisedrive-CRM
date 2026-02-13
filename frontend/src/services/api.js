import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Leads API
export const leadsApi = {
  getAll: (params) => axios.get(`${API_URL}/leads`, { params }),
  create: (data) => axios.post(`${API_URL}/leads`, data),
  update: (id, data) => axios.put(`${API_URL}/leads/${id}`, data),
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
