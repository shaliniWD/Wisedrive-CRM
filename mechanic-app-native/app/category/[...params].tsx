import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Video, ResizeMode } from 'expo-av';
import { inspectionsApi, getAuthToken, resolveMediaUrl, getCurrentApiUrl, getEnvironment } from '../../src/lib/api';
import { diagLogger } from '../../src/lib/diagLogger';
import { CopyLogsButton } from '../../src/components/CopyLogsButton';
import uploadMediaWithRetry from '../../src/lib/firebaseUpload';

// AsyncStorage key for failed uploads
const FAILED_UPLOADS_KEY = '@failed_media_uploads';

interface FailedUpload {
  inspectionId: string;
  questionId: string;
  localUri: string;
  mediaType: 'image' | 'video';
  failedAt: string;
  errorMessage: string;
}

// Save failed upload for later retry
const saveFailedUpload = async (upload: FailedUpload): Promise<void> => {
  try {
    const existingStr = await AsyncStorage.getItem(FAILED_UPLOADS_KEY);
    const existing: FailedUpload[] = existingStr ? JSON.parse(existingStr) : [];
    
    // Avoid duplicates
    const isDuplicate = existing.some(
      u => u.inspectionId === upload.inspectionId && u.questionId === upload.questionId
    );
    if (!isDuplicate) {
      existing.push(upload);
      await AsyncStorage.setItem(FAILED_UPLOADS_KEY, JSON.stringify(existing));
      diagLogger.info('FAILED_UPLOAD_SAVED', { questionId: upload.questionId, totalPending: existing.length });
    }
  } catch (e: any) {
    diagLogger.error('FAILED_UPLOAD_SAVE_ERROR', { error: e.message });
  }
};

// Get all failed uploads for an inspection
const getFailedUploads = async (inspectionId?: string): Promise<FailedUpload[]> => {
  try {
    const existingStr = await AsyncStorage.getItem(FAILED_UPLOADS_KEY);
    const existing: FailedUpload[] = existingStr ? JSON.parse(existingStr) : [];
    if (inspectionId) {
      return existing.filter(u => u.inspectionId === inspectionId);
    }
    return existing;
  } catch (e: any) {
    diagLogger.error('FAILED_UPLOAD_GET_ERROR', { error: e.message });
    return [];
  }
};

// Remove a failed upload after successful retry
const removeFailedUpload = async (inspectionId: string, questionId: string): Promise<void> => {
  try {
    const existingStr = await AsyncStorage.getItem(FAILED_UPLOADS_KEY);
    const existing: FailedUpload[] = existingStr ? JSON.parse(existingStr) : [];
    const filtered = existing.filter(
      u => !(u.inspectionId === inspectionId && u.questionId === questionId)
    );
    await AsyncStorage.setItem(FAILED_UPLOADS_KEY, JSON.stringify(filtered));
    diagLogger.info('FAILED_UPLOAD_REMOVED', { questionId, remaining: filtered.length });
  } catch (e: any) {
    diagLogger.error('FAILED_UPLOAD_REMOVE_ERROR', { error: e.message });
  }
};

interface Question {
  id: string;
  question: string;
  answer_type: string;
  options?: string[];
  category_id?: string;
  category_name?: string;
  is_mandatory?: boolean;
  sub_question_1?: string;
  sub_answer_type_1?: string;
  sub_options_1?: string[];
  sub_question_2?: string;
  sub_answer_type_2?: string;
  sub_options_2?: string[];
  video_max_duration?: number;
}

interface Answer {
  answer: any;
  sub_answer_1?: any;
  sub_answer_2?: any;
  answered_at?: string;
  isDraft?: boolean;
  [key: string]: any;
}

const colors = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  background: '#F8FAFC',
  cardBg: '#FFFFFF',
  text: '#1E293B',
  textSecondary: '#64748B',
  border: '#E2E8F0',
};

// Helper to get draft storage key
const getDraftKey = (inspectionId: string, categoryId: string) => 
  `@draft_answers_${inspectionId}_${categoryId}`;

// Helper to check if a value is a remote media reference that needs resolution
const isRemoteMediaRef = (value: any): boolean => {
  if (!value || typeof value !== 'string') return false;
  return value.startsWith('gs://') || value.startsWith('media_ref:');
};

// Helper to resolve all media in an answer object
const resolveAnswerMedia = async (answer: any): Promise<any> => {
  if (!answer) return answer;
  
  const resolved = { ...answer };
  
  // Resolve main answer if it's media
  if (isRemoteMediaRef(resolved.answer)) {
    const url = await resolveMediaUrl(resolved.answer);
    if (url) resolved.answer = url;
  } else if (resolved.answer && typeof resolved.answer === 'object' && isRemoteMediaRef(resolved.answer.media)) {
    // Combo answer with media
    const url = await resolveMediaUrl(resolved.answer.media);
    if (url) resolved.answer = { ...resolved.answer, media: url };
  }
  
  // Resolve sub_answer_1 if it's media
  if (isRemoteMediaRef(resolved.sub_answer_1)) {
    const url = await resolveMediaUrl(resolved.sub_answer_1);
    if (url) resolved.sub_answer_1 = url;
  } else if (resolved.sub_answer_1 && typeof resolved.sub_answer_1 === 'object' && isRemoteMediaRef(resolved.sub_answer_1.media)) {
    const url = await resolveMediaUrl(resolved.sub_answer_1.media);
    if (url) resolved.sub_answer_1 = { ...resolved.sub_answer_1, media: url };
  }
  
  // Resolve sub_answer_2 if it's media
  if (isRemoteMediaRef(resolved.sub_answer_2)) {
    const url = await resolveMediaUrl(resolved.sub_answer_2);
    if (url) resolved.sub_answer_2 = url;
  } else if (resolved.sub_answer_2 && typeof resolved.sub_answer_2 === 'object' && isRemoteMediaRef(resolved.sub_answer_2.media)) {
    const url = await resolveMediaUrl(resolved.sub_answer_2.media);
    if (url) resolved.sub_answer_2 = { ...resolved.sub_answer_2, media: url };
  }
  
  return resolved;
};

// Compress image aggressively to prevent network/memory issues
// Target: <100KB for reliable network transfer
const compressImage = async (uri: string): Promise<string> => {
  const startTime = Date.now();
  diagLogger.info('IMAGE_COMPRESS_START', { uri: uri.substring(0, 50) + '...' });
  
  try {
    const MAX_SIZE_BYTES = 100000; // 100KB max
    
    // Step 1: Aggressive initial compression
    let manipResult = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 480 } }], // Smaller width
      { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    
    let base64 = manipResult.base64 || '';
    let sizeInBytes = base64.length * 0.75;
    diagLogger.info('IMAGE_COMPRESS_STEP1', { sizeKB: Math.round(sizeInBytes / 1024) });
    
    // Step 2: If still too large, compress even more
    if (sizeInBytes > MAX_SIZE_BYTES) {
      manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 320 } }], // Even smaller
        { compress: 0.2, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      base64 = manipResult.base64 || '';
      sizeInBytes = base64.length * 0.75;
      diagLogger.info('IMAGE_COMPRESS_STEP2', { sizeKB: Math.round(sizeInBytes / 1024) });
    }
    
    // Step 3: Final attempt if still too large
    if (sizeInBytes > MAX_SIZE_BYTES) {
      manipResult = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 240 } }], // Minimum usable size
        { compress: 0.15, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      base64 = manipResult.base64 || '';
      sizeInBytes = base64.length * 0.75;
      diagLogger.info('IMAGE_COMPRESS_STEP3', { sizeKB: Math.round(sizeInBytes / 1024) });
    }
    
    if (!base64) {
      throw new Error('Failed to compress image - empty result');
    }
    
    const duration = Date.now() - startTime;
    const finalSizeKB = Math.round(sizeInBytes / 1024);
    
    diagLogger.info('IMAGE_COMPRESS_DONE', { 
      finalSizeKB, 
      durationMs: duration,
      base64Length: base64.length,
    });
    
    return `data:image/jpeg;base64,${base64}`;
  } catch (error: any) {
    diagLogger.error('IMAGE_COMPRESS_FAILED', { 
      error: error.message,
      uri: uri.substring(0, 50),
    });
    throw error;
  }
};

// Convert video to base64 with size limit check
// For videos larger than 5MB, we'll reject them
const MAX_VIDEO_SIZE_MB = 5;
const MAX_VIDEO_SIZE_BYTES = MAX_VIDEO_SIZE_MB * 1024 * 1024;

const processVideo = async (uri: string): Promise<string> => {
  diagLogger.info('VIDEO_PROCESS_START', { uri: uri.substring(0, 50) + '...' });
  
  try {
    // Use fetch to get the video file as blob
    const response = await fetch(uri);
    const blob = await response.blob();
    
    const fileSizeBytes = blob.size;
    const fileSizeMB = fileSizeBytes / (1024 * 1024);
    
    diagLogger.info('VIDEO_SIZE_CHECK', { 
      sizeMB: fileSizeMB.toFixed(2), 
      maxMB: MAX_VIDEO_SIZE_MB,
      sizeBytes: fileSizeBytes 
    });
    
    if (fileSizeBytes > MAX_VIDEO_SIZE_BYTES) {
      diagLogger.error('VIDEO_TOO_LARGE', { 
        sizeMB: fileSizeMB.toFixed(2), 
        maxMB: MAX_VIDEO_SIZE_MB 
      });
      throw new Error(`Video is too large (${fileSizeMB.toFixed(1)}MB). Maximum size is ${MAX_VIDEO_SIZE_MB}MB. Please record a shorter video.`);
    }
    
    // Convert blob to base64
    diagLogger.info('VIDEO_READING_BASE64', { sizeMB: fileSizeMB.toFixed(2) });
    
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        // Remove the data URL prefix to get just the base64
        const base64Data = result.split(',')[1] || result;
        resolve(base64Data);
      };
      reader.onerror = () => reject(new Error('Failed to read video file'));
      reader.readAsDataURL(blob);
    });
    
    diagLogger.info('VIDEO_PROCESS_DONE', { 
      base64Length: base64.length,
      estimatedSizeKB: Math.round(base64.length * 0.75 / 1024)
    });
    
    // Determine video type from uri
    const extension = uri.split('.').pop()?.toLowerCase() || 'mp4';
    const mimeType = extension === 'mov' ? 'video/quicktime' : 'video/mp4';
    
    return `data:${mimeType};base64,${base64}`;
  } catch (error: any) {
    diagLogger.error('VIDEO_PROCESS_FAILED', { error: error.message });
    throw error;
  }
};

export default function CategoryQuestionsScreen() {
  const rawParams = useLocalSearchParams();
  const router = useRouter();
  const isMounted = useRef(true);
  
  const paramsArray = React.useMemo(() => {
    const p = rawParams.params;
    if (Array.isArray(p)) return p;
    if (typeof p === 'string') return p.includes(',') ? p.split(',') : [p];
    return [];
  }, [rawParams]);
  
  const inspectionId = paramsArray[0] || null;
  const categoryId = paramsArray[1] || null;
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [draftAnswers, setDraftAnswers] = useState<Record<string, Answer>>({});
  const [categoryName, setCategoryName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Video player modal state
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);
  const videoRef = useRef<Video>(null);

  // Log screen mount
  useEffect(() => {
    diagLogger.info('QA_SCREEN_MOUNTED', {
      inspectionId,
      categoryId,
      apiUrl: getCurrentApiUrl(),
      environment: getEnvironment(),
      timestamp: new Date().toISOString()
    });
    console.log('[Q&A] Screen mounted');
    console.log('[Q&A] Inspection ID:', inspectionId);
    console.log('[Q&A] Category ID:', categoryId);
    console.log('[Q&A] API URL:', getCurrentApiUrl());
    console.log('[Q&A] Environment:', getEnvironment());
  }, []);

  // Function to play video in modal
  const playVideo = (videoUrl: string) => {
    setCurrentVideoUrl(videoUrl);
    setVideoModalVisible(true);
  };

  // Close video modal
  const closeVideoModal = () => {
    setVideoModalVisible(false);
    setCurrentVideoUrl(null);
  };

  useEffect(() => {
    isMounted.current = true;
    if (inspectionId && categoryId) {
      diagLogger.info('QA_LOADING_DATA', { inspectionId, categoryId });
      loadData();
    }
    return () => {
      isMounted.current = false;
    };
  }, [inspectionId, categoryId]);

  // Save drafts to AsyncStorage when they change
  useEffect(() => {
    if (inspectionId && categoryId && hasUnsavedChanges) {
      saveDraftsToStorage();
    }
  }, [draftAnswers, hasUnsavedChanges]);

  const saveDraftsToStorage = async () => {
    try {
      const key = getDraftKey(inspectionId!, categoryId!);
      await AsyncStorage.setItem(key, JSON.stringify(draftAnswers));
    } catch (e) {
      console.error('Failed to save drafts:', e);
    }
  };

  const loadDraftsFromStorage = async (): Promise<Record<string, Answer>> => {
    try {
      const key = getDraftKey(inspectionId!, categoryId!);
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Failed to load drafts:', e);
    }
    return {};
  };

  const clearDraftsFromStorage = async () => {
    try {
      const key = getDraftKey(inspectionId!, categoryId!);
      await AsyncStorage.removeItem(key);
    } catch (e) {
      console.error('Failed to clear drafts:', e);
    }
  };

  const loadData = async () => {
    if (!isMounted.current) return;
    
    const startTime = Date.now();
    diagLogger.info('QA_LOAD_DATA_START', {
      inspectionId,
      categoryId,
      timestamp: new Date().toISOString()
    });
    console.log('[Q&A] Loading data for inspection:', inspectionId, 'category:', categoryId);
    
    try {
      setIsLoading(true);
      setLoadError(null);
      
      // CRITICAL: Always force refresh questionnaire to get latest answers
      // This ensures answers saved in previous sessions are visible
      const data = await inspectionsApi.getQuestionnaire(inspectionId!, true);
      
      if (!isMounted.current) return;
      
      const allQuestions = data.questions || [];
      const categoryQuestions = allQuestions.filter((q: any) => q.category_id === categoryId);
      
      diagLogger.info('QA_QUESTIONS_LOADED', {
        totalQuestions: allQuestions.length,
        categoryQuestions: categoryQuestions.length,
        categoryId,
        questionIds: categoryQuestions.map((q: any) => q.id)
      });
      console.log('[Q&A] Questions loaded:', categoryQuestions.length, 'for category');
      
      if (categoryQuestions.length > 0 && categoryQuestions[0].category_name) {
        setCategoryName(categoryQuestions[0].category_name);
      } else {
        const categories = data.categories || [];
        const category = categories.find((c: any) => c.id === categoryId);
        setCategoryName(category?.name || categoryId || 'Questions');
      }
      
      setQuestions(categoryQuestions);
      
      // Load saved answers and drafts
      try {
        const localDrafts = await loadDraftsFromStorage();
        
        if (!isMounted.current) return;
        
        // CRITICAL FIX: Use existing_answers from questionnaire endpoint (reliable)
        // This is the same data source that Categories screen uses successfully
        // Fallback to getInspection only if questionnaire doesn't have answers
        const questionnaireAnswers = data?.existing_answers || {};
        const serverAnswers = questionnaireAnswers;
        
        diagLogger.info('QA_ANSWERS_FETCHED', {
          serverAnswersCount: Object.keys(serverAnswers).length,
          serverAnswerKeys: Object.keys(serverAnswers).slice(0, 10),
          localDraftsCount: Object.keys(localDrafts).length,
          localDraftKeys: Object.keys(localDrafts),
          source: 'questionnaire_existing_answers'
        });
        console.log('[Q&A] Server answers:', Object.keys(serverAnswers).length, '(from questionnaire)');
        console.log('[Q&A] Local drafts:', Object.keys(localDrafts).length);
        
        // Merge: prefer local drafts (if isDraft) over server answers
        const mergedAnswers: Record<string, Answer> = {};
        
        // Process each question and resolve media URLs for server answers
        for (const q of categoryQuestions) {
          if (localDrafts[q.id]?.isDraft) {
            mergedAnswers[q.id] = { ...localDrafts[q.id], isDraft: true };
          } else if (serverAnswers[q.id]) {
            // Resolve remote media URLs (gs://, media_ref:) to displayable URLs
            const resolvedAnswer = await resolveAnswerMedia(serverAnswers[q.id]);
            mergedAnswers[q.id] = { ...resolvedAnswer, isDraft: false };
          }
        }
        
        diagLogger.info('QA_ANSWERS_MERGED', {
          mergedCount: Object.keys(mergedAnswers).length,
          mergedKeys: Object.keys(mergedAnswers),
          hasDrafts: Object.values(mergedAnswers).some(a => a.isDraft)
        });
        
        setDraftAnswers(mergedAnswers);
        setHasUnsavedChanges(Object.values(mergedAnswers).some(a => a.isDraft));
        
      } catch (answerErr: any) {
        diagLogger.error('QA_LOAD_ANSWERS_ERROR', {
          error: answerErr.message,
          stack: answerErr.stack?.substring(0, 200)
        });
        console.error('[Q&A] Error loading answers:', answerErr);
        const localDrafts = await loadDraftsFromStorage();
        if (isMounted.current) {
          setDraftAnswers(localDrafts);
          setHasUnsavedChanges(Object.keys(localDrafts).length > 0);
        }
      }
      
      const duration = Date.now() - startTime;
      diagLogger.info('QA_LOAD_DATA_SUCCESS', {
        durationMs: duration,
        questionsCount: categoryQuestions.length,
        answersCount: Object.keys(draftAnswers).length
      });
      console.log('[Q&A] Data loaded successfully in', duration, 'ms');
      
    } catch (err: any) {
      const duration = Date.now() - startTime;
      diagLogger.error('QA_LOAD_DATA_ERROR', {
        error: err.message,
        responseStatus: err.response?.status,
        responseData: err.response?.data,
        durationMs: duration
      });
      console.error('[Q&A] Error loading data:', err);
      if (isMounted.current) {
        setLoadError(err.message || 'Failed to load questions');
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const updateDraftAnswer = useCallback((questionId: string, answerData: any, field: string = 'answer') => {
    setDraftAnswers(prev => {
      const existing = prev[questionId] || {};
      const updated = {
        ...existing,
        [field]: answerData,
        answered_at: new Date().toISOString(),
        isDraft: true,
      };
      return { ...prev, [questionId]: updated };
    });
    setHasUnsavedChanges(true);
  }, []);

  const saveAllAnswers = async () => {
    if (!inspectionId || !categoryId) return;
    
    const answersToSave = Object.entries(draftAnswers).filter(([_, answer]) => answer.isDraft);
    
    if (answersToSave.length === 0) {
      router.back();
      return;
    }
    
    setIsSaving(true);
    const startTime = Date.now();
    diagLogger.info('QA_SAVE_ALL_START', { 
      inspectionId,
      categoryId,
      totalAnswers: answersToSave.length,
      questionIds: answersToSave.map(([qid]) => qid),
      apiUrl: getCurrentApiUrl(),
      environment: getEnvironment(),
      timestamp: new Date().toISOString()
    });
    console.log('[Q&A] Saving', answersToSave.length, 'answers');
    console.log('[Q&A] Question IDs:', answersToSave.map(([qid]) => qid));
    
    const results: Array<{ questionId: string; success: boolean; error?: string }> = [];
    
    // Helper function to upload media to Firebase with retry and return URL
    const uploadToFirebase = async (uri: string, questionId: string, mediaType: 'image' | 'video'): Promise<string> => {
      diagLogger.info('FIREBASE_UPLOAD_STARTING', { questionId, mediaType });
      const token = await getAuthToken();
      // Use uploadMediaWithRetry for automatic retry on failure
      const result = await uploadMediaWithRetry(uri, inspectionId, questionId, mediaType, undefined, token || undefined, 3);
      if (!result.success || !result.url) {
        throw new Error(result.error || 'Upload failed after retries');
      }
      diagLogger.info('FIREBASE_UPLOAD_COMPLETE', { questionId, url: result.url.substring(0, 50) + '...' });
      return result.url;
    };
    
    // Helper to determine if URI is a local file that needs uploading
    const isLocalFile = (value: any): boolean => {
      return typeof value === 'string' && value.startsWith('file://');
    };
    
    // Helper to check if it's a base64 image (already compressed)
    const isBase64Image = (value: any): boolean => {
      return typeof value === 'string' && value.startsWith('data:image');
    };
    
    try {
      // Save answers ONE BY ONE
      for (let i = 0; i < answersToSave.length; i++) {
        const [questionId, answer] = answersToSave[i];
        
        diagLogger.info(`SAVE_ANSWER_${i + 1}/${answersToSave.length}`, { questionId });
        
        try {
          let processedAnswer = answer.answer;
          let processedSubAnswer1 = answer.sub_answer_1;
          let processedSubAnswer2 = answer.sub_answer_2;
          
          // Process main answer - upload to Firebase if it's a local file
          if (isLocalFile(processedAnswer)) {
            // Direct video or image file
            const isVideo = processedAnswer.includes('.mp4') || processedAnswer.includes('.mov');
            const mediaType = isVideo ? 'video' : 'image';
            diagLogger.info('PROCESSING_DIRECT_MEDIA', { questionId, mediaType });
            try {
              const originalUri = processedAnswer;
              processedAnswer = await uploadToFirebase(processedAnswer, questionId, mediaType);
              // Remove from failed uploads if it was there
              await removeFailedUpload(inspectionId, questionId);
            } catch (uploadErr: any) {
              diagLogger.error('DIRECT_MEDIA_UPLOAD_FAILED', { questionId, error: uploadErr.message });
              // Save to failed uploads for later retry
              await saveFailedUpload({
                inspectionId,
                questionId,
                localUri: processedAnswer,
                mediaType,
                failedAt: new Date().toISOString(),
                errorMessage: uploadErr.message,
              });
              results.push({ questionId, success: false, error: uploadErr.message });
              continue;
            }
          } else if (isBase64Image(processedAnswer)) {
            // Already a base64 image - send as is (backend will store it)
            diagLogger.info('SENDING_BASE64_IMAGE', { questionId, sizeKB: Math.round(processedAnswer.length / 1024) });
          }
          
          // Process combo answer with media
          if (processedAnswer && typeof processedAnswer === 'object' && processedAnswer.media) {
            const mediaUri = processedAnswer.media;
            if (isLocalFile(mediaUri)) {
              const isVideo = mediaUri.includes('.mp4') || mediaUri.includes('.mov');
              const mediaType = isVideo ? 'video' : 'image';
              diagLogger.info('PROCESSING_COMBO_MEDIA', { questionId, mediaType });
              try {
                const uploadedUrl = await uploadToFirebase(mediaUri, `${questionId}_combo`, mediaType);
                processedAnswer = { ...processedAnswer, media: uploadedUrl };
                await removeFailedUpload(inspectionId, `${questionId}_combo`);
              } catch (uploadErr: any) {
                diagLogger.error('COMBO_MEDIA_UPLOAD_FAILED', { questionId, error: uploadErr.message });
                await saveFailedUpload({
                  inspectionId,
                  questionId: `${questionId}_combo`,
                  localUri: mediaUri,
                  mediaType,
                  failedAt: new Date().toISOString(),
                  errorMessage: uploadErr.message,
                });
                results.push({ questionId, success: false, error: uploadErr.message });
                continue;
              }
            }
          }
          
          // Process sub_answer_1 media
          if (processedSubAnswer1 && typeof processedSubAnswer1 === 'object' && processedSubAnswer1.media) {
            const mediaUri = processedSubAnswer1.media;
            if (isLocalFile(mediaUri)) {
              const isVideo = mediaUri.includes('.mp4') || mediaUri.includes('.mov');
              const mediaType = isVideo ? 'video' : 'image';
              diagLogger.info('PROCESSING_SUB1_MEDIA', { questionId, mediaType });
              try {
                const uploadedUrl = await uploadToFirebase(mediaUri, `${questionId}_sub1`, mediaType);
                processedSubAnswer1 = { ...processedSubAnswer1, media: uploadedUrl };
                await removeFailedUpload(inspectionId, `${questionId}_sub1`);
              } catch (uploadErr: any) {
                diagLogger.error('SUB1_MEDIA_UPLOAD_FAILED', { questionId, error: uploadErr.message });
                results.push({ questionId, success: false, error: uploadErr.message });
                continue;
              }
            }
          }
          
          // Process sub_answer_2 media
          if (processedSubAnswer2 && typeof processedSubAnswer2 === 'object' && processedSubAnswer2.media) {
            const mediaUri = processedSubAnswer2.media;
            if (isLocalFile(mediaUri)) {
              const isVideo = mediaUri.includes('.mp4') || mediaUri.includes('.mov');
              const mediaType = isVideo ? 'video' : 'image';
              diagLogger.info('PROCESSING_SUB2_MEDIA', { questionId, mediaType });
              try {
                const uploadedUrl = await uploadToFirebase(mediaUri, `${questionId}_sub2`, mediaType);
                processedSubAnswer2 = { ...processedSubAnswer2, media: uploadedUrl };
              } catch (uploadErr: any) {
                diagLogger.error('SUB2_MEDIA_UPLOAD_FAILED', { questionId, error: uploadErr.message });
                results.push({ questionId, success: false, error: uploadErr.message });
                continue;
              }
            }
          }
          
          // Save to backend (now with Firebase URLs instead of base64)
          const saveStartTime = Date.now();
          diagLogger.info('QA_SAVE_TO_BACKEND_START', {
            inspectionId,
            questionId,
            categoryId,
            hasAnswer: !!processedAnswer,
            answerType: typeof processedAnswer === 'string' && processedAnswer.startsWith('data:') ? 'base64' : typeof processedAnswer,
            apiUrl: getCurrentApiUrl()
          });
          console.log('[Q&A] Saving to backend:', questionId);
          
          await inspectionsApi.saveProgress(inspectionId, {
            question_id: questionId,
            category_id: categoryId,
            answer: processedAnswer,
            sub_answer_1: processedSubAnswer1,
            sub_answer_2: processedSubAnswer2,
          });
          
          const saveDuration = Date.now() - saveStartTime;
          diagLogger.info('QA_SAVE_TO_BACKEND_SUCCESS', {
            questionId,
            durationMs: saveDuration,
            timestamp: new Date().toISOString()
          });
          console.log('[Q&A] Save success:', questionId, 'in', saveDuration, 'ms');
          
          results.push({ questionId, success: true });
          diagLogger.info(`SAVE_ANSWER_SUCCESS`, { questionId, index: i + 1 });
          
        } catch (err: any) {
          diagLogger.error('QA_SAVE_ANSWER_FAILED', { 
            questionId, 
            index: i + 1,
            error: err.message,
            errorCode: err.code,
            responseStatus: err.response?.status,
            responseData: err.response?.data,
            timestamp: new Date().toISOString()
          });
          console.log('[Q&A] Save FAILED:', questionId, err.message, err.response?.status);
          results.push({ questionId, success: false, error: err.message });
        }
      }
      
      const failures = results.filter(r => !r.success);
      const successes = results.filter(r => r.success);
      const totalDuration = Date.now() - startTime;
      
      diagLogger.info('QA_SAVE_ALL_COMPLETE', { 
        total: results.length, 
        succeeded: successes.length, 
        failed: failures.length,
        durationMs: totalDuration,
        failedQuestions: failures.map(f => ({ id: f.questionId, error: f.error })),
        timestamp: new Date().toISOString()
      });
      console.log('[Q&A] Save complete:', successes.length, '/', results.length, 'in', totalDuration, 'ms');
      if (failures.length > 0) {
        console.log('[Q&A] Failures:', failures);
      }
      
      if (failures.length > 0) {
        Alert.alert(
          'Partial Save',
          `${successes.length} of ${results.length} answers saved.\n\nFailed:\n${failures.map(f => `• ${f.error || 'Unknown error'}`).join('\n')}`,
          [{ text: 'OK', onPress: () => router.back() }]
        );
      } else {
        await clearDraftsFromStorage();
        setHasUnsavedChanges(false);
        router.back();
      }
      
    } catch (err: any) {
      diagLogger.error('SAVE_ALL_ERROR', { error: err.message });
      Alert.alert(
        'Save Failed',
        'Failed to save answers. Your answers are saved locally and will be synced later.',
        [{ text: 'OK' }]
      );
    } finally {
      if (isMounted.current) {
        setIsSaving(false);
      }
    }
  };

  const handleOptionSelect = (questionId: string, option: string, field: string = 'answer') => {
    updateDraftAnswer(questionId, option, field);
  };

  const handleComboOptionSelect = (questionId: string, option: string, field: string = 'answer') => {
    const existing = draftAnswers[questionId]?.[field] || {};
    const newAnswer = { ...existing, selection: option };
    updateDraftAnswer(questionId, newAnswer, field);
  };

  const handleComboMediaCapture = async (questionId: string, field: string = 'answer', mediaType: 'photo' | 'video' = 'photo', maxDuration?: number) => {
    try {
      let result;
      if (mediaType === 'photo') {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: false,
          quality: 0.5,
        });
      } else {
        // With Firebase Storage, we can handle larger videos
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          allowsEditing: true,
          quality: 0.5,
          videoMaxDuration: maxDuration || 60, // Allow longer videos
        });
      }

      if (!result.canceled && result.assets[0]) {
        const existing = draftAnswers[questionId]?.[field] || {};
        let mediaData: string;
        
        if (mediaType === 'photo') {
          // Compress image for faster upload
          mediaData = await compressImage(result.assets[0].uri);
        } else {
          // Store video URI - will be uploaded to Firebase during save
          diagLogger.info('VIDEO_CAPTURED', { 
            uri: result.assets[0].uri.substring(0, 50),
            duration: result.assets[0].duration,
          });
          mediaData = result.assets[0].uri;
        }
        
        const newAnswer = { ...existing, media: mediaData };
        updateDraftAnswer(questionId, newAnswer, field);
      }
    } catch (err) {
      console.error('Media capture error:', err);
      Alert.alert('Error', `Failed to capture ${mediaType}. Please try again.`);
    }
  };

  const handleImageCapture = async (questionId: string, field: string = 'answer') => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.5,
      });

      if (!result.canceled && result.assets[0]) {
        // Compress image
        const imageData = await compressImage(result.assets[0].uri);
        updateDraftAnswer(questionId, imageData, field);
      }
    } catch (err) {
      console.error('Image capture error:', err);
      Alert.alert('Error', 'Failed to capture image. Please try again.');
    }
  };

  const handleVideoCapture = async (questionId: string, maxDuration: number = 60, field: string = 'answer') => {
    try {
      // With Firebase Storage, we can handle larger videos
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.5, // Medium quality
        videoMaxDuration: maxDuration, // Use the configured duration
      });

      if (!result.canceled && result.assets[0]) {
        // Store URI - will be uploaded to Firebase during save
        diagLogger.info('VIDEO_CAPTURED_DIRECT', { 
          uri: result.assets[0].uri.substring(0, 50),
          duration: result.assets[0].duration,
        });
        updateDraftAnswer(questionId, result.assets[0].uri, field);
      }
    } catch (err) {
      console.error('Video capture error:', err);
      Alert.alert('Error', 'Failed to capture video. Please try again.');
    }
  };

  const renderAnswerInput = (question: Question, currentAnswer: any, field: string = 'answer', answerType?: string, options?: string[]) => {
    const isSubQuestion = field === 'sub_answer_1' || field === 'sub_answer_2';
    const type = answerType || (isSubQuestion ? 'multiple_choice' : question.answer_type);
    const opts = options || (isSubQuestion ? [] : question.options) || [];
    
    const isComboType = type === 'multiple_choice_photo' || type === 'multiple_choice_video';
    const comboAnswer = isComboType && typeof currentAnswer === 'object' ? currentAnswer : {};
    const selection = comboAnswer?.selection;
    const mediaData = comboAnswer?.media;
    
    switch (type) {
      case 'multiple_choice':
        if (opts.length === 0) {
          return (
            <View style={styles.emptyOptionsContainer}>
              <Text style={styles.emptyOptionsText}>No options configured</Text>
            </View>
          );
        }
        return (
          <View style={styles.optionsContainer}>
            {opts.map((option: string, idx: number) => (
              <TouchableOpacity
                key={idx}
                style={[styles.optionButton, currentAnswer === option && styles.optionButtonSelected]}
                onPress={() => handleOptionSelect(question.id, option, field)}
              >
                <View style={[styles.optionRadio, currentAnswer === option && styles.optionRadioSelected]}>
                  {currentAnswer === option && <View style={styles.optionRadioInner} />}
                </View>
                <Text style={[styles.optionText, currentAnswer === option && styles.optionTextSelected]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      
      case 'multiple_choice_photo':
        return (
          <View style={styles.comboContainer}>
            <View style={styles.optionsContainer}>
              {opts.map((option: string, idx: number) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.optionButton, selection === option && styles.optionButtonSelected]}
                  onPress={() => handleComboOptionSelect(question.id, option, field)}
                >
                  <View style={[styles.optionRadio, selection === option && styles.optionRadioSelected]}>
                    {selection === option && <View style={styles.optionRadioInner} />}
                  </View>
                  <Text style={[styles.optionText, selection === option && styles.optionTextSelected]}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.comboMediaSection}>
              <Text style={styles.comboMediaLabel}>Photo Required</Text>
              {mediaData ? (
                <View style={styles.mediaPreview}>
                  <Image source={{ uri: mediaData }} style={styles.previewImage} />
                  <TouchableOpacity style={styles.retakeButton} onPress={() => handleComboMediaCapture(question.id, field, 'photo')}>
                    <Ionicons name="camera" size={18} color="#fff" />
                    <Text style={styles.retakeText}>Retake</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.captureButton} onPress={() => handleComboMediaCapture(question.id, field, 'photo')}>
                  <Ionicons name="camera" size={40} color={colors.primary} />
                  <Text style={styles.captureText}>Take Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      
      case 'multiple_choice_video':
        return (
          <View style={styles.comboContainer}>
            <View style={styles.optionsContainer}>
              {opts.map((option: string, idx: number) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.optionButton, selection === option && styles.optionButtonSelected]}
                  onPress={() => handleComboOptionSelect(question.id, option, field)}
                >
                  <View style={[styles.optionRadio, selection === option && styles.optionRadioSelected]}>
                    {selection === option && <View style={styles.optionRadioInner} />}
                  </View>
                  <Text style={[styles.optionText, selection === option && styles.optionTextSelected]}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.comboMediaSection}>
              <Text style={styles.comboMediaLabel}>Video Required (Max {question.video_max_duration || 30}s)</Text>
              {mediaData ? (
                <View style={styles.mediaPreview}>
                  {(mediaData.startsWith('http://') || mediaData.startsWith('https://') || mediaData.startsWith('file://')) ? (
                    <TouchableOpacity 
                      style={styles.videoThumbnail} 
                      onPress={() => playVideo(mediaData)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.videoThumbnailOverlay}>
                        <View style={styles.playButtonCircle}>
                          <Ionicons name="play" size={32} color="#fff" />
                        </View>
                        <Text style={styles.videoTapToPlay}>Tap to play video</Text>
                      </View>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.videoPlaceholder}>
                      <Ionicons name="videocam" size={40} color={colors.success} />
                      <Text style={styles.videoRecordedText}>Video Recorded</Text>
                    </View>
                  )}
                  <TouchableOpacity style={styles.retakeButton} onPress={() => handleComboMediaCapture(question.id, field, 'video', question.video_max_duration)}>
                    <Ionicons name="videocam" size={18} color="#fff" />
                    <Text style={styles.retakeText}>Retake</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={styles.captureButton} onPress={() => handleComboMediaCapture(question.id, field, 'video', question.video_max_duration)}>
                  <Ionicons name="videocam" size={40} color={colors.primary} />
                  <Text style={styles.captureText}>Record Video</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
        
      case 'yes_no':
        return (
          <View style={styles.yesNoContainer}>
            <TouchableOpacity
              style={[styles.yesNoButton, currentAnswer === 'Yes' && styles.yesButtonSelected]}
              onPress={() => handleOptionSelect(question.id, 'Yes', field)}
            >
              <Ionicons name="checkmark-circle" size={24} color={currentAnswer === 'Yes' ? '#fff' : colors.success} />
              <Text style={[styles.yesNoText, currentAnswer === 'Yes' && styles.yesNoTextSelected]}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.yesNoButton, currentAnswer === 'No' && styles.noButtonSelected]}
              onPress={() => handleOptionSelect(question.id, 'No', field)}
            >
              <Ionicons name="close-circle" size={24} color={currentAnswer === 'No' ? '#fff' : colors.danger} />
              <Text style={[styles.yesNoText, currentAnswer === 'No' && styles.yesNoTextSelected]}>No</Text>
            </TouchableOpacity>
          </View>
        );
        
      case 'photo':
        return (
          <View style={styles.mediaContainer}>
            {currentAnswer ? (
              <View style={styles.mediaPreview}>
                <Image source={{ uri: currentAnswer }} style={styles.previewImage} />
                <TouchableOpacity style={styles.retakeButton} onPress={() => handleImageCapture(question.id, field)}>
                  <Ionicons name="camera" size={18} color="#fff" />
                  <Text style={styles.retakeText}>Retake</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.captureButton} onPress={() => handleImageCapture(question.id, field)}>
                <Ionicons name="camera" size={40} color={colors.primary} />
                <Text style={styles.captureText}>Take Photo</Text>
              </TouchableOpacity>
            )}
          </View>
        );
        
      case 'video':
        const isPlayableVideo = currentAnswer && (
          currentAnswer.startsWith('http://') || 
          currentAnswer.startsWith('https://') || 
          currentAnswer.startsWith('file://')
        );
        return (
          <View style={styles.mediaContainer}>
            {currentAnswer ? (
              <View style={styles.mediaPreview}>
                {isPlayableVideo ? (
                  <TouchableOpacity 
                    style={styles.videoThumbnail} 
                    onPress={() => playVideo(currentAnswer)}
                    activeOpacity={0.8}
                  >
                    <View style={styles.videoThumbnailOverlay}>
                      <View style={styles.playButtonCircle}>
                        <Ionicons name="play" size={32} color="#fff" />
                      </View>
                      <Text style={styles.videoTapToPlay}>Tap to play video</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.videoPlaceholder}>
                    <Ionicons name="videocam" size={40} color={colors.success} />
                    <Text style={styles.videoRecordedText}>Video Recorded</Text>
                  </View>
                )}
                <TouchableOpacity style={styles.retakeButton} onPress={() => handleVideoCapture(question.id, question.video_max_duration || 30, field)}>
                  <Ionicons name="videocam" size={18} color="#fff" />
                  <Text style={styles.retakeText}>Retake</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.captureButton} onPress={() => handleVideoCapture(question.id, question.video_max_duration || 30, field)}>
                <Ionicons name="videocam" size={40} color={colors.primary} />
                <Text style={styles.captureText}>Record Video</Text>
              </TouchableOpacity>
            )}
          </View>
        );
        
      case 'text':
      default:
        return (
          <TextInput
            style={styles.textInput}
            value={currentAnswer || ''}
            onChangeText={(text) => updateDraftAnswer(question.id, text, field)}
            placeholder="Enter your answer..."
            placeholderTextColor={colors.textSecondary}
            multiline
          />
        );
    }
  };

  // Check if a question is accessible (sequential logic)
  const isQuestionAccessible = (index: number): boolean => {
    if (index === 0) return true; // First question is always accessible
    // Check if previous question is answered
    const prevQuestion = questions[index - 1];
    return !!draftAnswers[prevQuestion.id]?.answer;
  };

  const renderQuestion = (question: Question, index: number) => {
    const currentAnswer = draftAnswers[question.id];
    const isAnswered = !!currentAnswer?.answer;
    const isDraft = currentAnswer?.isDraft;
    const isAccessible = isQuestionAccessible(index);
    const isLocked = !isAccessible;

    return (
      <View key={question.id} style={[
        styles.questionCard, 
        isAnswered && styles.questionAnswered, 
        isDraft && styles.questionDraft,
        isLocked && styles.questionLocked
      ]}>
        <View style={styles.questionHeader}>
          <View style={[
            styles.questionNumberBadge, 
            isAnswered && styles.questionNumberBadgeAnswered,
            isLocked && styles.questionNumberBadgeLocked
          ]}>
            {isLocked ? (
              <Ionicons name="lock-closed" size={14} color="#94A3B8" />
            ) : isAnswered ? (
              <Ionicons name="checkmark" size={16} color="#fff" />
            ) : (
              <Text style={styles.questionNumber}>{index + 1}</Text>
            )}
          </View>
          <View style={styles.questionTextContainer}>
            <Text style={[styles.questionText, isLocked && styles.questionTextLocked]}>{question.question}</Text>
            {question.is_mandatory && <Text style={styles.mandatoryBadge}>Required</Text>}
            {isDraft && <Text style={styles.draftBadge}>Unsaved</Text>}
            {isLocked && <Text style={styles.lockedBadge}>Answer previous question first</Text>}
          </View>
        </View>

        {isLocked ? (
          <View style={styles.lockedOverlay}>
            <Ionicons name="lock-closed" size={32} color="#CBD5E1" />
            <Text style={styles.lockedText}>Complete the previous question to unlock</Text>
          </View>
        ) : (
          <>
            <View style={styles.answerContainer}>
              {renderAnswerInput(question, currentAnswer?.answer, 'answer')}
            </View>

            {question.sub_question_1 && (
              <View style={styles.subQuestionContainer}>
                <Text style={styles.subQuestionText}>{question.sub_question_1}</Text>
                <View style={styles.answerContainer}>
                  {renderAnswerInput(question, currentAnswer?.sub_answer_1, 'sub_answer_1', question.sub_answer_type_1, question.sub_options_1)}
                </View>
              </View>
            )}

            {question.sub_question_2 && (
              <View style={styles.subQuestionContainer}>
                <Text style={styles.subQuestionText}>{question.sub_question_2}</Text>
                <View style={styles.answerContainer}>
                  {renderAnswerInput(question, currentAnswer?.sub_answer_2, 'sub_answer_2', question.sub_answer_type_2, question.sub_options_2)}
                </View>
              </View>
            )}
          </>
        )}
      </View>
    );
  };

  const answeredCount = questions.filter(q => draftAnswers[q.id]?.answer).length;
  const progressPercent = questions.length > 0 ? Math.round((answeredCount / questions.length) * 100) : 0;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading questions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Error</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyContainer}>
          <Ionicons name="alert-circle" size={48} color={colors.danger} />
          <Text style={styles.emptyText}>{loadError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (hasUnsavedChanges) {
            Alert.alert(
              'Unsaved Changes',
              'You have unsaved answers. Save before leaving?',
              [
                { text: 'Discard', style: 'destructive', onPress: () => router.back() },
                { text: 'Save & Exit', onPress: saveAllAnswers },
                { text: 'Cancel', style: 'cancel' },
              ]
            );
          } else {
            router.back();
          }
        }} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>{categoryName}</Text>
          <Text style={styles.headerSubtitle}>
            {answeredCount}/{questions.length} answered
            {hasUnsavedChanges && ' • Unsaved'}
          </Text>
        </View>
        <CopyLogsButton iconColor={colors.textSecondary} iconSize={20} style={styles.copyLogsBtn} />
      </View>

      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressText}>{progressPercent}%</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {questions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyText}>No questions in this category</Text>
            </View>
          ) : (
            questions.map((question, index) => renderQuestion(question, index))
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
          onPress={saveAllAnswers}
          disabled={isSaving}
        >
          {isSaving ? (
            <>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.saveButtonText}>Saving...</Text>
            </>
          ) : (
            <>
              <Ionicons name={hasUnsavedChanges ? "save" : "checkmark-circle"} size={22} color="#fff" />
              <Text style={styles.saveButtonText}>
                {hasUnsavedChanges ? 'Save & Next' : 'Done'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Video Player Modal */}
      <Modal
        visible={videoModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={closeVideoModal}
      >
        <View style={styles.videoModalContainer}>
          <View style={styles.videoModalContent}>
            <View style={styles.videoModalHeader}>
              <Text style={styles.videoModalTitle}>Video Preview</Text>
              <TouchableOpacity onPress={closeVideoModal} style={styles.videoModalCloseButton}>
                <Ionicons name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            {currentVideoUrl && (
              <Video
                ref={videoRef}
                source={{ uri: currentVideoUrl }}
                style={styles.videoPlayer}
                useNativeControls
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={true}
                isLooping={false}
                onError={(error) => {
                  diagLogger.error('VIDEO_PLAYBACK_ERROR', { error: String(error) });
                  Alert.alert('Error', 'Failed to play video');
                }}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 16, color: colors.textSecondary },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: { padding: 8, marginRight: 8 },
  headerTitleContainer: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
  headerSubtitle: { fontSize: 13, color: colors.textSecondary, marginTop: 2 },
  copyLogsBtn: { 
    padding: 8, 
    borderRadius: 8, 
    backgroundColor: colors.background,
  },
  progressBarContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.cardBg, gap: 12 },
  progressBarBg: { flex: 1, height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.success, borderRadius: 4 },
  progressText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600', minWidth: 40 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 12, fontSize: 16, color: colors.textSecondary, textAlign: 'center' },
  retryButton: { marginTop: 16, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: colors.primary, borderRadius: 8 },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  questionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.border,
  },
  questionAnswered: { borderColor: colors.success },
  questionDraft: { borderColor: colors.warning },
  questionLocked: { 
    borderColor: '#E2E8F0', 
    backgroundColor: '#F8FAFC',
    opacity: 0.85,
  },
  questionHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 16 },
  questionNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  questionNumberBadgeAnswered: { backgroundColor: colors.success },
  questionNumberBadgeLocked: { backgroundColor: '#E2E8F0' },
  questionNumber: { color: '#fff', fontSize: 14, fontWeight: '700' },
  questionTextContainer: { flex: 1 },
  questionText: { fontSize: 16, fontWeight: '600', color: colors.text, lineHeight: 24 },
  questionTextLocked: { color: colors.textSecondary },
  mandatoryBadge: { fontSize: 11, color: colors.danger, fontWeight: '600', marginTop: 4 },
  draftBadge: { fontSize: 11, color: colors.warning, fontWeight: '600', marginTop: 2 },
  lockedBadge: { fontSize: 11, color: '#94A3B8', fontWeight: '500', marginTop: 4, fontStyle: 'italic' },
  lockedOverlay: {
    paddingVertical: 32,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  lockedText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
  },
  answerContainer: { marginTop: 8 },
  subQuestionContainer: { marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: colors.border },
  subQuestionText: { fontSize: 14, fontWeight: '500', color: colors.textSecondary, marginBottom: 12 },
  comboContainer: { gap: 20 },
  comboMediaSection: { marginTop: 8, paddingTop: 16, borderTopWidth: 1, borderTopColor: colors.border },
  comboMediaLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 12 },
  emptyOptionsContainer: {
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  emptyOptionsText: { fontSize: 14, color: colors.textSecondary, fontStyle: 'italic' },
  optionsContainer: { gap: 10 },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
  },
  optionButtonSelected: { borderColor: colors.primary, backgroundColor: '#EFF6FF' },
  optionRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionRadioSelected: { borderColor: colors.primary },
  optionRadioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.primary },
  optionText: { flex: 1, fontSize: 15, color: colors.text },
  optionTextSelected: { color: colors.primary, fontWeight: '600' },
  yesNoContainer: { flexDirection: 'row', gap: 12 },
  yesNoButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
    gap: 8,
  },
  yesButtonSelected: { backgroundColor: colors.success, borderColor: colors.success },
  noButtonSelected: { backgroundColor: colors.danger, borderColor: colors.danger },
  yesNoText: { fontSize: 16, fontWeight: '600', color: colors.text },
  yesNoTextSelected: { color: '#fff' },
  mediaContainer: { alignItems: 'center' },
  captureButton: {
    width: '100%',
    padding: 32,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 8,
  },
  captureText: { fontSize: 16, fontWeight: '600', color: colors.primary },
  mediaPreview: { width: '100%', alignItems: 'center' },
  previewImage: { width: '100%', height: 200, borderRadius: 12, backgroundColor: colors.background },
  videoPlaceholder: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  videoRecordedText: { fontSize: 14, fontWeight: '600', color: colors.success },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    marginTop: 12,
    gap: 8,
  },
  retakeText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  textInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 14,
    fontSize: 15,
    color: colors.text,
    borderWidth: 2,
    borderColor: colors.border,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  footer: { padding: 16, backgroundColor: colors.cardBg, borderTopWidth: 1, borderTopColor: colors.border },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.success,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  saveButtonDisabled: { backgroundColor: colors.textSecondary },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  
  // Video thumbnail styles
  videoThumbnail: {
    width: '100%',
    height: 180,
    borderRadius: 12,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  videoThumbnailOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  playButtonCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(61, 123, 61, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingLeft: 4,
  },
  videoTapToPlay: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  
  // Video modal styles
  videoModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoModalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
  },
  videoModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  videoModalTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  videoModalCloseButton: {
    padding: 8,
  },
  videoPlayer: {
    width: '100%',
    height: Dimensions.get('window').height * 0.6,
  },
});
