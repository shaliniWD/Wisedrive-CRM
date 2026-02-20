import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '../src/context/AuthContext';
import { InspectionProvider } from '../src/context/InspectionContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <InspectionProvider>
          <StatusBar style="dark" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#F8FAFC' },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="home" />
            <Stack.Screen name="scanner" />
            <Stack.Screen name="profile" />
            <Stack.Screen name="verify-vehicle/[id]" />
            <Stack.Screen name="inspection-categories" />
            <Stack.Screen name="start-inspection/[id]" />
            <Stack.Screen name="vehicle-details/[id]" />
            <Stack.Screen name="checklist/[id]" />
            <Stack.Screen name="category/[inspectionId]/[categoryId]" />
            <Stack.Screen name="obd-scan/[id]" />
            <Stack.Screen name="obd-results/[id]" />
            <Stack.Screen name="scan-detail/[id]" />
          </Stack>
        </InspectionProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
