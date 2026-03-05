import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { inspectionsApi, utilityApi, vehicleApi, mechanicsApi, smsLogsApi, citiesApi } from '@/services/api';
import { formatDate, formatTime, formatDateTime, getToday, formatDateForInput, parseDateFromInput, getStartOfWeek, getEndOfWeek, getStartOfMonth, getEndOfMonth, getStartOfYear, getEndOfYear, formatDateForDisplay } from '@/utils/dateFormat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { PlacesAutocomplete } from '@/components/ui/PlacesAutocomplete';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Search, Loader2, ClipboardCheck, Filter, Calendar, MapPin, 
  Car, User, Download, Eye, Edit2, Clock, CheckCircle, XCircle, 
  AlertCircle, Play, Plus, Send, CreditCard, DollarSign, FileText,
  UserCheck, CalendarClock, RefreshCw, Ban, Copy, ExternalLink, Link2, X,
  StickyNote, Activity, Phone, Mail, MessageSquare, Wallet, TrendingUp, MoreHorizontal,
  ChevronRight, ClipboardList, History, Save, Pencil, Upload, Image, Video
} from 'lucide-react';
import LiveProgressModal from '@/components/LiveProgressModal';

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
  { value: 'NEW_INSPECTION', label: 'New', color: 'bg-slate-100 text-slate-800', requiresMechanic: false },
  { value: 'ASSIGNED_TO_MECHANIC', label: 'Assigned', color: 'bg-indigo-100 text-indigo-800', requiresMechanic: true },
  { value: 'MECHANIC_ACCEPTED', label: 'Accepted', color: 'bg-cyan-100 text-cyan-800', requiresMechanic: true },
  { value: 'MECHANIC_REJECTED', label: 'Rejected', color: 'bg-rose-100 text-rose-800', requiresMechanic: false },
  { value: 'INSPECTION_STARTED', label: 'In Progress', color: 'bg-amber-100 text-amber-800', requiresMechanic: true },
  { value: 'INSPECTION_COMPLETED', label: 'Completed', color: 'bg-emerald-100 text-emerald-800', requiresMechanic: true },
  { value: 'RESCHEDULED', label: 'Rescheduled', color: 'bg-purple-100 text-purple-800', requiresMechanic: false },
  { value: 'INSPECTION_CANCELLED_CUS', label: 'Cancelled', color: 'bg-red-100 text-red-800', requiresMechanic: false },
  { value: 'INSPECTION_CANCELLED_WD', label: 'Cancelled (WD)', color: 'bg-red-100 text-red-800', requiresMechanic: false },
];

// Statuses that require a mechanic to be assigned
const MECHANIC_REQUIRED_STATUSES = [
  'ASSIGNED_TO_MECHANIC', 'MECHANIC_ACCEPTED', 'INSPECTION_STARTED', 'INSPECTION_COMPLETED'
];

// Inspection Status Badge Component
const InspectionStatusBadge = ({ status }) => {
  const config = {
    NEW_INSPECTION: { color: 'bg-slate-100 text-slate-800 border-slate-200', icon: Plus, label: 'New' },
    ASSIGNED_TO_MECHANIC: { color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: User, label: 'Assigned' },
    MECHANIC_ACCEPTED: { color: 'bg-cyan-100 text-cyan-800 border-cyan-200', icon: CheckCircle, label: 'Accepted' },
    MECHANIC_REJECTED: { color: 'bg-rose-100 text-rose-800 border-rose-200', icon: XCircle, label: 'Rejected' },
    INSPECTION_STARTED: { color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Play, label: 'In Progress' },
    INSPECTION_COMPLETED: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle, label: 'Completed' },
    RESCHEDULED: { color: 'bg-purple-100 text-purple-800 border-purple-200', icon: RefreshCw, label: 'Rescheduled' },
    INSPECTION_CANCELLED_CUS: { color: 'bg-red-100 text-red-800 border-red-200', icon: Ban, label: 'Cancelled' },
    INSPECTION_CANCELLED_WD: { color: 'bg-red-100 text-red-800 border-red-200', icon: Ban, label: 'Cancelled (WD)' },
    SCHEDULED: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Calendar, label: 'Scheduled' },
    UNSCHEDULED: { color: 'bg-purple-100 text-purple-800 border-purple-200', icon: AlertCircle, label: 'Unscheduled' },
  };
  const cfg = config[status] || config.NEW_INSPECTION;
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
const SummaryCard = ({ title, value, icon: Icon, color, subtitle, onClick, active }) => (
  <div 
    className={`rounded-xl border bg-white p-5 transition-all cursor-pointer hover:shadow-md ${active ? 'ring-2 ring-blue-500 shadow-md' : ''}`}
    onClick={onClick}
    role="button"
    tabIndex={0}
  >
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
        color?.includes('purple') ? 'from-purple-500 to-purple-600' :
        'from-gray-500 to-gray-600'
      }`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
    </div>
  </div>
);

export default function InspectionsPage() {
  const { user } = useAuth();
  const [inspections, setInspections] = useState([]);
  const [mechanics, setMechanics] = useState([]);
  const [cities, setCities] = useState([]);
  const [cityAliasMap, setCityAliasMap] = useState({}); // Maps aliases to canonical city names
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInspection, setEditingInspection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('scheduled');
  const [cardFilter, setCardFilter] = useState(null); // 'total', 'scheduled', 'completed', 'new'

  // Date Range Filter State
  const [dateRangeType, setDateRangeType] = useState('month'); // 'today', 'week', 'month', 'year', 'custom'
  const [dateFrom, setDateFrom] = useState(getToday());
  const [dateTo, setDateTo] = useState(getToday());

  // Modal states
  const [isCollectBalanceModalOpen, setIsCollectBalanceModalOpen] = useState(false);
  const [collectBalanceInspection, setCollectBalanceInspection] = useState(null);
  const [collectingBalance, setCollectingBalance] = useState(false);
  const [generatedPaymentLink, setGeneratedPaymentLink] = useState(null);
  const [checkingPaymentStatus, setCheckingPaymentStatus] = useState(false);
  const [paymentLinkStatus, setPaymentLinkStatus] = useState(null);
  
  // Payment Details Modal (NEW - simplified payment view)
  const [isPaymentDetailsModalOpen, setIsPaymentDetailsModalOpen] = useState(false);
  const [paymentDetailsInspection, setPaymentDetailsInspection] = useState(null);
  const [creatingPaymentLink, setCreatingPaymentLink] = useState(false);
  const [paymentLink, setPaymentLink] = useState(null);
  
  // Notes & Activity Drawer
  const [isNotesDrawerOpen, setIsNotesDrawerOpen] = useState(false);
  const [notesInspection, setNotesInspection] = useState(null);
  const [notesTab, setNotesTab] = useState('notes');
  const [inspectionNotes, setInspectionNotes] = useState([]);
  const [inspectionActivities, setInspectionActivities] = useState([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  
  // SMS Logs
  const [smsLogs, setSmsLogs] = useState([]);
  const [smsStats, setSmsStats] = useState(null);
  const [loadingSmsLogs, setLoadingSmsLogs] = useState(false);
  
  // Vehicle Edit Modal
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [vehicleEditInspection, setVehicleEditInspection] = useState(null);
  const [vehicleSearching, setVehicleSearching] = useState(false);
  const [vehicleData, setVehicleData] = useState(null);
  const [newVehicleNumber, setNewVehicleNumber] = useState('');
  
  // Schedule Edit Modal (for existing scheduled inspections)
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [scheduleEditInspection, setScheduleEditInspection] = useState(null);
  const [newScheduleDate, setNewScheduleDate] = useState('');
  const [newScheduleTime, setNewScheduleTime] = useState('');
  
  // Mechanic Assign Modal
  const [isMechanicModalOpen, setIsMechanicModalOpen] = useState(false);
  const [mechanicEditInspection, setMechanicEditInspection] = useState(null);
  const [selectedMechanicId, setSelectedMechanicId] = useState('');
  
  // Location Edit Modal
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [locationEditInspection, setLocationEditInspection] = useState(null);
  const [locationFormData, setLocationFormData] = useState({
    address: '',
    city: '',
    latitude: null,
    longitude: null
  });
  const [locationSaving, setLocationSaving] = useState(false);
  
  // Live Progress Modal
  const [isLiveProgressModalOpen, setIsLiveProgressModalOpen] = useState(false);
  const [liveProgressInspection, setLiveProgressInspection] = useState(null);
  const [liveProgressData, setLiveProgressData] = useState(null);
  const [liveProgressLoading, setLiveProgressLoading] = useState(false);
  const [liveProgressAutoRefresh, setLiveProgressAutoRefresh] = useState(false);
  
  // Roles allowed to edit answers
  const ANSWER_EDIT_ALLOWED_ROLES = ["CEO", "INSPECTION_COORDINATOR", "INSPECTION_HEAD", "COUNTRY_HEAD_CE", "COUNTRY_HEAD"];
  const canEditAnswers = user?.role_code && ANSWER_EDIT_ALLOWED_ROLES.includes(user.role_code);
  
  // Schedule Unscheduled Inspection Modal (NEW - with Vaahan API & Google Places)
  const [isScheduleUnscheduledModalOpen, setIsScheduleUnscheduledModalOpen] = useState(false);
  const [scheduleUnscheduledInspection, setScheduleUnscheduledInspection] = useState(null);
  const [scheduleFormData, setScheduleFormData] = useState({
    car_number: '',
    scheduled_date: '',
    scheduled_time: '',
    city: '',
    address: ''
  });
  const [scheduleVehicleData, setScheduleVehicleData] = useState(null);
  const [scheduleVehicleSearching, setScheduleVehicleSearching] = useState(false);
  const [scheduleSaving, setScheduleSaving] = useState(false);

  // Combined Edit Inspection Modal State
  const [isEditInspectionModalOpen, setIsEditInspectionModalOpen] = useState(false);
  const [editInspectionData, setEditInspectionData] = useState(null);
  const [editInspectionFormData, setEditInspectionFormData] = useState({
    scheduled_date: '',
    scheduled_time: '',
    address: '',
    city: '',
    latitude: null,
    longitude: null,
    car_number: '',
  });
  const [editInspectionSaving, setEditInspectionSaving] = useState(false);
  const [editVehicleSearching, setEditVehicleSearching] = useState(false);
  const [editVehicleData, setEditVehicleData] = useState(null);

  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPayment, setFilterPayment] = useState('');

  const [formData, setFormData] = useState({
    customer_name: '', customer_mobile: '', address: '', city: '',
    payment_status: 'PENDING', inspection_status: 'SCHEDULED',
    mechanic_name: '', car_number: '', car_details: '',
    scheduled_date: '', scheduled_time: '', notes: '',
  });
  
  // Calculate date range based on dateRangeType - TIMEZONE AWARE
  const getDateRange = useCallback(() => {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    switch (dateRangeType) {
      case 'today': {
        return { from: getToday(), to: getToday() };
      }
      case 'last_7_days': {
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 6);
        return { from: sevenDaysAgo.toISOString().split('T')[0], to: todayStr };
      }
      case 'last_14_days': {
        const fourteenDaysAgo = new Date(today);
        fourteenDaysAgo.setDate(today.getDate() - 13);
        return { from: fourteenDaysAgo.toISOString().split('T')[0], to: todayStr };
      }
      case 'week':
        return { from: getStartOfWeek(), to: getEndOfWeek() };
      case 'month':
        return { from: getStartOfMonth(), to: getEndOfMonth() };
      case 'year':
        return { from: getStartOfYear(), to: getEndOfYear() };
      case 'custom':
        return { from: dateFrom, to: dateTo };
      default: {
        return { from: getToday(), to: getToday() };
      }
    }
  }, [dateRangeType, dateFrom, dateTo]);

  // Fetch mechanics list
  const fetchMechanics = useCallback(async () => {
    try {
      const response = await mechanicsApi.getAll();
      setMechanics(response.data || []);
    } catch (error) {
      console.error('Failed to load mechanics:', error);
    }
  }, []);
  
  // Fetch city alias map for mechanic matching
  const fetchCityAliases = useCallback(async () => {
    try {
      const response = await citiesApi.getAll();
      const citiesData = response.data || [];
      
      // Build a map: { alias.toLowerCase() => canonicalCityName.toLowerCase() }
      // And also: { canonicalCityName.toLowerCase() => [all valid names including aliases] }
      const aliasMap = {};
      citiesData.forEach(city => {
        const canonical = city.name?.toLowerCase()?.trim();
        if (!canonical) return;
        
        // Map the canonical name to itself
        aliasMap[canonical] = canonical;
        
        // Map each alias to the canonical name
        const aliases = city.aliases || [];
        aliases.forEach(alias => {
          if (alias) {
            aliasMap[alias.toLowerCase().trim()] = canonical;
          }
        });
      });
      
      setCityAliasMap(aliasMap);
      console.log('City alias map loaded:', Object.keys(aliasMap).length, 'entries');
    } catch (error) {
      console.error('Failed to load city aliases:', error);
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

  // Close Payment Details Modal
  const closePaymentDetailsModal = () => {
    setIsPaymentDetailsModalOpen(false);
    setPaymentDetailsInspection(null);
    setPaymentLink(null);
  };

  // Open Payment Details Modal - check for existing payment link
  const openPaymentDetailsModal = (inspection) => {
    setPaymentDetailsInspection(inspection);
    // Check if inspection already has a payment link
    if (inspection.balance_payment_link_url) {
      setPaymentLink({
        url: inspection.balance_payment_link_url,
        linkId: inspection.balance_payment_link_id,
        whatsappSent: false,
        isExisting: true
      });
    } else {
      setPaymentLink(null);
    }
    setIsPaymentDetailsModalOpen(true);
  };

  // Check payment status for existing payment link
  const handleCheckPaymentLinkStatus = async () => {
    if (!paymentDetailsInspection || !paymentLink?.linkId) {
      toast.error('No payment link to check');
      return;
    }
    
    setCheckingPaymentStatus(true);
    try {
      const response = await inspectionsApi.checkPaymentStatus(paymentDetailsInspection.id, paymentLink.linkId);
      const { payment_status, amount_paid, balance_due } = response.data;
      
      if (payment_status === 'FULLY_PAID' || payment_status === 'PAID') {
        toast.success('Payment received! Balance has been cleared.');
        // Update the local state
        setPaymentDetailsInspection(prev => ({
          ...prev,
          amount_paid: amount_paid,
          balance_due: balance_due,
          payment_status: payment_status
        }));
        // Refresh the data
        fetchData();
      } else if (payment_status === 'PARTIALLY_PAID') {
        toast.info(`Partial payment received. New balance: ₹${balance_due?.toLocaleString()}`);
        setPaymentDetailsInspection(prev => ({
          ...prev,
          amount_paid: amount_paid,
          balance_due: balance_due,
          payment_status: payment_status
        }));
        fetchData();
      } else {
        toast.info('Payment is still pending');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to check payment status');
    } finally {
      setCheckingPaymentStatus(false);
    }
  };

  // Create Payment Link for pending amount
  const handleCreatePaymentLink = async (sendViaWhatsApp = false) => {
    if (!paymentDetailsInspection) return;
    
    const pendingAmount = paymentDetailsInspection.balance_due || paymentDetailsInspection.pending_amount || 0;
    if (pendingAmount <= 0) {
      toast.error('No pending amount to collect');
      return;
    }

    setCreatingPaymentLink(true);
    try {
      const response = await inspectionsApi.collectBalance(paymentDetailsInspection.id, {
        amount: pendingAmount,
        send_via_whatsapp: sendViaWhatsApp
      });
      
      setPaymentLink({
        url: response.data?.payment_link,
        linkId: response.data?.payment_link_id,
        whatsappSent: sendViaWhatsApp,
        isExisting: false
      });
      
      // Update the inspection record with the new link
      setPaymentDetailsInspection(prev => ({
        ...prev,
        balance_payment_link_url: response.data?.payment_link,
        balance_payment_link_id: response.data?.payment_link_id
      }));
      
      if (sendViaWhatsApp) {
        toast.success('Payment link sent via WhatsApp!');
      } else {
        toast.success('Payment link generated successfully!');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate payment link');
    } finally {
      setCreatingPaymentLink(false);
    }
  };

  // Copy payment link from payment details modal
  const handleCopyPaymentDetailsLink = () => {
    if (paymentLink?.url) {
      navigator.clipboard.writeText(paymentLink.url);
      toast.success('Payment link copied to clipboard!');
    }
  };

  // Share payment link via WhatsApp from payment details modal
  const handleSharePaymentViaWhatsApp = () => {
    if (!paymentLink?.url || !paymentDetailsInspection) return;
    
    const message = `Hi ${paymentDetailsInspection.customer_name}, please use this link to pay the pending amount of ₹${(paymentDetailsInspection.balance_due || paymentDetailsInspection.pending_amount || 0).toLocaleString()}: ${paymentLink.url}`;
    const whatsappUrl = `https://wa.me/${paymentDetailsInspection.customer_mobile?.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  // Open Notes/Activity Drawer
  const openNotesDrawer = async (inspection) => {
    setNotesInspection(inspection);
    setNotesTab('notes');
    setIsNotesDrawerOpen(true);
    await fetchNotesAndActivities(inspection.id);
  };

  // Fetch notes and activities for an inspection
  const fetchNotesAndActivities = async (inspectionId) => {
    setLoadingNotes(true);
    try {
      const [notesRes, activitiesRes] = await Promise.all([
        inspectionsApi.getNotes(inspectionId),
        inspectionsApi.getActivities(inspectionId)
      ]);
      setInspectionNotes(notesRes.data || []);
      setInspectionActivities(activitiesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch notes/activities:', error);
      toast.error('Failed to load notes and activities');
    } finally {
      setLoadingNotes(false);
    }
  };

  // Add a note
  const handleAddNote = async () => {
    if (!notesInspection || !newNote.trim()) return;
    
    setSavingNote(true);
    try {
      const response = await inspectionsApi.addNote(notesInspection.id, { note: newNote.trim() });
      setInspectionNotes(prev => [response.data, ...prev]);
      setNewNote('');
      toast.success('Note added successfully');
      // Refresh activities to show the note_added activity
      const activitiesRes = await inspectionsApi.getActivities(notesInspection.id);
      setInspectionActivities(activitiesRes.data || []);
    } catch (error) {
      toast.error('Failed to add note');
    } finally {
      setSavingNote(false);
    }
  };

  // Close Notes Drawer
  const closeNotesDrawer = () => {
    setIsNotesDrawerOpen(false);
    setNotesInspection(null);
    setInspectionNotes([]);
    setInspectionActivities([]);
    setSmsLogs([]);
    setSmsStats(null);
    setNewNote('');
  };

  // Fetch SMS Logs
  const fetchSmsLogs = async () => {
    setLoadingSmsLogs(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        smsLogsApi.getLogs({ limit: 100 }),
        smsLogsApi.getStats()
      ]);
      setSmsLogs(logsRes.data?.logs || []);
      setSmsStats(statsRes.data || null);
    } catch (error) {
      console.error('Failed to fetch SMS logs:', error);
      toast.error('Failed to load SMS logs');
    } finally {
      setLoadingSmsLogs(false);
    }
  };

  // Handle tab change - fetch SMS logs when switching to SMS tab
  const handleNotesTabChange = (value) => {
    setNotesTab(value);
    if (value === 'sms' && smsLogs.length === 0) {
      fetchSmsLogs();
    }
  };

  // Handle View Report - opens in new tab
  const handleViewReport = (inspection) => {
    // Open the inspection report page in a new tab
    const reportUrl = `${window.location.origin}/inspection-report/${inspection.id}`;
    window.open(reportUrl, '_blank');
  };

  // Handle Status Change
  const handleStatusChange = async (inspectionId, newStatus) => {
    // Find the inspection to check if it has a mechanic
    const inspection = inspections.find(i => i.id === inspectionId);
    
    // Check if the new status requires a mechanic
    if (MECHANIC_REQUIRED_STATUSES.includes(newStatus)) {
      if (!inspection?.mechanic_id) {
        toast.error(`Cannot change status to "${INSPECTION_STATUSES.find(s => s.value === newStatus)?.label || newStatus}". Please assign a mechanic first.`);
        return;
      }
    }
    
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
        // Save extracted clean make/model names
        updateData.car_make = extractMake(vehicleData.manufacturer || vehicleData.make) || '';
        updateData.car_model = extractModel(vehicleData.model) || '';
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

  // Handle Location Update
  const handleLocationUpdate = async () => {
    if (!locationEditInspection) return;
    
    setLocationSaving(true);
    try {
      await inspectionsApi.updateLocation(locationEditInspection.id, {
        address: locationFormData.address,
        city: locationFormData.city,
        latitude: locationFormData.latitude,
        longitude: locationFormData.longitude
      });
      toast.success('Inspection location updated successfully!');
      setIsLocationModalOpen(false);
      setLocationEditInspection(null);
      setLocationFormData({ address: '', city: '', latitude: null, longitude: null });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update location');
    } finally {
      setLocationSaving(false);
    }
  };

  // Handle Combined Edit Inspection (Date/Time, Location, Vehicle)
  useEffect(() => {
    if (editInspectionData) {
      setEditInspectionFormData({
        scheduled_date: editInspectionData.scheduled_date || '',
        scheduled_time: editInspectionData.scheduled_time || '',
        address: editInspectionData.address || '',
        city: editInspectionData.city || '',
        latitude: editInspectionData.latitude || null,
        longitude: editInspectionData.longitude || null,
        car_number: editInspectionData.car_number || '',
      });
      setEditVehicleData(null);
    }
  }, [editInspectionData]);

  const handleEditInspectionSave = async () => {
    if (!editInspectionData) return;
    
    setEditInspectionSaving(true);
    try {
      // Update schedule
      if (editInspectionFormData.scheduled_date || editInspectionFormData.scheduled_time) {
        await inspectionsApi.updateSchedule(editInspectionData.id, {
          scheduled_date: editInspectionFormData.scheduled_date,
          scheduled_time: editInspectionFormData.scheduled_time
        });
      }
      
      // Update location if address or city changed
      const addressChanged = editInspectionFormData.address !== editInspectionData.address;
      const cityChanged = editInspectionFormData.city !== editInspectionData.city;
      
      if (addressChanged || cityChanged) {
        // Always send both address and city to ensure proper update
        await inspectionsApi.updateLocation(editInspectionData.id, {
          address: editInspectionFormData.address || editInspectionData.address,
          city: editInspectionFormData.city,
          latitude: editInspectionFormData.latitude,
          longitude: editInspectionFormData.longitude
        });
      }
      
      // Update vehicle if changed
      if (editInspectionFormData.car_number !== editInspectionData.car_number && editInspectionFormData.car_number) {
        await inspectionsApi.updateVehicle(editInspectionData.id, {
          car_number: editInspectionFormData.car_number,
          car_make: editVehicleData?.manufacturer || '',
          car_model: editVehicleData?.model || '',
          car_details: editVehicleData || null
        });
      }
      
      toast.success('Inspection updated successfully!');
      setIsEditInspectionModalOpen(false);
      setEditInspectionData(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update inspection');
    } finally {
      setEditInspectionSaving(false);
    }
  };

  const handleEditVehicleSearch = async () => {
    if (!editInspectionFormData.car_number || editInspectionFormData.car_number.length < 6) {
      toast.error('Please enter a valid vehicle number');
      return;
    }
    
    setEditVehicleSearching(true);
    try {
      const response = await vehicleApi.getDetails(editInspectionFormData.car_number.toUpperCase().replace(/\s/g, ''));
      if (response.data?.success && response.data?.data) {
        setEditVehicleData(response.data.data);
        toast.success('Vehicle details found!');
      } else {
        toast.error('Vehicle not found in Vaahan database');
        setEditVehicleData(null);
      }
    } catch (error) {
      toast.error('Vehicle not found in Vaahan database');
      setEditVehicleData(null);
    } finally {
      setEditVehicleSearching(false);
    }
  };

  // Handle Live Progress View
  const fetchLiveProgress = async (inspectionId) => {
    setLiveProgressLoading(true);
    try {
      const response = await inspectionsApi.getLiveProgress(inspectionId);
      setLiveProgressData(response.data);
    } catch (error) {
      toast.error('Failed to load inspection progress');
      console.error('Error fetching live progress:', error);
    } finally {
      setLiveProgressLoading(false);
    }
  };

  const openLiveProgressModal = (inspection) => {
    setLiveProgressInspection(inspection);
    setIsLiveProgressModalOpen(true);
    fetchLiveProgress(inspection.id);
  };

  // Auto-refresh effect for live progress
  useEffect(() => {
    let interval;
    if (isLiveProgressModalOpen && liveProgressAutoRefresh && liveProgressInspection) {
      interval = setInterval(() => {
        fetchLiveProgress(liveProgressInspection.id);
      }, 5000); // Refresh every 5 seconds
    }
    return () => clearInterval(interval);
  }, [isLiveProgressModalOpen, liveProgressAutoRefresh, liveProgressInspection]);

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
      setLoading(true);
      const params = {};
      if (search) params.search = search;
      if (filterCity && filterCity !== 'all') params.city = filterCity;
      if (filterStatus && filterStatus !== 'all') params.inspection_status = filterStatus;
      params.is_scheduled = activeTab === 'scheduled';
      
      // Add date range filtering
      const { from, to } = getDateRange();
      if (from) params.date_from = from;
      if (to) params.date_to = to;

      const [inspectionsRes, citiesRes] = await Promise.all([
        inspectionsApi.getAll(params), utilityApi.getCities(),
      ]);

      setInspections(inspectionsRes.data || []);
      setCities(citiesRes.data || []);
    } catch (error) {
      toast.error('Failed to load inspections');
    } finally {
      setLoading(false);
    }
  }, [search, filterCity, filterStatus, activeTab, getDateRange]);

  useEffect(() => { fetchData(); fetchMechanics(); fetchCityAliases(); }, [fetchData, fetchMechanics, fetchCityAliases]);

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

  // Open Schedule Modal for Unscheduled Inspection
  const openScheduleUnscheduledModal = (inspection) => {
    setScheduleUnscheduledInspection(inspection);
    
    // Pre-fill with today's date and current time (rounded to next 30 min)
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Round to next 30 minutes
    const minutes = now.getMinutes();
    const roundedMinutes = minutes < 30 ? 30 : 0;
    const hours = minutes < 30 ? now.getHours() : now.getHours() + 1;
    const timeStr = `${hours.toString().padStart(2, '0')}:${roundedMinutes.toString().padStart(2, '0')}`;
    
    setScheduleFormData({
      car_number: inspection.car_number || '',
      scheduled_date: today,
      scheduled_time: timeStr,
      city: inspection.city || '',
      address: inspection.address || ''
    });
    setScheduleVehicleData(null);
    setIsScheduleUnscheduledModalOpen(true);
  };
  
  // Search vehicle for schedule modal (Vaahan API)
  const handleScheduleVehicleSearch = async () => {
    if (!scheduleFormData.car_number || scheduleFormData.car_number.length < 6) {
      toast.error('Please enter a valid vehicle number');
      return;
    }
    
    setScheduleVehicleSearching(true);
    try {
      const response = await vehicleApi.getDetails(scheduleFormData.car_number.toUpperCase().replace(/\s/g, ''));
      const vehicle = response.data?.data || response.data;
      if (vehicle && (vehicle.manufacturer || vehicle.model || vehicle.registration_number)) {
        setScheduleVehicleData(vehicle);
        toast.success('Vehicle details found!');
      } else {
        toast.info('Vehicle not found in database. You can proceed manually.');
        setScheduleVehicleData(null);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || '';
      if (errorMsg.includes('Inconvenience') || errorMsg.includes('not found')) {
        toast.info('Vehicle not found in RC database. You can proceed manually.');
      } else {
        toast.error('Unable to fetch vehicle details. You can proceed manually.');
      }
      setScheduleVehicleData(null);
    } finally {
      setScheduleVehicleSearching(false);
    }
  };
  
  // Submit Schedule for Unscheduled Inspection
  const handleScheduleUnscheduledSubmit = async () => {
    if (!scheduleUnscheduledInspection) return;
    
    // Trim whitespace and check for empty strings
    const dateValue = scheduleFormData.scheduled_date?.trim();
    const timeValue = scheduleFormData.scheduled_time?.trim();
    
    if (!dateValue || !timeValue) {
      toast.error('Please select date and time');
      return;
    }
    if (!scheduleFormData.city) {
      toast.error('Please select a city');
      return;
    }
    
    setScheduleSaving(true);
    try {
      const updateData = {
        scheduled_date: scheduleFormData.scheduled_date,
        scheduled_time: scheduleFormData.scheduled_time,
        city: scheduleFormData.city,
        address: scheduleFormData.address,
        inspection_status: 'NEW_INSPECTION'
      };
      
      // Add vehicle data if searched
      if (scheduleFormData.car_number) {
        updateData.car_number = scheduleFormData.car_number.toUpperCase().replace(/\s/g, '');
      }
      if (scheduleVehicleData) {
        updateData.car_make = scheduleVehicleData.manufacturer || scheduleVehicleData.make || '';
        updateData.car_model = scheduleVehicleData.model || '';
        updateData.car_year = scheduleVehicleData.manufacturing_date?.split('/')?.pop() || scheduleVehicleData.year || '';
        updateData.car_color = scheduleVehicleData.color || '';
        updateData.fuel_type = scheduleVehicleData.fuel_type || '';
      }
      
      // Use the first available inspection_id from the group if multiple IDs exist
      const inspectionIdToSchedule = scheduleUnscheduledInspection.inspection_ids?.[0] || scheduleUnscheduledInspection.id;
      
      await inspectionsApi.updateSchedule(inspectionIdToSchedule, updateData);
      toast.success('Inspection scheduled successfully!');
      setIsScheduleUnscheduledModalOpen(false);
      setActiveTab('scheduled'); // Switch to scheduled tab
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to schedule inspection');
    } finally {
      setScheduleSaving(false);
    }
  };
  
  // Handle card click filter
  const handleCardClick = (filter) => {
    if (cardFilter === filter) {
      setCardFilter(null); // Toggle off
    } else {
      setCardFilter(filter);
    }
  };
  
  // Handle date range change
  const handleDateRangeChange = (type) => {
    setDateRangeType(type);
  };

  const unscheduledCount = inspections.filter(i => !i.scheduled_date).length;
  const scheduledCount = inspections.filter(i => i.scheduled_date).length;
  const completedCount = inspections.filter(i => i.inspection_status === 'INSPECTION_COMPLETED').length;
  const newInspectionsCount = inspections.filter(i => !i.inspection_status || i.inspection_status === 'NEW_INSPECTION').length;
  
  // Filter inspections based on cardFilter and payment filter
  const filteredInspections = inspections.filter(inspection => {
    // Card filter
    if (cardFilter) {
      switch (cardFilter) {
        case 'total':
          break;
        case 'scheduled':
          if (!inspection.scheduled_date) return false;
          break;
        case 'completed':
          if (inspection.inspection_status !== 'INSPECTION_COMPLETED') return false;
          break;
        case 'new':
          if (inspection.inspection_status && inspection.inspection_status !== 'NEW_INSPECTION') return false;
          break;
        default:
          break;
      }
    }
    
    // Payment filter
    if (filterPayment && filterPayment !== 'all') {
      const isPaid = inspection.payment_status === 'FULLY_PAID' || inspection.payment_status === 'PAID';
      if (filterPayment === 'paid' && !isPaid) return false;
      if (filterPayment === 'pending' && isPaid) return false;
    }
    
    return true;
  });

  return (
    <div className="p-4 max-w-full mx-auto" data-testid="inspections-page">
      {/* Full Page Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <p className="text-sm font-medium text-gray-600">Loading inspections...</p>
          </div>
        </div>
      )}

      {/* Page Header with Tabs */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inspections</h1>
          <p className="text-gray-500 mt-1">Manage and track all vehicle inspections</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setActiveTab('unscheduled'); setCardFilter(null); }}
            className={`px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all ${
              activeTab === 'unscheduled' 
                ? 'bg-gray-900 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            data-testid="unscheduled-tab"
          >
            <AlertCircle className="h-4 w-4" />
            Unscheduled ({unscheduledCount})
          </button>
          <button
            onClick={() => { setActiveTab('scheduled'); setCardFilter(null); }}
            className={`px-5 py-2.5 rounded-xl font-medium flex items-center gap-2 transition-all ${
              activeTab === 'scheduled' 
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-lg shadow-amber-500/25' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            data-testid="scheduled-tab"
          >
            <Calendar className="h-4 w-4" />
            Scheduled ({scheduledCount})
          </button>
        </div>
      </div>

      {/* Date Range Quick Selectors */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <span className="text-sm font-medium text-gray-600">Show:</span>
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
          {[
            { key: 'today', label: 'Today' },
            { key: 'last_7_days', label: 'Last 7 Days' },
            { key: 'last_14_days', label: 'Last 14 Days' },
            { key: 'week', label: 'This Week' },
            { key: 'month', label: 'This Month' },
            { key: 'year', label: 'This Year' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => handleDateRangeChange(key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                dateRangeType === key 
                  ? 'bg-white text-blue-700 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              data-testid={`date-range-${key}`}
            >
              {label}
            </button>
          ))}
        </div>
        
        {/* Custom Date Range */}
        <div className="flex items-center gap-2 ml-2">
          <button
            onClick={() => handleDateRangeChange('custom')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors border ${
              dateRangeType === 'custom' 
                ? 'bg-blue-50 text-blue-700 border-blue-200' 
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
          >
            <Calendar className="h-4 w-4 inline mr-1" />
            Custom
          </button>
          {dateRangeType === 'custom' && (
            <div className="flex items-center gap-2">
              <Input 
                type="date" 
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="h-9 w-36"
                data-testid="date-from"
              />
              <span className="text-gray-400">to</span>
              <Input 
                type="date" 
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="h-9 w-36"
                data-testid="date-to"
              />
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards - Clickable (replaced Unscheduled with New Inspections) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
        <SummaryCard 
          title="Total Inspections" 
          value={inspections.length} 
          icon={ClipboardCheck} 
          color="text-blue-700" 
          onClick={() => handleCardClick('total')}
          active={cardFilter === 'total'}
        />
        <SummaryCard 
          title="Scheduled" 
          value={scheduledCount} 
          icon={Calendar} 
          color="text-amber-600" 
          onClick={() => handleCardClick('scheduled')}
          active={cardFilter === 'scheduled'}
        />
        <SummaryCard 
          title="Completed" 
          value={completedCount} 
          icon={CheckCircle} 
          color="text-emerald-600" 
          onClick={() => handleCardClick('completed')}
          active={cardFilter === 'completed'}
        />
        <SummaryCard 
          title="New Inspections" 
          value={newInspectionsCount} 
          icon={Plus} 
          color="text-purple-600" 
          onClick={() => handleCardClick('new')}
          active={cardFilter === 'new'}
        />
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
            <SelectTrigger className="w-[180px] h-10 bg-white" data-testid="filter-status">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {INSPECTION_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterPayment || 'all'} onValueChange={setFilterPayment}>
            <SelectTrigger className="w-[140px] h-10 bg-white" data-testid="filter-payment">
              <CreditCard className="h-4 w-4 text-gray-400 mr-2" />
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="pending">Pending/Due</SelectItem>
            </SelectContent>
          </Select>

          <button 
            onClick={fetchData}
            className="px-4 py-2.5 border rounded-lg hover:bg-gray-50 font-medium text-sm flex items-center gap-2"
          >
            <Filter className="h-4 w-4" /> Apply
          </button>
          
          {/* Card Filter Indicator */}
          {cardFilter && (
            <button 
              onClick={() => setCardFilter(null)}
              className="px-3 py-2.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-lg font-medium text-sm flex items-center gap-2"
            >
              Filtered: {cardFilter.charAt(0).toUpperCase() + cardFilter.slice(1)}
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border overflow-x-auto">
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
              ) : filteredInspections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <ClipboardCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No inspections match the filter</p>
                  </td>
                </tr>
              ) : (
                filteredInspections.map((inspection) => (
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
                      <div className="flex items-center gap-1">
                        <span className={`inline-flex items-center justify-center h-7 px-2 rounded-full font-semibold text-sm ${
                          (inspection.available_inspections || inspection.inspections_available || 1) > 0 
                            ? 'bg-blue-100 text-blue-700' 
                            : 'bg-gray-100 text-gray-500'
                        }`}>
                          {inspection.available_inspections || inspection.inspections_available || 1}
                          <span className="text-xs font-normal ml-1">/ {inspection.total_inspections || 1}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-xs space-y-0.5">
                        <div className="text-gray-500">Total: <span className="font-medium text-gray-900">₹{(inspection.total_amount || 0).toLocaleString()}</span></div>
                        <div className="text-gray-500">Paid: <span className="font-medium text-emerald-600">₹{(inspection.amount_paid || 0).toLocaleString()}</span></div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <PaymentStatusBadge status={inspection.payment_type === 'Partial' ? 'PARTIALLY_PAID' : inspection.payment_status} balanceDue={inspection.balance_due || inspection.pending_amount} />
                    </td>
                    <td className="px-4 py-4">
                      {(inspection.available_inspections || inspection.inspections_available || 1) > 0 ? (
                        <button 
                          className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-xs font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm"
                          onClick={() => openScheduleUnscheduledModal(inspection)}
                          data-testid={`schedule-inspection-${inspection.id}`}
                        >
                          Schedule
                        </button>
                      ) : (
                        <button 
                          className="px-4 py-2 bg-gray-200 text-gray-500 rounded-lg text-xs font-medium cursor-not-allowed"
                          disabled
                          title="All inspections in this package have been scheduled"
                        >
                          All Scheduled
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          /* Scheduled Tab Table - Fits viewport without horizontal scroll */
          <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="pl-4 pr-2 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap w-[100px]">Date/Time</th>
                <th className="px-2 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap w-[180px]">Customer</th>
                <th className="px-2 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap w-[120px]">Vehicle</th>
                <th className="px-2 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap w-[80px]">Payment</th>
                <th className="px-2 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap w-[130px]">Status</th>
                <th className="px-2 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap w-[170px]">Mechanic & Edit</th>
                <th className="px-2 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap w-[100px]">Location</th>
                <th className="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap w-[60px]">Report</th>
                <th className="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap w-[50px]">Live</th>
                <th className="pl-2 pr-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap w-[55px]">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        <span className="text-gray-500">Loading inspections...</span>
                      </div>
                    </td>
                </tr>
              ) : inspections.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12">
                    <ClipboardCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No scheduled inspections</p>
                  </td>
                </tr>
              ) : filteredInspections.length === 0 ? (
                <tr>
                  <td colSpan={11} className="text-center py-12">
                    <ClipboardCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No inspections match the filter</p>
                  </td>
                </tr>
              ) : (
                filteredInspections.map((inspection) => {
                  const isFullyPaid = inspection.payment_status === 'FULLY_PAID' || inspection.payment_status === 'PAID';
                  const actualBalanceDue = inspection.balance_due || inspection.pending_amount || 0;
                  const isPartialPayment = (inspection.payment_status === 'PARTIALLY_PAID') || 
                    (inspection.payment_type === 'Partial' && actualBalanceDue > 0);
                  const hasBalanceDue = actualBalanceDue > 0 && isPartialPayment;
                  const isCompleted = inspection.inspection_status === 'INSPECTION_COMPLETED';
                  const canSendReport = isFullyPaid && isCompleted;
                  const isPendingPayment = !isFullyPaid;
                  
                  return (
                  <tr key={inspection.id} className="hover:bg-slate-50 transition-colors" data-testid={`inspection-row-${inspection.id}`}>
                    {/* Date/Time Column */}
                    <td className="pl-4 pr-2 py-2.5">
                      <div className="flex flex-col">
                        <span className="font-medium text-gray-900 text-sm whitespace-nowrap">{formatDate(inspection.scheduled_date) || '-'}</span>
                        <span className="text-sm text-gray-500 whitespace-nowrap">{formatTime(inspection.scheduled_time)}</span>
                      </div>
                    </td>
                    
                    {/* Customer Column */}
                    <td className="px-2 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium text-sm flex-shrink-0">
                          {inspection.customer_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-gray-900 text-sm truncate max-w-[140px]">{inspection.customer_name}</div>
                          <div className="text-sm text-gray-500 font-mono">{inspection.customer_mobile}</div>
                        </div>
                      </div>
                    </td>
                    
                    {/* Vehicle Column */}
                    <td className="px-2 py-2.5">
                      <div className="min-w-0">
                        <div className="text-sm font-mono text-blue-600 truncate">{inspection.car_number || '-'}</div>
                        {(inspection.car_make || inspection.car_model) && (
                          <div className="text-sm text-gray-400 truncate">{extractMake(inspection.car_make)}</div>
                        )}
                      </div>
                    </td>
                    
                    {/* Payment Column */}
                    <td className="px-2 py-2.5">
                      <button
                        onClick={() => openPaymentDetailsModal({
                          ...inspection,
                          balance_due: actualBalanceDue
                        })}
                        className="cursor-pointer"
                        title="View payment details"
                        data-testid={`payment-status-${inspection.id}`}
                      >
                        {isFullyPaid ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-medium bg-emerald-100 text-emerald-800">
                            <CheckCircle className="h-3.5 w-3.5" />
                            Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
                            <AlertCircle className="h-3.5 w-3.5" />
                            Due
                          </span>
                        )}
                      </button>
                    </td>
                    
                    {/* Status Column */}
                    <td className="px-2 py-2.5">
                      <Select 
                        value={inspection.inspection_status || 'NEW_INSPECTION'} 
                        onValueChange={(value) => handleStatusChange(inspection.id, value)}
                      >
                        <SelectTrigger className="h-8 text-sm w-full border-gray-200" data-testid={`status-select-${inspection.id}`}>
                          <SelectValue placeholder="New" />
                        </SelectTrigger>
                        <SelectContent className="min-w-[160px]">
                          {INSPECTION_STATUSES.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              <span className={`px-2 py-0.5 rounded text-sm whitespace-nowrap ${status.color}`}>
                                {status.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                    
                    {/* Mechanic Column - Clickable name to reassign */}
                    <td className="px-2 py-2.5">
                      <button
                        onClick={() => {
                          setMechanicEditInspection(inspection);
                          setSelectedMechanicId(inspection.mechanic_id || '');
                          setIsMechanicModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 hover:bg-blue-50 px-1.5 py-1 rounded transition-colors cursor-pointer w-full"
                        title={inspection.mechanic_name ? "Click to reassign" : "Click to assign"}
                        data-testid={`mechanic-${inspection.id}`}
                      >
                        {inspection.mechanic_name ? (
                          <>
                            <UserCheck className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                            <span className="text-sm text-gray-700 truncate hover:text-blue-600">{inspection.mechanic_name}</span>
                          </>
                        ) : (
                          <span className="text-sm text-blue-600 hover:underline">+ Assign</span>
                        )}
                      </button>
                    </td>
                    
                    {/* Location Column */}
                    <td className="px-2 py-2.5">
                      <span className="inline-flex items-center gap-1 text-sm text-blue-600">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        <span className="truncate max-w-[70px]">{inspection.city || '-'}</span>
                      </span>
                    </td>
                    
                    {/* Report Column */}
                    <td className="px-2 py-2.5 text-center">
                      <button 
                        onClick={() => handleViewReport(inspection)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="View Report"
                        data-testid={`view-report-${inspection.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </button>
                    </td>
                    
                    {/* Edit Column */}
                    <td className="px-2 py-2.5 text-center">
                      <button
                        onClick={() => {
                          setEditInspectionData(inspection);
                          setIsEditInspectionModalOpen(true);
                        }}
                        className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded transition-colors"
                        title="Edit Inspection"
                        data-testid={`edit-inspection-${inspection.id}`}
                      >
                        Edit
                      </button>
                    </td>
                    
                    {/* Live Progress Column */}
                    <td className="px-2 py-2.5 text-center">
                      <button
                        onClick={() => openLiveProgressModal(inspection)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-300 ${
                          ['INSPECTION_STARTED', 'IN_PROGRESS'].includes(inspection.inspection_status)
                            ? 'text-white bg-gradient-to-r from-green-500 to-emerald-500 shadow-lg shadow-green-500/40 animate-pulse hover:shadow-green-500/60'
                            : inspection.inspection_status === 'COMPLETED' || inspection.inspection_answers && Object.keys(inspection.inspection_answers).length > 0
                            ? 'text-gray-600 bg-gray-200 hover:bg-gray-300'
                            : 'text-gray-400 bg-gray-100 hover:bg-gray-200'
                        }`}
                        title={['INSPECTION_STARTED', 'IN_PROGRESS'].includes(inspection.inspection_status) ? 'Inspection in progress - Click to view live updates' : 'View inspection data'}
                        data-testid={`live-progress-${inspection.id}`}
                      >
                        {['INSPECTION_STARTED', 'IN_PROGRESS'].includes(inspection.inspection_status) ? (
                          <span className="flex items-center gap-1">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-white"></span>
                            </span>
                            Live
                          </span>
                        ) : 'Live'}
                      </button>
                    </td>
                    
                    {/* Notes Column */}
                    <td className="pl-2 pr-4 py-2.5 text-center">
                      <button
                        onClick={() => openNotesDrawer(inspection)}
                        className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                        title="Notes, Activity & OTP"
                        data-testid={`notes-button-${inspection.id}`}
                      >
                        <StickyNote className="h-4 w-4" />
                      </button>
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
                  data-testid="vehicle-number-input"
                />
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={handleVehicleSearch}
                  disabled={vehicleSearching}
                  data-testid="search-vehicle-btn"
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
                  <div><span className="text-gray-500">Make:</span> <span className="font-medium">{vehicleData.manufacturer || vehicleData.make || '-'}</span></div>
                  <div><span className="text-gray-500">Model:</span> <span className="font-medium">{vehicleData.model || '-'}</span></div>
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
              {/* Show inspection city info */}
              {mechanicEditInspection?.city && (
                <div className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded-md inline-flex items-center gap-1 mb-2">
                  <MapPin className="h-3 w-3" />
                  Showing mechanics for: <span className="font-medium">{mechanicEditInspection.city}</span>
                </div>
              )}
              <Select value={selectedMechanicId} onValueChange={setSelectedMechanicId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select mechanic..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassign">
                    <span className="text-gray-500 italic">-- Unassign --</span>
                  </SelectItem>
                  {mechanics
                    .filter(mechanic => {
                      // Filter by inspection city using alias resolution
                      const inspectionCity = mechanicEditInspection?.city?.toLowerCase()?.trim();
                      if (!inspectionCity) return true; // Show all if no city
                      
                      // Resolve the inspection city to its canonical form using alias map
                      const canonicalInspectionCity = cityAliasMap[inspectionCity] || inspectionCity;
                      
                      // Check if mechanic has the canonical city (or any alias) in their inspection_cities
                      const mechanicCities = mechanic.inspection_cities || [];
                      return mechanicCities.some(mc => {
                        const mcLower = mc.toLowerCase().trim();
                        const canonicalMc = cityAliasMap[mcLower] || mcLower;
                        // Match if canonical cities are the same
                        return canonicalMc === canonicalInspectionCity;
                      });
                    })
                    .map((mechanic) => (
                    <SelectItem key={mechanic.id} value={mechanic.id}>
                      <div className="flex items-center gap-2">
                        <UserCheck className="h-4 w-4 text-emerald-500" />
                        <span>{mechanic.name}</span>
                        {mechanic.inspection_cities?.length > 0 && (
                          <span className="text-xs text-gray-400">
                            ({mechanic.inspection_cities.join(', ')})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {mechanics.filter(m => {
                const inspectionCity = mechanicEditInspection?.city?.toLowerCase()?.trim();
                if (!inspectionCity) return true;
                
                // Resolve the inspection city to its canonical form
                const canonicalInspectionCity = cityAliasMap[inspectionCity] || inspectionCity;
                
                const mechanicCities = m.inspection_cities || [];
                return mechanicCities.some(mc => {
                  const mcLower = mc.toLowerCase().trim();
                  const canonicalMc = cityAliasMap[mcLower] || mcLower;
                  return canonicalMc === canonicalInspectionCity;
                });
              }).length === 0 && (
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-md">
                  No mechanics available for {mechanicEditInspection?.city || 'this city'}. 
                  Add mechanics for this city in HR Module.
                </p>
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
      
      {/* Location Edit Modal - With Google Places */}
      <Dialog open={isLocationModalOpen} onOpenChange={setIsLocationModalOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="location-edit-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-green-500 to-green-600 flex items-center justify-center text-white">
                <MapPin className="h-5 w-5" />
              </div>
              <div>
                <p>Edit Inspection Location</p>
                <p className="text-sm font-normal text-gray-500">{locationEditInspection?.customer_name}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            {/* Current Location Info */}
            {locationEditInspection && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer:</span>
                  <span className="font-medium">{locationEditInspection.customer_name}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-500">Vehicle:</span>
                  <span className="font-medium">{locationEditInspection.car_number}</span>
                </div>
                {locationEditInspection.city && (
                  <div className="flex justify-between mt-1">
                    <span className="text-gray-500">Current City:</span>
                    <span className="font-medium">{locationEditInspection.city}</span>
                  </div>
                )}
                {locationEditInspection.address && (
                  <div className="flex justify-between mt-1">
                    <span className="text-gray-500">Current Address:</span>
                    <span className="font-medium text-right max-w-[200px] truncate">{locationEditInspection.address}</span>
                  </div>
                )}
              </div>
            )}
            
            {/* Google Places Autocomplete */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Search New Address</Label>
              <PlacesAutocomplete
                value={locationFormData.address}
                onChange={(value) => setLocationFormData(prev => ({ ...prev, address: value }))}
                onSelect={(placeData) => {
                  // placeData contains { address, latitude, longitude, city }
                  console.log('Location place selected:', placeData);
                  
                  setLocationFormData(prev => ({
                    ...prev,
                    address: placeData.address || prev.address,
                    city: placeData.city || prev.city,
                    latitude: placeData.latitude || null,
                    longitude: placeData.longitude || null
                  }));
                  
                  // Show info that city will be auto-mapped
                  if (placeData.city) {
                    toast.info(`City detected: ${placeData.city} - Will be mapped to City Master on save`);
                  }
                }}
                placeholder="Search for inspection address..."
                className="w-full"
              />
              <p className="text-xs text-gray-500">
                This address will be used for mechanic navigation
              </p>
            </div>
            
            {/* Selected Location Preview */}
            {locationFormData.latitude && locationFormData.longitude && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-green-800">Location Selected</p>
                    <p className="text-green-700 mt-1">{locationFormData.address}</p>
                    {locationFormData.city && (
                      <p className="text-green-600 text-xs mt-1">City: {locationFormData.city}</p>
                    )}
                    <p className="text-green-600 text-xs mt-1">
                      Coordinates: {locationFormData.latitude.toFixed(6)}, {locationFormData.longitude.toFixed(6)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <DialogFooter className="border-t pt-4 mt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setIsLocationModalOpen(false);
                setLocationEditInspection(null);
                setLocationFormData({ address: '', city: '', latitude: null, longitude: null });
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleLocationUpdate}
              disabled={locationSaving || !locationFormData.latitude || !locationFormData.longitude}
              className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
            >
              {locationSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Update Location
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Combined Edit Inspection Modal - Date/Time, Location, Vehicle */}
      <Dialog open={isEditInspectionModalOpen} onOpenChange={(open) => {
        setIsEditInspectionModalOpen(open);
        if (!open) {
          setEditInspectionData(null);
          setEditVehicleData(null);
        }
      }}>
        <DialogContent className="sm:max-w-[550px]" data-testid="edit-inspection-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white">
                <Edit2 className="h-5 w-5" />
              </div>
              <div>
                <p>Edit Inspection</p>
                <p className="text-sm font-normal text-gray-500">{editInspectionData?.customer_name}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-5 pt-4 max-h-[60vh] overflow-y-auto">
            {/* Date & Time Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <CalendarClock className="h-4 w-4 text-blue-600" />
                Date & Time
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Date</Label>
                  <Input 
                    type="date" 
                    value={editInspectionFormData.scheduled_date}
                    onChange={(e) => setEditInspectionFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
                    className="h-9"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Time</Label>
                  <Input 
                    type="time" 
                    value={editInspectionFormData.scheduled_time}
                    onChange={(e) => setEditInspectionFormData(prev => ({ ...prev, scheduled_time: e.target.value }))}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
            
            {/* Location Section */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <MapPin className="h-4 w-4 text-green-600" />
                Location
              </div>
              
              {/* Current Address */}
              {editInspectionData?.address && (
                <div className="bg-slate-50 border rounded-lg p-3">
                  <Label className="text-xs text-gray-500">Current Address</Label>
                  <p className="text-sm text-gray-800 mt-1">{editInspectionData.address}</p>
                  {editInspectionData.city && (
                    <p className="text-xs text-gray-500 mt-1">City: {editInspectionData.city}</p>
                  )}
                </div>
              )}
              
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">Update Address (Google Places)</Label>
                <PlacesAutocomplete
                  value={editInspectionFormData.address}
                  onChange={(value) => setEditInspectionFormData(prev => ({ ...prev, address: value }))}
                  onSelect={(placeData) => {
                    // placeData contains { address, latitude, longitude, city }
                    console.log('Place selected:', placeData);
                    setEditInspectionFormData(prev => ({
                      ...prev,
                      address: placeData.address || prev.address,
                      city: placeData.city || prev.city,
                      latitude: placeData.latitude || null,
                      longitude: placeData.longitude || null
                    }));
                  }}
                  placeholder="Search new address..."
                  className="w-full"
                />
                
                {/* Manual City Override */}
                <div className="mt-2">
                  <Label className="text-xs text-gray-500">City (auto-detected or manual override)</Label>
                  <Input
                    value={editInspectionFormData.city}
                    onChange={(e) => setEditInspectionFormData(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Enter city name"
                    className="mt-1"
                  />
                </div>
                
                {editInspectionFormData.city && editInspectionFormData.city !== editInspectionData?.city && (
                  <div className="flex items-center gap-2 mt-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                    <MapPin className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-700">
                      City will be updated to: <span className="font-semibold">{editInspectionFormData.city}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            {/* Vehicle Section */}
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <Car className="h-4 w-4 text-amber-600" />
                Vehicle
              </div>
              
              {/* Current Vehicle Details */}
              {(editInspectionData?.car_number || editInspectionData?.car_make) && (
                <div className="bg-slate-50 border rounded-lg p-3">
                  <Label className="text-xs text-gray-500">Current Vehicle</Label>
                  <div className="mt-2 space-y-1">
                    <p className="text-sm font-mono text-blue-600 font-medium">{editInspectionData.car_number || '-'}</p>
                    {(editInspectionData.car_make || editInspectionData.car_model) && (
                      <p className="text-sm text-gray-700">{editInspectionData.car_make} {editInspectionData.car_model}</p>
                    )}
                    <div className="flex flex-wrap gap-2 mt-2">
                      {editInspectionData.car_year && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Year: {editInspectionData.car_year}</span>
                      )}
                      {editInspectionData.fuel_type && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{editInspectionData.fuel_type}</span>
                      )}
                      {editInspectionData.car_color && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{editInspectionData.car_color}</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <Label className="text-xs text-gray-500">Change Vehicle Number</Label>
                <div className="flex gap-2">
                  <Input
                    value={editInspectionFormData.car_number}
                    onChange={(e) => setEditInspectionFormData(prev => ({ ...prev, car_number: e.target.value.toUpperCase() }))}
                    placeholder="KA01AB1234"
                    className="h-9 font-mono"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleEditVehicleSearch}
                    disabled={editVehicleSearching}
                    className="h-9 px-3"
                  >
                    {editVehicleSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  </Button>
                </div>
                {editVehicleData && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs">
                    <Label className="text-xs text-green-700 font-medium">New Vehicle Found</Label>
                    <div className="flex items-center gap-1 text-green-800 mt-1">
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span className="font-semibold">{editVehicleData.manufacturer} {editVehicleData.model}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {editVehicleData.fuel_type && (
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">{editVehicleData.fuel_type}</span>
                      )}
                      {(editVehicleData.manufacturing_date || editVehicleData.registration_date) && (
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">{editVehicleData.manufacturing_date || editVehicleData.registration_date}</span>
                      )}
                      {editVehicleData.color && (
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded">{editVehicleData.color}</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <DialogFooter className="border-t pt-4 mt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setIsEditInspectionModalOpen(false);
                setEditInspectionData(null);
                setEditVehicleData(null);
              }}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleEditInspectionSave}
              disabled={editInspectionSaving}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              {editInspectionSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Live Progress Modal - Comprehensive Inspection Editor */}
      <LiveProgressModal
        isOpen={isLiveProgressModalOpen}
        onClose={() => {
          setIsLiveProgressModalOpen(false);
          setLiveProgressAutoRefresh(false);
          setLiveProgressData(null);
          setLiveProgressInspection(null);
        }}
        inspection={liveProgressInspection}
        liveProgressData={liveProgressData}
        onRefresh={fetchLiveProgress}
        onInspectionUpdated={(updatedInspection) => setLiveProgressInspection(updatedInspection)}
        canEdit={canEditAnswers}
        user={user}
      />
      
      {/* Schedule Unscheduled Inspection Modal - With Vaahan API & Google Places */}
      <Dialog open={isScheduleUnscheduledModalOpen} onOpenChange={setIsScheduleUnscheduledModalOpen}>
        <DialogContent className="sm:max-w-[550px]" data-testid="schedule-unscheduled-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p>Schedule Inspection</p>
                <p className="text-sm font-normal text-gray-500">{scheduleUnscheduledInspection?.customer_name}</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            {/* Customer Info Summary */}
            {scheduleUnscheduledInspection && (
              <div className="bg-slate-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Customer:</span>
                  <span className="font-medium">{scheduleUnscheduledInspection.customer_name} ({scheduleUnscheduledInspection.customer_mobile})</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-500">Package:</span>
                  <span className="font-medium">{scheduleUnscheduledInspection.package_name || 'Standard'}</span>
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-gray-500">Amount:</span>
                  <span className="font-medium text-emerald-600">₹{scheduleUnscheduledInspection.amount_paid || 0}</span>
                </div>
              </div>
            )}
            
            {/* 1. Vehicle Number Search */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Vehicle Number</Label>
              <div className="flex gap-2">
                <Input 
                  value={scheduleFormData.car_number} 
                  onChange={(e) => setScheduleFormData({...scheduleFormData, car_number: e.target.value.toUpperCase()})}
                  placeholder="KA01AB1234"
                  className="flex-1 font-mono"
                  data-testid="schedule-vehicle-input"
                />
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={handleScheduleVehicleSearch}
                  disabled={scheduleVehicleSearching}
                  data-testid="schedule-vehicle-search-btn"
                >
                  {scheduleVehicleSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                  Search
                </Button>
              </div>
            </div>
            
            {/* Vehicle Data Found */}
            {scheduleVehicleData && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-1">
                <div className="flex items-center gap-2 text-emerald-700 font-medium text-sm">
                  <CheckCircle className="h-4 w-4" />
                  Vehicle Found
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <div><span className="text-gray-500">Make:</span> <span className="font-medium">{scheduleVehicleData.manufacturer || scheduleVehicleData.make || '-'}</span></div>
                  <div><span className="text-gray-500">Model:</span> <span className="font-medium">{scheduleVehicleData.model || '-'}</span></div>
                  <div><span className="text-gray-500">Year:</span> <span className="font-medium">{scheduleVehicleData.manufacturing_date?.split('/')?.pop() || scheduleVehicleData.year || '-'}</span></div>
                  <div><span className="text-gray-500">Fuel:</span> <span className="font-medium">{scheduleVehicleData.fuel_type || '-'}</span></div>
                </div>
              </div>
            )}
            
            {/* 2. Date & Time - Combined Picker */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Inspection Date & Time *</Label>
              <Input 
                type="datetime-local" 
                value={scheduleFormData.scheduled_date && scheduleFormData.scheduled_time 
                  ? `${scheduleFormData.scheduled_date}T${scheduleFormData.scheduled_time}`
                  : ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value) {
                    const [date, time] = value.split('T');
                    setScheduleFormData(prev => ({
                      ...prev, 
                      scheduled_date: date,
                      scheduled_time: time
                    }));
                  }
                }}
                min={new Date().toISOString().slice(0, 16)}
                className="h-11 text-base"
                data-testid="schedule-datetime-input"
              />
              {scheduleFormData.scheduled_date && scheduleFormData.scheduled_time && (
                <p className="text-xs text-green-600">
                  ✓ Scheduled: {new Date(`${scheduleFormData.scheduled_date}T${scheduleFormData.scheduled_time}`).toLocaleString('en-IN', {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                  })}
                </p>
              )}
            </div>
            
            {/* 3. Inspection City */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Inspection City *</Label>
              <Select value={scheduleFormData.city} onValueChange={(v) => setScheduleFormData({...scheduleFormData, city: v})}>
                <SelectTrigger className="h-10" data-testid="schedule-city-select">
                  <SelectValue placeholder="Select city" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            
            {/* 4. Address with Google Places */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Inspection Address</Label>
              <PlacesAutocomplete
                value={scheduleFormData.address}
                onChange={(value) => setScheduleFormData({...scheduleFormData, address: value})}
                onSelect={(place) => {
                  setScheduleFormData({
                    ...scheduleFormData, 
                    address: place.address,
                    // Extract city from place if available
                    city: place.city || scheduleFormData.city
                  });
                }}
                placeholder="Start typing address..."
                country="in"
              />
              <p className="text-xs text-gray-400">Start typing to search for addresses using Google Maps</p>
            </div>
          </div>
          
          <DialogFooter className="pt-4 border-t">
            <Button variant="outline" onClick={() => setIsScheduleUnscheduledModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleScheduleUnscheduledSubmit}
              disabled={scheduleSaving}
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            >
              {scheduleSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Schedule Inspection
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Details Modal */}
      <Dialog open={isPaymentDetailsModalOpen} onOpenChange={closePaymentDetailsModal}>
        <DialogContent className="sm:max-w-[500px]" data-testid="payment-details-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-600" />
              Payment Details
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-2">
              View payment status and manage pending payments
            </DialogDescription>
          </DialogHeader>
          
          {paymentDetailsInspection && (
            <div className="space-y-4 pt-4">
              {/* Customer Info */}
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium">
                    {paymentDetailsInspection.customer_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{paymentDetailsInspection.customer_name}</div>
                    <div className="text-sm text-gray-500 font-mono">{paymentDetailsInspection.customer_mobile}</div>
                  </div>
                </div>
                
                <div className="text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Package:</span>
                    <span className="font-medium text-gray-700">{paymentDetailsInspection.package_type || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vehicle:</span>
                    <span className="font-medium text-gray-700 font-mono">{paymentDetailsInspection.car_number || 'N/A'}</span>
                  </div>
                </div>
              </div>

              {/* Payment Summary */}
              <div className="bg-white border rounded-lg p-4 space-y-3">
                <h4 className="font-medium text-gray-900 flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-gray-500" />
                  Payment Summary
                </h4>
                
                <div className="space-y-2">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-600">Total Amount</span>
                    <span className="font-semibold text-gray-900">₹{(paymentDetailsInspection.total_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-gray-600">Amount Paid</span>
                    <span className="font-semibold text-emerald-600">₹{(paymentDetailsInspection.amount_paid || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-700 font-medium">Pending Amount</span>
                    <span className={`font-bold text-lg ${(paymentDetailsInspection.balance_due || 0) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
                      ₹{(paymentDetailsInspection.balance_due || 0).toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Payment Status Badge */}
                <div className="pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">Status:</span>
                    {(paymentDetailsInspection.payment_status === 'FULLY_PAID' || paymentDetailsInspection.payment_status === 'PAID' || (paymentDetailsInspection.balance_due || 0) <= 0) ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                        <CheckCircle className="h-3.5 w-3.5" />
                        Fully Paid
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 border border-amber-200">
                        <AlertCircle className="h-3.5 w-3.5" />
                        Payment Pending
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Payment Link Section - Only show if there's pending amount */}
              {(paymentDetailsInspection.balance_due || 0) > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-medium text-amber-800 mb-3 flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    Collect Pending Payment
                  </h4>
                  
                  {!paymentLink ? (
                    <div className="space-y-3">
                      <p className="text-sm text-amber-700">
                        Generate a Razorpay payment link for <strong>₹{(paymentDetailsInspection.balance_due || 0).toLocaleString()}</strong> to share with the customer.
                      </p>
                      <div className="flex gap-2">
                        <Button
                          onClick={() => handleCreatePaymentLink(true)}
                          disabled={creatingPaymentLink}
                          className="flex-1 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                          size="sm"
                        >
                          {creatingPaymentLink ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Send className="h-4 w-4 mr-2" />
                          )}
                          Send via WhatsApp
                        </Button>
                        <Button
                          onClick={() => handleCreatePaymentLink(false)}
                          disabled={creatingPaymentLink}
                          variant="outline"
                          size="sm"
                          className="border-amber-300 text-amber-700 hover:bg-amber-100"
                        >
                          {creatingPaymentLink ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Link2 className="h-4 w-4 mr-2" />
                          )}
                          Generate Link
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-emerald-700 font-medium">
                          <CheckCircle className="h-4 w-4" />
                          {paymentLink.isExisting ? 'Payment Link Active' : 'Payment Link Generated'}
                        </div>
                        {paymentLink.whatsappSent && (
                          <span className="text-xs bg-emerald-100 px-2 py-0.5 rounded-full text-emerald-700">WhatsApp Sent</span>
                        )}
                      </div>
                      
                      {/* Link Display */}
                      <div className="flex items-center gap-2 bg-white rounded-lg p-2 border border-emerald-200">
                        <Link2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        <input
                          type="text"
                          value={paymentLink.url || ''}
                          readOnly
                          className="flex-1 text-xs bg-transparent border-none outline-none text-gray-600 truncate"
                        />
                        <Button
                          onClick={handleCopyPaymentDetailsLink}
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          title="Copy Link"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          onClick={() => window.open(paymentLink.url, '_blank')}
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          title="Open Link"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          onClick={handleCheckPaymentLinkStatus}
                          disabled={checkingPaymentStatus}
                          size="sm"
                          variant="outline"
                          className="flex-1 border-blue-300 text-blue-700 hover:bg-blue-50"
                        >
                          {checkingPaymentStatus ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-2" />
                          )}
                          Check Status
                        </Button>
                        <Button
                          onClick={handleSharePaymentViaWhatsApp}
                          size="sm"
                          className="flex-1 bg-green-500 hover:bg-green-600"
                        >
                          <Send className="h-4 w-4 mr-2" />
                          {paymentLink.isExisting ? 'Resend' : 'Send'} WhatsApp
                        </Button>
                      </div>
                      
                      {/* New Link Option */}
                      <div className="pt-2 border-t border-dashed">
                        <Button
                          onClick={() => setPaymentLink(null)}
                          variant="ghost"
                          size="sm"
                          className="w-full text-gray-500 hover:text-gray-700"
                        >
                          <RefreshCw className="h-3.5 w-3.5 mr-2" />
                          Generate New Link
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="border-t pt-4 mt-4">
            <Button variant="outline" onClick={closePaymentDetailsModal}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Notes & Activity Drawer */}
      <Sheet open={isNotesDrawerOpen} onOpenChange={(open) => !open && closeNotesDrawer()}>
        <SheetContent className="sm:max-w-[480px] flex flex-col h-full p-0" data-testid="notes-drawer">
          <SheetHeader className="px-6 py-4 border-b bg-gradient-to-r from-slate-50 to-white flex-shrink-0">
            <SheetTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium">
                {notesInspection?.customer_name?.charAt(0)?.toUpperCase() || 'I'}
              </div>
              <div>
                <div className="font-semibold text-gray-900">{notesInspection?.customer_name}</div>
                <div className="text-sm text-gray-500 font-mono">{notesInspection?.car_number || 'No vehicle'}</div>
              </div>
            </SheetTitle>
            
            {/* Quick Info */}
            {notesInspection && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded-full">
                  <MapPin className="h-3 w-3" /> {notesInspection.city || 'N/A'}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-50 text-purple-700 rounded-full">
                  <Calendar className="h-3 w-3" /> {notesInspection.scheduled_date ? formatDate(notesInspection.scheduled_date) : 'Not scheduled'}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${
                  notesInspection.inspection_status === 'INSPECTION_COMPLETED' ? 'bg-emerald-50 text-emerald-700' :
                  notesInspection.inspection_status === 'NEW_INSPECTION' ? 'bg-blue-50 text-blue-700' :
                  'bg-amber-50 text-amber-700'
                }`}>
                  <Activity className="h-3 w-3" /> {INSPECTION_STATUSES.find(s => s.value === notesInspection.inspection_status)?.label || notesInspection.inspection_status}
                </span>
              </div>
            )}
          </SheetHeader>

          <Tabs value={notesTab} onValueChange={handleNotesTabChange} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TabsList className="grid w-full grid-cols-3 mx-6 my-3 flex-shrink-0" style={{ width: 'calc(100% - 48px)' }}>
              <TabsTrigger value="notes" className="flex items-center gap-1 text-xs" data-testid="notes-tab">
                <StickyNote className="h-3.5 w-3.5" /> Notes
              </TabsTrigger>
              <TabsTrigger value="activities" className="flex items-center gap-1 text-xs" data-testid="activities-tab">
                <Activity className="h-3.5 w-3.5" /> Activity
              </TabsTrigger>
              <TabsTrigger value="sms" className="flex items-center gap-1 text-xs" data-testid="sms-tab">
                <MessageSquare className="h-3.5 w-3.5" /> OTP
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 min-h-0 overflow-hidden relative">
              <TabsContent value="notes" className="absolute inset-0 flex flex-col m-0 overflow-hidden">
              {/* Add Note Section */}
              <div className="bg-slate-50 rounded-xl p-4 border mx-6 mt-2 mb-2 flex-shrink-0">
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
              <div className="flex-1 min-h-0 relative">
                {loadingNotes ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : inspectionNotes.length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                    <StickyNote className="h-10 w-10 mb-2 text-gray-300" />
                    <p className="text-sm">No notes yet. Add the first note!</p>
                  </div>
                ) : (
                  <ScrollArea className="absolute inset-0">
                    <div className="space-y-3 px-6 py-2 pr-4">
                    {inspectionNotes.map((note) => (
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
                    ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </TabsContent>

              <TabsContent value="activities" className="absolute inset-0 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="space-y-3 px-6 py-2 pr-4">
              {loadingNotes ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                </div>
              ) : inspectionActivities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                  <Activity className="h-10 w-10 mb-2 text-gray-300" />
                  <p className="text-sm">No activities recorded yet.</p>
                </div>
              ) : (
                <>
                  {inspectionActivities.map((activity) => {
                    const getActivityStyle = (action) => {
                      switch(action) {
                        case 'status_changed': return { bg: 'bg-blue-500', icon: '🔄' };
                        case 'mechanic_assigned': return { bg: 'bg-purple-500', icon: '👤' };
                        case 'mechanic_unassigned': return { bg: 'bg-orange-500', icon: '👤' };
                        case 'note_added': return { bg: 'bg-amber-500', icon: '📝' };
                        case 'payment_link_sent': return { bg: 'bg-green-500', icon: '💳' };
                        case 'payment_received': return { bg: 'bg-emerald-500', icon: '✅' };
                        case 'schedule_updated': return { bg: 'bg-indigo-500', icon: '📅' };
                        case 'vehicle_updated': return { bg: 'bg-cyan-500', icon: '🚗' };
                        default: return { bg: 'bg-gray-500', icon: '📋' };
                      }
                    };
                    const style = getActivityStyle(activity.action);
                    
                    return (
                      <div key={activity.id} className="bg-white border rounded-xl p-4 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className={`h-8 w-8 rounded-full ${style.bg} flex items-center justify-center text-white text-sm flex-shrink-0`}>
                            {style.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-medium text-sm text-gray-900 uppercase">
                                {activity.action?.replace(/_/g, ' ')}
                              </span>
                              <span className="text-xs text-gray-400">{formatDateTime(activity.created_at)}</span>
                            </div>
                            <p className="text-sm text-gray-600">{activity.details}</p>
                            {activity.old_value && activity.new_value && (
                              <div className="mt-1 text-xs text-gray-500">
                                <span className="text-gray-600">{activity.old_value}</span>
                                <span className="mx-1">→</span>
                                <span className="font-medium text-gray-900">{activity.new_value}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1 mt-2">
                              <div className="h-5 w-5 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-[10px] font-medium">
                                {activity.user_name?.charAt(0)?.toUpperCase() || 'S'}
                              </div>
                              <span className="text-xs text-gray-500">by <span className="font-medium">{activity.user_name || 'System'}</span></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* SMS Logs Tab */}
            <TabsContent value="sms" className="absolute inset-0 flex flex-col m-0 overflow-hidden">
              {/* Mechanic OTP Header */}
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border mx-6 mt-2 mb-2 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold text-gray-900">Mechanic Login OTPs</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={fetchSmsLogs}
                    className="h-8"
                  >
                    <RefreshCw className={`h-4 w-4 ${loadingSmsLogs ? 'animate-spin' : ''}`} />
                  </Button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  View OTPs sent to mechanic for app login. Share with mechanic if they don't receive SMS.
                </p>
              </div>

              {/* OTP Logs List - Filtered for mechanic OTPs only */}
              <div className="flex-1 min-h-0 relative">
                {loadingSmsLogs ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  </div>
                ) : smsLogs.filter(log => log.request_type === 'OTP' || log.request_type === 'MECHANIC_OTP').length === 0 ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500">
                    <MessageSquare className="h-10 w-10 mb-2 text-gray-300" />
                    <p className="text-sm">No mechanic OTP logs found</p>
                    <Button variant="outline" size="sm" className="mt-2" onClick={fetchSmsLogs}>
                      <RefreshCw className="h-4 w-4 mr-1" /> Refresh
                    </Button>
                  </div>
                ) : (
                  <ScrollArea className="absolute inset-0">
                    <div className="px-6 py-2 space-y-3">
                      {smsLogs
                        .filter(log => log.request_type === 'OTP' || log.request_type === 'MECHANIC_OTP' || !log.request_type)
                        .map((log, index) => (
                        <div 
                          key={log.request_id || index} 
                          className={`bg-white border rounded-xl p-4 shadow-sm ${log.success ? 'border-l-4 border-l-green-500' : 'border-l-4 border-l-red-500'}`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              {log.success ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                              )}
                              <span className={`text-sm font-semibold ${log.success ? 'text-green-700' : 'text-red-700'}`}>
                                {log.success ? 'SENT' : 'FAILED'}
                              </span>
                            </div>
                            <span className="text-xs text-gray-400">{formatDateTime(log.timestamp || log.created_at)}</span>
                          </div>
                          
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-600">Phone:</span>
                              <span className="font-mono text-sm text-gray-900">{log.phone || log.phone_masked}</span>
                            </div>
                            
                            {/* Extract OTP from variables field (format: "otp|validity") */}
                            {(log.variables || log.otp) && (
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                                <div className="flex items-center justify-between">
                                  <span className="text-sm text-blue-700 font-medium">OTP Code:</span>
                                  <span className="font-mono text-2xl font-bold text-blue-800 tracking-widest">
                                    {log.otp || (log.variables ? log.variables.split('|')[0] : 'N/A')}
                                  </span>
                                </div>
                              </div>
                            )}
                            
                            {log.error_message && (
                              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                                <span className="text-red-700 text-xs font-medium">Error: </span>
                                <span className="text-red-600 text-xs">{log.error_message}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </TabsContent>
            </div>
          </Tabs>
        </SheetContent>
      </Sheet>
    </div>
  );
}
