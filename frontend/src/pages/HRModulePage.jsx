import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Users, Clock, DollarSign, Calendar, Shield, Globe, IndianRupee, CalendarDays, MapPin } from 'lucide-react';
import { hrApi } from '@/services/api';

// Import the full AdminPage content
import AdminPage from './AdminPage';

// Import HR-specific components
import { AttendanceDashboard, PayrollDashboard, LeaveManagement, HolidayCalendar, InspectionCityManagement } from './HRComponents';

export default function HRModulePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('employees');
  const [employeesOnLeave, setEmployeesOnLeave] = useState([]);

  const roleCode = user?.roles?.[0]?.code || '';
  const isHR = ['CEO', 'HR_MANAGER'].includes(roleCode);
  const isFinance = ['CEO', 'FINANCE_MANAGER'].includes(roleCode);
  const isHROrFinance = isHR || isFinance || ['COUNTRY_HEAD'].includes(roleCode);
  const isCEO = roleCode === 'CEO';  // Only CEO can access Countries
  const isInspectionHead = ['CEO', 'INSPECTION_HEAD', 'HR_MANAGER'].includes(roleCode);
  
  // Currency icon based on user country
  const isIndianUser = user?.country_code === 'IN' || user?.country_name?.toLowerCase().includes('india');
  const PayrollIcon = (!isCEO && isIndianUser) ? IndianRupee : DollarSign;

  // Fetch employees on leave today
  const fetchEmployeesOnLeave = useCallback(async () => {
    try {
      const onLeaveRes = await hrApi.getEmployeesOnLeaveToday();
      setEmployeesOnLeave(onLeaveRes.data || []);
    } catch (e) {
      console.error('Failed to load employees on leave');
    }
  }, []);

  useEffect(() => {
    fetchEmployeesOnLeave();
  }, [fetchEmployeesOnLeave]);

  // Main tabs configuration
  const tabs = [
    { id: 'employees', label: 'Employees', icon: Users, show: true },
    { id: 'attendance', label: 'Attendance', icon: Clock, show: true },
    { id: 'holidays', label: 'Holiday Calendar', icon: CalendarDays, show: isHR },
    { id: 'payroll', label: 'Payroll', icon: DollarSign, show: isHROrFinance },
    { id: 'leave', label: 'Leave', icon: Calendar, show: true },
    { id: 'inspection-city', label: 'Inspection City', icon: MapPin, show: isInspectionHead },
    { id: 'roles', label: 'Roles', icon: Shield, show: isHR },
    { id: 'countries', label: 'Countries', icon: Globe, show: isCEO },
  ].filter(t => t.show);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">HR Module</h1>
          <p className="text-gray-500">Manage employees, attendance, payroll, leave, roles, and countries</p>
        </div>

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
          
          {/* Inspection City Tab - Assign cities to mechanics */}
          {activeTab === 'inspection-city' && isInspectionHead && <InspectionCityManagement />}
          
          {/* Roles Tab - Uses AdminPage roles section */}
          {activeTab === 'roles' && isHR && <AdminPageRolesSection />}
          
          {/* Holiday Calendar Tab */}
          {activeTab === 'holidays' && isHR && <HolidayCalendar />}
          
          {/* Countries Tab - Uses AdminPage countries section (CEO only) */}
          {activeTab === 'countries' && isCEO && <AdminPageCountriesSection />}
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
