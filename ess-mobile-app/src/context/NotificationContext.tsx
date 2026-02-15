// Notification Context - Manages push notifications
import React, { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { 
  registerForPushNotifications,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  setBadgeCount
} from '../services/notifications';
import { getDeviceId, getUnreadCount } from '../services/api';
import { useAuth } from './AuthContext';

interface NotificationContextType {
  expoPushToken: string | null;
  unreadCount: number;
  notification: Notifications.Notification | null;
  refreshUnreadCount: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notification, setNotification] = useState<Notifications.Notification | null>(null);
  
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();
  
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated) {
      // Register for push notifications
      registerPush();
      
      // Fetch unread count
      refreshUnreadCount();
      
      // Set up notification listeners
      notificationListener.current = addNotificationReceivedListener(notification => {
        setNotification(notification);
        refreshUnreadCount();
      });

      responseListener.current = addNotificationResponseListener(response => {
        console.log('Notification response:', response);
        // Handle notification tap - navigate to relevant screen
        const data = response.notification.request.content.data;
        handleNotificationTap(data);
      });

      return () => {
        if (notificationListener.current) {
          Notifications.removeNotificationSubscription(notificationListener.current);
        }
        if (responseListener.current) {
          Notifications.removeNotificationSubscription(responseListener.current);
        }
      };
    }
  }, [isAuthenticated]);

  const registerPush = async () => {
    const deviceId = await getDeviceId();
    const result = await registerForPushNotifications(deviceId);
    if (result.token) {
      setExpoPushToken(result.token);
    }
    if (result.error) {
      console.warn('Push registration warning:', result.error);
    }
  };

  const refreshUnreadCount = async () => {
    try {
      const response = await getUnreadCount();
      const count = response.unread_count || 0;
      setUnreadCount(count);
      await setBadgeCount(count);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const handleNotificationTap = (data: any) => {
    // Navigation will be handled by the navigator
    // This data will include action_url or type to determine destination
    console.log('Notification data:', data);
  };

  return (
    <NotificationContext.Provider
      value={{
        expoPushToken,
        unreadCount,
        notification,
        refreshUnreadCount,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
