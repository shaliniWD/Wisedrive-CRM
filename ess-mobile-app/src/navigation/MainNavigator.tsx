// Professional Main Navigator - Light Theme with Clean Tab Bar
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

import { colors, spacing, fontSize, fontWeight, radius, iconSize, shadows } from '../theme';

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
    { icon: 'folder-outline', label: 'Documents', screen: 'Documents', color: colors.accent },
    { icon: 'sunny-outline', label: 'Holidays', screen: 'HolidayCalendar', color: colors.warning },
    { icon: 'settings-outline', label: 'Settings', screen: 'Settings', color: colors.secondary },
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
            testID={`more-${item.label.toLowerCase()}`}
            style={styles.moreItem}
            onPress={() => navigation.navigate(item.screen)}
            activeOpacity={0.7}
          >
            <View style={[styles.moreItemIcon, { backgroundColor: `${item.color}15` }]}>
              <Ionicons name={item.icon as any} size={iconSize.lg} color={item.color} />
            </View>
            <Text style={styles.moreItemLabel}>{item.label}</Text>
            <Ionicons name="chevron-forward" size={iconSize.md} color={colors.text.tertiary} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

// Custom Tab Bar - Clean Light Theme
function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();

  const tabs = [
    { name: 'Home', icon: 'home' },
    { name: 'Leave', icon: 'calendar' },
    { name: 'Payslips', icon: 'wallet' },
    { name: 'More', icon: 'apps' },
  ];

  return (
    <View style={[styles.tabBarWrapper, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      <View style={styles.tabBarContainer}>
        {state.routes.map((route: any, index: number) => {
          const isFocused = state.index === index;
          const tab = tabs.find(t => t.name === route.name) || tabs[0];

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
              testID={`tab-${route.name.toLowerCase()}`}
              onPress={onPress}
              style={styles.tabItem}
              activeOpacity={0.7}
            >
              <View style={[styles.tabIconContainer, isFocused && styles.tabIconActive]}>
                <Ionicons 
                  name={(isFocused ? tab.icon : `${tab.icon}-outline`) as any}
                  size={iconSize.lg} 
                  color={isFocused ? colors.primary : colors.text.tertiary} 
                />
              </View>
              <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>
                {tab.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
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
  // Tab Bar
  tabBarWrapper: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.background,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  tabBarContainer: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  tabIconContainer: {
    width: 40,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radius.md,
  },
  tabIconActive: {
    backgroundColor: colors.primaryLight,
  },
  tabLabel: {
    fontSize: fontSize.xs,
    color: colors.text.tertiary,
    marginTop: spacing.xs,
    fontWeight: fontWeight.medium,
  },
  tabLabelActive: {
    color: colors.primary,
  },
  // More Screen
  moreContainer: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  moreHeader: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    backgroundColor: colors.background,
  },
  moreTitle: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.semibold,
    color: colors.text.primary,
  },
  moreList: {
    padding: spacing.xl,
  },
  moreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  moreItemIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  moreItemLabel: {
    flex: 1,
    fontSize: fontSize.base,
    fontWeight: fontWeight.medium,
    color: colors.text.primary,
    marginLeft: spacing.md,
  },
});
