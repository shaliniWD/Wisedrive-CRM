import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

// Map of tab names to routes
const tabRouteMap = {
  leads: { name: 'Leads', href: '/leads' },
  customers: { name: 'Customers', href: '/customers' },
  inspections: { name: 'Inspections', href: '/inspections' },
  employees: { name: 'Admin', href: '/admin' },
  dashboard: { name: 'Dashboard', href: '/dashboard' },
};

export const TopNavbar = () => {
  const { user, logout, visibleTabs } = useAuth();
  const location = useLocation();

  // Build navigation based on visible tabs
  const navigation = visibleTabs
    .map(tab => tabRouteMap[tab])
    .filter(Boolean);
  
  // Always show dashboard if not in list
  if (!navigation.find(n => n.href === '/dashboard')) {
    navigation.push(tabRouteMap.dashboard);
  }

  return (
    <header className="wisedrive-header sticky top-0 z-50" data-testid="top-navbar">
      <div className="flex items-center justify-between h-full px-4">
        {/* Logo */}
        <div className="flex items-center h-full">
          <div className="flex items-center mr-6" data-testid="logo">
            <span className="text-xl font-bold text-white tracking-tight">
              WISEDRIVE
            </span>
            <div className="ml-1 flex gap-0.5 items-end">
              <div className="w-1 h-1 bg-[#FFD700] rounded-full"></div>
              <div className="w-1 h-2 bg-[#FFD700] rounded-full"></div>
              <div className="w-1 h-3 bg-[#FFD700] rounded-full"></div>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="flex items-center h-full" data-testid="main-nav">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href || 
                              (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
              
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  data-testid={`nav-${item.name.toLowerCase()}`}
                  className={`nav-tab ${isActive ? 'active' : ''}`}
                >
                  {item.name}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Right Side - User Info */}
        <div className="flex items-center gap-4">
          <div className="text-right">
            <span className="text-sm text-white font-medium block">{user?.name}</span>
            <span className="text-xs text-white/70">{user?.role_name || user?.role} • {user?.country_name}</span>
          </div>
          <button 
            onClick={logout}
            className="text-sm text-white/70 hover:text-white px-3 py-1 rounded border border-white/30 hover:border-white/50"
            data-testid="logout-btn"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};
