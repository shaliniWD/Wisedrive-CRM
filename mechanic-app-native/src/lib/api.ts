import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API Base URL - Production CRM backend
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://crmdev.wisedrive.com/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    console.log('Error getting token:', e);
  }
  return config;
});

// Auth API
export const authApi = {
  requestOtp: async (phone: string) => {
    const response = await api.post('/auth/request-otp', { phone });
    return response.data;
  },

  verifyOtp: async (phone: string, otp: string) => {
    const response = await api.post('/auth/verify-otp', { phone, otp });
    return response.data;
  },
};

// Inspections API
export const inspectionsApi = {
  getInspections: async (params: { status?: string; city?: string; date_filter?: string } = {}) => {
    const response = await api.get('/mechanic/inspections', { params });
    return response.data;
  },

  getInspection: async (id: string) => {
    const response = await api.get(`/mechanic/inspections/${id}`);
    return response.data;
  },

  acceptInspection: async (id: string) => {
    const response = await api.post(`/mechanic/inspections/${id}/accept`);
    return response.data;
  },

  rejectInspection: async (id: string, reason?: string) => {
    const response = await api.post(`/mechanic/inspections/${id}/reject`, { reason });
    return response.data;
  },

  saveProgress: async (id: string, progressData: any) => {
    const response = await api.post(`/mechanic/inspections/${id}/progress`, { progress_data: progressData });
    return response.data;
  },

  completeInspection: async (id: string) => {
    const response = await api.post(`/mechanic/inspections/${id}/complete`);
    return response.data;
  },

  getQuestionnaire: async (id: string) => {
    const response = await api.get(`/inspections/${id}/questionnaire`);
    return response.data;
  },

  // Save OBD scan results
  saveObdResults: async (inspectionId: string, obdData: any) => {
    const response = await api.post(`/mechanic/inspections/${inspectionId}/obd-results`, obdData);
    return response.data;
  },
};

// Push Notifications API
export const pushNotificationApi = {
  registerToken: async (deviceToken: string, platform: string = 'ios', deviceInfo?: any) => {
    const response = await api.post('/mechanic/push-token', {
      device_token: deviceToken,
      platform,
      device_info: deviceInfo,
    });
    return response.data;
  },

  unregisterToken: async () => {
    const response = await api.delete('/mechanic/push-token');
    return response.data;
  },

  getNotifications: async (limit: number = 50) => {
    const response = await api.get('/mechanic/notifications', { params: { limit } });
    return response.data;
  },

  markAsRead: async (notificationId: string) => {
    const response = await api.patch(`/mechanic/notifications/${notificationId}/read`);
    return response.data;
  },
};

// Upload API
export const uploadApi = {
  uploadFile: async (uri: string, type: string = 'photo') => {
    const formData = new FormData();
    const filename = uri.split('/').pop() || 'file';
    const match = /\.(\w+)$/.exec(filename);
    const fileType = match ? `image/${match[1]}` : 'image/jpeg';

    formData.append('file', {
      uri,
      name: filename,
      type: fileType,
    } as any);
    formData.append('type', type);

    const response = await api.post('/uploads', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};

export default api;
