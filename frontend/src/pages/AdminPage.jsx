import React, { useState, useEffect, useCallback } from 'react';
import { employeesApi, utilityApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Plus, Loader2, MapPin, Users, Megaphone, Wrench } from 'lucide-react';

export default function AdminPage() {
  const [employees, setEmployees] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('employee');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [selectedCity, setSelectedCity] = useState('');

  const [formData, setFormData] = useState({
    name: '', email: '', password: '', role: 'employee', assigned_cities: [], is_active: true,
  });

  const fetchData = useCallback(async () => {
    try {
      const [employeesRes, citiesRes] = await Promise.all([
        employeesApi.getAll(), utilityApi.getCities(),
      ]);
      setEmployees(employeesRes.data);
      setCities(citiesRes.data);
    } catch (error) {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.password) {
      toast.error('Please fill in required fields');
      return;
    }
    setSaving(true);
    try {
      await employeesApi.create(formData);
      toast.success('Employee created');
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save employee');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', email: '', password: '', role: 'employee', assigned_cities: [], is_active: true });
  };

  const handleToggleStatus = async (employeeId) => {
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

  const tabs = [
    { id: 'employee', label: 'Employees', icon: Users },
    { id: 'digital-ad', label: 'Digital Ad Meta', icon: Megaphone },
    { id: 'garage', label: 'Garage Employees', icon: Wrench },
  ];

  return (
    <div className="space-y-5" data-testid="admin-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Admin</h1>
          <p className="text-slate-500 mt-1">Manage employees and settings</p>
        </div>
        {activeTab === 'employee' && (
          <Button onClick={() => setIsModalOpen(true)} className="bg-indigo-600 hover:bg-indigo-700" data-testid="add-employee-button">
            <Plus className="h-4 w-4 mr-2" /> Add Employee
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm">
        <div className="flex border-b border-slate-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-700'
                    : 'border-transparent text-slate-500 hover:text-slate-700'
                }`}
                data-testid={`${tab.id}-tab`}
              >
                <Icon className="h-4 w-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Employee Tab */}
        {activeTab === 'employee' && (
          <div className="p-0">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Assigned Cities</th>
                  <th>Assign</th>
                  <th>Status</th>
                  <th className="w-[100px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600" /></td></tr>
                ) : employees.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-12 text-slate-500">No employees found</td></tr>
                ) : (
                  employees.map((employee) => (
                    <tr key={employee.id} data-testid={`employee-row-${employee.id}`}>
                      <td className="font-medium text-slate-900">{employee.name}</td>
                      <td className="text-slate-600">
                        {employee.assigned_cities?.length > 0 
                          ? employee.assigned_cities.join(', ') 
                          : <span className="text-slate-400">No cities assigned</span>}
                      </td>
                      <td>
                        <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700 text-xs"
                          onClick={() => openCityModal(employee)} data-testid={`assign-city-${employee.id}`}>
                          <MapPin className="h-3 w-3 mr-1" /> Assign City
                        </Button>
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <Switch 
                            checked={employee.is_active}
                            onCheckedChange={() => handleToggleStatus(employee.id)}
                            data-testid={`toggle-status-${employee.id}`}
                          />
                          <span className={`text-sm ${employee.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>
                            {employee.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <Button size="sm" variant="outline" className="h-7 text-xs" data-testid={`edit-employee-${employee.id}`}>
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Other Tabs */}
        {activeTab === 'digital-ad' && (
          <div className="p-12 text-center">
            <Megaphone className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-700">Digital Ad Meta Data</h3>
            <p className="text-slate-500 mt-2">Configure your digital advertising metadata here</p>
          </div>
        )}

        {activeTab === 'garage' && (
          <div className="p-12 text-center">
            <Wrench className="h-12 w-12 mx-auto text-slate-300 mb-4" />
            <h3 className="text-lg font-medium text-slate-700">Garage Employees</h3>
            <p className="text-slate-500 mt-2">Manage garage employees and mechanics</p>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[440px]" data-testid="employee-modal">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit, sans-serif' }}>Add Employee</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label className="text-sm">Full Name *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="h-9" placeholder="John Doe" data-testid="employee-name-input" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Email *</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-9" placeholder="john@company.com" data-testid="employee-email-input" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Password *</Label>
                <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="h-9" placeholder="••••••••" data-testid="employee-password-input" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm">Role</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger className="h-9" data-testid="employee-role-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={saving} data-testid="save-employee-button">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Assign City Modal */}
      <Dialog open={isCityModalOpen} onOpenChange={setIsCityModalOpen}>
        <DialogContent className="sm:max-w-[380px]" data-testid="assign-city-modal">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit, sans-serif' }}>Assign City</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-slate-500 mb-4">
              Assigning city to <span className="font-medium text-slate-900">{selectedEmployee?.name}</span>
            </p>
            <div className="space-y-2">
              <Label className="text-sm">Select City</Label>
              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger className="h-9" data-testid="city-select"><SelectValue placeholder="Choose city" /></SelectTrigger>
                <SelectContent>{cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsCityModalOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignCity} className="bg-indigo-600 hover:bg-indigo-700" data-testid="confirm-assign-city">
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
