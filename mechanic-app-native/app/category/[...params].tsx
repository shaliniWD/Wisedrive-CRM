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
import { inspectionsApi } from '../../src/lib/api';

interface Question {
  id: string;
  text: string;
  question_text?: string;
  type: string;
  input_type?: string;
  options?: string[];
  required?: boolean;
  category_id?: string;
}

interface Answer {
  answer: any;
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
  const { params } = useLocalSearchParams<{ params: string[] }>();
  const router = useRouter();
  
  // Extract inspectionId and categoryId from params array
  const inspectionId = params?.[0];
  const categoryId = params?.[1];
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [categoryName, setCategoryName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);

  useEffect(() => {
    if (inspectionId && categoryId) {
      fetchCategoryQuestions();
    } else {
      Alert.alert('Error', 'Invalid navigation parameters');
      router.back();
    }
  }, [inspectionId, categoryId]);

  const fetchCategoryQuestions = async () => {
    try {
      // Fetch questionnaire
      const data = await inspectionsApi.getQuestionnaire(inspectionId!);
      
      // Filter questions for this category
      const allQuestions = data.questions || [];
      const categoryQuestions = allQuestions.filter(
        (q: Question) => q.category_id === categoryId
      );
      
      // Get category name
      const categories = data.categories || [];
      const category = categories.find((c: any) => c.id === categoryId);
      setCategoryName(category?.name || categoryId || 'Questions');
      
      setQuestions(categoryQuestions);
      
      // Fetch existing answers from inspection
      const inspection = await inspectionsApi.getInspection(inspectionId!);
      const existingAnswers = inspection.inspection_answers || {};
      setAnswers(existingAnswers);
      
      // Count saved answers for this category
      const savedInCategory = categoryQuestions.filter((q: Question) => existingAnswers[q.id]).length;
      setSavedCount(savedInCategory);
      
    } catch (err) {
      console.error('Error fetching questions:', err);
      Alert.alert('Error', 'Failed to load questions');
    } finally {
      setIsLoading(false);
    }
  };

  const saveAnswer = async (questionId: string, answer: any) => {
    setIsSaving(true);
    try {
      // Save to backend
      await inspectionsApi.saveProgress(inspectionId!, {
        question_id: questionId,
        answer: answer,
        category_id: categoryId,
      });
      
      // Update local state
      setAnswers(prev => ({
        ...prev,
        [questionId]: { answer, answered_at: new Date().toISOString() }
      }));
      
      // Update saved count
      const newAnswers = { ...answers, [questionId]: { answer } };
      const savedInCategory = questions.filter(q => newAnswers[q.id]).length;
      setSavedCount(savedInCategory);
      
    } catch (err) {
      console.error('Error saving answer:', err);
      Alert.alert('Error', 'Failed to save answer');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTextAnswer = (questionId: string, text: string) => {
    // Debounce the save - save after user stops typing
    setAnswers(prev => ({
      ...prev,
      [questionId]: { answer: text, answered_at: new Date().toISOString() }
    }));
  };

  const handleTextBlur = (questionId: string) => {
    const answer = answers[questionId]?.answer;
    if (answer) {
      saveAnswer(questionId, answer);
    }
  };

  const handleOptionSelect = (questionId: string, option: string) => {
    saveAnswer(questionId, option);
  };

  const handleYesNo = (questionId: string, value: 'Yes' | 'No') => {
    saveAnswer(questionId, value);
  };

  const handleConditionSelect = (questionId: string, condition: string) => {
    saveAnswer(questionId, condition);
  };

  const handleImagePicker = async (questionId: string) => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.7,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        const imageData = `data:image/jpeg;base64,${result.assets[0].base64}`;
        saveAnswer(questionId, imageData);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to capture image');
    }
  };

  const renderQuestion = (question: Question, index: number) => {
    const questionText = question.text || question.question_text || '';
    const inputType = question.input_type || question.type || 'text';
    const currentAnswer = answers[question.id]?.answer;
    const isAnswered = !!currentAnswer;

    return (
      <View key={question.id} style={[styles.questionCard, isAnswered && styles.questionAnswered]}>
        <View style={styles.questionHeader}>
          <View style={styles.questionNumberBadge}>
            <Text style={styles.questionNumber}>{index + 1}</Text>
          </View>
          <Text style={styles.questionText}>{questionText}</Text>
          {isAnswered && (
            <Ionicons name="checkmark-circle" size={22} color={colors.success} />
          )}
        </View>

        <View style={styles.answerContainer}>
          {inputType === 'text' && (
            <TextInput
              style={styles.textInput}
              value={currentAnswer || ''}
              onChangeText={(text) => handleTextAnswer(question.id, text)}
              onBlur={() => handleTextBlur(question.id)}
              placeholder="Enter your answer..."
              placeholderTextColor={colors.textSecondary}
              multiline
            />
          )}

          {inputType === 'number' && (
            <TextInput
              style={styles.textInput}
              value={currentAnswer?.toString() || ''}
              onChangeText={(text) => handleTextAnswer(question.id, text)}
              onBlur={() => handleTextBlur(question.id)}
              placeholder="Enter value..."
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
            />
          )}

          {inputType === 'yes_no' && (
            <View style={styles.yesNoContainer}>
              <TouchableOpacity
                style={[
                  styles.yesNoButton,
                  currentAnswer === 'Yes' && styles.yesNoButtonSelected,
                  currentAnswer === 'Yes' && { backgroundColor: colors.success },
                ]}
                onPress={() => handleYesNo(question.id, 'Yes')}
              >
                <Ionicons 
                  name="checkmark-circle" 
                  size={20} 
                  color={currentAnswer === 'Yes' ? '#fff' : colors.success} 
                />
                <Text style={[
                  styles.yesNoText,
                  currentAnswer === 'Yes' && styles.yesNoTextSelected
                ]}>Yes</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.yesNoButton,
                  currentAnswer === 'No' && styles.yesNoButtonSelected,
                  currentAnswer === 'No' && { backgroundColor: colors.danger },
                ]}
                onPress={() => handleYesNo(question.id, 'No')}
              >
                <Ionicons 
                  name="close-circle" 
                  size={20} 
                  color={currentAnswer === 'No' ? '#fff' : colors.danger} 
                />
                <Text style={[
                  styles.yesNoText,
                  currentAnswer === 'No' && styles.yesNoTextSelected
                ]}>No</Text>
              </TouchableOpacity>
            </View>
          )}

          {inputType === 'condition' && (
            <View style={styles.conditionContainer}>
              {['Good', 'Average', 'Poor', 'N/A'].map((condition) => (
                <TouchableOpacity
                  key={condition}
                  style={[
                    styles.conditionButton,
                    currentAnswer === condition && styles.conditionButtonSelected,
                    currentAnswer === condition && {
                      backgroundColor: condition === 'Good' ? colors.success :
                                       condition === 'Average' ? colors.warning :
                                       condition === 'Poor' ? colors.danger : colors.textSecondary
                    }
                  ]}
                  onPress={() => handleConditionSelect(question.id, condition)}
                >
                  <Text style={[
                    styles.conditionText,
                    currentAnswer === condition && styles.conditionTextSelected
                  ]}>{condition}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {inputType === 'select' && question.options && (
            <View style={styles.optionsContainer}>
              {question.options.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[
                    styles.optionButton,
                    currentAnswer === option && styles.optionButtonSelected,
                  ]}
                  onPress={() => handleOptionSelect(question.id, option)}
                >
                  <View style={[
                    styles.optionRadio,
                    currentAnswer === option && styles.optionRadioSelected
                  ]}>
                    {currentAnswer === option && (
                      <View style={styles.optionRadioInner} />
                    )}
                  </View>
                  <Text style={styles.optionText}>{option}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {inputType === 'image' && (
            <View style={styles.imageContainer}>
              {currentAnswer ? (
                <View style={styles.imagePreview}>
                  <Image source={{ uri: currentAnswer }} style={styles.previewImage} />
                  <TouchableOpacity
                    style={styles.retakeButton}
                    onPress={() => handleImagePicker(question.id)}
                  >
                    <Ionicons name="camera" size={16} color="#fff" />
                    <Text style={styles.retakeText}>Retake</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.captureButton}
                  onPress={() => handleImagePicker(question.id)}
                >
                  <Ionicons name="camera" size={32} color={colors.primary} />
                  <Text style={styles.captureText}>Take Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{categoryName}</Text>
          <Text style={styles.headerSubtitle}>
            {savedCount} of {questions.length} answered
          </Text>
        </View>
        {isSaving && (
          <ActivityIndicator size="small" color={colors.primary} style={styles.savingIndicator} />
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
            savedCount === questions.length && styles.doneButtonComplete
          ]}
          onPress={() => router.back()}
        >
          <Text style={styles.doneButtonText}>
            {savedCount === questions.length ? 'All Done!' : 'Back to Categories'}
          </Text>
          <Ionicons 
            name={savedCount === questions.length ? "checkmark-circle" : "arrow-back"} 
            size={20} 
            color="#fff" 
          />
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
  savingIndicator: {
    marginLeft: 12,
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
  questionCard: {
    backgroundColor: colors.cardBg,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  questionAnswered: {
    borderColor: colors.success,
    borderWidth: 2,
  },
  questionHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  questionNumberBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  questionNumber: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  questionText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 22,
  },
  answerContainer: {
    marginTop: 8,
  },
  textInput: {
    backgroundColor: colors.background,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
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
    padding: 14,
    borderRadius: 10,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
  },
  yesNoButtonSelected: {
    borderWidth: 0,
  },
  yesNoText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  yesNoTextSelected: {
    color: '#fff',
  },
  conditionContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  conditionButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  conditionButtonSelected: {
    borderWidth: 0,
  },
  conditionText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  conditionTextSelected: {
    color: '#fff',
  },
  optionsContainer: {
    gap: 8,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: '#EFF6FF',
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
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
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  optionText: {
    fontSize: 15,
    color: colors.text,
  },
  imageContainer: {
    alignItems: 'center',
  },
  captureButton: {
    width: '100%',
    padding: 24,
    borderRadius: 12,
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 8,
  },
  captureText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  imagePreview: {
    width: '100%',
    alignItems: 'center',
  },
  previewImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    backgroundColor: colors.background,
  },
  retakeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginTop: 12,
    gap: 6,
  },
  retakeText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
    gap: 8,
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
