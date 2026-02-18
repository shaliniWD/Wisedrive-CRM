import React, { useState, useEffect, useCallback } from 'react';
import { inspectionsApi, utilityApi, vehicleApi } from '@/services/api';
import { formatDate, formatTime, formatDateTime } from '@/utils/dateFormat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Search, Loader2, ClipboardCheck, Filter, Calendar, MapPin, 
  Car, User, Download, Eye, Edit2, Clock, CheckCircle, XCircle, 
  AlertCircle, Play, Plus, Send, CreditCard, DollarSign, FileText,
  UserCheck, CalendarClock, RefreshCw, Ban, Copy, ExternalLink, Link2
} from 'lucide-react';

// Helper function to extract clean Make name from verbose manufacturer string
const extractMake = (manufacturer) => {
  if (!manufacturer) return '';
  const upperMfr = manufacturer.toUpperCase();
  
  // Common car brands mapping
  const brands = [
    { pattern: /FORD/i, name: 'Ford' },
    { pattern: /TOYOTA/i, name: 'Toyota' },
    { pattern: /MARUTI|SUZUKI/i, name: 'Maruti Suzuki' },
    { pattern: /HYUNDAI/i, name: 'Hyundai' },
    { pattern: /HONDA/i, name: 'Honda' },
    { pattern: /TATA/i, name: 'Tata' },
    { pattern: /MAHINDRA/i, name: 'Mahindra' },
    { pattern: /KIA/i, name: 'Kia' },
    { pattern: /SKODA/i, name: 'Skoda' },
    { pattern: /VOLKSWAGEN|VW/i, name: 'Volkswagen' },
    { pattern: /BMW/i, name: 'BMW' },
    { pattern: /MERCEDES|BENZ/i, name: 'Mercedes-Benz' },
    { pattern: /AUDI/i, name: 'Audi' },
    { pattern: /NISSAN/i, name: 'Nissan' },
    { pattern: /RENAULT/i, name: 'Renault' },
    { pattern: /CHEVROLET/i, name: 'Chevrolet' },
    { pattern: /JEEP/i, name: 'Jeep' },
    { pattern: /MG|MORRIS/i, name: 'MG' },
    { pattern: /VOLVO/i, name: 'Volvo' },
    { pattern: /JAGUAR/i, name: 'Jaguar' },
    { pattern: /LAND ROVER/i, name: 'Land Rover' },
    { pattern: /LEXUS/i, name: 'Lexus' },
    { pattern: /PORSCHE/i, name: 'Porsche' },
    { pattern: /FIAT/i, name: 'Fiat' },
    { pattern: /ISUZU/i, name: 'Isuzu' },
    { pattern: /DATSUN/i, name: 'Datsun' },
    { pattern: /FORCE/i, name: 'Force' },
    { pattern: /ASHOK LEYLAND/i, name: 'Ashok Leyland' },
    { pattern: /BAJAJ/i, name: 'Bajaj' },
    { pattern: /HERO/i, name: 'Hero' },
    { pattern: /TVS/i, name: 'TVS' },
    { pattern: /ROYAL ENFIELD/i, name: 'Royal Enfield' },
  ];
  
  for (const brand of brands) {
    if (brand.pattern.test(upperMfr)) {
      return brand.name;
    }
  }
  
  // Fallback: return first word if no match
  return manufacturer.split(' ')[0];
};

// Helper function to extract clean Model name from verbose model string
const extractModel = (modelStr) => {
  if (!modelStr) return '';
  
  // Common model names to extract
  const models = [
    // Ford
    { pattern: /ENDEAVOUR/i, name: 'Endeavour' },
    { pattern: /ECOSPORT/i, name: 'EcoSport' },
    { pattern: /FIGO/i, name: 'Figo' },
    { pattern: /ASPIRE/i, name: 'Aspire' },
    { pattern: /MUSTANG/i, name: 'Mustang' },
    // Toyota
    { pattern: /INNOVA/i, name: 'Innova' },
    { pattern: /FORTUNER/i, name: 'Fortuner' },
    { pattern: /CAMRY/i, name: 'Camry' },
    { pattern: /COROLLA/i, name: 'Corolla' },
    { pattern: /ETIOS/i, name: 'Etios' },
    { pattern: /GLANZA/i, name: 'Glanza' },
    { pattern: /URBAN CRUISER/i, name: 'Urban Cruiser' },
    { pattern: /YARIS/i, name: 'Yaris' },
    { pattern: /VELLFIRE/i, name: 'Vellfire' },
    { pattern: /LAND CRUISER/i, name: 'Land Cruiser' },
    // Maruti Suzuki
    { pattern: /SWIFT/i, name: 'Swift' },
    { pattern: /BALENO/i, name: 'Baleno' },
    { pattern: /DZIRE/i, name: 'Dzire' },
    { pattern: /ALTO/i, name: 'Alto' },
    { pattern: /WAGON\s*R/i, name: 'Wagon R' },
    { pattern: /VITARA BREZZA|BREZZA/i, name: 'Brezza' },
    { pattern: /ERTIGA/i, name: 'Ertiga' },
    { pattern: /CIAZ/i, name: 'Ciaz' },
    { pattern: /CELERIO/i, name: 'Celerio' },
    { pattern: /IGNIS/i, name: 'Ignis' },
    { pattern: /S-CROSS|SCROSS/i, name: 'S-Cross' },
    { pattern: /XL6/i, name: 'XL6' },
    { pattern: /GRAND VITARA/i, name: 'Grand Vitara' },
    { pattern: /JIMNY/i, name: 'Jimny' },
    { pattern: /FRONX/i, name: 'Fronx' },
    { pattern: /INVICTO/i, name: 'Invicto' },
    // Hyundai
    { pattern: /CRETA/i, name: 'Creta' },
    { pattern: /VENUE/i, name: 'Venue' },
    { pattern: /I20/i, name: 'i20' },
    { pattern: /I10/i, name: 'i10' },
    { pattern: /VERNA/i, name: 'Verna' },
    { pattern: /TUCSON/i, name: 'Tucson' },
    { pattern: /ALCAZAR/i, name: 'Alcazar' },
    { pattern: /AURA/i, name: 'Aura' },
    { pattern: /SANTRO/i, name: 'Santro' },
    { pattern: /EXTER/i, name: 'Exter' },
    // Honda
    { pattern: /CITY/i, name: 'City' },
    { pattern: /AMAZE/i, name: 'Amaze' },
    { pattern: /WR-V|WRV/i, name: 'WR-V' },
    { pattern: /JAZZ/i, name: 'Jazz' },
    { pattern: /CIVIC/i, name: 'Civic' },
    { pattern: /ELEVATE/i, name: 'Elevate' },
    // Tata
    { pattern: /NEXON/i, name: 'Nexon' },
    { pattern: /PUNCH/i, name: 'Punch' },
    { pattern: /HARRIER/i, name: 'Harrier' },
    { pattern: /SAFARI/i, name: 'Safari' },
    { pattern: /ALTROZ/i, name: 'Altroz' },
    { pattern: /TIAGO/i, name: 'Tiago' },
    { pattern: /TIGOR/i, name: 'Tigor' },
    // Mahindra
    { pattern: /THAR/i, name: 'Thar' },
    { pattern: /SCORPIO/i, name: 'Scorpio' },
    { pattern: /XUV700/i, name: 'XUV700' },
    { pattern: /XUV500/i, name: 'XUV500' },
    { pattern: /XUV400/i, name: 'XUV400' },
    { pattern: /XUV300/i, name: 'XUV300' },
    { pattern: /BOLERO/i, name: 'Bolero' },
    { pattern: /MARAZZO/i, name: 'Marazzo' },
    // Kia
    { pattern: /SELTOS/i, name: 'Seltos' },
    { pattern: /SONET/i, name: 'Sonet' },
    { pattern: /CARENS/i, name: 'Carens' },
    { pattern: /CARNIVAL/i, name: 'Carnival' },
    // Others
    { pattern: /POLO/i, name: 'Polo' },
    { pattern: /VENTO/i, name: 'Vento' },
    { pattern: /RAPID/i, name: 'Rapid' },
    { pattern: /OCTAVIA/i, name: 'Octavia' },
    { pattern: /SUPERB/i, name: 'Superb' },
    { pattern: /KUSHAQ/i, name: 'Kushaq' },
    { pattern: /SLAVIA/i, name: 'Slavia' },
    { pattern: /DUSTER/i, name: 'Duster' },
    { pattern: /KWID/i, name: 'Kwid' },
    { pattern: /TRIBER/i, name: 'Triber' },
    { pattern: /KIGER/i, name: 'Kiger' },
    { pattern: /HECTOR/i, name: 'Hector' },
    { pattern: /ASTOR/i, name: 'Astor' },
    { pattern: /GLOSTER/i, name: 'Gloster' },
    { pattern: /COMPASS/i, name: 'Compass' },
    { pattern: /MERIDIAN/i, name: 'Meridian' },
    { pattern: /WRANGLER/i, name: 'Wrangler' },
  ];
  
  for (const model of models) {
    if (model.pattern.test(modelStr)) {
      return model.name;
    }
  }
  
  // Fallback: Extract main word (usually the longest capitalized word)
  const words = modelStr.split(/[\s\d.]+/).filter(w => w.length > 2);
  if (words.length > 0) {
    // Return the longest word that looks like a model name
    const filtered = words.filter(w => !/^(PVT|LTD|INDIA|MOTOR|MOTORS|AUTO|AT|MT|AMT|CVT|PETROL|DIESEL|CNG|HYBRID)$/i.test(w));
    if (filtered.length > 0) {
      return filtered.reduce((a, b) => a.length >= b.length ? a : b);
    }
  }
  
  return modelStr.split(' ')[0];
};

// Inspection Status options
const INSPECTION_STATUSES = [
  { value: 'NEW_INSPECTION', label: 'New Inspection', color: 'bg-slate-100 text-slate-800' },
  { value: 'ASSIGNED_TO_MECHANIC', label: 'Assigned to Mechanic', color: 'bg-indigo-100 text-indigo-800' },
  { value: 'INSPECTION_CONFIRMED', label: 'Confirmed', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'INSPECTION_STARTED', label: 'Started', color: 'bg-amber-100 text-amber-800' },
  { value: 'INSPECTION_IN_PROGRESS', label: 'In Progress', color: 'bg-orange-100 text-orange-800' },
  { value: 'INSPECTION_COMPLETED', label: 'Completed', color: 'bg-emerald-100 text-emerald-800' },
  { value: 'INSPECTION_CANCELLED_CUSTOMER', label: 'Cancelled (Customer)', color: 'bg-red-100 text-red-800' },
  { value: 'INSPECTION_CANCELLED_WISEDRIVE', label: 'Cancelled (Wisedrive)', color: 'bg-red-100 text-red-800' },
];

// Inspection Status Badge Component
const InspectionStatusBadge = ({ status }) => {
  const config = {
    NEW_INSPECTION: { color: 'bg-slate-100 text-slate-800 border-slate-200', icon: Plus, label: 'New' },
    ASSIGNED_TO_MECHANIC: { color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: User, label: 'Assigned' },
    INSPECTION_CONFIRMED: { color: 'bg-cyan-100 text-cyan-800 border-cyan-200', icon: CheckCircle, label: 'Confirmed' },
    INSPECTION_STARTED: { color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Play, label: 'Started' },
    INSPECTION_IN_PROGRESS: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: Clock, label: 'In Progress' },
    INSPECTION_COMPLETED: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle, label: 'Completed' },
    INSPECTION_CANCELLED_CUSTOMER: { color: 'bg-red-100 text-red-800 border-red-200', icon: Ban, label: 'Cancelled (C)' },
    INSPECTION_CANCELLED_WISEDRIVE: { color: 'bg-red-100 text-red-800 border-red-200', icon: Ban, label: 'Cancelled (W)' },
    SCHEDULED: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Calendar, label: 'Scheduled' },
    UNSCHEDULED: { color: 'bg-purple-100 text-purple-800 border-purple-200', icon: AlertCircle, label: 'Unscheduled' },
  };
  const cfg = config[status] || config.SCHEDULED;
  const Icon = cfg.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
};

// Payment Status Badge Component  
const PaymentStatusBadge = ({ status, balanceDue }) => {
  const config = {
    FULLY_PAID: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle, label: 'Fully Paid' },
    PARTIALLY_PAID: { color: 'bg-amber-100 text-amber-800 border-amber-200', icon: DollarSign, label: `Partial` },
    PAID: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle, label: 'Paid' },
    PENDING: { color: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle, label: 'Pending' },
  };
  const cfg = config[status] || config.PENDING;
  const Icon = cfg.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
};

// Summary Card Component
const SummaryCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <div className="rounded-xl border bg-white p-5">
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className={`text-2xl font-bold ${color || 'text-gray-900'}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-xl bg-gradient-to-r ${
        color?.includes('emerald') ? 'from-emerald-500 to-emerald-600' : 
        color?.includes('blue') ? 'from-blue-500 to-blue-600' : 
        color?.includes('amber') ? 'from-amber-500 to-amber-600' :
        'from-gray-500 to-gray-600'
      }`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
    </div>
  </div>
);

export default function InspectionsPage() {
  const [inspections, setInspections] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInspection, setEditingInspection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('scheduled');

  // Modal states
  const [isCollectBalanceModalOpen, setIsCollectBalanceModalOpen] = useState(false);
  const [collectBalanceInspection, setCollectBalanceInspection] = useState(null);
  const [collectingBalance, setCollectingBalance] = useState(false);
  const [generatedPaymentLink, setGeneratedPaymentLink] = useState(null);
  const [checkingPaymentStatus, setCheckingPaymentStatus] = useState(false);
  const [paymentLinkStatus, setPaymentLinkStatus] = useState(null);
  
  // Vehicle Edit Modal
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [vehicleEditInspection, setVehicleEditInspection] = useState(null);
  const [vehicleSearching, setVehicleSearching] = useState(false);
  const [vehicleData, setVehicleData] = useState(null);
  const [newVehicleNumber, setNewVehicleNumber] = useState('');
  
  // Schedule Edit Modal
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleEditInspection, setScheduleEditInspection] = useState(null);
  const [newScheduleDate, setNewScheduleDate] = useState('');
  const [newScheduleTime, setNewScheduleTime] = useState('');
  
  // Mechanic Assign Modal
  const [isMechanicModalOpen, setIsMechanicModalOpen] = useState(false);
  const [mechanicEditInspection, setMechanicEditInspection] = useState(null);
  const [selectedMechanicId, setSelectedMechanicId] = useState('');

  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [formData, setFormData] = useState({
    customer_name: '', customer_mobile: '', address: '', city: '',
    payment_status: 'PENDING', inspection_status: 'SCHEDULED',
    mechanic_name: '', car_number: '', car_details: '',
    scheduled_date: '', scheduled_time: '', notes: '',
  });

  // Fetch mechanics list
  const fetchMechanics = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/api/mechanics`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMechanics(response.data || []);
    } catch (error) {
      console.error('Failed to load mechanics:', error);
    }
  }, []);

  // Handle Collect Balance action - Generate Payment Link
  const handleCollectBalance = async (sendWhatsApp = true) => {
    if (!collectBalanceInspection) return;
    
    setCollectingBalance(true);
    try {
      const response = await inspectionsApi.collectBalance(collectBalanceInspection.id, {
        send_whatsapp: sendWhatsApp,
        notes: `Balance collection initiated for inspection ${collectBalanceInspection.id}`
      });
      
      // Store the generated payment link
      setGeneratedPaymentLink({
        url: response.data?.payment_link,
        linkId: response.data?.payment_link_id,
        amount: collectBalanceInspection.balance_due,
        whatsappSent: response.data?.whatsapp_sent
      });
      
      if (sendWhatsApp && response.data?.whatsapp_sent) {
        toast.success(`Payment link (₹${collectBalanceInspection.balance_due?.toLocaleString()}) sent via WhatsApp!`);
      } else {
        toast.success('Payment link generated successfully!');
      }
      
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate payment link');
    } finally {
      setCollectingBalance(false);
    }
  };

  // Copy payment link to clipboard
  const handleCopyPaymentLink = () => {
    if (generatedPaymentLink?.url) {
      navigator.clipboard.writeText(generatedPaymentLink.url);
      toast.success('Payment link copied to clipboard!');
    }
  };

  // Check payment status
  const handleCheckPaymentStatus = async () => {
    if (!collectBalanceInspection) return;
    
    setCheckingPaymentStatus(true);
    try {
      const response = await inspectionsApi.getById(collectBalanceInspection.id);
      const inspection = response.data;
      
      const isFullyPaid = inspection.payment_status === 'FULLY_PAID' || inspection.payment_status === 'PAID';
      const balanceDue = inspection.balance_due || inspection.pending_amount || 0;
      
      setPaymentLinkStatus({
        status: isFullyPaid ? 'PAID' : (balanceDue > 0 ? 'PENDING' : 'PAID'),
        amountPaid: inspection.amount_paid || 0,
        balanceDue: balanceDue,
        lastUpdated: new Date().toLocaleTimeString()
      });
      
      if (isFullyPaid) {
        toast.success('Payment received! Full amount paid.');
        fetchData();
      } else {
        toast.info(`Payment pending. Balance due: ₹${balanceDue.toLocaleString()}`);
      }
    } catch (error) {
      toast.error('Failed to check payment status');
    } finally {
      setCheckingPaymentStatus(false);
    }
  };

  // Close collect balance modal and reset state
  const closeCollectBalanceModal = () => {
    setIsCollectBalanceModalOpen(false);
    setCollectBalanceInspection(null);
    setGeneratedPaymentLink(null);
    setPaymentLinkStatus(null);
  };

  // Handle View Report - opens in new tab
  const handleViewReport = (inspection) => {
    if (inspection.report_url) {
      window.open(inspection.report_url, '_blank');
    } else {
      toast.error('Report not available yet');
    }
  };

  // Handle Status Change
  const handleStatusChange = async (inspectionId, newStatus) => {
    try {
      await inspectionsApi.updateStatus(inspectionId, newStatus);
      toast.success(`Status updated to ${INSPECTION_STATUSES.find(s => s.value === newStatus)?.label || newStatus}`);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update status');
    }
  };

  // Handle Vehicle Search (Vaahan API)
  const handleVehicleSearch = async () => {
    if (!newVehicleNumber || newVehicleNumber.length < 6) {
      toast.error('Please enter a valid vehicle number');
      return;
    }
    
    setVehicleSearching(true);
    try {
      const response = await vehicleApi.getDetails(newVehicleNumber.toUpperCase().replace(/\s/g, ''));
      // API returns {success: true, data: {...vehicle details...}}
      const vehicle = response.data?.data || response.data;
      if (vehicle && (vehicle.manufacturer || vehicle.model || vehicle.registration_number)) {
        setVehicleData(vehicle);
        toast.success('Vehicle details found!');
      } else {
        toast.info('Vehicle not found in database. You can enter details manually.');
        setVehicleData(null);
      }
    } catch (error) {
      // Handle common error messages from Vaahan API
      const errorMsg = error.response?.data?.detail || '';
      if (errorMsg.includes('Inconvenience') || errorMsg.includes('not found')) {
        toast.info('Vehicle not found in RC database. You can enter details manually.');
      } else {
        toast.error('Unable to fetch vehicle details. You can proceed manually.');
      }
      setVehicleData(null);
    } finally {
      setVehicleSearching(false);
    }
  };

  // Handle Vehicle Update
  const handleVehicleUpdate = async () => {
    if (!vehicleEditInspection || !newVehicleNumber) return;
    
    setSaving(true);
    try {
      const updateData = {
        car_number: newVehicleNumber.toUpperCase().replace(/\s/g, ''),
      };
      
      if (vehicleData) {
        updateData.car_make = vehicleData.manufacturer || vehicleData.make || '';
        updateData.car_model = vehicleData.model || '';
        updateData.car_year = vehicleData.manufacturing_date?.split('/')?.pop() || vehicleData.year || '';
        updateData.car_color = vehicleData.color || '';
        updateData.fuel_type = vehicleData.fuel_type || '';
      }
      
      await inspectionsApi.updateVehicle(vehicleEditInspection.id, updateData);
      toast.success('Vehicle updated successfully!');
      setIsVehicleModalOpen(false);
      setVehicleEditInspection(null);
      setVehicleData(null);
      setNewVehicleNumber('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update vehicle');
    } finally {
      setSaving(false);
    }
  };

  // Handle Schedule Update
  const handleScheduleUpdate = async () => {
    if (!scheduleEditInspection || !newScheduleDate || !newScheduleTime) {
      toast.error('Please select date and time');
      return;
    }
    
    setSaving(true);
    try {
      await inspectionsApi.updateSchedule(scheduleEditInspection.id, {
        scheduled_date: newScheduleDate,
        scheduled_time: newScheduleTime
      });
      toast.success('Schedule updated successfully!');
      setIsScheduleModalOpen(false);
      setScheduleEditInspection(null);
      setNewScheduleDate('');
      setNewScheduleTime('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update schedule');
    } finally {
      setSaving(false);
    }
  };

  // Handle Mechanic Assignment
  const handleMechanicAssign = async () => {
    if (!mechanicEditInspection) return;
    
    setSaving(true);
    try {
      // If "unassign" is selected, pass null to unassign
      const mechanicId = selectedMechanicId === 'unassign' ? null : (selectedMechanicId || null);
      await inspectionsApi.assignMechanic(mechanicEditInspection.id, mechanicId);
      toast.success(mechanicId ? 'Mechanic assigned successfully!' : 'Mechanic unassigned');
      setIsMechanicModalOpen(false);
      setMechanicEditInspection(null);
      setSelectedMechanicId('');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update mechanic');
    } finally {
      setSaving(false);
    }
  };

  // Handle Send Report action
  const handleSendReport = async (inspection) => {
    const isFullyPaid = inspection.payment_status === 'FULLY_PAID' || inspection.payment_status === 'PAID';
    if (!isFullyPaid) {
      toast.error('Cannot send report until full payment is received');
      return;
    }
    
    try {
      await inspectionsApi.sendReport(inspection.id, { send_via_whatsapp: true });
      toast.success('Report sent successfully!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send report');
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (filterCity && filterCity !== 'all') params.city = filterCity;
      if (filterStatus && filterStatus !== 'all') params.inspection_status = filterStatus;
      params.is_scheduled = activeTab === 'scheduled';

      const [inspectionsRes, citiesRes] = await Promise.all([
        inspectionsApi.getAll(params), utilityApi.getCities(),
      ]);

      setInspections(inspectionsRes.data);
      setCities(citiesRes.data);
    } catch (error) {
      toast.error('Failed to load inspections');
    } finally {
      setLoading(false);
    }
  }, [search, filterCity, filterStatus, activeTab]);

  useEffect(() => { fetchData(); fetchMechanics(); }, [fetchData, fetchMechanics]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer_name || !formData.customer_mobile || !formData.city) {
      toast.error('Please fill in required fields');
      return;
    }
    setSaving(true);
    try {
      if (editingInspection) {
        await inspectionsApi.update(editingInspection.id, formData);
        toast.success('Inspection updated');
      } else {
        await inspectionsApi.create(formData);
        toast.success('Inspection created');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to save inspection');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (inspection) => {
    setEditingInspection(inspection);
    setFormData({
      customer_name: inspection.customer_name, customer_mobile: inspection.customer_mobile,
      address: inspection.address, city: inspection.city,
      payment_status: inspection.payment_status, inspection_status: inspection.inspection_status,
      mechanic_name: inspection.mechanic_name || '', car_number: inspection.car_number || '',
      car_details: inspection.car_details || '', scheduled_date: inspection.scheduled_date || '',
      scheduled_time: inspection.scheduled_time || '', notes: inspection.notes || '',
    });
    setIsModalOpen(true);
  };

  const unscheduledCount = inspections.filter(i => !i.scheduled_date).length;
  const scheduledCount = inspections.filter(i => i.scheduled_date).length;
  const completedCount = inspections.filter(i => i.inspection_status === 'INSPECTION_COMPLETED').length;

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="inspections-page">
      {/* Page Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inspections</h1>
          <p className="text-gray-500 mt-1">Manage and track all vehicle inspections</p>
        </div>
        <button
          onClick={() => { setEditingInspection(null); setFormData({ ...formData, customer_name: '', customer_mobile: '', city: '' }); setIsModalOpen(true); }}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/25 transition-all"
        >
          <Plus className="h-4 w-4" /> New Inspection
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
        <SummaryCard title="Total Inspections" value={inspections.length} icon={ClipboardCheck} color="text-blue-700" />
        <SummaryCard title="Scheduled" value={scheduledCount} icon={Calendar} color="text-amber-600" />
        <SummaryCard title="Completed" value={completedCount} icon={CheckCircle} color="text-emerald-600" />
        <SummaryCard title="Unscheduled" value={unscheduledCount} icon={AlertCircle} color="text-purple-600" />
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by customer name or mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              data-testid="search-input"
            />
          </div>

          <Select value={filterCity || 'all'} onValueChange={setFilterCity}>
            <SelectTrigger className="w-[160px] h-10 bg-white" data-testid="filter-city">
              <MapPin className="h-4 w-4 text-gray-400 mr-2" />
              <SelectValue placeholder="All Cities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>

          <Select value={filterStatus || 'all'} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[200px] h-10 bg-white" data-testid="filter-status">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {INSPECTION_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button 
            onClick={fetchData}
            className="px-4 py-2.5 border rounded-lg hover:bg-gray-50 font-medium text-sm flex items-center gap-2"
          >
            <Filter className="h-4 w-4" /> Apply
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t">
          <button
            onClick={() => setActiveTab('unscheduled')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'unscheduled' 
                ? 'bg-gray-900 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            data-testid="unscheduled-tab"
          >
            Unscheduled ({unscheduledCount})
          </button>
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'scheduled' 
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            data-testid="scheduled-tab"
          >
            Scheduled ({scheduledCount})
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {activeTab === 'unscheduled' ? (
          /* Unscheduled Tab Table */
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Payment Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Package</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Available</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                      <span className="text-gray-500">Loading inspections...</span>
                    </div>
                  </td>
                </tr>
              ) : inspections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <ClipboardCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No unscheduled inspections</p>
                  </td>
                </tr>
              ) : (
                inspections.map((inspection) => (
                  <tr key={inspection.id} className="hover:bg-slate-50 transition-colors" data-testid={`inspection-row-${inspection.id}`}>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium">{formatDate(inspection.payment_date || inspection.created_at)}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 flex items-center justify-center text-white font-medium text-sm">
                          {inspection.customer_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{inspection.customer_name}</div>
                          <div className="text-sm text-gray-500 font-mono">{inspection.customer_mobile}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-700">{inspection.package_type || 'Standard'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                        {inspection.inspections_available || 1}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-xs space-y-0.5">
                        <div className="text-gray-500">Total: <span className="font-medium text-gray-900">₹{inspection.total_amount || 0}</span></div>
                        <div className="text-gray-500">Paid: <span className="font-medium text-emerald-600">₹{inspection.amount_paid || 0}</span></div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <PaymentStatusBadge status={inspection.payment_type === 'Partial' ? 'PARTIALLY_PAID' : inspection.payment_status} balanceDue={inspection.balance_due || inspection.pending_amount} />
                    </td>
                    <td className="px-4 py-4">
                      <button 
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-xs font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm"
                        onClick={() => {
                          setEditingInspection(inspection);
                          setFormData({
                            ...formData,
                            customer_name: inspection.customer_name,
                            customer_mobile: inspection.customer_mobile,
                            city: inspection.city,
                            car_number: inspection.car_number || '',
                            payment_status: inspection.payment_status,
                          });
                          setIsModalOpen(true);
                        }}
                        data-testid={`schedule-inspection-${inspection.id}`}
                      >
                        Schedule
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          /* Scheduled Tab Table */
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px]">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[120px]">Date/Time</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[180px]">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[150px]">Vehicle</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[160px]">Payment Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[160px]">Inspection Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[140px]">Mechanic</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[100px]">Location</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider w-[140px]">Inspection Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-12">
                      <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        <span className="text-gray-500">Loading inspections...</span>
                      </div>
                    </td>
                </tr>
              ) : inspections.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <ClipboardCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No scheduled inspections</p>
                  </td>
                </tr>
              ) : (
                inspections.map((inspection) => {
                  const isFullyPaid = inspection.payment_status === 'FULLY_PAID' || inspection.payment_status === 'PAID';
                  const actualBalanceDue = inspection.balance_due || inspection.pending_amount || 0;
                  const isPartialPayment = (inspection.payment_status === 'PARTIALLY_PAID') || 
                    (inspection.payment_type === 'Partial' && actualBalanceDue > 0);
                  const hasBalanceDue = actualBalanceDue > 0 && isPartialPayment;
                  const isCompleted = inspection.inspection_status === 'INSPECTION_COMPLETED';
                  const canSendReport = isFullyPaid && isCompleted;
                  
                  return (
                  <tr key={inspection.id} className="hover:bg-slate-50 transition-colors" data-testid={`inspection-row-${inspection.id}`}>
                    {/* Date/Time Column - Editable */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-900 text-sm">{formatDate(inspection.scheduled_date) || '-'}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-sm text-gray-600">{formatTime(inspection.scheduled_time)}</span>
                        </div>
                        <button 
                          onClick={() => {
                            setScheduleEditInspection(inspection);
                            setNewScheduleDate(inspection.scheduled_date || '');
                            setNewScheduleTime(inspection.scheduled_time || '');
                            setIsScheduleModalOpen(true);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Change Schedule"
                          data-testid={`edit-schedule-${inspection.id}`}
                        >
                          <CalendarClock className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    
                    {/* Customer Column */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium text-xs flex-shrink-0">
                          {inspection.customer_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900 text-sm">{inspection.customer_name}</div>
                          <div className="text-xs text-gray-500 font-mono">{inspection.customer_mobile}</div>
                        </div>
                      </div>
                    </td>
                    
                    {/* Vehicle Column - Editable */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <div>
                          <div className="text-sm font-mono text-blue-600">{inspection.car_number || '-'}</div>
                          {(inspection.car_make || inspection.car_model) && (
                            <div className="text-xs text-gray-400">{inspection.car_make} {inspection.car_model}</div>
                          )}
                        </div>
                        <button 
                          onClick={() => {
                            setVehicleEditInspection(inspection);
                            setNewVehicleNumber(inspection.car_number || '');
                            setVehicleData(null);
                            setIsVehicleModalOpen(true);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors flex-shrink-0"
                          title="Change Vehicle"
                          data-testid={`edit-vehicle-${inspection.id}`}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    
                    {/* Payment Status Column - With Collect Balance Button */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      {hasBalanceDue ? (
                        <div className="space-y-1">
                          <button 
                            onClick={() => {
                              setCollectBalanceInspection({
                                ...inspection,
                                balance_due: actualBalanceDue
                              });
                              setIsCollectBalanceModalOpen(true);
                            }}
                            className="px-2.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg text-xs font-medium hover:from-amber-600 hover:to-amber-700 transition-all shadow-sm flex items-center gap-1"
                            title={`Collect Balance: ₹${actualBalanceDue?.toLocaleString()}`}
                            data-testid={`collect-balance-${inspection.id}`}
                          >
                            <CreditCard className="h-3 w-3" />
                            Collect ₹{actualBalanceDue?.toLocaleString()}
                          </button>
                          <div className="text-xs text-gray-500">
                            Paid: ₹{(inspection.amount_paid || 0).toLocaleString()}
                          </div>
                        </div>
                      ) : (
                        <div>
                          <PaymentStatusBadge status={isFullyPaid ? 'FULLY_PAID' : inspection.payment_status} balanceDue={actualBalanceDue} />
                          <div className="text-xs text-gray-500 mt-1">
                            ₹{(inspection.amount_paid || 0).toLocaleString()}
                          </div>
                        </div>
                      )}
                    </td>
                    
                    {/* Inspection Status Column - Dropdown */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Select 
                        value={inspection.inspection_status} 
                        onValueChange={(value) => handleStatusChange(inspection.id, value)}
                      >
                        <SelectTrigger className="h-8 text-xs w-[145px] border-gray-200" data-testid={`status-select-${inspection.id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {INSPECTION_STATUSES.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              <span className={`px-2 py-0.5 rounded text-xs ${status.color}`}>
                                {status.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    
                    {/* Mechanic Column - Editable */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          {inspection.mechanic_name ? (
                            <div className="flex items-center gap-1.5">
                              <UserCheck className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                              <span className="text-sm text-gray-700">{inspection.mechanic_name}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400 italic">Not assigned</span>
                          )}
                        </div>
                        <button 
                          onClick={() => {
                            setMechanicEditInspection(inspection);
                            setSelectedMechanicId(inspection.mechanic_id || '');
                            setIsMechanicModalOpen(true);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors flex-shrink-0"
                          title={inspection.mechanic_name ? "Reassign Mechanic" : "Assign Mechanic"}
                          data-testid={`edit-mechanic-${inspection.id}`}
                        >
                          <User className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    
                    {/* Location Column */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1 text-sm text-blue-600">
                        <MapPin className="h-3.5 w-3.5" />
                        {inspection.city}
                      </span>
                    </td>
                    
                    {/* Inspection Report Column */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        {/* View Report button - opens in new tab */}
                        <button 
                          onClick={() => handleViewReport(inspection)}
                          disabled={!inspection.report_url}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                            inspection.report_url 
                              ? 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200' 
                              : 'bg-gray-50 text-gray-400 cursor-not-allowed border border-gray-200'
                          }`}
                          title={inspection.report_url ? 'View Report in new tab' : 'Report not available'}
                          data-testid={`view-report-${inspection.id}`}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Report
                        </button>
                        
                        {/* Send Report button - disabled until fully paid */}
                        {canSendReport && !inspection.report_url && (
                          <button 
                            onClick={() => handleSendReport(inspection)}
                            className="p-1.5 text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Send Report via WhatsApp"
                            data-testid={`send-report-${inspection.id}`}
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Edit Inspection Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[560px]" data-testid="inspection-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-blue-600" />
              {editingInspection ? 'Edit Inspection' : 'Schedule Inspection'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Customer Name *</Label>
                <Input value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Mobile *</Label>
                <Input value={formData.customer_mobile} onChange={(e) => setFormData({ ...formData, customer_mobile: e.target.value })} className="h-10 font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">City *</Label>
                <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select city" /></SelectTrigger>
                  <SelectContent>{cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Car Number</Label>
                <Input value={formData.car_number} onChange={(e) => setFormData({ ...formData, car_number: e.target.value })} className="h-10 font-mono" placeholder="KA-01-AB-1234" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Scheduled Date</Label>
                <Input type="date" value={formData.scheduled_date} onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })} className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Scheduled Time</Label>
                <Input type="time" value={formData.scheduled_time} onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })} className="h-10" />
              </div>
            </div>
            <div className="flex gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingInspection ? 'Update' : 'Schedule'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Collect Balance Confirmation Modal */}
      <Dialog open={isCollectBalanceModalOpen} onOpenChange={closeCollectBalanceModal}>
        <DialogContent className="sm:max-w-[500px]" data-testid="collect-balance-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-amber-600" />
              Collect Balance Payment
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-2">
              Generate a payment link to collect the remaining balance. You can send via WhatsApp or share offline.
            </DialogDescription>
          </DialogHeader>
          
          {collectBalanceInspection && (
            <div className="space-y-4 pt-4">
              {/* Customer Info Card */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium">
                    {collectBalanceInspection.customer_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{collectBalanceInspection.customer_name}</div>
                    <div className="text-sm text-gray-500 font-mono">{collectBalanceInspection.customer_mobile}</div>
                  </div>
                </div>
                
                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Package:</span>
                    <span className="font-medium">{collectBalanceInspection.package_type}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Vehicle:</span>
                    <span className="font-medium font-mono">{collectBalanceInspection.car_number || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total Amount:</span>
                    <span className="font-medium">₹{(collectBalanceInspection.total_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Already Paid:</span>
                    <span className="font-medium text-emerald-600">₹{(collectBalanceInspection.amount_paid || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2 mt-2">
                    <span className="text-gray-700 font-medium">Balance Due:</span>
                    <span className="font-bold text-amber-600 text-lg">₹{(collectBalanceInspection.balance_due || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              
              {/* Generated Payment Link Section */}
              {generatedPaymentLink ? (
                <div className="space-y-3">
                  {/* Payment Link Display */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
                    <div className="flex items-center gap-2 text-emerald-700 font-medium mb-2">
                      <CheckCircle className="h-4 w-4" />
                      Payment Link Generated
                      {generatedPaymentLink.whatsappSent && (
                        <span className="text-xs bg-emerald-100 px-2 py-0.5 rounded-full">WhatsApp Sent</span>
                      )}
                    </div>
                    
                    {/* Link URL */}
                    <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-emerald-200">
                      <Link2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <input 
                        type="text" 
                        value={generatedPaymentLink.url || ''} 
                        readOnly 
                        className="flex-1 text-sm text-gray-700 bg-transparent outline-none font-mono truncate"
                      />
                      <button
                        onClick={handleCopyPaymentLink}
                        className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                        title="Copy link"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <a
                        href={generatedPaymentLink.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Open link"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </div>
                  </div>
                  
                  {/* Check Payment Status Section */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-700">Check Payment Status</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleCheckPaymentStatus}
                        disabled={checkingPaymentStatus}
                        className="h-8 text-xs"
                      >
                        {checkingPaymentStatus ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <RefreshCw className="h-3 w-3 mr-1" />
                        )}
                        Check Status
                      </Button>
                    </div>
                    
                    {paymentLinkStatus && (
                      <div className="mt-2 p-2 bg-white rounded border border-blue-100">
                        <div className="flex items-center gap-2">
                          {paymentLinkStatus.status === 'PAID' ? (
                            <>
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                              <span className="text-sm font-medium text-emerald-700">Payment Received!</span>
                            </>
                          ) : (
                            <>
                              <Clock className="h-4 w-4 text-amber-500" />
                              <span className="text-sm font-medium text-amber-700">Payment Pending</span>
                            </>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          Last checked: {paymentLinkStatus.lastUpdated}
                          {paymentLinkStatus.status !== 'PAID' && (
                            <span className="ml-2">• Balance: ₹{paymentLinkStatus.balanceDue?.toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <p>A payment link for <strong>₹{(collectBalanceInspection.balance_due || 0).toLocaleString()}</strong> will be generated. Choose to send via WhatsApp or generate for offline sharing.</p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="border-t pt-4 mt-4 flex-wrap gap-2">
            <Button 
              type="button" 
              variant="outline" 
              onClick={closeCollectBalanceModal}
              disabled={collectingBalance}
            >
              {generatedPaymentLink ? 'Close' : 'Cancel'}
            </Button>
            
            {!generatedPaymentLink && (
              <>
                <Button 
                  onClick={() => handleCollectBalance(false)}
                  disabled={collectingBalance}
                  variant="outline"
                  className="border-amber-300 text-amber-700 hover:bg-amber-50"
                  data-testid="generate-link-only"
                >
                  {collectingBalance && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  <Link2 className="h-4 w-4 mr-2" />
                  Generate Link Only
                </Button>
                <Button 
                  onClick={() => handleCollectBalance(true)}
                  disabled={collectingBalance}
                  className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                  data-testid="confirm-collect-balance"
                >
                  {collectingBalance && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  <Send className="h-4 w-4 mr-2" />
                  Send via WhatsApp
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Vehicle Edit Modal */}
      <Dialog open={isVehicleModalOpen} onOpenChange={setIsVehicleModalOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="vehicle-edit-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2">
              <Car className="h-5 w-5 text-blue-600" />
              Change Vehicle
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-2">
              Update the vehicle for this inspection. Use Vaahan API to fetch vehicle details.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            {vehicleEditInspection && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <span className="text-gray-500">Current Vehicle: </span>
                <span className="font-mono font-medium">{vehicleEditInspection.car_number || 'Not set'}</span>
                {vehicleEditInspection.car_make && (
                  <span className="text-gray-500 ml-2">({vehicleEditInspection.car_make} {vehicleEditInspection.car_model})</span>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">New Vehicle Number</Label>
              <div className="flex gap-2">
                <Input 
                  value={newVehicleNumber} 
                  onChange={(e) => setNewVehicleNumber(e.target.value.toUpperCase())}
                  placeholder="KA01AB1234"
                  className="flex-1 font-mono"
                />
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={handleVehicleSearch}
                  disabled={vehicleSearching}
                >
                  {vehicleSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </Button>
              </div>
            </div>
            
            {vehicleData && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-medium">
                  <CheckCircle className="h-4 w-4" />
                  Vehicle Found
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Make:</span> <span className="font-medium">{extractMake(vehicleData.manufacturer || vehicleData.make) || '-'}</span></div>
                  <div><span className="text-gray-500">Model:</span> <span className="font-medium">{extractModel(vehicleData.model) || '-'}</span></div>
                  <div><span className="text-gray-500">Year:</span> <span className="font-medium">{vehicleData.manufacturing_date?.split('/')?.pop() || vehicleData.year || '-'}</span></div>
                  <div><span className="text-gray-500">Color:</span> <span className="font-medium">{vehicleData.color || '-'}</span></div>
                  <div><span className="text-gray-500">Fuel:</span> <span className="font-medium">{vehicleData.fuel_type || '-'}</span></div>
                  <div><span className="text-gray-500">Owner:</span> <span className="font-medium">{vehicleData.owner_name || '-'}</span></div>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="border-t pt-4 mt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setIsVehicleModalOpen(false);
                setVehicleEditInspection(null);
                setVehicleData(null);
                setNewVehicleNumber('');
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleVehicleUpdate}
              disabled={saving || !newVehicleNumber}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Update Vehicle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Edit Modal */}
      <Dialog open={isScheduleModalOpen} onOpenChange={setIsScheduleModalOpen}>
        <DialogContent className="sm:max-w-[400px]" data-testid="schedule-edit-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-blue-600" />
              Change Schedule
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-2">
              Update the inspection date and time.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            {scheduleEditInspection && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <span className="text-gray-500">Customer: </span>
                <span className="font-medium">{scheduleEditInspection.customer_name}</span>
                <span className="text-gray-500 ml-2">({scheduleEditInspection.car_number})</span>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Date</Label>
                <Input 
                  type="date" 
                  value={newScheduleDate} 
                  onChange={(e) => setNewScheduleDate(e.target.value)}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Time</Label>
                <Input 
                  type="time" 
                  value={newScheduleTime} 
                  onChange={(e) => setNewScheduleTime(e.target.value)}
                  className="h-10"
                />
              </div>
            </div>
          </div>
          
          <DialogFooter className="border-t pt-4 mt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setIsScheduleModalOpen(false);
                setScheduleEditInspection(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleScheduleUpdate}
              disabled={saving || !newScheduleDate || !newScheduleTime}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Update Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mechanic Assignment Modal */}
      <Dialog open={isMechanicModalOpen} onOpenChange={setIsMechanicModalOpen}>
        <DialogContent className="sm:max-w-[400px]" data-testid="mechanic-assign-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-blue-600" />
              {mechanicEditInspection?.mechanic_id ? 'Reassign Mechanic' : 'Assign Mechanic'}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-2">
              Select a mechanic for this inspection or leave empty to unassign.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            {mechanicEditInspection && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <span className="text-gray-500">Inspection: </span>
                <span className="font-medium">{mechanicEditInspection.customer_name}</span>
                <span className="text-gray-500 ml-2">({mechanicEditInspection.car_number})</span>
                {mechanicEditInspection.mechanic_name && (
                  <div className="mt-1 text-amber-600">
                    Currently assigned: {mechanicEditInspection.mechanic_name}
                  </div>
                )}
              </div>
            )}
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Select Mechanic</Label>
              <Select value={selectedMechanicId} onValueChange={setSelectedMechanicId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select mechanic..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassign">
                    <span className="text-gray-500 italic">-- Unassign --</span>
                  </SelectItem>
                  {mechanics.map((mechanic) => (
                    <SelectItem key={mechanic.id} value={mechanic.id}>
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-emerald-500" />
                        {mechanic.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {mechanics.length === 0 && (
                <p className="text-xs text-gray-500">No mechanics available. Add mechanics in HR Module.</p>
              )}
            </div>
          </div>
          
          <DialogFooter className="border-t pt-4 mt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setIsMechanicModalOpen(false);
                setMechanicEditInspection(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleMechanicAssign}
              disabled={saving}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {selectedMechanicId && selectedMechanicId !== 'unassign' ? 'Assign' : 'Unassign'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
