// API Service - Handles all API calls
import axios, { AxiosInstance, AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL, API_ENDPOINTS } from './config';

// Storage keys
const ACCESS_TOKEN_KEY = 'ess_access_token';
const REFRESH_TOKEN_KEY = 'ess_refresh_token';
const DEVICE_ID_KEY = 'ess_device_id';
const USER_KEY = 'ess_user';

// Create axios instance
const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle token refresh
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;
    
    // If 401 and not already retrying
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
        const deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
        
        if (refreshToken && deviceId) {
          const response = await axios.post(`${API_BASE_URL}${API_ENDPOINTS.REFRESH}`, {
            refresh_token: refreshToken,
            device_id: deviceId,
          });
          
          const { access_token, refresh_token } = response.data;
          
          await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, access_token);
          await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refresh_token);
          
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed - user needs to login again
        await clearAuth();
        throw new Error('SESSION_EXPIRED');
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth functions
export const saveAuth = async (accessToken: string, refreshToken: string, deviceId: string, user: any) => {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, accessToken);
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, refreshToken);
  await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
};

export const clearAuth = async () => {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
};

export const getStoredUser = async () => {
  const userJson = await SecureStore.getItemAsync(USER_KEY);
  return userJson ? JSON.parse(userJson) : null;
};

export const getDeviceId = async () => {
  let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
};

// API Methods

// Auth
export const login = async (email: string, password: string, deviceInfo: any) => {
  const response = await api.post(API_ENDPOINTS.LOGIN, {
    email,
    password,
    device: deviceInfo,
  });
  return response.data;
};

export const logout = async (deviceId: string, allDevices = false) => {
  const response = await api.post(API_ENDPOINTS.LOGOUT, {
    device_id: deviceId,
    all_devices: allDevices,
  });
  return response.data;
};

export const registerPushToken = async (deviceId: string, pushToken: string, platform: string) => {
  const response = await api.post(API_ENDPOINTS.PUSH_TOKEN, {
    device_id: deviceId,
    push_token: pushToken,
    platform,
  });
  return response.data;
};

// Profile
export const getProfile = async () => {
  const response = await api.get(API_ENDPOINTS.PROFILE);
  return response.data;
};

export const updateProfile = async (data: any) => {
  const response = await api.patch(API_ENDPOINTS.PROFILE, data);
  return response.data;
};

export const getBankDetails = async () => {
  const response = await api.get(API_ENDPOINTS.BANK_DETAILS);
  return response.data;
};

export const getSalarySummary = async () => {
  const response = await api.get(API_ENDPOINTS.SALARY);
  return response.data;
};

export const getAttendanceSummary = async (month?: number, year?: number) => {
  const params = new URLSearchParams();
  if (month) params.append('month', month.toString());
  if (year) params.append('year', year.toString());
  const response = await api.get(`${API_ENDPOINTS.ATTENDANCE}?${params}`);
  return response.data;
};

export const getHolidays = async (year?: number) => {
  const params = year ? `?year=${year}` : '';
  const response = await api.get(`${API_ENDPOINTS.HOLIDAYS}${params}`);
  return response.data;
};

// Leave
export const applyLeave = async (leaveData: any) => {
  const response = await api.post(API_ENDPOINTS.LEAVE_APPLY, leaveData);
  return response.data;
};

export const getLeaveBalance = async (year?: number) => {
  const params = year ? `?year=${year}` : '';
  const response = await api.get(`${API_ENDPOINTS.LEAVE_BALANCE}${params}`);
  return response.data;
};

// Get period-based leave balance (monthly/quarterly with no carry forward)
export const getLeavePeriodBalance = async () => {
  const response = await api.get(API_ENDPOINTS.LEAVE_PERIOD_BALANCE);
  return response.data;
};

export const getLeaveHistory = async (page = 1, pageSize = 20, status?: string, year?: number) => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('page_size', pageSize.toString());
  if (status) params.append('status', status);
  if (year) params.append('year', year.toString());
  const response = await api.get(`${API_ENDPOINTS.LEAVE_HISTORY}?${params}`);
  return response.data;
};

export const getLeaveDetail = async (leaveId: string) => {
  const response = await api.get(API_ENDPOINTS.LEAVE_DETAIL(leaveId));
  return response.data;
};

export const cancelLeave = async (leaveId: string) => {
  const response = await api.post(API_ENDPOINTS.LEAVE_CANCEL(leaveId));
  return response.data;
};

export const getPendingApprovals = async () => {
  const response = await api.get(API_ENDPOINTS.LEAVE_PENDING_APPROVALS);
  return response.data;
};

export const approveRejectLeave = async (leaveId: string, action: 'approve' | 'reject', comments?: string) => {
  const response = await api.post(API_ENDPOINTS.LEAVE_ACTION(leaveId), {
    action,
    comments,
  });
  return response.data;
};

// Payslips
export const getPayslips = async (page = 1, pageSize = 12, year?: number) => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('page_size', pageSize.toString());
  if (year) params.append('year', year.toString());
  const response = await api.get(`${API_ENDPOINTS.PAYSLIPS}?${params}`);
  return response.data;
};

export const getPayslipDetail = async (payslipId: string) => {
  const response = await api.get(API_ENDPOINTS.PAYSLIP_DETAIL(payslipId));
  return response.data;
};

export const getPayslipYears = async () => {
  const response = await api.get(API_ENDPOINTS.PAYSLIP_YEARS);
  return response.data;
};

// Documents
export const getDocuments = async (documentType?: string) => {
  const params = documentType ? `?document_type=${documentType}` : '';
  const response = await api.get(`${API_ENDPOINTS.DOCUMENTS}${params}`);
  return response.data;
};

export const getDocumentRequirements = async () => {
  const response = await api.get(API_ENDPOINTS.DOCUMENT_REQUIREMENTS);
  return response.data;
};

// Notifications
export const getNotifications = async (page = 1, pageSize = 20, unreadOnly = false) => {
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('page_size', pageSize.toString());
  if (unreadOnly) params.append('unread_only', 'true');
  const response = await api.get(`${API_ENDPOINTS.NOTIFICATIONS}?${params}`);
  return response.data;
};

export const markNotificationsRead = async (notificationIds?: string[], markAll = false) => {
  const response = await api.post(API_ENDPOINTS.NOTIFICATIONS_READ, {
    notification_ids: notificationIds || [],
    mark_all: markAll,
  });
  return response.data;
};

export const getNotificationSettings = async () => {
  const response = await api.get(API_ENDPOINTS.NOTIFICATIONS_SETTINGS);
  return response.data;
};

export const updateNotificationSettings = async (settings: any) => {
  const response = await api.patch(API_ENDPOINTS.NOTIFICATIONS_SETTINGS, settings);
  return response.data;
};

export const getUnreadCount = async () => {
  const response = await api.get(API_ENDPOINTS.NOTIFICATIONS_UNREAD);
  return response.data;
};

export default api;
