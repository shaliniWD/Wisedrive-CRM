// Modern Leave Screen
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
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format, parseISO } from 'date-fns';
import { getLeaveHistory, getLeaveBalance } from '../services/api';
import { colors, spacing, fontSize, radius, iconSize } from '../theme';

const STATUS_CONFIG: Record<string, { bg: string; text: string }> = {
  pending: { bg: colors.status.warningBg, text: colors.status.warning },
  approved: { bg: colors.status.successBg, text: colors.status.success },
  rejected: { bg: colors.status.errorBg, text: colors.status.error },
  cancelled: { bg: colors.background.tertiary, text: colors.text.tertiary },
};

export default function LeaveScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data: leaveHistory, refetch: refetchHistory } = useQuery({
    queryKey: ['leaveHistory'],
    queryFn: () => getLeaveHistory(),
  });

  const { data: leaveBalance, refetch: refetchBalance } = useQuery({
    queryKey: ['leaveBalance'],
    queryFn: () => getLeaveBalance(),
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchHistory(), refetchBalance()]);
    setRefreshing(false);
  };

  const leaves = leaveHistory?.requests || [];

  const renderLeaveItem = ({ item }: { item: any }) => {
    const status = STATUS_CONFIG[item.status] || STATUS_CONFIG.pending;
    const startDate = parseISO(item.start_date);
    const endDate = parseISO(item.end_date);

    return (
      <TouchableOpacity
        style={styles.leaveCard}
        onPress={() => navigation.navigate('LeaveDetail', { leaveId: item.id })}
      >
        <View style={styles.leaveLeft}>
          <Text style={styles.leaveType}>
            {item.leave_type?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())}
          </Text>
          <Text style={styles.leaveDates}>
            {format(startDate, 'MMM d')} - {format(endDate, 'MMM d')}
          </Text>
          <Text style={styles.leaveDays}>{item.days_count} day(s)</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.text }]}>{item.status}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Leave</Text>
        <TouchableOpacity 
          style={styles.applyBtn}
          onPress={() => navigation.navigate('LeaveApply')}
        >
          <Ionicons name="add" size={iconSize.md} color={colors.text.inverse} />
          <Text style={styles.applyBtnText}>Apply</Text>
        </TouchableOpacity>
      </View>

      {/* Balance Cards */}
      <View style={styles.balanceSection}>
        <View style={styles.balanceRow}>
          <BalanceCard label="Casual" value={leaveBalance?.casual_leaves?.available || 0} total={leaveBalance?.casual_leaves?.total || 12} color={colors.status.warning} />
          <BalanceCard label="Sick" value={leaveBalance?.sick_leaves?.available || 0} total={leaveBalance?.sick_leaves?.total || 12} color={colors.status.error} />
          <BalanceCard label="Earned" value={leaveBalance?.earned_leaves?.available || 0} total={leaveBalance?.earned_leaves?.total || 15} color={colors.primary.default} />
        </View>
      </View>

      {/* Leave History */}
      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>History</Text>
        <FlatList
          data={leaves}
          keyExtractor={(item) => item.id}
          renderItem={renderLeaveItem}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.default} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={40} color={colors.text.tertiary} />
              <Text style={styles.emptyText}>No leave requests yet</Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

const BalanceCard = ({ label, value, total, color }: { label: string; value: number; total: number; color: string }) => (
  <View style={styles.balanceCard}>
    <View style={[styles.balanceDot, { backgroundColor: color }]} />
    <Text style={styles.balanceLabel}>{label}</Text>
    <Text style={styles.balanceValue}>{value}<Text style={styles.balanceTotal}>/{total}</Text></Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
  },
  headerTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text.primary,
  },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary.default,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  applyBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  balanceSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
  },
  balanceRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: colors.background.tertiary,
    padding: spacing.md,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  balanceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: spacing.xs,
  },
  balanceLabel: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
  balanceValue: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: colors.text.primary,
    marginTop: 2,
  },
  balanceTotal: {
    fontSize: fontSize.sm,
    fontWeight: '400',
    color: colors.text.tertiary,
  },
  historySection: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listContent: {
    paddingBottom: spacing.xxl,
  },
  leaveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  leaveLeft: {},
  leaveType: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text.primary,
  },
  leaveDates: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  leaveDays: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  statusText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  emptyText: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.md,
  },
});
