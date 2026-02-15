// Modern Main Navigator - Clean minimal design
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { useAuth } from '../context/AuthContext';
import { colors, spacing, fontSize, radius, iconSize } from '../theme';

// Screens
import HomeScreen from '../screens/HomeScreen';
import LeaveScreen from '../screens/LeaveScreen';
import LeaveApplyScreen from '../screens/LeaveApplyScreen';
import LeaveDetailScreen from '../screens/LeaveDetailScreen';
import ApprovalsScreen from '../screens/ApprovalsScreen';
import PayslipsScreen from '../screens/PayslipsScreen';
import PayslipDetailScreen from '../screens/PayslipDetailScreen';
import DocumentsScreen from '../screens/DocumentsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SettingsScreen from '../screens/SettingsScreen';
import HolidayCalendarScreen from '../screens/HolidayCalendarScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Custom Header Component
const CustomHeader = ({ title, showBack = false }: { title: string; showBack?: boolean }) => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuth();

  const getInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'U';
  };

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <View style={styles.headerLeft}>
        {showBack ? (
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerIconBtn}>
            <Ionicons name="chevron-back" size={iconSize.lg} color={colors.text.primary} />
          </TouchableOpacity>
        ) : null}
        <Text style={styles.headerTitle}>{title}</Text>
      </View>
      
      <View style={styles.headerRight}>
        <TouchableOpacity 
          onPress={() => navigation.navigate('Notifications')} 
          style={styles.headerIconBtn}
        >
          <Ionicons name="notifications-outline" size={iconSize.md} color={colors.text.secondary} />
        </TouchableOpacity>
        <TouchableOpacity 
          onPress={() => navigation.navigate('Profile')} 
          style={styles.avatarBtn}
        >
          <Text style={styles.avatarText}>{getInitials(user?.name || '')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// Stack Navigators
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="HomeMain" component={HomeScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="HolidayCalendar" component={HolidayCalendarScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}

function LeaveStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="LeaveMain" component={LeaveScreen} />
      <Stack.Screen name="LeaveApply" component={LeaveApplyScreen} />
      <Stack.Screen name="LeaveDetail" component={LeaveDetailScreen} />
      <Stack.Screen name="Approvals" component={ApprovalsScreen} />
    </Stack.Navigator>
  );
}

function PayslipsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PayslipsMain" component={PayslipsScreen} />
      <Stack.Screen name="PayslipDetail" component={PayslipDetailScreen} />
    </Stack.Navigator>
  );
}

function MoreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MoreMain" component={MoreScreen} />
      <Stack.Screen name="Documents" component={DocumentsScreen} />
      <Stack.Screen name="HolidayCalendar" component={HolidayCalendarScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
    </Stack.Navigator>
  );
}

// More Screen - Hub for additional features
function MoreScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const menuItems = [
    { icon: 'document-text-outline', label: 'Documents', screen: 'Documents', color: colors.status.info },
    { icon: 'calendar-outline', label: 'Holidays', screen: 'HolidayCalendar', color: colors.status.success },
    { icon: 'settings-outline', label: 'Settings', screen: 'Settings', color: colors.text.secondary },
  ];

  return (
    <View style={[styles.moreContainer, { paddingTop: insets.top }]}>
      <View style={styles.moreHeader}>
        <Text style={styles.moreTitle}>More</Text>
      </View>
      <View style={styles.moreList}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.moreItem}
            onPress={() => navigation.navigate(item.screen)}
            activeOpacity={0.7}
          >
            <View style={[styles.moreItemIcon, { backgroundColor: `${item.color}15` }]}>
              <Ionicons name={item.icon as any} size={iconSize.lg} color={item.color} />
            </View>
            <Text style={styles.moreItemLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={iconSize.sm} color={colors.text.tertiary} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// Custom Tab Bar
function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {state.routes.map((route: any, index: number) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;

        const iconMap: Record<string, string> = {
          Home: 'home',
          Leave: 'calendar',
          Payslips: 'wallet',
          More: 'grid',
        };

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TouchableOpacity
            key={index}
            onPress={onPress}
            style={styles.tabItem}
            activeOpacity={0.7}
          >
            <View style={[styles.tabIconContainer, isFocused && styles.tabIconActive]}>
              <Ionicons
                name={(isFocused ? iconMap[route.name] : `${iconMap[route.name]}-outline`) as any}
                size={iconSize.lg}
                color={isFocused ? colors.primary.default : colors.text.tertiary}
              />
            </View>
            <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
              {route.name}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export default function MainNavigator() {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Leave" component={LeaveStack} />
      <Tab.Screen name="Payslips" component={PayslipsStack} />
      <Tab.Screen name="More" component={MoreStack} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.background.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerIconBtn: {
    padding: spacing.xs,
    marginRight: spacing.xs,
  },
  headerTitle: {
    fontSize: fontSize.lg,
    fontWeight: '600',
    color: colors.text.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  avatarBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary.light,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    color: colors.primary.default,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.background.primary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  tabIconContainer: {
    width: 40,
    height: 28,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabIconActive: {
    backgroundColor: colors.primary.light,
  },
  tabLabel: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginTop: 2,
  },
  tabLabelActive: {
    color: colors.primary.default,
    fontWeight: '500',
  },
  moreContainer: {
    flex: 1,
    backgroundColor: colors.background.secondary,
  },
  moreHeader: {
    padding: spacing.lg,
    backgroundColor: colors.background.primary,
  },
  moreTitle: {
    fontSize: fontSize.xl,
    fontWeight: '600',
    color: colors.text.primary,
  },
  moreList: {
    padding: spacing.lg,
  },
  moreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  moreItemIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreItemLabel: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: '500',
    color: colors.text.primary,
    marginLeft: spacing.md,
  },
});
