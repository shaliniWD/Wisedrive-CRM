// Professional Leave Screen - Light Theme
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { getLeavePeriodBalance, getLeaveHistory } from '../services/api';
import { colors, spacing, fontSize, fontWeight, radius, iconSize } from '../theme';
import { formatDateRange } from '../utils/dateFormat';

type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export default function LeaveScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | LeaveStatus>('all');

  // Use period-based balance
  const { data: periodBalance } = useQuery({
    queryKey: ['periodBalance'],
    queryFn: () => getLeavePeriodBalance(),
  });

  const { data: leaveHistory } = useQuery({
    queryKey: ['leaveHistory'],
    queryFn: () => getLeaveHistory(1, 50),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['periodBalance'] });
    await queryClient.invalidateQueries({ queryKey: ['leaveHistory'] });
    setRefreshing(false);
  };

  const leaves = leaveHistory?.items || [];
  const filteredLeaves = filter === 'all' 
    ? leaves 
    : leaves.filter((l: any) => l.status === filter);

  // Calculate if user can apply leave
  const canApplyLeave = periodBalance?.can_apply_casual || periodBalance?.can_apply_sick;

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'approved':
        return { bg: colors.successBg, color: colors.success };
      case 'pending':
        return { bg: colors.warningBg, color: colors.warning };
      case 'rejected':
      case 'cancelled':
        return { bg: colors.errorBg, color: colors.error };
      default:
        return { bg: colors.surface, color: colors.text.secondary };
    }
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
        <Text style={styles.headerTitle}>Leave</Text>
        <TouchableOpacity
          testID="apply-leave-btn"
          style={[styles.applyBtn, !canApplyLeave && styles.applyBtnDisabled]}
          onPress={() => navigation.navigate('LeaveApply')}
          disabled={!canApplyLeave}
        >
          <LinearGradient
            colors={canApplyLeave ? colors.gradients.primary : ['#9CA3AF', '#9CA3AF']}
            style={styles.applyBtnGradient}
          >
            <Ionicons name="add" size={iconSize.md} color="#FFF" />
            <Text style={styles.applyBtnText}>Apply</Text>
          </LinearGradient>
        </TouchableOpacity>
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
        {/* Period Label */}
        <View style={styles.periodHeader}>
          <Text style={styles.periodLabel}>{periodBalance?.period_label || 'This Month'}</Text>
          <Text style={styles.periodSubLabel}>
            {periodBalance?.period_type === 'quarterly' ? 'Quarterly allocation' : 'Monthly allocation'} • No carry forward
          </Text>
        </View>

        {/* Balance Cards */}
        <View style={styles.balanceRow}>
          <BalanceCard
            label="Casual"
            available={periodBalance?.casual_available || 0}
            total={periodBalance?.casual_allocated || 1}
            color={colors.success}
            canApply={periodBalance?.can_apply_casual}
          />
          <BalanceCard
            label="Sick"
            available={periodBalance?.sick_available || 0}
            total={periodBalance?.sick_allocated || 2}
            color={colors.warning}
            canApply={periodBalance?.can_apply_sick}
          />
          <BalanceCard
            label="LOP"
            available={periodBalance?.lop_days || 0}
            total={null}
            color={colors.error}
            isLOP={true}
          />
        </View>

        {/* No Leaves Warning */}
        {!canApplyLeave && (
          <View style={styles.noLeavesWarning}>
            <Ionicons name="information-circle" size={iconSize.md} color={colors.warning} />
            <Text style={styles.noLeavesText}>
              All leaves for {periodBalance?.period_label || 'this period'} have been availed
            </Text>
          </View>
        )}

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {(['all', 'pending', 'approved', 'rejected'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              testID={`filter-${f}`}
              style={[styles.filterTab, filter === f && styles.filterTabActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Leave History */}
        <View style={styles.historySection}>
          <Text style={styles.sectionLabel}>History</Text>
          {filteredLeaves.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={40} color={colors.text.tertiary} />
              <Text style={styles.emptyText}>No leave requests found</Text>
            </View>
          ) : (
            filteredLeaves.map((leave: any) => {
              const statusStyle = getStatusStyle(leave.status);
              return (
                <TouchableOpacity
                  key={leave.id}
                  testID={`leave-item-${leave.id}`}
                  style={styles.leaveCard}
                  onPress={() => navigation.navigate('LeaveDetail', { leaveId: leave.id })}
                  activeOpacity={0.7}
                >
                  <View style={styles.leaveHeader}>
                    <View style={styles.leaveTypeContainer}>
                      <Text style={styles.leaveType}>{leave.leave_type}</Text>
                      <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                        <Text style={[styles.statusText, { color: statusStyle.color }]}>
                          {leave.status}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.leaveDays}>
                      {leave.days} {leave.days === 1 ? 'day' : 'days'}
                    </Text>
                  </View>
                  <View style={styles.leaveDates}>
                    <Ionicons name="calendar-outline" size={14} color={colors.text.tertiary} />
                    <Text style={styles.leaveDateText}>
                      {format(new Date(leave.start_date), 'MMM d')} - {format(new Date(leave.end_date), 'MMM d, yyyy')}
                    </Text>
                  </View>
                  {leave.reason && (
                    <Text style={styles.leaveReason} numberOfLines={1}>
                      {leave.reason}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

// Balance Card Component
const BalanceCard = ({ 
  label, 
  available, 
  total, 
  color,
  canApply,
  isLOP = false,
}: { 
  label: string; 
  available: number; 
  total: number | null; 
  color: string;
  canApply?: boolean;
  isLOP?: boolean;
}) => (
  <View style={[styles.balanceCard, !canApply && !isLOP && styles.balanceCardDisabled]}>
    <View style={[styles.balanceIndicator, { backgroundColor: color }]} />
    <Text style={[styles.balanceValue, isLOP && { color: color }]}>{available}</Text>
    {total !== null && <Text style={styles.balanceTotal}>/ {total}</Text>}
    <Text style={styles.balanceLabel}>{label}</Text>
    {!canApply && !isLOP && available <= 0 && (
      <Text style={styles.exhaustedBadge}>Exhausted</Text>
    )}
  </View>
);

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
  applyBtn: {
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  applyBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  applyBtnText: {
    color: '#FFF',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
  },
  applyBtnDisabled: {
    opacity: 0.7,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxxl + 80,
  },
  // Period Header
  periodHeader: {
    marginBottom: spacing.lg,
  },
  periodLabel: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    textAlign: 'center',
  },
  periodSubLabel: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  // No Leaves Warning
  noLeavesWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.warningBg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  noLeavesText: {
    fontSize: fontSize.sm,
    color: colors.warning,
    fontWeight: fontWeight.medium,
  },
  // Balance Cards
  balanceRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  balanceCardDisabled: {
    opacity: 0.6,
  },
  balanceIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: spacing.sm,
  },
  balanceValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  balanceTotal: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  balanceLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.sm,
  },
  exhaustedBadge: {
    fontSize: fontSize.xs,
    color: colors.error,
    fontWeight: fontWeight.medium,
    marginTop: spacing.xs,
  },
  // Filter Tabs
  filterRow: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.md,
    padding: spacing.xs,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontWeight: fontWeight.medium,
  },
  filterTextActive: {
    color: '#FFF',
  },
  // History
  historySection: {},
  sectionLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.md,
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
  leaveCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  leaveHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  leaveTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  leaveType: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    textTransform: 'capitalize',
  },
  leaveDays: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  leaveDates: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  leaveDateText: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
  },
  leaveReason: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontStyle: 'italic',
  },
});
