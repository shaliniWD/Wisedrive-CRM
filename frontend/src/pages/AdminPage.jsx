import React, { useState, useEffect, useCallback } from 'react';
import { hrApi, rolesApi, departmentsApi, teamsApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Plus, Loader2, Pencil, Trash2, Users, Globe, Search, ChevronDown, ChevronUp,
  FileText, Calendar, DollarSign, History, Eye, X, PauseCircle, PlayCircle,
  Building, Phone, Mail, MapPin, Briefcase, Clock, CheckCircle, AlertCircle
} from 'lucide-react';

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Status Badge Component
const StatusBadge = ({ isActive, small = false }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
    isActive 
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200' 
      : 'bg-red-100 text-red-800 border-red-200'
  } ${small ? 'text-[10px] px-1.5' : ''}`}>
    {isActive ? 'Active' : 'Inactive'}
  </span>
);

// Role Badge Component
const RoleBadge = ({ roleCode, roleName }) => {
  const colors = {
    CEO: 'bg-purple-100 text-purple-800 border-purple-200',
    HR_MANAGER: 'bg-blue-100 text-blue-800 border-blue-200',
    MECHANIC: 'bg-orange-100 text-orange-800 border-orange-200',
    FINANCE_MANAGER: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    COUNTRY_HEAD: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${colors[roleCode] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
      {roleName || roleCode || '-'}
    </span>
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
        'from-gray-500 to-gray-600'
      }`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
    </div>
  </div>
);

export default function AdminPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [countries, setCountries] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('employees');
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterRole, setFilterRole] = useState('');
  
  // Modal states
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isCountryModalOpen, setIsCountryModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedCountry, setSelectedCountry] = useState(null);
  
  // Employee modal tabs
  const [employeeModalTab, setEmployeeModalTab] = useState('details');
  
  // Expanded audit rows
  const [expandedAudit, setExpandedAudit] = useState({});

  const isHROrCEO = user?.role_code === 'CEO' || user?.role_code === 'HR_MANAGER';

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
      
      const response = await hrApi.getEmployees(params);
      setEmployees(response.data);
    } catch (error) {
      if (error.response?.status !== 403) {
        toast.error('Failed to load employees');
      }
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterCountry, filterRole]);

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

  // Format currency
  const formatCurrency = (amount, symbol = '₹') => {
    if (!amount) return '-';
    return `${symbol}${new Intl.NumberFormat('en-IN').format(amount)}`;
  };

  // Stats
  const activeEmployees = employees.filter(e => e.is_active).length;
  const mechanicCount = employees.filter(e => e.role_code === 'MECHANIC').length;

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
        <SummaryCard title="Mechanics" value={mechanicCount} icon={Briefcase} color="text-amber-600" />
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
                  <SelectTrigger className="w-40 h-10" data-testid="filter-country">
                    <SelectValue placeholder="All Countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {countries.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>

                <Select value={filterRole || 'all'} onValueChange={(v) => setFilterRole(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-40 h-10" data-testid="filter-role">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
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
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Role</th>
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
                        <tr className="hover:bg-slate-50 transition-colors" data-testid={`employee-row-${emp.id}`}>
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium">
                                {emp.name?.charAt(0)?.toUpperCase()}
                              </div>
                              <div>
                                <span className="font-medium text-gray-900 block">{emp.name}</span>
                                <span className="text-xs text-gray-500">{emp.email}</span>
                                {emp.employee_code && <span className="text-xs text-gray-400 ml-2">({emp.employee_code})</span>}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <RoleBadge roleCode={emp.role_code} roleName={emp.role_name} />
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
                              <StatusBadge isActive={emp.is_active} />
                              {emp.has_crm_access === false && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 border border-amber-200">No CRM</span>
                              )}
                              {emp.is_available_for_leads === false && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-red-100 text-red-700 border border-red-200">
                                  <PauseCircle className="h-2.5 w-2.5" /> No Leads
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            {emp.salary_info ? (
                              <div className="text-xs">
                                {emp.role_code === 'MECHANIC' || emp.salary_info.employment_type === 'freelancer' ? (
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
                            <div className="flex items-center gap-2">
                              <button
                                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                onClick={() => openEmployeeModal(emp)}
                                title="View/Edit"
                                data-testid={`edit-employee-${emp.id}`}
                              >
                                <Eye className="h-4 w-4" />
                              </button>
                              {isHROrCEO && (
                                <button
                                  className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                  onClick={async () => {
                                    if (window.confirm(`Deactivate ${emp.name}?`)) {
                                      try {
                                        await hrApi.deleteEmployee(emp.id);
                                        toast.success('Employee deactivated');
                                        fetchEmployees();
                                      } catch (e) {
                                        toast.error('Failed to deactivate');
                                      }
                                    }
                                  }}
                                  title="Deactivate"
                                  data-testid={`delete-employee-${emp.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
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
                          <StatusBadge isActive={country.is_active !== false} />
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
                            {(!country.employee_count || country.employee_count === 0) && (
                              <button
                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                onClick={async () => {
                                  if (window.confirm(`Delete ${country.name}?`)) {
                                    try {
                                      await hrApi.deleteCountry(country.id);
                                      toast.success('Country deleted');
                                      fetchCountries();
                                    } catch (e) {
                                      toast.error(e.response?.data?.detail || 'Failed to delete');
                                    }
                                  }
                                }}
                                data-testid={`delete-country-${country.id}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
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
      case 'delete': return 'bg-red-100 text-red-800 border-red-200';
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
  const [attendance, setAttendance] = useState({ records: [], summary: {} });
  const [leaveSummary, setLeaveSummary] = useState(null);
  const [salaryPayments, setSalaryPayments] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const isEdit = !!employee;
  const isMechanic = roles.find(r => r.id === form.role_id)?.code === 'MECHANIC';

  useEffect(() => {
    if (isOpen) {
      if (employee) {
        setForm({
          name: employee.name || '', email: employee.email || '', phone: employee.phone || '',
          country_id: employee.country_id || '', department_id: employee.department_id || '',
          team_id: employee.team_id || '', role_id: employee.role_id || '',
          employment_type: employee.employment_type || 'full_time',
          employee_code: employee.employee_code || '', joining_date: employee.joining_date || '',
          date_of_birth: employee.date_of_birth || '', gender: employee.gender || '',
          address: employee.address || '', city: employee.city || '',
          bank_name: employee.bank_name || '', bank_account_number: employee.bank_account_number || '',
          ifsc_code: employee.ifsc_code || '', pan_number: employee.pan_number || '',
          weekly_off_day: employee.weekly_off_day || 0,
          is_available_for_leads: employee.is_available_for_leads !== false,
          lead_assignment_paused_reason: employee.lead_assignment_paused_reason || '',
          has_crm_access: employee.has_crm_access !== false, is_active: employee.is_active !== false,
        });
        loadEmployeeData(employee.id);
      } else {
        setForm({
          name: '', email: '', phone: '', country_id: '', department_id: '', team_id: '',
          role_id: '', employment_type: 'full_time', employee_code: '', joining_date: '',
          date_of_birth: '', gender: '', address: '', city: '', bank_name: '',
          bank_account_number: '', ifsc_code: '', pan_number: '', weekly_off_day: 0,
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

  const handleSaveDetails = async () => {
    if (!form.name || !form.email || !form.country_id || !form.role_id) {
      toast.error('Please fill required fields'); return;
    }
    if (!isEdit && !form.password) {
      toast.error('Password is required for new employees'); return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        await hrApi.updateEmployee(employee.id, form);
        toast.success('Employee updated');
      } else {
        await hrApi.createEmployee(form);
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

  const handleToggleLeadAssignment = async () => {
    if (!employee) return;
    const newValue = !form.is_available_for_leads;
    try {
      await hrApi.toggleLeadAssignment(employee.id, {
        is_available_for_leads: newValue,
        reason: form.lead_assignment_paused_reason
      });
      setForm({ ...form, is_available_for_leads: newValue });
      toast.success(newValue ? 'Lead assignment enabled' : 'Lead assignment paused');
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const handleUpdateWeeklyOff = async (day) => {
    if (!employee) return;
    try {
      await hrApi.updateWeeklyOff(employee.id, { weekly_off_day: day });
      setForm({ ...form, weekly_off_day: day });
      toast.success('Weekly off updated');
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const handleMarkAttendance = async (status) => {
    if (!employee) return;
    const today = new Date().toISOString().split('T')[0];
    try {
      await hrApi.saveEmployeeAttendance(employee.id, { date: today, status });
      toast.success(`Marked as ${status}`);
      loadEmployeeData(employee.id);
    } catch (error) {
      toast.error('Failed to update attendance');
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
                <TabsTrigger value="audit" className="data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-lg px-4">
                  <History className="h-4 w-4 mr-2" /> Audit
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Details Tab */}
            <TabsContent value="details" className="mt-0 space-y-4">
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
                  <Label className="text-sm font-medium">Country <span className="text-red-500">*</span></Label>
                  <Select value={form.country_id || ''} onValueChange={(v) => setForm({...form, country_id: v})}>
                    <SelectTrigger className="h-10" data-testid="emp-country"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{countries.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Role <span className="text-red-500">*</span></Label>
                  <Select value={form.role_id || ''} onValueChange={(v) => setForm({...form, role_id: v})}>
                    <SelectTrigger className="h-10" data-testid="emp-role"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Department</Label>
                  <Select value={form.department_id || ''} onValueChange={(v) => setForm({...form, department_id: v})}>
                    <SelectTrigger className="h-10"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Employment Type</Label>
                  <Select value={form.employment_type || 'full_time'} onValueChange={(v) => setForm({...form, employment_type: v})}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full Time</SelectItem>
                      <SelectItem value="part_time">Part Time</SelectItem>
                      <SelectItem value="freelancer">Freelancer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Weekly Off Day</Label>
                  <Select value={String(form.weekly_off_day || 0)} onValueChange={(v) => isEdit ? handleUpdateWeeklyOff(parseInt(v)) : setForm({...form, weekly_off_day: parseInt(v)})}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAY_NAMES.map((day, idx) => <SelectItem key={idx} value={String(idx)}>{day}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Joining Date</Label>
                  <Input type="date" value={form.joining_date || ''} onChange={(e) => setForm({...form, joining_date: e.target.value})} className="h-10" />
                </div>
              </div>

              {/* Lead Assignment Control */}
              {isEdit && (
                <div className="border-t pt-4 mt-4">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-500" />
                    Lead Assignment Control
                  </h4>
                  <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl border">
                    <div className="flex-1">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={form.is_available_for_leads || false}
                          onChange={handleToggleLeadAssignment}
                          className="rounded border-gray-300"
                        />
                        <span className="text-sm font-medium">Available for New Leads</span>
                      </label>
                      <p className="text-xs text-gray-500 mt-1 ml-6">
                        When unchecked, this employee will not receive new leads via round-robin assignment
                      </p>
                    </div>
                    {!form.is_available_for_leads && (
                      <div className="flex-1">
                        <Label className="text-xs">Reason (optional)</Label>
                        <Input
                          value={form.lead_assignment_paused_reason || ''}
                          onChange={(e) => setForm({...form, lead_assignment_paused_reason: e.target.value})}
                          placeholder="e.g., On training, Overloaded"
                          className="h-9 mt-1"
                        />
                      </div>
                    )}
                  </div>

                  {/* Quick Attendance */}
                  <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-200">
                    <h5 className="text-sm font-medium text-blue-800 mb-3">Mark Today's Attendance</h5>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition-colors" onClick={() => handleMarkAttendance('present')}>Present</button>
                      <button className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600 transition-colors" onClick={() => handleMarkAttendance('absent')}>Absent</button>
                      <button className="px-4 py-2 bg-amber-500 text-white rounded-lg text-sm font-medium hover:bg-amber-600 transition-colors" onClick={() => handleMarkAttendance('half_day')}>Half Day</button>
                      <button className="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm font-medium hover:bg-blue-600 transition-colors" onClick={() => handleMarkAttendance('on_leave')}>On Leave</button>
                    </div>
                    <p className="text-xs text-blue-600 mt-2">Marking absent will exclude from lead assignment for today</p>
                  </div>
                </div>
              )}

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
                  {(isMechanic || form.employment_type === 'freelancer') ? (
                    <div className="space-y-4">
                      <div className="bg-orange-50 p-5 rounded-xl border border-orange-200">
                        <h4 className="text-sm font-semibold text-orange-800 mb-4 flex items-center gap-2">
                          <Briefcase className="h-4 w-4" />
                          Freelancer / Mechanic Compensation
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm">Price Per Inspection</Label>
                            <Input type="number" value={salaryForm.price_per_inspection || ''} onChange={(e) => setSalaryForm({...salaryForm, price_per_inspection: parseFloat(e.target.value) || 0})} className="h-10" data-testid="salary-per-inspection" />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-sm">Commission %</Label>
                            <Input type="number" step="0.1" value={salaryForm.commission_percentage || ''} onChange={(e) => setSalaryForm({...salaryForm, commission_percentage: parseFloat(e.target.value) || 0})} className="h-10" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-200">
                        <h4 className="text-sm font-semibold text-emerald-800 mb-4">Earnings</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-2"><Label className="text-xs">Basic Salary</Label><Input type="number" value={salaryForm.basic_salary || ''} onChange={(e) => setSalaryForm({...salaryForm, basic_salary: parseFloat(e.target.value) || 0})} className="h-9" /></div>
                          <div className="space-y-2"><Label className="text-xs">HRA</Label><Input type="number" value={salaryForm.hra || ''} onChange={(e) => setSalaryForm({...salaryForm, hra: parseFloat(e.target.value) || 0})} className="h-9" /></div>
                          <div className="space-y-2"><Label className="text-xs">Variable Pay</Label><Input type="number" value={salaryForm.variable_pay || ''} onChange={(e) => setSalaryForm({...salaryForm, variable_pay: parseFloat(e.target.value) || 0})} className="h-9" /></div>
                          <div className="space-y-2"><Label className="text-xs">Conveyance</Label><Input type="number" value={salaryForm.conveyance_allowance || ''} onChange={(e) => setSalaryForm({...salaryForm, conveyance_allowance: parseFloat(e.target.value) || 0})} className="h-9" /></div>
                          <div className="space-y-2"><Label className="text-xs">Medical</Label><Input type="number" value={salaryForm.medical_allowance || ''} onChange={(e) => setSalaryForm({...salaryForm, medical_allowance: parseFloat(e.target.value) || 0})} className="h-9" /></div>
                          <div className="space-y-2"><Label className="text-xs">Special</Label><Input type="number" value={salaryForm.special_allowance || ''} onChange={(e) => setSalaryForm({...salaryForm, special_allowance: parseFloat(e.target.value) || 0})} className="h-9" /></div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-emerald-200 flex justify-between">
                          <span className="font-medium text-emerald-800">Gross Salary:</span>
                          <span className="font-bold text-emerald-800 text-lg">₹{formatCurrency((salaryForm.basic_salary||0)+(salaryForm.hra||0)+(salaryForm.variable_pay||0)+(salaryForm.conveyance_allowance||0)+(salaryForm.medical_allowance||0)+(salaryForm.special_allowance||0))}</span>
                        </div>
                      </div>

                      <div className="bg-red-50 p-5 rounded-xl border border-red-200">
                        <h4 className="text-sm font-semibold text-red-800 mb-4">Deductions</h4>
                        <div className="grid grid-cols-4 gap-4">
                          <div className="space-y-2"><Label className="text-xs">PF (Employee)</Label><Input type="number" value={salaryForm.pf_employee || ''} onChange={(e) => setSalaryForm({...salaryForm, pf_employee: parseFloat(e.target.value) || 0})} className="h-9" /></div>
                          <div className="space-y-2"><Label className="text-xs">Professional Tax</Label><Input type="number" value={salaryForm.professional_tax || ''} onChange={(e) => setSalaryForm({...salaryForm, professional_tax: parseFloat(e.target.value) || 0})} className="h-9" /></div>
                          <div className="space-y-2"><Label className="text-xs">Income Tax (TDS)</Label><Input type="number" value={salaryForm.income_tax || ''} onChange={(e) => setSalaryForm({...salaryForm, income_tax: parseFloat(e.target.value) || 0})} className="h-9" /></div>
                          <div className="space-y-2"><Label className="text-xs">Other Deductions</Label><Input type="number" value={salaryForm.other_deductions || ''} onChange={(e) => setSalaryForm({...salaryForm, other_deductions: parseFloat(e.target.value) || 0})} className="h-9" /></div>
                        </div>
                        <div className="mt-4 pt-4 border-t border-red-200 flex justify-between">
                          <span className="font-medium text-red-800">Total Deductions:</span>
                          <span className="font-bold text-red-800">₹{formatCurrency((salaryForm.pf_employee||0)+(salaryForm.professional_tax||0)+(salaryForm.income_tax||0)+(salaryForm.other_deductions||0))}</span>
                        </div>
                      </div>

                      <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-5 rounded-xl flex justify-between items-center text-white">
                        <span className="text-lg font-medium">Net Salary:</span>
                        <span className="text-3xl font-bold">₹{formatCurrency(
                          ((salaryForm.basic_salary||0)+(salaryForm.hra||0)+(salaryForm.variable_pay||0)+(salaryForm.conveyance_allowance||0)+(salaryForm.medical_allowance||0)+(salaryForm.special_allowance||0)) -
                          ((salaryForm.pf_employee||0)+(salaryForm.professional_tax||0)+(salaryForm.income_tax||0)+(salaryForm.other_deductions||0))
                        )}</span>
                      </div>
                    </div>
                  )}

                  {/* Salary Payments History */}
                  <div className="border-t pt-4 mt-4">
                    <div className="flex justify-between items-center mb-3">
                      <h4 className="text-sm font-semibold">Salary Payments History</h4>
                      <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                        <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[2026, 2025, 2024, 2023].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="max-h-40 overflow-y-auto border rounded-lg">
                      {salaryPayments.length === 0 ? (
                        <div className="text-center text-gray-500 text-sm py-4">No payment records for {selectedYear}</div>
                      ) : (
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 sticky top-0"><tr><th className="p-2 text-left text-xs font-semibold text-slate-600">Month</th><th className="p-2 text-right text-xs font-semibold text-slate-600">Gross</th><th className="p-2 text-right text-xs font-semibold text-slate-600">Net</th><th className="p-2 text-center text-xs font-semibold text-slate-600">Status</th></tr></thead>
                          <tbody className="divide-y">
                            {salaryPayments.map(p => (
                              <tr key={p.id}>
                                <td className="p-2">{new Date(p.year, p.month - 1).toLocaleString('en', { month: 'short' })} {p.year}</td>
                                <td className="p-2 text-right">₹{formatCurrency(p.gross_salary)}</td>
                                <td className="p-2 text-right font-medium">₹{formatCurrency(p.net_salary)}</td>
                                <td className="p-2 text-center">
                                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{p.payment_status}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSaveSalary} disabled={saving} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                      {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Salary
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Attendance Tab */}
            <TabsContent value="attendance" className="mt-0 space-y-4">
              {leaveSummary && (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <p className="text-sm text-gray-600">Weekly Off: <span className="font-medium">{leaveSummary.weekly_off_day_name}</span></p>
                      <p className="text-sm text-gray-600">Total Leaves Taken ({leaveSummary.year}): <span className="font-medium text-red-600">{leaveSummary.total_leaves_taken}</span></p>
                    </div>
                    <Select value={String(selectedYear)} onValueChange={(v) => { setSelectedYear(parseInt(v)); loadEmployeeData(employee.id); }}>
                      <SelectTrigger className="w-24 h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[2026, 2025, 2024].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-4 gap-4 mb-4">
                    <div className="bg-emerald-50 p-4 rounded-xl text-center border border-emerald-200">
                      <p className="text-2xl font-bold text-emerald-800">{leaveSummary.total_present}</p>
                      <p className="text-xs text-emerald-600">Present</p>
                    </div>
                    <div className="bg-red-50 p-4 rounded-xl text-center border border-red-200">
                      <p className="text-2xl font-bold text-red-800">{leaveSummary.total_leaves_taken}</p>
                      <p className="text-xs text-red-600">Leaves</p>
                    </div>
                    <div className="bg-amber-50 p-4 rounded-xl text-center border border-amber-200">
                      <p className="text-2xl font-bold text-amber-800">{leaveSummary.monthly_summary.reduce((s, m) => s + m.half_day, 0)}</p>
                      <p className="text-xs text-amber-600">Half Days</p>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-xl text-center border border-blue-200">
                      <p className="text-2xl font-bold text-blue-800">{leaveSummary.monthly_summary.reduce((s, m) => s + m.on_leave, 0)}</p>
                      <p className="text-xs text-blue-600">On Leave</p>
                    </div>
                  </div>

                  <h4 className="text-sm font-semibold mb-2">Month-wise Leave Summary</h4>
                  <div className="max-h-60 overflow-y-auto border rounded-lg">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0">
                        <tr><th className="p-2 text-left text-xs font-semibold text-slate-600">Month</th><th className="p-2 text-center text-xs font-semibold text-slate-600">Present</th><th className="p-2 text-center text-xs font-semibold text-slate-600">Absent</th><th className="p-2 text-center text-xs font-semibold text-slate-600">Half Day</th><th className="p-2 text-center text-xs font-semibold text-slate-600">On Leave</th><th className="p-2 text-center text-xs font-semibold text-slate-600">Total</th></tr>
                      </thead>
                      <tbody className="divide-y">
                        {leaveSummary.monthly_summary.map(m => (
                          <tr key={m.month}>
                            <td className="p-2">{new Date(m.year, m.month - 1).toLocaleString('en', { month: 'long' })}</td>
                            <td className="p-2 text-center text-emerald-600">{m.present}</td>
                            <td className="p-2 text-center text-red-600">{m.absent}</td>
                            <td className="p-2 text-center text-amber-600">{m.half_day}</td>
                            <td className="p-2 text-center text-blue-600">{m.on_leave}</td>
                            <td className="p-2 text-center font-medium text-red-700">{m.leaves_taken}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="mt-0">
              <DocumentsTab employeeId={employee?.id} documents={documents} onUpdate={() => loadEmployeeData(employee?.id)} />
            </TabsContent>

            {/* Audit Tab */}
            <TabsContent value="audit" className="mt-0">
              <div className="max-h-80 overflow-y-auto">
                {auditLogs.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">
                    <History className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p>No audit history</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 p-4 bg-slate-50 rounded-xl border text-sm">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${
                          log.action === 'create' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                          log.action === 'update' ? 'bg-blue-100 text-blue-800 border-blue-200' :
                          log.action === 'salary_update' ? 'bg-purple-100 text-purple-800 border-purple-200' :
                          log.action === 'lead_assignment_toggle' ? 'bg-orange-100 text-orange-800 border-orange-200' :
                          'bg-gray-100 text-gray-800 border-gray-200'
                        }`}>{log.action}</span>
                        <div className="flex-1">
                          <p className="text-gray-700">by <span className="font-medium">{log.user_name || 'System'}</span></p>
                          <p className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

// ==================== DOCUMENTS TAB ====================
function DocumentsTab({ employeeId, documents, onUpdate }) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [docForm, setDocForm] = useState({ document_type: '', document_name: '', document_number: '' });

  const documentTypes = [
    { value: 'aadhaar', label: 'Aadhaar Card' },
    { value: 'pan', label: 'PAN Card' },
    { value: 'passport', label: 'Passport' },
    { value: 'offer_letter', label: 'Offer Letter' },
    { value: 'joining_letter', label: 'Joining Letter' },
    { value: 'nda', label: 'NDA' },
    { value: 'other', label: 'Other' },
  ];

  const handleAddDocument = async () => {
    if (!docForm.document_type || !docForm.document_name) { toast.error('Please fill required fields'); return; }
    setSaving(true);
    try {
      await hrApi.addEmployeeDocument(employeeId, docForm);
      toast.success('Document added');
      setIsAddModalOpen(false);
      setDocForm({ document_type: '', document_name: '', document_number: '' });
      onUpdate();
    } catch (error) {
      toast.error('Failed to add document');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-semibold">Employee Documents</h4>
        <Button size="sm" onClick={() => setIsAddModalOpen(true)} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
          <Plus className="h-4 w-4 mr-1" /> Add Document
        </Button>
      </div>
      {documents.length === 0 ? (
        <div className="text-center text-gray-500 py-8">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p>No documents uploaded</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {documents.map((doc) => (
            <div key={doc.id} className="p-4 border rounded-xl bg-slate-50">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{doc.document_name}</p>
                  <p className="text-xs text-gray-500">{documentTypes.find(d => d.value === doc.document_type)?.label || doc.document_type}</p>
                  {doc.document_number && <p className="text-xs text-gray-600 mt-1 font-mono">#{doc.document_number}</p>}
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${doc.verification_status === 'verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{doc.verification_status}</span>
              </div>
            </div>
          ))}
        </div>
      )}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader><DialogTitle>Add Document</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-sm">Document Type *</Label>
              <Select value={docForm.document_type} onValueChange={(v) => setDocForm({...docForm, document_type: v})}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{documentTypes.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Document Name *</Label>
              <Input value={docForm.document_name} onChange={(e) => setDocForm({...docForm, document_name: e.target.value})} className="h-10" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Document Number</Label>
              <Input value={docForm.document_number} onChange={(e) => setDocForm({...docForm, document_number: e.target.value})} className="h-10 font-mono" />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
              <Button onClick={handleAddDocument} disabled={saving} className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Add Document
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
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
