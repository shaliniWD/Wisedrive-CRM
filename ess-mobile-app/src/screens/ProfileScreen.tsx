// Premium Profile Screen - Dark Theme
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getProfile, getBankDetails, getSalarySummary } from '../services/api';
import { colors, spacing, fontSize, fontWeight, radius, iconSize } from '../theme';

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const tabs: { key: TabType; label: string; icon: any }[] = [
    { key: 'personal', label: 'Personal', icon: 'person-outline' },
    { key: 'bank', label: 'Bank', icon: 'card-outline' },
    { key: 'salary', label: 'Salary', icon: 'wallet-outline' },
  ];

  const isLoading = profileLoading || (activeTab === 'bank' && bankLoading) || (activeTab === 'salary' && salaryLoading);

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
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity
          testID="settings-btn"
          style={styles.settingsBtn}
          onPress={() => navigation.navigate('Settings')}
        >
          <Ionicons name="settings-outline" size={iconSize.lg} color={colors.text.secondary} />
        </TouchableOpacity>
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
          <LinearGradient
            colors={colors.gradients.surface}
            style={styles.profileGradient}
          >
            <View style={styles.avatarContainer}>
              <LinearGradient colors={colors.gradients.primary} style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {getInitials(profile?.name || user?.name || '')}
                </Text>
              </LinearGradient>
            </View>
            <Text style={styles.profileName}>{profile?.name || user?.name || 'User'}</Text>
            <Text style={styles.profileEmail}>{profile?.email || user?.email || ''}</Text>
            <View style={styles.profileBadge}>
              <Ionicons name="briefcase" size={14} color={colors.primary} />
              <Text style={styles.profileRole}>{profile?.role_name || 'Employee'}</Text>
            </View>
          </LinearGradient>
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
          <View style={styles.tabContent}>
            {activeTab === 'personal' && (
              <>
                <InfoRow icon="id-card-outline" label="Employee ID" value={profile?.employee_code || '-'} />
                <InfoRow icon="call-outline" label="Phone" value={profile?.phone || '-'} />
                <InfoRow icon="business-outline" label="Department" value={profile?.department_name || '-'} />
                <InfoRow icon="location-outline" label="Location" value={profile?.location || profile?.country_name || '-'} />
                <InfoRow icon="calendar-outline" label="Join Date" value={profile?.join_date || '-'} />
              </>
            )}
            {activeTab === 'bank' && (
              <>
                <InfoRow icon="card-outline" label="Account Number" value={bankDetails?.account_number ? `****${bankDetails.account_number.slice(-4)}` : '-'} />
                <InfoRow icon="business-outline" label="Bank Name" value={bankDetails?.bank_name || '-'} />
                <InfoRow icon="git-branch-outline" label="Branch" value={bankDetails?.branch_name || '-'} />
                <InfoRow icon="barcode-outline" label="IFSC Code" value={bankDetails?.ifsc_code || '-'} />
                <InfoRow icon="person-outline" label="Account Holder" value={bankDetails?.account_holder_name || '-'} />
              </>
            )}
            {activeTab === 'salary' && (
              <>
                <InfoRow icon="cash-outline" label="Gross Salary" value={formatCurrency(salary?.gross_salary || 0)} highlight />
                <InfoRow icon="wallet-outline" label="Net Salary" value={formatCurrency(salary?.net_salary || 0)} highlight />
                <InfoRow icon="home-outline" label="Basic" value={formatCurrency(salary?.basic || 0)} />
                <InfoRow icon="car-outline" label="HRA" value={formatCurrency(salary?.hra || 0)} />
                <InfoRow icon="briefcase-outline" label="Allowances" value={formatCurrency(salary?.allowances || 0)} />
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const InfoRow = ({ 
  icon, 
  label, 
  value, 
  highlight = false 
}: { 
  icon: any; 
  label: string; 
  value: string; 
  highlight?: boolean;
}) => (
  <View style={styles.infoRow}>
    <View style={styles.infoIcon}>
      <Ionicons name={icon} size={16} color={colors.text.tertiary} />
    </View>
    <View style={styles.infoContent}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, highlight && styles.infoValueHighlight]}>{value}</Text>
    </View>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
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
  settingsBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  scrollContent: {
    padding: spacing.xl,
    paddingTop: 0,
    paddingBottom: spacing.xxxxl,
  },
  // Profile Card
  profileCard: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.xl,
  },
  profileGradient: {
    padding: spacing.xxl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
  },
  avatarContainer: {
    marginBottom: spacing.lg,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: 'center',
    alignItems: 'center',
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
    backgroundColor: `${colors.primary}20`,
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
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.xs,
    marginBottom: spacing.xl,
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
    backgroundColor: colors.surfaceHighlight,
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
    backgroundColor: colors.surface,
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
    backgroundColor: colors.surfaceHighlight,
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
  infoValueHighlight: {
    color: colors.success,
    fontWeight: fontWeight.semibold,
  },
});
