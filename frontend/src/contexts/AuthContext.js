import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import axios from 'axios';

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

  const logout = async () => {
    // End session tracking before logout
    await endSessionTracking();
    
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
    setPermissions([]);
    setVisibleTabs([]);
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
