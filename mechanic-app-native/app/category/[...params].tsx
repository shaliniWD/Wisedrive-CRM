import React, { useState, useEffect } from 'react';
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
import { inspectionsApi } from '../../src/lib/api';

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

export default function CategoryQuestionsScreen() {
  const rawParams = useLocalSearchParams();
  const router = useRouter();
  
  // Extract inspectionId and categoryId from params
  // Expo Router catch-all routes return params as either string[] or string (comma-separated)
  const paramsArray = React.useMemo(() => {
    const p = rawParams.params;
    console.log('[CategoryScreen] Raw params:', JSON.stringify(rawParams));
    
    if (Array.isArray(p)) {
      return p;
    }
    if (typeof p === 'string') {
      // Could be comma-separated or a single value
      return p.includes(',') ? p.split(',') : [p];
    }
    return [];
  }, [rawParams]);
  
  const inspectionId = paramsArray[0] || null;
  const categoryId = paramsArray[1] || null;
  
  console.log('[CategoryScreen] Parsed - inspectionId:', inspectionId, 'categoryId:', categoryId);
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [categoryName, setCategoryName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    console.log('[CategoryScreen] useEffect triggered - inspectionId:', inspectionId, 'categoryId:', categoryId);
    if (inspectionId && categoryId) {
      fetchCategoryQuestions();
    } else if (!isLoading) {
      // Only show alert after initial load attempt, not immediately
      console.log('[CategoryScreen] Missing params, will show error');
    }
  }, [inspectionId, categoryId]);

  const fetchCategoryQuestions = async () => {
    try {
      setIsLoading(true);
      console.log('[CategoryScreen] Fetching questionnaire for inspection:', inspectionId);
      
      // Fetch questionnaire
      const data = await inspectionsApi.getQuestionnaire(inspectionId!);
      console.log('[CategoryScreen] API Response:', JSON.stringify(data, null, 2).substring(0, 2000));
      
      // Filter questions for this category
      const allQuestions = data.questions || [];
      console.log('[CategoryScreen] Total questions:', allQuestions.length);
      console.log('[CategoryScreen] Looking for categoryId:', categoryId);
      
      // Log all unique category IDs to debug filtering
      const uniqueCategoryIds = [...new Set(allQuestions.map((q: any) => q.category_id))];
      console.log('[CategoryScreen] Available category IDs:', uniqueCategoryIds);
      
      const categoryQuestions = allQuestions.filter(
        (q: any) => q.category_id === categoryId
      );
      
      console.log('[CategoryScreen] Filtered questions count:', categoryQuestions.length);
      
      // Log first question structure for debugging
      if (categoryQuestions.length > 0) {
        console.log('[CategoryScreen] First question structure:', JSON.stringify(categoryQuestions[0], null, 2));
      } else if (allQuestions.length > 0) {
        console.log('[CategoryScreen] Sample question structure:', JSON.stringify(allQuestions[0], null, 2));
      }
      
      // Get category name from first question or from categories
      if (categoryQuestions.length > 0 && categoryQuestions[0].category_name) {
        setCategoryName(categoryQuestions[0].category_name);
      } else {
        const categories = data.categories || [];
        const category = categories.find((c: any) => c.id === categoryId);
        setCategoryName(category?.name || categoryId || 'Questions');
      }
      
      setQuestions(categoryQuestions);
      
      // Fetch existing answers from inspection
      try {
        const inspection = await inspectionsApi.getInspection(inspectionId!);
        const existingAnswers = inspection.inspection_answers || {};
        setAnswers(existingAnswers);
        
        // Count saved answers for this category
        const savedInCategory = categoryQuestions.filter((q: Question) => existingAnswers[q.id]).length;
        setSavedCount(savedInCategory);
      } catch (answerErr) {
        console.log('[CategoryScreen] Could not fetch existing answers:', answerErr);
        // Continue without answers - they'll be empty
        setAnswers({});
        setSavedCount(0);
      }
      
    } catch (err: any) {
      console.error('[CategoryScreen] Error fetching questions:', err);
      console.error('[CategoryScreen] Error details:', err.message, err.response?.data);
      Alert.alert('Error', `Failed to load questions: ${err.message || 'Unknown error'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const saveAnswer = async (questionId: string, answerData: any, field: string = 'answer') => {
    setIsSaving(true);
    try {
      // Get current answers from state synchronously
      let currentQuestionAnswers = { ...answers[questionId] } || {};
      
      // Update the specific field
      currentQuestionAnswers[field] = answerData;
      currentQuestionAnswers.answered_at = new Date().toISOString();
      
      // Update local state
      const newAnswers = {
        ...answers,
        [questionId]: currentQuestionAnswers
      };
      setAnswers(newAnswers);
      
      // Prepare payload for backend - send all answer fields
      const payload: any = {
        question_id: questionId,
        category_id: categoryId,
      };
      
      // Include the appropriate answer field based on what was updated
      if (field === 'answer') {
        payload.answer = answerData;
      } else if (field === 'sub_answer_1') {
        payload.sub_answer_1 = answerData;
      } else if (field === 'sub_answer_2') {
        payload.sub_answer_2 = answerData;
      }
      
      console.log('[CategoryScreen] Saving answer:', JSON.stringify(payload));
      
      // Save to backend
      const response = await inspectionsApi.saveProgress(inspectionId!, payload);
      console.log('[CategoryScreen] Save response:', JSON.stringify(response));
      
      // Update saved count
      const savedInCategory = questions.filter(q => newAnswers[q.id]?.answer).length;
      setSavedCount(savedInCategory);
      
    } catch (err: any) {
      console.error('[CategoryScreen] Error saving answer:', err);
      console.error('[CategoryScreen] Error details:', err.message, err.response?.data);
      Alert.alert('Error', `Failed to save answer: ${err.response?.data?.detail || err.message || 'Unknown error'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleOptionSelect = (questionId: string, option: string, field: string = 'answer') => {
    saveAnswer(questionId, option, field);
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
        saveAnswer(questionId, imageData, field);
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
        // For video, we store the URI - in production, this would be uploaded to cloud storage
        saveAnswer(questionId, result.assets[0].uri, field);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to capture video');
    }
  };

  const renderAnswerInput = (question: Question, currentAnswer: any, field: string = 'answer', answerType?: string, options?: string[]) => {
    // IMPORTANT: For sub-questions, if answerType is not explicitly provided, 
    // use 'multiple_choice' as default (NOT the main question's type)
    // This prevents photo/video types from main question bleeding into sub-questions
    const isSubQuestion = field === 'sub_answer_1' || field === 'sub_answer_2';
    const type = answerType || (isSubQuestion ? 'multiple_choice' : question.answer_type);
    const opts = options || (isSubQuestion ? [] : question.options) || [];
    
    console.log(`[renderAnswerInput] field=${field}, answerType=${answerType}, resolvedType=${type}, options count=${opts.length}`);
    
    // Handle combined types (MCQ + Photo or MCQ + Video)
    // For combined types, currentAnswer should be an object: { selection: string, media: string }
    const isComboType = type === 'multiple_choice_photo' || type === 'multiple_choice_video';
    const comboAnswer = isComboType && typeof currentAnswer === 'object' ? currentAnswer : {};
    const selection = comboAnswer?.selection;
    const mediaData = comboAnswer?.media;
    
    // Helper to save combo answers
    const saveComboAnswer = (selectionValue?: string, mediaValue?: string) => {
      const newAnswer = {
        selection: selectionValue !== undefined ? selectionValue : selection,
        media: mediaValue !== undefined ? mediaValue : mediaData,
      };
      saveAnswer(question.id, newAnswer, field);
    };
    
    switch (type) {
      case 'multiple_choice':
        // If no options provided, show a message
        if (opts.length === 0) {
          return (
            <View style={styles.emptyOptionsContainer}>
              <Text style={styles.emptyOptionsText}>No options configured for this question</Text>
            </View>
          );
        }
        return (
          <View style={styles.optionsContainer}>
            {opts.map((option: string, idx: number) => (
              <TouchableOpacity
                key={idx}
                style={[
                  styles.optionButton,
                  currentAnswer === option && styles.optionButtonSelected,
                ]}
                onPress={() => handleOptionSelect(question.id, option, field)}
              >
                <View style={[
                  styles.optionRadio,
                  currentAnswer === option && styles.optionRadioSelected
                ]}>
                  {currentAnswer === option && (
                    <View style={styles.optionRadioInner} />
                  )}
                </View>
                <Text style={[
                  styles.optionText,
                  currentAnswer === option && styles.optionTextSelected
                ]}>{option}</Text>
              </TouchableOpacity>
            ))}
          </View>
        );
      
      // Multiple Choice + Photo: Show both MCQ options and photo capture
      case 'multiple_choice_photo':
        return (
          <View style={styles.comboContainer}>
            {/* Multiple Choice Options */}
            <View style={styles.optionsContainer}>
              {opts.map((option: string, idx: number) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.optionButton,
                    selection === option && styles.optionButtonSelected,
                  ]}
                  onPress={() => saveComboAnswer(option, undefined)}
                >
                  <View style={[
                    styles.optionRadio,
                    selection === option && styles.optionRadioSelected
                  ]}>
                    {selection === option && (
                      <View style={styles.optionRadioInner} />
                    )}
                  </View>
                  <Text style={[
                    styles.optionText,
                    selection === option && styles.optionTextSelected
                  ]}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Photo Capture Section */}
            <View style={styles.comboMediaSection}>
              <Text style={styles.comboMediaLabel}>Photo Required</Text>
              {mediaData ? (
                <View style={styles.mediaPreview}>
                  <Image source={{ uri: mediaData }} style={styles.previewImage} />
                  <TouchableOpacity
                    style={styles.retakeButton}
                    onPress={async () => {
                      try {
                        const result = await ImagePicker.launchCameraAsync({
                          mediaTypes: ImagePicker.MediaTypeOptions.Images,
                          allowsEditing: false,
                          quality: 0.7,
                          base64: true,
                        });
                        if (!result.canceled && result.assets[0]) {
                          const imageData = `data:image/jpeg;base64,${result.assets[0].base64}`;
                          saveComboAnswer(undefined, imageData);
                        }
                      } catch (err) {
                        Alert.alert('Error', 'Failed to capture image');
                      }
                    }}
                  >
                    <Ionicons name="camera" size={18} color="#fff" />
                    <Text style={styles.retakeText}>Retake Photo</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={async () => {
                    try {
                      const result = await ImagePicker.launchCameraAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Images,
                        allowsEditing: false,
                        quality: 0.7,
                        base64: true,
                      });
                      if (!result.canceled && result.assets[0]) {
                        const imageData = `data:image/jpeg;base64,${result.assets[0].base64}`;
                        saveComboAnswer(undefined, imageData);
                      }
                    } catch (err) {
                      Alert.alert('Error', 'Failed to capture image');
                    }
                  }}
                >
                  <Ionicons name="camera" size={40} color={colors.primary} />
                  <Text style={styles.captureText}>Take Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      
      // Multiple Choice + Video: Show both MCQ options and video capture
      case 'multiple_choice_video':
        return (
          <View style={styles.comboContainer}>
            {/* Multiple Choice Options */}
            <View style={styles.optionsContainer}>
              {opts.map((option: string, idx: number) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.optionButton,
                    selection === option && styles.optionButtonSelected,
                  ]}
                  onPress={() => saveComboAnswer(option, undefined)}
                >
                  <View style={[
                    styles.optionRadio,
                    selection === option && styles.optionRadioSelected
                  ]}>
                    {selection === option && (
                      <View style={styles.optionRadioInner} />
                    )}
                  </View>
                  <Text style={[
                    styles.optionText,
                    selection === option && styles.optionTextSelected
                  ]}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
            
            {/* Video Capture Section */}
            <View style={styles.comboMediaSection}>
              <Text style={styles.comboMediaLabel}>Video Required (Max {question.video_max_duration || 45}s)</Text>
              {mediaData ? (
                <View style={styles.mediaPreview}>
                  <View style={styles.videoPlaceholder}>
                    <Ionicons name="videocam" size={40} color={colors.success} />
                    <Text style={styles.videoRecordedText}>Video Recorded</Text>
                  </View>
                  <TouchableOpacity
                    style={styles.retakeButton}
                    onPress={async () => {
                      try {
                        const result = await ImagePicker.launchCameraAsync({
                          mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                          allowsEditing: true,
                          quality: 0.7,
                          videoMaxDuration: question.video_max_duration || 45,
                        });
                        if (!result.canceled && result.assets[0]) {
                          saveComboAnswer(undefined, result.assets[0].uri);
                        }
                      } catch (err) {
                        Alert.alert('Error', 'Failed to capture video');
                      }
                    }}
                  >
                    <Ionicons name="videocam" size={18} color="#fff" />
                    <Text style={styles.retakeText}>Retake Video</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={async () => {
                    try {
                      const result = await ImagePicker.launchCameraAsync({
                        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                        allowsEditing: true,
                        quality: 0.7,
                        videoMaxDuration: question.video_max_duration || 45,
                      });
                      if (!result.canceled && result.assets[0]) {
                        saveComboAnswer(undefined, result.assets[0].uri);
                      }
                    } catch (err) {
                      Alert.alert('Error', 'Failed to capture video');
                    }
                  }}
                >
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
              style={[
                styles.yesNoButton,
                currentAnswer === 'Yes' && styles.yesButtonSelected,
              ]}
              onPress={() => handleOptionSelect(question.id, 'Yes', field)}
            >
              <Ionicons name="checkmark-circle" size={24} color={currentAnswer === 'Yes' ? '#fff' : colors.success} />
              <Text style={[styles.yesNoText, currentAnswer === 'Yes' && styles.yesNoTextSelected]}>Yes</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.yesNoButton,
                currentAnswer === 'No' && styles.noButtonSelected,
              ]}
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
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={() => handleImageCapture(question.id, field)}
                >
                  <Ionicons name="camera" size={18} color="#fff" />
                  <Text style={styles.retakeText}>Retake Photo</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.captureButton}
                onPress={() => handleImageCapture(question.id, field)}
              >
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
                <TouchableOpacity
                  style={styles.retakeButton}
                  onPress={() => handleVideoCapture(question.id, question.video_max_duration || 45, field)}
                >
                  <Ionicons name="videocam" size={18} color="#fff" />
                  <Text style={styles.retakeText}>Retake Video</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                style={styles.captureButton}
                onPress={() => handleVideoCapture(question.id, question.video_max_duration || 45, field)}
              >
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
            onChangeText={(text) => saveAnswer(question.id, text, field)}
            placeholder="Enter your answer..."
            placeholderTextColor={colors.textSecondary}
            multiline
          />
        );
    }
  };

  const renderQuestion = (question: Question, index: number) => {
    const currentAnswer = answers[question.id];
    const isAnswered = !!currentAnswer?.answer;

    return (
      <View key={question.id} style={[styles.questionCard, isAnswered && styles.questionAnswered]}>
        {/* Main Question */}
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
            {question.is_mandatory && (
              <Text style={styles.mandatoryBadge}>Required</Text>
            )}
          </View>
        </View>

        <View style={styles.answerContainer}>
          {renderAnswerInput(question, currentAnswer?.answer, 'answer')}
        </View>

        {/* Sub Question 1 */}
        {question.sub_question_1 && (
          <View style={styles.subQuestionContainer}>
            <Text style={styles.subQuestionText}>{question.sub_question_1}</Text>
            <View style={styles.answerContainer}>
              {renderAnswerInput(
                question, 
                currentAnswer?.sub_answer_1, 
                'sub_answer_1',
                question.sub_answer_type_1,
                question.sub_options_1
              )}
            </View>
          </View>
        )}

        {/* Sub Question 2 */}
        {question.sub_question_2 && (
          <View style={styles.subQuestionContainer}>
            <Text style={styles.subQuestionText}>{question.sub_question_2}</Text>
            <View style={styles.answerContainer}>
              {renderAnswerInput(
                question, 
                currentAnswer?.sub_answer_2, 
                'sub_answer_2',
                question.sub_answer_type_2,
                question.sub_options_2
              )}
            </View>
          </View>
        )}
      </View>
    );
  };

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

  // Show error if params are missing after loading completes
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
          <Text style={styles.emptySubtext}>Inspection: {inspectionId || 'missing'}</Text>
          <Text style={styles.emptySubtext}>Category: {categoryId || 'missing'}</Text>
          <TouchableOpacity 
            style={{ marginTop: 20, padding: 12, backgroundColor: colors.primary, borderRadius: 8 }}
            onPress={() => router.back()}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>{categoryName}</Text>
          <Text style={styles.headerSubtitle}>
            {savedCount} of {questions.length} answered
          </Text>
        </View>
        {isSaving && (
          <View style={styles.savingBadge}>
            <ActivityIndicator size="small" color="#fff" />
            <Text style={styles.savingText}>Saving</Text>
          </View>
        )}
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBg}>
          <View 
            style={[
              styles.progressBarFill, 
              { width: `${questions.length > 0 ? (savedCount / questions.length) * 100 : 0}%` }
            ]} 
          />
        </View>
        <Text style={styles.progressText}>
          {questions.length > 0 ? Math.round((savedCount / questions.length) * 100) : 0}% Complete
        </Text>
      </View>

      {/* Questions List */}
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {questions.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="document-text-outline" size={48} color={colors.textSecondary} />
              <Text style={styles.emptyText}>No questions in this category</Text>
              <Text style={styles.emptySubtext}>Category ID: {categoryId}</Text>
            </View>
          ) : (
            questions.map((question, index) => renderQuestion(question, index))
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Done Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.doneButton,
            savedCount === questions.length && questions.length > 0 && styles.doneButtonComplete
          ]}
          onPress={() => router.back()}
        >
          <Ionicons 
            name={savedCount === questions.length && questions.length > 0 ? "checkmark-circle" : "arrow-back"} 
            size={22} 
            color="#fff" 
          />
          <Text style={styles.doneButtonText}>
            {savedCount === questions.length && questions.length > 0 ? 'Category Complete!' : 'Back to Categories'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.cardBg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitleContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  savingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  savingText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  progressBarContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.cardBg,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.success,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 6,
    textAlign: 'right',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    color: colors.textSecondary,
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
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
  questionAnswered: {
    borderColor: colors.success,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  questionNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  questionNumberBadgeAnswered: {
    backgroundColor: colors.success,
  },
  questionNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  questionTextContainer: {
    flex: 1,
  },
  questionText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 24,
  },
  mandatoryBadge: {
    fontSize: 11,
    color: colors.danger,
    fontWeight: '600',
    marginTop: 4,
  },
  answerContainer: {
    marginTop: 8,
  },
  subQuestionContainer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  subQuestionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  // Combo container styles (MCQ + Photo/Video)
  comboContainer: {
    gap: 20,
  },
  comboMediaSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  comboMediaLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  optionsContainer: {
    gap: 10,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.border,
  },
  optionButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: '#EFF6FF',
  },
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
  optionRadioSelected: {
    borderColor: colors.primary,
  },
  optionRadioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  optionText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  optionTextSelected: {
    color: colors.primary,
    fontWeight: '600',
  },
  yesNoContainer: {
    flexDirection: 'row',
    gap: 12,
  },
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
  yesButtonSelected: {
    backgroundColor: colors.success,
    borderColor: colors.success,
  },
  noButtonSelected: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  yesNoText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  yesNoTextSelected: {
    color: '#fff',
  },
  mediaContainer: {
    alignItems: 'center',
  },
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
  captureText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
  },
  captureSubtext: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  mediaPreview: {
    width: '100%',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  videoPlaceholder: {
    width: '100%',
    height: 150,
    borderRadius: 12,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  videoRecordedText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.success,
  },
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
  retakeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
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
  footer: {
    padding: 16,
    backgroundColor: colors.cardBg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  doneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  doneButtonComplete: {
    backgroundColor: colors.success,
  },
  doneButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
