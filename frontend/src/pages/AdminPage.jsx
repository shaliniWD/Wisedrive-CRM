import React, { useState, useEffect, useCallback } from 'react';
import { hrApi, digitalAdsApi, rolesApi, departmentsApi, teamsApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Plus, Loader2, Pencil, Trash2, Users, Globe, Search, ChevronDown, ChevronUp,
  FileText, Calendar, DollarSign, History, Eye, X, Check, AlertCircle
} from 'lucide-react';

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
  const [saving, setSaving] = useState(false);
  
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
      // Try basic countries
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
    setExpandedAudit(prev => ({
      ...prev,
      [empId]: !prev[empId]
    }));
  };

  // Open employee modal for create/edit
  const openEmployeeModal = (employee = null) => {
    setSelectedEmployee(employee);
    setEmployeeModalTab('details');
    setIsEmployeeModalOpen(true);
  };

  // Open country modal for create/edit
  const openCountryModal = (country = null) => {
    setSelectedCountry(country);
    setIsCountryModalOpen(true);
  };

  // Format currency
  const formatCurrency = (amount, currency = 'INR', symbol = '₹') => {
    if (!amount) return '-';
    return `${symbol}${new Intl.NumberFormat('en-IN').format(amount)}`;
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="p-4 space-y-4" data-testid="admin-page">
      {/* Main Tabs */}
      <div className="card">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('employees')}
            className={`px-6 py-4 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
              activeTab === 'employees'
                ? 'border-[#2E3192] text-[#2E3192]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            data-testid="employees-tab"
          >
            <Users className="h-4 w-4" /> Employees
          </button>
          {isHROrCEO && (
            <button
              onClick={() => setActiveTab('countries')}
              className={`px-6 py-4 text-sm font-medium border-b-2 -mb-px flex items-center gap-2 ${
                activeTab === 'countries'
                  ? 'border-[#2E3192] text-[#2E3192]'
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
            {/* Filters and Actions */}
            <div className="flex items-center justify-between mb-4 gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search by name, email, phone..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-9"
                    data-testid="employee-search"
                  />
                </div>
                
                <Select value={filterCountry || 'all'} onValueChange={(v) => setFilterCountry(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-40 h-9" data-testid="filter-country">
                    <SelectValue placeholder="All Countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Countries</SelectItem>
                    {countries.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterRole || 'all'} onValueChange={(v) => setFilterRole(v === 'all' ? '' : v)}>
                  <SelectTrigger className="w-40 h-9" data-testid="filter-role">
                    <SelectValue placeholder="All Roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {roles.map(r => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isHROrCEO && (
                <button 
                  className="btn-purple flex items-center gap-1" 
                  onClick={() => openEmployeeModal()}
                  data-testid="add-employee-btn"
                >
                  <Plus className="h-4 w-4" /> Add Employee
                </button>
              )}
            </div>

            {/* Employee Table */}
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>Country</th>
                  <th>Status</th>
                  <th>Salary Info</th>
                  <th>Docs</th>
                  <th>Audit</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#2E3192]" /></td></tr>
                ) : employees.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-500">No employees found</td></tr>
                ) : (
                  employees.map((emp) => (
                    <React.Fragment key={emp.id}>
                      <tr data-testid={`employee-row-${emp.id}`}>
                        <td>
                          <div>
                            <span className="font-medium block">{emp.name}</span>
                            <span className="text-xs text-gray-500">{emp.email}</span>
                            {emp.employee_code && (
                              <span className="text-xs text-gray-400 ml-2">({emp.employee_code})</span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            emp.role_code === 'CEO' ? 'bg-purple-100 text-purple-800' :
                            emp.role_code === 'HR_MANAGER' ? 'bg-blue-100 text-blue-800' :
                            emp.role_code === 'MECHANIC' ? 'bg-orange-100 text-orange-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {emp.role_name || emp.role_code || '-'}
                          </span>
                        </td>
                        <td>
                          <span className="text-sm">{emp.country_name || '-'}</span>
                        </td>
                        <td>
                          <div className="flex flex-col gap-1">
                            <span className={`px-2 py-0.5 rounded text-xs ${emp.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {emp.is_active ? 'Active' : 'Inactive'}
                            </span>
                            {emp.has_crm_access === false && (
                              <span className="px-2 py-0.5 rounded text-xs bg-yellow-100 text-yellow-800">No CRM</span>
                            )}
                          </div>
                        </td>
                        <td>
                          {emp.salary_info ? (
                            <div className="text-xs">
                              {emp.salary_info.employment_type === 'freelancer' || emp.role_code === 'MECHANIC' ? (
                                <span className="text-green-600 font-medium">
                                  {formatCurrency(emp.salary_info.price_per_inspection, emp.currency, emp.currency_symbol || '₹')}/inspection
                                </span>
                              ) : (
                                <span className="text-green-600 font-medium">
                                  {formatCurrency(emp.salary_info.net_salary || emp.salary_info.basic_salary, emp.currency, emp.currency_symbol || '₹')}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">Not set</span>
                          )}
                        </td>
                        <td>
                          <span className={`px-2 py-1 rounded text-xs ${emp.document_count > 0 ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-500'}`}>
                            {emp.document_count || 0} docs
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => toggleAudit(emp.id)}
                            className="flex items-center gap-1 text-xs text-gray-600 hover:text-[#2E3192]"
                            data-testid={`toggle-audit-${emp.id}`}
                          >
                            <History className="h-3 w-3" />
                            {emp.audit_count || 0}
                            {expandedAudit[emp.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          </button>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <button
                              className="text-[#6366F1] hover:text-[#5558E3]"
                              onClick={() => openEmployeeModal(emp)}
                              title="View/Edit"
                              data-testid={`edit-employee-${emp.id}`}
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {isHROrCEO && (
                              <button
                                className="text-red-500 hover:text-red-600"
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
                        <tr className="bg-gray-50">
                          <td colSpan={8} className="p-3">
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
        )}

        {/* Countries Tab */}
        {activeTab === 'countries' && isHROrCEO && (
          <div className="p-4">
            <div className="flex justify-end mb-4">
              <button 
                className="btn-purple flex items-center gap-1" 
                onClick={() => openCountryModal()}
                data-testid="add-country-btn"
              >
                <Plus className="h-4 w-4" /> Add Country
              </button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Country</th>
                  <th>Code</th>
                  <th>Currency</th>
                  <th>Phone Code</th>
                  <th>Employees</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {countries.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-500">No countries found</td></tr>
                ) : (
                  countries.map((country) => (
                    <tr key={country.id} data-testid={`country-row-${country.id}`}>
                      <td className="font-medium">{country.name}</td>
                      <td><span className="px-2 py-1 bg-gray-100 rounded text-sm font-mono">{country.code}</span></td>
                      <td>
                        <span className="flex items-center gap-1">
                          <span className="text-lg">{country.currency_symbol || '₹'}</span>
                          <span className="text-sm text-gray-600">{country.currency}</span>
                        </span>
                      </td>
                      <td className="font-mono text-sm">{country.phone_code || '-'}</td>
                      <td>
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                          {country.employee_count || 0} employees
                        </span>
                      </td>
                      <td>
                        <span className={`px-2 py-1 rounded text-xs ${country.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                          {country.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button
                            className="text-[#6366F1] hover:text-[#5558E3]"
                            onClick={() => openCountryModal(country)}
                            data-testid={`edit-country-${country.id}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {(!country.employee_count || country.employee_count === 0) && (
                            <button
                              className="text-red-500 hover:text-red-600"
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
        onSave={() => {
          fetchEmployees();
          setIsEmployeeModalOpen(false);
        }}
        currentTab={employeeModalTab}
        setCurrentTab={setEmployeeModalTab}
      />

      {/* Country Modal */}
      <CountryModal
        isOpen={isCountryModalOpen}
        onClose={() => setIsCountryModalOpen(false)}
        country={selectedCountry}
        onSave={() => {
          fetchCountries();
          setIsCountryModalOpen(false);
        }}
      />
    </div>
  );
}

// ==================== EMPLOYEE AUDIT TRAIL COMPONENT ====================

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

  if (loading) return <div className="text-center py-2"><Loader2 className="h-4 w-4 animate-spin inline" /></div>;
  if (logs.length === 0) return <div className="text-xs text-gray-500 text-center py-2">No audit history</div>;

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const getActionBadge = (action) => {
    switch (action) {
      case 'create': return 'bg-green-100 text-green-800';
      case 'update': return 'bg-blue-100 text-blue-800';
      case 'delete': return 'bg-red-100 text-red-800';
      case 'salary_update': return 'bg-purple-100 text-purple-800';
      case 'document_added': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-2 max-h-40 overflow-y-auto">
      {logs.map((log) => (
        <div key={log.id} className="flex items-center gap-3 text-xs bg-white p-2 rounded border">
          <span className="text-gray-500 w-32">{formatDate(log.timestamp)}</span>
          <span className={`px-2 py-0.5 rounded ${getActionBadge(log.action)}`}>{log.action}</span>
          <span className="text-gray-600">by {log.user_name || 'System'}</span>
          {log.new_values && (
            <span className="text-gray-400 truncate max-w-xs">
              {JSON.stringify(log.new_values).substring(0, 50)}...
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ==================== EMPLOYEE MODAL COMPONENT ====================

function EmployeeModal({ isOpen, onClose, employee, countries, roles, departments, teams, onSave, currentTab, setCurrentTab }) {
  const [form, setForm] = useState({});
  const [salaryForm, setSalaryForm] = useState({});
  const [documents, setDocuments] = useState([]);
  const [attendance, setAttendance] = useState({ records: [], summary: {} });
  const [auditLogs, setAuditLogs] = useState([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  const isEdit = !!employee;
  const isMechanic = roles.find(r => r.id === form.role_id)?.code === 'MECHANIC';

  useEffect(() => {
    if (isOpen) {
      if (employee) {
        setForm({
          name: employee.name || '',
          email: employee.email || '',
          phone: employee.phone || '',
          country_id: employee.country_id || '',
          department_id: employee.department_id || '',
          team_id: employee.team_id || '',
          role_id: employee.role_id || '',
          employment_type: employee.employment_type || 'full_time',
          employee_code: employee.employee_code || '',
          joining_date: employee.joining_date || '',
          date_of_birth: employee.date_of_birth || '',
          gender: employee.gender || '',
          address: employee.address || '',
          city: employee.city || '',
          bank_name: employee.bank_name || '',
          bank_account_number: employee.bank_account_number || '',
          ifsc_code: employee.ifsc_code || '',
          pan_number: employee.pan_number || '',
          has_crm_access: employee.has_crm_access !== false,
          is_active: employee.is_active !== false,
        });
        loadEmployeeData(employee.id);
      } else {
        setForm({
          name: '', email: '', phone: '', country_id: '', department_id: '', team_id: '',
          role_id: '', employment_type: 'full_time', employee_code: '', joining_date: '',
          date_of_birth: '', gender: '', address: '', city: '', bank_name: '',
          bank_account_number: '', ifsc_code: '', pan_number: '', has_crm_access: true,
          is_active: true, password: ''
        });
        setSalaryForm({});
        setDocuments([]);
        setAttendance({ records: [], summary: {} });
        setAuditLogs([]);
      }
    }
  }, [isOpen, employee]);

  const loadEmployeeData = async (empId) => {
    setLoading(true);
    try {
      const [salaryRes, docsRes, attRes, auditRes] = await Promise.all([
        hrApi.getEmployeeSalary(empId).catch(() => ({ data: {} })),
        hrApi.getEmployeeDocuments(empId).catch(() => ({ data: [] })),
        hrApi.getEmployeeAttendance(empId).catch(() => ({ data: { records: [], summary: {} } })),
        hrApi.getEmployeeAudit(empId).catch(() => ({ data: [] })),
      ]);
      setSalaryForm(salaryRes.data || {});
      setDocuments(docsRes.data || []);
      setAttendance(attRes.data || { records: [], summary: {} });
      setAuditLogs(auditRes.data || []);
    } catch (error) {
      console.error('Failed to load employee data');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDetails = async () => {
    if (!form.name || !form.email || !form.country_id || !form.role_id) {
      toast.error('Please fill required fields');
      return;
    }
    if (!isEdit && !form.password) {
      toast.error('Password is required for new employees');
      return;
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
      await hrApi.saveEmployeeSalary(employee.id, {
        ...salaryForm,
        employment_type: form.employment_type || 'full_time'
      });
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
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden p-0" data-testid="employee-modal">
        <DialogHeader className="px-6 py-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#2E3192]" />
            {isEdit ? `Edit Employee: ${employee?.name}` : 'Add New Employee'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={currentTab} onValueChange={setCurrentTab} className="flex-1">
          <TabsList className="px-6 border-b bg-transparent justify-start">
            <TabsTrigger value="details" className="data-[state=active]:border-b-2 data-[state=active]:border-[#2E3192]">
              <Users className="h-4 w-4 mr-1" /> Details
            </TabsTrigger>
            {isEdit && (
              <>
                <TabsTrigger value="salary" className="data-[state=active]:border-b-2 data-[state=active]:border-[#2E3192]">
                  <DollarSign className="h-4 w-4 mr-1" /> Salary
                </TabsTrigger>
                <TabsTrigger value="documents" className="data-[state=active]:border-b-2 data-[state=active]:border-[#2E3192]">
                  <FileText className="h-4 w-4 mr-1" /> Documents
                </TabsTrigger>
                <TabsTrigger value="attendance" className="data-[state=active]:border-b-2 data-[state=active]:border-[#2E3192]">
                  <Calendar className="h-4 w-4 mr-1" /> Attendance
                </TabsTrigger>
                <TabsTrigger value="audit" className="data-[state=active]:border-b-2 data-[state=active]:border-[#2E3192]">
                  <History className="h-4 w-4 mr-1" /> Audit
                </TabsTrigger>
              </>
            )}
          </TabsList>

          <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
            {/* Details Tab */}
            <TabsContent value="details" className="mt-0 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Full Name <span className="text-red-500">*</span></Label>
                  <Input value={form.name || ''} onChange={(e) => setForm({...form, name: e.target.value})} className="h-9" data-testid="emp-name" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email <span className="text-red-500">*</span></Label>
                  <Input type="email" value={form.email || ''} onChange={(e) => setForm({...form, email: e.target.value})} className="h-9" data-testid="emp-email" />
                </div>
                {!isEdit && (
                  <div className="space-y-1">
                    <Label className="text-xs">Password <span className="text-red-500">*</span></Label>
                    <Input type="password" value={form.password || ''} onChange={(e) => setForm({...form, password: e.target.value})} className="h-9" data-testid="emp-password" />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input value={form.phone || ''} onChange={(e) => setForm({...form, phone: e.target.value})} className="h-9" data-testid="emp-phone" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Country <span className="text-red-500">*</span></Label>
                  <Select value={form.country_id || ''} onValueChange={(v) => setForm({...form, country_id: v})}>
                    <SelectTrigger className="h-9" data-testid="emp-country"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {countries.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Role <span className="text-red-500">*</span></Label>
                  <Select value={form.role_id || ''} onValueChange={(v) => setForm({...form, role_id: v})}>
                    <SelectTrigger className="h-9" data-testid="emp-role"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {roles.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Department</Label>
                  <Select value={form.department_id || ''} onValueChange={(v) => setForm({...form, department_id: v})}>
                    <SelectTrigger className="h-9" data-testid="emp-dept"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Employment Type</Label>
                  <Select value={form.employment_type || 'full_time'} onValueChange={(v) => setForm({...form, employment_type: v})}>
                    <SelectTrigger className="h-9" data-testid="emp-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="full_time">Full Time</SelectItem>
                      <SelectItem value="part_time">Part Time</SelectItem>
                      <SelectItem value="freelancer">Freelancer</SelectItem>
                      <SelectItem value="contractor">Contractor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Joining Date</Label>
                  <Input type="date" value={form.joining_date || ''} onChange={(e) => setForm({...form, joining_date: e.target.value})} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Date of Birth</Label>
                  <Input type="date" value={form.date_of_birth || ''} onChange={(e) => setForm({...form, date_of_birth: e.target.value})} className="h-9" />
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h4 className="text-sm font-medium mb-3">Bank Details</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Bank Name</Label>
                    <Input value={form.bank_name || ''} onChange={(e) => setForm({...form, bank_name: e.target.value})} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Account Number</Label>
                    <Input value={form.bank_account_number || ''} onChange={(e) => setForm({...form, bank_account_number: e.target.value})} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">IFSC Code</Label>
                    <Input value={form.ifsc_code || ''} onChange={(e) => setForm({...form, ifsc_code: e.target.value})} className="h-9" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">PAN Number</Label>
                    <Input value={form.pan_number || ''} onChange={(e) => setForm({...form, pan_number: e.target.value})} className="h-9" />
                  </div>
                </div>
              </div>

              <div className="border-t pt-4 flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.has_crm_access || false} onChange={(e) => setForm({...form, has_crm_access: e.target.checked})} className="rounded" />
                  <span className="text-sm">Has CRM Access</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_active || false} onChange={(e) => setForm({...form, is_active: e.target.checked})} className="rounded" />
                  <span className="text-sm">Active</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={onClose}>Cancel</Button>
                <Button className="btn-purple" onClick={handleSaveDetails} disabled={saving} data-testid="save-employee-btn">
                  {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  {isEdit ? 'Update Employee' : 'Create Employee'}
                </Button>
              </div>
            </TabsContent>

            {/* Salary Tab */}
            <TabsContent value="salary" className="mt-0 space-y-4">
              {loading ? (
                <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>
              ) : (
                <>
                  {(isMechanic || form.employment_type === 'freelancer') ? (
                    // Freelancer/Mechanic salary
                    <div className="space-y-4">
                      <div className="bg-orange-50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-orange-800 mb-3">Freelancer / Mechanic Compensation</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <Label className="text-xs">Price Per Inspection</Label>
                            <Input 
                              type="number" 
                              value={salaryForm.price_per_inspection || ''} 
                              onChange={(e) => setSalaryForm({...salaryForm, price_per_inspection: parseFloat(e.target.value) || 0})} 
                              className="h-9" 
                              data-testid="salary-per-inspection"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Commission %</Label>
                            <Input 
                              type="number" 
                              step="0.1"
                              value={salaryForm.commission_percentage || ''} 
                              onChange={(e) => setSalaryForm({...salaryForm, commission_percentage: parseFloat(e.target.value) || 0})} 
                              className="h-9" 
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // Full-time employee salary
                    <div className="space-y-4">
                      <div className="bg-green-50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-green-800 mb-3">Earnings</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <Label className="text-xs">Basic Salary</Label>
                            <Input type="number" value={salaryForm.basic_salary || ''} onChange={(e) => setSalaryForm({...salaryForm, basic_salary: parseFloat(e.target.value) || 0})} className="h-9" data-testid="salary-basic" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">HRA</Label>
                            <Input type="number" value={salaryForm.hra || ''} onChange={(e) => setSalaryForm({...salaryForm, hra: parseFloat(e.target.value) || 0})} className="h-9" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Conveyance</Label>
                            <Input type="number" value={salaryForm.conveyance_allowance || ''} onChange={(e) => setSalaryForm({...salaryForm, conveyance_allowance: parseFloat(e.target.value) || 0})} className="h-9" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Medical Allowance</Label>
                            <Input type="number" value={salaryForm.medical_allowance || ''} onChange={(e) => setSalaryForm({...salaryForm, medical_allowance: parseFloat(e.target.value) || 0})} className="h-9" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Special Allowance</Label>
                            <Input type="number" value={salaryForm.special_allowance || ''} onChange={(e) => setSalaryForm({...salaryForm, special_allowance: parseFloat(e.target.value) || 0})} className="h-9" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Variable Pay</Label>
                            <Input type="number" value={salaryForm.variable_pay || ''} onChange={(e) => setSalaryForm({...salaryForm, variable_pay: parseFloat(e.target.value) || 0})} className="h-9" />
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-green-200">
                          <div className="flex justify-between">
                            <span className="font-medium text-green-800">Gross Salary:</span>
                            <span className="font-bold text-green-800">
                              ₹{formatCurrency((salaryForm.basic_salary || 0) + (salaryForm.hra || 0) + (salaryForm.conveyance_allowance || 0) + (salaryForm.medical_allowance || 0) + (salaryForm.special_allowance || 0) + (salaryForm.variable_pay || 0))}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-red-50 p-4 rounded-lg">
                        <h4 className="text-sm font-medium text-red-800 mb-3">Deductions</h4>
                        <div className="grid grid-cols-3 gap-4">
                          <div className="space-y-1">
                            <Label className="text-xs">PF (Employee)</Label>
                            <Input type="number" value={salaryForm.pf_employee || ''} onChange={(e) => setSalaryForm({...salaryForm, pf_employee: parseFloat(e.target.value) || 0})} className="h-9" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Professional Tax</Label>
                            <Input type="number" value={salaryForm.professional_tax || ''} onChange={(e) => setSalaryForm({...salaryForm, professional_tax: parseFloat(e.target.value) || 0})} className="h-9" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Income Tax (TDS)</Label>
                            <Input type="number" value={salaryForm.income_tax || ''} onChange={(e) => setSalaryForm({...salaryForm, income_tax: parseFloat(e.target.value) || 0})} className="h-9" />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Other Deductions</Label>
                            <Input type="number" value={salaryForm.other_deductions || ''} onChange={(e) => setSalaryForm({...salaryForm, other_deductions: parseFloat(e.target.value) || 0})} className="h-9" />
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-red-200">
                          <div className="flex justify-between">
                            <span className="font-medium text-red-800">Total Deductions:</span>
                            <span className="font-bold text-red-800">
                              ₹{formatCurrency((salaryForm.pf_employee || 0) + (salaryForm.professional_tax || 0) + (salaryForm.income_tax || 0) + (salaryForm.other_deductions || 0))}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-blue-50 p-4 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-lg font-medium text-blue-800">Net Salary:</span>
                          <span className="text-2xl font-bold text-blue-800">
                            ₹{formatCurrency(
                              ((salaryForm.basic_salary || 0) + (salaryForm.hra || 0) + (salaryForm.conveyance_allowance || 0) + (salaryForm.medical_allowance || 0) + (salaryForm.special_allowance || 0) + (salaryForm.variable_pay || 0)) -
                              ((salaryForm.pf_employee || 0) + (salaryForm.professional_tax || 0) + (salaryForm.income_tax || 0) + (salaryForm.other_deductions || 0))
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button className="btn-purple" onClick={handleSaveSalary} disabled={saving} data-testid="save-salary-btn">
                      {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Save Salary
                    </Button>
                  </div>
                </>
              )}
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="mt-0">
              <DocumentsTab employeeId={employee?.id} documents={documents} onUpdate={() => loadEmployeeData(employee?.id)} />
            </TabsContent>

            {/* Attendance Tab */}
            <TabsContent value="attendance" className="mt-0">
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-green-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-green-800">{attendance.summary.present || 0}</p>
                    <p className="text-xs text-green-600">Present</p>
                  </div>
                  <div className="bg-red-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-red-800">{attendance.summary.absent || 0}</p>
                    <p className="text-xs text-red-600">Absent</p>
                  </div>
                  <div className="bg-yellow-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-yellow-800">{attendance.summary.half_day || 0}</p>
                    <p className="text-xs text-yellow-600">Half Day</p>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg text-center">
                    <p className="text-2xl font-bold text-blue-800">{attendance.summary.on_leave || 0}</p>
                    <p className="text-xs text-blue-600">On Leave</p>
                  </div>
                </div>

                <div className="max-h-60 overflow-y-auto">
                  {attendance.records.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No attendance records</div>
                  ) : (
                    <table className="data-table text-sm">
                      <thead>
                        <tr><th>Date</th><th>Status</th><th>Check In</th><th>Check Out</th><th>Hours</th></tr>
                      </thead>
                      <tbody>
                        {attendance.records.map((att) => (
                          <tr key={att.id}>
                            <td>{att.date}</td>
                            <td>
                              <span className={`px-2 py-0.5 rounded text-xs ${
                                att.status === 'present' ? 'bg-green-100 text-green-800' :
                                att.status === 'absent' ? 'bg-red-100 text-red-800' :
                                att.status === 'half_day' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-blue-100 text-blue-800'
                              }`}>
                                {att.status}
                              </span>
                            </td>
                            <td>{att.check_in_time || '-'}</td>
                            <td>{att.check_out_time || '-'}</td>
                            <td>{att.working_hours || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Audit Tab */}
            <TabsContent value="audit" className="mt-0">
              <div className="max-h-80 overflow-y-auto">
                {auditLogs.length === 0 ? (
                  <div className="text-center text-gray-500 py-8">No audit history</div>
                ) : (
                  <div className="space-y-2">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg text-sm">
                        <div className="flex-shrink-0">
                          <span className={`px-2 py-1 rounded text-xs ${
                            log.action === 'create' ? 'bg-green-100 text-green-800' :
                            log.action === 'update' ? 'bg-blue-100 text-blue-800' :
                            log.action === 'delete' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {log.action}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-700">by <span className="font-medium">{log.user_name || 'System'}</span></p>
                          <p className="text-xs text-gray-500">{new Date(log.timestamp).toLocaleString()}</p>
                          {log.new_values && (
                            <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto max-h-20">
                              {JSON.stringify(log.new_values, null, 2)}
                            </pre>
                          )}
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

// ==================== DOCUMENTS TAB COMPONENT ====================

function DocumentsTab({ employeeId, documents, onUpdate }) {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [docForm, setDocForm] = useState({
    document_type: '',
    document_name: '',
    document_number: '',
    issue_date: '',
    expiry_date: '',
  });

  const documentTypes = [
    { value: 'aadhaar', label: 'Aadhaar Card' },
    { value: 'pan', label: 'PAN Card' },
    { value: 'passport', label: 'Passport' },
    { value: 'driving_license', label: 'Driving License' },
    { value: 'offer_letter', label: 'Offer Letter' },
    { value: 'joining_letter', label: 'Joining Letter' },
    { value: 'nda', label: 'NDA' },
    { value: 'experience_letter', label: 'Experience Letter' },
    { value: 'education_certificate', label: 'Education Certificate' },
    { value: 'other', label: 'Other' },
  ];

  const handleAddDocument = async () => {
    if (!docForm.document_type || !docForm.document_name) {
      toast.error('Please fill required fields');
      return;
    }

    setSaving(true);
    try {
      await hrApi.addEmployeeDocument(employeeId, docForm);
      toast.success('Document added');
      setIsAddModalOpen(false);
      setDocForm({ document_type: '', document_name: '', document_number: '', issue_date: '', expiry_date: '' });
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
        <h4 className="text-sm font-medium">Employee Documents</h4>
        <Button size="sm" className="btn-purple" onClick={() => setIsAddModalOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Add Document
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center text-gray-500 py-8">No documents uploaded</div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {documents.map((doc) => (
            <div key={doc.id} className="p-3 border rounded-lg">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-medium text-sm">{doc.document_name}</p>
                  <p className="text-xs text-gray-500">{documentTypes.find(d => d.value === doc.document_type)?.label || doc.document_type}</p>
                  {doc.document_number && <p className="text-xs text-gray-600 mt-1">#{doc.document_number}</p>}
                </div>
                <span className={`px-2 py-0.5 rounded text-xs ${
                  doc.verification_status === 'verified' ? 'bg-green-100 text-green-800' :
                  doc.verification_status === 'rejected' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {doc.verification_status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Document Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add Document</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-1">
              <Label className="text-xs">Document Type <span className="text-red-500">*</span></Label>
              <Select value={docForm.document_type} onValueChange={(v) => setDocForm({...docForm, document_type: v})}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {documentTypes.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Document Name <span className="text-red-500">*</span></Label>
              <Input value={docForm.document_name} onChange={(e) => setDocForm({...docForm, document_name: e.target.value})} className="h-9" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Document Number</Label>
              <Input value={docForm.document_number} onChange={(e) => setDocForm({...docForm, document_number: e.target.value})} className="h-9" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Issue Date</Label>
                <Input type="date" value={docForm.issue_date} onChange={(e) => setDocForm({...docForm, issue_date: e.target.value})} className="h-9" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Expiry Date</Label>
                <Input type="date" value={docForm.expiry_date} onChange={(e) => setDocForm({...docForm, expiry_date: e.target.value})} className="h-9" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
              <Button className="btn-purple" onClick={handleAddDocument} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Add Document
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== COUNTRY MODAL COMPONENT ====================

function CountryModal({ isOpen, onClose, country, onSave }) {
  const [form, setForm] = useState({
    name: '',
    code: '',
    currency: 'INR',
    currency_symbol: '₹',
    phone_code: '+91',
    is_active: true,
  });
  const [saving, setSaving] = useState(false);

  const isEdit = !!country;

  useEffect(() => {
    if (isOpen) {
      if (country) {
        setForm({
          name: country.name || '',
          code: country.code || '',
          currency: country.currency || 'INR',
          currency_symbol: country.currency_symbol || '₹',
          phone_code: country.phone_code || '+91',
          is_active: country.is_active !== false,
        });
      } else {
        setForm({
          name: '',
          code: '',
          currency: 'INR',
          currency_symbol: '₹',
          phone_code: '+91',
          is_active: true,
        });
      }
    }
  }, [isOpen, country]);

  const handleSave = async () => {
    if (!form.name || !form.code || !form.currency) {
      toast.error('Please fill required fields');
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        await hrApi.updateCountry(country.id, form);
        toast.success('Country updated');
      } else {
        await hrApi.createCountry(form);
        toast.success('Country created');
      }
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
    { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[400px]" data-testid="country-modal">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-[#2E3192]" />
            {isEdit ? `Edit Country: ${country?.name}` : 'Add New Country'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <div className="space-y-1">
            <Label className="text-xs">Country Name <span className="text-red-500">*</span></Label>
            <Input 
              value={form.name} 
              onChange={(e) => setForm({...form, name: e.target.value})} 
              className="h-9" 
              placeholder="e.g., India"
              data-testid="country-name"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Country Code (ISO) <span className="text-red-500">*</span></Label>
            <Input 
              value={form.code} 
              onChange={(e) => setForm({...form, code: e.target.value.toUpperCase()})} 
              className="h-9 font-mono" 
              placeholder="e.g., IN"
              maxLength={2}
              data-testid="country-code"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Currency <span className="text-red-500">*</span></Label>
            <Select 
              value={form.currency} 
              onValueChange={(v) => {
                const curr = currencies.find(c => c.code === v);
                setForm({...form, currency: v, currency_symbol: curr?.symbol || ''});
              }}
            >
              <SelectTrigger className="h-9" data-testid="country-currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencies.map(c => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.symbol} {c.code} - {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label className="text-xs">Phone Code</Label>
            <Input 
              value={form.phone_code} 
              onChange={(e) => setForm({...form, phone_code: e.target.value})} 
              className="h-9 font-mono" 
              placeholder="e.g., +91"
              data-testid="country-phone"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox" 
              checked={form.is_active} 
              onChange={(e) => setForm({...form, is_active: e.target.checked})} 
              className="rounded"
            />
            <span className="text-sm">Active (available for login)</span>
          </label>

          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button className="btn-purple" onClick={handleSave} disabled={saving} data-testid="save-country-btn">
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {isEdit ? 'Update Country' : 'Create Country'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
