// WiseDrive ESS - Home Screen (Main Hub)
// All navigation starts from here - No footer tabs
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
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { getProfile, getLeaveBalance, getAttendanceSummary } from '../services/api';
import { colors, spacing, fontSize, fontWeight, radius, iconSize, shadows } from '../theme';

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

  const firstName = (profile?.name || user?.name || 'User').split(' ')[0];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.userName}>{firstName}</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            testID="notifications-btn"
            style={styles.iconBtn}
            onPress={() => navigation.navigate('Notifications')}
          >
            <Ionicons name="notifications-outline" size={iconSize.lg} color={colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity 
            testID="profile-btn"
            style={styles.avatarBtn}
            onPress={() => navigation.navigate('Profile')}
          >
            <LinearGradient colors={colors.gradients.primary} style={styles.avatarGradient}>
              <Text style={styles.avatarText}>{getInitials(profile?.name || user?.name || '')}</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
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
        {/* Attendance Stats Card */}
        <View style={styles.statsCard}>
          <LinearGradient
            colors={colors.gradients.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.statsGradient}
          >
            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{attendance?.present_days || 0}</Text>
                <Text style={styles.statLabel}>Present</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{attendance?.working_days || 0}</Text>
                <Text style={styles.statLabel}>Working Days</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {(leaveBalance?.casual_leaves?.available || 0) + 
                   (leaveBalance?.sick_leaves?.available || 0) + 
                   (leaveBalance?.earned_leaves?.available || 0)}
                </Text>
                <Text style={styles.statLabel}>Leaves Left</Text>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* Leave Balance Section - Main Feature */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Leave Balance</Text>
            <TouchableOpacity 
              testID="view-leaves-btn"
              onPress={() => navigation.navigate('Leave')}
            >
              <Text style={styles.seeAll}>View History</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.leaveGrid}>
            <LeaveCard 
              label="Casual" 
              available={leaveBalance?.casual_leaves?.available || 0}
              total={leaveBalance?.casual_leaves?.total || 12}
              color={colors.success}
            />
            <LeaveCard 
              label="Sick" 
              available={leaveBalance?.sick_leaves?.available || 0}
              total={leaveBalance?.sick_leaves?.total || 12}
              color={colors.warning}
            />
            <LeaveCard 
              label="Earned" 
              available={leaveBalance?.earned_leaves?.available || 0}
              total={leaveBalance?.earned_leaves?.total || 15}
              color={colors.primary}
            />
          </View>
          {/* Apply Leave Button */}
          <TouchableOpacity
            testID="apply-leave-btn"
            style={styles.applyLeaveBtn}
            onPress={() => navigation.navigate('LeaveApply')}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={colors.gradients.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.applyLeaveBtnGradient}
            >
              <Ionicons name="add-circle" size={iconSize.lg} color="#FFF" />
              <Text style={styles.applyLeaveBtnText}>Apply for Leave</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            <QuickActionCard
              icon="document-text-outline"
              label="Payslips"
              color={colors.success}
              onPress={() => navigation.navigate('Payslips')}
              testID="payslips-btn"
            />
            <QuickActionCard
              icon="folder-outline"
              label="Documents"
              color={colors.accent}
              onPress={() => navigation.navigate('Documents')}
              testID="documents-btn"
            />
            <QuickActionCard
              icon="sunny-outline"
              label="Holidays"
              color={colors.warning}
              onPress={() => navigation.navigate('HolidayCalendar')}
              testID="holidays-btn"
            />
            <QuickActionCard
              icon="settings-outline"
              label="Settings"
              color={colors.secondary}
              onPress={() => navigation.navigate('Settings')}
              testID="settings-btn"
            />
          </View>
        </View>

        {/* Bottom Padding */}
        <View style={{ height: spacing.xxxl }} />
      </ScrollView>
    </View>
  );
}

// Leave Card Component
const LeaveCard = ({ label, available, total, color }: { label: string; available: number; total: number; color: string }) => (
  <View style={styles.leaveCard}>
    <View style={[styles.leaveIndicator, { backgroundColor: color }]} />
    <Text style={styles.leaveLabel}>{label}</Text>
    <Text style={styles.leaveValue}>{available}<Text style={styles.leaveTotal}>/{total}</Text></Text>
  </View>
);

// Quick Action Card Component
const QuickActionCard = ({ 
  icon, 
  label, 
  color, 
  onPress, 
  testID 
}: { 
  icon: any; 
  label: string; 
  color: string; 
  onPress: () => void;
  testID: string;
}) => (
  <TouchableOpacity 
    testID={testID}
    style={styles.quickActionCard}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.quickActionIcon, { backgroundColor: `${color}15` }]}>
      <Ionicons name={icon} size={iconSize.xl} color={color} />
    </View>
    <Text style={styles.quickActionLabel}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background,
  },
  headerLeft: {},
  greeting: {
    fontSize: fontSize.sm,
    color: colors.text.tertiary,
  },
  userName: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  avatarBtn: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  avatarGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: '#FFF',
  },
  scrollContent: {
    padding: spacing.xl,
  },
  // Stats Card
  statsCard: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    marginBottom: spacing.xxl,
    ...shadows.lg,
  },
  statsGradient: {
    padding: spacing.xl,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  statValue: {
    fontSize: fontSize.xxl,
    fontWeight: fontWeight.bold,
    color: '#FFF',
  },
  statLabel: {
    fontSize: fontSize.xs,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  // Section
  section: {
    marginBottom: spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  seeAll: {
    fontSize: fontSize.sm,
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  // Leave Grid
  leaveGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  leaveCard: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  leaveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: spacing.sm,
  },
  leaveLabel: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginBottom: spacing.xs,
  },
  leaveValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.text.primary,
  },
  leaveTotal: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.regular,
    color: colors.text.tertiary,
  },
  // Apply Leave Button
  applyLeaveBtn: {
    borderRadius: radius.md,
    overflow: 'hidden',
    ...shadows.md,
  },
  applyLeaveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.lg,
    gap: spacing.sm,
  },
  applyLeaveBtnText: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
    color: '#FFF',
  },
  // Quick Actions Grid
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
  },
  quickActionCard: {
    width: '47%',
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  quickActionIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  quickActionLabel: {
    fontSize: fontSize.sm,
    color: colors.text.primary,
    fontWeight: fontWeight.medium,
  },
});
