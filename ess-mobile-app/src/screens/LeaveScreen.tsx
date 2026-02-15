// Modern Leave Screen - Leave management
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
import { getLeaveHistory, getLeaveBalance } from '../services/api';
import { colors, spacing, borderRadius, shadows } from '../theme';

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: string }> = {
  pending: { bg: '#FEF3C7', text: '#D97706', icon: 'time' },
  approved: { bg: '#D1FAE5', text: '#059669', icon: 'checkmark-circle' },
  rejected: { bg: '#FEE2E2', text: '#DC2626', icon: 'close-circle' },
  cancelled: { bg: '#F3F4F6', text: '#6B7280', icon: 'ban' },
};

const LEAVE_TYPE_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  casual: { icon: 'sunny', color: '#F59E0B' },
  sick: { icon: 'medkit', color: '#EF4444' },
  earned: { icon: 'star', color: '#8B5CF6' },
  unpaid: { icon: 'remove-circle', color: '#6B7280' },
};

export default function LeaveScreen() {
  const navigation = useNavigation<any>();
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
    const status = STATUS_COLORS[item.status] || STATUS_COLORS.pending;
    const leaveType = LEAVE_TYPE_ICONS[item.leave_type] || LEAVE_TYPE_ICONS.casual;
    const startDate = parseISO(item.start_date);
    const endDate = parseISO(item.end_date);

    return (
      <TouchableOpacity
        style={styles.leaveCard}
        onPress={() => navigation.navigate('LeaveDetail', { leaveId: item.id })}
        activeOpacity={0.7}
      >
        <View style={styles.leaveCardHeader}>
          <View style={[styles.leaveTypeIcon, { backgroundColor: `${leaveType.color}15` }]}>
            <Ionicons name={leaveType.icon} size={20} color={leaveType.color} />
          </View>
          <View style={styles.leaveInfo}>
            <Text style={styles.leaveType}>
              {item.leave_type?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} Leave
            </Text>
            <Text style={styles.leaveDates}>
              {format(startDate, 'MMM d')} - {format(endDate, 'MMM d, yyyy')}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Ionicons name={status.icon as any} size={14} color={status.text} />
            <Text style={[styles.statusText, { color: status.text }]}>{item.status}</Text>
          </View>
        </View>
        
        <View style={styles.leaveCardFooter}>
          <View style={styles.leaveDetail}>
            <Ionicons name="calendar" size={14} color={colors.text.muted} />
            <Text style={styles.leaveDetailText}>{item.days_count} day(s)</Text>
          </View>
          {item.reason && (
            <Text style={styles.leaveReason} numberOfLines={1}>
              {item.reason}
            </Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header with Balance Cards */}
      <LinearGradient
        colors={[colors.primary.default, colors.secondary.default]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <Text style={styles.headerTitle}>Leave Management</Text>
        
        {/* Balance Cards */}
        <View style={styles.balanceCards}>
          <BalanceCard
            title="Casual"
            available={leaveBalance?.casual_leaves?.available || 0}
            total={leaveBalance?.casual_leaves?.total || 12}
            color="#F59E0B"
          />
          <BalanceCard
            title="Sick"
            available={leaveBalance?.sick_leaves?.available || 0}
            total={leaveBalance?.sick_leaves?.total || 12}
            color="#EF4444"
          />
          <BalanceCard
            title="Earned"
            available={leaveBalance?.earned_leaves?.available || 0}
            total={leaveBalance?.earned_leaves?.total || 15}
            color="#8B5CF6"
          />
        </View>
      </LinearGradient>

      {/* Apply Leave Button */}
      <View style={styles.applyButtonContainer}>
        <TouchableOpacity
          style={styles.applyButton}
          onPress={() => navigation.navigate('LeaveApply')}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle" size={22} color="#FFFFFF" />
          <Text style={styles.applyButtonText}>Apply for Leave</Text>
        </TouchableOpacity>
      </View>

      {/* Leave History */}
      <View style={styles.historySection}>
        <Text style={styles.sectionTitle}>Leave History</Text>
        
        <FlatList
          data={leaves}
          keyExtractor={(item) => item.id}
          renderItem={renderLeaveItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.default} />
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={64} color={colors.text.muted} />
              <Text style={styles.emptyText}>No leave requests yet</Text>
              <Text style={styles.emptySubtext}>Tap "Apply for Leave" to request time off</Text>
            </View>
          }
        />
      </View>
    </View>
  );
}

// Balance Card Component
const BalanceCard = ({ title, available, total, color }: { title: string; available: number; total: number; color: string }) => (
  <View style={styles.balanceCard}>
    <View style={[styles.balanceIndicator, { backgroundColor: color }]} />
    <Text style={styles.balanceTitle}>{title}</Text>
    <Text style={styles.balanceValue}>{available}</Text>
    <Text style={styles.balanceTotal}>of {total}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing.lg,
  },
  balanceCards: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  balanceCard: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.lg,
    padding: spacing.md,
    alignItems: 'center',
  },
  balanceIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: spacing.xs,
  },
  balanceTitle: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.8)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: spacing.xs,
  },
  balanceTotal: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.6)',
  },
  applyButtonContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: -spacing.lg,
  },
  applyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary.default,
    borderRadius: borderRadius.lg,
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    ...shadows.lg,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  historySection: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  listContent: {
    paddingBottom: spacing.xxxl,
  },
  leaveCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  leaveCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaveTypeIcon: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaveInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  leaveType: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  leaveDates: {
    fontSize: 13,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  leaveCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border.light,
  },
  leaveDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  leaveDetailText: {
    fontSize: 13,
    color: colors.text.muted,
  },
  leaveReason: {
    flex: 1,
    fontSize: 13,
    color: colors.text.secondary,
    marginLeft: spacing.lg,
    fontStyle: 'italic',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.secondary,
    marginTop: spacing.lg,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
});
