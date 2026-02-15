// Premium Home Screen - Dark Theme Dashboard
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
            colors={[colors.primary]}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        {/* Stats Bento Grid */}
        <View style={styles.bentoGrid}>
          <View style={styles.bentoRow}>
            <View style={[styles.bentoCard, styles.bentoCardLarge]}>
              <LinearGradient
                colors={colors.gradients.primary}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bentoGradient}
              >
                <View style={styles.bentoContent}>
                  <Text style={styles.bentoLargeValue}>{attendance?.present_days || 0}</Text>
                  <Text style={styles.bentoLargeLabel}>Days Present</Text>
                </View>
                <View style={styles.bentoIconContainer}>
                  <Ionicons name="checkmark-circle" size={32} color="rgba(255,255,255,0.3)" />
                </View>
              </LinearGradient>
            </View>
            <View style={styles.bentoColumn}>
              <View style={[styles.bentoCard, styles.bentoCardSmall]}>
                <Text style={[styles.bentoSmallValue, { color: colors.success }]}>
                  {leaveBalance?.casual_leaves?.available || 0}
                </Text>
                <Text style={styles.bentoSmallLabel}>Casual</Text>
              </View>
              <View style={[styles.bentoCard, styles.bentoCardSmall]}>
                <Text style={[styles.bentoSmallValue, { color: colors.warning }]}>
                  {leaveBalance?.sick_leaves?.available || 0}
                </Text>
                <Text style={styles.bentoSmallLabel}>Sick</Text>
              </View>
            </View>
          </View>
          <View style={styles.bentoRow}>
            <View style={[styles.bentoCard, styles.bentoCardMedium]}>
              <Text style={[styles.bentoSmallValue, { color: colors.accent }]}>
                {leaveBalance?.earned_leaves?.available || 0}
              </Text>
              <Text style={styles.bentoSmallLabel}>Earned Leaves</Text>
            </View>
            <View style={[styles.bentoCard, styles.bentoCardMedium]}>
              <Text style={[styles.bentoSmallValue, { color: colors.text.primary }]}>
                {attendance?.working_days || 0}
              </Text>
              <Text style={styles.bentoSmallLabel}>Working Days</Text>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsRow}>
            <QuickAction
              icon="add-circle-outline"
              label="Apply Leave"
              color={colors.primary}
              onPress={() => navigation.navigate('Leave', { screen: 'LeaveApply' })}
              testID="apply-leave-btn"
            />
            <QuickAction
              icon="document-text-outline"
              label="Payslips"
              color={colors.success}
              onPress={() => navigation.navigate('Payslips')}
              testID="payslips-btn"
            />
            <QuickAction
              icon="calendar-outline"
              label="Holidays"
              color={colors.warning}
              onPress={() => navigation.navigate('HolidayCalendar')}
              testID="holidays-btn"
            />
            <QuickAction
              icon="folder-outline"
              label="Documents"
              color={colors.accent}
              onPress={() => navigation.navigate('More', { screen: 'Documents' })}
              testID="documents-btn"
            />
          </View>
        </View>

        {/* Role Card */}
        <View style={styles.roleCard}>
          <View style={styles.roleIcon}>
            <Ionicons name="briefcase-outline" size={iconSize.lg} color={colors.primary} />
          </View>
          <View style={styles.roleInfo}>
            <Text style={styles.roleTitle}>{profile?.role_name || 'Employee'}</Text>
            <Text style={styles.roleDept}>{profile?.department_name || 'WiseDrive'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={iconSize.md} color={colors.text.tertiary} />
        </View>
      </ScrollView>
    </View>
  );
}

// Quick Action Component
const QuickAction = ({ 
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
    style={styles.actionItem}
    onPress={onPress}
    activeOpacity={0.7}
  >
    <View style={[styles.actionIconBg, { backgroundColor: `${color}20` }]}>
      <Ionicons name={icon} size={iconSize.lg} color={color} />
    </View>
    <Text style={styles.actionLabel}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
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
    paddingTop: spacing.sm,
    paddingBottom: spacing.xxxxl,
  },
  // Bento Grid
  bentoGrid: {
    marginBottom: spacing.xxl,
  },
  bentoRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  bentoColumn: {
    flex: 1,
    gap: spacing.md,
  },
  bentoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  bentoCardLarge: {
    flex: 1.5,
    overflow: 'hidden',
    padding: 0,
  },
  bentoGradient: {
    flex: 1,
    padding: spacing.lg,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 110,
  },
  bentoContent: {},
  bentoIconContainer: {
    position: 'absolute',
    right: spacing.lg,
    top: spacing.lg,
  },
  bentoLargeValue: {
    fontSize: fontSize.xxxl,
    fontWeight: fontWeight.bold,
    color: '#FFF',
  },
  bentoLargeLabel: {
    fontSize: fontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  bentoCardSmall: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bentoCardMedium: {
    flex: 1,
  },
  bentoSmallValue: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
  },
  bentoSmallLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    marginTop: spacing.xs,
  },
  // Section
  section: {
    marginBottom: spacing.xxl,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionItem: {
    alignItems: 'center',
    width: '22%',
  },
  actionIconBg: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  actionLabel: {
    fontSize: fontSize.xs,
    color: colors.text.secondary,
    textAlign: 'center',
  },
  // Role Card
  roleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  roleIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: `${colors.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  roleInfo: {
    flex: 1,
    marginLeft: spacing.md,
  },
  roleTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
  },
  roleDept: {
    fontSize: fontSize.sm,
    color: colors.text.secondary,
    marginTop: 2,
  },
});
