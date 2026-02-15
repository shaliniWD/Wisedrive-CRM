// Modern Profile Screen - Clean design with tabs
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { getProfile, getBankDetails, getSalarySummary } from '../services/api';
import { colors, spacing, fontSize, radius, iconSize } from '../theme';

type TabType = 'personal' | 'salary' | 'bank';

export default function ProfileScreen() {
  const [activeTab, setActiveTab] = useState<TabType>('personal');
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const { data: profile } = useQuery({
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

  const tabs = [
    { key: 'personal' as TabType, label: 'Personal' },
    { key: 'salary' as TabType, label: 'Salary' },
    { key: 'bank' as TabType, label: 'Bank' },
  ];

  const renderPersonalTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Basic Information</Text>
        <InfoRow label="Full Name" value={profile?.name} />
        <InfoRow label="Email" value={profile?.email} />
        <InfoRow label="Phone" value={profile?.phone || 'Not provided'} />
        <InfoRow label="Employee Code" value={profile?.employee_code} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Work Information</Text>
        <InfoRow label="Department" value={profile?.department_name || 'Not assigned'} />
        <InfoRow label="Designation" value={profile?.role_name} />
        <InfoRow label="Country" value={profile?.country_name || 'India'} />
        <InfoRow label="Joining Date" value={profile?.joining_date || '-'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Address</Text>
        <InfoRow label="Current" value={profile?.address || profile?.current_address || '-'} />
        <InfoRow label="Permanent" value={profile?.permanent_address || '-'} isLast />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Emergency Contact</Text>
        <InfoRow label="Name" value={profile?.emergency_contact_name || '-'} />
        <InfoRow label="Phone" value={profile?.emergency_contact_phone || '-'} />
        <InfoRow label="Relation" value={profile?.emergency_contact_relation || '-'} isLast />
      </View>
    </View>
  );

  const renderSalaryTab = () => (
    <View style={styles.tabContent}>
      {/* Net Salary Highlight */}
      <View style={styles.salaryHighlight}>
        <Text style={styles.salaryHighlightLabel}>Net Salary (Monthly)</Text>
        <Text style={styles.salaryHighlightValue}>
          {formatCurrency(salary?.net_salary, salary?.currency_symbol)}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Earnings</Text>
        <SalaryRow label="Basic Salary" value={salary?.basic_salary} symbol={salary?.currency_symbol} />
        <SalaryRow label="HRA" value={salary?.hra} symbol={salary?.currency_symbol} />
        <SalaryRow label="Conveyance" value={salary?.conveyance_allowance} symbol={salary?.currency_symbol} />
        <SalaryRow label="Medical" value={salary?.medical_allowance} symbol={salary?.currency_symbol} />
        <SalaryRow label="Special" value={salary?.special_allowance} symbol={salary?.currency_symbol} />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Gross Salary</Text>
          <Text style={styles.totalValue}>{formatCurrency(salary?.gross_salary, salary?.currency_symbol)}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Deductions</Text>
        <SalaryRow label="PF (Employee)" value={salary?.pf_employee} symbol={salary?.currency_symbol} isDeduction />
        <SalaryRow label="Professional Tax" value={salary?.professional_tax} symbol={salary?.currency_symbol} isDeduction />
        <SalaryRow label="TDS" value={salary?.tds} symbol={salary?.currency_symbol} isDeduction />
        <View style={styles.totalRow}>
          <Text style={styles.totalLabel}>Total Deductions</Text>
          <Text style={[styles.totalValue, { color: colors.status.error }]}>
            -{formatCurrency((salary?.pf_employee || 0) + (salary?.professional_tax || 0) + (salary?.tds || 0), salary?.currency_symbol)}
          </Text>
        </View>
      </View>
    </View>
  );

  const renderBankTab = () => (
    <View style={styles.tabContent}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bank Account</Text>
        <InfoRow label="Bank Name" value={bankDetails?.bank_name || '-'} />
        <InfoRow label="Account No." value={bankDetails?.account_number ? `****${bankDetails.account_number.slice(-4)}` : '-'} />
        <InfoRow label="IFSC Code" value={bankDetails?.ifsc_code || '-'} />
        <InfoRow label="Account Type" value={bankDetails?.account_type || 'Savings'} />
        <InfoRow label="Holder Name" value={bankDetails?.account_holder_name || profile?.name || '-'} isLast />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Tax Information</Text>
        <InfoRow label="PAN Number" value={bankDetails?.pan_number || profile?.pan_number || '-'} />
        <InfoRow label="UAN Number" value={bankDetails?.uan_number || '-'} />
        <InfoRow label="PF Account" value={bankDetails?.pf_account || '-'} isLast />
      </View>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={iconSize.lg} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      {/* Profile Summary */}
      <View style={styles.profileSummary}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{getInitials(profile?.name || '')}</Text>
        </View>
        <Text style={styles.profileName}>{profile?.name || 'Loading...'}</Text>
        <Text style={styles.profileRole}>{profile?.role_name || ''}</Text>
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <Text style={styles.badgeText}>Active</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Tab Content */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.default} />}
      >
        {activeTab === 'personal' && renderPersonalTab()}
        {activeTab === 'salary' && renderSalaryTab()}
        {activeTab === 'bank' && renderBankTab()}
      </ScrollView>
    </View>
  );
}

// Info Row Component
const InfoRow = ({ label, value, isLast = false }: { label: string; value: string | undefined; isLast?: boolean }) => (
  <View style={[styles.infoRow, !isLast && styles.infoRowBorder]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue} numberOfLines={2}>{value || '-'}</Text>
  </View>
);

// Salary Row Component
const SalaryRow = ({ label, value, symbol = '₹', isDeduction = false }: { label: string; value: number | undefined; symbol?: string; isDeduction?: boolean }) => (
  <View style={styles.salaryRow}>
    <Text style={styles.salaryLabel}>{label}</Text>
    <Text style={[styles.salaryValue, isDeduction && value && { color: colors.status.error }]}>
      {isDeduction && value ? '-' : ''}{symbol}{value?.toLocaleString('en-IN') || '0'}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.background.primary,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  profileSummary: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.background.primary,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary.default,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  profileName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: spacing.sm,
  },
  profileRole: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.status.successBg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    marginTop: spacing.sm,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.status.success,
    marginRight: spacing.xs,
  },
  badgeText: {
    fontSize: fontSize.xs,
    color: colors.status.success,
    fontWeight: '500',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: colors.background.primary,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    paddingVertical: spacing.md,
    marginRight: spacing.xl,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: colors.primary.default,
  },
  tabText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text.tertiary,
  },
  tabTextActive: {
    color: colors.primary.default,
  },
  tabContent: {
    padding: spacing.lg,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.secondary,
    marginBottom: spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  infoValue: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text.primary,
    maxWidth: '55%',
    textAlign: 'right',
  },
  salaryHighlight: {
    backgroundColor: colors.primary.default,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  salaryHighlightLabel: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
  },
  salaryHighlightValue: {
    fontSize: fontSize.hero,
    fontWeight: '700',
    color: colors.text.inverse,
    marginTop: spacing.xs,
  },
  salaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  salaryLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  salaryValue: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text.primary,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    marginTop: spacing.xs,
  },
  totalLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.primary,
  },
  totalValue: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    color: colors.status.success,
  },
});
