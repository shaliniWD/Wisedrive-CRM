import axios, { AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { diagLogger } from './diagLogger';

// API Base URL - Production CRM backend
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://crmdev.wisedrive.com/api';

// Export the base URL (without /api suffix) for direct fetch calls
export const API_BASE = API_BASE_URL.replace(/\/api$/, '');

// Helper to get auth token
export const getAuthToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem('authToken');
  } catch (e) {
    diagLogger.warn('Error getting auth token', { error: String(e) });
    return null;
  }
};

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
    diagLogger.warn('Error getting auth token', { error: String(e) });
  }
  return config;
});

// Add response interceptor for better error handling
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const url = error.config?.url || 'unknown';
    const status = error.response?.status;
    const responseData = error.response?.data;
    
    diagLogger.error(`API Error: ${url}`, {
      status,
      message: error.message,
      code: error.code,
      responseData: responseData,
    });
    
    if (status === 401) {
      diagLogger.warn('401 Unauthorized - token may be expired');
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

// Helper to calculate payload size
const getPayloadSize = (payload: any): number => {
  try {
    return JSON.stringify(payload).length;
  } catch {
    return 0;
  }
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

  saveProgress: async (id: string, progressData: any, retryCount = 0): Promise<any> => {
    const startTime = Date.now();
    
    // Build payload
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
    
    // Calculate and log payload size
    const payloadSize = getPayloadSize(payload);
    const payloadSizeKB = Math.round(payloadSize / 1024);
    
    // Determine answer type for logging
    let answerType = 'unknown';
    if (typeof payload.answer === 'string') {
      if (payload.answer.startsWith('data:image')) {
        answerType = 'image_base64';
      } else if (payload.answer.startsWith('file://')) {
        answerType = 'file_uri';
      } else {
        answerType = 'text';
      }
    } else if (typeof payload.answer === 'object') {
      answerType = 'object';
      if (payload.answer?.media) {
        answerType = 'combo_with_media';
      }
    }
    
    diagLogger.info(`SAVE_START: ${progressData.question_id}`, {
      inspectionId: id,
      questionId: progressData.question_id,
      categoryId: progressData.category_id,
      answerType,
      payloadSizeKB,
      retryCount,
    });
    
    // Check if payload is too large (>5MB is definitely problematic)
    if (payloadSize > 5 * 1024 * 1024) {
      diagLogger.error(`PAYLOAD_TOO_LARGE: ${payloadSizeKB}KB`, {
        questionId: progressData.question_id,
        limit: '5MB',
      });
    }
    
    try {
      const response = await api.post(`/mechanic/inspections/${id}/progress`, payload);
      const duration = Date.now() - startTime;
      
      diagLogger.info(`SAVE_SUCCESS: ${progressData.question_id}`, {
        durationMs: duration,
        responseStatus: response.status,
        savedAnswersCount: response.data?.answers ? Object.keys(response.data.answers).length : 'unknown',
      });
      
      return response.data;
    } catch (error: any) {
      const duration = Date.now() - startTime;
      
      // Extract detailed error info
      const errorInfo = {
        questionId: progressData.question_id,
        durationMs: duration,
        payloadSizeKB,
        answerType,
        errorMessage: error.message,
        errorCode: error.code,
        httpStatus: error.response?.status,
        httpStatusText: error.response?.statusText,
        serverError: error.response?.data?.detail || error.response?.data,
        isTimeout: error.code === 'ECONNABORTED',
        isNetworkError: error.message?.includes('Network') || error.code === 'ERR_NETWORK',
      };
      
      diagLogger.error(`SAVE_FAILED: ${progressData.question_id}`, errorInfo);
      
      // Retry logic for timeout or network errors
      if (retryCount < 2 && (errorInfo.isTimeout || errorInfo.isNetworkError)) {
        diagLogger.info(`RETRY_ATTEMPT: ${retryCount + 1}`, { questionId: progressData.question_id });
        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        return inspectionsApi.saveProgress(id, progressData, retryCount + 1);
      }
      
      throw error;
    }
  },

  // Batch save for better performance - save multiple answers at once
  saveProgressBatch: async (id: string, answers: Array<{ question_id: string; category_id: string; answer?: any; sub_answer_1?: any; sub_answer_2?: any }>) => {
    diagLogger.info(`BATCH_SAVE_START`, {
      inspectionId: id,
      totalAnswers: answers.length,
      questionIds: answers.map(a => a.question_id),
    });
    
    const results = [];
    for (let i = 0; i < answers.length; i++) {
      const answer = answers[i];
      try {
        const result = await inspectionsApi.saveProgress(id, answer);
        results.push({ success: true, question_id: answer.question_id, result });
      } catch (error: any) {
        results.push({ 
          success: false, 
          question_id: answer.question_id, 
          error: error.message,
          httpStatus: error.response?.status,
          serverError: error.response?.data?.detail,
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    diagLogger.info(`BATCH_SAVE_COMPLETE`, {
      inspectionId: id,
      successCount,
      failCount,
      failures: results.filter(r => !r.success),
    });
    
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

/**
 * Helper to resolve media URLs for display
 * Handles: gs:// URLs, media_ref: references, and raw base64
 */
export const resolveMediaUrl = async (mediaValue: string): Promise<string | null> => {
  if (!mediaValue || typeof mediaValue !== 'string') return null;
  
  // Already a displayable URL or base64
  if (mediaValue.startsWith('data:') || mediaValue.startsWith('http://') || mediaValue.startsWith('https://') || mediaValue.startsWith('file://')) {
    return mediaValue;
  }
  
  // Firebase Storage URL - convert to download URL
  if (mediaValue.startsWith('gs://')) {
    try {
      const token = await getAuthToken();
      const response = await fetch(`${API_BASE}/api/media/get-download-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Bearer ${token}`,
        },
        body: `firebase_path=${encodeURIComponent(mediaValue)}`,
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.download_url;
      }
      diagLogger.warn('RESOLVE_MEDIA_FIREBASE_FAILED', { status: response.status });
    } catch (e: any) {
      diagLogger.error('RESOLVE_MEDIA_FIREBASE_ERROR', { error: e.message });
    }
    return null;
  }
  
  // Media reference - fetch from backend
  if (mediaValue.startsWith('media_ref:')) {
    try {
      const mediaId = mediaValue.replace('media_ref:', '');
      const response = await api.get(`/inspection-media/${mediaId}`);
      if (response.data?.data) {
        return response.data.data; // Returns base64 data
      }
    } catch (e: any) {
      diagLogger.error('RESOLVE_MEDIA_REF_ERROR', { error: e.message });
    }
    return null;
  }
  
  // Unknown format
  return mediaValue;
};

export default api;
