// Auth Context - Manages authentication state
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { 
  login as apiLogin, 
  logout as apiLogout,
  saveAuth, 
  clearAuth, 
  getStoredUser,
  getDeviceId 
} from '../services/api';
import { queryClient } from '../../App';

interface User {
  id: string;
  email: string;
  name: string;
  employee_code: string;
  photo_url?: string;
  role: string;
  role_code: string;
  country_name: string;
  is_approver: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for stored auth on app start
    checkStoredAuth();
  }, []);

  const checkStoredAuth = async () => {
    try {
      const storedUser = await getStoredUser();
      if (storedUser) {
        setUser(storedUser);
      }
    } catch (error) {
      console.error('Error checking stored auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const deviceId = await getDeviceId();
      
      const deviceInfo = {
        device_id: deviceId,
        device_name: Device.modelName || 'Unknown Device',
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
        os_version: Device.osVersion || 'Unknown',
        app_version: '1.0.0',
      };

      const response = await apiLogin(email, password, deviceInfo);
      
      await saveAuth(
        response.access_token,
        response.refresh_token,
        deviceId,
        response.user
      );

      setUser(response.user);
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.response?.data?.detail || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      const deviceId = await getDeviceId();
      await apiLogout(deviceId);
    } catch (error) {
      console.error('Logout API error:', error);
    } finally {
      // Clear all cached data when user logs out
      queryClient.clear();
      await clearAuth();
      setUser(null);
    }
  };

  const refreshUser = async () => {
    const storedUser = await getStoredUser();
    if (storedUser) {
      setUser(storedUser);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
