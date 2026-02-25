import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { debugLogger } from './logger';

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
    await debugLogger.log('DEBUG', 'API_REQUEST', `Interceptor: ${config.method?.toUpperCase()} ${config.url}`, {
      tokenPresent: !!token,
      baseURL: API_BASE_URL,
    });
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    } else {
      await debugLogger.log('WARN', 'API_REQUEST', 'No auth token found in AsyncStorage');
    }
  } catch (e: any) {
    await debugLogger.log('ERROR', 'API_REQUEST', 'Error getting token from storage', { error: e.message });
  }
  return config;
});

// Add response interceptor for better error handling
api.interceptors.response.use(
  async (response) => {
    await debugLogger.log('DEBUG', 'API_RESPONSE', `Success: ${response.config.method?.toUpperCase()} ${response.config.url}`, {
      status: response.status,
      dataKeys: response.data ? Object.keys(response.data) : [],
    });
    return response;
  },
  async (error) => {
    await debugLogger.log('ERROR', 'API_RESPONSE', `Failed: ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
      status: error.response?.status,
      statusText: error.response?.statusText,
      errorData: error.response?.data,
      message: error.message,
    });
    if (error.response?.status === 401) {
      const token = await AsyncStorage.getItem('authToken');
      await debugLogger.log('WARN', 'API_RESPONSE', '401 Unauthorized - Token may be invalid', {
        tokenInStorage: token ? `${token.substring(0, 20)}...` : 'NONE',
      });
    }
    return Promise.reject(error);
  }
);

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
  getInspections: async (params: { status?: string; city?: string; date_filter?: string; date_from?: string; date_to?: string } = {}) => {
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
    // Send all fields to backend for proper storage
    const payload: any = {
      question_id: progressData.question_id,
      category_id: progressData.category_id,
    };
    
    // Only include non-undefined fields
    if (progressData.answer !== undefined) {
      payload.answer = progressData.answer;
    }
    if (progressData.sub_answer_1 !== undefined) {
      payload.sub_answer_1 = progressData.sub_answer_1;
    }
    if (progressData.sub_answer_2 !== undefined) {
      payload.sub_answer_2 = progressData.sub_answer_2;
    }
    
    await debugLogger.logApiRequest(`/mechanic/inspections/${id}/progress`, {
      question_id: payload.question_id,
      category_id: payload.category_id,
      hasAnswer: payload.answer !== undefined,
      hasSubAnswer1: payload.sub_answer_1 !== undefined,
      hasSubAnswer2: payload.sub_answer_2 !== undefined,
      answerType: typeof payload.answer,
    }, id, payload.question_id);
    
    try {
      const response = await api.post(`/mechanic/inspections/${id}/progress`, payload);
      
      await debugLogger.logApiResponse(`saveProgress`, {
        status: 'success',
        message: response.data.message,
        savedAnswersCount: response.data.answers ? Object.keys(response.data.answers).length : 0,
        savedQuestionAnswer: response.data.answers?.[payload.question_id],
      }, true, id);
      
      return response.data;
    } catch (error: any) {
      await debugLogger.logApiError(`saveProgress`, error, id, payload.question_id);
      throw error;
    }
  },

  completeInspection: async (id: string) => {
    const response = await api.post(`/mechanic/inspections/${id}/complete`);
    return response.data;
  },

  startInspection: async (id: string) => {
    const response = await api.post(`/mechanic/inspections/${id}/start`);
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
