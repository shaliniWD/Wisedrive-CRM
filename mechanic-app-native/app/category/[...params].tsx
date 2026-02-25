import React, { useState, useEffect, useCallback } from 'react';
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
import AsyncStorage from '@react-native-async-storage/async-storage';
import { inspectionsApi } from '../../src/lib/api';
import { debugLogger } from '../../src/lib/logger';
import LogViewer from '../../src/components/LogViewer';

interface Question {
  id: string;
  question: string;
  answer_type: string;
  options?: string[];
  correct_answer?: string;
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
  [key: string]: any; // Allow dynamic field access
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

export default function CategoryQuestionsScreen() {
  const rawParams = useLocalSearchParams();
  const router = useRouter();
  
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
  const [savedAnswers, setSavedAnswers] = useState<Record<string, Answer>>({});
  const [categoryName, setCategoryName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load saved answers and drafts on mount
  useEffect(() => {
    if (inspectionId && categoryId) {
      loadData();
    }
  }, [inspectionId, categoryId]);

  // Save drafts to AsyncStorage whenever they change
  useEffect(() => {
    if (inspectionId && categoryId && Object.keys(draftAnswers).length > 0) {
      saveDraftsToStorage();
    }
  }, [draftAnswers]);

  const saveDraftsToStorage = async () => {
    try {
      const key = getDraftKey(inspectionId!, categoryId!);
      await AsyncStorage.setItem(key, JSON.stringify(draftAnswers));
      await debugLogger.logStorageWrite(`Draft saved: ${key}`, true);
    } catch (e) {
      console.error('Failed to save drafts:', e);
    }
  };

  const loadDraftsFromStorage = async (): Promise<Record<string, Answer>> => {
    try {
      const key = getDraftKey(inspectionId!, categoryId!);
      const stored = await AsyncStorage.getItem(key);
      if (stored) {
        const drafts = JSON.parse(stored);
        await debugLogger.logStorageRead(`Draft loaded: ${key}`, drafts);
        return drafts;
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
      await debugLogger.logStorageWrite(`Draft cleared: ${key}`, true);
    } catch (e) {
      console.error('Failed to clear drafts:', e);
    }
  };

  const loadData = async () => {
    try {
      setIsLoading(true);
      await debugLogger.logLifecycle('FETCH_START', { inspectionId, categoryId }, inspectionId || undefined);
      
      // Fetch questionnaire
      const data = await inspectionsApi.getQuestionnaire(inspectionId!);
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
      
      // Fetch saved answers from server
      try {
        const inspection = await inspectionsApi.getInspection(inspectionId!);
        const serverAnswers = inspection.inspection_answers || {};
        setSavedAnswers(serverAnswers);
        
        await debugLogger.logApiResponse('getInspection', {
          hasAnswers: Object.keys(serverAnswers).length > 0,
          answersCount: Object.keys(serverAnswers).length,
          answerKeys: Object.keys(serverAnswers),
        }, true, inspectionId || undefined);
        
        // Log the actual server answer structure for debugging
        categoryQuestions.forEach((q: Question) => {
          if (serverAnswers[q.id]) {
            debugLogger.log('DEBUG', 'STATE', `Server answer for ${q.id}`, {
              hasAnswer: !!serverAnswers[q.id].answer,
              answerType: typeof serverAnswers[q.id].answer,
              answerKeys: serverAnswers[q.id].answer ? Object.keys(serverAnswers[q.id].answer) : [],
              hasSub1: !!serverAnswers[q.id].sub_answer_1,
              hasSub2: !!serverAnswers[q.id].sub_answer_2,
            }, { questionId: q.id });
          }
        });
        
        // Load drafts from local storage
        const localDrafts = await loadDraftsFromStorage();
        
        // Merge: prefer local drafts over server answers for this category
        const mergedAnswers: Record<string, Answer> = {};
        categoryQuestions.forEach((q: Question) => {
          if (localDrafts[q.id] && localDrafts[q.id].isDraft) {
            // Local draft exists and is marked as draft - use it
            mergedAnswers[q.id] = { ...localDrafts[q.id], isDraft: true };
          } else if (serverAnswers[q.id]) {
            // Use server answer - NOT marked as draft (already saved)
            mergedAnswers[q.id] = { ...serverAnswers[q.id], isDraft: false };
          }
        });
        
        await debugLogger.log('DEBUG', 'STATE', 'Merged answers', {
          mergedCount: Object.keys(mergedAnswers).length,
          fromDrafts: Object.values(mergedAnswers).filter(a => a.isDraft).length,
          fromServer: Object.values(mergedAnswers).filter(a => !a.isDraft).length,
        });
        
        setDraftAnswers(mergedAnswers);
        
        // Check if we have unsaved drafts
        const hasDrafts = Object.values(mergedAnswers).some(a => a.isDraft);
        setHasUnsavedChanges(hasDrafts);
        
      } catch (answerErr: any) {
        await debugLogger.logApiError('getInspection', answerErr, inspectionId || undefined);
        // Try to load drafts even if server fetch failed
        const localDrafts = await loadDraftsFromStorage();
        setDraftAnswers(localDrafts);
        setHasUnsavedChanges(Object.keys(localDrafts).length > 0);
      }
      
    } catch (err: any) {
      await debugLogger.logApiError('loadData', err, inspectionId || undefined);
      Alert.alert('Error', `Failed to load questions: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Update local draft answer (NO API call)
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

  // Save all draft answers to server
  const saveAllAnswers = async () => {
    if (!inspectionId || !categoryId) return;
    
    const answersToSave = Object.entries(draftAnswers).filter(([_, answer]) => answer.isDraft);
    
    if (answersToSave.length === 0) {
      // No changes to save, just go back
      router.back();
      return;
    }
    
    setIsSaving(true);
    await debugLogger.logLifecycle('SAVE_ALL_START', {
      answersCount: answersToSave.length,
      questionIds: answersToSave.map(([id]) => id),
    }, inspectionId);
    
    try {
      // Save each answer
      for (const [questionId, answer] of answersToSave) {
        const payload: any = {
          question_id: questionId,
          category_id: categoryId,
        };
        
        if (answer.answer !== undefined) {
          payload.answer = answer.answer;
        }
        if (answer.sub_answer_1 !== undefined) {
          payload.sub_answer_1 = answer.sub_answer_1;
        }
        if (answer.sub_answer_2 !== undefined) {
          payload.sub_answer_2 = answer.sub_answer_2;
        }
        
        await debugLogger.logApiRequest(`saveProgress for ${questionId}`, {
          questionId,
          hasAnswer: !!payload.answer,
          hasSub1: !!payload.sub_answer_1,
          hasSub2: !!payload.sub_answer_2,
        }, inspectionId, questionId);
        
        await inspectionsApi.saveProgress(inspectionId, payload);
      }
      
      // Clear drafts after successful save
      await clearDraftsFromStorage();
      setHasUnsavedChanges(false);
      
      await debugLogger.logLifecycle('SAVE_ALL_SUCCESS', {
        savedCount: answersToSave.length,
      }, inspectionId);
      
      // Go back to categories
      router.back();
      
    } catch (err: any) {
      await debugLogger.logApiError('saveAllAnswers', err, inspectionId);
      Alert.alert('Save Failed', `Failed to save answers: ${err.message || 'Unknown error'}. Your answers are saved locally and will be synced later.`);
    } finally {
      setIsSaving(false);
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
          quality: 0.7,
          base64: true,
        });
      } else {
        result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
          allowsEditing: true,
          quality: 0.7,
          videoMaxDuration: maxDuration || 45,
        });
      }

      if (!result.canceled && result.assets[0]) {
        const existing = draftAnswers[questionId]?.[field] || {};
        const mediaData = mediaType === 'photo' 
          ? `data:image/jpeg;base64,${result.assets[0].base64}`
          : result.assets[0].uri;
        const newAnswer = { ...existing, media: mediaData };
        updateDraftAnswer(questionId, newAnswer, field);
      }
    } catch (err) {
      Alert.alert('Error', `Failed to capture ${mediaType}`);
    }
  };

  const handleImageCapture = async (questionId: string, field: string = 'answer') => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const imageData = `data:image/jpeg;base64,${result.assets[0].base64}`;
        updateDraftAnswer(questionId, imageData, field);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to capture image');
    }
  };

  const handleVideoCapture = async (questionId: string, maxDuration: number = 45, field: string = 'answer') => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsEditing: true,
        quality: 0.7,
        videoMaxDuration: maxDuration,
      });

      if (!result.canceled && result.assets[0]) {
        updateDraftAnswer(questionId, result.assets[0].uri, field);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to capture video');
    }
  };

  const renderAnswerInput = (question: Question, currentAnswer: any, field: string = 'answer', answerType?: string, options?: string[]) => {
    const isSubQuestion = field === 'sub_answer_1' || field === 'sub_answer_2';
    const type = answerType || (isSubQuestion ? 'multiple_choice' : question.answer_type);
    const opts = options || (isSubQuestion ? [] : question.options) || [];
    
    // For combo types, currentAnswer is { selection, media }
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
              <Text style={styles.comboMediaLabel}>Video Required (Max {question.video_max_duration || 45}s)</Text>
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
                  <Text style={styles.retakeText}>Retake Photo</Text>
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
                <TouchableOpacity style={styles.retakeButton} onPress={() => handleVideoCapture(question.id, question.video_max_duration || 45, field)}>
                  <Ionicons name="videocam" size={18} color="#fff" />
                  <Text style={styles.retakeText}>Retake Video</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.captureButton} onPress={() => handleVideoCapture(question.id, question.video_max_duration || 45, field)}>
                <Ionicons name="videocam" size={40} color={colors.primary} />
                <Text style={styles.captureText}>Record Video</Text>
                <Text style={styles.captureSubtext}>Max {question.video_max_duration || 45}s</Text>
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
            {isDraft && <Text style={styles.draftBadge}>Draft</Text>}
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

  // Calculate progress
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

  if (!inspectionId || !categoryId) {
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
          <Text style={styles.emptyText}>Invalid navigation parameters</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => {
          if (hasUnsavedChanges) {
            Alert.alert(
              'Unsaved Changes',
              'You have unsaved answers. Do you want to save before leaving?',
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
            {answeredCount} of {questions.length} answered
            {hasUnsavedChanges && ' • Unsaved'}
          </Text>
        </View>
        <TouchableOpacity style={styles.logsButton} onPress={() => setShowLogs(true)}>
          <Ionicons name="bug-outline" size={20} color={colors.warning} />
        </TouchableOpacity>
      </View>

      {/* Log Viewer Modal */}
      <LogViewer visible={showLogs} onClose={() => setShowLogs(false)} inspectionId={inspectionId || undefined} />

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>
        <Text style={styles.progressText}>{progressPercent}% Complete</Text>
      </View>

      {/* Questions List */}
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

      {/* Save & Next Button */}
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
  logsButton: { padding: 8, marginLeft: 8, backgroundColor: '#FEF3C7', borderRadius: 20 },
  progressBarContainer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.cardBg },
  progressBarBg: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', backgroundColor: colors.success, borderRadius: 4 },
  progressText: { fontSize: 12, color: colors.textSecondary, marginTop: 6, textAlign: 'right' },
  scrollView: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 100 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 12, fontSize: 16, color: colors.textSecondary },
  questionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
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
  captureSubtext: { fontSize: 12, color: colors.textSecondary },
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
