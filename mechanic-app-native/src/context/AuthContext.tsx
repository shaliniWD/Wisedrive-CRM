import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface MechanicProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  inspection_cities?: string[];
  active: boolean;
}

interface AuthContextType {
  token: string | null;
  mechanic: MechanicProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, profile: MechanicProfile) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [mechanic, setMechanic] = useState<MechanicProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('authToken');
      const storedProfile = await AsyncStorage.getItem('mechanicProfile');
      
      if (storedToken && storedProfile) {
        setToken(storedToken);
        setMechanic(JSON.parse(storedProfile));
      }
    } catch (e) {
      console.log('Error loading auth:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (authToken: string, profile: MechanicProfile) => {
    await AsyncStorage.setItem('authToken', authToken);
    await AsyncStorage.setItem('mechanicProfile', JSON.stringify(profile));
    setToken(authToken);
    setMechanic(profile);
  };

  const logout = async () => {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('mechanicProfile');
    setToken(null);
    setMechanic(null);
  };

  const isAuthenticated = !!token && !!mechanic;

  return (
    <AuthContext.Provider value={{ token, mechanic, isAuthenticated, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
