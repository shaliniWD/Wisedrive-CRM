// Leave Screen - Leave management
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
import { format } from 'date-fns';
import { useAuth } from '../context/AuthContext';
import { getLeaveHistory, getLeaveBalance } from '../services/api';

const STATUS_COLORS: Record<string, string> = {
  pending: '#FF9800',
  approved: '#4CAF50',
  rejected: '#F44336',
  cancelled: '#9E9E9E',
};

const LEAVE_TYPE_ICONS: Record<string, string> = {
  casual: 'sunny',
  sick: 'medkit',
  earned: 'star',
  unpaid: 'remove-circle',
};

export default function LeaveScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [selectedFilter, setSelectedFilter] = useState<string | null>(null);

  const { data: leaveData, isLoading, refetch } = useQuery({
    queryKey: ['leaveHistory', selectedFilter],
    queryFn: () => getLeaveHistory(1, 50, selectedFilter || undefined),
  });

  const { data: balance } = useQuery({
    queryKey: ['leaveBalance'],
    queryFn: () => getLeaveBalance(),
  });

  const FilterChip = ({ label, value }: { label: string; value: string | null }) => (
    <TouchableOpacity
      style={[
        styles.filterChip,
        selectedFilter === value && styles.filterChipActive,
      ]}
      onPress={() => setSelectedFilter(value)}
    >
      <Text
        style={[
          styles.filterChipText,
          selectedFilter === value && styles.filterChipTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  const LeaveCard = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={styles.leaveCard}
      onPress={() => navigation.navigate('LeaveDetail', { leaveId: item.id })}
    >
      <View style={styles.leaveCardHeader}>
        <View style={styles.leaveTypeContainer}>
          <Ionicons
            name={LEAVE_TYPE_ICONS[item.leave_type] || 'calendar'}
            size={20}
            color="#2196F3"
          />
          <Text style={styles.leaveType}>
            {item.leave_type.charAt(0).toUpperCase() + item.leave_type.slice(1)} Leave
          </Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: STATUS_COLORS[item.status] + '20' }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>

      <View style={styles.leaveDates}>
        <Text style={styles.dateText}>
          {item.start_date} → {item.end_date}
        </Text>
        <Text style={styles.daysCount}>{item.days_count} day(s)</Text>
      </View>

      <Text style={styles.reason} numberOfLines={2}>
        {item.reason}
      </Text>

      <Text style={styles.appliedOn}>
        Applied on {format(new Date(item.applied_on), 'MMM d, yyyy')}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Balance Summary */}
      <View style={styles.balanceContainer}>
        <View style={styles.balanceItem}>
          <Text style={styles.balanceValue}>{balance?.casual_leaves?.available ?? '-'}</Text>
          <Text style={styles.balanceLabel}>Casual</Text>
        </View>
        <View style={styles.balanceDivider} />
        <View style={styles.balanceItem}>
          <Text style={styles.balanceValue}>{balance?.sick_leaves?.available ?? '-'}</Text>
          <Text style={styles.balanceLabel}>Sick</Text>
        </View>
        <View style={styles.balanceDivider} />
        <View style={styles.balanceItem}>
          <Text style={styles.balanceValue}>{balance?.earned_leaves?.available ?? '-'}</Text>
          <Text style={styles.balanceLabel}>Earned</Text>
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <FilterChip label="All" value={null} />
        <FilterChip label="Pending" value="pending" />
        <FilterChip label="Approved" value="approved" />
        <FilterChip label="Rejected" value="rejected" />
      </View>

      {/* Leave List */}
      <FlatList
        data={leaveData?.leaves || []}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <LeaveCard item={item} />}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No leave requests found</Text>
          </View>
        }
      />

      {/* FAB - Apply Leave */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => navigation.navigate('LeaveApply')}
      >
        <Ionicons name="add" size={28} color="#fff" />
      </TouchableOpacity>

      {/* Approvals Button (for managers) */}
      {user?.is_approver && (
        <TouchableOpacity
          style={styles.approvalsButton}
          onPress={() => navigation.navigate('Approvals')}
        >
          <Ionicons name="checkmark-done" size={20} color="#fff" />
          <Text style={styles.approvalsButtonText}>Pending Approvals</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  balanceContainer: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    padding: 20,
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  balanceItem: {
    alignItems: 'center',
  },
  balanceValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  balanceLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 4,
  },
  balanceDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  filtersContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#fff',
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
    marginRight: 8,
  },
  filterChipActive: {
    backgroundColor: '#2196F3',
  },
  filterChipText: {
    color: '#666',
    fontSize: 14,
  },
  filterChipTextActive: {
    color: '#fff',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  leaveCard: {
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
  leaveCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  leaveTypeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leaveType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  leaveDates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateText: {
    fontSize: 14,
    color: '#666',
  },
  daysCount: {
    fontSize: 14,
    color: '#2196F3',
    fontWeight: '500',
  },
  reason: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  appliedOn: {
    fontSize: 12,
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#999',
    fontSize: 16,
    marginTop: 16,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  approvalsButton: {
    position: 'absolute',
    left: 20,
    bottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  approvalsButtonText: {
    color: '#fff',
    fontWeight: '600',
    marginLeft: 8,
  },
});
