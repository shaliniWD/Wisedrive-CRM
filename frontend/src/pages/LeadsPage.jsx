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
  const [editingLead, setEditingLead] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [assigningLead, setAssigningLead] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [saving, setSaving] = useState(false);
  const [modalStep, setModalStep] = useState(1);

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

  const [paymentFormData, setPaymentFormData] = useState({
    hasCarDetails: 'Yes',
    carNo: '',
    carMake: '',
    carModel: '',
    carYear: '',
    fuelType: '',
    carColor: '',
    inspectionType: '',
    packageType: '',
    paymentType: '',
    discount: '',
    discountValue: '',
    customerMobile: '',
    city: '',
    address: '',
    inspectionDate: '',
    inspectionTime: '',
  });

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
      ...paymentFormData,
      customerMobile: lead.mobile,
      city: lead.city || '',
    });
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

  const clearFilters = () => {
    setSearch(''); setFilterEmployee(''); setFilterStatus(''); setFilterCity(''); setFilterSource('');
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
                        <div className="text-gray-400">RNR</div>
                      </div>
                    ) : '-'}
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
        <DialogContent className="sm:max-w-[600px]" data-testid="payment-modal">
          <DialogHeader>
            <DialogTitle>Payment And Inspection Modal</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            {/* Step 1: Car Info */}
            {modalStep === 1 && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <Label className="text-sm">Do you have Car details For Inspection?</Label>
                  <Select value={paymentFormData.hasCarDetails} onValueChange={(v) => setPaymentFormData({ ...paymentFormData, hasCarDetails: v })}>
                    <SelectTrigger className="w-[100px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Yes">Yes</SelectItem>
                      <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {paymentFormData.hasCarDetails === 'Yes' && (
                  <>
                    <div className="flex items-center gap-3">
                      <Label className="text-sm w-20">Car No:</Label>
                      <Input 
                        value={paymentFormData.carNo} 
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, carNo: e.target.value })}
                        className="flex-1"
                        placeholder="KA48N1000"
                      />
                      <button className="btn-yellow">Get Car Data</button>
                    </div>

                    {paymentFormData.carNo && (
                      <div className="bg-gray-50 p-4 rounded">
                        <h4 className="font-medium mb-2">Car Info</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div><span className="text-gray-500">Make:</span> {paymentFormData.carMake || 'FORD INDIA PVT LTD'}</div>
                          <div><span className="text-gray-500">Model:</span> {paymentFormData.carModel || '3.2 ENDEAVOUR 4*4'}</div>
                          <div><span className="text-gray-500">Year:</span> {paymentFormData.carYear || '4/2017'}</div>
                          <div><span className="text-gray-500">Fuel Type:</span> {paymentFormData.fuelType || 'DIESEL'}</div>
                          <div><span className="text-gray-500">Color:</span> {paymentFormData.carColor || 'DIAMONDWHITE'}</div>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {paymentFormData.hasCarDetails === 'No' && (
                  <div className="bg-yellow-50 p-3 rounded text-sm text-yellow-800">
                    This customer already has unused inspections. Customer details will be available in unscheduled list post payment.
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Book Inspection */}
            {modalStep === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">City</Label>
                    <Input value={paymentFormData.city} onChange={(e) => setPaymentFormData({ ...paymentFormData, city: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Customer Mobile Number</Label>
                    <Input value={paymentFormData.customerMobile} onChange={(e) => setPaymentFormData({ ...paymentFormData, customerMobile: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Address</Label>
                  <textarea 
                    className="form-input min-h-[80px]" 
                    value={paymentFormData.address}
                    onChange={(e) => setPaymentFormData({ ...paymentFormData, address: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Inspection Date</Label>
                    <Input type="date" value={paymentFormData.inspectionDate} onChange={(e) => setPaymentFormData({ ...paymentFormData, inspectionDate: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Time</Label>
                    <Select value={paymentFormData.inspectionTime} onValueChange={(v) => setPaymentFormData({ ...paymentFormData, inspectionTime: v })}>
                      <SelectTrigger><SelectValue placeholder="-- Select --" /></SelectTrigger>
                      <SelectContent>
                        {['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'].map(t => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Billing Details */}
            {modalStep === 3 && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Inspection Type</Label>
                    <Select value={paymentFormData.inspectionType} onValueChange={(v) => setPaymentFormData({ ...paymentFormData, inspectionType: v })}>
                      <SelectTrigger><SelectValue placeholder="-- Select --" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="basic">Basic</SelectItem>
                        <SelectItem value="comprehensive">Comprehensive</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Package Type</Label>
                    <Select value={paymentFormData.packageType} onValueChange={(v) => setPaymentFormData({ ...paymentFormData, packageType: v })}>
                      <SelectTrigger><SelectValue placeholder="-- Select --" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="silver">Silver</SelectItem>
                        <SelectItem value="gold">Gold</SelectItem>
                        <SelectItem value="platinum">Platinum</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Payment Type</Label>
                    <Select value={paymentFormData.paymentType} onValueChange={(v) => setPaymentFormData({ ...paymentFormData, paymentType: v })}>
                      <SelectTrigger><SelectValue placeholder="-- Select --" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="full">Full Payment</SelectItem>
                        <SelectItem value="partial">Partial</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Select Discount</Label>
                    <Select value={paymentFormData.discount} onValueChange={(v) => setPaymentFormData({ ...paymentFormData, discount: v })}>
                      <SelectTrigger><SelectValue placeholder="-- Select --" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="10">10%</SelectItem>
                        <SelectItem value="15">15%</SelectItem>
                        <SelectItem value="20">20%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Enter Discount Value</Label>
                    <Input value={paymentFormData.discountValue} onChange={(e) => setPaymentFormData({ ...paymentFormData, discountValue: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Customer Mobile Number</Label>
                    <Input value={paymentFormData.customerMobile} readOnly className="bg-gray-50" />
                  </div>
                </div>
              </div>
            )}

            {/* Progress Stepper */}
            <div className="stepper mt-6 pt-4 border-t">
              <div className="stepper-item">
                <div className={`stepper-circle ${modalStep >= 1 ? 'active' : 'inactive'}`}>1</div>
                <span className="text-xs text-gray-600">Car Info</span>
              </div>
              <div className={`stepper-line ${modalStep >= 2 ? 'active' : ''}`}></div>
              <div className="stepper-item">
                <div className={`stepper-circle ${modalStep >= 2 ? 'active' : 'inactive'}`}>2</div>
                <span className="text-xs text-gray-600">Book Inspection</span>
              </div>
              <div className={`stepper-line ${modalStep >= 3 ? 'active' : ''}`}></div>
              <div className="stepper-item">
                <div className={`stepper-circle ${modalStep >= 3 ? 'active' : 'inactive'}`}>3</div>
                <span className="text-xs text-gray-600">Billing Details</span>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-between pt-4 border-t">
            <button 
              className="btn-yellow"
              onClick={() => modalStep > 1 ? setModalStep(modalStep - 1) : setIsPaymentModalOpen(false)}
            >
              Back
            </button>
            {modalStep < 3 ? (
              <button className="btn-yellow" onClick={() => setModalStep(modalStep + 1)}>Next</button>
            ) : (
              <button className="btn-purple">Send Payment Link</button>
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
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="h-10 border-gray-300" data-testid="employee-select">
                  <SelectValue placeholder="-- Select Employee --" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">-- Select Employee --</SelectItem>
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
    </div>
  );
}
