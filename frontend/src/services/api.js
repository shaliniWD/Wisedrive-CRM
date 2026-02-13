import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Leads API
export const leadsApi = {
  getAll: (params) => axios.get(`${API_URL}/leads`, { params }),
  create: (data) => axios.post(`${API_URL}/leads`, data),
  update: (id, data) => axios.put(`${API_URL}/leads/${id}`, data),
  delete: (id) => axios.delete(`${API_URL}/leads/${id}`),
};

// Customers API
export const customersApi = {
  getAll: (params) => axios.get(`${API_URL}/customers`, { params }),
  create: (data) => axios.post(`${API_URL}/customers`, data),
  update: (id, data) => axios.put(`${API_URL}/customers/${id}`, data),
  delete: (id) => axios.delete(`${API_URL}/customers/${id}`),
};

// Inspections API
export const inspectionsApi = {
  getAll: (params) => axios.get(`${API_URL}/inspections`, { params }),
  create: (data) => axios.post(`${API_URL}/inspections`, data),
  update: (id, data) => axios.put(`${API_URL}/inspections/${id}`, data),
  delete: (id) => axios.delete(`${API_URL}/inspections/${id}`),
};

// Employees API
export const employeesApi = {
  getAll: () => axios.get(`${API_URL}/employees`),
  create: (data) => axios.post(`${API_URL}/employees`, data),
  update: (id, data) => axios.put(`${API_URL}/employees/${id}`, data),
  toggleStatus: (id) => axios.patch(`${API_URL}/employees/${id}/toggle-status`),
  assignCity: (id, city) => axios.patch(`${API_URL}/employees/${id}/assign-city`, null, { params: { city } }),
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
