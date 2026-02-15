// Profile Screen
import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getProfile, getBankDetails, getSalarySummary } from '../services/api';

export default function ProfileScreen() {
  const { data: profile, isLoading, refetch } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const { data: bankDetails } = useQuery({
    queryKey: ['bankDetails'],
    queryFn: getBankDetails,
  });

  const { data: salary } = useQuery({
    queryKey: ['salary'],
    queryFn: getSalarySummary,
  });

  const InfoRow = ({ icon, label, value }: { icon: string; label: string; value?: string }) => (
    <View style={styles.infoRow}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon as any} size={20} color="#666" />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value || '-'}</Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
    >
      {/* Profile Header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {profile?.name?.charAt(0)?.toUpperCase() || 'U'}
          </Text>
        </View>
        <Text style={styles.name}>{profile?.name}</Text>
        <Text style={styles.role}>{profile?.role_name}</Text>
        <Text style={styles.email}>{profile?.email}</Text>
        
        <View style={styles.statusBadge}>
          <View style={[styles.statusDot, { backgroundColor: profile?.employment_status === 'active' ? '#4CAF50' : '#FF9800' }]} />
          <Text style={styles.statusText}>
            {profile?.employment_status?.charAt(0).toUpperCase() + profile?.employment_status?.slice(1)}
          </Text>
        </View>
      </View>

      {/* Work Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Work Information</Text>
        <InfoRow icon="business" label="Department" value={profile?.department_name} />
        <InfoRow icon="people" label="Team" value={profile?.team_name} />
        <InfoRow icon="person" label="Manager" value={profile?.reporting_manager_name} />
        <InfoRow icon="calendar" label="Joined" value={profile?.date_of_joining} />
        <InfoRow icon="briefcase" label="Type" value={profile?.employment_type} />
        <InfoRow icon="location" label="Country" value={profile?.country_name} />
      </View>

      {/* Personal Info */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Personal Information</Text>
        <InfoRow icon="call" label="Phone" value={profile?.phone} />
        <InfoRow icon="gift" label="Date of Birth" value={profile?.date_of_birth} />
        <InfoRow icon="male-female" label="Gender" value={profile?.gender} />
        <InfoRow icon="water" label="Blood Group" value={profile?.blood_group} />
      </View>

      {/* Emergency Contact */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Emergency Contact</Text>
        <InfoRow icon="person-circle" label="Name" value={profile?.emergency_contact_name} />
        <InfoRow icon="call" label="Phone" value={profile?.emergency_contact_phone} />
      </View>

      {/* Bank Details */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bank Details</Text>
        <InfoRow icon="business" label="Bank" value={bankDetails?.bank_name} />
        <InfoRow icon="card" label="Account" value={bankDetails?.account_number_masked} />
        <InfoRow icon="code" label="IFSC" value={bankDetails?.ifsc_code} />
      </View>

      {/* Salary Summary */}
      {salary && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Salary Summary</Text>
          <View style={styles.salaryCard}>
            <View style={styles.salaryRow}>
              <Text style={styles.salaryLabel}>Gross Salary</Text>
              <Text style={styles.salaryValue}>
                {salary.currency_symbol}{salary.gross_salary?.toLocaleString()}
              </Text>
            </View>
            <View style={styles.salaryRow}>
              <Text style={styles.salaryLabel}>Deductions</Text>
              <Text style={[styles.salaryValue, { color: '#F44336' }]}>
                -{salary.currency_symbol}{salary.total_deductions?.toLocaleString()}
              </Text>
            </View>
            <View style={[styles.salaryRow, styles.netRow]}>
              <Text style={styles.netLabel}>Net Salary</Text>
              <Text style={styles.netValue}>
                {salary.currency_symbol}{salary.net_salary?.toLocaleString()}
              </Text>
            </View>
          </View>
        </View>
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
  header: {
    backgroundColor: '#2196F3',
    padding: 32,
    alignItems: 'center',
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  name: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  role: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 16,
    marginTop: 4,
  },
  email: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 14,
    marginTop: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 12,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
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
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {
    marginLeft: 12,
    color: '#666',
    fontSize: 14,
  },
  infoValue: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  salaryCard: {
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
  },
  salaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  salaryLabel: {
    color: '#666',
    fontSize: 14,
  },
  salaryValue: {
    color: '#333',
    fontSize: 14,
    fontWeight: '500',
  },
  netRow: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    marginTop: 8,
    paddingTop: 12,
  },
  netLabel: {
    color: '#333',
    fontSize: 16,
    fontWeight: '600',
  },
  netValue: {
    color: '#4CAF50',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
