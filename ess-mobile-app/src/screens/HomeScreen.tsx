// Modern Home Dashboard Screen
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { getProfile, getLeaveBalance, getAttendanceSummary } from '../services/api';
import { colors, spacing, borderRadius, shadows } from '../theme';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ['profile'],
    queryFn: getProfile,
  });

  const { data: leaveBalance } = useQuery({
    queryKey: ['leaveBalance'],
    queryFn: () => getLeaveBalance(),
  });

  const { data: attendance } = useQuery({
    queryKey: ['attendance'],
    queryFn: () => getAttendanceSummary(),
  });

  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries();
    setRefreshing(false);
  };

  const totalLeaves = leaveBalance 
    ? (leaveBalance.casual_leaves?.available || 0) + 
      (leaveBalance.sick_leaves?.available || 0) + 
      (leaveBalance.earned_leaves?.available || 0)
    : 0;

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.default} />}
    >
      {/* Header Section */}
      <LinearGradient
        colors={[colors.primary.default, colors.secondary.default]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerTop}>
            <View style={styles.greetingSection}>
              <Text style={styles.greetingText}>{getGreeting()}</Text>
              <Text style={styles.userName}>{profile?.name || user?.name || 'User'}</Text>
              <Text style={styles.userRole}>{profile?.role_name || user?.role || 'Employee'}</Text>
            </View>
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={() => navigation.navigate('Profile')}
            >
              {profile?.photo_url ? (
                <Image source={{ uri: profile.photo_url }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarText}>{getInitials(profile?.name || user?.name || '')}</Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          
          {/* Quick Stats Row */}
          <View style={styles.quickStatsRow}>
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>{attendance?.present_days || 0}</Text>
              <Text style={styles.quickStatLabel}>Present</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>{totalLeaves}</Text>
              <Text style={styles.quickStatLabel}>Leaves Left</Text>
            </View>
            <View style={styles.quickStatDivider} />
            <View style={styles.quickStat}>
              <Text style={styles.quickStatValue}>{attendance?.working_days || 0}</Text>
              <Text style={styles.quickStatLabel}>Work Days</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* Main Content */}
      <View style={styles.mainContent}>
        {/* Bento Grid */}
        <View style={styles.bentoGrid}>
          {/* Leave Balance Card - Large */}
          <TouchableOpacity 
            style={[styles.bentoCard, styles.bentoCardLarge]}
            onPress={() => navigation.navigate('Leave')}
            activeOpacity={0.7}
          >
            <View style={styles.bentoCardHeader}>
              <View style={[styles.bentoIconContainer, { backgroundColor: colors.status.infoLight }]}>
                <Ionicons name="calendar" size={22} color={colors.status.info} />
              </View>
              <Ionicons name="chevron-forward" size={20} color={colors.text.muted} />
            </View>
            <Text style={styles.bentoCardTitle}>Leave Balance</Text>
            <View style={styles.leaveBalanceGrid}>
              <View style={styles.leaveBalanceItem}>
                <Text style={styles.leaveBalanceValue}>{leaveBalance?.casual_leaves?.available || 0}</Text>
                <Text style={styles.leaveBalanceLabel}>Casual</Text>
              </View>
              <View style={styles.leaveBalanceItem}>
                <Text style={styles.leaveBalanceValue}>{leaveBalance?.sick_leaves?.available || 0}</Text>
                <Text style={styles.leaveBalanceLabel}>Sick</Text>
              </View>
              <View style={styles.leaveBalanceItem}>
                <Text style={styles.leaveBalanceValue}>{leaveBalance?.earned_leaves?.available || 0}</Text>
                <Text style={styles.leaveBalanceLabel}>Earned</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Payslips Card */}
          <TouchableOpacity 
            style={styles.bentoCard}
            onPress={() => navigation.navigate('Payslips')}
            activeOpacity={0.7}
          >
            <View style={[styles.bentoIconContainer, { backgroundColor: colors.status.successLight }]}>
              <Ionicons name="wallet" size={22} color={colors.status.success} />
            </View>
            <Text style={styles.bentoCardTitle}>Payslips</Text>
            <Text style={styles.bentoCardSubtitle}>View salary slips</Text>
          </TouchableOpacity>

          {/* Profile Card */}
          <TouchableOpacity 
            style={styles.bentoCard}
            onPress={() => navigation.navigate('Profile')}
            activeOpacity={0.7}
          >
            <View style={[styles.bentoIconContainer, { backgroundColor: colors.primary.light }]}>
              <Ionicons name="person" size={22} color={colors.primary.default} />
            </View>
            <Text style={styles.bentoCardTitle}>My Profile</Text>
            <Text style={styles.bentoCardSubtitle}>Personal details</Text>
          </TouchableOpacity>

          {/* Documents Card */}
          <TouchableOpacity 
            style={styles.bentoCard}
            onPress={() => navigation.navigate('Documents')}
            activeOpacity={0.7}
          >
            <View style={[styles.bentoIconContainer, { backgroundColor: colors.status.warningLight }]}>
              <Ionicons name="document-text" size={22} color={colors.status.warning} />
            </View>
            <Text style={styles.bentoCardTitle}>Documents</Text>
            <Text style={styles.bentoCardSubtitle}>View & upload</Text>
          </TouchableOpacity>

          {/* Holidays Card */}
          <TouchableOpacity 
            style={styles.bentoCard}
            onPress={() => navigation.navigate('HolidayCalendar')}
            activeOpacity={0.7}
          >
            <View style={[styles.bentoIconContainer, { backgroundColor: colors.accent.light }]}>
              <Ionicons name="sunny" size={22} color={colors.accent.default} />
            </View>
            <Text style={styles.bentoCardTitle}>Holidays</Text>
            <Text style={styles.bentoCardSubtitle}>Calendar view</Text>
          </TouchableOpacity>

          {/* Notifications Card */}
          <TouchableOpacity 
            style={styles.bentoCard}
            onPress={() => navigation.navigate('Notifications')}
            activeOpacity={0.7}
          >
            <View style={[styles.bentoIconContainer, { backgroundColor: colors.secondary.light }]}>
              <Ionicons name="notifications" size={22} color={colors.secondary.default} />
            </View>
            <Text style={styles.bentoCardTitle}>Alerts</Text>
            <Text style={styles.bentoCardSubtitle}>Notifications</Text>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsRow}>
            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => navigation.navigate('Leave', { screen: 'LeaveApply' })}
            >
              <LinearGradient
                colors={[colors.primary.default, colors.secondary.default]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.quickActionGradient}
              >
                <Ionicons name="add-circle" size={24} color="#FFFFFF" />
              </LinearGradient>
              <Text style={styles.quickActionText}>Apply Leave</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.quickActionButton}
              onPress={() => navigation.navigate('Settings')}
            >
              <View style={styles.quickActionIcon}>
                <Ionicons name="settings" size={24} color={colors.text.secondary} />
              </View>
              <Text style={styles.quickActionText}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

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
  headerContent: {
    paddingHorizontal: spacing.xl,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.xl,
  },
  greetingSection: {
    flex: 1,
  },
  greetingText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: spacing.xs,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: spacing.xs,
  },
  userRole: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  avatarContainer: {
    marginLeft: spacing.lg,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickStatsRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
  },
  quickStat: {
    flex: 1,
    alignItems: 'center',
  },
  quickStatValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  quickStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  quickStatDivider: {
    width: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: spacing.lg,
  },
  mainContent: {
    paddingHorizontal: spacing.lg,
    marginTop: -spacing.lg,
  },
  bentoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginTop: spacing.xl,
  },
  bentoCard: {
    width: '48%',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.md,
  },
  bentoCardLarge: {
    width: '100%',
  },
  bentoCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  bentoIconContainer: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  bentoCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  bentoCardSubtitle: {
    fontSize: 13,
    color: colors.text.muted,
  },
  leaveBalanceGrid: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    gap: spacing.xl,
  },
  leaveBalanceItem: {
    alignItems: 'center',
  },
  leaveBalanceValue: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary.default,
  },
  leaveBalanceLabel: {
    fontSize: 12,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
  section: {
    marginTop: spacing.xxl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.lg,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickActionButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.background.card,
    borderRadius: borderRadius.xl,
    padding: spacing.lg,
    ...shadows.sm,
  },
  quickActionGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.background.subtle,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text.secondary,
  },
});
