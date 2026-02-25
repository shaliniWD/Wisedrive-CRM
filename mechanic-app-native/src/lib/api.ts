import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// API Base URL - Production CRM backend
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://crmdev.wisedrive.com/api';

// Increased timeout for large payloads (images)
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000, // 60 seconds for large uploads
  headers: {
    'Content-Type': 'application/json',
  },
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
});

// Add auth token to requests
api.interceptors.request.use(async (config) => {
  try {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {
    console.warn('[API] Error getting token:', e);
  }
  return config;
});

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    console.error('[API] Request failed:', error.config?.url, error.message);
    if (error.response?.status === 401) {
      // Token expired - could trigger re-login here
      console.warn('[API] 401 Unauthorized');
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

// Cache for questionnaire data
const questionnaireCache: Record<string, { data: any; timestamp: number }> = {};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

  rejectInspection: async (id: string, reason: string, notes?: string) => {
    const response = await api.post(`/mechanic/inspections/${id}/reject`, { reason, notes });
    return response.data;
  },

  startInspection: async (id: string) => {
    const response = await api.post(`/mechanic/inspections/${id}/start`);
    return response.data;
  },

  completeInspection: async (id: string) => {
    const response = await api.post(`/mechanic/inspections/${id}/complete`);
    return response.data;
  },

  // Optimized: Use cache for questionnaire
  getQuestionnaire: async (id: string, forceRefresh = false) => {
    const cacheKey = `questionnaire_${id}`;
    const cached = questionnaireCache[cacheKey];
    
    if (!forceRefresh && cached && Date.now() - cached.timestamp < CACHE_TTL) {
      console.log('[API] Using cached questionnaire');
      return cached.data;
    }
    
    const response = await api.get(`/inspections/${id}/questionnaire`);
    questionnaireCache[cacheKey] = {
      data: response.data,
      timestamp: Date.now(),
    };
    return response.data;
  },

  // Clear cache for an inspection
  clearQuestionnaireCache: (id: string) => {
    delete questionnaireCache[`questionnaire_${id}`];
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
    
    const response = await api.post(`/mechanic/inspections/${id}/progress`, payload);
    return response.data;
  },

  // Batch save for better performance - save multiple answers at once
  saveProgressBatch: async (id: string, answers: Array<{ question_id: string; category_id: string; answer?: any; sub_answer_1?: any; sub_answer_2?: any }>) => {
    // Save answers sequentially to avoid overwhelming the server
    const results = [];
    for (const answer of answers) {
      try {
        const result = await inspectionsApi.saveProgress(id, answer);
        results.push({ success: true, question_id: answer.question_id, result });
      } catch (error: any) {
        results.push({ success: false, question_id: answer.question_id, error: error.message });
      }
    }
    return results;
  },

  submitOBDResults: async (id: string, obdData: any) => {
    const response = await api.post(`/mechanic/inspections/${id}/obd-results`, obdData);
    return response.data;
  },

  rescheduleInspection: async (id: string, data: { new_scheduled_date: string; reschedule_reason?: string }) => {
    const response = await api.post(`/mechanic/inspections/${id}/reschedule`, data);
    return response.data;
  },
};

export default api;
