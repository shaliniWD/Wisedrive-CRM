// Push Notification Service
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { registerPushToken } from './api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushNotificationResult {
  token: string | null;
  error: string | null;
}

export async function registerForPushNotifications(deviceId: string): Promise<PushNotificationResult> {
  let token: string | null = null;
  let error: string | null = null;

  if (!Device.isDevice) {
    error = 'Push notifications require a physical device';
    return { token, error };
  }

  try {
    // Check permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      error = 'Permission not granted for push notifications';
      return { token, error };
    }

    // Get push token
    const pushToken = await Notifications.getExpoPushTokenAsync({
      projectId: 'your-eas-project-id', // Replace with your project ID
    });
    
    token = pushToken.data;

    // Register with backend
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await registerPushToken(deviceId, token, platform);

    // Android channel setup
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('ess_notifications', {
        name: 'ESS Notifications',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2196F3',
        sound: 'default',
      });
    }
  } catch (e: any) {
    error = e.message || 'Failed to register for push notifications';
    console.error('Push registration error:', e);
  }

  return { token, error };
}

export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export async function getBadgeCount(): Promise<number> {
  return await Notifications.getBadgeCountAsync();
}

export async function setBadgeCount(count: number): Promise<void> {
  await Notifications.setBadgeCountAsync(count);
}

export async function dismissAllNotifications(): Promise<void> {
  await Notifications.dismissAllNotificationsAsync();
}
