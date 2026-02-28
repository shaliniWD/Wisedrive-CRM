// Professional Payslips Screen - Light Theme
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { getPayslips, getPayslipYears, getSalarySummary } from '../services/api';
import { colors, spacing, fontSize, fontWeight, radius, iconSize, shadows } from '../theme';
import { formatDateShort } from '../utils/dateFormat';

export default function PayslipsScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);

  const { data: payslips, isLoading } = useQuery({
    queryKey: ['payslips', selectedYear],
    queryFn: () => getPayslips(1, 12, selectedYear),
  });

  const { data: years } = useQuery({
    queryKey: ['payslipYears'],
    queryFn: getPayslipYears,
  });

  const { data: salary } = useQuery({
    queryKey: ['salary'],
    queryFn: getSalarySummary,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['payslips'] });
    setRefreshing(false);
  };

  const availableYears = years?.years || [currentYear, currentYear - 1];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="back-btn"
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={iconSize.lg} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Payslips</Text>
        <View style={styles.yearSelector}>
          {availableYears.slice(0, 3).map((year: number) => (
            <TouchableOpacity
              key={year}
              testID={`year-${year}`}
              style={[styles.yearBtn, selectedYear === year && styles.yearBtnActive]}
              onPress={() => setSelectedYear(year)}
            >
              <Text style={[styles.yearText, selectedYear === year && styles.yearTextActive]}>
                {year}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Salary Summary Card */}
        {salary && (
          <View style={styles.salaryCard}>
            <LinearGradient
              colors={colors.gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.salaryGradient}
            >
              <View style={styles.salaryHeader}>
                <Ionicons name="wallet" size={24} color="rgba(255,255,255,0.5)" />
                <Text style={styles.salaryLabel}>Monthly Salary</Text>
              </View>
              <Text style={styles.salaryAmount}>
                {formatCurrency(salary.gross_salary || salary.net_salary || 0)}
              </Text>
              {salary.net_salary && salary.gross_salary && (
                <Text style={styles.salaryNet}>
                  Net: {formatCurrency(salary.net_salary)}
                </Text>
              )}
            </LinearGradient>
          </View>
        )}

        {/* Payslips List */}
        <View style={styles.listSection}>
          <Text style={styles.sectionLabel}>Payslip History</Text>
          
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : payslips?.items?.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={40} color={colors.text.tertiary} />
              <Text style={styles.emptyText}>No payslips found for {selectedYear}</Text>
            </View>
          ) : (
            payslips?.items?.map((payslip: any) => (
              <TouchableOpacity
                key={payslip.id}
                testID={`payslip-${payslip.id}`}
                style={styles.payslipCard}
                onPress={() => navigation.navigate('PayslipDetail', { payslipId: payslip.id })}
                activeOpacity={0.7}
              >
                <View style={styles.payslipIcon}>
                  <Ionicons name="document-text" size={iconSize.lg} color={colors.primary} />
                </View>
                <View style={styles.payslipInfo}>
                  <Text style={styles.payslipMonth}>
                    {format(new Date(payslip.year, payslip.month - 1), 'MMMM yyyy')}
                  </Text>
                  <Text style={styles.payslipDate}>
                    Generated: {payslip.generated_date ? formatDateShort(payslip.generated_date) : 'N/A'}
                  </Text>
                </View>
                <View style={styles.payslipAmount}>
                  <Text style={styles.payslipAmountText}>
                    {formatCurrency(payslip.net_salary || 0)}
                  </Text>
                  <Ionicons name="chevron-forward" size={iconSize.md} color={colors.text.tertiary} />
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  yearSelector: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  yearBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  yearBtnActive: {
    backgroundColor: colors.primary,
  },
  yearText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
  },
  yearTextActive: {
    color: '#FFF',
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxxl + 80,
  },
  // Salary Card
  salaryCard: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.xxl,
    ...shadows.lg,
  },
  salaryGradient: {
    padding: spacing.xl,
  },
  salaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  salaryLabel: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  salaryAmount: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: '#FFF',
  },
  salaryNet: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginTop: spacing.xs,
  },
  // List Section
  listSection: {},
  sectionLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  loadingContainer: {
    paddingVertical: spacing.xxxxl,
    alignItems: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxxxl,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.md,
  },
  payslipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  payslipIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  payslipInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  payslipMonth: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  payslipDate: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  payslipAmount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  payslipAmountText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.success,
  },
});
