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

const MOCK_CATEGORIES: Category[] = [
  { id: 'exterior', name: 'Exterior', icon: 'car-outline', questionsCount: 15, completedCount: 0, isCompleted: false },
  { id: 'interior', name: 'Interior', icon: 'car-seat', questionsCount: 12, completedCount: 0, isCompleted: false },
  { id: 'engine', name: 'Engine Bay', icon: 'engine', questionsCount: 10, completedCount: 0, isCompleted: false },
  { id: 'underbody', name: 'Underbody', icon: 'car-lifted-pickup', questionsCount: 8, completedCount: 0, isCompleted: false },
  { id: 'electrical', name: 'Electrical', icon: 'lightning-bolt', questionsCount: 10, completedCount: 0, isCompleted: false },
  { id: 'tyres', name: 'Tyres & Wheels', icon: 'tire', questionsCount: 8, completedCount: 0, isCompleted: false },
];

export default function InspectionCategoriesScreen() {
  const { currentInspectionId, currentInspection, clearInspection, obdScanResult } = useInspection();
  const [categories, setCategories] = useState<Category[]>(MOCK_CATEGORIES);
  const [isLoading, setIsLoading] = useState(false);
  
  // Derive OBD completion status from global context
  const obdCompleted = obdScanResult?.completed || false;
  const obdResults = obdScanResult;

  const totalQuestions = categories.reduce((acc, cat) => acc + cat.questionsCount, 0);
  const completedQuestions = categories.reduce((acc, cat) => acc + cat.completedCount, 0);
  const allCategoriesCompleted = categories.every(cat => cat.isCompleted);
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
    router.push(`/category/${currentInspectionId}/${category.id}`);
  };

  const handleSubmitInspection = async () => {
    if (!allCategoriesCompleted || !obdCompleted) {
      Alert.alert('Incomplete', 'Please complete all categories and OBD scan before submitting.');
      return;
    }

    setIsLoading(true);
    try {
      // Submit inspection results
      Alert.alert('Success', 'Inspection submitted successfully!', [
        { text: 'OK', onPress: () => {
          clearInspection();
          router.replace('/home');
        }}
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to submit inspection. Please try again.');
    } finally {
      setIsLoading(false);
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
      default:
        return <Ionicons name="help-circle-outline" {...iconProps} />;
    }
  };

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
        <View style={{ width: 40 }} />
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
        <Text style={styles.sectionTitle}>Inspection Categories</Text>

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
        <TouchableOpacity
          style={[
            styles.submitBtn,
            (!allCategoriesCompleted || !obdCompleted) && styles.submitBtnDisabled
          ]}
          onPress={handleSubmitInspection}
          disabled={!allCategoriesCompleted || !obdCompleted || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <MaterialIcons name="send" size={20} color="#FFF" />
              <Text style={styles.submitBtnText}>Submit Inspection</Text>
            </>
          )}
        </TouchableOpacity>

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

  // Section Title
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
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
