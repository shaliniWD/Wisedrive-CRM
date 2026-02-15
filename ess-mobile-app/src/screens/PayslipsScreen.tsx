// Modern Payslips Screen
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { format, parseISO } from 'date-fns';
import { getPayslips, getPayslipYears } from '../services/api';
import { colors, spacing, borderRadius, shadows } from '../theme';

export default function PayslipsScreen() {
  const navigation = useNavigation<any>();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [refreshing, setRefreshing] = useState(false);

  const { data: payslipsData, refetch } = useQuery({
    queryKey: ['payslips', selectedYear],
    queryFn: () => getPayslips(selectedYear),
  });

  const { data: yearsData } = useQuery({
    queryKey: ['payslipYears'],
    queryFn: getPayslipYears,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const payslips = payslipsData?.payslips || [];
  const years = yearsData?.years || [currentYear];

  const formatCurrency = (amount: number, symbol: string = '₹') => {
    return `${symbol}${amount?.toLocaleString('en-IN') || 0}`;
  };

  const getMonthName = (month: number) => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month - 1] || 'Unknown';
  };

  const renderPayslip = ({ item }: { item: any }) => {
    const monthName = getMonthName(item.month);
    const isPaid = item.status === 'paid';

    return (
      <TouchableOpacity
        style={styles.payslipCard}
        onPress={() => navigation.navigate('PayslipDetail', { payslipId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.payslipLeft}>
          <View style={styles.monthContainer}>
            <Text style={styles.monthText}>{monthName}</Text>
            <Text style={styles.yearText}>{item.year}</Text>
          </View>
        </View>

        <View style={styles.payslipCenter}>
          <Text style={styles.netSalary}>
            {formatCurrency(item.net_salary, item.currency_symbol)}
          </Text>
          <View style={styles.salaryDetails}>
            <Text style={styles.salaryDetailText}>
              Gross: {formatCurrency(item.gross_salary, item.currency_symbol)}
            </Text>
            <Text style={styles.salaryDetailDivider}>•</Text>
            <Text style={styles.salaryDetailText}>
              Deductions: {formatCurrency(item.total_deductions, item.currency_symbol)}
            </Text>
          </View>
        </View>

        <View style={styles.payslipRight}>
          <View style={[styles.statusBadge, isPaid ? styles.statusPaid : styles.statusPending]}>
            <Text style={[styles.statusText, isPaid ? styles.statusTextPaid : styles.statusTextPending]}>
              {item.status || 'Paid'}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={[colors.primary.default, colors.secondary.default]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <Text style={styles.headerTitle}>Payslips</Text>
        <Text style={styles.headerSubtitle}>View and download your salary slips</Text>
      </LinearGradient>

      {/* Year Selector */}
      <View style={styles.yearSelectorContainer}>
        <View style={styles.yearSelector}>
          <TouchableOpacity
            style={styles.yearButton}
            onPress={() => setSelectedYear(Math.max(selectedYear - 1, Math.min(...years)))}
          >
            <Ionicons name="chevron-back" size={24} color={colors.primary.default} />
          </TouchableOpacity>

          <View style={styles.yearDisplay}>
            <Ionicons name="calendar" size={18} color={colors.primary.default} />
            <Text style={styles.yearDisplayText}>{selectedYear}</Text>
          </View>

          <TouchableOpacity
            style={styles.yearButton}
            onPress={() => setSelectedYear(Math.min(selectedYear + 1, Math.max(...years)))}
          >
            <Ionicons name="chevron-forward" size={24} color={colors.primary.default} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Payslips List */}
      <FlatList
        data={payslips}
        keyExtractor={(item) => item.id}
        renderItem={renderPayslip}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.default} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="wallet-outline" size={48} color={colors.text.muted} />
            </View>
            <Text style={styles.emptyText}>No payslips for {selectedYear}</Text>
            <Text style={styles.emptySubtext}>
              Payslips will appear here once processed
            </Text>
          </View>
        }
        ListHeaderComponent={
          payslips.length > 0 ? (
            <View style={styles.listHeader}>
              <Text style={styles.listHeaderText}>{payslips.length} payslip(s) found</Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: spacing.xxl,
    paddingHorizontal: spacing.lg,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  yearSelectorContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: -spacing.lg,
  },
  yearSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.sm,
    ...shadows.md,
  },
  yearButton: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background.subtle,
    justifyContent: 'center',
    alignItems: 'center',
  },
  yearDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  yearDisplayText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  listContent: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  listHeader: {
    marginBottom: spacing.md,
  },
  listHeaderText: {
    fontSize: 14,
    color: colors.text.muted,
  },
  payslipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  payslipLeft: {
    marginRight: spacing.md,
  },
  monthContainer: {
    width: 56,
    height: 56,
    backgroundColor: colors.primary.light,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary.default,
  },
  yearText: {
    fontSize: 11,
    color: colors.primary.default,
    opacity: 0.7,
  },
  payslipCenter: {
    flex: 1,
  },
  netSalary: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text.primary,
  },
  salaryDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  salaryDetailText: {
    fontSize: 12,
    color: colors.text.muted,
  },
  salaryDetailDivider: {
    marginHorizontal: spacing.sm,
    color: colors.text.muted,
  },
  payslipRight: {
    alignItems: 'flex-end',
    gap: spacing.sm,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  statusPaid: {
    backgroundColor: colors.status.successLight,
  },
  statusPending: {
    backgroundColor: colors.status.warningLight,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statusTextPaid: {
    color: colors.status.success,
  },
  statusTextPending: {
    color: colors.status.warning,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl * 2,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.background.subtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.secondary,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.muted,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});
