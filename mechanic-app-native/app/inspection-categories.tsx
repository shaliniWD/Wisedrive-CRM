import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useInspection } from '../src/context/InspectionContext';
import { inspectionsApi } from '../src/lib/api';

interface Category {
  id: string;
  name: string;
  icon: string;
  questionsCount: number;
  completedCount: number;
  isCompleted: boolean;
}

// Icon mapping for category names
const CATEGORY_ICONS: { [key: string]: string } = {
  'exterior': 'car-outline',
  'interior': 'car-seat',
  'engine': 'engine',
  'engine bay': 'engine',
  'underbody': 'car-lifted-pickup',
  'electrical': 'lightning-bolt',
  'tyres': 'tire',
  'tyres & wheels': 'tire',
  'wheels': 'tire',
  'default': 'clipboard-check-outline',
};

const getIconForCategory = (categoryName: string): string => {
  const normalizedName = categoryName.toLowerCase();
  for (const [key, icon] of Object.entries(CATEGORY_ICONS)) {
    if (normalizedName.includes(key)) {
      return icon;
    }
  }
  return CATEGORY_ICONS.default;
};

export default function InspectionCategoriesScreen() {
  const { currentInspectionId, currentInspection, clearInspection, obdScanResult } = useInspection();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  // Derive OBD completion status from global context
  const obdCompleted = obdScanResult?.completed || false;
  const obdResults = obdScanResult;

  useEffect(() => {
    fetchQuestionnaire();
  }, [currentInspectionId]);

  const fetchQuestionnaire = async () => {
    if (!currentInspectionId) {
      setLoadError('No inspection selected');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setLoadError(null);
      
      console.log('Fetching questionnaire for inspection:', currentInspectionId);
      const data = await inspectionsApi.getQuestionnaire(currentInspectionId);
      console.log('Questionnaire data:', JSON.stringify(data, null, 2));
      
      if (data && data.questions && Array.isArray(data.questions)) {
        // Group questions by category
        const categoryMap = new Map<string, { questions: any[], categoryId: string }>();
        
        data.questions.forEach((question: any) => {
          const categoryName = question.category_name || question.category || 'General';
          const categoryId = question.category_id || categoryName.toLowerCase().replace(/\s+/g, '-');
          
          if (!categoryMap.has(categoryName)) {
            categoryMap.set(categoryName, { questions: [], categoryId });
          }
          categoryMap.get(categoryName)!.questions.push(question);
        });
        
        // Convert to category array
        const dynamicCategories: Category[] = [];
        categoryMap.forEach((value, key) => {
          dynamicCategories.push({
            id: value.categoryId,
            name: key,
            icon: getIconForCategory(key),
            questionsCount: value.questions.length,
            completedCount: 0,
            isCompleted: false,
          });
        });
        
        // Sort categories by question count (most questions first) or alphabetically
        dynamicCategories.sort((a, b) => b.questionsCount - a.questionsCount);
        
        setCategories(dynamicCategories);
        console.log('Loaded', dynamicCategories.length, 'categories from questionnaire');
      } else {
        console.warn('No questions in questionnaire response, using fallback');
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
    if (!obdCompleted) {
      Alert.alert(
        'OBD Scan Required',
        'Please complete the OBD scan first before proceeding with other inspections.',
        [{ text: 'OK', style: 'default' }]
      );
      return;
    }
    router.push(`/checklist/${category.id}`);
  };

  const handleSubmitInspection = async () => {
    if (!allCategoriesCompleted || !obdCompleted) {
      Alert.alert('Incomplete', 'Please complete all categories and OBD scan before submitting.');
      return;
    }

    try {
      // Submit inspection results
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

  const getIconComponent = (iconName: string) => {
    const iconProps = { size: 24, color: '#3B82F6' };
    switch (iconName) {
      case 'car-outline':
        return <Ionicons name="car-outline" {...iconProps} />;
      case 'car-seat':
        return <MaterialCommunityIcons name="car-seat" {...iconProps} />;
      case 'engine':
        return <MaterialCommunityIcons name="engine" {...iconProps} />;
      case 'car-lifted-pickup':
        return <MaterialCommunityIcons name="car-lifted-pickup" {...iconProps} />;
      case 'lightning-bolt':
        return <MaterialCommunityIcons name="lightning-bolt" {...iconProps} />;
      case 'tire':
        return <MaterialCommunityIcons name="tire" {...iconProps} />;
      case 'clipboard-check-outline':
        return <MaterialCommunityIcons name="clipboard-check-outline" {...iconProps} />;
      default:
        return <Ionicons name="help-circle-outline" {...iconProps} />;
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading inspection questionnaire...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1E293B" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Inspection</Text>
          <Text style={styles.headerSubtitle}>{currentInspection?.vehicleNumber || 'N/A'}</Text>
        </View>
        <TouchableOpacity onPress={fetchQuestionnaire} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={22} color="#64748B" />
        </TouchableOpacity>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <Text style={styles.progressLabel}>Overall Progress</Text>
          <Text style={styles.progressPercent}>{Math.round(progress)}%</Text>
        </View>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* OBD Scan Card - Always at top */}
        <View style={styles.obdCard}>
          <LinearGradient
            colors={obdCompleted ? ['#10B981', '#059669'] : ['#3B82F6', '#2563EB']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.obdGradient}
          >
            <View style={styles.obdContent}>
              <View style={styles.obdIconContainer}>
                <MaterialCommunityIcons 
                  name={obdCompleted ? 'check-circle' : 'car-cog'} 
                  size={32} 
                  color="#FFF" 
                />
              </View>
              <View style={styles.obdInfo}>
                <Text style={styles.obdTitle}>OBD-II Diagnostics</Text>
                <Text style={styles.obdSubtitle}>
                  {obdCompleted ? 'Scan completed' : 'Scan required before inspection'}
                </Text>
              </View>
            </View>

            {!obdCompleted ? (
              <TouchableOpacity style={styles.obdButton} onPress={handleOBDScan}>
                <MaterialIcons name="bluetooth-searching" size={20} color="#3B82F6" />
                <Text style={styles.obdButtonText}>Start Scan</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.obdCompleteBadge}>
                <Ionicons name="checkmark" size={16} color="#FFF" />
                <Text style={styles.obdCompleteBadgeText}>Done</Text>
              </View>
            )}
          </LinearGradient>

          {obdCompleted && obdResults && (
            <View style={styles.obdResultsPreview}>
              <View style={styles.obdResultItem}>
                <Text style={styles.obdResultValue}>{obdResults.dtcCount || 0}</Text>
                <Text style={styles.obdResultLabel}>DTCs Found</Text>
              </View>
              <View style={styles.obdResultDivider} />
              <View style={styles.obdResultItem}>
                <Text style={styles.obdResultValue}>{obdResults.liveDataCount || 0}</Text>
                <Text style={styles.obdResultLabel}>Live Data</Text>
              </View>
              <View style={styles.obdResultDivider} />
              <TouchableOpacity style={styles.viewResultsBtn} onPress={() => router.push('/scanner')}>
                <Text style={styles.viewResultsBtnText}>View Details</Text>
                <Ionicons name="chevron-forward" size={16} color="#3B82F6" />
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Categories Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Inspection Categories</Text>
          {categories.length > 0 && (
            <Text style={styles.sectionCount}>{totalQuestions} questions</Text>
          )}
        </View>

        {/* Error State */}
        {loadError && categories.length === 0 && (
          <View style={styles.errorCard}>
            <Ionicons name="warning-outline" size={32} color="#F59E0B" />
            <Text style={styles.errorTitle}>No Questionnaire Found</Text>
            <Text style={styles.errorText}>{loadError}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchQuestionnaire}>
              <Text style={styles.retryBtnText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Category Cards */}
        {categories.map((category) => (
          <TouchableOpacity
            key={category.id}
            style={[styles.categoryCard, !obdCompleted && styles.categoryCardDisabled]}
            onPress={() => handleCategoryPress(category)}
            activeOpacity={0.7}
          >
            <View style={styles.categoryIconContainer}>
              {getIconComponent(category.icon)}
            </View>
            <View style={styles.categoryInfo}>
              <Text style={styles.categoryName}>{category.name}</Text>
              <Text style={styles.categoryProgress}>
                {category.completedCount}/{category.questionsCount} questions
              </Text>
            </View>
            <View style={styles.categoryRight}>
              {category.isCompleted ? (
                <View style={styles.categoryCompleteBadge}>
                  <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={22} color="#94A3B8" />
              )}
            </View>
          </TouchableOpacity>
        ))}

        {/* Submit Button */}
        {categories.length > 0 && (
          <TouchableOpacity
            style={[
              styles.submitBtn,
              (!allCategoriesCompleted || !obdCompleted) && styles.submitBtnDisabled
            ]}
            onPress={handleSubmitInspection}
            disabled={!allCategoriesCompleted || !obdCompleted}
          >
            <MaterialIcons name="send" size={20} color="#FFF" />
            <Text style={styles.submitBtnText}>Submit Inspection</Text>
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
    backgroundColor: '#F1F5F9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#64748B',
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },

  // Progress
  progressContainer: {
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  progressPercent: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3B82F6',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 4,
  },

  // Content
  content: {
    flex: 1,
    padding: 16,
  },

  // OBD Card
  obdCard: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  obdGradient: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  obdContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  obdIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  obdInfo: {
    flex: 1,
  },
  obdTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  obdSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  obdButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  obdButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#3B82F6',
  },
  obdCompleteBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    gap: 4,
  },
  obdCompleteBadgeText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  obdResultsPreview: {
    backgroundColor: '#FFF',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  obdResultItem: {
    alignItems: 'center',
    flex: 1,
  },
  obdResultValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
  },
  obdResultLabel: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  obdResultDivider: {
    width: 1,
    height: 30,
    backgroundColor: '#E2E8F0',
  },
  viewResultsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  viewResultsBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },

  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
  },
  sectionCount: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '500',
  },

  // Error Card
  errorCard: {
    backgroundColor: '#FFFBEB',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FCD34D',
  },
  errorTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#92400E',
    marginTop: 12,
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
    paddingHorizontal: 20,
    backgroundColor: '#F59E0B',
    borderRadius: 8,
  },
  retryBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },

  // Category Card
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  categoryCardDisabled: {
    opacity: 0.6,
  },
  categoryIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  categoryProgress: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  categoryRight: {
    marginLeft: 8,
  },
  categoryCompleteBadge: {
    padding: 2,
  },

  // Submit Button
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#10B981',
    paddingVertical: 18,
    borderRadius: 14,
    marginTop: 20,
    gap: 8,
  },
  submitBtnDisabled: {
    backgroundColor: '#94A3B8',
  },
  submitBtnText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFF',
  },
});
