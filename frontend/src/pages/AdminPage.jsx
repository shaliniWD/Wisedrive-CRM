import React, { useState, useEffect, useCallback } from 'react';
import { 
  employeesApi, digitalAdsApi, garageEmployeesApi, utilityApi, 
  usersApi, salaryApi, auditLogsApi, rolesApi 
} from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Loader2, Pencil, Trash2, Copy, DollarSign, History, Users, Search, Filter, RefreshCw } from 'lucide-react';

export default function AdminPage() {
  const { user, hasPermission } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [digitalAds, setDigitalAds] = useState([]);
  const [garageEmployees, setGarageEmployees] = useState([]);
  const [cities, setCities] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('employee');
  
  // HR Tab States
  const [salaries, setSalaries] = useState([]);
  const [salaryLoading, setSalaryLoading] = useState(false);
  
  // Audit Tab States
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditStats, setAuditStats] = useState(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditFilters, setAuditFilters] = useState({
    entity_type: '',
    action: '',
    user_id: '',
    limit: 100
  });
  
  // Modal states
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [isGarageModalOpen, setIsGarageModalOpen] = useState(false);
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedCity, setSelectedCity] = useState('');

  // Form states
  const [employeeForm, setEmployeeForm] = useState({
    name: '', email: '', password: '', role: 'employee', assigned_cities: [], is_active: true,
  });
  
  const [adForm, setAdForm] = useState({
    ad_id: '', ad_name: '', city: '', language: '', campaign_type: '', source: '', ad_amount: '',
  });
  
  const [garageForm, setGarageForm] = useState({
    grg_owner_name: '', grg_employee_name: '', grg_name: '', city: '', preferred_language: '', phone_number: '',
  });
  
  const [salaryForm, setSalaryForm] = useState({
    user_id: '',
    ctc: '',
    fixed_pay: '',
    variable_pay: '',
    commission_percentage: '',
    per_inspection_payout: '',
    currency: 'INR'
  });

  const fetchData = useCallback(async () => {
    try {
      const [employeesRes, adsRes, garageRes, citiesRes, rolesRes] = await Promise.all([
        employeesApi.getAll(),
        digitalAdsApi.getAll(),
        garageEmployeesApi.getAll(),
        utilityApi.getCities(),
        rolesApi.getAll(),
      ]);
      setEmployees(employeesRes.data);
      setDigitalAds(adsRes.data);
      setGarageEmployees(garageRes.data);
      setCities(citiesRes.data);
      setRoles(rolesRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSalaries = useCallback(async () => {
    setSalaryLoading(true);
    try {
      const response = await salaryApi.getAll();
      setSalaries(response.data);
    } catch (error) {
      if (error.response?.status !== 403) {
        toast.error('Failed to load salary data');
      }
    } finally {
      setSalaryLoading(false);
    }
  }, []);

  const fetchAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const params = {};
      if (auditFilters.entity_type) params.entity_type = auditFilters.entity_type;
      if (auditFilters.action) params.action = auditFilters.action;
      if (auditFilters.user_id) params.user_id = auditFilters.user_id;
      params.limit = auditFilters.limit;
      
      const [logsRes, statsRes] = await Promise.all([
        auditLogsApi.getAll(params),
        auditLogsApi.getStats()
      ]);
      setAuditLogs(logsRes.data);
      setAuditStats(statsRes.data);
    } catch (error) {
      if (error.response?.status !== 403) {
        toast.error('Failed to load audit logs');
      }
    } finally {
      setAuditLoading(false);
    }
  }, [auditFilters]);

  useEffect(() => { fetchData(); }, [fetchData]);
  
  useEffect(() => {
    if (activeTab === 'hr') {
      fetchSalaries();
    } else if (activeTab === 'audit') {
      fetchAuditLogs();
    }
  }, [activeTab, fetchSalaries, fetchAuditLogs]);

  // Employee handlers
  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    if (!employeeForm.name || !employeeForm.email || !employeeForm.password) {
      toast.error('Please fill in required fields');
      return;
    }
    setSaving(true);
    try {
      await employeesApi.create(employeeForm);
      toast.success('Employee created');
      setIsEmployeeModalOpen(false);
      setEmployeeForm({ name: '', email: '', password: '', role: 'employee', assigned_cities: [], is_active: true });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleEmployeeStatus = async (employeeId) => {
    try {
      await employeesApi.toggleStatus(employeeId);
      toast.success('Status updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const openCityModal = (employee) => {
    setSelectedEmployee(employee);
    setSelectedCity('');
    setIsCityModalOpen(true);
  };

  const handleAssignCity = async () => {
    if (!selectedCity) {
      toast.error('Please select a city');
      return;
    }
    try {
      await employeesApi.assignCity(selectedEmployee.id, selectedCity);
      toast.success('City assigned');
      setIsCityModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to assign city');
    }
  };

  // Digital Ad handlers
  const handleAdSubmit = async (e) => {
    e.preventDefault();
    if (!adForm.ad_id || !adForm.ad_name || !adForm.city) {
      toast.error('Please fill in required fields');
      return;
    }
    setSaving(true);
    try {
      await digitalAdsApi.create({ ...adForm, ad_amount: adForm.ad_amount ? parseFloat(adForm.ad_amount) : null });
      toast.success('Ad created');
      setIsAdModalOpen(false);
      setAdForm({ ad_id: '', ad_name: '', city: '', language: '', campaign_type: '', source: '', ad_amount: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to save ad');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAdStatus = async (adId) => {
    try {
      await digitalAdsApi.toggleStatus(adId);
      toast.success('Status updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDeleteAd = async (adId) => {
    if (!window.confirm('Are you sure you want to delete this ad?')) return;
    try {
      await digitalAdsApi.delete(adId);
      toast.success('Ad deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete ad');
    }
  };

  // Garage Employee handlers
  const handleGarageSubmit = async (e) => {
    e.preventDefault();
    if (!garageForm.grg_owner_name || !garageForm.grg_employee_name || !garageForm.city) {
      toast.error('Please fill in required fields');
      return;
    }
    setSaving(true);
    try {
      await garageEmployeesApi.create(garageForm);
      toast.success('Garage employee created');
      setIsGarageModalOpen(false);
      setGarageForm({ grg_owner_name: '', grg_employee_name: '', grg_name: '', city: '', preferred_language: '', phone_number: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to save garage employee');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleGarageStatus = async (empId) => {
    try {
      await garageEmployeesApi.toggleStatus(empId);
      toast.success('Status updated');
      fetchData();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  // Salary handlers
  const openSalaryModal = (employee = null) => {
    if (employee) {
      // Edit mode - find existing salary
      const existingSalary = salaries.find(s => s.user_id === employee.id);
      setSalaryForm({
        user_id: employee.id,
        ctc: existingSalary?.ctc || '',
        fixed_pay: existingSalary?.fixed_pay || '',
        variable_pay: existingSalary?.variable_pay || '',
        commission_percentage: existingSalary?.commission_percentage || '',
        per_inspection_payout: existingSalary?.per_inspection_payout || '',
        currency: existingSalary?.currency || 'INR'
      });
    } else {
      setSalaryForm({
        user_id: '',
        ctc: '',
        fixed_pay: '',
        variable_pay: '',
        commission_percentage: '',
        per_inspection_payout: '',
        currency: 'INR'
      });
    }
    setIsSalaryModalOpen(true);
  };

  const handleSalarySubmit = async (e) => {
    e.preventDefault();
    if (!salaryForm.user_id) {
      toast.error('Please select an employee');
      return;
    }
    setSaving(true);
    try {
      await salaryApi.create({
        user_id: salaryForm.user_id,
        ctc: parseFloat(salaryForm.ctc) || 0,
        fixed_pay: parseFloat(salaryForm.fixed_pay) || 0,
        variable_pay: parseFloat(salaryForm.variable_pay) || 0,
        commission_percentage: parseFloat(salaryForm.commission_percentage) || 0,
        per_inspection_payout: parseFloat(salaryForm.per_inspection_payout) || 0,
        currency: salaryForm.currency
      });
      toast.success('Salary structure saved');
      setIsSalaryModalOpen(false);
      fetchSalaries();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save salary');
    } finally {
      setSaving(false);
    }
  };

  // Format currency
  const formatCurrency = (amount, currency = 'INR') => {
    if (!amount) return '-';
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: currency,
      maximumFractionDigits: 0 
    }).format(amount);
  };

  // Format date
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get action badge color
  const getActionBadgeClass = (action) => {
    switch (action) {
      case 'create': return 'bg-green-100 text-green-800';
      case 'update': return 'bg-blue-100 text-blue-800';
      case 'delete': return 'bg-red-100 text-red-800';
      case 'reassign': return 'bg-purple-100 text-purple-800';
      case 'login': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const isHROrCEO = user?.role_code === 'CEO' || user?.role_code === 'HR_MANAGER';

  const tabs = [
    { id: 'employee', label: 'Employee', icon: Users },
    { id: 'digital-ad', label: 'Digital Ad Meta Data', icon: null },
    { id: 'garage', label: 'Garage Employee', icon: null },
    ...(isHROrCEO ? [
      { id: 'hr', label: 'HR / Salary', icon: DollarSign },
      { id: 'audit', label: 'Audit Trail', icon: History },
    ] : [])
  ];

  return (
    <div className="p-4 space-y-4" data-testid="admin-page">
      {/* Tabs */}
      <div className="card">
        <div className="flex border-b overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'border-[#2E3192] text-[#2E3192]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              data-testid={`${tab.id}-tab`}
            >
              {tab.icon && <tab.icon className="h-4 w-4" />}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Employee Tab */}
        {activeTab === 'employee' && (
          <div className="p-4">
            <div className="flex justify-end mb-4">
              <button className="btn-purple flex items-center gap-1" onClick={() => setIsEmployeeModalOpen(true)} data-testid="add-employee-button">
                <Plus className="h-4 w-4" /> Add Employee
              </button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Role</th>
                  <th>Country</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#2E3192]" /></td></tr>
                ) : employees.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-500">No employees found</td></tr>
                ) : (
                  employees.map((employee) => (
                    <tr key={employee.id} data-testid={`employee-row-${employee.id}`}>
                      <td>
                        <div>
                          <span className="font-medium block">{employee.name}</span>
                          <span className="text-xs text-gray-500">{employee.email}</span>
                        </div>
                      </td>
                      <td>
                        <span className="text-sm">{employee.role_name || employee.role}</span>
                      </td>
                      <td>
                        <span className="text-sm">{employee.country_name || '-'}</span>
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div 
                            className={`toggle-switch ${employee.is_active ? 'active' : ''}`}
                            onClick={() => handleToggleEmployeeStatus(employee.id)}
                            data-testid={`toggle-status-${employee.id}`}
                          />
                          <span className={employee.is_active ? 'text-[#10B981]' : 'text-gray-400'}>
                            {employee.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button className="btn-purple text-xs px-3 py-1" data-testid={`edit-employee-${employee.id}`}>
                            Edit
                          </button>
                          {isHROrCEO && (
                            <button 
                              className="text-xs px-3 py-1 border border-[#F5A623] text-[#F5A623] rounded hover:bg-[#F5A623] hover:text-white"
                              onClick={() => openSalaryModal(employee)}
                              data-testid={`set-salary-${employee.id}`}
                            >
                              <DollarSign className="h-3 w-3 inline mr-1" />
                              Salary
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

        {/* Digital Ad Meta Data Tab */}
        {activeTab === 'digital-ad' && (
          <div className="p-4">
            <div className="flex justify-end mb-4">
              <button className="btn-purple flex items-center gap-1" onClick={() => setIsAdModalOpen(true)} data-testid="create-ad-button">
                <Plus className="h-4 w-4" /> Create Ad
              </button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Ad Id</th>
                  <th>Ad Name</th>
                  <th>City</th>
                  <th>Language</th>
                  <th>Campaign Type</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#2E3192]" /></td></tr>
                ) : digitalAds.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-500">No ads found</td></tr>
                ) : (
                  digitalAds.map((ad) => (
                    <tr key={ad.id} data-testid={`ad-row-${ad.id}`}>
                      <td className="font-mono text-sm">{ad.ad_id}</td>
                      <td className="font-medium">{ad.ad_name}</td>
                      <td>{ad.city}</td>
                      <td>{ad.language}</td>
                      <td>{ad.campaign_type}</td>
                      <td>{ad.source}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div 
                            className={`toggle-switch ${ad.is_active ? 'active' : ''}`}
                            onClick={() => handleToggleAdStatus(ad.id)}
                            data-testid={`toggle-ad-${ad.id}`}
                          />
                          <span className={ad.is_active ? 'text-[#10B981]' : 'text-gray-400'}>
                            {ad.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <button className="text-gray-400 hover:text-[#6366F1]" title="Copy">
                            <Copy className="h-4 w-4" />
                          </button>
                          <button className="text-gray-400 hover:text-[#6366F1]" title="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button 
                            className="text-gray-400 hover:text-red-500" 
                            title="Delete"
                            onClick={() => handleDeleteAd(ad.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Garage Employee Tab */}
        {activeTab === 'garage' && (
          <div className="p-4">
            <div className="flex justify-end mb-4">
              <button className="btn-purple flex items-center gap-1" onClick={() => setIsGarageModalOpen(true)} data-testid="add-garage-employee-button">
                <Plus className="h-4 w-4" /> Add Employee
              </button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Grg Owner Name</th>
                  <th>Grg Employee Name</th>
                  <th>Grg Name</th>
                  <th>City</th>
                  <th>Preferred Language</th>
                  <th>Phone Number</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#2E3192]" /></td></tr>
                ) : garageEmployees.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-12 text-gray-500">No garage employees found</td></tr>
                ) : (
                  garageEmployees.map((emp) => (
                    <tr key={emp.id} data-testid={`garage-row-${emp.id}`}>
                      <td className="font-medium">{emp.grg_owner_name}</td>
                      <td>{emp.grg_employee_name}</td>
                      <td>{emp.grg_name}</td>
                      <td>{emp.city}</td>
                      <td>{emp.preferred_language}</td>
                      <td className="font-mono">{emp.phone_number}</td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div 
                            className={`toggle-switch ${emp.is_active ? 'active' : ''}`}
                            onClick={() => handleToggleGarageStatus(emp.id)}
                            data-testid={`toggle-garage-${emp.id}`}
                          />
                          <span className={emp.is_active ? 'text-[#10B981]' : 'text-gray-400'}>
                            {emp.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <button className="btn-purple text-xs px-3 py-1" data-testid={`edit-garage-${emp.id}`}>
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* HR / Salary Tab */}
        {activeTab === 'hr' && isHROrCEO && (
          <div className="p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-900">Employee Salary Management</h3>
              <button 
                className="btn-purple flex items-center gap-1" 
                onClick={() => openSalaryModal()}
                data-testid="add-salary-button"
              >
                <Plus className="h-4 w-4" /> Add Salary Structure
              </button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Role</th>
                  <th>CTC</th>
                  <th>Fixed Pay</th>
                  <th>Variable Pay</th>
                  <th>Commission %</th>
                  <th>Per Inspection</th>
                  <th>Effective From</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {salaryLoading ? (
                  <tr><td colSpan={9} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#2E3192]" /></td></tr>
                ) : salaries.length === 0 ? (
                  <tr><td colSpan={9} className="text-center py-12 text-gray-500">No salary structures found. Click "Add Salary Structure" to create one.</td></tr>
                ) : (
                  salaries.map((salary) => (
                    <tr key={salary.id} data-testid={`salary-row-${salary.id}`}>
                      <td>
                        <div>
                          <span className="font-medium block">{salary.user_name}</span>
                          <span className="text-xs text-gray-500">{salary.user_email}</span>
                        </div>
                      </td>
                      <td><span className="text-sm">{salary.role_name || '-'}</span></td>
                      <td className="font-medium text-green-600">{formatCurrency(salary.ctc, salary.currency)}</td>
                      <td>{formatCurrency(salary.fixed_pay, salary.currency)}</td>
                      <td>{formatCurrency(salary.variable_pay, salary.currency)}</td>
                      <td>{salary.commission_percentage ? `${salary.commission_percentage}%` : '-'}</td>
                      <td>{formatCurrency(salary.per_inspection_payout, salary.currency)}</td>
                      <td className="text-sm text-gray-500">{formatDate(salary.effective_from)}</td>
                      <td>
                        <button 
                          className="text-[#6366F1] hover:text-[#5558E3] text-sm"
                          onClick={() => {
                            const emp = employees.find(e => e.id === salary.user_id);
                            if (emp) openSalaryModal(emp);
                          }}
                          data-testid={`edit-salary-${salary.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Audit Trail Tab */}
        {activeTab === 'audit' && isHROrCEO && (
          <div className="p-4">
            {/* Audit Stats Summary */}
            {auditStats && (
              <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 rounded-lg p-4">
                  <p className="text-sm text-blue-600 font-medium">Total Actions</p>
                  <p className="text-2xl font-bold text-blue-800">{auditStats.total}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-4">
                  <p className="text-sm text-green-600 font-medium">Last 24 Hours</p>
                  <p className="text-2xl font-bold text-green-800">{auditStats.recent_24h}</p>
                </div>
                <div className="bg-purple-50 rounded-lg p-4">
                  <p className="text-sm text-purple-600 font-medium">Lead Actions</p>
                  <p className="text-2xl font-bold text-purple-800">{auditStats.by_entity?.lead || 0}</p>
                </div>
                <div className="bg-orange-50 rounded-lg p-4">
                  <p className="text-sm text-orange-600 font-medium">Salary Updates</p>
                  <p className="text-2xl font-bold text-orange-800">{auditStats.by_entity?.salary || 0}</p>
                </div>
              </div>
            )}

            {/* Filters */}
            <div className="flex items-center gap-4 mb-4 bg-gray-50 p-3 rounded-lg">
              <Filter className="h-4 w-4 text-gray-500" />
              <Select 
                value={auditFilters.entity_type} 
                onValueChange={(v) => setAuditFilters({...auditFilters, entity_type: v === 'all' ? '' : v})}
              >
                <SelectTrigger className="w-40 h-9 bg-white" data-testid="audit-entity-filter">
                  <SelectValue placeholder="Entity Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Entities</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="customer">Customer</SelectItem>
                  <SelectItem value="inspection">Inspection</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="salary">Salary</SelectItem>
                </SelectContent>
              </Select>

              <Select 
                value={auditFilters.action} 
                onValueChange={(v) => setAuditFilters({...auditFilters, action: v === 'all' ? '' : v})}
              >
                <SelectTrigger className="w-32 h-9 bg-white" data-testid="audit-action-filter">
                  <SelectValue placeholder="Action" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Actions</SelectItem>
                  <SelectItem value="create">Create</SelectItem>
                  <SelectItem value="update">Update</SelectItem>
                  <SelectItem value="delete">Delete</SelectItem>
                  <SelectItem value="reassign">Reassign</SelectItem>
                </SelectContent>
              </Select>

              <button 
                className="btn-purple flex items-center gap-1 text-sm"
                onClick={fetchAuditLogs}
                data-testid="refresh-audit-logs"
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
            </div>

            {/* Audit Logs Table */}
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditLoading ? (
                  <tr><td colSpan={5} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#2E3192]" /></td></tr>
                ) : auditLogs.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-gray-500">No audit logs found</td></tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} data-testid={`audit-row-${log.id}`}>
                      <td className="text-sm text-gray-600">{formatDate(log.timestamp)}</td>
                      <td>
                        <div>
                          <span className="font-medium block">{log.user_name || log.user_id}</span>
                          <span className="text-xs text-gray-500">{log.user_role}</span>
                        </div>
                      </td>
                      <td>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionBadgeClass(log.action)}`}>
                          {log.action}
                        </span>
                      </td>
                      <td>
                        <div>
                          <span className="font-medium block capitalize">{log.entity_type}</span>
                          <span className="text-xs text-gray-500 font-mono">{log.entity_id?.substring(0, 8)}...</span>
                        </div>
                      </td>
                      <td className="text-sm max-w-xs">
                        {log.new_values && (
                          <details className="cursor-pointer">
                            <summary className="text-blue-600 hover:text-blue-800">View Changes</summary>
                            <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-auto max-h-32">
                              {JSON.stringify(log.new_values, null, 2)}
                            </pre>
                          </details>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      <Dialog open={isEmployeeModalOpen} onOpenChange={setIsEmployeeModalOpen}>
        <DialogContent className="sm:max-w-[440px]" data-testid="employee-modal">
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEmployeeSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-1">
                <Label className="text-xs">Full Name</Label>
                <Input value={employeeForm.name} onChange={(e) => setEmployeeForm({ ...employeeForm, name: e.target.value })} className="h-9" placeholder="John Doe" data-testid="employee-name-input" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={employeeForm.email} onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })} className="h-9" placeholder="john@company.com" data-testid="employee-email-input" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Password</Label>
                <Input type="password" value={employeeForm.password} onChange={(e) => setEmployeeForm({ ...employeeForm, password: e.target.value })} className="h-9" placeholder="••••••••" data-testid="employee-password-input" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Role</Label>
                <Select value={employeeForm.role} onValueChange={(v) => setEmployeeForm({ ...employeeForm, role: v })}>
                  <SelectTrigger className="h-9" data-testid="employee-role-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEmployeeModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="btn-purple" disabled={saving} data-testid="save-employee-button">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign City Modal */}
      <Dialog open={isCityModalOpen} onOpenChange={setIsCityModalOpen}>
        <DialogContent className="sm:max-w-[380px]" data-testid="assign-city-modal">
          <DialogHeader>
            <DialogTitle>Assign City</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-500 mb-4">
              Assigning city to <span className="font-medium text-gray-900">{selectedEmployee?.name}</span>
            </p>
            <div className="space-y-1">
              <Label className="text-xs">Select City</Label>
              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger className="h-9" data-testid="city-select"><SelectValue placeholder="Choose city" /></SelectTrigger>
                <SelectContent>{cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsCityModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignCity} className="btn-purple" data-testid="confirm-assign-city">Assign</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Ad Modal */}
      <Dialog open={isAdModalOpen} onOpenChange={setIsAdModalOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="ad-modal">
          <DialogHeader>
            <DialogTitle>Create Ad</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Ad ID</Label>
                  <Input value={adForm.ad_id} onChange={(e) => setAdForm({ ...adForm, ad_id: e.target.value })} className="h-9" placeholder="Ad ID" data-testid="ad-id-input" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Ad Name</Label>
                  <Input value={adForm.ad_name} onChange={(e) => setAdForm({ ...adForm, ad_name: e.target.value })} className="h-9" placeholder="Ad Name" data-testid="ad-name-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">City</Label>
                  <Select value={adForm.city} onValueChange={(v) => setAdForm({ ...adForm, city: v })}>
                    <SelectTrigger className="h-9" data-testid="ad-city-select"><SelectValue placeholder="Select city" /></SelectTrigger>
                    <SelectContent>{cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Language</Label>
                  <Select value={adForm.language} onValueChange={(v) => setAdForm({ ...adForm, language: v })}>
                    <SelectTrigger className="h-9" data-testid="ad-language-select"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Hindi">Hindi</SelectItem>
                      <SelectItem value="Tamil">Tamil</SelectItem>
                      <SelectItem value="Telugu">Telugu</SelectItem>
                      <SelectItem value="Kannada">Kannada</SelectItem>
                      <SelectItem value="Malay">Malay</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Campaign Type</Label>
                  <Select value={adForm.campaign_type} onValueChange={(v) => setAdForm({ ...adForm, campaign_type: v })}>
                    <SelectTrigger className="h-9" data-testid="ad-campaign-select"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Awareness">Awareness</SelectItem>
                      <SelectItem value="Lead Generation">Lead Generation</SelectItem>
                      <SelectItem value="Conversion">Conversion</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Source</Label>
                  <Select value={adForm.source} onValueChange={(v) => setAdForm({ ...adForm, source: v })}>
                    <SelectTrigger className="h-9" data-testid="ad-source-select"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FACEBOOK">Facebook</SelectItem>
                      <SelectItem value="INSTAGRAM">Instagram</SelectItem>
                      <SelectItem value="GOOGLE">Google</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ad Amount (Optional)</Label>
                <Input type="number" value={adForm.ad_amount} onChange={(e) => setAdForm({ ...adForm, ad_amount: e.target.value })} className="h-9" placeholder="0.00" data-testid="ad-amount-input" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAdModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="btn-purple" disabled={saving} data-testid="save-ad-button">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Garage Employee Modal */}
      <Dialog open={isGarageModalOpen} onOpenChange={setIsGarageModalOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="garage-modal">
          <DialogHeader>
            <DialogTitle>Add Garage Employee</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGarageSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Grg Owner Name</Label>
                  <Input value={garageForm.grg_owner_name} onChange={(e) => setGarageForm({ ...garageForm, grg_owner_name: e.target.value })} className="h-9" placeholder="Owner name" data-testid="garage-owner-input" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Grg Employee Name</Label>
                  <Input value={garageForm.grg_employee_name} onChange={(e) => setGarageForm({ ...garageForm, grg_employee_name: e.target.value })} className="h-9" placeholder="Employee name" data-testid="garage-employee-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Grg Name</Label>
                  <Input value={garageForm.grg_name} onChange={(e) => setGarageForm({ ...garageForm, grg_name: e.target.value })} className="h-9" placeholder="Garage name" data-testid="garage-name-input" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">City</Label>
                  <Select value={garageForm.city} onValueChange={(v) => setGarageForm({ ...garageForm, city: v })}>
                    <SelectTrigger className="h-9" data-testid="garage-city-select"><SelectValue placeholder="Select city" /></SelectTrigger>
                    <SelectContent>{cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Preferred Language</Label>
                  <Select value={garageForm.preferred_language} onValueChange={(v) => setGarageForm({ ...garageForm, preferred_language: v })}>
                    <SelectTrigger className="h-9" data-testid="garage-language-select"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Hindi">Hindi</SelectItem>
                      <SelectItem value="Tamil">Tamil</SelectItem>
                      <SelectItem value="Telugu">Telugu</SelectItem>
                      <SelectItem value="Kannada">Kannada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone Number</Label>
                  <Input value={garageForm.phone_number} onChange={(e) => setGarageForm({ ...garageForm, phone_number: e.target.value })} className="h-9" placeholder="+91 98765 43210" data-testid="garage-phone-input" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsGarageModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="btn-purple" disabled={saving} data-testid="save-garage-button">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Salary Structure Modal */}
      <Dialog open={isSalaryModalOpen} onOpenChange={setIsSalaryModalOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="salary-modal">
          <DialogHeader>
            <DialogTitle>
              <DollarSign className="h-5 w-5 inline mr-2 text-green-600" />
              {salaryForm.user_id ? 'Update Salary Structure' : 'Add Salary Structure'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSalarySubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-1">
                <Label className="text-xs">Employee</Label>
                <Select 
                  value={salaryForm.user_id} 
                  onValueChange={(v) => setSalaryForm({ ...salaryForm, user_id: v })}
                  disabled={!!salaryForm.user_id}
                >
                  <SelectTrigger className="h-9" data-testid="salary-employee-select">
                    <SelectValue placeholder="Select Employee" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} - {emp.role_name || emp.role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">CTC (Annual)</Label>
                  <Input 
                    type="number" 
                    value={salaryForm.ctc} 
                    onChange={(e) => setSalaryForm({ ...salaryForm, ctc: e.target.value })} 
                    className="h-9" 
                    placeholder="e.g., 600000"
                    data-testid="salary-ctc-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Currency</Label>
                  <Select value={salaryForm.currency} onValueChange={(v) => setSalaryForm({ ...salaryForm, currency: v })}>
                    <SelectTrigger className="h-9" data-testid="salary-currency-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR">INR (₹)</SelectItem>
                      <SelectItem value="MYR">MYR (RM)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Fixed Pay (Monthly)</Label>
                  <Input 
                    type="number" 
                    value={salaryForm.fixed_pay} 
                    onChange={(e) => setSalaryForm({ ...salaryForm, fixed_pay: e.target.value })} 
                    className="h-9" 
                    placeholder="e.g., 40000"
                    data-testid="salary-fixed-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Variable Pay (Monthly)</Label>
                  <Input 
                    type="number" 
                    value={salaryForm.variable_pay} 
                    onChange={(e) => setSalaryForm({ ...salaryForm, variable_pay: e.target.value })} 
                    className="h-9" 
                    placeholder="e.g., 10000"
                    data-testid="salary-variable-input"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Commission Percentage (%)</Label>
                  <Input 
                    type="number" 
                    step="0.1"
                    value={salaryForm.commission_percentage} 
                    onChange={(e) => setSalaryForm({ ...salaryForm, commission_percentage: e.target.value })} 
                    className="h-9" 
                    placeholder="e.g., 2.5"
                    data-testid="salary-commission-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Per Inspection Payout</Label>
                  <Input 
                    type="number" 
                    value={salaryForm.per_inspection_payout} 
                    onChange={(e) => setSalaryForm({ ...salaryForm, per_inspection_payout: e.target.value })} 
                    className="h-9" 
                    placeholder="e.g., 500"
                    data-testid="salary-inspection-input"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsSalaryModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="btn-purple" disabled={saving} data-testid="save-salary-button">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Salary
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
