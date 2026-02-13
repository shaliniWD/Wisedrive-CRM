import React, { useState, useEffect, useCallback } from 'react';
import { employeesApi, digitalAdsApi, garageEmployeesApi, utilityApi } from '@/services/api';
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
import { Plus, Loader2, Pencil, Trash2, Copy } from 'lucide-react';

export default function AdminPage() {
  const [employees, setEmployees] = useState([]);
  const [digitalAds, setDigitalAds] = useState([]);
  const [garageEmployees, setGarageEmployees] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('employee');
  
  // Modal states
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isAdModalOpen, setIsAdModalOpen] = useState(false);
  const [isGarageModalOpen, setIsGarageModalOpen] = useState(false);
  const [isCityModalOpen, setIsCityModalOpen] = useState(false);
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

  const fetchData = useCallback(async () => {
    try {
      const [employeesRes, adsRes, garageRes, citiesRes] = await Promise.all([
        employeesApi.getAll(),
        digitalAdsApi.getAll(),
        garageEmployeesApi.getAll(),
        utilityApi.getCities(),
      ]);
      setEmployees(employeesRes.data);
      setDigitalAds(adsRes.data);
      setGarageEmployees(garageRes.data);
      setCities(citiesRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

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
              <button className="btn-purple flex items-center gap-1" onClick={() => setIsEmployeeModalOpen(true)} data-testid="add-employee-button">
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
                            onClick={() => handleToggleEmployeeStatus(employee.id)}
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
                    <SelectTrigger className="h-9" data-testid="ad-city-select"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                    <SelectContent>{cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Language</Label>
                  <Select value={adForm.language} onValueChange={(v) => setAdForm({ ...adForm, language: v })}>
                    <SelectTrigger className="h-9" data-testid="ad-language-select"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hindi">Hindi</SelectItem>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Kannada">Kannada</SelectItem>
                      <SelectItem value="Telugu">Telugu</SelectItem>
                      <SelectItem value="Tamil">Tamil</SelectItem>
                      <SelectItem value="Marathi">Marathi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Campaign Type</Label>
                  <Select value={adForm.campaign_type} onValueChange={(v) => setAdForm({ ...adForm, campaign_type: v })}>
                    <SelectTrigger className="h-9" data-testid="ad-campaign-select"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Instagram">Instagram</SelectItem>
                      <SelectItem value="Google">Google</SelectItem>
                      <SelectItem value="YouTube">YouTube</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Source</Label>
                  <Select value={adForm.source} onValueChange={(v) => setAdForm({ ...adForm, source: v })}>
                    <SelectTrigger className="h-9" data-testid="ad-source-select"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Facebook">Facebook</SelectItem>
                      <SelectItem value="Google Ads">Google Ads</SelectItem>
                      <SelectItem value="YouTube Ads">YouTube Ads</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsAdModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="btn-purple" disabled={saving} data-testid="save-ad-button">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save
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
                  <Label className="text-xs">Garage Owner Name</Label>
                  <Input value={garageForm.grg_owner_name} onChange={(e) => setGarageForm({ ...garageForm, grg_owner_name: e.target.value })} className="h-9" placeholder="Owner Name" data-testid="grg-owner-input" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Garage Employee Name</Label>
                  <Input value={garageForm.grg_employee_name} onChange={(e) => setGarageForm({ ...garageForm, grg_employee_name: e.target.value })} className="h-9" placeholder="Employee Name" data-testid="grg-employee-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Garage Name</Label>
                  <Input value={garageForm.grg_name} onChange={(e) => setGarageForm({ ...garageForm, grg_name: e.target.value })} className="h-9" placeholder="Garage Name" data-testid="grg-name-input" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">City</Label>
                  <Select value={garageForm.city} onValueChange={(v) => setGarageForm({ ...garageForm, city: v })}>
                    <SelectTrigger className="h-9" data-testid="grg-city-select"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                    <SelectContent>{cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Preferred Language</Label>
                  <Select value={garageForm.preferred_language} onValueChange={(v) => setGarageForm({ ...garageForm, preferred_language: v })}>
                    <SelectTrigger className="h-9" data-testid="grg-language-select"><SelectValue placeholder="-- Select --" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Hindi">Hindi</SelectItem>
                      <SelectItem value="English">English</SelectItem>
                      <SelectItem value="Kannada">Kannada</SelectItem>
                      <SelectItem value="Telugu">Telugu</SelectItem>
                      <SelectItem value="Tamil">Tamil</SelectItem>
                      <SelectItem value="Marathi">Marathi</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone Number</Label>
                  <Input value={garageForm.phone_number} onChange={(e) => setGarageForm({ ...garageForm, phone_number: e.target.value })} className="h-9" placeholder="Phone Number" data-testid="grg-phone-input" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsGarageModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="btn-purple" disabled={saving} data-testid="save-garage-button">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
