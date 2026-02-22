import React, { useState, useEffect, useCallback, useRef } from 'react';
import { leadsApi, employeesApi, utilityApi, vehicleApi, inspectionPackagesApi, partnersApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { formatDateTime, formatDate, formatTime } from '@/utils/dateFormat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlacesAutocomplete } from '@/components/ui/PlacesAutocomplete';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import {
  Tabs, TabsContent, TabsList, TabsTrigger,
} from '@/components/ui/tabs';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { 
  Search, Plus, Pencil, Loader2, X, Users, TrendingUp, Calendar, 
  Phone, MapPin, Bell, Clock, CreditCard, Copy, ChevronLeft, ChevronRight, Filter,
  MessageCircle, Link2, ExternalLink, Eye, Flame, ChevronDown, Percent, CalendarDays,
  StickyNote, Activity, Send, FileText, Car, Trash2, RefreshCw, CheckCircle, Gift
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';

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
  const { user } = useAuth();
  
  // Check if user is a sales executive (only sees their own leads)
  const isSalesExec = user?.role_code === 'SALES_EXEC';
  
  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [cities, setCities] = useState([]);
  const [sources, setSources] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [inspectionPackages, setInspectionPackages] = useState([]); // Active packages from settings
  const [availableOffers, setAvailableOffers] = useState([]); // Active offers for payment modal
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

  // Sales reps for assignment (filtered by city)
  const [salesRepsForCity, setSalesRepsForCity] = useState([]);
  const [loadingSalesReps, setLoadingSalesReps] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  const [search, setSearch] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterSource, setFilterSource] = useState('');

  // Partners list for selection
  const [partners, setPartners] = useState([]);

  const [formData, setFormData] = useState({
    name: '', mobile: '', city: '', source: 'WEBSITE', status: 'NEW LEAD',
    assigned_to: '', reminder_date: '', reminder_time: '', notes: '',
    service_type: '', ad_id: '', partner_id: '', partner_name: '',
  });

  const [reminderFormData, setReminderFormData] = useState({
    reminder_date: '', reminder_time: '', reminder_reason: '', notes: '',
  });

  const [paymentFormData, setPaymentFormData] = useState({
    hasCarDetails: 'yes', carNo: '', carMake: '', carModel: '', carYear: '',
    fuelType: '', carColor: '', carConfirmed: false, packageId: '',
    discountType: '', discountValue: '', city: '',
    customerMobile: '', customerName: '',
    selectedOfferIds: [], // Offers selected by sales head
    usePartialPayment: false, // Whether to use partial payment for this transaction
  });

  // Multiple inspection schedules - one per inspection slot in the package
  const [inspectionSchedules, setInspectionSchedules] = useState([]);

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
  const [vehicleData, setVehicleData] = useState(null); // Full vehicle data from Vaahan
  
  // Initialize inspection schedules when package changes
  const initializeInspectionSchedules = useCallback((pkg) => {
    if (!pkg) {
      setInspectionSchedules([]);
      return;
    }
    const count = pkg.no_of_inspections || 1;
    const newSchedules = Array.from({ length: count }, (_, index) => ({
      id: `schedule-${index}`,
      vehicleNumber: index === 0 && paymentFormData.carNo ? paymentFormData.carNo : '',
      vehicleData: index === 0 && vehicleData ? vehicleData : null,
      vehicleConfirmed: index === 0 && paymentFormData.carConfirmed,
      inspectionDate: '',
      inspectionTime: '',
      address: '',
      latitude: '',
      longitude: '',
      isLoading: false,
      error: '',
    }));
    setInspectionSchedules(newSchedules);
  }, [paymentFormData.carNo, paymentFormData.carConfirmed, vehicleData]);

  // Update schedule field
  const updateSchedule = (index, field, value) => {
    setInspectionSchedules(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Fetch vehicle details for a specific schedule
  const fetchVehicleForSchedule = async (index, vehicleNumber) => {
    if (!vehicleNumber) return;
    
    updateSchedule(index, 'isLoading', true);
    updateSchedule(index, 'error', '');
    
    try {
      const response = await vehicleApi.getDetails(vehicleNumber);
      const data = response.data;
      
      if (data.success && data.data) {
        updateSchedule(index, 'vehicleData', data.data);
        updateSchedule(index, 'vehicleConfirmed', false);
        toast.success(`Vehicle ${index + 1} details fetched successfully`);
      } else {
        updateSchedule(index, 'error', data.error || 'Failed to fetch vehicle details');
        toast.error(data.error || 'Failed to fetch vehicle details');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to fetch vehicle details';
      updateSchedule(index, 'error', errorMsg);
      toast.error(errorMsg);
    } finally {
      updateSchedule(index, 'isLoading', false);
    }
  };

  // Fetch car details from Vaahan API
  const fetchCarDetails = async (carNumber) => {
    setCarLoading(true);
    setCarError('');
    setVehicleData(null);
    try {
      const response = await vehicleApi.getDetails(carNumber);
      const data = response.data;
      
      if (data.success && data.data) {
        const vehicle = data.data;
        // Store full vehicle data for saving later
        setVehicleData(vehicle);
        
        // Update form with key details for display
        setPaymentFormData(prev => ({ 
          ...prev, 
          carMake: vehicle.manufacturer || '',
          carModel: vehicle.model || '',
          carYear: vehicle.manufacturing_date ? vehicle.manufacturing_date.split('/')[1] : '',
          fuelType: vehicle.fuel_type || '',
          carColor: vehicle.color || '',
          // Additional fields
          chassisNumber: vehicle.chassis_number || '',
          engineNumber: vehicle.engine_number || '',
          registrationDate: vehicle.registration_date || '',
          rcExpiryDate: vehicle.rc_expiry_date || '',
          ownerName: vehicle.owner_name || '',
          insuranceCompany: vehicle.insurance_company || '',
          insuranceValidUpto: vehicle.insurance_valid_upto || '',
        }));
        toast.success('Vehicle details fetched successfully from Vaahan');
      } else {
        setCarError(data.error || 'Failed to fetch vehicle details');
        toast.error(data.error || 'Failed to fetch vehicle details');
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to fetch vehicle details. Please check the registration number.';
      setCarError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setCarLoading(false);
    }
  };

  // Save vehicle to vehicle master
  const saveVehicleToMaster = async (leadId = null) => {
    if (!vehicleData) return null;
    
    try {
      const response = await vehicleApi.save({
        ...vehicleData,
        lead_id: leadId || selectedLead?.id || '',
      });
      return response.data;
    } catch (error) {
      console.error('Failed to save vehicle:', error);
      return null;
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

  // Add a new note with debounce protection
  const handleAddNote = async () => {
    if (!newNote.trim() || !selectedLeadForNotes || savingNote) return;
    
    const noteText = newNote.trim();
    setNewNote(''); // Clear immediately to prevent double submission
    setSavingNote(true);
    
    try {
      await leadsApi.addNote(selectedLeadForNotes.id, noteText);
      toast.success('Note added successfully');
      await fetchNotesAndActivities(selectedLeadForNotes);
    } catch (error) {
      setNewNote(noteText); // Restore note on error
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

      const [leadsRes, employeesRes, citiesRes, sourcesRes, statusesRes, packagesRes, offersRes, partnersRes] = await Promise.all([
        leadsApi.getAll(params), employeesApi.getAll(), utilityApi.getCities(),
        utilityApi.getLeadSources(), utilityApi.getLeadStatuses(),
        inspectionPackagesApi.getPackages(user?.country_id),
        inspectionPackagesApi.getActiveOffers(user?.country_id),
        partnersApi.getPartners({ is_active: true }),
      ]);

      setLeads(leadsRes.data);
      setEmployees(employeesRes.data);
      setCities(citiesRes.data);
      setSources(sourcesRes.data);
      // Statuses come as array of objects with value, label, color
      setStatuses(statusesRes.data || []);
      // Filter only active packages and sort by order
      const activePackages = (packagesRes.data || [])
        .filter(p => p.is_active)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      setInspectionPackages(activePackages);
      // Store active offers for payment modal
      setAvailableOffers(offersRes.data || []);
      // Store partners for lead form
      setPartners(partnersRes.data || []);
    } catch (error) {
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [search, filterEmployee, filterStatus, filterCity, filterSource, user?.country_id]);

  // Auto-assign unassigned leads on page load (for HR/admin users only)
  const [isAssigning, setIsAssigning] = useState(false);
  
  const assignUnassignedLeads = useCallback(async (showToast = true) => {
    // Only HR managers and admins can trigger bulk assignment
    const allowedRoles = ['HR_MANAGER', 'CEO', 'COUNTRY_HEAD', 'ADMIN', 'HR_ADMIN'];
    if (!user || !allowedRoles.includes(user.role_code)) {
      console.log('User role not allowed for auto-assignment:', user?.role_code);
      return;
    }
    
    setIsAssigning(true);
    try {
      console.log('Triggering auto-assignment for unassigned leads...');
      const response = await leadsApi.assignUnassigned();
      console.log('Auto-assignment response:', response.data);
      
      if (response.data?.assigned_count > 0) {
        if (showToast) {
          toast.success(`${response.data.assigned_count} lead(s) auto-assigned to sales reps`);
        }
        // Refresh the data to show updated assignments
        await fetchData();
      } else if (showToast && response.data?.failed_count > 0) {
        toast.warning(`${response.data.failed_count} lead(s) could not be assigned (no matching sales reps)`);
      }
      return response.data;
    } catch (error) {
      console.error('Auto-assignment error:', error.response?.data || error.message);
      if (showToast) {
        toast.error(error.response?.data?.detail || 'Failed to auto-assign leads');
      }
    } finally {
      setIsAssigning(false);
    }
  }, [user, fetchData]);

  // Initial data fetch
  useEffect(() => { 
    fetchData(); 
  }, [fetchData]);
  
  // Run auto-assignment after initial data load
  const hasRunAutoAssign = useRef(false);
  
  useEffect(() => {
    // Only run once after initial load completes
    if (!loading && user && !hasRunAutoAssign.current) {
      hasRunAutoAssign.current = true;
      console.log('Page loaded, triggering auto-assignment...');
      assignUnassignedLeads(false); // Silent on initial load
    }
  }, [loading, user, assignUnassignedLeads]);

  // Reset the ref when user changes (logout/login)
  useEffect(() => {
    hasRunAutoAssign.current = false;
  }, [user?.id]);

  // City Remap Modal State
  const [isCityRemapModalOpen, setIsCityRemapModalOpen] = useState(false);
  const [cityRemapData, setCityRemapData] = useState({ fromCity: '', toCity: '', reassignToSalesRep: true });
  const [citySummary, setCitySummary] = useState([]);
  const [isRemapping, setIsRemapping] = useState(false);
  const [isAutoRemapping, setIsAutoRemapping] = useState(false);
  const [isLoadingCitySummary, setIsLoadingCitySummary] = useState(false);
  const [remapMode, setRemapMode] = useState('auto'); // 'auto' or 'manual'

  // Fetch city summary when modal opens
  const fetchCitySummary = async () => {
    setIsLoadingCitySummary(true);
    try {
      const response = await leadsApi.getCitySummary();
      setCitySummary(response.data?.cities || []);
    } catch (error) {
      toast.error('Failed to load city summary');
    } finally {
      setIsLoadingCitySummary(false);
    }
  };

  // Auto-remap based on AD ID mappings
  const handleAutoRemapByAdId = async () => {
    setIsAutoRemapping(true);
    try {
      const response = await leadsApi.autoRemapByAdId(cityRemapData.reassignToSalesRep);
      const { remapped_count, reassigned_count, skipped_count } = response.data;
      
      if (remapped_count > 0) {
        toast.success(`✅ Auto-remapped ${remapped_count} leads based on AD ID mappings. ${reassigned_count} reassigned to sales reps.`);
      } else {
        toast.info(`No leads needed remapping. ${skipped_count} leads already have correct city.`);
      }
      
      setIsCityRemapModalOpen(false);
      await fetchData(); // Refresh leads
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to auto-remap cities');
    } finally {
      setIsAutoRemapping(false);
    }
  };

  const handleCityRemap = async () => {
    if (!cityRemapData.fromCity || !cityRemapData.toCity) {
      toast.error('Please select both source and target cities');
      return;
    }
    if (cityRemapData.fromCity === cityRemapData.toCity) {
      toast.error('Source and target cities cannot be the same');
      return;
    }
    
    setIsRemapping(true);
    try {
      const response = await leadsApi.bulkRemapCity({
        from_city: cityRemapData.fromCity,
        to_city: cityRemapData.toCity,
        reassign_to_sales_rep: cityRemapData.reassignToSalesRep
      });
      
      toast.success(`${response.data.remapped_count} leads remapped from ${cityRemapData.fromCity} to ${cityRemapData.toCity}`);
      setIsCityRemapModalOpen(false);
      setCityRemapData({ fromCity: '', toCity: '', reassignToSalesRep: true });
      await fetchData(); // Refresh leads
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to remap cities');
    } finally {
      setIsRemapping(false);
    }
  };

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
    setFormData({ name: '', mobile: '', city: '', source: 'WEBSITE', status: 'NEW LEAD',
      assigned_to: '', reminder_date: '', reminder_time: '', notes: '', service_type: '', ad_id: '' });
    setEditingLead(null);
  };

  const openEditModal = (lead) => {
    setEditingLead(lead);
    setFormData({ name: lead.name, mobile: lead.mobile, city: lead.city, source: lead.source,
      status: lead.status, assigned_to: lead.assigned_to || '', reminder_date: lead.reminder_date || '',
      reminder_time: lead.reminder_time || '', notes: lead.notes || '', service_type: lead.service_type || '',
      ad_id: lead.ad_id || '', partner_id: lead.partner_id || '', partner_name: lead.partner_name || '' });
    setIsModalOpen(true);
  };

  const openPaymentModal = (lead) => {
    setSelectedLead(lead);
    setPaymentFormData({
      hasCarDetails: 'yes', carNo: '', carMake: '', carModel: '', carYear: '',
      fuelType: '', carColor: '', carConfirmed: false, packageId: '',
      discountType: 'none', discountValue: '', city: lead.city || '',
      customerMobile: lead.mobile, customerName: lead.name,
      selectedOfferIds: [], usePartialPayment: false,
    });
    setCarError('');
    setVehicleData(null);
    setInspectionSchedules([]); // Reset schedules
    setModalStep(1);
    setIsPaymentModalOpen(true);
  };

  const openAssignModal = async (lead) => {
    setAssigningLead(lead);
    setSelectedEmployee(lead.assigned_to || '');
    setLoadingSalesReps(true);
    setSalesRepsForCity([]);
    
    try {
      // Fetch sales reps filtered by lead's city
      const response = await leadsApi.getSalesRepsByCity(lead.city);
      setSalesRepsForCity(response.data || []);
    } catch (error) {
      console.error('Failed to fetch sales reps:', error);
      toast.error('Failed to load sales representatives');
    } finally {
      setLoadingSalesReps(false);
    }
    
    setIsAssignModalOpen(true);
  };

  const handleAssignEmployee = async () => {
    if (!assigningLead || !reassignReason) {
      toast.error('Please provide a reason for reassignment');
      return;
    }
    if (!selectedEmployee) {
      toast.error('Please select a sales representative');
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

  // Check payment status manually (Plan B for when webhooks are delayed)
  const [checkingPayment, setCheckingPayment] = useState({});
  
  const handleCheckPaymentStatus = async (leadId) => {
    setCheckingPayment(prev => ({ ...prev, [leadId]: true }));
    try {
      const response = await leadsApi.checkPaymentStatus(leadId);
      const data = response.data;
      
      if (data.payment_status === 'paid') {
        if (data.was_updated) {
          toast.success('🎉 Payment confirmed! Lead has been updated.');
        } else {
          toast.success('Payment already confirmed.');
        }
        fetchData(); // Refresh to show updated status
      } else if (data.payment_status === 'attempted') {
        toast.warning('Customer started payment but did not complete.');
      } else if (data.payment_status === 'expired') {
        toast.error('Payment link has expired. Please send a new one.');
      } else if (data.payment_status === 'cancelled') {
        toast.error('Payment link was cancelled.');
      } else {
        toast.info(data.message || 'Waiting for customer to pay.');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to check payment status');
    } finally {
      setCheckingPayment(prev => ({ ...prev, [leadId]: false }));
    }
  };

  // Calculate stats for sales agent dashboard (matching actual statuses from LEAD_STATUSES)
  const todayNewLeads = leads.filter(l => l.status === 'NEW LEAD' && l.created_at?.startsWith(today)).length;
  const hotLeads = leads.filter(l => l.status === 'HOT LEADS').length;
  const rcbWhatsappLeads = leads.filter(l => l.status === 'RCB WHATSAPP' || l.reminder_reason === 'RCB_WHATSAPP').length;
  const followupLeads = leads.filter(l => 
    l.status === 'FOLLOW UP' || 
    l.status === 'WHATSAPP FOLLOW UP' || 
    l.status === 'Repeat follow up' ||
    l.reminder_date
  ).length;
  const paymentLinkSentLeads = leads.filter(l => l.status === 'PAYMENT LINK SENT' || l.payment_link).length;

  // Filter leads based on active filter card
  const getFilteredLeads = () => {
    let filtered = leads;
    if (activeFilter === 'new_today') {
      filtered = leads.filter(l => l.status === 'NEW LEAD' && l.created_at?.startsWith(today));
    } else if (activeFilter === 'hot') {
      filtered = leads.filter(l => l.status === 'HOT LEADS');
    } else if (activeFilter === 'rcb_whatsapp') {
      filtered = leads.filter(l => l.status === 'RCB WHATSAPP' || l.reminder_reason === 'RCB_WHATSAPP');
    } else if (activeFilter === 'followup') {
      filtered = leads.filter(l => 
        l.status === 'FOLLOW UP' || 
        l.status === 'WHATSAPP FOLLOW UP' || 
        l.status === 'Repeat follow up' ||
        l.reminder_date
      );
    } else if (activeFilter === 'payment_sent') {
      filtered = leads.filter(l => l.status === 'PAYMENT LINK SENT' || l.payment_link);
    }
    return filtered;
  };

  const filteredLeads = getFilteredLeads();

  // Pagination calculations
  const totalPages = Math.ceil(filteredLeads.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);

  // Get selected package details
  const getSelectedPackage = () => {
    return inspectionPackages.find(p => p.id === paymentFormData.packageId);
  };

  // Calculate base amount from selected package (no longer multiplied by numberOfCars)
  const getBaseAmount = () => {
    const pkg = getSelectedPackage();
    if (!pkg) return 0;
    return pkg.price;
  };

  // Calculate discount amount from package settings (if allow_discount is enabled)
  const getDiscountAmount = () => {
    const pkg = getSelectedPackage();
    if (!pkg?.allow_discount) return 0;
    
    const baseAmount = getBaseAmount();
    if (paymentFormData.discountType === 'percent' && paymentFormData.discountValue) {
      return baseAmount * parseFloat(paymentFormData.discountValue) / 100;
    } else if (paymentFormData.discountType === 'amount' && paymentFormData.discountValue) {
      return parseFloat(paymentFormData.discountValue);
    }
    return 0;
  };

  // Calculate offer discount amount from selected offers
  const getOfferDiscountAmount = () => {
    const pkg = getSelectedPackage();
    if (!pkg?.allow_offers || !paymentFormData.selectedOfferIds?.length) return 0;
    
    const baseAmountAfterDiscount = getBaseAmount() - getDiscountAmount();
    let offerDiscount = 0;
    
    paymentFormData.selectedOfferIds.forEach(offerId => {
      const offer = availableOffers.find(o => o.id === offerId);
      if (offer && pkg.applicable_offer_ids?.includes(offerId)) {
        if (offer.discount_type === 'percentage') {
          offerDiscount += baseAmountAfterDiscount * offer.discount_value / 100;
        } else {
          offerDiscount += offer.discount_value;
        }
      }
    });
    
    return offerDiscount;
  };

  // Get offers applicable to the selected package
  const getApplicableOffers = () => {
    const pkg = getSelectedPackage();
    if (!pkg?.allow_offers || !pkg?.applicable_offer_ids?.length) return [];
    return availableOffers.filter(o => pkg.applicable_offer_ids.includes(o.id));
  };

  // Calculate final amount after discount and offers (this is the TOTAL amount customer needs to pay)
  const calculateFinalAmount = () => {
    const baseAmount = getBaseAmount();
    const discount = getDiscountAmount();
    const offerDiscount = getOfferDiscountAmount();
    return Math.max(0, baseAmount - discount - offerDiscount);
  };

  // Get partial payment amount (fixed amount from package settings)
  // This is what customer pays IMMEDIATELY
  const getPartialPaymentAmount = () => {
    const pkg = getSelectedPackage();
    if (!pkg?.allow_partial_payment || !paymentFormData.usePartialPayment) return 0;
    
    const finalAmount = calculateFinalAmount();
    // Partial payment is a fixed amount, but cannot exceed total
    return Math.min(pkg.partial_payment_value || 0, finalAmount);
  };

  // Get remaining balance amount (to be collected later via Collect Balance button)
  const getRemainingBalance = () => {
    const pkg = getSelectedPackage();
    if (!pkg?.allow_partial_payment || !paymentFormData.usePartialPayment) return 0;
    return calculateFinalAmount() - getPartialPaymentAmount();
  };

  // Get the amount to charge now (either full amount or partial payment)
  const getAmountToPayNow = () => {
    const pkg = getSelectedPackage();
    if (pkg?.allow_partial_payment && paymentFormData.usePartialPayment) {
      return getPartialPaymentAmount();
    }
    return calculateFinalAmount();
  };

  // Handle package selection and initialize schedules
  const handlePackageSelect = (packageId) => {
    // Reset discount and offers when package changes
    setPaymentFormData(prev => ({ 
      ...prev, 
      packageId,
      discountType: 'none',
      discountValue: '',
      selectedOfferIds: [],
      usePartialPayment: false,
    }));
    if (packageId && packageId !== 'select') {
      const pkg = inspectionPackages.find(p => p.id === packageId);
      if (pkg) {
        initializeInspectionSchedules(pkg);
      }
    } else {
      setInspectionSchedules([]);
    }
  };

  return (
    <div className="p-5 max-w-[1600px] mx-auto" data-testid="leads-page">
      {/* Page Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leads</h1>
          <p className="text-gray-500 mt-1">Manage and track all your sales leads</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Auto-Assign Button - Only for HR/Admin */}
          {user && ['HR_MANAGER', 'CEO', 'COUNTRY_HEAD', 'ADMIN', 'HR_ADMIN', 'CTO'].includes(user.role_code) && (
            <>
              <button
                onClick={() => assignUnassignedLeads(true)}
                disabled={isAssigning}
                className="px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white rounded-xl hover:from-emerald-600 hover:to-emerald-700 flex items-center gap-2 font-medium shadow-lg shadow-emerald-500/25 transition-all disabled:opacity-50"
                data-testid="assign-all-button"
              >
                {isAssigning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Users className="h-4 w-4" />
                )}
                {isAssigning ? 'Assigning...' : 'Assign Unassigned'}
              </button>
              <button
                onClick={() => { fetchCitySummary(); setIsCityRemapModalOpen(true); }}
                className="px-4 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 flex items-center gap-2 font-medium shadow-lg shadow-orange-500/25 transition-all"
                data-testid="remap-city-button"
              >
                <MapPin className="h-4 w-4" />
                Remap City
              </button>
            </>
          )}
          <button
            onClick={() => { resetForm(); setIsModalOpen(true); }}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/25 transition-all"
            data-testid="add-lead-button"
          >
            <Plus className="h-4 w-4" /> Add Lead
          </button>
        </div>
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

          {/* Employee filter - for Sales Execs, only show their name; for others show all */}
          {isSalesExec ? (
            <div className="flex items-center px-3 h-10 bg-slate-100 rounded-md text-sm font-medium text-slate-700 border">
              {user?.name || 'My Leads'}
            </div>
          ) : (
            <Select value={filterEmployee || 'all'} onValueChange={(v) => { setFilterEmployee(v === 'all' ? '' : v); setCurrentPage(1); }}>
              <SelectTrigger className="w-[150px] h-10 bg-white text-sm" data-testid="filter-employee">
                <SelectValue placeholder="Employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Employees</SelectItem>
                {employees.map((emp) => (<SelectItem key={emp.id} value={emp.name}>{emp.name}</SelectItem>))}
              </SelectContent>
            </Select>
          )}

          <Select value={filterStatus || 'all'} onValueChange={(v) => { setFilterStatus(v === 'all' ? '' : v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[160px] h-10 bg-white text-sm" data-testid="filter-status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              <SelectItem value="all">All Status</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
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
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Notes</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Source</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Payment Link</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="text-center py-12">
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    <span className="text-gray-500">Loading leads...</span>
                  </div>
                </td>
              </tr>
            ) : paginatedLeads.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12">
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
                    {lead.partner_name && lead.partner_name !== 'B2C Default' && (
                      <span className="ml-2 px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded-full font-medium">
                        {lead.partner_name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <span className="text-sm text-gray-700">{lead.assigned_to_name || lead.assigned_to || '-'}</span>
                      {/* Hide reassign button for Sales Executives */}
                      {!isSalesExec && (
                        <button 
                          onClick={() => openAssignModal(lead)}
                          className="p-0.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          data-testid={`assign-employee-${lead.id}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
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
                    {/* Notes Button */}
                    <button 
                      className="px-2.5 py-1 text-xs bg-gradient-to-r from-slate-500 to-slate-600 text-white rounded-lg hover:from-slate-600 hover:to-slate-700 font-medium flex items-center gap-1 shadow-sm"
                      onClick={() => openNotesDrawer(lead)}
                      data-testid={`view-notes-${lead.id}`}
                    >
                      <StickyNote className="h-3 w-3" />
                      Notes
                    </button>
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
                      {(lead.payment_status === 'paid' || lead.status === 'PAID') && (
                        <div className="flex items-center gap-1 text-emerald-600 mb-1">
                          <CheckCircle className="h-4 w-4" />
                          <span className="text-xs font-medium">Paid</span>
                          {lead.payment_amount && (
                            <span className="text-xs text-gray-500">(₹{lead.payment_amount?.toLocaleString()})</span>
                          )}
                        </div>
                      )}
                      <button 
                        className={`px-2.5 py-1 text-xs ${
                          lead.payment_status === 'paid' || lead.status === 'PAID'
                            ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700'
                            : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700'
                        } text-white rounded-lg font-medium flex items-center gap-1 shadow-sm`}
                        onClick={() => openPaymentModal(lead)}
                        data-testid={`send-pay-link-${lead.id}`}
                      >
                        <CreditCard className="h-3 w-3" />
                        {lead.payment_status === 'paid' || lead.status === 'PAID' 
                          ? 'Send (Again)' 
                          : lead.payment_link ? 'Resend' : 'Send'}
                      </button>
                      {lead.payment_link && (
                        <div className="flex items-center gap-1 flex-wrap">
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
                          {!(lead.payment_status === 'paid' || lead.status === 'PAID') && (
                            <>
                              <span className="text-gray-300">|</span>
                              <button
                                onClick={() => handleCheckPaymentStatus(lead.id)}
                                disabled={checkingPayment[lead.id]}
                                className="text-xs text-emerald-600 hover:text-emerald-700 font-medium flex items-center gap-0.5 disabled:opacity-50"
                                data-testid={`check-payment-${lead.id}`}
                              >
                                {checkingPayment[lead.id] ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <RefreshCw className="h-3 w-3" />
                                )}
                                Check
                              </button>
                            </>
                          )}
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
                  <SelectContent className="max-h-[300px]">
                    {statuses.map((s) => (<SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {/* Partner/Client Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Partner/Client</Label>
              <Select 
                value={formData.partner_id || ''} 
                onValueChange={(v) => {
                  const selectedPartner = partners.find(p => p.id === v);
                  setFormData({ 
                    ...formData, 
                    partner_id: v, 
                    partner_name: selectedPartner?.name || '' 
                  });
                }}
              >
                <SelectTrigger className="h-10" data-testid="lead-partner-select">
                  <SelectValue placeholder="Select partner (default: B2C)" />
                </SelectTrigger>
                <SelectContent>
                  {partners.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} ({p.type.toUpperCase()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Leave empty for default B2C customer</p>
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
                            <span className="w-2 h-2 bg-emerald-500 rounded-full" /> Vehicle Information (Vaahan API)
                          </h4>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div><span className="text-gray-500">Make:</span> <span className="font-medium ml-2">{paymentFormData.carMake}</span></div>
                            <div><span className="text-gray-500">Model:</span> <span className="font-medium ml-2">{paymentFormData.carModel}</span></div>
                            <div><span className="text-gray-500">Year:</span> <span className="font-medium ml-2">{paymentFormData.carYear}</span></div>
                            <div><span className="text-gray-500">Fuel:</span> <span className="font-medium ml-2">{paymentFormData.fuelType}</span></div>
                            <div><span className="text-gray-500">Color:</span> <span className="font-medium ml-2">{paymentFormData.carColor}</span></div>
                            <div><span className="text-gray-500">Owner:</span> <span className="font-medium ml-2">{paymentFormData.ownerName}</span></div>
                            {paymentFormData.registrationDate && (
                              <div><span className="text-gray-500">Reg Date:</span> <span className="font-medium ml-2">{paymentFormData.registrationDate}</span></div>
                            )}
                            {paymentFormData.rcExpiryDate && (
                              <div><span className="text-gray-500">RC Expiry:</span> <span className="font-medium ml-2">{paymentFormData.rcExpiryDate}</span></div>
                            )}
                            {paymentFormData.insuranceCompany && (
                              <div className="col-span-2"><span className="text-gray-500">Insurance:</span> <span className="font-medium ml-2">{paymentFormData.insuranceCompany} (Valid: {paymentFormData.insuranceValidUpto})</span></div>
                            )}
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
                  <div className="space-y-2">
                    <Label className="text-sm">Select Package *</Label>
                    <Select value={paymentFormData.packageId || 'select'} onValueChange={(v) => handlePackageSelect(v === 'select' ? '' : v)}>
                      <SelectTrigger className="h-11" data-testid="package-select"><SelectValue placeholder="Select Package" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="select">-- Select Package --</SelectItem>
                        {inspectionPackages.map(pkg => (
                          <SelectItem key={pkg.id} value={pkg.id}>
                            {pkg.name} - {pkg.no_of_inspections || 1} Inspection{(pkg.no_of_inspections || 1) > 1 ? 's' : ''} - ₹{pkg.price?.toLocaleString()}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Package Details */}
                  {getSelectedPackage() && (
                    <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-semibold text-blue-800">{getSelectedPackage().name}</h4>
                          <p className="text-sm text-blue-600">{getSelectedPackage().no_of_inspections || 1} Inspection(s) included</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-blue-600">Package Price</p>
                          <p className="text-xl font-bold text-blue-800">₹{getSelectedPackage().price?.toLocaleString()}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Discount Section - Only show if package allows discount */}
                  {getSelectedPackage()?.allow_discount && (
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
                    </div>
                  )}

                  {/* Offers Section - Only show if package allows offers and has applicable offers */}
                  {getSelectedPackage()?.allow_offers && getApplicableOffers().length > 0 && (
                    <div className="bg-orange-50 p-4 rounded-xl border border-orange-200">
                      <h4 className="font-semibold text-orange-800 mb-3 flex items-center gap-2">
                        <Gift className="h-4 w-4" /> Apply Offers
                      </h4>
                      <p className="text-sm text-orange-600 mb-3">Select offers to apply (multiple can be selected)</p>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {getApplicableOffers().map((offer) => (
                          <label 
                            key={offer.id}
                            className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                              paymentFormData.selectedOfferIds?.includes(offer.id) 
                                ? 'bg-orange-100 border-2 border-orange-400' 
                                : 'bg-white border border-gray-200 hover:bg-gray-50'
                            }`}
                          >
                            <Checkbox 
                              checked={paymentFormData.selectedOfferIds?.includes(offer.id)}
                              onCheckedChange={(checked) => {
                                const current = paymentFormData.selectedOfferIds || [];
                                if (checked) {
                                  setPaymentFormData({ ...paymentFormData, selectedOfferIds: [...current, offer.id] });
                                } else {
                                  setPaymentFormData({ ...paymentFormData, selectedOfferIds: current.filter(id => id !== offer.id) });
                                }
                              }}
                            />
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{offer.name}</p>
                              <p className="text-xs text-gray-500">
                                {offer.discount_type === 'percentage' ? `${offer.discount_value}% off` : `₹${offer.discount_value} off`}
                                {' • '}Valid until {new Date(offer.valid_until).toLocaleDateString()}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Partial Payment Section - Only show if package allows partial payment */}
                  {getSelectedPackage()?.allow_partial_payment && (
                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-200">
                      <div className="flex items-center justify-between mb-3">
                        <h4 className="font-semibold text-purple-800 flex items-center gap-2">
                          <CreditCard className="h-4 w-4" /> Partial Payment Option
                        </h4>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <Checkbox 
                            checked={paymentFormData.usePartialPayment}
                            onCheckedChange={(checked) => setPaymentFormData({ ...paymentFormData, usePartialPayment: checked })}
                            data-testid="partial-payment-checkbox"
                          />
                          <span className="text-sm text-purple-700">Enable partial payment</span>
                        </label>
                      </div>
                      <p className="text-xs text-purple-600 mb-2">
                        Partial payment for this package: <span className="font-bold">₹{(getSelectedPackage().partial_payment_value || 0).toLocaleString()}</span> (fixed amount)
                      </p>
                      {paymentFormData.usePartialPayment && (
                        <div className="bg-purple-100/50 p-3 rounded-lg space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-purple-700">Total after discounts:</span>
                            <span className="font-medium text-purple-800">₹{calculateFinalAmount().toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-purple-700">Partial payment (now):</span>
                            <span className="font-bold text-purple-800">- ₹{getPartialPaymentAmount().toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm pt-2 border-t border-purple-300">
                            <span className="text-purple-700 font-medium">Balance (collect later):</span>
                            <span className="font-bold text-purple-900">₹{getRemainingBalance().toLocaleString()}</span>
                          </div>
                          <p className="text-xs text-purple-600 mt-2">
                            Customer pays ₹{getPartialPaymentAmount().toLocaleString()} now. Remaining ₹{getRemainingBalance().toLocaleString()} will be collected via "Collect Balance" button before report delivery.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Price Summary Section */}
                  {paymentFormData.packageId && (
                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <h4 className="font-semibold text-gray-800 mb-3">Payment Summary</h4>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Package Price:</span>
                          <span className="text-gray-800 font-medium">₹{getBaseAmount().toLocaleString()}</span>
                        </div>
                        {getDiscountAmount() > 0 && (
                          <div className="flex justify-between items-center text-sm text-green-700">
                            <span>Discount ({paymentFormData.discountType === 'percent' ? `${paymentFormData.discountValue}%` : `₹${paymentFormData.discountValue}`}):</span>
                            <span>- ₹{getDiscountAmount().toLocaleString()}</span>
                          </div>
                        )}
                        {getOfferDiscountAmount() > 0 && (
                          <div className="flex justify-between items-center text-sm text-orange-700">
                            <span>Offer Discount ({paymentFormData.selectedOfferIds?.length} offer{paymentFormData.selectedOfferIds?.length > 1 ? 's' : ''}):</span>
                            <span>- ₹{getOfferDiscountAmount().toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                          <span className="text-gray-800 font-semibold">Total Amount:</span>
                          <span className={`font-bold ${getSelectedPackage()?.allow_partial_payment && paymentFormData.usePartialPayment ? 'text-gray-500 line-through text-base' : 'text-xl text-gray-800'}`}>
                            ₹{calculateFinalAmount().toLocaleString()}
                          </span>
                        </div>
                        {getSelectedPackage()?.allow_partial_payment && paymentFormData.usePartialPayment && (
                          <div className="bg-purple-100 p-3 rounded-lg mt-2 space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-purple-800 font-semibold">Pay Now (Partial):</span>
                              <span className="font-bold text-xl text-purple-800">₹{getPartialPaymentAmount().toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-purple-600">
                              <span>Balance (Collect Later):</span>
                              <span className="font-medium">₹{getRemainingBalance().toLocaleString()}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Inspection Schedule Section - Only show if car details were provided in Step 1 */}
                  {paymentFormData.hasCarDetails === 'yes' && paymentFormData.carConfirmed && inspectionSchedules.length > 0 && (
                    <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                      <h4 className="font-semibold text-emerald-800 mb-3 flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" /> Inspection Schedule (Optional)
                      </h4>
                      <p className="text-sm text-emerald-600 mb-4">
                        You can schedule inspections now or leave them for later. Unscheduled inspections will appear in the Inspections tab.
                      </p>
                      
                      <div className="space-y-6">
                        {inspectionSchedules.map((schedule, index) => (
                          <div key={schedule.id} className="bg-white p-4 rounded-lg border border-emerald-200">
                            <div className="flex items-center justify-between mb-3">
                              <h5 className="font-medium text-emerald-800 flex items-center gap-2">
                                <Car className="h-4 w-4" />
                                Inspection {index + 1} of {inspectionSchedules.length}
                              </h5>
                              {schedule.vehicleConfirmed && (
                                <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">
                                  Vehicle Confirmed
                                </span>
                              )}
                            </div>

                            {/* Vehicle Number Input with Vaahan Lookup */}
                            <div className="space-y-3">
                              <div className="flex items-end gap-3">
                                <div className="flex-1 space-y-1">
                                  <Label className="text-xs text-gray-600">Vehicle Registration Number</Label>
                                  <Input
                                    value={schedule.vehicleNumber}
                                    onChange={(e) => updateSchedule(index, 'vehicleNumber', e.target.value.toUpperCase())}
                                    className="h-10 font-mono uppercase"
                                    placeholder="KA01AB1234"
                                    disabled={schedule.vehicleConfirmed}
                                    data-testid={`schedule-${index}-vehicle`}
                                  />
                                </div>
                                {!schedule.vehicleConfirmed && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    onClick={() => fetchVehicleForSchedule(index, schedule.vehicleNumber)}
                                    disabled={!schedule.vehicleNumber || schedule.isLoading}
                                    className="h-10 bg-emerald-600 hover:bg-emerald-700"
                                  >
                                    {schedule.isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Get Details'}
                                  </Button>
                                )}
                              </div>

                              {/* Vehicle Details Display */}
                              {schedule.vehicleData && (
                                <div className="bg-emerald-50 p-3 rounded-lg text-sm">
                                  <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div><span className="text-gray-500">Make:</span> <span className="font-medium">{schedule.vehicleData.manufacturer}</span></div>
                                    <div><span className="text-gray-500">Model:</span> <span className="font-medium">{schedule.vehicleData.model}</span></div>
                                    <div><span className="text-gray-500">Color:</span> <span className="font-medium">{schedule.vehicleData.color}</span></div>
                                  </div>
                                  {!schedule.vehicleConfirmed && (
                                    <label className="flex items-center gap-2 mt-3 pt-2 border-t border-emerald-200 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={schedule.vehicleConfirmed}
                                        onChange={(e) => updateSchedule(index, 'vehicleConfirmed', e.target.checked)}
                                        className="w-4 h-4 text-emerald-600 rounded"
                                      />
                                      <span className="text-xs font-medium">Confirm vehicle details</span>
                                    </label>
                                  )}
                                </div>
                              )}

                              {schedule.error && (
                                <p className="text-xs text-red-600">{schedule.error}</p>
                              )}

                              {/* Date, Time, and Address */}
                              <div className="grid grid-cols-2 gap-3 mt-3">
                                <div className="space-y-1">
                                  <Label className="text-xs text-gray-600">Preferred Date</Label>
                                  <Input
                                    type="date"
                                    value={schedule.inspectionDate}
                                    onChange={(e) => updateSchedule(index, 'inspectionDate', e.target.value)}
                                    className="h-9"
                                    min={new Date().toISOString().split('T')[0]}
                                    data-testid={`schedule-${index}-date`}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs text-gray-600">Preferred Time</Label>
                                  <Select 
                                    value={schedule.inspectionTime || 'select'} 
                                    onValueChange={(v) => updateSchedule(index, 'inspectionTime', v === 'select' ? '' : v)}
                                  >
                                    <SelectTrigger className="h-9" data-testid={`schedule-${index}-time`}>
                                      <SelectValue placeholder="Select Time" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="select">-- Select --</SelectItem>
                                      {['09:00 AM', '10:00 AM', '11:00 AM', '12:00 PM', '02:00 PM', '03:00 PM', '04:00 PM', '05:00 PM', '06:00 PM'].map(t => 
                                        <SelectItem key={t} value={t}>{t}</SelectItem>
                                      )}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-600">Inspection Address</Label>
                                <PlacesAutocomplete
                                  value={schedule.address}
                                  onChange={(value) => updateSchedule(index, 'address', value)}
                                  onSelect={(place) => {
                                    updateSchedule(index, 'address', place.address);
                                    updateSchedule(index, 'latitude', place.latitude);
                                    updateSchedule(index, 'longitude', place.longitude);
                                  }}
                                  placeholder="Start typing address..."
                                  className="h-9"
                                />
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Info message when no car details in Step 1 */}
                  {paymentFormData.hasCarDetails === 'no' && getSelectedPackage() && (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                      <p className="text-sm text-slate-600 flex items-center gap-2">
                        <CalendarDays className="h-4 w-4" />
                        Inspection scheduling will be available after payment. The {getSelectedPackage().no_of_inspections || 1} inspection(s) will appear in the Inspections tab as "Unscheduled".
                      </p>
                    </div>
                  )}
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
                if (!selectedLead || !paymentFormData.packageId) {
                  toast.error('Please select a package');
                  return;
                }
                const selectedPackage = getSelectedPackage();
                if (!selectedPackage) {
                  toast.error('Invalid package selected');
                  return;
                }
                setSaving(true);
                try {
                  // Save vehicle to vehicle master if we have vehicle data
                  if (vehicleData) {
                    await saveVehicleToMaster(selectedLead.id);
                  }
                  
                  // Calculate final amount after discount
                  const finalAmount = calculateFinalAmount();
                  
                  // Prepare inspection schedules data for backend
                  const schedulesData = inspectionSchedules.map((schedule, index) => ({
                    vehicle_number: schedule.vehicleNumber || '',
                    vehicle_data: schedule.vehicleData || null,
                    inspection_date: schedule.inspectionDate || '',
                    inspection_time: schedule.inspectionTime || '',
                    address: schedule.address || '',
                    latitude: schedule.latitude || null,
                    longitude: schedule.longitude || null,
                    slot_number: index + 1,
                  }));
                  
                  // Determine if partial payment is being used
                  const isPartialPayment = selectedPackage.allow_partial_payment && paymentFormData.usePartialPayment;
                  const amountToPayNow = getAmountToPayNow();
                  const balanceDue = isPartialPayment ? getRemainingBalance() : 0;
                  
                  // Use the real Razorpay payment link API - send amount to pay NOW (partial or full)
                  const response = await leadsApi.createPaymentLink(selectedLead.id, {
                    package_id: paymentFormData.packageId,
                    amount: amountToPayNow, // Amount to charge via Razorpay
                    total_amount: finalAmount, // Total package amount after discounts
                    description: `${selectedPackage.name} - ${selectedPackage.no_of_inspections || 1} Inspection(s)${getDiscountAmount() > 0 ? ` (Discount Applied)` : ''}${isPartialPayment ? ' (Partial Payment)' : ''}`,
                    send_via_whatsapp: true,
                    vehicle_number: paymentFormData.carNo || '',
                    no_of_inspections: selectedPackage.no_of_inspections || 1,
                    discount_type: paymentFormData.discountType !== 'none' ? paymentFormData.discountType : null,
                    discount_value: paymentFormData.discountValue || null,
                    base_amount: getBaseAmount(),
                    discount_amount: getDiscountAmount(),
                    inspection_schedules: schedulesData,
                    // Partial payment fields
                    is_partial_payment: isPartialPayment,
                    partial_payment_amount: isPartialPayment ? amountToPayNow : null,
                    balance_due: balanceDue,
                  });
                  
                  toast.success(response.data?.whatsapp_sent 
                    ? 'Payment link sent via WhatsApp!' 
                    : 'Payment link generated successfully!');
                  setIsPaymentModalOpen(false);
                  setVehicleData(null); // Clear vehicle data
                  setInspectionSchedules([]); // Clear schedules
                  fetchData();
                } catch (error) {
                  toast.error(error.response?.data?.detail || 'Failed to create payment link');
                } finally { 
                  setSaving(false); 
                }
              }} disabled={saving || !paymentFormData.packageId} className="bg-gradient-to-r from-blue-600 to-blue-700">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null} 
                Send Payment Link (₹{getAmountToPayNow().toLocaleString()})
                {getSelectedPackage()?.allow_partial_payment && paymentFormData.usePartialPayment && (
                  <span className="ml-1 text-xs opacity-75">Partial</span>
                )}
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
            {assigningLead?.city && (
              <p className="text-sm text-gray-500 mt-1">
                Lead City: <span className="font-medium text-blue-600">{assigningLead.city}</span>
              </p>
            )}
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Assign To (Sales Executives for {assigningLead?.city || 'this city'})</Label>
              {loadingSalesReps ? (
                <div className="flex items-center justify-center p-4">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                  <span className="ml-2 text-sm text-gray-500">Loading sales reps...</span>
                </div>
              ) : salesRepsForCity.length === 0 ? (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    No sales executives found for city: <strong>{assigningLead?.city}</strong>
                  </p>
                  <p className="text-xs text-amber-600 mt-1">
                    Please configure sales executives with this city in HR → Employees → Leads Management tab
                  </p>
                </div>
              ) : (
                <Select value={selectedEmployee || 'unassigned'} onValueChange={(v) => setSelectedEmployee(v === 'unassigned' ? '' : v)}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select Sales Executive" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">-- Select Sales Executive --</SelectItem>
                    {salesRepsForCity.map((rep) => (
                      <SelectItem key={rep.id} value={rep.id}>
                        {rep.name} {rep.leads_cities?.length > 0 && `(${rep.leads_cities.join(', ')})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
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
              <Button 
                onClick={handleAssignEmployee} 
                disabled={saving || !selectedEmployee || !reassignReason || salesRepsForCity.length === 0} 
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700"
              >
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

      {/* City Remap Modal */}
      <Dialog open={isCityRemapModalOpen} onOpenChange={setIsCityRemapModalOpen}>
        <DialogContent className="max-w-lg" data-testid="city-remap-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-orange-500" />
              City Remap
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Mode Selection Tabs */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setRemapMode('auto')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  remapMode === 'auto' 
                    ? 'bg-white shadow text-orange-600' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                🤖 Auto (by AD ID)
              </button>
              <button
                onClick={() => setRemapMode('manual')}
                className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  remapMode === 'manual' 
                    ? 'bg-white shadow text-orange-600' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                ✏️ Manual
              </button>
            </div>

            {/* City Summary */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Current Lead Distribution</h4>
              {isLoadingCitySummary ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading...
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                  {citySummary.map((city) => (
                    <div key={city.city} className="flex justify-between items-center text-sm bg-white px-3 py-2 rounded-md border">
                      <span className="text-gray-700">{city.city}</span>
                      <span className="font-medium text-gray-900">{city.total_leads}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* AUTO MODE */}
            {remapMode === 'auto' && (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-800 mb-2">🤖 Auto-Remap by AD ID</h4>
                  <p className="text-sm text-green-700 mb-3">
                    Automatically fix lead cities based on AD ID to City mappings configured in Settings.
                    Leads with an AD ID that maps to a different city will be updated.
                  </p>
                  <ul className="text-xs text-green-600 space-y-1">
                    <li>• Matches leads by ad_id or ad_name from AD City Mappings</li>
                    <li>• Only updates leads where current city differs from mapped city</li>
                    <li>• Safe: Won't affect leads without AD ID mappings</li>
                  </ul>
                </div>

                {/* Reassign Option */}
                <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-lg">
                  <Checkbox
                    id="reassign-checkbox-auto"
                    checked={cityRemapData.reassignToSalesRep}
                    onCheckedChange={(checked) => setCityRemapData({...cityRemapData, reassignToSalesRep: checked})}
                  />
                  <div>
                    <Label htmlFor="reassign-checkbox-auto" className="text-sm font-medium cursor-pointer">
                      Reassign to Sales Reps
                    </Label>
                    <p className="text-xs text-gray-500">
                      Automatically reassign leads to sales reps in the corrected city via round-robin
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* MANUAL MODE */}
            {remapMode === 'manual' && (
              <>
                {/* From City */}
                <div className="space-y-2">
                  <Label>From City (Source)</Label>
                  <Select 
                    value={cityRemapData.fromCity} 
                    onValueChange={(value) => setCityRemapData({...cityRemapData, fromCity: value})}
                  >
                    <SelectTrigger data-testid="from-city-select">
                      <SelectValue placeholder="Select source city to remap FROM" />
                    </SelectTrigger>
                    <SelectContent>
                      {citySummary.filter(c => c.total_leads > 0).map((city) => (
                        <SelectItem key={city.city} value={city.city}>
                          {city.city} ({city.total_leads} leads)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* To City */}
                <div className="space-y-2">
                  <Label>To City (Target)</Label>
                  <Select 
                    value={cityRemapData.toCity} 
                    onValueChange={(value) => setCityRemapData({...cityRemapData, toCity: value})}
                  >
                    <SelectTrigger data-testid="to-city-select">
                      <SelectValue placeholder="Select target city to remap TO" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((city) => (
                        <SelectItem key={city.id || city.name} value={city.name}>
                          {city.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Reassign Option */}
                <div className="flex items-center gap-3 bg-blue-50 p-3 rounded-lg">
                  <Checkbox
                    id="reassign-checkbox-manual"
                    checked={cityRemapData.reassignToSalesRep}
                    onCheckedChange={(checked) => setCityRemapData({...cityRemapData, reassignToSalesRep: checked})}
                  />
                  <div>
                    <Label htmlFor="reassign-checkbox-manual" className="text-sm font-medium cursor-pointer">
                      Reassign to Sales Reps
                    </Label>
                    <p className="text-xs text-gray-500">
                      Automatically reassign leads to sales reps in the new city via round-robin
                    </p>
                  </div>
                </div>

                {/* Warning */}
                {cityRemapData.fromCity && cityRemapData.toCity && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
                    <p className="text-amber-800">
                      <strong>⚠️ Warning:</strong> This will move ALL leads from <strong>{cityRemapData.fromCity}</strong> to <strong>{cityRemapData.toCity}</strong>.
                      {cityRemapData.reassignToSalesRep && ' Leads will also be reassigned to sales reps in the new city.'}
                    </p>
                  </div>
                )}
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button 
              variant="outline" 
              onClick={() => setIsCityRemapModalOpen(false)}
              disabled={isRemapping}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCityRemap}
              disabled={isRemapping || !cityRemapData.fromCity || !cityRemapData.toCity}
              className="bg-orange-500 hover:bg-orange-600"
              data-testid="confirm-remap-button"
            >
              {isRemapping ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Remapping...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Remap Leads
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notes & Activities Drawer */}
      <Sheet open={isNotesDrawerOpen} onOpenChange={setIsNotesDrawerOpen}>
        <SheetContent className="sm:max-w-[500px] p-0 flex flex-col" data-testid="notes-drawer">
          <SheetHeader className="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-slate-100">
            <SheetTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium">
                {selectedLeadForNotes?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{selectedLeadForNotes?.name}</div>
                <div className="text-xs text-gray-500 font-normal">{selectedLeadForNotes?.mobile}</div>
              </div>
            </SheetTitle>
          </SheetHeader>

          <Tabs value={notesTab} onValueChange={setNotesTab} className="flex-1 flex flex-col">
            <TabsList className="grid w-full grid-cols-2 mx-6 my-3" style={{ width: 'calc(100% - 48px)' }}>
              <TabsTrigger value="notes" className="flex items-center gap-2" data-testid="notes-tab">
                <StickyNote className="h-4 w-4" /> Notes
              </TabsTrigger>
              <TabsTrigger value="activities" className="flex items-center gap-2" data-testid="activities-tab">
                <Activity className="h-4 w-4" /> Activity Log
              </TabsTrigger>
            </TabsList>

            <TabsContent value="notes" className="flex-1 flex flex-col px-6 pb-6 mt-0">
              {/* Add Note Section */}
              <div className="bg-slate-50 rounded-xl p-4 border mb-4">
                <Label className="text-sm font-medium mb-2 block">Add a note</Label>
                <div className="flex gap-2">
                  <textarea
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    placeholder="Write your note here..."
                    className="flex-1 min-h-[60px] px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    data-testid="new-note-input"
                  />
                </div>
                <div className="flex justify-end mt-2">
                  <Button 
                    onClick={handleAddNote} 
                    disabled={savingNote || !newNote.trim()}
                    size="sm"
                    className="bg-gradient-to-r from-blue-600 to-blue-700"
                    data-testid="add-note-button"
                  >
                    {savingNote ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                    Add Note
                  </Button>
                </div>
              </div>

              {/* Notes List */}
              <div className="flex-1 overflow-y-auto space-y-3">
                {loadingNotes ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : leadNotes.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <StickyNote className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">No notes yet. Add the first note!</p>
                  </div>
                ) : (
                  leadNotes.map((note) => (
                    <div key={note.id} className="bg-white border rounded-xl p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-medium text-xs flex-shrink-0">
                          {note.user_name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-medium text-sm text-gray-900">{note.user_name || 'Unknown'}</span>
                            <span className="text-xs text-gray-400">{formatDateTime(note.created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.note}</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="activities" className="flex-1 flex flex-col px-6 pb-6 mt-0 overflow-hidden">
              {loadingNotes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : leadActivities.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Activity className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">No activities recorded yet.</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {leadActivities.map((activity) => {
                    // Determine activity icon and color based on action type
                    const getActivityStyle = (action) => {
                      switch(action) {
                        case 'lead_created': return { bg: 'bg-green-500', icon: '✨' };
                        case 'lead_assigned': 
                        case 'assigned': 
                        case 'reassigned': return { bg: 'bg-blue-500', icon: '👤' };
                        case 'status_changed': return { bg: 'bg-purple-500', icon: '🔄' };
                        case 'note_added': return { bg: 'bg-amber-500', icon: '📝' };
                        case 'payment_link_sent':
                        case 'payment_link_sent_whatsapp': return { bg: 'bg-emerald-500', icon: '💳' };
                        case 'customer_message': return { bg: 'bg-cyan-500', icon: '💬' };
                        case 'reminder_set': return { bg: 'bg-orange-500', icon: '⏰' };
                        case 'whatsapp_sent':
                        case 'bot_response': return { bg: 'bg-green-600', icon: '📱' };
                        default: return { bg: 'bg-slate-400', icon: '📋' };
                      }
                    };
                    
                    const style = getActivityStyle(activity.action);
                    
                    // Format activity description with full details
                    const getActivityDescription = () => {
                      switch(activity.action) {
                        case 'lead_created':
                          return (
                            <div>
                              <span className="font-medium text-green-700">Lead created</span>
                              {activity.details && <span className="text-gray-600"> - {activity.details}</span>}
                              {activity.new_value && (
                                <div className="mt-1 text-xs bg-green-50 p-2 rounded border border-green-100">
                                  {activity.new_value}
                                </div>
                              )}
                            </div>
                          );
                        case 'lead_assigned':
                        case 'assigned':
                          return (
                            <div>
                              <span className="font-medium text-blue-700">Assigned</span>
                              {activity.new_value && <span className="text-gray-700"> → <span className="font-medium">{activity.new_value}</span></span>}
                              {activity.details && <div className="text-xs text-gray-500 mt-0.5">{activity.details}</div>}
                            </div>
                          );
                        case 'reassigned':
                          return (
                            <div>
                              <span className="font-medium text-blue-700">Reassigned</span>
                              {activity.old_value && <span className="text-gray-600"> from <span className="font-medium">{activity.old_value}</span></span>}
                              {activity.new_value && <span className="text-gray-700"> → <span className="font-medium">{activity.new_value}</span></span>}
                            </div>
                          );
                        case 'status_changed':
                          return (
                            <div>
                              <span className="font-medium text-purple-700">Status changed</span>
                              <span className="text-gray-600"> from </span>
                              <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-medium">{activity.old_value || 'N/A'}</span>
                              <span className="text-gray-600"> → </span>
                              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">{activity.new_value}</span>
                            </div>
                          );
                        case 'note_added':
                          return (
                            <div>
                              <span className="font-medium text-amber-700">Note added</span>
                              {activity.new_value && (
                                <div className="mt-1 text-xs bg-amber-50 p-2 rounded border border-amber-100 text-gray-700">
                                  "{activity.new_value}"
                                </div>
                              )}
                            </div>
                          );
                        case 'payment_link_sent':
                        case 'payment_link_sent_whatsapp':
                          return (
                            <div>
                              <span className="font-medium text-emerald-700">Payment link sent</span>
                              {activity.action === 'payment_link_sent_whatsapp' && <span className="text-gray-500"> via WhatsApp</span>}
                              {activity.new_value && (
                                <div className="mt-1 text-xs bg-emerald-50 p-2 rounded border border-emerald-100">
                                  <span className="font-medium">Amount:</span> {activity.new_value}
                                </div>
                              )}
                              {activity.details && <div className="text-xs text-gray-500 mt-0.5">{activity.details}</div>}
                            </div>
                          );
                        case 'customer_message':
                          return (
                            <div>
                              <span className="font-medium text-cyan-700">Customer message received</span>
                              {activity.new_value && (
                                <div className="mt-1 text-xs bg-cyan-50 p-2 rounded border border-cyan-100 text-gray-700">
                                  "{activity.new_value}"
                                </div>
                              )}
                            </div>
                          );
                        case 'whatsapp_sent':
                        case 'bot_response':
                          return (
                            <div>
                              <span className="font-medium text-green-700">
                                {activity.action === 'bot_response' ? 'Bot responded' : 'WhatsApp sent'}
                              </span>
                              {activity.new_value && (
                                <div className="mt-1 text-xs bg-green-50 p-2 rounded border border-green-100 text-gray-700">
                                  "{activity.new_value}"
                                </div>
                              )}
                            </div>
                          );
                        case 'reminder_set':
                          return (
                            <div>
                              <span className="font-medium text-orange-700">Reminder set</span>
                              {activity.new_value && <span className="text-gray-600"> for <span className="font-medium">{activity.new_value}</span></span>}
                            </div>
                          );
                        default:
                          return (
                            <div>
                              <span className="font-medium text-gray-700">{activity.action?.replace(/_/g, ' ')}</span>
                              {activity.details && <span className="text-gray-600"> - {activity.details}</span>}
                              {activity.new_value && <div className="text-xs text-gray-500 mt-0.5">{activity.new_value}</div>}
                            </div>
                          );
                      }
                    };
                    
                    return (
                      <div key={activity.id} className="relative pl-6 pb-3 border-l-2 border-slate-200 last:pb-0">
                        <div className={`absolute -left-2 top-0 h-4 w-4 rounded-full ${style.bg} border-2 border-white flex items-center justify-center text-[8px]`}>
                          {style.icon}
                        </div>
                        <div className="bg-white border rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                              {activity.action?.replace(/_/g, ' ')}
                            </span>
                            <span className="text-xs text-gray-400 whitespace-nowrap">{formatDateTime(activity.created_at)}</span>
                          </div>
                          <div className="text-sm text-gray-700">
                            {getActivityDescription()}
                          </div>
                          <div className="flex items-center gap-1 mt-2 pt-2 border-t border-gray-100">
                            <div className="h-5 w-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-[10px] font-medium">
                              {activity.user_name?.charAt(0)?.toUpperCase() || 'S'}
                            </div>
                            <span className="text-xs text-gray-500">by <span className="font-medium">{activity.user_name || 'System'}</span></span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
