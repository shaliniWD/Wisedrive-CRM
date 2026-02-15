// API Configuration
// Production endpoint - using stable custom domain
export const API_BASE_URL = 'https://crmdev.wisedrive.com/api';

export const API_ENDPOINTS = {
  // Auth
  LOGIN: '/ess/v1/auth/login',
  REFRESH: '/ess/v1/auth/refresh',
  LOGOUT: '/ess/v1/auth/logout',
  PUSH_TOKEN: '/ess/v1/auth/push-token',
  SESSION: '/ess/v1/auth/session',
  
  // Profile
  PROFILE: '/ess/v1/profile',
  BANK_DETAILS: '/ess/v1/profile/bank-details',
  SALARY: '/ess/v1/profile/salary',
  ATTENDANCE: '/ess/v1/profile/attendance',
  HOLIDAYS: '/ess/v1/holidays',
  
  // Leave
  LEAVE_APPLY: '/ess/v1/leave/apply',
  LEAVE_BALANCE: '/ess/v1/leave/balance',
  LEAVE_HISTORY: '/ess/v1/leave/history',
  LEAVE_CANCEL: (id: string) => `/ess/v1/leave/${id}/cancel`,
  LEAVE_DETAIL: (id: string) => `/ess/v1/leave/${id}`,
  LEAVE_PENDING_APPROVALS: '/ess/v1/leave/pending-approvals',
  LEAVE_ACTION: (id: string) => `/ess/v1/leave/${id}/action`,
  
  // Payslips
  PAYSLIPS: '/ess/v1/payslips',
  PAYSLIP_DETAIL: (id: string) => `/ess/v1/payslips/${id}`,
  PAYSLIP_DOWNLOAD: (id: string) => `/ess/v1/payslips/${id}/download`,
  PAYSLIP_YEARS: '/ess/v1/payslips/years',
  
  // Documents
  DOCUMENTS: '/ess/v1/documents',
  DOCUMENT_DETAIL: (id: string) => `/ess/v1/documents/${id}`,
  DOCUMENT_REQUIREMENTS: '/ess/v1/documents/requirements',
  
  // Notifications
  NOTIFICATIONS: '/ess/v1/notifications',
  NOTIFICATIONS_READ: '/ess/v1/notifications/read',
  NOTIFICATIONS_SETTINGS: '/ess/v1/notifications/settings',
  NOTIFICATIONS_UNREAD: '/ess/v1/notifications/unread-count',
};
