// Premium Leave Screen - Dark Theme
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
import { getLeaveBalance, getLeaveHistory } from '../services/api';
import { colors, spacing, fontSize, fontWeight, radius, iconSize } from '../theme';

type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export default function LeaveScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | LeaveStatus>('all');

  const { data: leaveBalance } = useQuery({
    queryKey: ['leaveBalance'],
    queryFn: () => getLeaveBalance(),
  });

  const { data: leaveHistory } = useQuery({
    queryKey: ['leaveHistory'],
    queryFn: () => getLeaveHistory(1, 50),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['leaveBalance'] });
    await queryClient.invalidateQueries({ queryKey: ['leaveHistory'] });
    setRefreshing(false);
  };

  const leaves = leaveHistory?.items || [];
  const filteredLeaves = filter === 'all' 
    ? leaves 
    : leaves.filter((l: any) => l.status === filter);

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
        <Text style={styles.headerTitle}>Leave</Text>
        <TouchableOpacity
          testID="apply-leave-btn"
          style={styles.applyBtn}
          onPress={() => navigation.navigate('LeaveApply')}
        >
          <LinearGradient
            colors={colors.gradients.primary}
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
        {/* Balance Cards */}
        <View style={styles.balanceRow}>
          <BalanceCard
            label="Casual"
            available={leaveBalance?.casual_leaves?.available || 0}
            total={leaveBalance?.casual_leaves?.total || 12}
            color={colors.success}
          />
          <BalanceCard
            label="Sick"
            available={leaveBalance?.sick_leaves?.available || 0}
            total={leaveBalance?.sick_leaves?.total || 12}
            color={colors.warning}
          />
          <BalanceCard
            label="Earned"
            available={leaveBalance?.earned_leaves?.available || 0}
            total={leaveBalance?.earned_leaves?.total || 15}
            color={colors.accent}
          />
        </View>

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
  color 
}: { 
  label: string; 
  available: number; 
  total: number; 
  color: string;
}) => (
  <View style={styles.balanceCard}>
    <View style={[styles.balanceIndicator, { backgroundColor: color }]} />
    <Text style={styles.balanceValue}>{available}</Text>
    <Text style={styles.balanceTotal}>/ {total}</Text>
    <Text style={styles.balanceLabel}>{label}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
  },
  headerTitle: {
    fontSize: fontSize.xl,
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
  scrollContent: {
    padding: spacing.xl,
    paddingTop: 0,
    paddingBottom: spacing.xxxxl,
  },
  // Balance Cards
  balanceRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xxl,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
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
  // Filter Tabs
  filterRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xs,
    marginBottom: spacing.xl,
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
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
    backgroundColor: colors.surface,
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
