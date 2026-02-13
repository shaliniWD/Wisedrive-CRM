import React, { useState, useEffect, useCallback } from 'react';
import { leadsApi, employeesApi, utilityApi } from '@/services/api';
import { formatDateTime, formatDate, formatTime } from '@/utils/dateFormat';
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
import { Search, Plus, Pencil, Loader2, X } from 'lucide-react';

const statusConfig = {
  NEW: { label: 'New', class: 'status-badge new' },
  CONTACTED: { label: 'Contacted', class: 'status-badge contacted' },
  INTERESTED: { label: 'Interested', class: 'status-badge interested' },
  NOT_INTERESTED: { label: 'Not Interested', class: 'status-badge' },
  CONVERTED: { label: 'Converted', class: 'status-badge green' },
  RNR: { label: 'RNR', class: 'status-badge rnr' },
  OUT_OF_SERVICE_AREA: { label: 'Out of Area', class: 'status-badge out-of-area' },
};

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [cities, setCities] = useState([]);
  const [sources, setSources] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [isReminderModalOpen, setIsReminderModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [assigningLead, setAssigningLead] = useState(null);
  const [reminderLead, setReminderLead] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalStep, setModalStep] = useState(1);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const [search, setSearch] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterSource, setFilterSource] = useState('');

  const [formData, setFormData] = useState({
    name: '', mobile: '', city: '', source: 'WEBSITE', status: 'NEW',
    assigned_to: '', reminder_date: '', reminder_time: '', notes: '',
    service_type: '',
  });

  const [reminderFormData, setReminderFormData] = useState({
    reminder_date: '',
    reminder_time: '',
    reminder_reason: '',
    notes: '',
  });

  const [paymentFormData, setPaymentFormData] = useState({
    hasCarDetails: 'yes',
    carNo: '',
    carMake: '',
    carModel: '',
    carYear: '',
    fuelType: '',
    carColor: '',
    carConfirmed: false,
    // Package details
    packageType: '',
    numberOfCars: '1',
    discountType: '',
    discountValue: '',
    // Scheduling
    city: '',
    inspectionDate: '',
    inspectionTime: '',
    address: '',
    latitude: '',
    longitude: '',
    // Customer
    customerMobile: '',
    customerName: '',
  });

  const [carLoading, setCarLoading] = useState(false);
  const [carError, setCarError] = useState('');

  // Mock Vaahan API call
  const fetchCarDetails = async (carNumber) => {
    setCarLoading(true);
    setCarError('');
    try {
      // Simulating API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock car data based on car number pattern
      const mockCarData = {
        carMake: 'MARUTI SUZUKI INDIA LTD',
        carModel: 'SWIFT VXI',
        carYear: '2021',
        fuelType: 'PETROL',
        carColor: 'PEARL ARCTIC WHITE',
        registrationDate: '15/03/2021',
        ownerName: 'Vehicle Owner',
      };
      
      setPaymentFormData(prev => ({
        ...prev,
        carMake: mockCarData.carMake,
        carModel: mockCarData.carModel,
        carYear: mockCarData.carYear,
        fuelType: mockCarData.fuelType,
        carColor: mockCarData.carColor,
      }));
      toast.success('Car details fetched successfully');
    } catch (error) {
      setCarError('Failed to fetch car details. Please check the car number.');
      toast.error('Failed to fetch car details');
    } finally {
      setCarLoading(false);
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (filterEmployee && filterEmployee !== 'all') params.assigned_to = filterEmployee;
      if (filterStatus && filterStatus !== 'all') params.lead_status = filterStatus;
      if (filterCity && filterCity !== 'all') params.city = filterCity;
      if (filterSource && filterSource !== 'all') params.source = filterSource;

      const [leadsRes, employeesRes, citiesRes, sourcesRes, statusesRes] = await Promise.all([
        leadsApi.getAll(params), employeesApi.getAll(), utilityApi.getCities(),
        utilityApi.getLeadSources(), utilityApi.getLeadStatuses(),
      ]);

      setLeads(leadsRes.data);
      setEmployees(employeesRes.data);
      setCities(citiesRes.data);
      setSources(sourcesRes.data);
      setStatuses(statusesRes.data);
    } catch (error) {
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [search, filterEmployee, filterStatus, filterCity, filterSource]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.mobile || !formData.city) {
      toast.error('Please fill in required fields');
      return;
    }
    setSaving(true);
    try {
      if (editingLead) {
        await leadsApi.update(editingLead.id, formData);
        toast.success('Lead updated');
      } else {
        await leadsApi.create(formData);
        toast.success('Lead created');
      }
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', mobile: '', city: '', source: 'WEBSITE', status: 'NEW',
      assigned_to: '', reminder_date: '', reminder_time: '', notes: '', service_type: '' });
    setEditingLead(null);
  };

  const openEditModal = (lead) => {
    setEditingLead(lead);
    setFormData({ name: lead.name, mobile: lead.mobile, city: lead.city, source: lead.source,
      status: lead.status, assigned_to: lead.assigned_to || '', reminder_date: lead.reminder_date || '',
      reminder_time: lead.reminder_time || '', notes: lead.notes || '', service_type: lead.service_type || '' });
    setIsModalOpen(true);
  };

  const openPaymentModal = (lead) => {
    setSelectedLead(lead);
    setPaymentFormData({
      hasCarDetails: 'yes',
      carNo: '',
      carMake: '',
      carModel: '',
      carYear: '',
      fuelType: '',
      carColor: '',
      carConfirmed: false,
      packageType: '',
      numberOfCars: '1',
      discountType: '',
      discountValue: '',
      city: lead.city || '',
      inspectionDate: '',
      inspectionTime: '',
      address: '',
      latitude: '',
      longitude: '',
      customerMobile: lead.mobile,
      customerName: lead.name,
    });
    setCarError('');
    setModalStep(1);
    setIsPaymentModalOpen(true);
  };

  const openAssignModal = (lead) => {
    setAssigningLead(lead);
    setSelectedEmployee(lead.assigned_to || '');
    setIsAssignModalOpen(true);
  };

  const handleAssignEmployee = async () => {
    if (!assigningLead) return;
    setSaving(true);
    try {
      await leadsApi.update(assigningLead.id, {
        ...assigningLead,
        assigned_to: selectedEmployee,
      });
      toast.success('Employee assigned successfully');
      setIsAssignModalOpen(false);
      setAssigningLead(null);
      setSelectedEmployee('');
      fetchData();
    } catch (error) {
      toast.error('Failed to assign employee');
    } finally {
      setSaving(false);
    }
  };

  const openReminderModal = (lead) => {
    setReminderLead(lead);
    setReminderFormData({
      reminder_date: lead.reminder_date || '',
      reminder_time: lead.reminder_time || '',
      reminder_reason: lead.reminder_reason || '',
      notes: lead.notes || '',
    });
    setIsReminderModalOpen(true);
  };

  const handleSaveReminder = async () => {
    if (!reminderLead) return;
    if (!reminderFormData.reminder_date || !reminderFormData.reminder_time) {
      toast.error('Please select date and time');
      return;
    }
    setSaving(true);
    try {
      await leadsApi.update(reminderLead.id, {
        ...reminderLead,
        reminder_date: reminderFormData.reminder_date,
        reminder_time: reminderFormData.reminder_time,
        reminder_reason: reminderFormData.reminder_reason,
        notes: reminderFormData.notes,
      });
      toast.success('Reminder saved successfully');
      setIsReminderModalOpen(false);
      setReminderLead(null);
      setReminderFormData({ reminder_date: '', reminder_time: '', reminder_reason: '', notes: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to save reminder');
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSearch(''); setFilterEmployee(''); setFilterStatus(''); setFilterCity(''); setFilterSource('');
    setCurrentPage(1);
  };

  // Filter leads based on search
  const filteredLeads = leads.filter(lead => {
    const matchesSearch = !search || 
      lead.name?.toLowerCase().includes(search.toLowerCase()) ||
      lead.mobile?.includes(search);
    return matchesSearch;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

  // Reset to page 1 when filters change
  const handleFilterChange = (setter) => (value) => {
    setter(value);
    setCurrentPage(1);
  };

  return (
    <div className="p-4 space-y-4" data-testid="leads-page">
      {/* Search and Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search Bar */}
        <div className="search-bar flex-1 min-w-[300px]">
          <Search className="h-4 w-4 text-gray-400 mr-2" />
          <input
            placeholder="Customer Name / Mobile Number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
            data-testid="search-input"
          />
        </div>

        {/* Filter Dropdowns */}
        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
          <SelectTrigger className="w-[160px] h-10 bg-white" data-testid="filter-employee">
            <SelectValue placeholder="-- Select Employee --" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees.map((emp) => (<SelectItem key={emp.id} value={emp.name}>{emp.name}</SelectItem>))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px] h-10 bg-white" data-testid="filter-status">
            <SelectValue placeholder="-- Select Status --" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {statuses.map((s) => (<SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>))}
          </SelectContent>
        </Select>

        <Select value={filterCity} onValueChange={setFilterCity}>
          <SelectTrigger className="w-[140px] h-10 bg-white" data-testid="filter-city">
            <SelectValue placeholder="-- Select City --" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
          </SelectContent>
        </Select>

        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-[140px] h-10 bg-white" data-testid="filter-source">
            <SelectValue placeholder="-- Select Source --" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {sources.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
          </SelectContent>
        </Select>

        {/* Action Buttons */}
        <button className="btn-purple" data-testid="submit-btn">Submit</button>
        <button className="btn-purple flex items-center gap-1" onClick={() => { resetForm(); setIsModalOpen(true); }} data-testid="add-lead-button">
          <Plus className="h-4 w-4" /> Add New
        </button>
        <button className="btn-purple" onClick={fetchData} data-testid="find-btn">Find</button>
      </div>

      {/* Leads Count and Quick Filters */}
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-gray-800">
          Leads Count: <span className="text-[#2E3192]">{leads.length.toLocaleString()}</span>
        </div>
        <div className="flex gap-3">
          {['Today', 'This Week', 'This Month', 'This Quarter', 'This Year'].map((period) => (
            <span key={period} className="quick-filter">{period}</span>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Lead Details</th>
              <th>City</th>
              <th>Assigned To</th>
              <th>Reminder</th>
              <th>Status</th>
              <th>Source</th>
              <th>Payment Link</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#2E3192]" /></td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-gray-500">No leads found</td></tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} data-testid={`lead-row-${lead.id}`}>
                  <td>
                    <div className="text-sm">{formatDateTime(lead.created_at)}</div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      <span className="font-mono">{lead.mobile}</span>
                      <button onClick={() => openEditModal(lead)} className="edit-icon" data-testid={`edit-lead-${lead.id}`}>
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="text-gray-500">{lead.name}</div>
                  </td>
                  <td>{lead.city}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <span>{lead.assigned_to || '-'}</span>
                      <button 
                        onClick={() => openAssignModal(lead)} 
                        className="edit-icon"
                        data-testid={`assign-employee-${lead.id}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                  <td className="text-sm">
                    {lead.reminder_date ? (
                      <div>
                        <div className="text-gray-600">Reminder Set on</div>
                        <div>{formatDate(lead.reminder_date)} at {formatTime(lead.reminder_time)}</div>
                        <div className="text-gray-500">{lead.reminder_reason || 'RNR'}</div>
                        {lead.notes && (
                          <div className="text-gray-400 text-xs mt-1 flex items-center gap-1">
                            {lead.notes.length > 30 ? lead.notes.substring(0, 30) + '...' : lead.notes}
                            <button 
                              onClick={() => openReminderModal(lead)} 
                              className="edit-icon"
                              data-testid={`edit-reminder-${lead.id}`}
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <button 
                        className="btn-yellow text-sm px-3 py-1"
                        onClick={() => openReminderModal(lead)}
                        data-testid={`add-reminder-${lead.id}`}
                      >
                        Reminder
                      </button>
                    )}
                  </td>
                  <td>
                    <span className={statusConfig[lead.status]?.class || 'status-badge'}>
                      {statusConfig[lead.status]?.label || lead.status}
                    </span>
                    <div className="text-xs text-gray-400 mt-1">{formatDate(lead.created_at)}</div>
                  </td>
                  <td>
                    <div className="text-sm">{lead.source}</div>
                    {lead.payment_link && <div className="font-mono text-xs text-gray-400">{lead.payment_link}</div>}
                  </td>
                  <td>
                    <button 
                      className="btn-yellow"
                      onClick={() => openPaymentModal(lead)}
                      data-testid={`send-pay-link-${lead.id}`}
                    >
                      Send Pay Link
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Lead Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden" data-testid="lead-modal">
          {/* Modal Header */}
          <div className="bg-white px-6 py-4 border-b">
            <div className="flex justify-between items-center">
              <DialogTitle className="text-lg font-medium">
                {editingLead ? '91Edit Lead' : 'Add Lead'}
              </DialogTitle>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600"
                data-testid="close-lead-modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="grid gap-4">
              {/* Row 1: Lead Name & Lead Source */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm text-gray-700">Lead Name</Label>
                  <Input 
                    value={formData.name} 
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-10 border-gray-300" 
                    data-testid="lead-name-input" 
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-gray-700">Lead Source</Label>
                  <Select value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v })}>
                    <SelectTrigger className="h-10 border-gray-300" data-testid="lead-source-select">
                      <SelectValue placeholder="-- Select Source --" />
                    </SelectTrigger>
                    <SelectContent>
                      {sources.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Mobile Number & Service Type */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm text-gray-700">Mobile Number</Label>
                  <Input 
                    value={formData.mobile} 
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="h-10 border-gray-300" 
                    data-testid="lead-mobile-input" 
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-gray-700">Service Type</Label>
                  <Select value={formData.service_type} onValueChange={(v) => setFormData({ ...formData, service_type: v })}>
                    <SelectTrigger className="h-10 border-gray-300" data-testid="lead-service-select">
                      <SelectValue placeholder="-- Select Service --" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INSPECTION">INSPECTION</SelectItem>
                      <SelectItem value="WARRANTY">WARRANTY</SelectItem>
                      <SelectItem value="SERVICE">SERVICE</SelectItem>
                      <SelectItem value="PARTS">PARTS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 3: City & Lead Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-sm text-gray-700">City</Label>
                  <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                    <SelectTrigger className="h-10 border-gray-300" data-testid="lead-city-select">
                      <SelectValue placeholder="-- Select City --" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-gray-700">Lead Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger className="h-10 border-gray-300" data-testid="lead-status-select">
                      <SelectValue placeholder="-- Select Status --" />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((s) => (<SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Notes Text */}
              <div className="space-y-1">
                <Label className="text-sm text-gray-700">Notes Text</Label>
                <textarea 
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2E3192] focus:border-transparent"
                  placeholder="Enter notes..."
                  data-testid="lead-notes-input"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 mt-6">
              <button 
                type="submit" 
                className="px-6 py-2 bg-[#F5A623] text-white rounded hover:bg-[#E09612] text-sm font-medium disabled:opacity-50"
                disabled={saving}
                data-testid="update-lead-button"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />}
                Update
              </button>
              <button 
                type="button" 
                className="px-6 py-2 bg-[#6366F1] text-white rounded hover:bg-[#5558E3] text-sm font-medium"
                onClick={() => setIsModalOpen(false)}
                data-testid="cancel-lead-button"
              >
                Cancel
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment And Inspection Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden max-h-[90vh] overflow-y-auto" data-testid="payment-modal">
          {/* Modal Header */}
          <div className="bg-[#2E3192] text-white px-6 py-4 sticky top-0 z-10">
            <div className="flex justify-between items-center">
              <DialogTitle className="text-lg font-semibold text-white">
                Send Payment Link
              </DialogTitle>
              <button 
                onClick={() => setIsPaymentModalOpen(false)} 
                className="text-white hover:text-gray-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {/* Customer Info */}
            <div className="text-sm mt-2 opacity-90">
              Customer: {paymentFormData.customerName} | Mobile: {paymentFormData.customerMobile}
            </div>
          </div>

          <div className="p-6">
            {/* Step 1: Car Details */}
            {modalStep === 1 && (
              <div className="space-y-6">
                <div className="text-lg font-medium text-gray-800 border-b pb-2">
                  Step 1: Car Details
                </div>

                {/* Has Car Details Question */}
                <div className="flex items-center gap-6 py-2">
                  <Label className="text-sm font-medium text-gray-700">
                    Does the customer know car details for inspection?
                  </Label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="hasCarDetails" 
                        value="yes"
                        checked={paymentFormData.hasCarDetails === 'yes'}
                        onChange={() => setPaymentFormData({ ...paymentFormData, hasCarDetails: 'yes', carConfirmed: false })}
                        className="w-4 h-4 text-[#2E3192]"
                      />
                      <span className="text-sm">Yes</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input 
                        type="radio" 
                        name="hasCarDetails" 
                        value="no"
                        checked={paymentFormData.hasCarDetails === 'no'}
                        onChange={() => setPaymentFormData({ ...paymentFormData, hasCarDetails: 'no', carConfirmed: false })}
                        className="w-4 h-4 text-[#2E3192]"
                      />
                      <span className="text-sm">No</span>
                    </label>
                  </div>
                </div>

                {/* Car Number Input - Only if Yes */}
                {paymentFormData.hasCarDetails === 'yes' && (
                  <div className="space-y-6">
                    <div className="flex items-end gap-4">
                      <div className="flex-1 space-y-2">
                        <Label className="text-sm text-gray-700">Enter Car Registration Number</Label>
                        <Input 
                          value={paymentFormData.carNo} 
                          onChange={(e) => setPaymentFormData({ ...paymentFormData, carNo: e.target.value.toUpperCase() })}
                          className="h-11 text-lg font-mono uppercase"
                          placeholder="KA01AB1234"
                          data-testid="car-number-input"
                        />
                      </div>
                      <button 
                        className="btn-yellow h-11 px-6 flex items-center gap-2"
                        onClick={() => fetchCarDetails(paymentFormData.carNo)}
                        disabled={!paymentFormData.carNo || carLoading}
                        data-testid="get-car-data-btn"
                      >
                        {carLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Get Car Data
                      </button>
                    </div>

                    {carError && (
                      <div className="bg-red-50 text-red-700 p-3 rounded text-sm">
                        {carError}
                      </div>
                    )}

                    {/* Car Details Display */}
                    {paymentFormData.carMake && (
                      <div className="bg-gray-50 p-5 rounded-lg border">
                        <h4 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          Vehicle Information (from Vaahan)
                        </h4>
                        <div className="grid grid-cols-2 gap-y-4 gap-x-8 text-sm">
                          <div>
                            <span className="text-gray-500">Make:</span>
                            <span className="ml-2 font-medium">{paymentFormData.carMake}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Model:</span>
                            <span className="ml-2 font-medium">{paymentFormData.carModel}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Year:</span>
                            <span className="ml-2 font-medium">{paymentFormData.carYear}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Fuel Type:</span>
                            <span className="ml-2 font-medium">{paymentFormData.fuelType}</span>
                          </div>
                          <div className="col-span-2">
                            <span className="text-gray-500">Color:</span>
                            <span className="ml-2 font-medium">{paymentFormData.carColor}</span>
                          </div>
                        </div>
                        
                        {/* Confirmation Checkbox */}
                        <div className="mt-4 pt-4 border-t">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input 
                              type="checkbox"
                              checked={paymentFormData.carConfirmed}
                              onChange={(e) => setPaymentFormData({ ...paymentFormData, carConfirmed: e.target.checked })}
                              className="w-5 h-5 text-[#2E3192] rounded"
                            />
                            <span className="text-sm font-medium">Customer confirms these car details are correct</span>
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* No Car Details Message */}
                {paymentFormData.hasCarDetails === 'no' && (
                  <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center text-white text-sm font-bold">!</div>
                      <div>
                        <p className="text-amber-800 font-medium">No Car Details Available</p>
                        <p className="text-amber-700 text-sm mt-1">
                          Customer will provide car details later. The inspection will appear in the unscheduled list after payment. 
                          Scheduling can be done once car details are available.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Package Selection */}
            {modalStep === 2 && (
              <div className="space-y-6">
                <div className="text-lg font-medium text-gray-800 border-b pb-2">
                  Step 2: Package & Payment Details
                </div>

                {/* Package Selection */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-700">Select Package</Label>
                    <Select 
                      value={paymentFormData.packageType || 'select_pkg'} 
                      onValueChange={(v) => setPaymentFormData({ ...paymentFormData, packageType: v === 'select_pkg' ? '' : v })}
                    >
                      <SelectTrigger className="h-11" data-testid="package-select">
                        <SelectValue placeholder="-- Select Package --" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="select_pkg">-- Select Package --</SelectItem>
                        <SelectItem value="basic">Basic Inspection - ₹499</SelectItem>
                        <SelectItem value="silver">Silver Package - ₹999</SelectItem>
                        <SelectItem value="gold">Gold Package - ₹1,499</SelectItem>
                        <SelectItem value="platinum">Platinum Package - ₹2,499</SelectItem>
                        <SelectItem value="comprehensive">Comprehensive - ₹2,999</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-gray-700">Number of Cars</Label>
                    <Select 
                      value={paymentFormData.numberOfCars} 
                      onValueChange={(v) => setPaymentFormData({ ...paymentFormData, numberOfCars: v })}
                    >
                      <SelectTrigger className="h-11" data-testid="num-cars-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[1, 2, 3, 4, 5].map(n => (
                          <SelectItem key={n} value={String(n)}>{n} Car{n > 1 ? 's' : ''}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Discount Section */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-700">Discount Type</Label>
                    <Select 
                      value={paymentFormData.discountType || 'no_discount'} 
                      onValueChange={(v) => setPaymentFormData({ ...paymentFormData, discountType: v === 'no_discount' ? '' : v })}
                    >
                      <SelectTrigger className="h-11" data-testid="discount-type-select">
                        <SelectValue placeholder="-- Select Discount --" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="no_discount">No Discount</SelectItem>
                        <SelectItem value="percentage">Percentage (%)</SelectItem>
                        <SelectItem value="flat">Flat Amount (₹)</SelectItem>
                        <SelectItem value="coupon">Coupon Code</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {paymentFormData.discountType && paymentFormData.discountType !== 'no_discount' && (
                    <div className="space-y-2">
                      <Label className="text-sm text-gray-700">
                        {paymentFormData.discountType === 'percentage' ? 'Discount Percentage' : 
                         paymentFormData.discountType === 'flat' ? 'Discount Amount' : 'Coupon Code'}
                      </Label>
                      <Input 
                        value={paymentFormData.discountValue} 
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, discountValue: e.target.value })}
                        className="h-11"
                        placeholder={paymentFormData.discountType === 'percentage' ? 'e.g., 10' : 
                                   paymentFormData.discountType === 'flat' ? 'e.g., 200' : 'Enter coupon code'}
                        data-testid="discount-value-input"
                      />
                    </div>
                  )}
                </div>

                {/* Price Summary */}
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                  <h4 className="font-medium text-blue-800 mb-3">Payment Summary</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Package:</span>
                      <span className="font-medium">{paymentFormData.packageType ? paymentFormData.packageType.charAt(0).toUpperCase() + paymentFormData.packageType.slice(1) : '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Number of Cars:</span>
                      <span className="font-medium">{paymentFormData.numberOfCars}</span>
                    </div>
                    {paymentFormData.discountValue && (
                      <div className="flex justify-between text-green-600">
                        <span>Discount:</span>
                        <span>-{paymentFormData.discountType === 'percentage' ? paymentFormData.discountValue + '%' : '₹' + paymentFormData.discountValue}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Scheduling (Only if car details provided) */}
            {modalStep === 3 && (
              <div className="space-y-6">
                <div className="text-lg font-medium text-gray-800 border-b pb-2">
                  Step 3: Schedule Inspection
                </div>

                {/* City and Date */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-700">City</Label>
                    <Select 
                      value={paymentFormData.city || 'select_city'} 
                      onValueChange={(v) => setPaymentFormData({ ...paymentFormData, city: v === 'select_city' ? '' : v })}
                    >
                      <SelectTrigger className="h-11" data-testid="schedule-city-select">
                        <SelectValue placeholder="-- Select City --" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="select_city">-- Select City --</SelectItem>
                        {cities.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm text-gray-700">Inspection Date</Label>
                    <Input 
                      type="date" 
                      value={paymentFormData.inspectionDate} 
                      onChange={(e) => setPaymentFormData({ ...paymentFormData, inspectionDate: e.target.value })}
                      className="h-11"
                      min={new Date().toISOString().split('T')[0]}
                      data-testid="schedule-date-input"
                    />
                  </div>
                </div>

                {/* Time Selection */}
                <div className="space-y-2">
                  <Label className="text-sm text-gray-700">Preferred Time Slot</Label>
                  <div className="grid grid-cols-4 gap-3">
                    {['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'].map(time => (
                      <button
                        key={time}
                        type="button"
                        onClick={() => setPaymentFormData({ ...paymentFormData, inspectionTime: time })}
                        className={`py-2 px-4 rounded border text-sm font-medium transition-all ${
                          paymentFormData.inspectionTime === time 
                            ? 'bg-[#2E3192] text-white border-[#2E3192]' 
                            : 'bg-white text-gray-700 border-gray-300 hover:border-[#2E3192]'
                        }`}
                        data-testid={`time-slot-${time}`}
                      >
                        {time}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Address / Location */}
                <div className="space-y-2">
                  <Label className="text-sm text-gray-700">Inspection Location / Address</Label>
                  <textarea 
                    value={paymentFormData.address}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, address: e.target.value })}
                    className="w-full min-h-[80px] px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2E3192] focus:border-transparent"
                    placeholder="Enter complete address for inspection..."
                    data-testid="schedule-address-input"
                  />
                </div>

                {/* Google Maps Placeholder */}
                <div className="bg-gray-100 rounded-lg p-4 border-2 border-dashed border-gray-300 text-center">
                  <div className="text-gray-500 text-sm">
                    <div className="font-medium mb-1">📍 Google Maps Integration</div>
                    <p>Location picker will be integrated here for precise location selection</p>
                  </div>
                </div>
              </div>
            )}

            {/* Progress Stepper */}
            <div className="flex items-center justify-center mt-8 pt-6 border-t">
              <div className="flex items-center gap-2">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${modalStep >= 1 ? 'bg-[#2E3192] text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
                <span className={`text-xs ${modalStep >= 1 ? 'text-[#2E3192] font-medium' : 'text-gray-500'}`}>Car Details</span>
                
                <div className={`w-16 h-1 mx-2 ${modalStep >= 2 ? 'bg-[#2E3192]' : 'bg-gray-200'}`}></div>
                
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${modalStep >= 2 ? 'bg-[#2E3192] text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
                <span className={`text-xs ${modalStep >= 2 ? 'text-[#2E3192] font-medium' : 'text-gray-500'}`}>Package</span>
                
                {paymentFormData.hasCarDetails === 'yes' && (
                  <>
                    <div className={`w-16 h-1 mx-2 ${modalStep >= 3 ? 'bg-[#2E3192]' : 'bg-gray-200'}`}></div>
                    
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${modalStep >= 3 ? 'bg-[#2E3192] text-white' : 'bg-gray-200 text-gray-500'}`}>3</div>
                    <span className={`text-xs ${modalStep >= 3 ? 'text-[#2E3192] font-medium' : 'text-gray-500'}`}>Schedule</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-between items-center p-6 bg-gray-50 border-t sticky bottom-0">
            <button 
              className="px-6 py-2.5 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
              onClick={() => {
                if (modalStep > 1) {
                  setModalStep(modalStep - 1);
                } else {
                  setIsPaymentModalOpen(false);
                }
              }}
              data-testid="payment-back-btn"
            >
              {modalStep === 1 ? 'Cancel' : 'Back'}
            </button>
            
            {/* Next / Send Payment Link Button */}
            {(paymentFormData.hasCarDetails === 'yes' && modalStep < 3) || (paymentFormData.hasCarDetails === 'no' && modalStep < 2) ? (
              <button 
                className="px-6 py-2.5 bg-[#F5A623] text-white rounded hover:bg-[#E09612] text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={() => setModalStep(modalStep + 1)}
                disabled={
                  (modalStep === 1 && paymentFormData.hasCarDetails === 'yes' && !paymentFormData.carConfirmed) ||
                  (modalStep === 2 && !paymentFormData.packageType)
                }
                data-testid="payment-next-btn"
              >
                Next Step
              </button>
            ) : (
              <button 
                className="px-8 py-2.5 bg-[#2E3192] text-white rounded hover:bg-[#252880] text-sm font-medium flex items-center gap-2"
                onClick={() => {
                  toast.success('Payment link sent to customer!');
                  setIsPaymentModalOpen(false);
                }}
                data-testid="send-payment-link-btn"
              >
                <span>💳</span> Send Payment Link (Razorpay)
              </button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Employee Modal */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-[400px] p-0 overflow-hidden" data-testid="assign-employee-modal">
          {/* Modal Header */}
          <div className="bg-white px-6 py-4 border-b">
            <div className="flex justify-between items-center">
              <DialogTitle className="text-lg font-medium">Assign Employee</DialogTitle>
              <button 
                onClick={() => setIsAssignModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600"
                data-testid="close-assign-modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-sm text-gray-700">Employee List:</Label>
              <Select value={selectedEmployee || 'unassigned'} onValueChange={(v) => setSelectedEmployee(v === 'unassigned' ? '' : v)}>
                <SelectTrigger className="h-10 border-gray-300" data-testid="employee-select">
                  <SelectValue placeholder="-- Select Employee --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">-- Select Employee --</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.name}>{emp.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button 
                type="button" 
                className="px-6 py-2 bg-[#6366F1] text-white rounded hover:bg-[#5558E3] text-sm font-medium"
                onClick={() => setIsAssignModalOpen(false)}
                data-testid="cancel-assign-button"
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="px-6 py-2 bg-[#F5A623] text-white rounded hover:bg-[#E09612] text-sm font-medium disabled:opacity-50"
                onClick={handleAssignEmployee}
                disabled={saving}
                data-testid="save-assign-button"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />}
                Save
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Reminder Modal */}
      <Dialog open={isReminderModalOpen} onOpenChange={setIsReminderModalOpen}>
        <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden" data-testid="reminder-modal">
          {/* Modal Header */}
          <div className="bg-white px-6 py-4 border-b">
            <div className="flex justify-between items-center">
              <DialogTitle className="text-lg font-medium">Add Reminder</DialogTitle>
              <button 
                onClick={() => setIsReminderModalOpen(false)} 
                className="text-gray-400 hover:text-gray-600"
                data-testid="close-reminder-modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {/* Date, Time, Reason Row */}
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-sm text-gray-700">Select Date</Label>
                <Input 
                  type="date"
                  value={reminderFormData.reminder_date}
                  onChange={(e) => setReminderFormData({ ...reminderFormData, reminder_date: e.target.value })}
                  className="h-10 border-gray-300"
                  placeholder="Select a date"
                  data-testid="reminder-date-input"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm text-gray-700">Select Time</Label>
                <Select 
                  value={reminderFormData.reminder_time || 'select_time'} 
                  onValueChange={(v) => setReminderFormData({ ...reminderFormData, reminder_time: v === 'select_time' ? '' : v })}
                >
                  <SelectTrigger className="h-10 border-gray-300" data-testid="reminder-time-select">
                    <SelectValue placeholder="-- Select --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="select_time">-- Select --</SelectItem>
                    {['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', 
                      '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
                      '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00'].map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-sm text-gray-700">Select Reason</Label>
                <Select 
                  value={reminderFormData.reminder_reason || 'select_reason'} 
                  onValueChange={(v) => setReminderFormData({ ...reminderFormData, reminder_reason: v === 'select_reason' ? '' : v })}
                >
                  <SelectTrigger className="h-10 border-gray-300" data-testid="reminder-reason-select">
                    <SelectValue placeholder="-- Select Reminder Reason --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="select_reason">-- Select Reminder Reason --</SelectItem>
                    <SelectItem value="RNR">RNR (Ring No Response)</SelectItem>
                    <SelectItem value="CALL_BACK">Call Back Requested</SelectItem>
                    <SelectItem value="FOLLOW_UP">Follow Up</SelectItem>
                    <SelectItem value="REQUESTED_CALL_BACK">Requested Call Back</SelectItem>
                    <SelectItem value="BUSY">Customer Busy</SelectItem>
                    <SelectItem value="NOT_INTERESTED_NOW">Not Interested Now</SelectItem>
                    <SelectItem value="THINKING">Customer Thinking</SelectItem>
                    <SelectItem value="PRICE_CONCERN">Price Concern</SelectItem>
                    <SelectItem value="OTHER">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <Label className="text-sm text-gray-700">Notes</Label>
              <textarea 
                value={reminderFormData.notes}
                onChange={(e) => setReminderFormData({ ...reminderFormData, notes: e.target.value })}
                className="w-full min-h-[100px] px-3 py-2 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#2E3192] focus:border-transparent"
                placeholder="Add notes about the reminder..."
                data-testid="reminder-notes-input"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <button 
                type="button" 
                className="px-6 py-2 bg-[#F5A623] text-white rounded hover:bg-[#E09612] text-sm font-medium disabled:opacity-50"
                onClick={handleSaveReminder}
                disabled={saving}
                data-testid="save-reminder-button"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2 inline" />}
                Save
              </button>
              <button 
                type="button" 
                className="px-6 py-2 bg-[#6366F1] text-white rounded hover:bg-[#5558E3] text-sm font-medium"
                onClick={() => setIsReminderModalOpen(false)}
                data-testid="cancel-reminder-button"
              >
                Cancel
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
