// Home Screen - Dashboard
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { getProfile, getLeaveBalance, getAttendanceSummary } from '../services/api';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const { user, logout } = useAuth();

  const { data: profile, refetch: refetchProfile } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const { data: leaveBalance, refetch: refetchLeave } = useQuery({
    queryKey: ['leaveBalance'],
    queryFn: () => getLeaveBalance(),
  });

  const { data: attendance, refetch: refetchAttendance } = useQuery({
    queryKey: ['attendance'],
    queryFn: () => getAttendanceSummary(),
  });

  const onRefresh = async () => {
    await Promise.all([refetchProfile(), refetchLeave(), refetchAttendance()]);
  };

  const QuickAction = ({ icon, label, onPress, color = '#2196F3' }: any) => (
    <TouchableOpacity style={styles.quickAction} onPress={onPress}>
      <View style={[styles.quickActionIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.quickActionLabel}>{label}</Text>
    </TouchableOpacity>
  );

  const StatCard = ({ title, value, subtitle, color = '#2196F3' }: any) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {subtitle && <Text style={styles.statSubtitle}>{subtitle}</Text>}
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.greeting}>Hello,</Text>
          <Text style={styles.userName}>{profile?.name || user?.name}</Text>
          <Text style={styles.role}>{profile?.role_name}</Text>
        </View>
        <TouchableOpacity 
          style={styles.profileButton}
          onPress={() => navigation.navigate('Profile')}
        >
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {(profile?.name || user?.name || 'U').charAt(0).toUpperCase()}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickActionsGrid}>
          <QuickAction 
            icon="calendar" 
            label="Apply Leave" 
            color="#4CAF50"
            onPress={() => navigation.navigate('Leave', { screen: 'LeaveApply' })}
          />
          <QuickAction 
            icon="wallet" 
            label="Payslips" 
            color="#FF9800"
            onPress={() => navigation.navigate('Payslips')}
          />
          <QuickAction 
            icon="document-text" 
            label="Documents" 
            color="#9C27B0"
            onPress={() => navigation.navigate('Documents')}
          />
          <QuickAction 
            icon="settings" 
            label="Settings" 
            color="#607D8B"
            onPress={() => navigation.navigate('Settings')}
          />
        </View>
      </View>

      {/* Leave Balance */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Leave Balance</Text>
        <View style={styles.statsRow}>
          <StatCard 
            title="Casual" 
            value={leaveBalance?.casual_leaves?.available ?? '-'} 
            subtitle="Available"
            color="#4CAF50"
          />
          <StatCard 
            title="Sick" 
            value={leaveBalance?.sick_leaves?.available ?? '-'} 
            subtitle="Available"
            color="#FF9800"
          />
          <StatCard 
            title="Earned" 
            value={leaveBalance?.earned_leaves?.available ?? '-'} 
            subtitle="Available"
            color="#2196F3"
          />
        </View>
      </View>

      {/* Attendance This Month */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>This Month</Text>
        <View style={styles.attendanceCard}>
          <View style={styles.attendanceRow}>
            <View style={styles.attendanceItem}>
              <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
              <Text style={styles.attendanceValue}>{attendance?.present_days ?? 0}</Text>
              <Text style={styles.attendanceLabel}>Present</Text>
            </View>
            <View style={styles.attendanceItem}>
              <Ionicons name="close-circle" size={24} color="#F44336" />
              <Text style={styles.attendanceValue}>{attendance?.absent_days ?? 0}</Text>
              <Text style={styles.attendanceLabel}>Absent</Text>
            </View>
            <View style={styles.attendanceItem}>
              <Ionicons name="calendar" size={24} color="#FF9800" />
              <Text style={styles.attendanceValue}>{attendance?.leaves_taken ?? 0}</Text>
              <Text style={styles.attendanceLabel}>On Leave</Text>
            </View>
            <View style={styles.attendanceItem}>
              <Ionicons name="time" size={24} color="#9C27B0" />
              <Text style={styles.attendanceValue}>{attendance?.overtime_days ?? 0}</Text>
              <Text style={styles.attendanceLabel}>Overtime</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Logout Button */}
      <TouchableOpacity style={styles.logoutButton} onPress={logout}>
        <Ionicons name="log-out-outline" size={20} color="#F44336" />
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2196F3',
    padding: 24,
    paddingTop: 60,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flex: 1,
  },
  greeting: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
  },
  userName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  role: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  profileButton: {
    marginLeft: 16,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  section: {
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickAction: {
    width: '48%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statTitle: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statSubtitle: {
    fontSize: 10,
    color: '#999',
    marginTop: 2,
  },
  attendanceCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  attendanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  attendanceItem: {
    alignItems: 'center',
  },
  attendanceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  attendanceLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    marginHorizontal: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F44336',
  },
  logoutText: {
    color: '#F44336',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
});
