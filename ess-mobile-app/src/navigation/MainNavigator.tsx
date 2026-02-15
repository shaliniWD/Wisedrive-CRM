// Main Navigator - Tab-based navigation for authenticated users
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { View, Text, StyleSheet } from 'react-native';

import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';

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

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Stack navigators for each tab
function HomeStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="HomeMain" 
        component={HomeScreen} 
        options={{ title: 'Home' }}
      />
      <Stack.Screen 
        name="Profile" 
        component={ProfileScreen} 
        options={{ title: 'My Profile' }}
      />
      <Stack.Screen 
        name="Settings" 
        component={SettingsScreen} 
        options={{ title: 'Settings' }}
      />
    </Stack.Navigator>
  );
}

function LeaveStack() {
  const { user } = useAuth();
  
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="LeaveMain" 
        component={LeaveScreen} 
        options={{ title: 'Leave' }}
      />
      <Stack.Screen 
        name="LeaveApply" 
        component={LeaveApplyScreen} 
        options={{ title: 'Apply Leave' }}
      />
      <Stack.Screen 
        name="LeaveDetail" 
        component={LeaveDetailScreen} 
        options={{ title: 'Leave Details' }}
      />
      {user?.is_approver && (
        <Stack.Screen 
          name="Approvals" 
          component={ApprovalsScreen} 
          options={{ title: 'Pending Approvals' }}
        />
      )}
    </Stack.Navigator>
  );
}

function PayslipsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="PayslipsMain" 
        component={PayslipsScreen} 
        options={{ title: 'Payslips' }}
      />
      <Stack.Screen 
        name="PayslipDetail" 
        component={PayslipDetailScreen} 
        options={{ title: 'Payslip Details' }}
      />
    </Stack.Navigator>
  );
}

function NotificationsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="NotificationsMain" 
        component={NotificationsScreen} 
        options={{ title: 'Notifications' }}
      />
    </Stack.Navigator>
  );
}

function DocumentsStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen 
        name="DocumentsMain" 
        component={DocumentsScreen} 
        options={{ title: 'Documents' }}
      />
    </Stack.Navigator>
  );
}

// Badge component for notifications
function NotificationBadge() {
  const { unreadCount } = useNotifications();
  
  if (unreadCount === 0) return null;
  
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>
        {unreadCount > 99 ? '99+' : unreadCount}
      </Text>
    </View>
  );
}

export default function MainNavigator() {
  const { unreadCount } = useNotifications();
  
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap = 'home';
          
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Leave') {
            iconName = focused ? 'calendar' : 'calendar-outline';
          } else if (route.name === 'Payslips') {
            iconName = focused ? 'wallet' : 'wallet-outline';
          } else if (route.name === 'Documents') {
            iconName = focused ? 'document-text' : 'document-text-outline';
          } else if (route.name === 'Notifications') {
            iconName = focused ? 'notifications' : 'notifications-outline';
          }
          
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: '#2196F3',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Leave" component={LeaveStack} />
      <Tab.Screen name="Payslips" component={PayslipsStack} />
      <Tab.Screen name="Documents" component={DocumentsStack} />
      <Tab.Screen 
        name="Notifications" 
        component={NotificationsStack}
        options={{
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
        }}
      />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    right: -6,
    top: -3,
    backgroundColor: '#F44336',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
});
