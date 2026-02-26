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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { inspectionsApi } from '../../src/lib/api';
import { diagLogger } from '../../src/lib/diagLogger';
import { uploadMediaToFirebase } from '../../src/lib/firebaseUpload';

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

  useEffect(() => {
    isMounted.current = true;
    if (inspectionId && categoryId) {
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
    
    try {
      setIsLoading(true);
      setLoadError(null);
      
      // Use cached questionnaire
      const data = await inspectionsApi.getQuestionnaire(inspectionId!);
      
      if (!isMounted.current) return;
      
      const allQuestions = data.questions || [];
      const categoryQuestions = allQuestions.filter((q: any) => q.category_id === categoryId);
      
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
        const [inspection, localDrafts] = await Promise.all([
          inspectionsApi.getInspection(inspectionId!).catch(() => null),
          loadDraftsFromStorage(),
        ]);
        
        if (!isMounted.current) return;
        
        const serverAnswers = inspection?.inspection_answers || {};
        
        // Merge: prefer local drafts (if isDraft) over server answers
        const mergedAnswers: Record<string, Answer> = {};
        categoryQuestions.forEach((q: Question) => {
          if (localDrafts[q.id]?.isDraft) {
            mergedAnswers[q.id] = { ...localDrafts[q.id], isDraft: true };
          } else if (serverAnswers[q.id]) {
            mergedAnswers[q.id] = { ...serverAnswers[q.id], isDraft: false };
          }
        });
        
        setDraftAnswers(mergedAnswers);
        setHasUnsavedChanges(Object.values(mergedAnswers).some(a => a.isDraft));
        
      } catch (answerErr) {
        console.error('Error loading answers:', answerErr);
        const localDrafts = await loadDraftsFromStorage();
        if (isMounted.current) {
          setDraftAnswers(localDrafts);
          setHasUnsavedChanges(Object.keys(localDrafts).length > 0);
        }
      }
      
    } catch (err: any) {
      console.error('Error loading data:', err);
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
    diagLogger.info('SAVE_ALL_START', { 
      totalAnswers: answersToSave.length,
      questionIds: answersToSave.map(([qid]) => qid)
    });
    
    const results: Array<{ questionId: string; success: boolean; error?: string }> = [];
    
    try {
      // Save answers ONE BY ONE to avoid payload size issues
      for (let i = 0; i < answersToSave.length; i++) {
        const [questionId, answer] = answersToSave[i];
        
        diagLogger.info(`SAVE_ANSWER_${i + 1}/${answersToSave.length}`, { questionId });
        
        try {
          // Process media in the answer before sending
          let processedAnswer = answer.answer;
          let processedSubAnswer1 = answer.sub_answer_1;
          let processedSubAnswer2 = answer.sub_answer_2;
          
          // Process main answer if it's a direct video URI
          if (typeof processedAnswer === 'string' && processedAnswer.startsWith('file://')) {
            diagLogger.info('PROCESSING_DIRECT_VIDEO', { questionId });
            try {
              processedAnswer = await processVideo(processedAnswer);
            } catch (mediaErr: any) {
              diagLogger.error('DIRECT_VIDEO_PROCESS_FAILED', { questionId, error: mediaErr.message });
              results.push({ questionId, success: false, error: mediaErr.message });
              continue;
            }
          }
          
          // Process main answer if it has media (combo type)
          if (processedAnswer && typeof processedAnswer === 'object' && processedAnswer.media) {
            const mediaUri = processedAnswer.media;
            if (typeof mediaUri === 'string' && mediaUri.startsWith('file://')) {
              // It's a video file URI - need to convert to base64
              diagLogger.info('PROCESSING_MEDIA_IN_ANSWER', { questionId, mediaType: 'video' });
              try {
                const processedMedia = await processVideo(mediaUri);
                processedAnswer = { ...processedAnswer, media: processedMedia };
              } catch (mediaErr: any) {
                diagLogger.error('MEDIA_PROCESS_FAILED', { questionId, error: mediaErr.message });
                results.push({ questionId, success: false, error: mediaErr.message });
                continue; // Skip this answer but continue with others
              }
            }
          }
          
          // Process sub_answer_1 if it has media
          if (processedSubAnswer1 && typeof processedSubAnswer1 === 'object' && processedSubAnswer1.media) {
            const mediaUri = processedSubAnswer1.media;
            if (typeof mediaUri === 'string' && mediaUri.startsWith('file://')) {
              diagLogger.info('PROCESSING_MEDIA_IN_SUB1', { questionId, mediaType: 'video' });
              try {
                const processedMedia = await processVideo(mediaUri);
                processedSubAnswer1 = { ...processedSubAnswer1, media: processedMedia };
              } catch (mediaErr: any) {
                diagLogger.error('SUB1_MEDIA_PROCESS_FAILED', { questionId, error: mediaErr.message });
                results.push({ questionId, success: false, error: mediaErr.message });
                continue;
              }
            }
          }
          
          // Process sub_answer_2 if it has media
          if (processedSubAnswer2 && typeof processedSubAnswer2 === 'object' && processedSubAnswer2.media) {
            const mediaUri = processedSubAnswer2.media;
            if (typeof mediaUri === 'string' && mediaUri.startsWith('file://')) {
              diagLogger.info('PROCESSING_MEDIA_IN_SUB2', { questionId, mediaType: 'video' });
              try {
                const processedMedia = await processVideo(mediaUri);
                processedSubAnswer2 = { ...processedSubAnswer2, media: processedMedia };
              } catch (mediaErr: any) {
                diagLogger.error('SUB2_MEDIA_PROCESS_FAILED', { questionId, error: mediaErr.message });
                results.push({ questionId, success: false, error: mediaErr.message });
                continue;
              }
            }
          }
          
          await inspectionsApi.saveProgress(inspectionId, {
            question_id: questionId,
            category_id: categoryId,
            answer: processedAnswer,
            sub_answer_1: processedSubAnswer1,
            sub_answer_2: processedSubAnswer2,
          });
          
          results.push({ questionId, success: true });
          diagLogger.info(`SAVE_ANSWER_SUCCESS`, { questionId, index: i + 1 });
          
        } catch (err: any) {
          diagLogger.error(`SAVE_ANSWER_FAILED`, { 
            questionId, 
            index: i + 1,
            error: err.message,
            status: err.response?.status
          });
          results.push({ questionId, success: false, error: err.message });
        }
      }
      
      const failures = results.filter(r => !r.success);
      const successes = results.filter(r => r.success);
      
      diagLogger.info('SAVE_ALL_COMPLETE', { 
        total: results.length, 
        succeeded: successes.length, 
        failed: failures.length 
      });
      
      if (failures.length > 0) {
        const errorMessages = failures.map(f => f.error).filter(Boolean).join('\n');
        Alert.alert(
          'Partial Save',
          `${successes.length} of ${results.length} answers saved.\n\nFailed questions:\n${failures.map(f => `• ${f.questionId.substring(0, 8)}...: ${f.error || 'Unknown error'}`).join('\n')}`,
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
          quality: 0.5, // Lower quality to reduce memory
        });
      } else {
        // Show warning about video length
        Alert.alert(
          'Video Recording',
          `Please keep your video under 10 seconds for reliable upload. Recording will auto-stop at ${maxDuration || 10} seconds.`,
          [{ text: 'OK' }]
        );
        
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          allowsEditing: true,
          quality: 0.3, // Lower quality for smaller files
          videoMaxDuration: Math.min(maxDuration || 10, 10), // Max 10 seconds
        });
      }

      if (!result.canceled && result.assets[0]) {
        const existing = draftAnswers[questionId]?.[field] || {};
        let mediaData: string;
        
        if (mediaType === 'photo') {
          // Compress image to prevent memory issues
          mediaData = await compressImage(result.assets[0].uri);
        } else {
          // For videos, store the URI - it will be processed and size-checked during save
          diagLogger.info('VIDEO_CAPTURED', { uri: result.assets[0].uri.substring(0, 50) });
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

  const handleVideoCapture = async (questionId: string, maxDuration: number = 10, field: string = 'answer') => {
    try {
      // Show warning about video length
      Alert.alert(
        'Video Recording',
        `Please keep your video under 10 seconds for reliable upload. Recording will auto-stop at ${Math.min(maxDuration, 10)} seconds.`,
        [{ text: 'OK' }]
      );
      
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.3, // Lower quality for smaller files
        videoMaxDuration: Math.min(maxDuration, 10), // Max 10 seconds
      });

      if (!result.canceled && result.assets[0]) {
        // Store URI - size will be checked during save
        diagLogger.info('VIDEO_CAPTURED_DIRECT', { uri: result.assets[0].uri.substring(0, 50) });
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
                  <View style={styles.videoPlaceholder}>
                    <Ionicons name="videocam" size={40} color={colors.success} />
                    <Text style={styles.videoRecordedText}>Video Recorded</Text>
                  </View>
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
        return (
          <View style={styles.mediaContainer}>
            {currentAnswer ? (
              <View style={styles.mediaPreview}>
                <View style={styles.videoPlaceholder}>
                  <Ionicons name="videocam" size={40} color={colors.success} />
                  <Text style={styles.videoRecordedText}>Video Recorded</Text>
                </View>
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

  const renderQuestion = (question: Question, index: number) => {
    const currentAnswer = draftAnswers[question.id];
    const isAnswered = !!currentAnswer?.answer;
    const isDraft = currentAnswer?.isDraft;

    return (
      <View key={question.id} style={[styles.questionCard, isAnswered && styles.questionAnswered, isDraft && styles.questionDraft]}>
        <View style={styles.questionHeader}>
          <View style={[styles.questionNumberBadge, isAnswered && styles.questionNumberBadgeAnswered]}>
            {isAnswered ? (
              <Ionicons name="checkmark" size={16} color="#fff" />
            ) : (
              <Text style={styles.questionNumber}>{index + 1}</Text>
            )}
          </View>
          <View style={styles.questionTextContainer}>
            <Text style={styles.questionText}>{question.question}</Text>
            {question.is_mandatory && <Text style={styles.mandatoryBadge}>Required</Text>}
            {isDraft && <Text style={styles.draftBadge}>Unsaved</Text>}
          </View>
        </View>

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
        <View style={{ width: 40 }} />
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
  questionNumber: { color: '#fff', fontSize: 14, fontWeight: '700' },
  questionTextContainer: { flex: 1 },
  questionText: { fontSize: 16, fontWeight: '600', color: colors.text, lineHeight: 24 },
  mandatoryBadge: { fontSize: 11, color: colors.danger, fontWeight: '600', marginTop: 4 },
  draftBadge: { fontSize: 11, color: colors.warning, fontWeight: '600', marginTop: 2 },
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
});
