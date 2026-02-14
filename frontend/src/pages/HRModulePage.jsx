import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Clock, DollarSign, Calendar, Shield, Globe, UserMinus, Briefcase } from 'lucide-react';
import { hrApi } from '@/services/api';

// Import the full AdminPage content
import AdminPage from './AdminPage';

// Import HR-specific components
import { AttendanceDashboard, PayrollDashboard, LeaveManagement } from './HRComponents';

// Mini Dashboard Card Component
function DashboardCard({ title, value, icon: Icon, color, subText, onClick }) {
  return (
    <div 
      className={`rounded-xl border p-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''} ${color}`}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium opacity-80">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          {subText && <p className="text-xs opacity-70 mt-1">{subText}</p>}
        </div>
        <div className="h-10 w-10 rounded-full bg-white/30 flex items-center justify-center">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export default function HRModulePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('employees');
  const [dashboardStats, setDashboardStats] = useState(null);
  const [employeesOnLeave, setEmployeesOnLeave] = useState([]);
  const [showOnLeaveList, setShowOnLeaveList] = useState(false);

  const roleCode = user?.roles?.[0]?.code || '';
  const isHR = ['CEO', 'HR_MANAGER'].includes(roleCode);
  const isFinance = ['CEO', 'FINANCE_MANAGER'].includes(roleCode);
  const isHROrFinance = isHR || isFinance || ['COUNTRY_HEAD'].includes(roleCode);

  // Fetch dashboard stats
  const fetchDashboardStats = useCallback(async () => {
    try {
      const [statsRes, onLeaveRes] = await Promise.all([
        hrApi.getDashboardStats(),
        hrApi.getEmployeesOnLeaveToday()
      ]);
      setDashboardStats(statsRes.data);
      setEmployeesOnLeave(onLeaveRes.data || []);
    } catch (e) {
      console.error('Failed to load dashboard stats');
    }
  }, []);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  // Main tabs configuration
  const tabs = [
    { id: 'employees', label: 'Employees', icon: Users, show: true },
    { id: 'attendance', label: 'Attendance', icon: Clock, show: true },
    { id: 'payroll', label: 'Payroll', icon: DollarSign, show: isHROrFinance },
    { id: 'leave', label: 'Leave', icon: Calendar, show: true },
    { id: 'roles', label: 'Roles', icon: Shield, show: isHR },
    { id: 'countries', label: 'Countries', icon: Globe, show: isHR },
  ].filter(t => t.show);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">HR Module</h1>
          <p className="text-gray-500">Manage employees, attendance, payroll, leave, roles, and countries</p>
        </div>

        {/* Mini Dashboard Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <DashboardCard
            title="Total Employees"
            value={dashboardStats?.total_employees || 0}
            icon={Users}
            color="bg-gradient-to-r from-blue-500 to-blue-600 text-white"
          />
          <DashboardCard
            title="On Leave Today"
            value={dashboardStats?.on_leave_today || 0}
            icon={UserMinus}
            color="bg-gradient-to-r from-amber-500 to-amber-600 text-white"
            onClick={() => setShowOnLeaveList(!showOnLeaveList)}
            subText="Click to view"
          />
          <DashboardCard
            title="Active Sessions"
            value="-"
            icon={Briefcase}
            color="bg-gradient-to-r from-emerald-500 to-emerald-600 text-white"
          />
          <DashboardCard
            title="Countries"
            value={dashboardStats?.countries || 0}
            icon={Globe}
            color="bg-gradient-to-r from-purple-500 to-purple-600 text-white"
          />
        </div>

        {/* Employees On Leave Today (Expandable) */}
        {showOnLeaveList && employeesOnLeave.length > 0 && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h3 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
              <UserMinus className="h-4 w-4" />
              Employees On Leave Today ({employeesOnLeave.length})
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {employeesOnLeave.map(emp => (
                <div key={emp.id} className="bg-white p-3 rounded-lg border flex items-center gap-3">
                  {emp.photo_url ? (
                    <img src={emp.photo_url} alt={emp.name} className="h-10 w-10 rounded-full object-cover" />
                  ) : (
                    <div className="h-10 w-10 rounded-full bg-amber-500 flex items-center justify-center text-white font-medium">
                      {emp.name?.charAt(0)}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{emp.name}</p>
                    <p className="text-xs text-gray-500">{emp.leave_type === 'casual' ? 'Casual Leave' : 'Sick Leave'}</p>
                    <p className="text-xs text-amber-600">{emp.start_date} to {emp.end_date}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabs Navigation */}
        <div className="mb-6">
          <div className="flex gap-1 p-1 bg-white rounded-xl border w-fit shadow-sm">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === tab.id 
                    ? 'bg-blue-600 text-white shadow-md' 
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
                data-testid={`${tab.id}-tab`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-xl border shadow-sm">
          {/* Employees Tab - Uses AdminPage employee section */}
          {activeTab === 'employees' && <AdminPageEmployeesSection />}
          
          {/* Attendance Tab */}
          {activeTab === 'attendance' && <AttendanceDashboard isHR={isHR} />}
          
          {/* Payroll Tab */}
          {activeTab === 'payroll' && isHROrFinance && <PayrollDashboard isHR={isHR} isFinance={isFinance} />}
          
          {/* Leave Tab */}
          {activeTab === 'leave' && <LeaveManagement isHR={isHR} />}
          
          {/* Roles Tab - Uses AdminPage roles section */}
          {activeTab === 'roles' && isHR && <AdminPageRolesSection />}
          
          {/* Countries Tab - Uses AdminPage countries section */}
          {activeTab === 'countries' && isHR && <AdminPageCountriesSection />}
        </div>
      </div>
    </div>
  );
}

// Wrapper components to use AdminPage sections
function AdminPageEmployeesSection() {
  return <AdminPage initialTab="employees" embedded={true} />;
}

function AdminPageRolesSection() {
  return <AdminPage initialTab="roles" embedded={true} />;
}

function AdminPageCountriesSection() {
  return <AdminPage initialTab="countries" embedded={true} />;
}
