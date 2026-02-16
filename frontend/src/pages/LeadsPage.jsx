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
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { 
  Search, Plus, Pencil, Loader2, X, Users, TrendingUp, Calendar, 
  Phone, MapPin, Bell, Clock, CreditCard, Copy, ChevronLeft, ChevronRight, Filter,
  MessageCircle, Link2, ExternalLink, Eye, Flame, ChevronDown, Percent, CalendarDays,
  StickyNote, Activity, Send, FileText
} from 'lucide-react';

// Inline Status Dropdown Component - Click to update status
const StatusDropdown = ({ lead, statuses, onUpdate }) => {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  // Status colors based on the 22 statuses
  const getStatusConfig = (status) => {
    const configs = {
      'NEW LEAD': { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'New Lead' },
      'RNR': { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'RNR' },
      'RNR1': { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'RNR1' },
      'RNR2': { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'RNR2' },
      'RNR3': { color: 'bg-red-100 text-red-800 border-red-200', label: 'RNR3' },
      'FOLLOW UP': { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Follow Up' },
      'WHATSAPP FOLLOW UP': { color: 'bg-green-100 text-green-800 border-green-200', label: 'WhatsApp Follow Up' },
      'Repeat follow up': { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Repeat Follow Up' },
      'HOT LEADS': { color: 'bg-red-100 text-red-800 border-red-200', label: 'Hot Leads' },
      'NOT INTERESTED': { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Not Interested' },
      'DEAD LEAD': { color: 'bg-gray-200 text-gray-800 border-gray-300', label: 'Dead Lead' },
      'ESCALATION': { color: 'bg-red-100 text-red-800 border-red-200', label: 'Escalation' },
      'STOP': { color: 'bg-gray-200 text-gray-700 border-gray-300', label: 'Stop' },
      'OUT OF SERVICE AREA': { color: 'bg-slate-100 text-slate-800 border-slate-200', label: 'Out of Service Area' },
      'WRONG NUMBER': { color: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Wrong Number' },
      'PURCHASED FROM COMPETITOR': { color: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Purchased from Competitor' },
      'PAYMENT LINK SENT': { color: 'bg-purple-100 text-purple-800 border-purple-200', label: 'Payment Link Sent' },
      'PAID': { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Paid' },
      'CAR FINALIZED': { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Car Finalized' },
      'Car purchased': { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Car Purchased' },
      'CC GENERATED': { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'CC Generated' },
      'RCB WHATSAPP': { color: 'bg-green-100 text-green-800 border-green-200', label: 'RCB WhatsApp' },
    };
    return configs[status] || { color: 'bg-gray-100 text-gray-800 border-gray-200', label: status };
  };

  const cfg = getStatusConfig(lead.status);

  const handleStatusChange = async (newStatus) => {
    if (newStatus === lead.status) {
      setOpen(false);
      return;
    }
    setUpdating(true);
    try {
      await leadsApi.updateStatus(lead.id, newStatus);
      toast.success(`Status updated to ${getStatusConfig(newStatus).label}`);
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update status');
    } finally {
      setUpdating(false);
      setOpen(false);
    }
  };
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button 
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border cursor-pointer hover:shadow-md transition-all ${cfg.color}`}
          data-testid={`status-dropdown-${lead.id}`}
          disabled={updating}
        >
          {updating ? <Loader2 className="h-3 w-3 animate-spin" /> : cfg.label}
          <ChevronDown className="h-3 w-3" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1 max-h-[300px] overflow-y-auto" align="start">
        <div className="space-y-1">
          {statuses.map((status) => {
            const statusCfg = getStatusConfig(status.value || status);
            const statusValue = status.value || status;
            return (
              <button
                key={statusValue}
                onClick={() => handleStatusChange(statusValue)}
                className={`w-full text-left px-3 py-2 text-xs rounded-lg hover:bg-slate-100 flex items-center gap-2 ${lead.status === statusValue ? 'bg-slate-100 font-semibold' : ''}`}
              >
                <span className={`w-2 h-2 rounded-full ${statusCfg.color.split(' ')[0]}`}></span>
                {statusCfg.label}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Summary Card Component - Compact version for sales dashboard
const SummaryCard = ({ title, value, icon: Icon, color, onClick, active }) => (
  <div 
    className={`rounded-xl border bg-white p-4 hover:shadow-lg transition-all duration-300 cursor-pointer ${active ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-center gap-3">
      <div className={`p-2.5 rounded-xl bg-gradient-to-r ${
        color?.includes('blue') ? 'from-blue-500 to-blue-600' : 
        color?.includes('emerald') ? 'from-emerald-500 to-emerald-600' : 
        color?.includes('amber') ? 'from-amber-500 to-amber-600' :
        color?.includes('green') ? 'from-green-500 to-green-600' :
        color?.includes('orange') ? 'from-orange-500 to-orange-600' :
        color?.includes('red') ? 'from-red-500 to-red-600' :
        'from-gray-500 to-gray-600'
      }`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className={`text-2xl font-bold ${color || 'text-gray-900'}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="text-xs font-medium text-gray-500">{title}</p>
      </div>
    </div>
  </div>
);

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
  const [activeFilter, setActiveFilter] = useState('all');

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
    service_type: '', ad_id: '',
  });

  const [reminderFormData, setReminderFormData] = useState({
    reminder_date: '', reminder_time: '', reminder_reason: '', notes: '',
  });

  const [paymentFormData, setPaymentFormData] = useState({
    hasCarDetails: 'yes', carNo: '', carMake: '', carModel: '', carYear: '',
    fuelType: '', carColor: '', carConfirmed: false, packageType: '',
    numberOfCars: '1', discountType: '', discountValue: '', city: '',
    inspectionDate: '', inspectionTime: '', address: '', latitude: '',
    longitude: '', customerMobile: '', customerName: '',
  });

  const [carLoading, setCarLoading] = useState(false);
  const [carError, setCarError] = useState('');
  const [reassignReason, setReassignReason] = useState('');

  // Get today's date for filtering
  const today = new Date().toISOString().split('T')[0];

  // Notes and Activities states
  const [isNotesDrawerOpen, setIsNotesDrawerOpen] = useState(false);
  const [selectedLeadForNotes, setSelectedLeadForNotes] = useState(null);
  const [leadNotes, setLeadNotes] = useState([]);
  const [leadActivities, setLeadActivities] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [notesTab, setNotesTab] = useState('notes'); // 'notes' or 'activities'

  // Fetch car details (mock - can be replaced with Vaahan API)
  const fetchCarDetails = async (carNumber) => {
    setCarLoading(true);
    setCarError('');
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const mockCarData = {
        carMake: 'MARUTI SUZUKI INDIA LTD', carModel: 'SWIFT VXI',
        carYear: '2021', fuelType: 'PETROL', carColor: 'PEARL ARCTIC WHITE',
      };
      setPaymentFormData(prev => ({ ...prev, ...mockCarData }));
      toast.success('Car details fetched successfully');
    } catch (error) {
      setCarError('Failed to fetch car details. Please check the car number.');
      toast.error('Failed to fetch car details');
    } finally {
      setCarLoading(false);
    }
  };

  // Fetch notes and activities for a lead
  const fetchNotesAndActivities = async (lead) => {
    setLoadingNotes(true);
    try {
      const [notesRes, activitiesRes] = await Promise.all([
        leadsApi.getNotes(lead.id),
        leadsApi.getActivities(lead.id)
      ]);
      setLeadNotes(notesRes.data || []);
      setLeadActivities(activitiesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch notes/activities:', error);
      setLeadNotes([]);
      setLeadActivities([]);
    } finally {
      setLoadingNotes(false);
    }
  };

  // Open notes drawer
  const openNotesDrawer = async (lead) => {
    setSelectedLeadForNotes(lead);
    setIsNotesDrawerOpen(true);
    setNotesTab('notes');
    setNewNote('');
    await fetchNotesAndActivities(lead);
  };

  // Add a new note
  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedLeadForNotes) return;
    setSavingNote(true);
    try {
      await leadsApi.addNote(selectedLeadForNotes.id, newNote.trim());
      toast.success('Note added successfully');
      setNewNote('');
      await fetchNotesAndActivities(selectedLeadForNotes);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to add note');
    } finally {
      setSavingNote(false);
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
      // Add HOT status if not present
      const allStatuses = statusesRes.data.includes('HOT') ? statusesRes.data : ['NEW', 'HOT', ...statusesRes.data.filter(s => s !== 'NEW')];
      setStatuses(allStatuses);
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
      assigned_to: '', reminder_date: '', reminder_time: '', notes: '', service_type: '', ad_id: '' });
    setEditingLead(null);
  };

  const openEditModal = (lead) => {
    setEditingLead(lead);
    setFormData({ name: lead.name, mobile: lead.mobile, city: lead.city, source: lead.source,
      status: lead.status, assigned_to: lead.assigned_to || '', reminder_date: lead.reminder_date || '',
      reminder_time: lead.reminder_time || '', notes: lead.notes || '', service_type: lead.service_type || '',
      ad_id: lead.ad_id || '' });
    setIsModalOpen(true);
  };

  const openPaymentModal = (lead) => {
    setSelectedLead(lead);
    setPaymentFormData({
      hasCarDetails: 'yes', carNo: '', carMake: '', carModel: '', carYear: '',
      fuelType: '', carColor: '', carConfirmed: false, packageType: '',
      numberOfCars: '1', discountType: 'none', discountValue: '', city: lead.city || '',
      inspectionDate: '', inspectionTime: '', address: '', latitude: '',
      longitude: '', customerMobile: lead.mobile, customerName: lead.name,
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
    if (!assigningLead || !reassignReason) {
      toast.error('Please provide a reason for reassignment');
      return;
    }
    setSaving(true);
    try {
      await leadsApi.reassign(assigningLead.id, { new_agent_id: selectedEmployee, reason: reassignReason });
      toast.success('Lead reassigned successfully');
      setIsAssignModalOpen(false);
      setAssigningLead(null);
      setSelectedEmployee('');
      setReassignReason('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reassign lead');
    } finally {
      setSaving(false);
    }
  };

  const openReminderModal = (lead) => {
    setReminderLead(lead);
    setReminderFormData({
      reminder_date: lead.reminder_date || '', reminder_time: lead.reminder_time || '',
      reminder_reason: lead.reminder_reason || '', notes: lead.notes || '',
    });
    setIsReminderModalOpen(true);
  };

  const handleSaveReminder = async () => {
    if (!reminderLead || !reminderFormData.reminder_date || !reminderFormData.reminder_time) {
      toast.error('Please select date and time');
      return;
    }
    setSaving(true);
    try {
      await leadsApi.update(reminderLead.id, { ...reminderLead, ...reminderFormData });
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

  // Calculate stats for sales agent dashboard
  const todayNewLeads = leads.filter(l => l.status === 'NEW' && l.created_at?.startsWith(today)).length;
  const hotLeads = leads.filter(l => l.status === 'HOT' || l.status === 'INTERESTED').length;
  const rcbWhatsappLeads = leads.filter(l => l.status === 'RCB_WHATSAPP' || l.reminder_reason === 'RCB_WHATSAPP').length;
  const followupLeads = leads.filter(l => l.status === 'FOLLOWUP' || l.reminder_date).length;
  const paymentLinkSentLeads = leads.filter(l => l.payment_link).length;

  // Filter leads based on active filter card
  const getFilteredLeads = () => {
    let filtered = leads;
    if (activeFilter === 'new_today') {
      filtered = leads.filter(l => l.status === 'NEW' && l.created_at?.startsWith(today));
    } else if (activeFilter === 'hot') {
      filtered = leads.filter(l => l.status === 'HOT' || l.status === 'INTERESTED');
    } else if (activeFilter === 'rcb_whatsapp') {
      filtered = leads.filter(l => l.status === 'RCB_WHATSAPP' || l.reminder_reason === 'RCB_WHATSAPP');
    } else if (activeFilter === 'followup') {
      filtered = leads.filter(l => l.status === 'FOLLOWUP' || l.reminder_date);
    } else if (activeFilter === 'payment_sent') {
      filtered = leads.filter(l => l.payment_link);
    }
    return filtered;
  };

  const filteredLeads = getFilteredLeads();

  // Pagination calculations
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

  // Calculate final amount
  const calculateFinalAmount = () => {
    const packages = { basic: 499, silver: 999, gold: 1499, platinum: 2499 };
    const baseAmount = (packages[paymentFormData.packageType] || 0) * parseInt(paymentFormData.numberOfCars || 1);
    if (paymentFormData.discountType === 'percent' && paymentFormData.discountValue) {
      return baseAmount - (baseAmount * parseFloat(paymentFormData.discountValue) / 100);
    } else if (paymentFormData.discountType === 'amount' && paymentFormData.discountValue) {
      return baseAmount - parseFloat(paymentFormData.discountValue);
    }
    return baseAmount;
  };

  return (
    <div className="p-5 max-w-[1600px] mx-auto" data-testid="leads-page">
      {/* Page Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-500 mt-1">Manage and track all your sales leads</p>
        </div>
        <button
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/25 transition-all"
          data-testid="add-lead-button"
        >
          <Plus className="h-4 w-4" /> Add Lead
        </button>
      </div>

      {/* Sales Agent Dashboard - Action-oriented Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-5">
        <SummaryCard 
          title="New Leads (Today)" 
          value={todayNewLeads} 
          icon={TrendingUp} 
          color="text-blue-700" 
          onClick={() => { setActiveFilter(activeFilter === 'new_today' ? 'all' : 'new_today'); setCurrentPage(1); }}
          active={activeFilter === 'new_today'}
        />
        <SummaryCard 
          title="Hot Leads" 
          value={hotLeads} 
          icon={Flame} 
          color="text-red-600" 
          onClick={() => { setActiveFilter(activeFilter === 'hot' ? 'all' : 'hot'); setCurrentPage(1); }}
          active={activeFilter === 'hot'}
        />
        <SummaryCard 
          title="RCB WhatsApp" 
          value={rcbWhatsappLeads} 
          icon={MessageCircle} 
          color="text-green-600" 
          onClick={() => { setActiveFilter(activeFilter === 'rcb_whatsapp' ? 'all' : 'rcb_whatsapp'); setCurrentPage(1); }}
          active={activeFilter === 'rcb_whatsapp'}
        />
        <SummaryCard 
          title="Follow Up" 
          value={followupLeads} 
          icon={Bell} 
          color="text-orange-600" 
          onClick={() => { setActiveFilter(activeFilter === 'followup' ? 'all' : 'followup'); setCurrentPage(1); }}
          active={activeFilter === 'followup'}
        />
        <SummaryCard 
          title="Payment Link Sent" 
          value={paymentLinkSentLeads} 
          icon={Link2} 
          color="text-emerald-600" 
          onClick={() => { setActiveFilter(activeFilter === 'payment_sent' ? 'all' : 'payment_sent'); setCurrentPage(1); }}
          active={activeFilter === 'payment_sent'}
        />
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl border p-4 mb-5">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[280px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or mobile..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
              data-testid="search-input"
            />
          </div>

          <Select value={filterEmployee || 'all'} onValueChange={(v) => { setFilterEmployee(v === 'all' ? '' : v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[150px] h-10 bg-white text-sm" data-testid="filter-employee">
              <SelectValue placeholder="Employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map((emp) => (<SelectItem key={emp.id} value={emp.name}>{emp.name}</SelectItem>))}
            </SelectContent>
          </Select>

          <Select value={filterStatus || 'all'} onValueChange={(v) => { setFilterStatus(v === 'all' ? '' : v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[140px] h-10 bg-white text-sm" data-testid="filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {statuses.map((s) => (<SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>))}
            </SelectContent>
          </Select>

          <Select value={filterCity || 'all'} onValueChange={(v) => { setFilterCity(v === 'all' ? '' : v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[130px] h-10 bg-white text-sm" data-testid="filter-city">
              <SelectValue placeholder="City" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>

          <button 
            onClick={() => { setActiveFilter('all'); fetchData(); }}
            className="px-4 py-2.5 border rounded-lg hover:bg-gray-50 font-medium text-sm flex items-center gap-1"
          >
            <Filter className="h-4 w-4" /> Reset
          </button>
        </div>

        {/* Quick Filters */}
        <div className="flex items-center gap-3 mt-3 pt-3 border-t">
          <span className="text-xs text-gray-500">Quick:</span>
          {['Today', 'This Week', 'This Month'].map((period) => (
            <button key={period} className="text-xs text-blue-600 hover:text-blue-700 hover:underline">
              {period}
            </button>
          ))}
          {activeFilter !== 'all' && (
            <span className="ml-auto text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
              Filtered: {activeFilter.replace(/_/g, ' ')}
            </span>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b">
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Lead Details</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">City</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Assigned</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Reminder</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Source</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Payment Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center py-12">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    <span className="text-gray-500">Loading leads...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedLeads.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-12">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-500">No leads found</p>
                </td>
              </tr>
            ) : (
              paginatedLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50 transition-colors" data-testid={`lead-row-${lead.id}`}>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{formatDate(lead.created_at)}</div>
                    <div className="text-xs text-gray-400">{formatTime(lead.created_at)}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium text-sm">
                        {lead.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-gray-900 text-sm">{lead.name}</span>
                          <button 
                            onClick={() => openEditModal(lead)} 
                            className="p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            data-testid={`edit-lead-${lead.id}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="text-xs text-gray-500 font-mono flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {lead.mobile}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1 text-sm text-gray-700">
                      <MapPin className="h-3 w-3 text-gray-400" />
                      {lead.city}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-700">{lead.assigned_to_name || lead.assigned_to || '-'}</span>
                      <button 
                        onClick={() => openAssignModal(lead)}
                        className="p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        data-testid={`assign-employee-${lead.id}`}
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <button 
                        className="px-2.5 py-1 text-xs bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-lg hover:from-purple-600 hover:to-purple-700 font-medium flex items-center gap-1 shadow-sm"
                        onClick={() => openReminderModal(lead)}
                        data-testid={`add-reminder-${lead.id}`}
                      >
                        <Bell className="h-3 w-3" />
                        {lead.reminder_date ? 'Edit' : 'Add'}
                      </button>
                      {lead.reminder_date && (
                        <div className="text-xs bg-slate-50 p-1.5 rounded border">
                          <div className="flex items-center gap-1 text-gray-600 font-medium">
                            <Clock className="h-3 w-3" />
                            {formatDate(lead.reminder_date)}
                          </div>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {/* Clickable Status Dropdown */}
                    <StatusDropdown lead={lead} statuses={statuses} onUpdate={fetchData} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-700">{lead.source}</div>
                    {lead.ad_id && (
                      <div className="font-mono text-xs text-blue-600 mt-0.5 bg-blue-50 px-1.5 py-0.5 rounded inline-block">
                        Ad: {lead.ad_id}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="space-y-1">
                      <button 
                        className="px-2.5 py-1 text-xs bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg hover:from-amber-600 hover:to-amber-700 font-medium flex items-center gap-1 shadow-sm"
                        onClick={() => openPaymentModal(lead)}
                        data-testid={`send-pay-link-${lead.id}`}
                      >
                        <CreditCard className="h-3 w-3" />
                        {lead.payment_link ? 'Resend' : 'Send'}
                      </button>
                      {lead.payment_link && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => window.open(lead.payment_link, '_blank')}
                            className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-0.5"
                            data-testid={`view-link-${lead.id}`}
                          >
                            <Eye className="h-3 w-3" /> View
                          </button>
                          <span className="text-gray-300">|</span>
                          <button
                            onClick={async () => {
                              try { await navigator.clipboard.writeText(lead.payment_link); toast.success('Link copied!'); }
                              catch (err) { toast.success('Link copied!'); }
                            }}
                            className="text-xs text-gray-500 hover:text-gray-700 font-medium flex items-center gap-0.5"
                            data-testid={`copy-link-${lead.id}`}
                          >
                            <Copy className="h-3 w-3" /> Copy
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {/* Pagination */}
        {!loading && filteredLeads.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50">
            <div className="text-sm text-gray-600">
              Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredLeads.length)}</span> of <span className="font-medium">{filteredLeads.length}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 border rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  let pageNum = totalPages <= 5 ? i + 1 : currentPage <= 3 ? i + 1 : currentPage >= totalPages - 2 ? totalPages - 4 + i : currentPage - 2 + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                        currentPage === pageNum ? 'bg-blue-600 text-white' : 'hover:bg-white border'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="p-2 border rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add/Edit Lead Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[550px]" data-testid="lead-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-600" />
              {editingLead ? 'Edit Lead' : 'Add New Lead'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Lead Name *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="h-10" data-testid="lead-name-input" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Lead Source</Label>
                <Select value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v })}>
                  <SelectTrigger className="h-10" data-testid="lead-source-select"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{sources.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Mobile Number *</Label>
                <Input value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value })} className="h-10 font-mono" data-testid="lead-mobile-input" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Ad ID (from Settings)</Label>
                <Input value={formData.ad_id} onChange={(e) => setFormData({ ...formData, ad_id: e.target.value })} className="h-10 font-mono" placeholder="Optional" data-testid="lead-ad-id-input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">City *</Label>
                <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                  <SelectTrigger className="h-10" data-testid="lead-city-select"><SelectValue placeholder="Select city" /></SelectTrigger>
                  <SelectContent>{cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Lead Status</Label>
                <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                  <SelectTrigger className="h-10" data-testid="lead-status-select"><SelectValue /></SelectTrigger>
                  <SelectContent>{statuses.map((s) => (<SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>))}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Notes</Label>
              <textarea 
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full min-h-[80px] px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter notes..."
                data-testid="lead-notes-input"
              />
            </div>
            <div className="flex gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">Cancel</Button>
              <Button type="submit" disabled={saving} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800" data-testid="update-lead-button">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingLead ? 'Update Lead' : 'Create Lead'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Payment Modal with Discount and Inspection Schedule */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-[750px] p-0 overflow-hidden max-h-[90vh] overflow-y-auto" data-testid="payment-modal">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-4">
            <DialogTitle className="text-lg font-semibold text-white">Send Payment Link</DialogTitle>
            <div className="text-sm mt-1 text-blue-100">
              Customer: {paymentFormData.customerName} | Mobile: {paymentFormData.customerMobile}
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-6">
              {/* Step 1: Car Details */}
              {modalStep === 1 && (
                <>
                  <div className="text-lg font-semibold text-gray-900 pb-2 border-b">Step 1: Car Details</div>
                  <div className="flex items-center gap-6 py-2">
                    <Label className="text-sm font-medium">Does the customer know car details?</Label>
                    <div className="flex gap-4">
                      {['yes', 'no'].map(opt => (
                        <label key={opt} className="flex items-center gap-2 cursor-pointer">
                          <input type="radio" name="hasCarDetails" value={opt} checked={paymentFormData.hasCarDetails === opt}
                            onChange={() => setPaymentFormData({ ...paymentFormData, hasCarDetails: opt, carConfirmed: false })}
                            className="w-4 h-4 text-blue-600" />
                          <span className="text-sm capitalize">{opt}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  {paymentFormData.hasCarDetails === 'yes' && (
                    <div className="space-y-4">
                      <div className="flex items-end gap-4">
                        <div className="flex-1 space-y-2">
                          <Label className="text-sm">Car Registration Number</Label>
                          <Input value={paymentFormData.carNo} onChange={(e) => setPaymentFormData({ ...paymentFormData, carNo: e.target.value.toUpperCase() })}
                            className="h-11 font-mono uppercase" placeholder="KA01AB1234" data-testid="car-number-input" />
                        </div>
                        <Button onClick={() => fetchCarDetails(paymentFormData.carNo)} disabled={!paymentFormData.carNo || carLoading}
                          className="h-11 px-6 bg-gradient-to-r from-amber-500 to-amber-600" data-testid="get-car-data-btn">
                          {carLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Get Car Data
                        </Button>
                      </div>
                      {paymentFormData.carMake && (
                        <div className="bg-emerald-50 p-5 rounded-xl border border-emerald-200">
                          <h4 className="font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                            <span className="w-2 h-2 bg-emerald-500 rounded-full" /> Vehicle Information
                          </h4>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div><span className="text-gray-500">Make:</span> <span className="font-medium ml-2">{paymentFormData.carMake}</span></div>
                            <div><span className="text-gray-500">Model:</span> <span className="font-medium ml-2">{paymentFormData.carModel}</span></div>
                            <div><span className="text-gray-500">Year:</span> <span className="font-medium ml-2">{paymentFormData.carYear}</span></div>
                            <div><span className="text-gray-500">Fuel:</span> <span className="font-medium ml-2">{paymentFormData.fuelType}</span></div>
                          </div>
                          <label className="flex items-center gap-3 mt-4 pt-4 border-t border-emerald-200 cursor-pointer">
                            <input type="checkbox" checked={paymentFormData.carConfirmed} onChange={(e) => setPaymentFormData({ ...paymentFormData, carConfirmed: e.target.checked })}
                              className="w-5 h-5 text-emerald-600 rounded" />
                            <span className="text-sm font-medium">Customer confirms these details are correct</span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Step 2: Package, Discount & Inspection Schedule */}
              {modalStep === 2 && (
                <>
                  <div className="text-lg font-semibold text-gray-900 pb-2 border-b">Step 2: Package & Pricing</div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">Select Package *</Label>
                      <Select value={paymentFormData.packageType || 'select'} onValueChange={(v) => setPaymentFormData({ ...paymentFormData, packageType: v === 'select' ? '' : v })}>
                        <SelectTrigger className="h-11" data-testid="package-select"><SelectValue placeholder="Select Package" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="select">-- Select Package --</SelectItem>
                          <SelectItem value="basic">Basic - ₹499</SelectItem>
                          <SelectItem value="silver">Silver - ₹999</SelectItem>
                          <SelectItem value="gold">Gold - ₹1,499</SelectItem>
                          <SelectItem value="platinum">Platinum - ₹2,499</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">Number of Cars</Label>
                      <Select value={paymentFormData.numberOfCars} onValueChange={(v) => setPaymentFormData({ ...paymentFormData, numberOfCars: v })}>
                        <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                        <SelectContent>{[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{n} Car{n > 1 ? 's' : ''}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Discount Section */}
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                    <h4 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
                      <Percent className="h-4 w-4" /> Discount (Optional)
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm">Discount Type</Label>
                        <Select value={paymentFormData.discountType || 'none'} onValueChange={(v) => setPaymentFormData({ ...paymentFormData, discountType: v, discountValue: '' })}>
                          <SelectTrigger className="h-10" data-testid="discount-type"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No Discount</SelectItem>
                            <SelectItem value="percent">Percentage (%)</SelectItem>
                            <SelectItem value="amount">Fixed Amount (₹)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {paymentFormData.discountType && paymentFormData.discountType !== 'none' && (
                        <div className="space-y-2">
                          <Label className="text-sm">Discount Value</Label>
                          <Input 
                            type="number" 
                            value={paymentFormData.discountValue} 
                            onChange={(e) => setPaymentFormData({ ...paymentFormData, discountValue: e.target.value })}
                            className="h-10" 
                            placeholder={paymentFormData.discountType === 'percent' ? 'e.g., 10' : 'e.g., 100'}
                            data-testid="discount-value"
                          />
                        </div>
                      )}
                    </div>
                    {paymentFormData.packageType && (
                      <div className="mt-4 pt-4 border-t border-amber-200 flex justify-between items-center">
                        <span className="text-amber-800 font-medium">Final Amount:</span>
                        <span className="text-2xl font-bold text-amber-800">₹{calculateFinalAmount().toLocaleString()}</span>
                      </div>
                    )}
                  </div>

                  {/* Inspection Schedule Section */}
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                    <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" /> Inspection Schedule (Optional)
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm">Inspection Date</Label>
                        <Input 
                          type="date" 
                          value={paymentFormData.inspectionDate} 
                          onChange={(e) => setPaymentFormData({ ...paymentFormData, inspectionDate: e.target.value })}
                          className="h-10" 
                          data-testid="inspection-date"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">Inspection Time</Label>
                        <Select value={paymentFormData.inspectionTime || 'select'} onValueChange={(v) => setPaymentFormData({ ...paymentFormData, inspectionTime: v === 'select' ? '' : v })}>
                          <SelectTrigger className="h-10" data-testid="inspection-time"><SelectValue placeholder="Select Time" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="select">-- Select Time --</SelectItem>
                            {['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM'].map(t => 
                              <SelectItem key={t} value={t}>{t}</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-2 mt-4">
                      <Label className="text-sm">Inspection Address</Label>
                      <Input 
                        value={paymentFormData.address} 
                        onChange={(e) => setPaymentFormData({ ...paymentFormData, address: e.target.value })}
                        className="h-10" 
                        placeholder="Enter inspection location address"
                        data-testid="inspection-address"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex justify-between items-center p-6 bg-slate-50 border-t">
            <Button variant="outline" onClick={() => modalStep > 1 ? setModalStep(modalStep - 1) : setIsPaymentModalOpen(false)}>
              {modalStep === 1 ? 'Cancel' : 'Back'}
            </Button>
            {modalStep < 2 ? (
              <Button onClick={() => setModalStep(2)} disabled={paymentFormData.hasCarDetails === 'yes' && !paymentFormData.carConfirmed}
                className="bg-gradient-to-r from-amber-500 to-amber-600">Next Step</Button>
            ) : (
              <Button onClick={async () => {
                if (!selectedLead || !paymentFormData.packageType) {
                  toast.error('Please select a package');
                  return;
                }
                setSaving(true);
                try {
                  const paymentLink = `https://rzp.io/l/WD${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
                  await leadsApi.update(selectedLead.id, { 
                    ...selectedLead, 
                    payment_link: paymentLink,
                    inspection_date: paymentFormData.inspectionDate,
                    inspection_time: paymentFormData.inspectionTime,
                    inspection_address: paymentFormData.address,
                  });
                  toast.success('Payment link sent!');
                  setIsPaymentModalOpen(false);
                  fetchData();
                } catch { toast.error('Failed'); } finally { setSaving(false); }
              }} disabled={saving || !paymentFormData.packageType} className="bg-gradient-to-r from-blue-600 to-blue-700">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} Send Payment Link
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Employee Modal */}
      <Dialog open={isAssignModalOpen} onOpenChange={setIsAssignModalOpen}>
        <DialogContent className="sm:max-w-[400px]" data-testid="assign-employee-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle>Reassign Lead</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Assign To</Label>
              <Select value={selectedEmployee || 'unassigned'} onValueChange={(v) => setSelectedEmployee(v === 'unassigned' ? '' : v)}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">-- Select Employee --</SelectItem>
                  {employees.map((emp) => <SelectItem key={emp.id} value={emp.id}>{emp.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Reason *</Label>
              <Select value={reassignReason} onValueChange={setReassignReason}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Agent on leave">Agent on leave</SelectItem>
                  <SelectItem value="Customer request">Customer request</SelectItem>
                  <SelectItem value="Workload balancing">Workload balancing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsAssignModalOpen(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleAssignEmployee} disabled={saving || !selectedEmployee || !reassignReason} className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Reassign
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reminder Modal */}
      <Dialog open={isReminderModalOpen} onOpenChange={setIsReminderModalOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="reminder-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-purple-600" /> Add Reminder
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Date</Label>
                <Input type="date" value={reminderFormData.reminder_date} onChange={(e) => setReminderFormData({ ...reminderFormData, reminder_date: e.target.value })} className="h-10" data-testid="reminder-date-input" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Time</Label>
                <Select value={reminderFormData.reminder_time || 'select'} onValueChange={(v) => setReminderFormData({ ...reminderFormData, reminder_time: v === 'select' ? '' : v })}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="select">-- Select --</SelectItem>
                    {['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Reason</Label>
              <Select value={reminderFormData.reminder_reason || 'select'} onValueChange={(v) => setReminderFormData({ ...reminderFormData, reminder_reason: v === 'select' ? '' : v })}>
                <SelectTrigger className="h-10"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="select">-- Select --</SelectItem>
                  <SelectItem value="RNR">RNR</SelectItem>
                  <SelectItem value="RCB_WHATSAPP">RCB WhatsApp</SelectItem>
                  <SelectItem value="CALL_BACK">Call Back</SelectItem>
                  <SelectItem value="FOLLOW_UP">Follow Up</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Notes</Label>
              <textarea value={reminderFormData.notes} onChange={(e) => setReminderFormData({ ...reminderFormData, notes: e.target.value })}
                className="w-full min-h-[80px] px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" data-testid="reminder-notes-input" />
            </div>
            <div className="flex gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsReminderModalOpen(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSaveReminder} disabled={saving} className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600" data-testid="save-reminder-button">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save Reminder
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
