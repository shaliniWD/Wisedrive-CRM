import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

const API_URL = process.env.REACT_APP_BACKEND_URL + '/api';

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [visibleTabs, setVisibleTabs] = useState([]);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchUser();
    } else {
      setLoading(false);
    }
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

  const login = async (email, password) => {
    const response = await axios.post(`${API_URL}/auth/login`, { email, password });
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
    return fullUserData;
  };

  const logout = () => {
    localStorage.removeItem('token');
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
