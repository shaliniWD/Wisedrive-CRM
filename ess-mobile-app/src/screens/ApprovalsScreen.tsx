// Professional Approvals Screen - Light Theme
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { getPendingApprovals, approveRejectLeave } from '../services/api';
import { colors, spacing, fontSize, fontWeight, radius, iconSize } from '../theme';
import { formatDateShort } from '../utils/dateFormat';

export default function ApprovalsScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);
  const [comments, setComments] = useState('');

  const { data: approvals, isLoading } = useQuery({
    queryKey: ['pendingApprovals'],
    queryFn: getPendingApprovals,
  });

  const actionMutation = useMutation({
    mutationFn: ({ leaveId, action }: { leaveId: string; action: 'approve' | 'reject' }) =>
      approveRejectLeave(leaveId, action, comments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
      setComments('');
      Alert.alert('Success', 'Action completed successfully');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Action failed');
    },
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
    setRefreshing(false);
  };

  const handleAction = (leaveId: string, action: 'approve' | 'reject') => {
    Alert.alert(
      action === 'approve' ? 'Approve Leave' : 'Reject Leave',
      `Are you sure you want to ${action} this leave request?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: action === 'approve' ? 'Approve' : 'Reject',
          style: action === 'reject' ? 'destructive' : 'default',
          onPress: () => actionMutation.mutate({ leaveId, action }),
        },
      ]
    );
  };

  const pendingList = approvals?.pending || [];

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
        <Text style={styles.headerTitle}>Approvals</Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{pendingList.length}</Text>
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
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : pendingList.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="checkmark-done-circle-outline" size={48} color={colors.success} />
            </View>
            <Text style={styles.emptyText}>All caught up!</Text>
            <Text style={styles.emptySubtext}>No pending approvals</Text>
          </View>
        ) : (
          pendingList.map((leave: any) => (
            <View key={leave.id} style={styles.approvalCard}>
              {/* Employee Info */}
              <View style={styles.employeeRow}>
                <LinearGradient colors={colors.gradients.primary} style={styles.employeeAvatar}>
                  <Text style={styles.employeeInitials}>
                    {leave.employee_name?.split(' ').map((n: string) => n[0]).join('').substring(0, 2).toUpperCase() || 'U'}
                  </Text>
                </LinearGradient>
                <View style={styles.employeeInfo}>
                  <Text style={styles.employeeName}>{leave.employee_name}</Text>
                  <Text style={styles.employeeDept}>{leave.department || 'Employee'}</Text>
                </View>
                <View style={styles.leaveDaysBadge}>
                  <Text style={styles.leaveDaysText}>{leave.days} {leave.days === 1 ? 'day' : 'days'}</Text>
                </View>
              </View>

              {/* Leave Details */}
              <View style={styles.leaveDetails}>
                <View style={styles.detailRow}>
                  <View style={styles.detailItem}>
                    <Ionicons name="bookmark-outline" size={14} color={colors.text.tertiary} />
                    <Text style={styles.detailText}>{leave.leave_type}</Text>
                  </View>
                  <View style={styles.detailItem}>
                    <Ionicons name="calendar-outline" size={14} color={colors.text.tertiary} />
                    <Text style={styles.detailText}>
                      {format(new Date(leave.start_date), 'MMM d')} - {format(new Date(leave.end_date), 'MMM d')}
                    </Text>
                  </View>
                </View>
                {leave.reason && (
                  <Text style={styles.reasonText} numberOfLines={2}>{leave.reason}</Text>
                )}
              </View>

              {/* Actions */}
              <View style={styles.actionsRow}>
                <TouchableOpacity
                  testID={`reject-${leave.id}`}
                  style={styles.rejectBtn}
                  onPress={() => handleAction(leave.id, 'reject')}
                  disabled={actionMutation.isPending}
                >
                  <Ionicons name="close" size={18} color={colors.error} />
                  <Text style={styles.rejectText}>Reject</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  testID={`approve-${leave.id}`}
                  style={styles.approveBtn}
                  onPress={() => handleAction(leave.id, 'approve')}
                  disabled={actionMutation.isPending}
                >
                  <LinearGradient
                    colors={[colors.success, '#059669']}
                    style={styles.approveBtnGradient}
                  >
                    <Ionicons name="checkmark" size={18} color="#FFF" />
                    <Text style={styles.approveText}>Approve</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
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
    alignItems: 'center',
    justifyContent: 'space-between',
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
  countBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: radius.full,
  },
  countText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#FFF',
  },
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxxl,
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
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: radius.xl,
    backgroundColor: colors.successBg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  emptyText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
  },
  approvalCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  employeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  employeeAvatar: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  employeeInitials: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#FFF',
  },
  employeeInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  employeeName: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  employeeDept: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  leaveDaysBadge: {
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  leaveDaysText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  leaveDetails: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: 'row',
    gap: spacing.lg,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  detailText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  reasonText: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorBg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    gap: spacing.xs,
  },
  rejectText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.error,
  },
  approveBtn: {
    flex: 1,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  approveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  approveText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: '#FFF',
  },
});
