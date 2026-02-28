// Professional Leave Detail Screen - Light Theme
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { getLeaveDetail, cancelLeave } from '../services/api';
import { colors, spacing, fontSize, fontWeight, radius, iconSize } from '../theme';
import { formatDateLong, formatDateMedium } from '../utils/dateFormat';

export default function LeaveDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { leaveId } = route.params;

  const { data: leave, isLoading } = useQuery({
    queryKey: ['leaveDetail', leaveId],
    queryFn: () => getLeaveDetail(leaveId),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelLeave(leaveId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveHistory'] });
      queryClient.invalidateQueries({ queryKey: ['leaveBalance'] });
      Alert.alert('Success', 'Leave request cancelled', [
        { text: 'OK', onPress: () => navigation.goBack() }
      ]);
    },
    onError: (error: any) => {
      Alert.alert('Error', error.message || 'Failed to cancel leave');
    },
  });

  const handleCancel = () => {
    Alert.alert(
      'Cancel Leave',
      'Are you sure you want to cancel this leave request?',
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel', style: 'destructive', onPress: () => cancelMutation.mutate() },
      ]
    );
  };

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

  if (isLoading) {
    return (
      <View style={[styles.container, styles.loadingContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const statusStyle = getStatusStyle(leave?.status || '');

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
        <Text style={styles.headerTitle}>Leave Details</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Ionicons 
              name={leave?.status === 'approved' ? 'checkmark-circle' : leave?.status === 'pending' ? 'time' : 'close-circle'} 
              size={20} 
              color={statusStyle.color} 
            />
            <Text style={[styles.statusText, { color: statusStyle.color }]}>
              {leave?.status?.toUpperCase()}
            </Text>
          </View>
          <Text style={styles.leaveType}>{leave?.leave_type}</Text>
          <Text style={styles.leaveDays}>{leave?.days} {leave?.days === 1 ? 'day' : 'days'}</Text>
        </View>

        {/* Details */}
        <View style={styles.detailsCard}>
          <DetailRow 
            icon="calendar-outline" 
            label="Start Date" 
            value={leave?.start_date ? formatDateLong(leave.start_date) : '-'} 
          />
          <DetailRow 
            icon="calendar-outline" 
            label="End Date" 
            value={leave?.end_date ? formatDateLong(leave.end_date) : '-'} 
          />
          <DetailRow 
            icon="time-outline" 
            label="Applied On" 
            value={leave?.created_at ? formatDateMedium(leave.created_at) : '-'} 
          />
          {leave?.approver_name && (
            <DetailRow 
              icon="person-outline" 
              label="Approver" 
              value={leave.approver_name} 
            />
          )}
        </View>

        {/* Reason */}
        {leave?.reason && (
          <View style={styles.reasonCard}>
            <Text style={styles.reasonLabel}>Reason</Text>
            <Text style={styles.reasonText}>{leave.reason}</Text>
          </View>
        )}

        {/* Comments */}
        {leave?.comments && (
          <View style={styles.reasonCard}>
            <Text style={styles.reasonLabel}>Comments</Text>
            <Text style={styles.reasonText}>{leave.comments}</Text>
          </View>
        )}
      </ScrollView>

      {/* Cancel Button */}
      {leave?.status === 'pending' && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
          <TouchableOpacity
            testID="cancel-leave-btn"
            style={styles.cancelBtn}
            onPress={handleCancel}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? (
              <ActivityIndicator color={colors.error} />
            ) : (
              <>
                <Ionicons name="close-circle-outline" size={18} color={colors.error} />
                <Text style={styles.cancelBtnText}>Cancel Leave Request</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const DetailRow = ({ icon, label, value }: { icon: any; label: string; value: string }) => (
  <View style={styles.detailRow}>
    <View style={styles.detailIcon}>
      <Ionicons name={icon} size={16} color={colors.text.tertiary} />
    </View>
    <View style={styles.detailContent}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
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
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xl,
  },
  statusCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.xxl,
    alignItems: 'center',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  statusText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  leaveType: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  leaveDays: {
    fontSize: fontSize.base,
    color: colors.text.secondary,
  },
  detailsCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  detailIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  detailValue: {
    fontSize: fontSize.base,
    color: colors.text.primary,
  },
  reasonCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  reasonLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reasonText: {
    fontSize: fontSize.base,
    color: colors.text.primary,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.background,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.errorBg,
    paddingVertical: spacing.lg,
    borderRadius: radius.md,
    gap: spacing.sm,
  },
  cancelBtnText: {
    color: colors.error,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
  },
});
