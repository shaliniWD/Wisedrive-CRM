import React, { useState, useEffect, useCallback } from 'react';
import { employeesApi, utilityApi } from '@/services/api';
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
import { Plus, Loader2 } from 'lucide-react';

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
      setFormData({ name: '', email: '', password: '', role: 'employee', assigned_cities: [], is_active: true });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save employee');
    } finally {
      setSaving(false);
    }
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
    { id: 'employee', label: 'Employee' },
    { id: 'digital-ad', label: 'Digital Ad Meta Data' },
    { id: 'garage', label: 'Garage Employee' },
  ];

  return (
    <div className="p-4 space-y-4" data-testid="admin-page">
      {/* Tabs */}
      <div className="card">
        <div className="flex border-b">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === tab.id
                  ? 'border-[#2E3192] text-[#2E3192]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              data-testid={`${tab.id}-tab`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Employee Tab */}
        {activeTab === 'employee' && (
          <div className="p-4">
            <div className="flex justify-end mb-4">
              <button className="btn-purple flex items-center gap-1" onClick={() => setIsModalOpen(true)} data-testid="add-employee-button">
                <Plus className="h-4 w-4" /> Add Employee
              </button>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Assigned Cities</th>
                  <th>City</th>
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
                      <td className="font-medium">{employee.name}</td>
                      <td>
                        {employee.assigned_cities?.length > 0 
                          ? employee.assigned_cities.join(', ') 
                          : <span className="text-gray-400">No Cities Assigned</span>}
                      </td>
                      <td>
                        <button 
                          className="status-badge completed cursor-pointer text-xs"
                          onClick={() => openCityModal(employee)}
                          data-testid={`assign-city-${employee.id}`}
                        >
                          Assign City
                        </button>
                      </td>
                      <td>
                        <div className="flex items-center gap-3">
                          <div 
                            className={`toggle-switch ${employee.is_active ? 'active' : ''}`}
                            onClick={() => handleToggleStatus(employee.id)}
                            data-testid={`toggle-status-${employee.id}`}
                          />
                          <span className={employee.is_active ? 'text-[#10B981]' : 'text-gray-400'}>
                            {employee.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                      </td>
                      <td>
                        <button className="btn-purple text-xs px-3 py-1" data-testid={`edit-employee-${employee.id}`}>
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

        {/* Digital Ad Tab */}
        {activeTab === 'digital-ad' && (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg font-medium">Digital Ad Meta Data</p>
            <p className="text-sm mt-2">Configure your digital advertising metadata here</p>
          </div>
        )}

        {/* Garage Tab */}
        {activeTab === 'garage' && (
          <div className="p-12 text-center text-gray-500">
            <p className="text-lg font-medium">Garage Employee Management</p>
            <p className="text-sm mt-2">Manage garage employees and mechanics</p>
          </div>
        )}
      </div>

      {/* Add Employee Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[440px]" data-testid="employee-modal">
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-1">
                <Label className="text-xs">Full Name</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="h-9" placeholder="John Doe" data-testid="employee-name-input" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="h-9" placeholder="john@company.com" data-testid="employee-email-input" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Password</Label>
                <Input type="password" value={formData.password} onChange={(e) => setFormData({ ...formData, password: e.target.value })} className="h-9" placeholder="••••••••" data-testid="employee-password-input" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Role</Label>
                <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
                  <SelectTrigger className="h-9" data-testid="employee-role-select"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee">Employee</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
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
    </div>
  );
}
