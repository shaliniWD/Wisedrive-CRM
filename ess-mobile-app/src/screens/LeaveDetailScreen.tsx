// Leave Detail Screen
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import { format } from 'date-fns';
import { getLeaveDetail, cancelLeave } from '../services/api';

const STATUS_COLORS: Record<string, string> = {
  pending: '#FF9800',
  approved: '#4CAF50',
  rejected: '#F44336',
  cancelled: '#9E9E9E',
};

export default function LeaveDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { leaveId } = route.params;

  const { data: leave, isLoading } = useQuery({
    queryKey: ['leaveDetail', leaveId],
    queryFn: () => getLeaveDetail(leaveId),
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelLeave(leaveId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaveHistory'] });
      queryClient.invalidateQueries({ queryKey: ['leaveDetail', leaveId] });
      Alert.alert('Success', 'Leave request cancelled');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to cancel leave');
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

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2196F3" />
      </View>
    );
  }

  if (!leave) {
    return (
      <View style={styles.loading}>
        <Text>Leave not found</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Status Header */}
      <View style={[styles.statusHeader, { backgroundColor: STATUS_COLORS[leave.status] }]}>
        <Ionicons
          name={leave.status === 'approved' ? 'checkmark-circle' : leave.status === 'rejected' ? 'close-circle' : 'time'}
          size={48}
          color="#fff"
        />
        <Text style={styles.statusText}>{leave.status.toUpperCase()}</Text>
      </View>

      {/* Leave Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Leave Details</Text>
        
        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Type</Text>
          <Text style={styles.detailValue}>
            {leave.leave_type.charAt(0).toUpperCase() + leave.leave_type.slice(1)} Leave
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Duration</Text>
          <Text style={styles.detailValue}>
            {leave.start_date} → {leave.end_date}
          </Text>
        </View>

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Days</Text>
          <Text style={styles.detailValue}>{leave.days_count} day(s)</Text>
        </View>

        {leave.is_half_day && (
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Half Day</Text>
            <Text style={styles.detailValue}>
              {leave.half_day_type === 'first_half' ? 'First Half' : 'Second Half'}
            </Text>
          </View>
        )}

        <View style={styles.detailRow}>
          <Text style={styles.detailLabel}>Applied On</Text>
          <Text style={styles.detailValue}>
            {format(new Date(leave.applied_on), 'MMM d, yyyy h:mm a')}
          </Text>
        </View>
      </View>

      {/* Reason */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Reason</Text>
        <Text style={styles.reasonText}>{leave.reason}</Text>
      </View>

      {/* Approval Info */}
      {(leave.approved_by || leave.rejection_reason) && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {leave.status === 'approved' ? 'Approval Info' : 'Rejection Info'}
          </Text>
          
          {leave.approved_by && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>By</Text>
              <Text style={styles.detailValue}>{leave.approved_by}</Text>
            </View>
          )}

          {leave.approved_on && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>On</Text>
              <Text style={styles.detailValue}>
                {format(new Date(leave.approved_on), 'MMM d, yyyy h:mm a')}
              </Text>
            </View>
          )}

          {leave.rejection_reason && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Reason</Text>
              <Text style={styles.detailValue}>{leave.rejection_reason}</Text>
            </View>
          )}
        </View>
      )}

      {/* Cancel Button */}
      {leave.can_cancel && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleCancel}
          disabled={cancelMutation.isPending}
        >
          {cancelMutation.isPending ? (
            <ActivityIndicator color="#F44336" />
          ) : (
            <>
              <Ionicons name="close-circle" size={20} color="#F44336" />
              <Text style={styles.cancelButtonText}>Cancel Leave Request</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusHeader: {
    padding: 32,
    alignItems: 'center',
  },
  statusText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 8,
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    color: '#666',
    fontSize: 14,
  },
  detailValue: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  reasonText: {
    color: '#333',
    fontSize: 14,
    lineHeight: 22,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 16,
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  cancelButtonText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
});
