// Modern Home Screen - Clean minimal design
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getProfile, getLeaveBalance, getAttendanceSummary } from '../services/api';
import { colors, spacing, fontSize, radius, iconSize } from '../theme';

export default function HomeScreen() {
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const insets = useSafeAreaInsets();
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

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
  };

  const totalLeaves = leaveBalance 
    ? (leaveBalance.casual_leaves?.available || 0) + 
      (leaveBalance.sick_leaves?.available || 0) + 
      (leaveBalance.earned_leaves?.available || 0)
    : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.userName}>{profile?.name || user?.name || 'User'}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.iconBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={iconSize.lg} color={colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.avatarBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            <Text style={styles.avatarText}>{getInitials(profile?.name || user?.name || '')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary.default} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.primary.light }]}>
            <Text style={[styles.statValue, { color: colors.primary.default }]}>{attendance?.present_days || 0}</Text>
            <Text style={styles.statLabel}>Present</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.status.successBg }]}>
            <Text style={[styles.statValue, { color: colors.status.success }]}>{totalLeaves}</Text>
            <Text style={styles.statLabel}>Leaves</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.status.infoBg }]}>
            <Text style={[styles.statValue, { color: colors.status.info }]}>{attendance?.working_days || 0}</Text>
            <Text style={styles.statLabel}>Work Days</Text>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => navigation.navigate('Leave', { screen: 'LeaveApply' })}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.status.infoBg }]}>
                <Ionicons name="add" size={iconSize.lg} color={colors.status.info} />
              </View>
              <Text style={styles.actionLabel}>Apply Leave</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => navigation.navigate('Profile')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.primary.light }]}>
                <Ionicons name="person-outline" size={iconSize.md} color={colors.primary.default} />
              </View>
              <Text style={styles.actionLabel}>My Profile</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => navigation.navigate('HolidayCalendar')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.status.warningBg }]}>
                <Ionicons name="sunny-outline" size={iconSize.md} color={colors.status.warning} />
              </View>
              <Text style={styles.actionLabel}>Holidays</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.actionCard}
              onPress={() => navigation.navigate('Settings')}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.background.tertiary }]}>
                <Ionicons name="settings-outline" size={iconSize.md} color={colors.text.secondary} />
              </View>
              <Text style={styles.actionLabel}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Leave Balance */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Leave Balance</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Leave')}>
              <Text style={styles.seeAll}>See all</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.leaveCard}>
            <View style={styles.leaveRow}>
              <LeaveItem 
                label="Casual" 
                available={leaveBalance?.casual_leaves?.available || 0} 
                total={leaveBalance?.casual_leaves?.total || 12}
                color={colors.status.warning}
              />
              <LeaveItem 
                label="Sick" 
                available={leaveBalance?.sick_leaves?.available || 0} 
                total={leaveBalance?.sick_leaves?.total || 12}
                color={colors.status.error}
              />
              <LeaveItem 
                label="Earned" 
                available={leaveBalance?.earned_leaves?.available || 0} 
                total={leaveBalance?.earned_leaves?.total || 15}
                color={colors.primary.default}
              />
            </View>
          </View>
        </View>

        {/* Role Badge */}
        <View style={styles.roleSection}>
          <View style={styles.roleCard}>
            <View style={styles.roleIcon}>
              <Ionicons name="briefcase-outline" size={iconSize.md} color={colors.primary.default} />
            </View>
            <View style={styles.roleInfo}>
              <Text style={styles.roleLabel}>{profile?.role_name || 'Employee'}</Text>
              <Text style={styles.roleSubtext}>{profile?.department_name || 'WiseDrive'}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

// Leave Item Component
const LeaveItem = ({ label, available, total, color }: { label: string; available: number; total: number; color: string }) => (
  <View style={styles.leaveItem}>
    <View style={[styles.leaveIndicator, { backgroundColor: color }]} />
    <Text style={styles.leaveLabel}>{label}</Text>
    <Text style={styles.leaveValue}>{available}<Text style={styles.leaveTotal}>/{total}</Text></Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    backgroundColor: colors.background.primary,
  },
  headerLeft: {},
  greeting: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
  },
  userName: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background.tertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary.default,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: colors.text.inverse,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: radius.lg,
    alignItems: 'center',
  },
  statValue: {
    fontSize: fontSize.xxl,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text.primary,
    marginBottom: spacing.md,
  },
  seeAll: {
    fontSize: fontSize.sm,
    color: colors.primary.default,
    fontWeight: '500',
    marginBottom: spacing.md,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionCard: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  actionIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    fontSize: fontSize.sm,
    fontWeight: '500',
    color: colors.text.primary,
    marginLeft: spacing.sm,
  },
  leaveCard: {
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  leaveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  leaveItem: {
    alignItems: 'center',
  },
  leaveIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginBottom: spacing.xs,
  },
  leaveLabel: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
  },
  leaveValue: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text.primary,
    marginTop: 2,
  },
  leaveTotal: {
    fontSize: fontSize.sm,
    fontWeight: '400',
    color: colors.text.tertiary,
  },
  roleSection: {
    marginTop: spacing.sm,
  },
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  roleIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primary.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleInfo: {
    marginLeft: spacing.md,
  },
  roleLabel: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: colors.text.primary,
  },
  roleSubtext: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
    marginTop: 2,
  },
});
