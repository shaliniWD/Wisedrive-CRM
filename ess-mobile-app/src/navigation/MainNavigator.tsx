// WiseDrive ESS - Main Navigator (No Footer Tabs)
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

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

const Stack = createNativeStackNavigator();

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {/* Home is the main hub - all navigation starts here */}
      <Stack.Screen name="Home" component={HomeScreen} />
      
      {/* Leave Management */}
      <Stack.Screen name="Leave" component={LeaveScreen} />
      <Stack.Screen name="LeaveApply" component={LeaveApplyScreen} />
      <Stack.Screen name="LeaveDetail" component={LeaveDetailScreen} />
      <Stack.Screen name="Approvals" component={ApprovalsScreen} />
      
      {/* Payslips */}
      <Stack.Screen name="Payslips" component={PayslipsScreen} />
      <Stack.Screen name="PayslipDetail" component={PayslipDetailScreen} />
      
      {/* Documents & Holidays */}
      <Stack.Screen name="Documents" component={DocumentsScreen} />
      <Stack.Screen name="HolidayCalendar" component={HolidayCalendarScreen} />
      
      {/* Profile & Settings */}
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
