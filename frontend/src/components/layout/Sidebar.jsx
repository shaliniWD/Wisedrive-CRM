import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Users, 
  UserCheck, 
  ClipboardCheck, 
  Settings,
  ChevronRight,
  Clock,
  Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Admin merged into HR Module
const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Leads', href: '/leads', icon: Users },
  { name: 'Customers', href: '/customers', icon: UserCheck },
  { name: 'Inspections', href: '/inspections', icon: ClipboardCheck },
  { name: 'HR Module', href: '/hr', icon: Clock },
  { name: 'Finance', href: '/finance', icon: Wallet },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const Sidebar = () => {
  const location = useLocation();

  return (
    <div className="flex h-full w-64 flex-col bg-[#2E3192] text-white" data-testid="sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center px-6 border-b border-white/10">
        <span className="text-2xl font-bold tracking-tight font-['Outfit']" data-testid="sidebar-logo">
          WISEDRIVE
        </span>
        <div className="ml-1 flex gap-0.5">
          <div className="w-1.5 h-1.5 bg-[#FFD700] rounded-full"></div>
          <div className="w-1.5 h-2.5 bg-[#FFD700] rounded-full"></div>
          <div className="w-1.5 h-3.5 bg-[#FFD700] rounded-full"></div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href || 
                          (item.href !== '/dashboard' && location.pathname.startsWith(item.href));
          const Icon = item.icon;
          
          return (
            <NavLink
              key={item.name}
              to={item.href}
              data-testid={`nav-${item.name.toLowerCase()}`}
              className={cn(
                'group flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors sidebar-item',
                isActive
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              )}
            >
              <Icon className="mr-3 h-5 w-5 flex-shrink-0" />
              <span className="flex-1">{item.name}</span>
              {isActive && (
                <ChevronRight className="h-4 w-4 opacity-70" />
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10">
        <p className="text-xs text-white/50 text-center">
          © 2026 WiseDrive CRM
        </p>
      </div>
    </div>
  );
};
