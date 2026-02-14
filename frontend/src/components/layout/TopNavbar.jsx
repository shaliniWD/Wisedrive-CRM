import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LogOut, ChevronDown } from 'lucide-react';

// Company Logo URL
const COMPANY_LOGO = "https://customer-assets.emergentagent.com/job_crm-employee-hub/artifacts/6eac372o_Wisedrive%20New%20Logo%20Horizontal%20Blue%20Trans%20BG.png";

// Map of tab names to routes
const tabRouteMap = {
  leads: { name: 'Leads', href: '/leads' },
  customers: { name: 'Customers', href: '/customers' },
  inspections: { name: 'Inspections', href: '/inspections' },
  employees: { name: 'Admin', href: '/admin' },
  finance: { name: 'Finance', href: '/finance' },
  settings: { name: 'Settings', href: '/settings' },
};

export const TopNavbar = () => {
  const { user, logout, visibleTabs } = useAuth();
  const location = useLocation();

  // Build navigation based on visible tabs
  const navigation = visibleTabs
    .map(tab => tabRouteMap[tab])
    .filter(Boolean);
  
  // Always ensure at least one tab is visible
  if (navigation.length === 0) {
    navigation.push({ name: 'Home', href: '/' });
  }

  return (
    <header className="sticky top-0 z-50 bg-gradient-to-r from-blue-900 to-blue-800 shadow-lg" data-testid="top-navbar">
      <div className="flex items-center justify-between h-14 px-4 max-w-7xl mx-auto">
        {/* Logo */}
        <div className="flex items-center h-full">
          <NavLink to="/dashboard" className="flex items-center mr-8" data-testid="logo">
            <img src={COMPANY_LOGO} alt="WiseDrive" className="h-8" crossOrigin="anonymous" />
          </NavLink>

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
        </div>

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
