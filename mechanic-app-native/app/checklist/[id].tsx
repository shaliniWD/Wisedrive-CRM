import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { inspectionsApi } from '../../src/lib/api';

interface Category {
  id: string;
  name: string;
  description?: string;
  totalItems: number;
  questions?: any[];
}

const CATEGORY_ICONS: Record<string, string> = {
  engine: 'settings',
  transmission: 'speedometer',
  battery: 'battery-charging',
  suspension: 'disc',
  tires: 'construct',
  exterior: 'car',
  interior: 'car-sport',
  default: 'clipboard',
};

const CATEGORY_COLORS: Record<string, string> = {
  engine: '#F97316',
  transmission: '#3B82F6',
  battery: '#10B981',
  suspension: '#8B5CF6',
  tires: '#EF4444',
  exterior: '#06B6D4',
  interior: '#EC4899',
  default: '#64748B',
};

export default function ChecklistScreen() {
  const { id: inspectionId, categoryId, categoryName } = useLocalSearchParams<{ id: string; categoryId?: string; categoryName?: string }>();
  const [inspection, setInspection] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryProgress, setCategoryProgress] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCompleting, setIsCompleting] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryId || null);

  useEffect(() => {
    fetchData();
  }, [inspectionId]);

  const fetchData = async () => {
    try {
      // Fetch inspection details
      const inspData = await inspectionsApi.getInspection(inspectionId!);
      setInspection(inspData);

      // Fetch questionnaire
      try {
        const questionnaireData = await inspectionsApi.getQuestionnaire(inspectionId!);
        
        // Group questions by category
        const categoryMap: Record<string, Category> = {};
        const questions = questionnaireData.questions || [];

        questions.forEach((q: any) => {
          const catId = q.category_id || 'general';
          const catName = q.category_name || 'General';

          if (!categoryMap[catId]) {
            categoryMap[catId] = {
              id: catId,
              name: catName,
              description: `Questions for ${catName}`,
              totalItems: 0,
              questions: [],
            };
          }
          categoryMap[catId].totalItems++;
          categoryMap[catId].questions?.push(q);
        });

        const categoriesArray = Object.values(categoryMap);

        if (categoriesArray.length === 0) {
          // Default categories if none from backend
          setCategories([
            { id: 'engine', name: 'Engine Health', description: 'Engine diagnostics', totalItems: 7 },
            { id: 'transmission', name: 'Transmission', description: 'Gearbox & clutch', totalItems: 4 },
            { id: 'battery', name: 'Battery Health', description: 'Electrical system', totalItems: 3 },
            { id: 'suspension', name: 'Suspension & Brakes', description: 'Safety inspection', totalItems: 4 },
            { id: 'tires', name: 'Tires & Tools', description: 'Tire condition', totalItems: 5 },
          ]);
        } else {
          setCategories(categoriesArray);
        }

        // Initialize progress
        const progress: Record<string, number> = {};
        categoriesArray.forEach((cat) => {
          progress[cat.id] = 0;
        });
        setCategoryProgress(progress);
      } catch (err) {
        // Fallback categories
        setCategories([
          { id: 'engine', name: 'Engine Health', description: 'Engine diagnostics', totalItems: 7 },
          { id: 'transmission', name: 'Transmission', description: 'Gearbox & clutch', totalItems: 4 },
          { id: 'battery', name: 'Battery Health', description: 'Electrical system', totalItems: 3 },
          { id: 'suspension', name: 'Suspension & Brakes', description: 'Safety inspection', totalItems: 4 },
          { id: 'tires', name: 'Tires & Tools', description: 'Tire condition', totalItems: 5 },
        ]);
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to load inspection data');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleCategoryPress = (categoryId: string) => {
    router.push(`/category/${inspectionId}/${categoryId}`);
  };

  const handleOBDScan = () => {
    router.push(`/obd-scan/${inspectionId}`);
  };

  const handleCompleteInspection = async () => {
    setIsCompleting(true);
    try {
      await inspectionsApi.completeInspection(inspectionId!);
      Alert.alert('Success', 'Inspection completed successfully!', [
        { text: 'OK', onPress: () => router.replace('/home') },
      ]);
    } catch (err) {
      Alert.alert('Error', 'Failed to complete inspection');
    } finally {
      setIsCompleting(false);
    }
  };

  const totalItems = categories.reduce((sum, cat) => sum + cat.totalItems, 0);
  const completedItems = categories.reduce((sum, cat) => sum + (categoryProgress[cat.id] || 0), 0);
  const overallProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Inspection Checklist</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Progress Section */}
      <View style={styles.progressSection}>
        <View style={styles.progressCircle}>
          <Text style={styles.progressText}>{overallProgress}%</Text>
        </View>
        <View style={styles.progressInfo}>
          <Text style={styles.progressLabel}>Overall Progress</Text>
          <Text style={styles.progressDetail}>
            {completedItems} of {totalItems} items checked
          </Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${overallProgress}%` }]} />
          </View>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* OBD Scan Card */}
        <TouchableOpacity style={styles.obdCard} onPress={handleOBDScan}>
          <View style={styles.obdIcon}>
            <Ionicons name="bluetooth" size={28} color="#3B82F6" />
          </View>
          <View style={styles.obdInfo}>
            <Text style={styles.obdTitle}>OBD Scanner</Text>
            <Text style={styles.obdSubtitle}>Connect & scan vehicle diagnostics</Text>
          </View>
          <Ionicons name="chevron-forward" size={24} color="#94A3B8" />
        </TouchableOpacity>

        {/* Categories */}
        <Text style={styles.sectionTitle}>Inspection Categories</Text>

        {categories.map((category) => {
          const completed = categoryProgress[category.id] || 0;
          const isComplete = completed === category.totalItems;
          const progressPercent = category.totalItems > 0 ? (completed / category.totalItems) * 100 : 0;
          const iconName = CATEGORY_ICONS[category.id.toLowerCase()] || CATEGORY_ICONS.default;
          const color = CATEGORY_COLORS[category.id.toLowerCase()] || CATEGORY_COLORS.default;

          return (
            <TouchableOpacity
              key={category.id}
              style={styles.categoryCard}
              onPress={() => handleCategoryPress(category.id)}
            >
              <View style={[styles.categoryIcon, { backgroundColor: `${color}20` }]}>
                <Ionicons name={iconName as any} size={24} color={color} />
              </View>
              <View style={styles.categoryInfo}>
                <View style={styles.categoryHeader}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                  <Text style={[styles.categoryProgress, isComplete && styles.categoryComplete]}>
                    {completed}/{category.totalItems}
                  </Text>
                </View>
                {category.description && (
                  <Text style={styles.categoryDescription}>{category.description}</Text>
                )}
                <View style={styles.categoryProgressBar}>
                  <View
                    style={[
                      styles.categoryProgressFill,
                      { width: `${progressPercent}%`, backgroundColor: isComplete ? '#10B981' : color },
                    ]}
                  />
                </View>
              </View>
              {isComplete ? (
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
              ) : (
                <Ionicons name="chevron-forward" size={24} color="#94A3B8" />
              )}
            </TouchableOpacity>
          );
        })}

        {/* Complete Button */}
        <TouchableOpacity
          style={[styles.completeButton, overallProgress < 100 && styles.completeButtonDisabled]}
          onPress={handleCompleteInspection}
          disabled={isCompleting || overallProgress < 100}
        >
          {isCompleting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-done" size={24} color="#FFF" />
              <Text style={styles.completeButtonText}>Complete Inspection</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E3A5F',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFF',
  },
  progressSection: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 16,
  },
  progressCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 4,
    borderColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  progressInfo: {
    flex: 1,
  },
  progressLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  progressDetail: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    marginBottom: 8,
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 3,
  },
  content: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  obdCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 2,
    borderColor: '#3B82F6',
  },
  obdIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  obdInfo: {
    flex: 1,
    marginLeft: 12,
  },
  obdTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  obdSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  categoryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryInfo: {
    flex: 1,
    marginLeft: 12,
  },
  categoryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1E293B',
  },
  categoryProgress: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
  },
  categoryComplete: {
    color: '#10B981',
  },
  categoryDescription: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  categoryProgressBar: {
    height: 4,
    backgroundColor: '#E2E8F0',
    borderRadius: 2,
    marginTop: 8,
    overflow: 'hidden',
  },
  categoryProgressFill: {
    height: '100%',
    borderRadius: 2,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#10B981',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 8,
    marginBottom: 32,
  },
  completeButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  completeButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
