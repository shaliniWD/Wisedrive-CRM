// Approvals Screen - For managers to approve/reject leaves
import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { getPendingApprovals, approveRejectLeave } from '../services/api';

export default function ApprovalsScreen() {
  const queryClient = useQueryClient();

  const { data: approvals, isLoading, refetch } = useQuery({
    queryKey: ['pendingApprovals'],
    queryFn: getPendingApprovals,
  });

  const actionMutation = useMutation({
    mutationFn: ({ leaveId, action, comments }: { leaveId: string; action: 'approve' | 'reject'; comments?: string }) =>
      approveRejectLeave(leaveId, action, comments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendingApprovals'] });
      Alert.alert('Success', 'Leave request updated');
    },
    onError: (error: any) => {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update leave');
    },
  });

  const handleApprove = (leaveId: string) => {
    Alert.alert(
      'Approve Leave',
      'Are you sure you want to approve this leave request?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Approve', onPress: () => actionMutation.mutate({ leaveId, action: 'approve' }) },
      ]
    );
  };

  const handleReject = (leaveId: string) => {
    Alert.prompt(
      'Reject Leave',
      'Please provide a reason for rejection:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject',
          style: 'destructive',
          onPress: (reason) => actionMutation.mutate({ leaveId, action: 'reject', comments: reason }),
        },
      ],
      'plain-text'
    );
  };

  const ApprovalCard = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.employeeInfo}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.employee_name?.charAt(0) || 'E'}</Text>
          </View>
          <View>
            <Text style={styles.employeeName}>{item.employee_name}</Text>
            <Text style={styles.leaveType}>
              {item.leave_type.charAt(0).toUpperCase() + item.leave_type.slice(1)} Leave
            </Text>
          </View>
        </View>
        <Text style={styles.days}>{item.days_count} day(s)</Text>
      </View>

      <View style={styles.dateRow}>
        <Ionicons name="calendar-outline" size={16} color="#666" />
        <Text style={styles.dateText}>
          {item.start_date} → {item.end_date}
        </Text>
      </View>

      <Text style={styles.reason} numberOfLines={2}>{item.reason}</Text>

      <Text style={styles.appliedOn}>
        Applied {format(new Date(item.applied_on), 'MMM d, yyyy')}
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.rejectButton]}
          onPress={() => handleReject(item.id)}
          disabled={actionMutation.isPending}
        >
          <Ionicons name="close" size={20} color="#F44336" />
          <Text style={styles.rejectText}>Reject</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.approveButton]}
          onPress={() => handleApprove(item.id)}
          disabled={actionMutation.isPending}
        >
          <Ionicons name="checkmark" size={20} color="#fff" />
          <Text style={styles.approveText}>Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={approvals || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <ApprovalCard item={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-circle" size={64} color="#4CAF50" />
            <Text style={styles.emptyText}>No pending approvals</Text>
            <Text style={styles.emptySubtext}>All caught up!</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  employeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#2196F3',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  employeeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  leaveType: {
    fontSize: 12,
    color: '#666',
  },
  days: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2196F3',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateText: {
    marginLeft: 8,
    color: '#666',
    fontSize: 14,
  },
  reason: {
    color: '#666',
    fontSize: 14,
    marginBottom: 8,
  },
  appliedOn: {
    color: '#999',
    fontSize: 12,
    marginBottom: 12,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    flex: 1,
    marginHorizontal: 4,
  },
  rejectButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#F44336',
  },
  approveButton: {
    backgroundColor: '#4CAF50',
  },
  rejectText: {
    color: '#F44336',
    fontWeight: '600',
    marginLeft: 4,
  },
  approveText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#333',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtext: {
    color: '#999',
    fontSize: 14,
    marginTop: 4,
  },
});
