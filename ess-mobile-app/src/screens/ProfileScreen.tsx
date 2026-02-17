// Professional Profile Screen - Light Theme
// Salary structure matches CRM exactly
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getProfile, getBankDetails, getSalarySummary } from '../services/api';
import { colors, spacing, fontSize, fontWeight, radius, iconSize, shadows } from '../theme';

type TabType = 'personal' | 'bank' | 'salary';

export default function ProfileScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('personal');
  const [refreshing, setRefreshing] = useState(false);

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const { data: bankDetails, isLoading: bankLoading } = useQuery({
    queryKey: ['bankDetails'],
    queryFn: getBankDetails,
    enabled: activeTab === 'bank',
  });

  const { data: salary, isLoading: salaryLoading } = useQuery({
    queryKey: ['salary'],
    queryFn: getSalarySummary,
    enabled: activeTab === 'salary',
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
    if (!amount && amount !== 0) return '-';
    return `${symbol}${new Intl.NumberFormat('en-IN').format(amount)}`;
  };

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: 'personal', label: 'Personal', icon: 'person-outline' },
    { key: 'bank', label: 'Bank', icon: 'card-outline' },
    { key: 'salary', label: 'Salary', icon: 'wallet-outline' },
  ];

  const isLoading = profileLoading || (activeTab === 'bank' && bankLoading) || (activeTab === 'salary' && salaryLoading);

  // Calculate totals for salary display (matching CRM structure)
  const grossSalary = (salary?.basic_salary || 0) + (salary?.hra || 0) + (salary?.variable_pay || 0) + 
                      (salary?.conveyance || 0) + (salary?.medical || 0) + (salary?.special_allowance || 0);
  const totalDeductions = (salary?.pf_employee || 0) + (salary?.professional_tax || 0) + 
                          (salary?.income_tax || 0) + (salary?.other_deductions || 0);
  const netSalary = grossSalary - totalDeductions;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header - No settings icon (settings is on home now) */}
      <View style={styles.header}>
        <TouchableOpacity
          testID="back-btn"
          style={styles.backBtn}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={iconSize.lg} color={colors.text.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 40 }} />
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
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            {profile?.photo_url ? (
              <Image 
                source={{ uri: profile.photo_url }}
                style={styles.avatarImage}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient colors={colors.gradients.primary} style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {getInitials(profile?.name || user?.name || '')}
                </Text>
              </LinearGradient>
            )}
          </View>
          <Text style={styles.profileName}>{profile?.name || user?.name || 'User'}</Text>
          <Text style={styles.profileEmail}>{profile?.email || user?.email || ''}</Text>
          <View style={styles.profileBadge}>
            <Ionicons name="briefcase" size={14} color={colors.primary} />
            <Text style={styles.profileRole}>{profile?.role_name || 'Employee'}</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              testID={`tab-${tab.key}`}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Ionicons 
                name={tab.icon} 
                size={iconSize.md} 
                color={activeTab === tab.key ? colors.primary : colors.text.tertiary} 
              />
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {activeTab === 'personal' && (
              <View style={styles.tabContent}>
                <InfoRow icon="id-card-outline" label="Employee ID" value={profile?.employee_code || '-'} />
                <InfoRow icon="call-outline" label="Phone" value={profile?.phone || '-'} />
                <InfoRow icon="business-outline" label="Department" value={profile?.department_name || '-'} />
                <InfoRow icon="location-outline" label="Location" value={profile?.location || profile?.country_name || '-'} />
                <InfoRow icon="calendar-outline" label="Join Date" value={profile?.join_date || '-'} />
              </View>
            )}
            
            {activeTab === 'bank' && (
              <View style={styles.tabContent}>
                <InfoRow icon="card-outline" label="Account Number" value={bankDetails?.account_number ? `****${bankDetails.account_number.slice(-4)}` : '-'} />
                <InfoRow icon="business-outline" label="Bank Name" value={bankDetails?.bank_name || '-'} />
                <InfoRow icon="git-branch-outline" label="Branch" value={bankDetails?.branch_name || '-'} />
                <InfoRow icon="barcode-outline" label="IFSC Code" value={bankDetails?.ifsc_code || '-'} />
                <InfoRow icon="person-outline" label="Account Holder" value={bankDetails?.account_holder_name || '-'} />
              </View>
            )}
            
            {activeTab === 'salary' && (
              <>
                {/* Earnings Section - Matching CRM */}
                <View style={styles.salarySection}>
                  <View style={styles.salarySectionHeader}>
                    <View style={[styles.salarySectionIcon, { backgroundColor: colors.successBg }]}>
                      <Ionicons name="trending-up" size={16} color={colors.success} />
                    </View>
                    <Text style={styles.salarySectionTitle}>Earnings</Text>
                  </View>
                  <View style={styles.salaryCard}>
                    <SalaryRow label="Basic Salary" value={formatCurrency(salary?.basic_salary || 0)} />
                    <SalaryRow label="HRA" value={formatCurrency(salary?.hra || 0)} />
                    <SalaryRow label="Variable Pay / Incentives" value={formatCurrency(salary?.variable_pay || 0)} />
                    <SalaryRow label="Conveyance" value={formatCurrency(salary?.conveyance || 0)} />
                    <SalaryRow label="Medical Allowance" value={formatCurrency(salary?.medical || 0)} />
                    <SalaryRow label="Special Allowance" value={formatCurrency(salary?.special_allowance || 0)} />
                    <View style={styles.salaryTotalRow}>
                      <Text style={styles.salaryTotalLabel}>Gross Salary</Text>
                      <Text style={[styles.salaryTotalValue, { color: colors.success }]}>
                        {formatCurrency(grossSalary)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Deductions Section - Matching CRM */}
                <View style={styles.salarySection}>
                  <View style={styles.salarySectionHeader}>
                    <View style={[styles.salarySectionIcon, { backgroundColor: colors.errorBg }]}>
                      <Ionicons name="trending-down" size={16} color={colors.error} />
                    </View>
                    <Text style={styles.salarySectionTitle}>Deductions</Text>
                  </View>
                  <View style={styles.salaryCard}>
                    <SalaryRow label="PF (Employee)" value={formatCurrency(salary?.pf_employee || 0)} isDeduction />
                    <SalaryRow label="Professional Tax" value={formatCurrency(salary?.professional_tax || 0)} isDeduction />
                    <SalaryRow label="Income Tax (TDS)" value={formatCurrency(salary?.income_tax || 0)} isDeduction />
                    <SalaryRow label="Other Deductions" value={formatCurrency(salary?.other_deductions || 0)} isDeduction />
                    <View style={styles.salaryTotalRow}>
                      <Text style={styles.salaryTotalLabel}>Total Deductions</Text>
                      <Text style={[styles.salaryTotalValue, { color: colors.error }]}>
                        {formatCurrency(totalDeductions)}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Net Salary Card */}
                <View style={styles.netSalaryCard}>
                  <LinearGradient
                    colors={colors.gradients.primary}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.netSalaryGradient}
                  >
                    <Text style={styles.netSalaryLabel}>Net Salary (Take Home)</Text>
                    <Text style={styles.netSalaryValue}>{formatCurrency(netSalary)}</Text>
                  </LinearGradient>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const InfoRow = ({ 
  icon, 
  label, 
  value, 
}: { 
  icon: any; 
  label: string; 
  value: string; 
}) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIcon}>
      <Ionicons name={icon} size={16} color={colors.text.tertiary} />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  </View>
);

const SalaryRow = ({ 
  label, 
  value, 
  isDeduction = false 
}: { 
  label: string; 
  value: string; 
  isDeduction?: boolean;
}) => (
  <View style={styles.salaryRow}>
    <Text style={styles.salaryRowLabel}>{label}</Text>
    <Text style={[styles.salaryRowValue, isDeduction && { color: colors.error }]}>{value}</Text>
  </View>
);

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
  scrollContent: {
    padding: spacing.xl,
    paddingBottom: spacing.xxxxl,
  },
  // Profile Card
  profileCard: {
    backgroundColor: colors.background,
    borderRadius: radius.xl,
    padding: spacing.xxl,
    alignItems: 'center',
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarContainer: {
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.border,
  },
  avatarText: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: '#FFF',
  },
  profileName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  profileEmail: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  profileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    gap: spacing.xs,
  },
  profileRole: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  // Tabs
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.xs,
    marginBottom: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
    borderRadius: radius.md,
  },
  tabActive: {
    backgroundColor: colors.primaryLight,
  },
  tabText: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    fontWeight: fontWeight.medium,
  },
  tabTextActive: {
    color: colors.primary,
  },
  // Content
  loadingContainer: {
    paddingVertical: spacing.xxxxl,
    alignItems: 'center',
  },
  tabContent: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoIcon: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  infoContent: {
    flex: 1,
  },
  infoLabel: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: fontSize.base,
    color: colors.text.primary,
  },
  // Salary Section
  salarySection: {
    marginBottom: spacing.lg,
  },
  salarySectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  salarySectionIcon: {
    width: 28,
    height: 28,
    borderRadius: radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  salarySectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  salaryCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  salaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  salaryRowLabel: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
  },
  salaryRowValue: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  salaryTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  salaryTotalLabel: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  salaryTotalValue: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
  },
  // Net Salary Card
  netSalaryCard: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    ...shadows.lg,
  },
  netSalaryGradient: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  netSalaryLabel: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: spacing.sm,
  },
  netSalaryValue: {
    fontSize: 32,
    fontWeight: fontWeight.bold,
    color: '#FFF',
  },
});
