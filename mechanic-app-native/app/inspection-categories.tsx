import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useInspection } from '../src/context/InspectionContext';
import { inspectionsApi } from '../src/lib/api';

const { width } = Dimensions.get('window');

// Modern Color Palette
const Colors = {
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  primaryLight: '#EFF6FF',
  secondary: '#8B5CF6',
  accent: '#06B6D4',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  error: '#EF4444',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceHover: '#F1F5F9',
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  gradient1: '#3B82F6',
  gradient2: '#8B5CF6',
};

interface Category {
  id: string;
  name: string;
  icon: string;
  questionsCount: number;
  completedCount: number;
  isCompleted: boolean;
  order: number;
}

// Icon mapping for category names
const CATEGORY_ICONS: { [key: string]: { name: string; type: 'ionicons' | 'material-community' } } = {
  'general': { name: 'information-circle-outline', type: 'ionicons' },
  'engine': { name: 'engine', type: 'material-community' },
  'exterior': { name: 'car-outline', type: 'ionicons' },
  'interior': { name: 'car-seat', type: 'material-community' },
  'transmission': { name: 'cog-transfer-outline', type: 'material-community' },
  'suspension': { name: 'car-lifted-pickup', type: 'material-community' },
  'brakes': { name: 'car-brake-abs', type: 'material-community' },
  'electrical': { name: 'flash-outline', type: 'ionicons' },
  'tyres': { name: 'tire', type: 'material-community' },
  'wheels': { name: 'tire', type: 'material-community' },
  'steering': { name: 'steering', type: 'material-community' },
  'ac': { name: 'snowflake', type: 'material-community' },
  'climate': { name: 'thermometer', type: 'material-community' },
  'safety': { name: 'shield-checkmark-outline', type: 'ionicons' },
  'documents': { name: 'document-text-outline', type: 'ionicons' },
  'default': { name: 'clipboard-list-outline', type: 'material-community' },
};

const getIconForCategory = (categoryName: string): { name: string; type: 'ionicons' | 'material-community' } => {
  const normalizedName = categoryName.toLowerCase();
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (normalizedName.includes(key)) {
      return icon;
    }
  }
  return CATEGORY_ICONS.default;
};

// Category colors for visual variety
const CATEGORY_COLORS = [
  { bg: '#EFF6FF', accent: '#3B82F6' },
  { bg: '#F0FDF4', accent: '#22C55E' },
  { bg: '#FEF3C7', accent: '#F59E0B' },
  { bg: '#FDF4FF', accent: '#A855F7' },
  { bg: '#ECFEFF', accent: '#06B6D4' },
  { bg: '#FFF1F2', accent: '#F43F5E' },
  { bg: '#F0FDFA', accent: '#14B8A6' },
  { bg: '#FEF9C3', accent: '#EAB308' },
];

export default function InspectionCategoriesScreen() {
  const { currentInspectionId, currentInspection, clearInspection, obdScanResult, setOBDScanResult } = useInspection();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState<string>('');
  
  // Check OBD completion from both context AND backend data
  const [obdSubmittedToBackend, setObdSubmittedToBackend] = useState(false);
  const [backendObdData, setBackendObdData] = useState<{ dtcCount: number; liveDataCount: number } | null>(null);
  const [obdRescanEnabled, setObdRescanEnabled] = useState(false);
  
  // OBD is completed if either context says so OR backend has OBD data (and rescan is NOT enabled)
  const obdCompleted = (obdScanResult?.completed || obdSubmittedToBackend) && !obdRescanEnabled;
  const obdResults = obdScanResult || (obdSubmittedToBackend ? { completed: true, ...backendObdData } : null);

  // Refresh data when screen comes into focus (after returning from Q&A)
  useFocusEffect(
    useCallback(() => {
      console.log('[Categories] Screen focused, refreshing data...');
      fetchQuestionnaire();
    }, [currentInspectionId])
  );

  const fetchQuestionnaire = async () => {
    if (!currentInspectionId) {
      setLoadError('No inspection selected');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setLoadError(null);
      
      console.log('[Categories] Fetching questionnaire for inspection:', currentInspectionId);
      
      // Fetch both questionnaire and inspection details (for answers) in parallel
      const [data, inspectionData] = await Promise.all([
        inspectionsApi.getQuestionnaire(currentInspectionId),
        inspectionsApi.getInspection(currentInspectionId).catch(() => null)
      ]);
      
      // Get saved answers
      const savedAnswers = inspectionData?.inspection_answers || {};
      console.log('[Categories] Saved answers count:', Object.keys(savedAnswers).length);
      
      // Check if OBD data was already submitted to backend
      // Backend stores obd_results_ref or obd_total_errors when OBD is submitted
      const hasOBDFromBackend = !!(inspectionData?.obd_results_ref || inspectionData?.obd_total_errors !== undefined);
      const rescanEnabled = inspectionData?.obd_rescan_enabled || false;
      
      if (hasOBDFromBackend) {
        console.log('[Categories] OBD already submitted to backend, rescan enabled:', rescanEnabled);
        setObdSubmittedToBackend(true);
        setObdRescanEnabled(rescanEnabled);
        setBackendObdData({
          dtcCount: inspectionData?.obd_total_errors || 0,
          liveDataCount: 0, // Backend doesn't store this separately
        });
      } else {
        setObdSubmittedToBackend(false);
        setObdRescanEnabled(false);
        setBackendObdData(null);
      }
      
      setTemplateName(data.inspection_template_name || '');
      
      if (data && data.questions && Array.isArray(data.questions)) {
        // Get category order from template
        const categoryOrder = data.category_order || [];
        const categoriesFromApi = data.categories || [];
        
        // Create category map with order
        const categoryOrderMap = new Map<string, number>();
        categoryOrder.forEach((catId: string, index: number) => {
          categoryOrderMap.set(catId, index);
        });
        
        // Create category name map
        const categoryNameMap = new Map<string, string>();
        categoriesFromApi.forEach((cat: any) => {
          categoryNameMap.set(cat.id, cat.name);
        });
        
        // Group questions by category
        const categoryMap = new Map<string, { questions: any[], categoryId: string, categoryName: string }>();
        
        data.questions.forEach((question: any) => {
          const categoryId = question.category_id || 'general';
          const categoryName = question.category_name || categoryNameMap.get(categoryId) || 'General';
          
          if (!categoryMap.has(categoryId)) {
            categoryMap.set(categoryId, { questions: [], categoryId, categoryName });
          }
          categoryMap.get(categoryId)!.questions.push(question);
        });
        
        // Convert to category array with proper ordering and completion status
        const dynamicCategories: Category[] = [];
        categoryMap.forEach((value, key) => {
          const order = categoryOrderMap.has(key) ? categoryOrderMap.get(key)! : 999;
          
          // Count completed questions (questions that have an answer in savedAnswers)
          const completedCount = value.questions.filter(q => {
            const ans = savedAnswers[q.id];
            return ans && ans.answer !== undefined && ans.answer !== null;
          }).length;
          
          const isCompleted = completedCount === value.questions.length && value.questions.length > 0;
          
          dynamicCategories.push({
            id: key,
            name: value.categoryName,
            icon: getIconForCategory(value.categoryName).name,
            questionsCount: value.questions.length,
            completedCount: completedCount,
            isCompleted: isCompleted,
            order: order,
          });
        });
        
        // Sort by the category_order from template
        dynamicCategories.sort((a, b) => a.order - b.order);
        
        setCategories(dynamicCategories);
        console.log('[Categories] Loaded', dynamicCategories.length, 'categories with completion status');
      } else {
        setLoadError('No questionnaire found for this inspection');
      }
    } catch (error: any) {
      console.error('Failed to fetch questionnaire:', error);
      setLoadError(error.message || 'Failed to load questionnaire');
    } finally {
      setIsLoading(false);
    }
  };

  const totalQuestions = categories.reduce((acc, cat) => acc + cat.questionsCount, 0);
  const completedQuestions = categories.reduce((acc, cat) => acc + cat.completedCount, 0);
  const allCategoriesCompleted = categories.length > 0 && categories.every(cat => cat.isCompleted);
  const progress = totalQuestions > 0 ? (completedQuestions / totalQuestions) * 100 : 0;

  const handleOBDScan = () => {
    router.push('/scanner');
  };

  const handleCategoryPress = (category: Category) => {
    if (!currentInspectionId) {
      Alert.alert('Error', 'No inspection selected');
      return;
    }
    // Navigate directly to category questions screen with inspection ID and category ID
    // Using the catch-all route /category/[...params] with format: /category/inspectionId/categoryId
    router.push(`/category/${currentInspectionId}/${category.id}`);
  };

  const handleSubmitInspection = async () => {
    if (!allCategoriesCompleted) {
      Alert.alert('Incomplete', 'Please complete all inspection categories before submitting.');
      return;
    }
    
    // OBD is optional - just warn if not done
    if (!obdCompleted) {
      Alert.alert(
        'OBD Scan Not Completed',
        'You haven\'t completed the OBD-II diagnostic scan. Do you want to submit anyway?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Submit Anyway', onPress: submitInspection }
        ]
      );
      return;
    }

    submitInspection();
  };
  
  const submitInspection = async () => {
    try {
      await inspectionsApi.completeInspection(currentInspectionId!);
      Alert.alert('Success', 'Inspection submitted successfully!', [
        { text: 'OK', onPress: () => {
          clearInspection();
          router.replace('/home');
        }}
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to submit inspection. Please try again.');
    }
  };

  const renderIcon = (category: Category, color: string) => {
    const iconInfo = getIconForCategory(category.name);
    const iconProps = { size: 22, color };
    
    if (iconInfo.type === 'ionicons') {
      return <Ionicons name={iconInfo.name as any} {...iconProps} />;
    }
    return <MaterialCommunityIcons name={iconInfo.name as any} {...iconProps} />;
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <View style={styles.loadingSpinner}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
          <Text style={styles.loadingTitle}>Loading Inspection</Text>
          <Text style={styles.loadingText}>Fetching questionnaire...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Modern Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Inspection</Text>
          <Text style={styles.headerSubtitle}>{currentInspection?.vehicleNumber || 'N/A'}</Text>
        </View>
        <TouchableOpacity onPress={fetchQuestionnaire} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={20} color={Colors.textSecondary} />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Progress Card */}
        <View style={styles.progressCard}>
          <LinearGradient
            colors={[Colors.gradient1, Colors.gradient2]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.progressGradient}
          >
            <View style={styles.progressHeader}>
              <View>
                <Text style={styles.progressTitle}>Overall Progress</Text>
                <Text style={styles.progressSubtitle}>{completedQuestions} of {totalQuestions} questions</Text>
              </View>
              <View style={styles.progressBadge}>
                <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
              </View>
            </View>
            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBg}>
                <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* OBD Scan Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Diagnostics</Text>
        </View>

        {/* Show non-interactive card when OBD is already submitted */}
        {obdCompleted ? (
          <View style={styles.obdCard}>
            <LinearGradient
              colors={['#059669', '#10B981']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.obdGradient}
            >
              <View style={styles.obdLeft}>
                <View style={styles.obdIconBox}>
                  <MaterialCommunityIcons 
                    name="check-circle"
                    size={28} 
                    color="#FFF" 
                  />
                </View>
                <View style={styles.obdInfo}>
                  <Text style={styles.obdTitle}>OBD-II Scan</Text>
                  <Text style={styles.obdStatus}>Completed & Submitted</Text>
                </View>
              </View>
              
              <View style={styles.obdDoneChip}>
                <Ionicons name="checkmark" size={14} color="#059669" />
                <Text style={styles.obdDoneText}>Done</Text>
              </View>
            </LinearGradient>

            {obdResults && (
              <View style={styles.obdResults}>
                <View style={styles.obdResultItem}>
                  <Text style={styles.obdResultValue}>{obdResults.dtcCount || 0}</Text>
                  <Text style={styles.obdResultLabel}>DTCs Found</Text>
                </View>
                <View style={styles.obdResultDivider} />
                <View style={styles.obdResultItem}>
                  <Text style={styles.obdResultValue}>{obdResults.liveDataCount || 0}</Text>
                  <Text style={styles.obdResultLabel}>Data Points</Text>
                </View>
              </View>
            )}
          </View>
        ) : (
          <TouchableOpacity 
            style={styles.obdCard}
            onPress={handleOBDScan}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[Colors.primary, Colors.primaryDark]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.obdGradient}
            >
              <View style={styles.obdLeft}>
                <View style={styles.obdIconBox}>
                  <MaterialCommunityIcons 
                    name="car-cog"
                    size={28} 
                    color="#FFF" 
                  />
                </View>
                <View style={styles.obdInfo}>
                  <Text style={styles.obdTitle}>OBD-II Scan</Text>
                  <Text style={styles.obdStatus}>Optional - can be done anytime</Text>
                </View>
              </View>
              
              <View style={styles.obdStartChip}>
                <MaterialIcons name="bluetooth-searching" size={16} color={Colors.primary} />
                <Text style={styles.obdStartText}>Start</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Categories Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Inspection Checklist</Text>
          <Text style={styles.sectionCount}>{totalQuestions} items</Text>
        </View>

        {/* Error State */}
        {loadError && categories.length === 0 && (
          <View style={styles.errorCard}>
            <View style={styles.errorIconBox}>
              <Ionicons name="alert-circle" size={32} color={Colors.warning} />
            </View>
            <Text style={styles.errorTitle}>No Questionnaire Found</Text>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchQuestionnaire}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Category Cards - Modern Design */}
        {categories.map((category, index) => {
          const colorSet = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
          
          return (
            <TouchableOpacity
              key={category.id}
              style={styles.categoryCard}
              onPress={() => handleCategoryPress(category)}
              activeOpacity={0.7}
            >
              <View style={[styles.categoryIcon, { backgroundColor: colorSet.bg }]}>
                {renderIcon(category, colorSet.accent)}
              </View>
              
              <View style={styles.categoryContent}>
                <Text style={styles.categoryName} numberOfLines={1}>{category.name}</Text>
                <View style={styles.categoryMeta}>
                  <View style={styles.categoryProgressBar}>
                    <View 
                      style={[
                        styles.categoryProgressFill, 
                        { 
                          width: `${category.questionsCount > 0 ? (category.completedCount / category.questionsCount) * 100 : 0}%`,
                          backgroundColor: colorSet.accent 
                        }
                      ]} 
                    />
                  </View>
                  <Text style={styles.categoryCount}>
                    {category.completedCount}/{category.questionsCount}
                  </Text>
                </View>
              </View>

              <View style={styles.categoryArrow}>
                {category.isCompleted ? (
                  <View style={[styles.completeBadge, { backgroundColor: Colors.successLight }]}>
                    <Ionicons name="checkmark" size={16} color={Colors.success} />
                  </View>
                ) : (
                  <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Submit Button */}
        {categories.length > 0 && (
          <TouchableOpacity
            style={[styles.submitBtn, !allCategoriesCompleted && styles.submitBtnDisabled]}
            onPress={handleSubmitInspection}
            disabled={!allCategoriesCompleted}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={allCategoriesCompleted ? [Colors.success, '#059669'] : ['#CBD5E1', '#94A3B8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.submitGradient}
            >
              <MaterialIcons name="check-circle" size={22} color="#FFF" />
              <Text style={styles.submitText}>Complete Inspection</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingSpinner: {
    width: 72,
    height: 72,
    borderRadius: 20,
    backgroundColor: Colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  loadingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  headerSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Scroll
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
  },

  // Progress Card
  progressCard: {
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  progressGradient: {
    padding: 20,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  progressSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  progressBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  progressPercent: {
    fontSize: 18,
    fontWeight: '800',
    color: '#FFF',
  },
  progressBarContainer: {
    marginTop: 4,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FFF',
    borderRadius: 4,
  },

  // Section
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionCount: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: '500',
  },

  // OBD Card
  obdCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    backgroundColor: Colors.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  obdGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  obdLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  obdIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  obdInfo: {
    flex: 1,
  },
  obdTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
  obdStatus: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  obdStartChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 6,
  },
  obdStartText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  obdDoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    gap: 4,
  },
  obdDoneText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#059669',
  },
  obdResults: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.surface,
  },
  obdResultItem: {
    flex: 1,
    alignItems: 'center',
  },
  obdResultValue: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  obdResultLabel: {
    fontSize: 11,
    color: Colors.textMuted,
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  obdResultDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.border,
  },
  obdViewBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  obdViewText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },

  // Error
  errorCard: {
    backgroundColor: Colors.warningLight,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  errorIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#92400E',
  },
  errorText: {
    fontSize: 13,
    color: '#B45309',
    textAlign: 'center',
    marginTop: 4,
  },
  retryBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: Colors.warning,
    borderRadius: 10,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },

  // Category Card
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryCardDisabled: {
    opacity: 0.5,
  },
  categoryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  categoryContent: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  categoryMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryProgressBar: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  categoryProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  categoryCount: {
    fontSize: 12,
    color: Colors.textMuted,
    fontWeight: '500',
    minWidth: 32,
    textAlign: 'right',
  },
  categoryArrow: {
    marginLeft: 8,
  },
  completeBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Submit
  submitBtn: {
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 24,
    shadowColor: Colors.success,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    gap: 10,
  },
  submitText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFF',
  },
});
