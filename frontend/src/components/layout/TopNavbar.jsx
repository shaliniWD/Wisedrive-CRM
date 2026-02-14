import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, LayoutDashboard } from 'lucide-react';

// Map of tab names to routes - Admin merged into HR Module
const tabRouteMap = {
  dashboard: { name: 'Dashboard', href: '/dashboard' },
  leads: { name: 'Leads', href: '/leads' },
  customers: { name: 'Customers', href: '/customers' },
  inspections: { name: 'Inspections', href: '/inspections' },
  hr: { name: 'HR Module', href: '/hr' },
  finance: { name: 'Finance', href: '/finance' },
  settings: { name: 'Settings', href: '/settings' },
};

export const TopNavbar = () => {
  const { user, logout, visibleTabs } = useAuth();
  const location = useLocation();

  // Build navigation - always include dashboard first
  const navigation = [];
  
  // Add Dashboard first (always visible)
  navigation.push(tabRouteMap.dashboard);
  
  // Add other visible tabs
  visibleTabs.forEach(tab => {
    if (tab !== 'dashboard' && tabRouteMap[tab]) {
      navigation.push(tabRouteMap[tab]);
    }
  });

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-900 to-blue-800 shadow-lg" data-testid="top-navbar">
      <div className="flex items-center justify-between h-14 px-4 max-w-7xl mx-auto">
        {/* Navigation Tabs */}
        <nav className="flex items-center h-full gap-1" data-testid="main-nav">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href || 
                            (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
            
            return (
              <NavLink
                key={item.name}
                to={item.href}
                data-testid={`nav-${item.name.toLowerCase()}`}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                  isActive 
                    ? 'bg-white/20 text-white' 
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {item.name}
              </NavLink>
            );
          })}
        </nav>

        {/* Right Side - User Info */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center text-white font-semibold text-sm">
              {user?.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="text-right hidden sm:block">
              <span className="text-sm text-white font-medium block">{user?.name}</span>
              <span className="text-xs text-white/60">{user?.role_name || user?.role} • {user?.country_name}</span>
            </div>
          </div>
          <button 
            onClick={logout}
            className="flex items-center gap-2 text-sm text-white/70 hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-all"
            data-testid="logout-btn"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
};
