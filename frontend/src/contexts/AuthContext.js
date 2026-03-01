import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

// Heartbeat interval (2 minutes)
const HEARTBEAT_INTERVAL = 2 * 60 * 1000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [visibleTabs, setVisibleTabs] = useState([]);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const heartbeatIntervalRef = useRef(null);
  const logoutCalledRef = useRef(false);

  // Logout function - memoized to prevent recreating on every render
  const logout = useCallback(async (showMessage = false) => {
    // Prevent multiple logout calls
    if (logoutCalledRef.current) return;
    logoutCalledRef.current = true;
    
    // Clear heartbeat
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    
    // Clear auth state
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    setPermissions([]);
    setVisibleTabs([]);
    
    if (showMessage) {
      toast.error('Session expired. Please log in again.');
    }
    
    // Reset flag after a short delay
    setTimeout(() => {
      logoutCalledRef.current = false;
    }, 1000);
  }, []);

  // Setup axios interceptor for handling 401 errors globally
  useEffect(() => {
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          const errorMsg = error.response?.data?.detail || '';
          // Check for token expiration messages
          if (
            errorMsg.toLowerCase().includes('expired') ||
            errorMsg.toLowerCase().includes('invalid token') ||
            errorMsg.toLowerCase().includes('not authenticated')
          ) {
            console.log('Token expired, logging out...');
            logout(true);
          }
        }
        return Promise.reject(error);
      }
    );

    // Cleanup interceptor on unmount
    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, [logout]);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
    
    return () => {
      // Cleanup heartbeat on unmount
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current);
      }
    };
  }, [token]);

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`);
      const userData = response.data;
      setUser(userData);
      setPermissions(userData.permissions || []);
      setVisibleTabs(userData.visible_tabs || []);
      
      // Store user data in localStorage for timezone and other utilities
      localStorage.setItem('user', JSON.stringify({
        id: userData.id,
        name: userData.name,
        email: userData.email,
        country_id: userData.country_id,
        country_code: userData.country_code,
        country_name: userData.country_name,
        role_code: userData.role_code
      }));
    } catch (error) {
      console.error('Failed to fetch user:', error);
      logout();
    } finally {
      setLoading(false);
    }
  };

  // Start session tracking for attendance
  const startSessionTracking = async () => {
    try {
      await axios.post(`${API_URL}/hr/session/start`);
      
      // Start heartbeat
      heartbeatIntervalRef.current = setInterval(async () => {
        try {
          await axios.post(`${API_URL}/hr/session/heartbeat`);
        } catch (error) {
          if (error.response?.status === 401) {
            // Session expired due to inactivity
            console.log('Session expired due to inactivity');
            logout();
          }
        }
      }, HEARTBEAT_INTERVAL);
    } catch (error) {
      console.error('Failed to start session tracking:', error);
    }
  };

  // End session tracking
  const endSessionTracking = async () => {
    try {
      await axios.post(`${API_URL}/hr/session/end`);
    } catch (error) {
      console.error('Failed to end session:', error);
    }
    
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  };

  const login = async (email, password, countryId) => {
    const response = await axios.post(`${API_URL}/auth/login`, { email, password, country_id: countryId });
    const { access_token, user: userData } = response.data;
    localStorage.setItem('token', access_token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    setToken(access_token);
    // Fetch full user data with permissions
    const meResponse = await axios.get(`${API_URL}/auth/me`);
    const fullUserData = meResponse.data;
    setUser(fullUserData);
    setPermissions(fullUserData.permissions || []);
    setVisibleTabs(fullUserData.visible_tabs || []);
    
    // Store user data in localStorage for timezone and other utilities
    localStorage.setItem('user', JSON.stringify({
      id: fullUserData.id,
      name: fullUserData.name,
      email: fullUserData.email,
      country_id: fullUserData.country_id,
      country_code: fullUserData.country_code,
      country_name: fullUserData.country_name,
      role_code: fullUserData.role_code
    }));
    
    // Start session tracking for attendance
    startSessionTracking();
    
    return fullUserData;
  };

  const handleLogout = async () => {
    // End session tracking before logout
    await endSessionTracking();
    logout();
  };

  // Check if user has a specific permission
  const hasPermission = (permissionName) => {
    return permissions.some(p => p.name === permissionName);
  };

  // Check if tab is visible for user
  const canViewTab = (tabName) => {
    return visibleTabs.includes(tabName);
  };

  // Get permission scope for a specific permission
  const getPermissionScope = (permissionName) => {
    const perm = permissions.find(p => p.name === permissionName);
    return perm ? perm.scope : null;
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      loading, 
      login, 
      logout, 
      isAuthenticated: !!user,
      permissions,
      visibleTabs,
      hasPermission,
      canViewTab,
      getPermissionScope
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
