import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

const navigation = [
  { name: 'Leads', href: '/leads' },
  { name: 'Customers', href: '/customers' },
  { name: 'Inspections', href: '/inspections' },
  { name: 'Admin', href: '/admin' },
  { name: 'Dashboard', href: '/dashboard' },
];

export const TopNavbar = () => {
  const { user, logout } = useAuth();
  const location = useLocation();

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
          <span className="text-sm text-white/90">{user?.email}</span>
          <button 
            onClick={logout}
            className="text-sm text-white/70 hover:text-white"
            data-testid="logout-btn"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};
