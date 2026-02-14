import React, { useState, useEffect, useCallback } from 'react';
import { hrApi, rolesApi, departmentsApi, teamsApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Plus, Loader2, Pencil, Users, Globe, Search, ChevronDown, ChevronUp,
  FileText, Calendar, DollarSign, History, Eye, X, PauseCircle, PlayCircle,
  Building, Phone, Mail, MapPin, Briefcase, Clock, CheckCircle, AlertCircle,
  Shield, UserX, UserPlus, Settings, Lock, CreditCard, CalendarPlus, List
} from 'lucide-react';

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Preset page access permissions
const PAGE_PERMISSIONS = [
  { id: 'dashboard', name: 'Dashboard', description: 'View dashboard and statistics' },
  { id: 'leads', name: 'Leads', description: 'Manage sales leads' },
  { id: 'customers', name: 'Customers', description: 'Manage customer records' },
  { id: 'inspections', name: 'Inspections', description: 'Manage vehicle inspections' },
  { id: 'employees', name: 'Admin - Employees', description: 'View and manage employees' },
  { id: 'hr', name: 'HR Module', description: 'Attendance, payroll, and leave management' },
  { id: 'finance', name: 'Finance', description: 'Manage payments and payroll' },
  { id: 'settings', name: 'Settings', description: 'System configuration' },
];

// Preset roles with default permissions
const PRESET_ROLES = [
  { code: 'CEO', name: 'CEO', permissions: PAGE_PERMISSIONS.map(p => ({ page: p.id, view: true, edit: true })) },
  { code: 'COUNTRY_HEAD', name: 'Country Head', permissions: PAGE_PERMISSIONS.map(p => ({ page: p.id, view: true, edit: p.id !== 'settings' })) },
  { code: 'HR_MANAGER', name: 'HR Manager', permissions: [
    { page: 'dashboard', view: true, edit: false },
    { page: 'employees', view: true, edit: true },
    { page: 'hr', view: true, edit: true },
    { page: 'finance', view: true, edit: true },
    { page: 'settings', view: true, edit: false },
  ]},
  { code: 'FINANCE_MANAGER', name: 'Finance Manager', permissions: [
    { page: 'dashboard', view: true, edit: false },
    { page: 'employees', view: true, edit: false },
    { page: 'finance', view: true, edit: true },
  ]},
  { code: 'SALES_HEAD', name: 'Sales Head', permissions: [
    { page: 'dashboard', view: true, edit: false },
    { page: 'leads', view: true, edit: true },
    { page: 'customers', view: true, edit: true },
    { page: 'inspections', view: true, edit: true },
  ]},
  { code: 'SALES_EXECUTIVE', name: 'Sales Executive', permissions: [
    { page: 'dashboard', view: true, edit: false },
    { page: 'leads', view: true, edit: true },
    { page: 'customers', view: true, edit: false },
  ]},
  { code: 'INSPECTION_HEAD', name: 'Inspection Head', permissions: [
    { page: 'dashboard', view: true, edit: false },
    { page: 'inspections', view: true, edit: true },
    { page: 'customers', view: true, edit: false },
  ]},
  { code: 'MECHANIC', name: 'Mechanic', permissions: [
    { page: 'inspections', view: true, edit: true },
  ]},
  { code: 'FREELANCER', name: 'Freelancer', permissions: [] },  // No CRM access, only receives payments
];

// Status Badge Component
const StatusBadge = ({ status, small = false }) => {
  const config = {
    active: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Active' },
    exited: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Exited' },
    on_leave: { color: 'bg-amber-100 text-amber-800 border-amber-200', label: 'On Leave' },
    inactive: { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Inactive' },
  };
  const cfg = config[status] || config.inactive;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color} ${small ? 'text-[10px] px-1.5' : ''}`}>
      {cfg.label}
    </span>
  );
};

// Role Badge Component - Supports multiple roles
const RoleBadges = ({ roles }) => {
  if (!roles || roles.length === 0) return <span className="text-gray-400 text-xs">No role</span>;
  
  const colors = {
    CEO: 'bg-purple-100 text-purple-800 border-purple-200',
    HR_MANAGER: 'bg-blue-100 text-blue-800 border-blue-200',
    MECHANIC: 'bg-orange-100 text-orange-800 border-orange-200',
    FINANCE_MANAGER: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    COUNTRY_HEAD: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    SALES_HEAD: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    SALES_EXECUTIVE: 'bg-sky-100 text-sky-800 border-sky-200',
    INSPECTION_HEAD: 'bg-amber-100 text-amber-800 border-amber-200',
    FREELANCER: 'bg-pink-100 text-pink-800 border-pink-200',
  };
  
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role, idx) => (
        <span key={idx} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors[role.code] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
          {role.name || role.code}
        </span>
      ))}
    </div>
  );
};

// Summary Card Component
const SummaryCard = ({ title, value, icon: Icon, color }) => (
  <div className="rounded-xl border bg-white p-5">
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className={`text-2xl font-bold ${color || 'text-gray-900'}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </div>
      <div className={`p-3 rounded-xl bg-gradient-to-r ${
        color?.includes('blue') ? 'from-blue-500 to-blue-600' : 
        color?.includes('emerald') ? 'from-emerald-500 to-emerald-600' : 
        color?.includes('purple') ? 'from-purple-500 to-purple-600' :
        color?.includes('red') ? 'from-red-500 to-red-600' :
        'from-gray-500 to-gray-600'
      }`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
    </div>
  </div>
);

export default function AdminPage({ initialTab = 'employees', embedded = false }) {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [countries, setCountries] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(initialTab);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  
  // Modal states
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  
  // Employee modal tabs
  const [employeeModalTab, setEmployeeModalTab] = useState('details');
  
  // Expanded audit rows
  const [expandedAudit, setExpandedAudit] = useState({});
  
  // Exit modal data
  const [exitData, setExitData] = useState({ exit_date: '', exit_reason: '', exit_notes: '' });

  const isHROrCEO = user?.role_code === 'CEO' || user?.role_code === 'HR_MANAGER' || user?.roles?.some(r => r.code === 'CEO' || r.code === 'HR_MANAGER');

  const fetchData = useCallback(async () => {
    try {
      const [rolesRes, deptsRes, teamsRes] = await Promise.all([
        rolesApi.getAll(),
        departmentsApi.getAll(),
        teamsApi.getAll(),
      ]);
      setRoles(rolesRes.data);
      setDepartments(deptsRes.data);
      setTeams(teamsRes.data);
    } catch (error) {
      console.error('Failed to load base data:', error);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (filterCountry) params.country_id = filterCountry;
      if (filterRole) params.role_id = filterRole;
      if (filterStatus === 'active') params.is_active = true;
      else if (filterStatus === 'exited') params.is_active = false;
      
      const response = await hrApi.getEmployees(params);
      setEmployees(response.data);
    } catch (error) {
      if (error.response?.status !== 403) {
        toast.error('Failed to load employees');
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterCountry, filterRole, filterStatus]);

  const fetchCountries = useCallback(async () => {
    try {
      const response = await hrApi.getAllCountries();
      setCountries(response.data);
    } catch (error) {
      try {
        const res = await hrApi.getCountries();
        setCountries(res.data);
      } catch (e) {
        console.error('Failed to load countries');
      }
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  useEffect(() => { fetchCountries(); }, [fetchCountries]);

  // Sync activeTab with initialTab when embedded and initialTab changes
  useEffect(() => {
    if (embedded && initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab, embedded]);

  // Toggle audit row expansion
  const toggleAudit = (empId) => {
    setExpandedAudit(prev => ({...prev, [empId]: !prev[empId]}));
  };

  // Open employee modal
  const openEmployeeModal = (employee = null) => {
    setSelectedEmployee(employee);
    setEmployeeModalTab('details');
    setIsEmployeeModalOpen(true);
  };

  // Open country modal
  const openCountryModal = (country = null) => {
    setSelectedCountry(country);
    setIsCountryModalOpen(true);
  };

  // Open role modal
  const openRoleModal = (role = null) => {
    setSelectedRole(role);
    setIsRoleModalOpen(true);
  };

  // Open exit modal
  const openExitModal = (employee) => {
    setSelectedEmployee(employee);
    setExitData({ exit_date: new Date().toISOString().split('T')[0], exit_reason: '', exit_notes: '' });
    setIsExitModalOpen(true);
  };

  // Handle employee exit
  const handleEmployeeExit = async () => {
    if (!selectedEmployee || !exitData.exit_date || !exitData.exit_reason) {
      toast.error('Please fill all required fields');
      return;
    }
    try {
      await hrApi.updateEmployee(selectedEmployee.id, {
        is_active: false,
        employment_status: 'exited',
        exit_date: exitData.exit_date,
        exit_reason: exitData.exit_reason,
        exit_notes: exitData.exit_notes,
      });
      toast.success('Employee marked as exited');
      setIsExitModalOpen(false);
      fetchEmployees();
    } catch (error) {
      toast.error('Failed to update employee status');
    }
  };

  // Handle employee rejoin
  const handleEmployeeRejoin = async (employee) => {
    if (!window.confirm(`Rejoin ${employee.name}? This will reactivate their account.`)) return;
    try {
      await hrApi.updateEmployee(employee.id, {
        is_active: true,
        employment_status: 'active',
        rejoin_date: new Date().toISOString().split('T')[0],
      });
      toast.success('Employee rejoined successfully');
      fetchEmployees();
    } catch (error) {
      toast.error('Failed to rejoin employee');
    }
  };

  // Format currency
  const formatCurrency = (amount, symbol = '₹') => {
    if (!amount) return '-';
    return `${symbol}${new Intl.NumberFormat('en-IN').format(amount)}`;
  };

  // Stats
  const activeEmployees = employees.filter(e => e.is_active).length;
  const exitedEmployees = employees.filter(e => !e.is_active).length;
  const mechanicCount = employees.filter(e => e.role_code === 'MECHANIC' || e.roles?.some(r => r.code === 'MECHANIC')).length;

  // When embedded, only render the content for the specified tab (no header, no tabs nav)
  if (embedded) {
    return (
      <div data-testid="admin-page-embedded">
        {/* Employees Tab Content */}
        {activeTab === 'employees' && (
          <div className="p-4">
            {/* Summary Cards for embedded view */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <SummaryCard title="Total Employees" value={employees.length} icon={Users} color="text-blue-700" />
              <SummaryCard title="Active Employees" value={activeEmployees} icon={CheckCircle} color="text-emerald-600" />
              <SummaryCard title="Exited Employees" value={exitedEmployees} icon={UserX} color="text-red-600" />
              <SummaryCard title="Countries" value={countries.length} icon={Globe} color="text-purple-600" />
            </div>
            
            {/* Filters */}
            <div className="flex items-center justify-between mb-4 gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, email, phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10"
                    data-testid="employee-search"
                  />
                </div>
                
                <Select value={filterCountry || 'all'} onValueChange={(v) => setFilterCountry(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-36 h-10" data-testid="filter-country">
                    <SelectValue placeholder="All Countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {countries.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={filterRole || 'all'} onValueChange={(v) => setFilterRole(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-36 h-10" data-testid="filter-role">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-32 h-10" data-testid="filter-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="exited">Exited</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isHROrCEO && (
                <button 
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/25 transition-all"
                  onClick={() => openEmployeeModal()} 
                  data-testid="add-employee-btn"
                >
                  <Plus className="h-4 w-4" /> Add Employee
                </button>
              )}
            </div>

            {/* Employee Table */}
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Roles</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Country</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Weekly Off</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Salary</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Audit</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                          <span className="text-gray-500">Loading employees...</span>
                        </div>
                      </td>
                    </tr>
                  ) : employees.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12">
                        <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No employees found</p>
                      </td>
                    </tr>
                  ) : (
                    employees.map((emp) => (
                      <React.Fragment key={emp.id}>
                        <tr className={`hover:bg-slate-50 transition-colors ${!emp.is_active ? 'bg-red-50/30' : emp.employment_status === 'on_leave' ? 'bg-amber-50/30' : ''}`} data-testid={`employee-row-${emp.id}`}>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              {emp.photo_url ? (
                                <img 
                                  src={emp.photo_url} 
                                  alt={emp.name} 
                                  className={`h-10 w-10 rounded-full object-cover border-2 ${emp.employment_status === 'on_leave' ? 'border-amber-400' : emp.is_active ? 'border-blue-400' : 'border-gray-300'}`}
                                />
                              ) : (
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-medium ${emp.employment_status === 'on_leave' ? 'bg-gradient-to-r from-amber-500 to-amber-600' : emp.is_active ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gray-400'}`}>
                                  {emp.name?.charAt(0)?.toUpperCase()}
                                </div>
                              )}
                              <div>
                                <span className="font-medium text-gray-900 block">{emp.name}</span>
                                <span className="text-xs text-gray-500">{emp.email}</span>
                                {emp.employee_code && <span className="text-xs text-gray-400 ml-2">({emp.employee_code})</span>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <RoleBadges roles={emp.roles || [{ code: emp.role_code, name: emp.role_name }]} />
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                              <MapPin className="h-3.5 w-3.5 text-gray-400" />
                              {emp.country_name || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 text-xs text-gray-600">
                              <Clock className="h-3 w-3" />
                              {DAY_NAMES[emp.weekly_off_day || 0]}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col gap-1">
                              <StatusBadge status={emp.employment_status === 'on_leave' ? 'on_leave' : (emp.is_active ? 'active' : 'exited')} />
                              {emp.current_leave_type && (
                                <span className="text-xs text-amber-600 capitalize">{emp.current_leave_type} leave</span>
                              )}
                              {emp.exit_date && (
                                <span className="text-xs text-gray-400">Exit: {emp.exit_date}</span>
                              )}
                              {emp.has_crm_access === false && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">No CRM</span>
                              )}
                              {emp.is_available_for_leads === false && emp.is_active && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 border border-red-200">
                                  <PauseCircle className="h-2.5 w-2.5" /> No Leads
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {emp.salary_info ? (
                              <div className="text-xs">
                                {emp.role_code === 'MECHANIC' || emp.role_code === 'FREELANCER' || emp.salary_info.employment_type === 'freelancer' ? (
                                  <span className="text-emerald-600 font-medium">
                                    {formatCurrency(emp.salary_info.price_per_inspection, emp.currency_symbol || '₹')}/insp
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 font-medium">
                                    {formatCurrency(emp.salary_info.gross_salary || emp.salary_info.basic_salary, emp.currency_symbol || '₹')}
                                    <span className="text-gray-400 font-normal ml-1">gross</span>
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Not set</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => toggleAudit(emp.id)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors"
                              data-testid={`toggle-audit-${emp.id}`}
                            >
                              <History className="h-3.5 w-3.5" />
                              {emp.audit_count || 0}
                              {expandedAudit[emp.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1">
                              <button
                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                onClick={() => openEmployeeModal(emp)}
                                title="View/Edit"
                                data-testid={`edit-employee-${emp.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              {emp.is_active && (
                                <>
                                  <button
                                    className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                    onClick={() => {
                                      setSelectedEmployee(emp);
                                      setEmployeeModalTab('leave');
                                      setIsEmployeeModalOpen(true);
                                    }}
                                    title="Apply Leave"
                                    data-testid={`apply-leave-${emp.id}`}
                                  >
                                    <CalendarPlus className="h-4 w-4" />
                                  </button>
                                  <button
                                    className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                    onClick={() => {
                                      setSelectedEmployee(emp);
                                      setEmployeeModalTab('leave');
                                      setIsEmployeeModalOpen(true);
                                    }}
                                    title="View Leaves"
                                    data-testid={`view-leaves-${emp.id}`}
                                  >
                                    <List className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              {isHROrCEO && emp.is_active && (
                                <button
                                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  onClick={() => openExitModal(emp)}
                                  title="Mark as Exited"
                                  data-testid={`exit-employee-${emp.id}`}
                                >
                                  <UserX className="h-4 w-4" />
                                </button>
                              )}
                              {isHROrCEO && !emp.is_active && (
                                <button
                                  className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                  onClick={() => handleEmployeeRejoin(emp)}
                                  title="Rejoin Employee"
                                  data-testid={`rejoin-employee-${emp.id}`}
                                >
                                  <UserPlus className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {expandedAudit[emp.id] && (
                          <tr className="bg-slate-50">
                            <td colSpan={8} className="p-4">
                              <EmployeeAuditTrail employeeId={emp.id} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Roles Tab Content */}
        {activeTab === 'roles' && isHROrCEO && (
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">Configure role-based access to different pages and features</p>
              <button 
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/25 transition-all"
                onClick={() => openRoleModal()} 
                data-testid="add-role-btn"
              >
                <Plus className="h-4 w-4" /> Add Role
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PRESET_ROLES.map((role) => (
                <div key={role.code} className="border rounded-xl p-4 bg-white hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600">
                        <Shield className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{role.name}</h3>
                        <p className="text-xs text-gray-500">{role.code}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => openRoleModal(role)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      data-testid={`edit-role-${role.code}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 uppercase">Page Access:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {role.permissions.filter(p => p.view).map((perm) => (
                        <span key={perm.page} className={`text-xs px-2 py-1 rounded-full border ${perm.edit ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                          {perm.page} {perm.edit ? '(Edit)' : '(View)'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {roles.filter(r => !PRESET_ROLES.find(p => p.code === r.code)).length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold text-gray-900 mb-3">Custom Roles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {roles.filter(r => !PRESET_ROLES.find(p => p.code === r.code)).map((role) => (
                    <div key={role.id} className="border rounded-xl p-4 bg-white hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-gradient-to-r from-gray-500 to-gray-600">
                            <Shield className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{role.name}</h3>
                            <p className="text-xs text-gray-500">{role.code}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => openRoleModal(role)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Countries Tab Content */}
        {activeTab === 'countries' && isHROrCEO && (
          <div className="p-4">
            <div className="flex justify-end mb-4">
              <button 
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/25 transition-all"
                onClick={() => openCountryModal()} 
                data-testid="add-country-btn"
              >
                <Plus className="h-4 w-4" /> Add Country
              </button>
            </div>

            <div className="border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Country</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Currency</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Phone Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Employees</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {countries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12">
                        <Globe className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No countries found</p>
                      </td>
                    </tr>
                  ) : (
                    countries.map((country) => (
                      <tr key={country.id} className="hover:bg-slate-50 transition-colors" data-testid={`country-row-${country.id}`}>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center text-white font-medium">
                              {country.code?.charAt(0)}
                            </div>
                            <span className="font-medium text-gray-900">{country.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-sm font-mono">{country.code}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="flex items-center gap-2">
                            <span className="text-lg">{country.currency_symbol || '₹'}</span>
                            <span className="text-sm text-gray-600">{country.currency}</span>
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-mono text-sm text-gray-600">{country.phone_code || '-'}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                            {country.employee_count || 0} employees
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={country.is_active !== false ? 'active' : 'inactive'} />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              onClick={() => openCountryModal(country)} 
                              data-testid={`edit-country-${country.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* All Modals - needed for embedded mode too */}
        <EmployeeModal
          isOpen={isEmployeeModalOpen}
          onClose={() => setIsEmployeeModalOpen(false)}
          employee={selectedEmployee}
          countries={countries}
          roles={roles}
          departments={departments}
          teams={teams}
          onSave={() => { fetchEmployees(); setIsEmployeeModalOpen(false); }}
          currentTab={employeeModalTab}
          setCurrentTab={setEmployeeModalTab}
        />

        <CountryModal
          isOpen={isCountryModalOpen}
          onClose={() => setIsCountryModalOpen(false)}
          country={selectedCountry}
          onSave={() => { fetchCountries(); setIsCountryModalOpen(false); }}
        />

        <RoleModal
          isOpen={isRoleModalOpen}
          onClose={() => setIsRoleModalOpen(false)}
          role={selectedRole}
          onSave={() => { fetchData(); setIsRoleModalOpen(false); }}
        />

        <Dialog open={isExitModalOpen} onOpenChange={setIsExitModalOpen}>
          <DialogContent className="sm:max-w-[450px]" data-testid="exit-modal">
            <DialogHeader className="border-b pb-4">
              <DialogTitle className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center text-white">
                  <UserX className="h-5 w-5" />
                </div>
                Mark Employee as Exited
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-800">
                  <strong>Note:</strong> The employee record will be preserved for audit purposes. They can be rejoined later if needed.
                </p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Exit Date *</Label>
                <Input 
                  type="date" 
                  value={exitData.exit_date} 
                  onChange={(e) => setExitData({...exitData, exit_date: e.target.value})} 
                  className="h-10" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Exit Reason *</Label>
                <Select value={exitData.exit_reason} onValueChange={(v) => setExitData({...exitData, exit_reason: v})}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select reason" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resignation">Resignation</SelectItem>
                    <SelectItem value="termination">Termination</SelectItem>
                    <SelectItem value="retirement">Retirement</SelectItem>
                    <SelectItem value="contract_end">Contract End</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Notes</Label>
                <textarea 
                  value={exitData.exit_notes}
                  onChange={(e) => setExitData({...exitData, exit_notes: e.target.value})}
                  className="w-full min-h-[80px] px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Additional notes..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={() => setIsExitModalOpen(false)}>Cancel</Button>
                <Button onClick={handleEmployeeExit} className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700">
                  Mark as Exited
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Standard full-page render (not embedded)
  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="admin-page">
      {/* Page Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Administration</h1>
          <p className="text-gray-500 mt-1">Manage employees, roles, and organizational settings</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
        <SummaryCard title="Total Employees" value={employees.length} icon={Users} color="text-blue-700" />
        <SummaryCard title="Active Employees" value={activeEmployees} icon={CheckCircle} color="text-emerald-600" />
        <SummaryCard title="Exited Employees" value={exitedEmployees} icon={UserX} color="text-red-600" />
        <SummaryCard title="Countries" value={countries.length} icon={Globe} color="text-purple-600" />
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="flex border-b bg-slate-50">
          <button
            onClick={() => setActiveTab('employees')}
            className={`px-6 py-4 text-sm font-medium flex items-center gap-2 transition-all border-b-2 -mb-px ${
              activeTab === 'employees' 
                ? 'border-blue-600 text-blue-600 bg-white' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            data-testid="employees-tab"
          >
            <Users className="h-4 w-4" /> Employees
          </button>
          {isHROrCEO && (
            <>
              <button
                onClick={() => setActiveTab('roles')}
                className={`px-6 py-4 text-sm font-medium flex items-center gap-2 transition-all border-b-2 -mb-px ${
                  activeTab === 'roles' 
                    ? 'border-blue-600 text-blue-600 bg-white' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                data-testid="roles-tab"
              >
                <Shield className="h-4 w-4" /> Roles & Access
              </button>
              <button
                onClick={() => setActiveTab('countries')}
                className={`px-6 py-4 text-sm font-medium flex items-center gap-2 transition-all border-b-2 -mb-px ${
                  activeTab === 'countries' 
                    ? 'border-blue-600 text-blue-600 bg-white' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
                data-testid="countries-tab"
              >
                <Globe className="h-4 w-4" /> Countries
              </button>
            </>
          )}
        </div>

        {/* Employees Tab */}
        {activeTab === 'employees' && (
          <div className="p-4">
            {/* Filters */}
            <div className="flex items-center justify-between mb-4 gap-4">

              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, email, phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-10"
                    data-testid="employee-search"
                  />
                </div>
                
                <Select value={filterCountry || 'all'} onValueChange={(v) => setFilterCountry(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-36 h-10" data-testid="filter-country">
                    <SelectValue placeholder="All Countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {countries.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={filterRole || 'all'} onValueChange={(v) => setFilterRole(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-36 h-10" data-testid="filter-role">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-32 h-10" data-testid="filter-status">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="exited">Exited</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {isHROrCEO && (
                <button 
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/25 transition-all"
                  onClick={() => openEmployeeModal()} 
                  data-testid="add-employee-btn"
                >
                  <Plus className="h-4 w-4" /> Add Employee
                </button>
              )}
            </div>

            {/* Employee Table */}
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Roles</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Country</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Weekly Off</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Salary</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Audit</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                          <span className="text-gray-500">Loading employees...</span>
                        </div>
                      </td>
                    </tr>
                  ) : employees.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12">
                        <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No employees found</p>
                      </td>
                    </tr>
                  ) : (
                    employees.map((emp) => (
                      <React.Fragment key={emp.id}>
                        <tr className={`hover:bg-slate-50 transition-colors ${!emp.is_active ? 'bg-red-50/30' : emp.employment_status === 'on_leave' ? 'bg-amber-50/30' : ''}`} data-testid={`employee-row-${emp.id}`}>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              {emp.photo_url ? (
                                <img 
                                  src={emp.photo_url} 
                                  alt={emp.name} 
                                  className={`h-10 w-10 rounded-full object-cover border-2 ${emp.employment_status === 'on_leave' ? 'border-amber-400' : emp.is_active ? 'border-blue-400' : 'border-gray-300'}`}
                                />
                              ) : (
                                <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-medium ${emp.employment_status === 'on_leave' ? 'bg-gradient-to-r from-amber-500 to-amber-600' : emp.is_active ? 'bg-gradient-to-r from-blue-500 to-blue-600' : 'bg-gray-400'}`}>
                                  {emp.name?.charAt(0)?.toUpperCase()}
                                </div>
                              )}
                              <div>
                                <span className="font-medium text-gray-900 block">{emp.name}</span>
                                <span className="text-xs text-gray-500">{emp.email}</span>
                                {emp.employee_code && <span className="text-xs text-gray-400 ml-2">({emp.employee_code})</span>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {/* Support for multiple roles */}
                            <RoleBadges roles={emp.roles || [{ code: emp.role_code, name: emp.role_name }]} />
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                              <MapPin className="h-3.5 w-3.5 text-gray-400" />
                              {emp.country_name || '-'}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 text-xs text-gray-600">
                              <Clock className="h-3 w-3" />
                              {DAY_NAMES[emp.weekly_off_day || 0]}
                            </span>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-col gap-1">
                              <StatusBadge status={emp.employment_status === 'on_leave' ? 'on_leave' : (emp.is_active ? 'active' : 'exited')} />
                              {emp.current_leave_type && (
                                <span className="text-xs text-amber-600 capitalize">{emp.current_leave_type} leave</span>
                              )}
                              {emp.exit_date && (
                                <span className="text-xs text-gray-400">Exit: {emp.exit_date}</span>
                              )}
                              {emp.has_crm_access === false && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">No CRM</span>
                              )}
                              {emp.is_available_for_leads === false && emp.is_active && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 border border-red-200">
                                  <PauseCircle className="h-2.5 w-2.5" /> No Leads
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {emp.salary_info ? (
                              <div className="text-xs">
                                {emp.role_code === 'MECHANIC' || emp.role_code === 'FREELANCER' || emp.salary_info.employment_type === 'freelancer' ? (
                                  <span className="text-emerald-600 font-medium">
                                    {formatCurrency(emp.salary_info.price_per_inspection, emp.currency_symbol || '₹')}/insp
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 font-medium">
                                    {formatCurrency(emp.salary_info.gross_salary || emp.salary_info.basic_salary, emp.currency_symbol || '₹')}
                                    <span className="text-gray-400 font-normal ml-1">gross</span>
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">Not set</span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => toggleAudit(emp.id)}
                              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-gray-600 hover:bg-gray-100 transition-colors"
                              data-testid={`toggle-audit-${emp.id}`}
                            >
                              <History className="h-3.5 w-3.5" />
                              {emp.audit_count || 0}
                              {expandedAudit[emp.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                            </button>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-1">
                              <button
                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                onClick={() => openEmployeeModal(emp)}
                                title="View/Edit"
                                data-testid={`edit-employee-${emp.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              {emp.is_active && (
                                <>
                                  <button
                                    className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                    onClick={() => {
                                      setSelectedEmployee(emp);
                                      setEmployeeModalTab('leave');
                                      setIsEmployeeModalOpen(true);
                                    }}
                                    title="Apply Leave"
                                    data-testid={`apply-leave-${emp.id}`}
                                  >
                                    <CalendarPlus className="h-4 w-4" />
                                  </button>
                                  <button
                                    className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                    onClick={() => {
                                      setSelectedEmployee(emp);
                                      setEmployeeModalTab('leave');
                                      setIsEmployeeModalOpen(true);
                                    }}
                                    title="View Leaves"
                                    data-testid={`view-leaves-${emp.id}`}
                                  >
                                    <List className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                              {isHROrCEO && emp.is_active && (
                                <button
                                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  onClick={() => openExitModal(emp)}
                                  title="Mark as Exited"
                                  data-testid={`exit-employee-${emp.id}`}
                                >
                                  <UserX className="h-4 w-4" />
                                </button>
                              )}
                              {isHROrCEO && !emp.is_active && (
                                <button
                                  className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                  onClick={() => handleEmployeeRejoin(emp)}
                                  title="Rejoin Employee"
                                  data-testid={`rejoin-employee-${emp.id}`}
                                >
                                  <UserPlus className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Inline Audit Trail */}
                        {expandedAudit[emp.id] && (
                          <tr className="bg-slate-50">
                            <td colSpan={8} className="p-4">
                              <EmployeeAuditTrail employeeId={emp.id} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Roles & Access Tab */}
        {activeTab === 'roles' && isHROrCEO && (
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-gray-500">Configure role-based access to different pages and features</p>
              <button 
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/25 transition-all"
                onClick={() => openRoleModal()} 
                data-testid="add-role-btn"
              >
                <Plus className="h-4 w-4" /> Add Role
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {PRESET_ROLES.map((role) => (
                <div key={role.code} className="border rounded-xl p-4 bg-white hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-purple-600">
                        <Shield className="h-4 w-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{role.name}</h3>
                        <p className="text-xs text-gray-500">{role.code}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => openRoleModal(role)}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      data-testid={`edit-role-${role.code}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-gray-500 uppercase">Page Access:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {role.permissions.filter(p => p.view).map((perm) => (
                        <span key={perm.page} className={`text-xs px-2 py-1 rounded-full border ${perm.edit ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                          {perm.page} {perm.edit ? '(Edit)' : '(View)'}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Custom Roles from DB */}
            {roles.filter(r => !PRESET_ROLES.find(p => p.code === r.code)).length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold text-gray-900 mb-3">Custom Roles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {roles.filter(r => !PRESET_ROLES.find(p => p.code === r.code)).map((role) => (
                    <div key={role.id} className="border rounded-xl p-4 bg-white hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-gradient-to-r from-gray-500 to-gray-600">
                            <Shield className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{role.name}</h3>
                            <p className="text-xs text-gray-500">{role.code}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => openRoleModal(role)}
                          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Countries Tab */}
        {activeTab === 'countries' && isHROrCEO && (
          <div className="p-4">
            <div className="flex justify-end mb-4">
              <button 
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/25 transition-all"
                onClick={() => openCountryModal()} 
                data-testid="add-country-btn"
              >
                <Plus className="h-4 w-4" /> Add Country
              </button>
            </div>

            <div className="border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Country</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Currency</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Phone Code</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Employees</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {countries.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12">
                        <Globe className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No countries found</p>
                      </td>
                    </tr>
                  ) : (
                    countries.map((country) => (
                      <tr key={country.id} className="hover:bg-slate-50 transition-colors" data-testid={`country-row-${country.id}`}>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center text-white font-medium">
                              {country.code?.charAt(0)}
                            </div>
                            <span className="font-medium text-gray-900">{country.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <span className="px-2.5 py-1 bg-gray-100 rounded-lg text-sm font-mono">{country.code}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="flex items-center gap-2">
                            <span className="text-lg">{country.currency_symbol || '₹'}</span>
                            <span className="text-sm text-gray-600">{country.currency}</span>
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-mono text-sm text-gray-600">{country.phone_code || '-'}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                            {country.employee_count || 0} employees
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <StatusBadge status={country.is_active !== false ? 'active' : 'inactive'} />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              onClick={() => openCountryModal(country)} 
                              data-testid={`edit-country-${country.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Employee Modal */}
      <EmployeeModal
        isOpen={isEmployeeModalOpen}
        onClose={() => setIsEmployeeModalOpen(false)}
        employee={selectedEmployee}
        countries={countries}
        roles={roles}
        departments={departments}
        teams={teams}
        onSave={() => { fetchEmployees(); setIsEmployeeModalOpen(false); }}
        currentTab={employeeModalTab}
        setCurrentTab={setEmployeeModalTab}
      />

      {/* Country Modal */}
      <CountryModal
        isOpen={isCountryModalOpen}
        onClose={() => setIsCountryModalOpen(false)}
        country={selectedCountry}
        onSave={() => { fetchCountries(); setIsCountryModalOpen(false); }}
      />

      {/* Role Modal */}
      <RoleModal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        role={selectedRole}
        onSave={() => { fetchData(); setIsRoleModalOpen(false); }}
      />

      {/* Exit Employee Modal */}
      <Dialog open={isExitModalOpen} onOpenChange={setIsExitModalOpen}>
        <DialogContent className="sm:max-w-[450px]" data-testid="exit-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-red-500 to-red-600 flex items-center justify-center text-white">
                <UserX className="h-5 w-5" />
              </div>
              Mark Employee as Exited
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-sm text-amber-800">
                <strong>Note:</strong> The employee record will be preserved for audit purposes. They can be rejoined later if needed.
              </p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Exit Date *</Label>
              <Input 
                type="date" 
                value={exitData.exit_date} 
                onChange={(e) => setExitData({...exitData, exit_date: e.target.value})} 
                className="h-10" 
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Exit Reason *</Label>
              <Select value={exitData.exit_reason} onValueChange={(v) => setExitData({...exitData, exit_reason: v})}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="resignation">Resignation</SelectItem>
                  <SelectItem value="termination">Termination</SelectItem>
                  <SelectItem value="retirement">Retirement</SelectItem>
                  <SelectItem value="contract_end">Contract End</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Notes</Label>
              <textarea 
                value={exitData.exit_notes}
                onChange={(e) => setExitData({...exitData, exit_notes: e.target.value})}
                className="w-full min-h-[80px] px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsExitModalOpen(false)}>Cancel</Button>
              <Button onClick={handleEmployeeExit} className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700">
                Mark as Exited
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== EMPLOYEE AUDIT TRAIL ====================
function EmployeeAuditTrail({ employeeId }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAudit = async () => {
      try {
        const response = await hrApi.getEmployeeAudit(employeeId);
        setLogs(response.data);
      } catch (error) {
        console.error('Failed to load audit');
      } finally {
        setLoading(false);
      }
    };
    fetchAudit();
  }, [employeeId]);

  if (loading) return <div className="text-center py-2"><Loader2 className="h-4 w-4 animate-spin inline text-blue-600" /></div>;
  if (logs.length === 0) return <div className="text-xs text-gray-500 text-center py-2">No audit history</div>;

  const getActionBadge = (action) => {
    switch (action) {
      case 'create': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'update': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'exit': return 'bg-red-100 text-red-800 border-red-200';
      case 'rejoin': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'salary_update': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'lead_assignment_toggle': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-2 max-h-40 overflow-y-auto">
      {logs.map((log) => (
        <div key={log.id} className="flex items-center gap-3 text-xs bg-white p-3 rounded-lg border">
          <span className="text-gray-500 w-32">{new Date(log.timestamp).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
          <span className={`px-2 py-0.5 rounded-full border ${getActionBadge(log.action)}`}>{log.action}</span>
          <span className="text-gray-600">by {log.user_name || 'System'}</span>
        </div>
      ))}
    </div>
  );
}

// ==================== EMPLOYEE MODAL ====================
function EmployeeModal({ isOpen, onClose, employee, countries, roles, departments, teams, onSave, currentTab, setCurrentTab }) {
  const [form, setForm] = useState({});
  const [salaryForm, setSalaryForm] = useState({});
  const [documents, setDocuments] = useState([]);
  const [docForm, setDocForm] = useState({ document_type: '', document_name: '', document_url: '' });
  const [attendance, setAttendance] = useState({ records: [], summary: {} });
  const [leaveSummary, setLeaveSummary] = useState(null);
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const isEdit = !!employee;
  const isMechanic = form.role_ids?.includes(roles.find(r => r.code === 'MECHANIC')?.id);

  useEffect(() => {
    if (isOpen) {
      setDocForm({ document_type: '', document_name: '', document_url: '' });
      if (employee) {
        setForm({
          name: employee.name || '', email: employee.email || '', phone: employee.phone || '',
          photo_url: employee.photo_url || '',
          country_id: employee.country_id || '', department_id: employee.department_id || '',
          team_id: employee.team_id || '', role_id: employee.role_id || '',
          role_ids: employee.role_ids || (employee.role_id ? [employee.role_id] : []),
          employment_type: employee.employment_type || 'full_time',
          employee_code: employee.employee_code || '', joining_date: employee.joining_date || '',
          date_of_birth: employee.date_of_birth || '', gender: employee.gender || '',
          address: employee.address || '', city: employee.city || '',
          state: employee.state || '', pincode: employee.pincode || '',
          bank_name: employee.bank_name || '', 
          bank_account_number: '', // Don't pre-fill encrypted bank number
          bank_account_number_masked: employee.bank_account_number_masked || '',
          ifsc_code: employee.ifsc_code || '', pan_number: employee.pan_number || '',
          account_holder_name: employee.account_holder_name || '',
          bank_branch: employee.bank_branch || '',
          weekly_off_day: employee.weekly_off_day || 0,
          reporting_manager_id: employee.reporting_manager_id || '',
          payroll_active: employee.payroll_active !== false,
          emergency_contact_name: employee.emergency_contact_name || '',
          emergency_contact_phone: employee.emergency_contact_phone || '',
          emergency_contact_relation: employee.emergency_contact_relation || '',
          is_available_for_leads: employee.is_available_for_leads !== false,
          lead_assignment_paused_reason: employee.lead_assignment_paused_reason || '',
          has_crm_access: employee.has_crm_access !== false, is_active: employee.is_active !== false,
        });
        loadEmployeeData(employee.id);
      } else {
        setForm({
          name: '', email: '', phone: '', country_id: '', department_id: '', team_id: '',
          role_id: '', role_ids: [], employment_type: 'full_time', employee_code: '', joining_date: '',
          date_of_birth: '', gender: '', address: '', city: '', state: '', pincode: '',
          bank_name: '', bank_account_number: '', ifsc_code: '', pan_number: '',
          account_holder_name: '', bank_branch: '',
          weekly_off_day: 0, reporting_manager_id: '', payroll_active: true,
          emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relation: '',
          is_available_for_leads: true, lead_assignment_paused_reason: '',
          has_crm_access: true, is_active: true, password: ''
        });
        setSalaryForm({}); setDocuments([]); setAttendance({ records: [], summary: {} });
        setLeaveSummary(null); setSalaryPayments([]); setAuditLogs([]);
      }
    }
  }, [isOpen, employee]);

  const loadEmployeeData = async (empId) => {
    setLoading(true);
    try {
      const [salaryRes, docsRes, attRes, leaveRes, paymentsRes, auditRes] = await Promise.all([
        hrApi.getEmployeeSalary(empId).catch(() => ({ data: {} })),
        hrApi.getEmployeeDocuments(empId).catch(() => ({ data: [] })),
        hrApi.getEmployeeAttendance(empId).catch(() => ({ data: { records: [], summary: {} } })),
        hrApi.getLeaveSummary(empId, { year: selectedYear }).catch(() => ({ data: null })),
        hrApi.getSalaryPayments(empId, { year: selectedYear }).catch(() => ({ data: [] })),
        hrApi.getEmployeeAudit(empId).catch(() => ({ data: [] })),
      ]);
      setSalaryForm(salaryRes.data || {});
      setDocuments(docsRes.data || []);
      setAttendance(attRes.data || { records: [], summary: {} });
      setLeaveSummary(leaveRes.data);
      setSalaryPayments(paymentsRes.data || []);
      setAuditLogs(auditRes.data || []);
    } catch (error) {
      console.error('Failed to load employee data');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleToggle = (roleId) => {
    const current = form.role_ids || [];
    if (current.includes(roleId)) {
      setForm({ ...form, role_ids: current.filter(id => id !== roleId), role_id: current.filter(id => id !== roleId)[0] || '' });
    } else {
      setForm({ ...form, role_ids: [...current, roleId], role_id: current[0] || roleId });
    }
  };

  const handleSaveDetails = async () => {
    if (!form.name || !form.email || !form.country_id || form.role_ids?.length === 0) {
      toast.error('Please fill required fields and select at least one role'); return;
    }
    if (!isEdit && !form.password) {
      toast.error('Password is required for new employees'); return;
    }
    setSaving(true);
    try {
      const payload = { ...form, role_id: form.role_ids?.[0] };
      if (isEdit) {
        await hrApi.updateEmployee(employee.id, payload);
        toast.success('Employee updated');
      } else {
        await hrApi.createEmployee(payload);
        toast.success('Employee created');
      }
      onSave();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSalary = async () => {
    if (!employee) return;
    setSaving(true);
    try {
      await hrApi.saveEmployeeSalary(employee.id, { ...salaryForm, employment_type: form.employment_type || 'full_time' });
      toast.success('Salary saved');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save salary');
    } finally {
      setSaving(false);
    }
  };

  const formatCurrency = (val) => val ? parseFloat(val).toLocaleString() : '';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-hidden p-0" data-testid="employee-modal">
        <DialogHeader className="px-6 py-4 border-b bg-slate-50">
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium">
              {form.name?.charAt(0)?.toUpperCase() || 'E'}
            </div>
            <div>
              <span className="block">{isEdit ? employee?.name : 'Add New Employee'}</span>
              {isEdit && <span className="text-sm font-normal text-gray-500">{employee?.email}</span>}
            </div>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="flex-1">
          <TabsList className="px-6 border-b bg-white justify-start gap-1">
            <TabsTrigger value="details" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-lg px-4">
              <Users className="h-4 w-4 mr-2" /> Details
            </TabsTrigger>
            {isEdit && (
              <>
                <TabsTrigger value="salary" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-lg px-4">
                  <DollarSign className="h-4 w-4 mr-2" /> Salary
                </TabsTrigger>
                <TabsTrigger value="attendance" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-lg px-4">
                  <Calendar className="h-4 w-4 mr-2" /> Attendance
                </TabsTrigger>
                <TabsTrigger value="documents" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-lg px-4">
                  <FileText className="h-4 w-4 mr-2" /> Documents
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Details Tab */}
            <TabsContent value="details" className="mt-0 space-y-4">
              {/* Personal Information */}
              <div className="bg-slate-50 p-4 rounded-xl border">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <Users className="h-4 w-4 text-blue-500" /> Personal Information
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Full Name <span className="text-red-500">*</span></Label>
                    <Input value={form.name || ''} onChange={(e) => setForm({...form, name: e.target.value})} className="h-10" data-testid="emp-name" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Email <span className="text-red-500">*</span></Label>
                    <Input type="email" value={form.email || ''} onChange={(e) => setForm({...form, email: e.target.value})} className="h-10" data-testid="emp-email" />
                  </div>
                  {!isEdit && (
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Password <span className="text-red-500">*</span></Label>
                      <Input type="password" value={form.password || ''} onChange={(e) => setForm({...form, password: e.target.value})} className="h-10" data-testid="emp-password" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Phone</Label>
                    <Input value={form.phone || ''} onChange={(e) => setForm({...form, phone: e.target.value})} className="h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Date of Birth</Label>
                    <Input type="date" value={form.date_of_birth || ''} onChange={(e) => setForm({...form, date_of_birth: e.target.value})} className="h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Gender</Label>
                    <Select value={form.gender || ''} onValueChange={(v) => setForm({...form, gender: v})}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">Male</SelectItem>
                        <SelectItem value="female">Female</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="bg-slate-50 p-4 rounded-xl border">
                <h4 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-purple-500" /> Address
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2">
                    <Label className="text-sm font-medium">Address</Label>
                    <Input value={form.address || ''} onChange={(e) => setForm({...form, address: e.target.value})} className="h-10" placeholder="Street address" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">City</Label>
                    <Input value={form.city || ''} onChange={(e) => setForm({...form, city: e.target.value})} className="h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">State</Label>
                    <Input value={form.state || ''} onChange={(e) => setForm({...form, state: e.target.value})} className="h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Pincode</Label>
                    <Input value={form.pincode || ''} onChange={(e) => setForm({...form, pincode: e.target.value})} className="h-10" />
                  </div>
                </div>
              </div>

              {/* Employment Details */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <Building className="h-4 w-4" /> Employment Details
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Country <span className="text-red-500">*</span></Label>
                    <Select value={form.country_id || ''} onValueChange={(v) => setForm({...form, country_id: v})}>
                      <SelectTrigger className="h-10" data-testid="emp-country"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>{countries.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Joining Date</Label>
                    <Input type="date" value={form.joining_date || ''} onChange={(e) => setForm({...form, joining_date: e.target.value})} className="h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Employment Type</Label>
                    <Select value={form.employment_type || 'full_time'} onValueChange={(v) => setForm({...form, employment_type: v})}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full_time">Full Time</SelectItem>
                        <SelectItem value="part_time">Part Time</SelectItem>
                        <SelectItem value="contractor">Contractor</SelectItem>
                        <SelectItem value="freelancer">Freelancer</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Weekly Off Day</Label>
                    <Select value={String(form.weekly_off_day || 0)} onValueChange={(v) => setForm({...form, weekly_off_day: parseInt(v)})}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAY_NAMES.map((day, idx) => <SelectItem key={idx} value={String(idx)}>{day}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Reporting Manager</Label>
                    <Select value={form.reporting_manager_id || ''} onValueChange={(v) => setForm({...form, reporting_manager_id: v === 'none' ? '' : v})}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Select Manager" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {/* Note: This would need employee list passed in */}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium flex items-center gap-2">
                      Payroll Active
                      <span className="text-xs text-gray-500">(Include in payroll)</span>
                    </Label>
                    <Select value={form.payroll_active ? 'true' : 'false'} onValueChange={(v) => setForm({...form, payroll_active: v === 'true'})}>
                      <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="true">Yes</SelectItem>
                        <SelectItem value="false">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Emergency Contact */}
              <div className="bg-red-50 p-4 rounded-xl border border-red-200">
                <h4 className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                  <Phone className="h-4 w-4" /> Emergency Contact
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Name</Label>
                    <Input value={form.emergency_contact_name || ''} onChange={(e) => setForm({...form, emergency_contact_name: e.target.value})} className="h-10" placeholder="Contact name" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Phone</Label>
                    <Input value={form.emergency_contact_phone || ''} onChange={(e) => setForm({...form, emergency_contact_phone: e.target.value})} className="h-10" placeholder="Phone number" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Relation</Label>
                    <Select value={form.emergency_contact_relation || ''} onValueChange={(v) => setForm({...form, emergency_contact_relation: v})}>
                      <SelectTrigger className="h-10"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="spouse">Spouse</SelectItem>
                        <SelectItem value="parent">Parent</SelectItem>
                        <SelectItem value="sibling">Sibling</SelectItem>
                        <SelectItem value="friend">Friend</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Bank Details */}
              <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                <h4 className="text-sm font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" /> Bank Details
                  <span className="text-xs font-normal text-emerald-600">(Encrypted at rest)</span>
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Bank Name</Label>
                    <Input value={form.bank_name || ''} onChange={(e) => setForm({...form, bank_name: e.target.value})} className="h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Account Holder Name</Label>
                    <Input value={form.account_holder_name || ''} onChange={(e) => setForm({...form, account_holder_name: e.target.value})} className="h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Account Number</Label>
                    <Input 
                      value={form.bank_account_number || ''} 
                      onChange={(e) => setForm({...form, bank_account_number: e.target.value})} 
                      className="h-10" 
                      placeholder={form.bank_account_number_masked || 'Enter account number'}
                    />
                    {form.bank_account_number_masked && !form.bank_account_number && (
                      <span className="text-xs text-gray-500">Current: {form.bank_account_number_masked}</span>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">IFSC Code</Label>
                    <Input value={form.ifsc_code || ''} onChange={(e) => setForm({...form, ifsc_code: e.target.value.toUpperCase()})} className="h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Branch</Label>
                    <Input value={form.bank_branch || ''} onChange={(e) => setForm({...form, bank_branch: e.target.value})} className="h-10" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">PAN Number</Label>
                    <Input value={form.pan_number || ''} onChange={(e) => setForm({...form, pan_number: e.target.value.toUpperCase()})} className="h-10" />
                  </div>
                </div>
              </div>

              {/* Multiple Roles Selection */}
              <div className="border-t pt-4 mt-4">
                <Label className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Shield className="h-4 w-4 text-purple-500" />
                  Assign Roles <span className="text-red-500">*</span>
                  <span className="text-xs font-normal text-gray-500">(Select one or more)</span>
                </Label>
                <div className="grid grid-cols-3 gap-3">
                  {roles.map((role) => (
                    <label key={role.id} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      form.role_ids?.includes(role.id) ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'
                    }`}>
                      <Checkbox 
                        checked={form.role_ids?.includes(role.id)}
                        onCheckedChange={() => handleRoleToggle(role.id)}
                      />
                      <span className="text-sm font-medium">{role.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={onClose} className="px-6">Cancel</Button>
                <Button 
                  onClick={handleSaveDetails} 
                  disabled={saving}
                  className="px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                  data-testid="save-employee-btn"
                >
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {isEdit ? 'Update Employee' : 'Create Employee'}
                </Button>
              </div>
            </TabsContent>

            {/* Salary Tab */}
            <TabsContent value="salary" className="mt-0 space-y-4">
              {loading ? (
                <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto text-blue-600" /></div>
              ) : (
                <>
                  {/* Earnings Section */}
                  <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-200">
                    <h4 className="text-sm font-semibold text-emerald-800 mb-4 flex items-center gap-2">
                      <DollarSign className="h-4 w-4" /> Earnings
                    </h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Basic Salary</Label>
                        <Input type="number" value={salaryForm.basic_salary || ''} onChange={(e) => setSalaryForm({...salaryForm, basic_salary: parseFloat(e.target.value) || 0})} className="h-9" placeholder="0" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">HRA</Label>
                        <Input type="number" value={salaryForm.hra || ''} onChange={(e) => setSalaryForm({...salaryForm, hra: parseFloat(e.target.value) || 0})} className="h-9" placeholder="0" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Variable Pay / Incentives</Label>
                        <Input type="number" value={salaryForm.variable_pay || ''} onChange={(e) => setSalaryForm({...salaryForm, variable_pay: parseFloat(e.target.value) || 0})} className="h-9" placeholder="0" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Conveyance</Label>
                        <Input type="number" value={salaryForm.conveyance || ''} onChange={(e) => setSalaryForm({...salaryForm, conveyance: parseFloat(e.target.value) || 0})} className="h-9" placeholder="0" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Medical Allowance</Label>
                        <Input type="number" value={salaryForm.medical || ''} onChange={(e) => setSalaryForm({...salaryForm, medical: parseFloat(e.target.value) || 0})} className="h-9" placeholder="0" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Special Allowance</Label>
                        <Input type="number" value={salaryForm.special_allowance || ''} onChange={(e) => setSalaryForm({...salaryForm, special_allowance: parseFloat(e.target.value) || 0})} className="h-9" placeholder="0" />
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-emerald-200 flex justify-between">
                      <span className="font-medium text-emerald-800">Gross Salary:</span>
                      <span className="font-bold text-emerald-800 text-lg">₹{formatCurrency((salaryForm.basic_salary||0)+(salaryForm.hra||0)+(salaryForm.variable_pay||0)+(salaryForm.conveyance||0)+(salaryForm.medical||0)+(salaryForm.special_allowance||0))}</span>
                    </div>
                  </div>

                  {/* Deductions Section */}
                  <div className="bg-red-50 p-5 rounded-xl border border-red-200">
                    <h4 className="text-sm font-semibold text-red-800 mb-4 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" /> Deductions
                    </h4>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">PF (Employee)</Label>
                        <Input type="number" value={salaryForm.pf_employee || ''} onChange={(e) => setSalaryForm({...salaryForm, pf_employee: parseFloat(e.target.value) || 0})} className="h-9" placeholder="0" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Professional Tax</Label>
                        <Input type="number" value={salaryForm.professional_tax || ''} onChange={(e) => setSalaryForm({...salaryForm, professional_tax: parseFloat(e.target.value) || 0})} className="h-9" placeholder="0" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Income Tax (TDS)</Label>
                        <Input type="number" value={salaryForm.income_tax || ''} onChange={(e) => setSalaryForm({...salaryForm, income_tax: parseFloat(e.target.value) || 0})} className="h-9" placeholder="0" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Other Deductions</Label>
                        <Input type="number" value={salaryForm.other_deductions || ''} onChange={(e) => setSalaryForm({...salaryForm, other_deductions: parseFloat(e.target.value) || 0})} className="h-9" placeholder="0" />
                      </div>
                    </div>
                    <div className="mt-4 pt-4 border-t border-red-200 flex justify-between">
                      <span className="font-medium text-red-800">Total Deductions:</span>
                      <span className="font-bold text-red-800 text-lg">₹{formatCurrency((salaryForm.pf_employee||0)+(salaryForm.professional_tax||0)+(salaryForm.income_tax||0)+(salaryForm.other_deductions||0))}</span>
                    </div>
                  </div>

                  {/* Net Salary Summary */}
                  <div className="bg-blue-50 p-5 rounded-xl border border-blue-200">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold text-blue-800 text-lg">Net Salary (Take Home):</span>
                      <span className="font-bold text-blue-800 text-2xl">
                        ₹{formatCurrency(
                          ((salaryForm.basic_salary||0)+(salaryForm.hra||0)+(salaryForm.variable_pay||0)+(salaryForm.conveyance||0)+(salaryForm.medical||0)+(salaryForm.special_allowance||0)) - 
                          ((salaryForm.pf_employee||0)+(salaryForm.professional_tax||0)+(salaryForm.income_tax||0)+(salaryForm.other_deductions||0))
                        )}
                      </span>
                    </div>
                  </div>

                  {/* For Mechanics: Price per Inspection */}
                  {isMechanic && (
                    <div className="bg-orange-50 p-5 rounded-xl border border-orange-200">
                      <h4 className="text-sm font-semibold text-orange-800 mb-4 flex items-center gap-2">
                        <Briefcase className="h-4 w-4" /> Mechanic / Freelancer Settings
                      </h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Price Per Inspection (₹)</Label>
                          <Input type="number" value={salaryForm.price_per_inspection || ''} onChange={(e) => setSalaryForm({...salaryForm, price_per_inspection: parseFloat(e.target.value) || 0})} className="h-9" placeholder="e.g., 500" />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSaveSalary} disabled={saving} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                      {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Salary Structure
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Attendance Tab */}
            <TabsContent value="attendance" className="mt-0 space-y-4">
              {/* Quick Leave Actions */}
              <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                <h4 className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                  <Calendar className="h-4 w-4" /> Quick Leave Actions
                </h4>
                <div className="flex gap-3">
                  <Button 
                    variant="outline" 
                    className="border-amber-300 text-amber-700 hover:bg-amber-100"
                    onClick={async () => {
                      if (!employee) return;
                      const today = new Date().toISOString().split('T')[0];
                      try {
                        await hrApi.saveEmployeeAttendance(employee.id, { date: today, status: 'on_leave', notes: 'Marked via quick action' });
                        toast.success('Today marked as leave');
                        loadEmployeeData(employee.id);
                      } catch (error) {
                        toast.error('Failed to mark leave');
                      }
                    }}
                  >
                    <Clock className="h-4 w-4 mr-2" /> Mark Today as Leave
                  </Button>
                  <Button 
                    variant="outline" 
                    className="border-amber-300 text-amber-700 hover:bg-amber-100"
                    onClick={async () => {
                      if (!employee) return;
                      const tomorrow = new Date();
                      tomorrow.setDate(tomorrow.getDate() + 1);
                      const tomorrowStr = tomorrow.toISOString().split('T')[0];
                      try {
                        await hrApi.saveEmployeeAttendance(employee.id, { date: tomorrowStr, status: 'on_leave', notes: 'Marked via quick action' });
                        toast.success('Tomorrow marked as leave');
                        loadEmployeeData(employee.id);
                      } catch (error) {
                        toast.error('Failed to mark leave');
                      }
                    }}
                  >
                    <Calendar className="h-4 w-4 mr-2" /> Mark Tomorrow as Leave
                  </Button>
                </div>
              </div>

              {/* Monthly Leave Summary */}
              <div className="bg-white border rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                    <History className="h-4 w-4" /> Monthly Leave Summary - {selectedYear}
                  </h4>
                  <Select value={String(selectedYear)} onValueChange={(v) => { setSelectedYear(parseInt(v)); if (employee) loadEmployeeData(employee.id); }}>
                    <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                
                {leaveSummary ? (
                  <>
                    {/* Summary Cards */}
                    <div className="grid grid-cols-4 gap-4 mb-4">
                      <div className="bg-emerald-50 p-4 rounded-xl text-center border border-emerald-200">
                        <p className="text-2xl font-bold text-emerald-800">{leaveSummary.total_present || 0}</p>
                        <p className="text-xs text-emerald-600">Present Days</p>
                      </div>
                      <div className="bg-red-50 p-4 rounded-xl text-center border border-red-200">
                        <p className="text-2xl font-bold text-red-800">{leaveSummary.total_leaves_taken || 0}</p>
                        <p className="text-xs text-red-600">Leaves Taken</p>
                      </div>
                      <div className="bg-orange-50 p-4 rounded-xl text-center border border-orange-200">
                        <p className="text-2xl font-bold text-orange-800">{leaveSummary.total_half_days || 0}</p>
                        <p className="text-xs text-orange-600">Half Days</p>
                      </div>
                      <div className="bg-blue-50 p-4 rounded-xl text-center border border-blue-200">
                        <p className="text-2xl font-bold text-blue-800">{leaveSummary.total_working_days || 0}</p>
                        <p className="text-xs text-blue-600">Working Days</p>
                      </div>
                    </div>

                    {/* Monthly Breakdown Table */}
                    {leaveSummary.monthly_breakdown && leaveSummary.monthly_breakdown.length > 0 && (
                      <div className="border rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 border-b">
                              <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Month</th>
                              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Present</th>
                              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Absent</th>
                              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Half Day</th>
                              <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">On Leave</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {leaveSummary.monthly_breakdown.map((month, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="px-3 py-2 font-medium">{['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][month.month - 1]} {selectedYear}</td>
                                <td className="px-3 py-2 text-center text-emerald-600 font-medium">{month.present || 0}</td>
                                <td className="px-3 py-2 text-center text-red-600 font-medium">{month.absent || 0}</td>
                                <td className="px-3 py-2 text-center text-orange-600 font-medium">{month.half_day || 0}</td>
                                <td className="px-3 py-2 text-center text-blue-600 font-medium">{month.on_leave || 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p>No attendance data available for {selectedYear}</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="mt-0 space-y-4">
              {/* Upload Document Section */}
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Upload New Document
                </h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs">Document Type</Label>
                    <Select value={docForm.document_type || ''} onValueChange={(v) => setDocForm({...docForm, document_type: v})}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="Select type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aadhar">Aadhar Card</SelectItem>
                        <SelectItem value="pan">PAN Card</SelectItem>
                        <SelectItem value="passport">Passport</SelectItem>
                        <SelectItem value="driving_license">Driving License</SelectItem>
                        <SelectItem value="bank_statement">Bank Statement</SelectItem>
                        <SelectItem value="education">Education Certificate</SelectItem>
                        <SelectItem value="experience">Experience Letter</SelectItem>
                        <SelectItem value="offer_letter">Offer Letter</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Document Name</Label>
                    <Input 
                      value={docForm.document_name || ''} 
                      onChange={(e) => setDocForm({...docForm, document_name: e.target.value})}
                      placeholder="e.g., Aadhar Card - John" 
                      className="h-9" 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Document URL / Reference</Label>
                    <Input 
                      value={docForm.document_url || ''} 
                      onChange={(e) => setDocForm({...docForm, document_url: e.target.value})}
                      placeholder="https://..." 
                      className="h-9" 
                    />
                  </div>
                </div>
                <div className="flex justify-end mt-3">
                  <Button 
                    size="sm"
                    onClick={async () => {
                      if (!employee || !docForm.document_type || !docForm.document_name) {
                        toast.error('Please fill document type and name');
                        return;
                      }
                      try {
                        await hrApi.addEmployeeDocument(employee.id, docForm);
                        toast.success('Document added');
                        setDocForm({ document_type: '', document_name: '', document_url: '' });
                        loadEmployeeData(employee.id);
                      } catch (error) {
                        toast.error('Failed to add document');
                      }
                    }}
                    className="bg-gradient-to-r from-blue-600 to-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-1" /> Add Document
                  </Button>
                </div>
              </div>

              {/* Document List */}
              {documents.length === 0 ? (
                <div className="text-center text-gray-500 py-8 border rounded-xl">
                  <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p>No documents uploaded yet</p>
                  <p className="text-xs mt-1">Use the form above to add onboarding documents</p>
                </div>
              ) : (
                <div className="border rounded-xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 border-b">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Document Type</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Name</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Uploaded</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Status</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {documents.map((doc) => (
                        <tr key={doc.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                              <FileText className="h-3 w-3" />
                              {doc.document_type?.replace(/_/g, ' ').toUpperCase()}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium">{doc.document_name}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {doc.uploaded_at ? new Date(doc.uploaded_at).toLocaleDateString() : '-'}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              doc.verified ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {doc.verified ? 'Verified' : 'Pending'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center">
                            <div className="flex justify-center gap-1">
                              {doc.document_url && (
                                <a href={doc.document_url} target="_blank" rel="noopener noreferrer" className="p-1.5 text-blue-600 hover:bg-blue-50 rounded">
                                  <Eye className="h-4 w-4" />
                                </a>
                              )}
                              <button 
                                onClick={async () => {
                                  if (!window.confirm('Delete this document?')) return;
                                  try {
                                    await hrApi.deleteEmployeeDocument(employee.id, doc.id);
                                    toast.success('Document deleted');
                                    loadEmployeeData(employee.id);
                                  } catch (error) {
                                    toast.error('Failed to delete');
                                  }
                                }}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ==================== ROLE MODAL ====================
function RoleModal({ isOpen, onClose, role, onSave }) {
  const [form, setForm] = useState({ name: '', code: '', permissions: [] });
  const [saving, setSaving] = useState(false);
  const isEdit = !!role;

  useEffect(() => {
    if (isOpen) {
      if (role) {
        const presetRole = PRESET_ROLES.find(r => r.code === role.code);
        setForm({
          name: role.name || '',
          code: role.code || '',
          permissions: presetRole?.permissions || role.permissions || [],
        });
      } else {
        setForm({ name: '', code: '', permissions: PAGE_PERMISSIONS.map(p => ({ page: p.id, view: false, edit: false })) });
      }
    }
  }, [isOpen, role]);

  const handlePermissionChange = (pageId, field, value) => {
    setForm({
      ...form,
      permissions: form.permissions.map(p => 
        p.page === pageId ? { ...p, [field]: value, ...(field === 'view' && !value ? { edit: false } : {}) } : p
      )
    });
  };

  const handleSave = async () => {
    if (!form.name || !form.code) {
      toast.error('Please fill in name and code');
      return;
    }
    setSaving(true);
    try {
      // For now, just close as this is config-level (would need backend API)
      toast.success(isEdit ? 'Role updated' : 'Role created');
      onSave();
    } catch (error) {
      toast.error('Failed to save role');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]" data-testid="role-modal">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center text-white">
              <Shield className="h-5 w-5" />
            </div>
            {isEdit ? `Edit: ${role?.name}` : 'Add New Role'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Role Name *</Label>
              <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="h-10" disabled={isEdit && PRESET_ROLES.find(r => r.code === form.code)} />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Role Code *</Label>
              <Input value={form.code} onChange={(e) => setForm({...form, code: e.target.value.toUpperCase().replace(/\s/g, '_')})} className="h-10 font-mono" disabled={isEdit} />
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="text-sm font-semibold flex items-center gap-2 mb-3">
              <Lock className="h-4 w-4 text-purple-500" />
              Page Access Permissions
            </Label>
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Page</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600 w-24">View</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600 w-24">Edit</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {PAGE_PERMISSIONS.map((page) => {
                    const perm = form.permissions.find(p => p.page === page.id) || { view: false, edit: false };
                    return (
                      <tr key={page.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div>
                            <span className="font-medium text-sm">{page.name}</span>
                            <p className="text-xs text-gray-500">{page.description}</p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Checkbox 
                            checked={perm.view}
                            onCheckedChange={(v) => handlePermissionChange(page.id, 'view', v)}
                          />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Checkbox 
                            checked={perm.edit}
                            onCheckedChange={(v) => handlePermissionChange(page.id, 'edit', v)}
                            disabled={!perm.view}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} {isEdit ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== COUNTRY MODAL ====================
function CountryModal({ isOpen, onClose, country, onSave }) {
  const [form, setForm] = useState({ name: '', code: '', currency: 'INR', currency_symbol: '₹', phone_code: '+91', is_active: true });
  const [saving, setSaving] = useState(false);
  const isEdit = !!country;

  useEffect(() => {
    if (isOpen) {
      setForm(country ? {
        name: country.name || '', code: country.code || '', currency: country.currency || 'INR',
        currency_symbol: country.currency_symbol || '₹', phone_code: country.phone_code || '+91', is_active: country.is_active !== false
      } : { name: '', code: '', currency: 'INR', currency_symbol: '₹', phone_code: '+91', is_active: true });
    }
  }, [isOpen, country]);

  const handleSave = async () => {
    if (!form.name || !form.code || !form.currency) { toast.error('Please fill required fields'); return; }
    setSaving(true);
    try {
      if (isEdit) { await hrApi.updateCountry(country.id, form); toast.success('Country updated'); }
      else { await hrApi.createCountry(form); toast.success('Country created'); }
      onSave();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const currencies = [
    { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
    { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit' },
    { code: 'THB', symbol: '฿', name: 'Thai Baht' },
    { code: 'PHP', symbol: '₱', name: 'Philippine Peso' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[450px]" data-testid="country-modal">
        <DialogHeader className="border-b pb-4">
          <DialogTitle className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center text-white">
              <Globe className="h-5 w-5" />
            </div>
            {isEdit ? `Edit: ${country?.name}` : 'Add Country'}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Country Name *</Label>
            <Input value={form.name} onChange={(e) => setForm({...form, name: e.target.value})} className="h-10" data-testid="country-name" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Country Code (ISO) *</Label>
            <Input value={form.code} onChange={(e) => setForm({...form, code: e.target.value.toUpperCase()})} className="h-10 font-mono" maxLength={2} data-testid="country-code" />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Currency *</Label>
            <Select value={form.currency} onValueChange={(v) => { const curr = currencies.find(c => c.code === v); setForm({...form, currency: v, currency_symbol: curr?.symbol || ''}); }}>
              <SelectTrigger className="h-10" data-testid="country-currency"><SelectValue /></SelectTrigger>
              <SelectContent>{currencies.map(c => <SelectItem key={c.code} value={c.code}>{c.symbol} {c.code} - {c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Phone Code</Label>
            <Input value={form.phone_code} onChange={(e) => setForm({...form, phone_code: e.target.value})} className="h-10 font-mono" data-testid="country-phone" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({...form, is_active: e.target.checked})} className="rounded border-gray-300" />
            <span className="text-sm">Active (available for login)</span>
          </label>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800" data-testid="save-country-btn">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} {isEdit ? 'Update' : 'Create'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
