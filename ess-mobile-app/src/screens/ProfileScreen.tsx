// Modern Profile Screen with Tabs
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  Linking,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getProfile, getBankDetails, getSalarySummary, getDocuments } from '../services/api';
import { colors, spacing, borderRadius, shadows } from '../theme';

type TabType = 'personal' | 'salary' | 'bank' | 'documents';

export default function ProfileScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('personal');
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const { data: profile, isLoading: profileLoading } = useQuery({
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

  const { data: documentsData } = useQuery({
    queryKey: ['documents'],
    queryFn: getDocuments,
  });

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
  };

  const formatCurrency = (amount: number, symbol: string = '₹') => {
    return `${symbol}${amount?.toLocaleString('en-IN') || 0}`;
  };

  const tabs: { key: TabType; label: string; icon: string }[] = [
    { key: 'personal', label: 'Personal', icon: 'person' },
    { key: 'salary', label: 'Salary', icon: 'wallet' },
    { key: 'bank', label: 'Bank', icon: 'card' },
    { key: 'documents', label: 'Docs', icon: 'document' },
  ];

  const renderPersonalTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>Basic Information</Text>
        <InfoRow icon="person" label="Full Name" value={profile?.name} />
        <InfoRow icon="mail" label="Email" value={profile?.email} />
        <InfoRow icon="call" label="Phone" value={profile?.phone || 'Not provided'} />
        <InfoRow icon="card" label="Employee Code" value={profile?.employee_code} />
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>Work Information</Text>
        <InfoRow icon="business" label="Department" value={profile?.department_name || 'Not assigned'} />
        <InfoRow icon="briefcase" label="Designation" value={profile?.role_name} />
        <InfoRow icon="flag" label="Country" value={profile?.country_name || 'India'} />
        <InfoRow icon="calendar" label="Joining Date" value={profile?.joining_date || 'Not specified'} />
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>Address</Text>
        <InfoRow 
          icon="location" 
          label="Current Address" 
          value={profile?.address || profile?.current_address || 'Not provided'} 
        />
        <InfoRow 
          icon="home" 
          label="Permanent Address" 
          value={profile?.permanent_address || 'Not provided'} 
        />
      </View>

      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>Emergency Contact</Text>
        <InfoRow 
          icon="person" 
          label="Contact Name" 
          value={profile?.emergency_contact_name || 'Not provided'} 
        />
        <InfoRow 
          icon="call" 
          label="Contact Phone" 
          value={profile?.emergency_contact_phone || 'Not provided'} 
        />
        <InfoRow 
          icon="people" 
          label="Relationship" 
          value={profile?.emergency_contact_relation || 'Not provided'} 
        />
      </View>
    </View>
  );

  const renderSalaryTab = () => (
    <View style={styles.tabContent}>
      {/* Net Salary Card */}
      <LinearGradient
        colors={[colors.primary.default, colors.secondary.default]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.salaryHighlightCard}
      >
        <Text style={styles.salaryHighlightLabel}>Net Salary (Monthly)</Text>
        <Text style={styles.salaryHighlightValue}>
          {formatCurrency(salary?.net_salary, salary?.currency_symbol)}
        </Text>
        <View style={styles.salaryHighlightRow}>
          <View style={styles.salaryHighlightItem}>
            <Text style={styles.salaryHighlightItemLabel}>Gross</Text>
            <Text style={styles.salaryHighlightItemValue}>
              {formatCurrency(salary?.gross_salary, salary?.currency_symbol)}
            </Text>
          </View>
          <View style={styles.salaryHighlightDivider} />
          <View style={styles.salaryHighlightItem}>
            <Text style={styles.salaryHighlightItemLabel}>Deductions</Text>
            <Text style={styles.salaryHighlightItemValue}>
              {formatCurrency((salary?.pf_employee || 0) + (salary?.professional_tax || 0), salary?.currency_symbol)}
            </Text>
          </View>
        </View>
      </LinearGradient>

      {/* Earnings Card */}
      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>Earnings</Text>
        <SalaryRow label="Basic Salary" value={salary?.basic_salary} symbol={salary?.currency_symbol} />
        <SalaryRow label="HRA" value={salary?.hra} symbol={salary?.currency_symbol} />
        <SalaryRow label="Conveyance Allowance" value={salary?.conveyance_allowance} symbol={salary?.currency_symbol} />
        <SalaryRow label="Medical Allowance" value={salary?.medical_allowance} symbol={salary?.currency_symbol} />
        <SalaryRow label="Special Allowance" value={salary?.special_allowance} symbol={salary?.currency_symbol} />
        <View style={styles.salaryTotalRow}>
          <Text style={styles.salaryTotalLabel}>Gross Salary</Text>
          <Text style={styles.salaryTotalValue}>{formatCurrency(salary?.gross_salary, salary?.currency_symbol)}</Text>
        </View>
      </View>

      {/* Deductions Card */}
      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>Deductions</Text>
        <SalaryRow label="PF (Employee)" value={salary?.pf_employee} symbol={salary?.currency_symbol} isDeduction />
        <SalaryRow label="Professional Tax" value={salary?.professional_tax} symbol={salary?.currency_symbol} isDeduction />
        <SalaryRow label="TDS" value={salary?.tds} symbol={salary?.currency_symbol} isDeduction />
        <View style={styles.salaryTotalRow}>
          <Text style={styles.salaryTotalLabel}>Total Deductions</Text>
          <Text style={[styles.salaryTotalValue, { color: colors.status.error }]}>
            -{formatCurrency((salary?.pf_employee || 0) + (salary?.professional_tax || 0) + (salary?.tds || 0), salary?.currency_symbol)}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderBankTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.infoCard}>
        <View style={styles.cardHeaderWithIcon}>
          <View style={[styles.cardIcon, { backgroundColor: colors.status.infoLight }]}>
            <Ionicons name="card" size={24} color={colors.status.info} />
          </View>
          <Text style={styles.cardTitle}>Bank Account Details</Text>
        </View>
        <InfoRow icon="business" label="Bank Name" value={bankDetails?.bank_name || 'Not provided'} />
        <InfoRow icon="document" label="Account Number" value={bankDetails?.account_number ? `****${bankDetails.account_number.slice(-4)}` : 'Not provided'} />
        <InfoRow icon="git-branch" label="IFSC Code" value={bankDetails?.ifsc_code || 'Not provided'} />
        <InfoRow icon="card" label="Account Type" value={bankDetails?.account_type || 'Savings'} />
        <InfoRow icon="person" label="Account Holder" value={bankDetails?.account_holder_name || profile?.name} />
      </View>

      <View style={styles.infoCard}>
        <View style={styles.cardHeaderWithIcon}>
          <View style={[styles.cardIcon, { backgroundColor: colors.status.warningLight }]}>
            <Ionicons name="shield-checkmark" size={24} color={colors.status.warning} />
          </View>
          <Text style={styles.cardTitle}>Tax Information</Text>
        </View>
        <InfoRow icon="card" label="PAN Number" value={bankDetails?.pan_number || profile?.pan_number || 'Not provided'} />
        <InfoRow icon="document-text" label="UAN Number" value={bankDetails?.uan_number || 'Not provided'} />
        <InfoRow icon="wallet" label="PF Account" value={bankDetails?.pf_account || 'Not provided'} />
      </View>
    </View>
  );

  const renderDocumentsTab = () => {
    const documents = documentsData?.documents || [];
    
    return (
      <View style={styles.tabContent}>
        {documents.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-outline" size={64} color={colors.text.muted} />
            <Text style={styles.emptyStateText}>No documents uploaded yet</Text>
          </View>
        ) : (
          documents.map((doc: any, index: number) => (
            <TouchableOpacity 
              key={doc.id || index}
              style={styles.documentCard}
              onPress={() => doc.file_url && Linking.openURL(doc.file_url)}
              activeOpacity={0.7}
            >
              <View style={[styles.documentIcon, { backgroundColor: getDocumentColor(doc.status).bg }]}>
                <Ionicons name={getDocumentIcon(doc.document_type)} size={24} color={getDocumentColor(doc.status).icon} />
              </View>
              <View style={styles.documentInfo}>
                <Text style={styles.documentTitle}>{formatDocumentType(doc.document_type)}</Text>
                <Text style={styles.documentNumber}>{doc.document_number || 'No number'}</Text>
              </View>
              <View style={[styles.documentStatus, { backgroundColor: getDocumentColor(doc.status).bg }]}>
                <Text style={[styles.documentStatusText, { color: getDocumentColor(doc.status).icon }]}>
                  {doc.status}
                </Text>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.default} />}
    >
      {/* Profile Header */}
      <LinearGradient
        colors={[colors.primary.default, colors.secondary.default]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.profileHeader}>
          {profile?.photo_url ? (
            <Image source={{ uri: profile.photo_url }} style={styles.profileImage} />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Text style={styles.profileInitials}>{getInitials(profile?.name || '')}</Text>
            </View>
          )}
          <Text style={styles.profileName}>{profile?.name || 'Loading...'}</Text>
          <Text style={styles.profileRole}>{profile?.role_name || ''}</Text>
          <View style={styles.profileBadge}>
            <Ionicons name="checkmark-circle" size={14} color={colors.status.success} />
            <Text style={styles.profileBadgeText}>Active Employee</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <View style={styles.tabs}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={tab.icon as any} 
                size={18} 
                color={activeTab === tab.key ? colors.primary.default : colors.text.muted} 
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tab Content */}
      {activeTab === 'personal' && renderPersonalTab()}
      {activeTab === 'salary' && renderSalaryTab()}
      {activeTab === 'bank' && renderBankTab()}
      {activeTab === 'documents' && renderDocumentsTab()}
    </ScrollView>
  );
}

// Helper Components
const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string | undefined }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoRowLeft}>
      <Ionicons name={icon as any} size={18} color={colors.text.muted} />
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
    <Text style={styles.infoValue}>{value || '-'}</Text>
  </View>
);

const SalaryRow = ({ label, value, symbol = '₹', isDeduction = false }: { label: string; value: number | undefined; symbol?: string; isDeduction?: boolean }) => (
  <View style={styles.salaryRow}>
    <Text style={styles.salaryLabel}>{label}</Text>
    <Text style={[styles.salaryValue, isDeduction && value && { color: colors.status.error }]}>
      {isDeduction && value ? '-' : ''}{symbol}{value?.toLocaleString('en-IN') || '0'}
    </Text>
  </View>
);

// Helper Functions
const getDocumentIcon = (type: string): any => {
  const icons: Record<string, string> = {
    aadhar: 'card',
    pan: 'document-text',
    passport: 'globe',
    driving_license: 'car',
    educational: 'school',
    offer_letter: 'document',
    experience_letter: 'briefcase',
  };
  return icons[type] || 'document';
};

const getDocumentColor = (status: string) => {
  const colors_map: Record<string, { bg: string; icon: string }> = {
    verified: { bg: '#D1FAE5', icon: '#10B981' },
    pending: { bg: '#FEF3C7', icon: '#F59E0B' },
    rejected: { bg: '#FEE2E2', icon: '#EF4444' },
  };
  return colors_map[status] || colors_map.pending;
};

const formatDocumentType = (type: string): string => {
  return type?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Document';
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.app,
  },
  content: {
    paddingBottom: spacing.xxxl,
  },
  headerGradient: {
    paddingTop: 60,
    paddingBottom: spacing.xxl,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  profileHeader: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  profileImagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  profileInitials: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: spacing.md,
  },
  profileRole: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
    marginTop: spacing.md,
  },
  profileBadgeText: {
    fontSize: 12,
    color: '#FFFFFF',
    marginLeft: spacing.xs,
  },
  tabsContainer: {
    paddingHorizontal: spacing.lg,
    marginTop: -spacing.lg,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.xs,
    ...shadows.md,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: borderRadius.md,
    gap: spacing.xs,
  },
  tabActive: {
    backgroundColor: colors.primary.light,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text.muted,
  },
  tabTextActive: {
    color: colors.primary.default,
    fontWeight: '600',
  },
  tabContent: {
    padding: spacing.lg,
  },
  infoCard: {
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  cardHeaderWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  infoRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoLabel: {
    fontSize: 14,
    color: colors.text.muted,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
    maxWidth: '50%',
    textAlign: 'right',
  },
  salaryHighlightCard: {
    borderRadius: borderRadius.xl,
    padding: spacing.xl,
    marginBottom: spacing.md,
  },
  salaryHighlightLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  salaryHighlightValue: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: spacing.xs,
  },
  salaryHighlightRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.2)',
  },
  salaryHighlightItem: {
    flex: 1,
  },
  salaryHighlightItemLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  salaryHighlightItemValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: spacing.xs,
  },
  salaryHighlightDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: spacing.lg,
  },
  salaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.light,
  },
  salaryLabel: {
    fontSize: 14,
    color: colors.text.secondary,
  },
  salaryValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.primary,
  },
  salaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 2,
    borderTopColor: colors.border.default,
  },
  salaryTotalLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  salaryTotalValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.status.success,
  },
  documentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadows.sm,
  },
  documentIcon: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  documentTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text.primary,
  },
  documentNumber: {
    fontSize: 13,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  documentStatus: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.full,
  },
  documentStatusText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyStateText: {
    fontSize: 16,
    color: colors.text.muted,
    marginTop: spacing.lg,
  },
});
