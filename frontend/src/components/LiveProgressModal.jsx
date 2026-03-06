import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { inspectionsApi, repairsApi } from '@/services/api';
import {
  Loader2, User, Activity, Car, FileText, Settings, Wrench, Shield,
  AlertTriangle, CheckCircle, Clock, RefreshCw, Save, Pencil, X,
  ChevronDown, ChevronRight, DollarSign, Gauge, History, Download,
  Star, ThumbsUp, ThumbsDown, AlertCircle, Info, Zap, Eye, Share2,
  ExternalLink, Copy, ClipboardList, CircleDot, RotateCcw, Package,
  Sparkles, Lightbulb, MapPin, CalendarClock, BarChart3
} from 'lucide-react';

// Condition options for dropdowns
const CONDITION_OPTIONS = ['EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'NOT_INSPECTED'];
const REPAIR_TYPES = ['MINOR', 'MAJOR', 'CRITICAL'];

// Section Component for collapsible sections
const Section = ({ title, icon: Icon, children, defaultOpen = false, badge = null }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  
  return (
    <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
            <Icon className="h-5 w-5 text-white" />
          </div>
          <span className="font-semibold text-gray-900">{title}</span>
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
              {badge}
            </span>
          )}
        </div>
        {isOpen ? <ChevronDown className="h-5 w-5 text-gray-400" /> : <ChevronRight className="h-5 w-5 text-gray-400" />}
      </button>
      {isOpen && (
        <div className="p-4 pt-0 border-t bg-gray-50/50">
          {children}
        </div>
      )}
    </div>
  );
};

// Editable Field Component
const EditableField = ({ label, value, onChange, type = 'text', options = [], disabled = false, placeholder = '', suffix = '' }) => {
  if (type === 'select') {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-600">{label}</Label>
        <Select value={value || ''} onValueChange={onChange} disabled={disabled}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder={placeholder || `Select ${label}`} />
          </SelectTrigger>
          <SelectContent>
            {options.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }
  
  if (type === 'textarea') {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs text-gray-600">{label}</Label>
        <Textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className="min-h-[80px] text-sm"
        />
      </div>
    );
  }
  
  if (type === 'switch') {
    return (
      <div className="flex items-center justify-between py-2">
        <Label className="text-sm text-gray-700">{label}</Label>
        <Switch checked={value || false} onCheckedChange={onChange} disabled={disabled} />
      </div>
    );
  }
  
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-gray-600">{label}</Label>
      <div className="relative">
        <Input
          type={type}
          value={value || ''}
          onChange={(e) => onChange(type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value)}
          disabled={disabled}
          placeholder={placeholder}
          className="h-9 text-sm"
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-500">{suffix}</span>
        )}
      </div>
    </div>
  );
};

// Repair Item Component
const RepairItem = ({ repair, index, onUpdate, onRemove }) => {
  return (
    <div className="flex items-start gap-3 p-3 bg-white rounded-lg border">
      <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
        repair.type === 'CRITICAL' ? 'bg-red-100 text-red-700' :
        repair.type === 'MAJOR' ? 'bg-orange-100 text-orange-700' :
        'bg-yellow-100 text-yellow-700'
      }`}>
        {index + 1}
      </div>
      <div className="flex-1 grid grid-cols-3 gap-2">
        <Input
          value={repair.item || ''}
          onChange={(e) => onUpdate(index, { ...repair, item: e.target.value })}
          placeholder="Repair item"
          className="h-8 text-sm"
        />
        <Select value={repair.type || 'MINOR'} onValueChange={(val) => onUpdate(index, { ...repair, type: val })}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {REPAIR_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={repair.estimated_cost || ''}
            onChange={(e) => onUpdate(index, { ...repair, estimated_cost: parseFloat(e.target.value) || 0 })}
            placeholder="Cost ₹"
            className="h-8 text-sm"
          />
          <Button variant="ghost" size="sm" onClick={() => onRemove(index)} className="h-8 w-8 p-0 text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

// Main Live Progress Modal Component
export default function LiveProgressModal({
  isOpen,
  onClose,
  inspection,
  liveProgressData,
  onRefresh,
  onInspectionUpdated, // NEW: callback to update inspection data
  canEdit = false,
  user
}) {
  // Local state for editing
  const [activeTab, setActiveTab] = useState('ai-analysis');
  const [saving, setSaving] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true); // Auto-refresh enabled by default
  const [refreshing, setRefreshing] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [generatingShareUrl, setGeneratingShareUrl] = useState(false);
  const [editingAnswer, setEditingAnswer] = useState(null); // { questionId, categoryId }
  const [savingAnswer, setSavingAnswer] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState(null); // For filtering Q&A by category
  
  // OBD Rescan state
  const [requestingRescan, setRequestingRescan] = useState(false);
  
  // RPP (Recommended Purchase Price) state
  const [fetchingRPP, setFetchingRPP] = useState(false);
  
  // Repairs Module state
  const [repairParts, setRepairParts] = useState([]);
  const [repairRules, setRepairRules] = useState([]);
  const [loadingRepairs, setLoadingRepairs] = useState(false);
  const [calculatedRepairs, setCalculatedRepairs] = useState([]);
  
  // Track unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [originalData, setOriginalData] = useState(null);
  
  // Editable data state
  const [editData, setEditData] = useState({
    // Header & Assessment
    overall_rating: 0,
    recommended_to_buy: false,
    market_value_min: 0,
    market_value_max: 0,
    assessment_summary: '',
    key_highlights: [],
    
    // Vehicle Details
    vehicle_make: '',
    vehicle_model: '',
    vehicle_year: '',
    fuel_type: '',
    transmission: '',
    vehicle_colour: '',
    engine_cc: 0,
    kms_driven: 0,
    owners: 0,
    
    // Condition Ratings (AI + Manual)
    engine_condition: 'PENDING',
    interior_condition: 'PENDING',
    exterior_condition: 'PENDING',
    transmission_condition: 'PENDING',
    
    // Key Information
    accident_history: false,
    flood_damage: false,
    dents_scratches: false,
    
    // Insurance
    insurance_status: '',
    insurer_name: '',
    policy_number: '',
    insurance_expiry: '',
    policy_type: '',
    idv_value: 0,
    
    // Repairs Estimation (NEW)
    repairs: [],
    total_repair_cost_min: 0,
    total_repair_cost_max: 0,
    
    // RTO Verification
    rto_verification_status: 'PENDING',
    hypothecation: '',
    blacklist_status: false,
    
    // OBD
    obd_connected: false,
    dtc_codes: [],
    
    // Category Ratings (0-10 scale, editable)
    category_ratings: {}
  });
  
  // Initialize edit data from inspection and live progress - only when inspection ID changes
  const [initializedInspectionId, setInitializedInspectionId] = useState(null);
  
  useEffect(() => {
    // Only initialize once per inspection ID to prevent resetting user edits
    if (!inspection || !liveProgressData || initializedInspectionId === inspection.id) return;
    
    // Handle assessment_summary - it might be an object or a string
    let assessmentSummary = inspection.assessment_summary || '';
    if (typeof assessmentSummary === 'object' && assessmentSummary !== null) {
      assessmentSummary = assessmentSummary.overall || '';
    }
    
    // Get market values from multiple possible sources
    const aiInsights = inspection.ai_insights || {};
    const marketValueMin = inspection.market_value_min || aiInsights.market_value?.min || 0;
    const marketValueMax = inspection.market_value_max || aiInsights.market_value?.max || 0;
    
    // Get overall rating - handle 0 as valid value
    const overallRating = inspection.overall_rating !== undefined && inspection.overall_rating !== null 
      ? inspection.overall_rating 
      : (aiInsights.overall_rating !== undefined && aiInsights.overall_rating !== null 
        ? aiInsights.overall_rating 
        : (liveProgressData?.ai_report?.overall_rating || 0));
    
    // Get fuel type from multiple sources
    const fuelType = inspection.fuel_type || inspection.vaahan_data?.fuel_type || '';
    
    setEditData({
      // From AI insights
      overall_rating: overallRating,
      recommended_to_buy: inspection.recommended_to_buy ?? aiInsights.recommended_to_buy ?? liveProgressData?.ai_report?.recommended_to_buy ?? false,
      market_value_min: marketValueMin,
      market_value_max: marketValueMax,
      assessment_summary: assessmentSummary,
      key_highlights: inspection.key_highlights || aiInsights.key_highlights || [],
      
      // Vehicle
      vehicle_make: inspection.vehicle_make || inspection.vaahan_data?.manufacturer || '',
      vehicle_model: inspection.vehicle_model || inspection.vaahan_data?.model || '',
      vehicle_year: inspection.vehicle_year || '',
      fuel_type: fuelType,
      transmission: inspection.transmission || (() => {
        // Extract transmission from model name if not set
        const model = (inspection.vaahan_data?.model || '').toUpperCase();
        if (model.includes(' MT') || model.endsWith('MT') || model.includes('(MT)') || model.includes('-MT')) return 'Manual';
        if (model.includes(' AT') || model.endsWith('AT') || model.includes('(AT)') || model.includes('-AT')) return 'Automatic';
        if (model.includes(' AMT') || model.endsWith('AMT') || model.includes('(AMT)') || model.includes('-AMT')) return 'AMT';
        if (model.includes(' CVT') || model.endsWith('CVT') || model.includes('(CVT)') || model.includes('-CVT')) return 'CVT';
        if (model.includes(' DCT') || model.endsWith('DCT') || model.includes('(DCT)') || model.includes('-DCT')) return 'DCT';
        return '';
      })(),
      vehicle_colour: inspection.vehicle_colour || inspection.vaahan_data?.color || '',
      engine_cc: inspection.engine_cc || 0,
      kms_driven: inspection.kms_driven || 0,
      owners: inspection.owners || parseInt(inspection.vaahan_data?.owner_count) || 0,
      
      // Conditions
      engine_condition: inspection.engine_condition || 'PENDING',
      interior_condition: inspection.interior_condition || 'PENDING',
      exterior_condition: inspection.exterior_condition || 'PENDING',
      transmission_condition: inspection.transmission_condition || 'PENDING',
      
      // Key Info
      accident_history: inspection.accident_history || false,
      flood_damage: inspection.flood_damage || false,
      dents_scratches: inspection.dents_scratches || false,
      
      // Insurance
      insurance_status: inspection.insurance_status || '',
      insurer_name: inspection.insurer_name || '',
      policy_number: inspection.policy_number || '',
      insurance_expiry: inspection.insurance_expiry || '',
      policy_type: inspection.policy_type || '',
      idv_value: inspection.idv_value || 0,
      
      // Repairs
      repairs: inspection.repairs || [],
      total_repair_cost_min: inspection.total_repair_cost_min || 0,
      total_repair_cost_max: inspection.total_repair_cost_max || 0,
      
      // RTO
      rto_verification_status: inspection.rto_verification_status || 'PENDING',
      hypothecation: inspection.hypothecation || '',
      blacklist_status: inspection.blacklist_status || false,
      
      // OBD
      obd_connected: liveProgressData?.obd_scan?.completed || false,
      dtc_codes: inspection.dtc_codes || [],
      
      // Category Ratings (0-10 scale) - Load from saved inspection data or empty
      category_ratings: inspection.category_ratings || {}
    });
    
    // Store original data for change tracking
    setOriginalData(JSON.stringify({
      overall_rating: overallRating,
      recommended_to_buy: inspection.recommended_to_buy || false,
      market_value_min: marketValueMin,
      market_value_max: marketValueMax,
      assessment_summary: assessmentSummary,
      repairs: inspection.repairs || []
    }));
    setHasUnsavedChanges(false);
    setInitializedInspectionId(inspection.id);
  }, [inspection?.id, liveProgressData, initializedInspectionId]);
  
  // Track changes
  useEffect(() => {
    if (originalData) {
      const currentData = JSON.stringify({
        overall_rating: editData.overall_rating,
        recommended_to_buy: editData.recommended_to_buy,
        market_value_min: editData.market_value_min,
        market_value_max: editData.market_value_max,
        assessment_summary: editData.assessment_summary,
        repairs: editData.repairs
      });
      setHasUnsavedChanges(currentData !== originalData);
    }
  }, [editData, originalData]);
  
  // Fetch repair parts and rules on mount
  useEffect(() => {
    const fetchRepairsData = async () => {
      if (!isOpen) return;
      setLoadingRepairs(true);
      try {
        const [partsRes, rulesRes] = await Promise.all([
          repairsApi.getParts(),
          repairsApi.getRules()
        ]);
        setRepairParts(partsRes.data || []);
        setRepairRules(rulesRes.data || []);
      } catch (err) {
        console.error('Failed to load repairs data:', err);
      } finally {
        setLoadingRepairs(false);
      }
    };
    fetchRepairsData();
  }, [isOpen]);
  
  // Auto-refresh effect
  useEffect(() => {
    let interval;
    if (isOpen && autoRefresh && inspection?.id) {
      interval = setInterval(() => {
        onRefresh(inspection.id);
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isOpen, autoRefresh, inspection?.id, onRefresh]);
  
  // Reset initialized inspection ID when modal closes
  useEffect(() => {
    if (!isOpen) {
      setInitializedInspectionId(null);
    }
  }, [isOpen]);
  
  // Auto-fetch Vaahan data when modal opens and vehicle details are empty
  useEffect(() => {
    const autoFetchVaahanData = async () => {
      // Only fetch if modal is open, we have an inspection ID, and vehicle details are missing
      if (!isOpen || !inspection?.id) return;
      
      // Check if vehicle details are missing
      const hasVehicleDetails = inspection.vehicle_make || inspection.vehicle_model || inspection.vaahan_data;
      if (hasVehicleDetails) return; // Already have vehicle data
      
      // Check if car number exists
      if (!inspection.car_number) return;
      
      try {
        const vaahanResponse = await inspectionsApi.fetchVaahanData(inspection.id);
        if (vaahanResponse.data?.success) {
          const updatedInspection = vaahanResponse.data.inspection || {};
          
          setEditData(prev => ({
            ...prev,
            vehicle_make: updatedInspection.vehicle_make || prev.vehicle_make,
            vehicle_model: updatedInspection.vehicle_model || prev.vehicle_model,
            vehicle_year: updatedInspection.vehicle_year || prev.vehicle_year,
            vehicle_colour: updatedInspection.vehicle_colour || prev.vehicle_colour,
            fuel_type: updatedInspection.fuel_type || prev.fuel_type,
            owners: updatedInspection.owners || prev.owners,
            insurer_name: updatedInspection.insurer_name || prev.insurer_name,
            insurance_expiry: updatedInspection.insurance_expiry || prev.insurance_expiry,
            insurance_status: updatedInspection.insurance_status || prev.insurance_status,
            policy_number: updatedInspection.policy_number || prev.policy_number,
            hypothecation: updatedInspection.hypothecation || prev.hypothecation,
            blacklist_status: updatedInspection.blacklist_status || prev.blacklist_status,
            rto_verification_status: updatedInspection.rto_verification_status || prev.rto_verification_status,
          }));
          
          if (onInspectionUpdated) {
            onInspectionUpdated(updatedInspection);
          }
          
          toast.success('Vehicle data loaded from Vaahan API');
        }
      } catch (err) {
        console.log('Auto Vaahan fetch failed:', err.message);
      }
    };
    
    autoFetchVaahanData();
  }, [isOpen, inspection?.id, inspection?.car_number, inspection?.vehicle_make, inspection?.vehicle_model, inspection?.vaahan_data, onInspectionUpdated]);
  
  // Helper function to convert rating (0-10) to condition string
  const ratingToCondition = (rating) => {
    if (rating >= 8) return 'GOOD';
    if (rating >= 4) return 'AVERAGE';
    if (rating > 0) return 'POOR';
    return 'PENDING';
  };
  
  // Update a single field - with auto-calculation for category ratings
  const updateField = (field, value) => {
    setEditData(prev => {
      const newData = { ...prev, [field]: value };
      
      // Auto-update condition ratings when category_ratings change
      if (field === 'category_ratings' && typeof value === 'object') {
        const categories = liveProgressData?.categories || [];
        
        // Calculate average ratings for engine, exterior, interior, transmission categories
        let engineRatings = [];
        let exteriorRatings = [];
        let interiorRatings = [];
        let transmissionRatings = [];
        
        categories.forEach(cat => {
          const catName = (cat.category_name || '').toLowerCase();
          const catKey = catName.replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
          const rating = value[catKey];
          
          if (rating !== undefined && rating !== null) {
            if (catName.includes('engine') || catName.includes('diagnos')) {
              engineRatings.push(rating);
            }
            if (catName.includes('exterior') || catName.includes('body') || catName.includes('paint')) {
              exteriorRatings.push(rating);
            }
            if (catName.includes('interior') || catName.includes('cabin') || catName.includes('seat')) {
              interiorRatings.push(rating);
            }
            if (catName.includes('transmission') || catName.includes('gearbox') || catName.includes('clutch')) {
              transmissionRatings.push(rating);
            }
          }
        });
        
        // Calculate averages and update conditions
        const avgRating = (ratings) => ratings.length > 0 ? Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length) : null;
        
        const engineAvg = avgRating(engineRatings);
        const exteriorAvg = avgRating(exteriorRatings);
        const interiorAvg = avgRating(interiorRatings);
        const transmissionAvg = avgRating(transmissionRatings);
        
        if (engineAvg !== null) newData.engine_condition = ratingToCondition(engineAvg);
        if (exteriorAvg !== null) newData.exterior_condition = ratingToCondition(exteriorAvg);
        if (interiorAvg !== null) newData.interior_condition = ratingToCondition(interiorAvg);
        if (transmissionAvg !== null) newData.transmission_condition = ratingToCondition(transmissionAvg);
      }
      
      return newData;
    });
  };
  
  // Add a repair item
  const addRepair = () => {
    setEditData(prev => ({
      ...prev,
      repairs: [...prev.repairs, { item: '', type: 'MINOR', estimated_cost: 0 }]
    }));
  };
  
  // Update a repair item
  const updateRepair = (index, updatedRepair) => {
    setEditData(prev => ({
      ...prev,
      repairs: prev.repairs.map((r, i) => i === index ? updatedRepair : r)
    }));
  };
  
  // Remove a repair item
  const removeRepair = (index) => {
    setEditData(prev => ({
      ...prev,
      repairs: prev.repairs.filter((_, i) => i !== index)
    }));
  };
  
  // Calculate total repair costs
  const calculateRepairTotals = () => {
    const total = editData.repairs.reduce((sum, r) => sum + (r.estimated_cost || 0), 0);
    // Minor repairs: +/- 10%, Major: +/- 20%
    const hasMinor = editData.repairs.some(r => r.type === 'MINOR');
    const hasMajor = editData.repairs.some(r => r.type === 'MAJOR' || r.type === 'CRITICAL');
    const variance = hasMajor ? 0.2 : hasMinor ? 0.1 : 0;
    return {
      min: Math.round(total * (1 - variance)),
      max: Math.round(total * (1 + variance))
    };
  };
  
  // Request OBD Rescan
  const requestObdRescan = async () => {
    if (!inspection?.id) return;
    setRequestingRescan(true);
    try {
      await inspectionsApi.requestObdRescan(inspection.id);
      toast.success('OBD rescan requested. Mechanic will be notified.');
      onRefresh(inspection.id);
    } catch (err) {
      toast.error('Failed to request OBD rescan');
      console.error(err);
    } finally {
      setRequestingRescan(false);
    }
  };
  
  // Get DTC codes from OBD data
  const dtcCodes = useMemo(() => {
    const obdData = liveProgressData?.obd_scan?.data;
    if (!obdData) return [];
    
    // Parse DTC codes from various possible formats
    if (Array.isArray(obdData.dtc_codes)) return obdData.dtc_codes;
    if (obdData.dtcCodes && Array.isArray(obdData.dtcCodes)) return obdData.dtcCodes;
    if (obdData.trouble_codes && Array.isArray(obdData.trouble_codes)) return obdData.trouble_codes;
    
    // Try to extract from nested structure
    const codes = [];
    if (obdData.diagnostic_trouble_codes) {
      Object.entries(obdData.diagnostic_trouble_codes).forEach(([system, systemCodes]) => {
        if (Array.isArray(systemCodes)) {
          codes.push(...systemCodes.map(c => ({ code: c.code || c, description: c.description || '', system })));
        }
      });
    }
    return codes;
  }, [liveProgressData?.obd_scan?.data]);
  
  // Calculate repairs based on inspection answers and rules
  const calculatedRepairCosts = useMemo(() => {
    if (!repairRules.length || !repairParts.length) return [];
    
    const repairs = [];
    const categories = liveProgressData?.categories || [];
    const carType = inspection?.car_type || 'sedan'; // Default to sedan
    const brand = inspection?.car_make || inspection?.vehicle_make || '';
    
    // Iterate through all answered questions and check rules
    categories.forEach(cat => {
      (cat.questions || []).forEach(q => {
        if (!q.answer) return;
        
        // Find matching rules for this question
        const matchingRules = repairRules.filter(rule => 
          rule.question_text?.toLowerCase().includes(q.question?.toLowerCase().substring(0, 30)) &&
          rule.is_active
        );
        
        matchingRules.forEach(rule => {
          const answer = String(q.answer).toLowerCase();
          const conditionValue = (rule.condition_value || '').toLowerCase();
          
          let matches = false;
          switch (rule.condition_type) {
            case 'EQUALS':
              matches = answer === conditionValue;
              break;
            case 'CONTAINS':
              matches = answer.includes(conditionValue);
              break;
            default:
              matches = answer.includes(conditionValue);
          }
          
          if (matches) {
            const part = repairParts.find(p => p.id === rule.part_id);
            if (part) {
              const pricing = part[carType.toLowerCase()] || part.sedan || {};
              const cost = rule.action_type === 'REPLACE' 
                ? (pricing.replace_price || 0) + (pricing.replace_labor || 0)
                : (pricing.repair_price || 0) + (pricing.repair_labor || 0);
              
              if (cost > 0) {
                repairs.push({
                  part_name: part.name,
                  category: part.category,
                  action: rule.action_type,
                  question: q.question,
                  answer: q.answer,
                  cost,
                  priority: rule.priority || 'normal'
                });
              }
            }
          }
        });
      });
    });
    
    return repairs;
  }, [repairRules, repairParts, liveProgressData?.categories, inspection]);
  
  // Save all changes
  const saveChanges = async () => {
    if (!inspection?.id) return;
    
    setSaving(true);
    try {
      // Calculate repair totals
      const repairTotals = calculateRepairTotals();
      
      const updatePayload = {
        ...editData,
        total_repair_cost_min: repairTotals.min,
        total_repair_cost_max: repairTotals.max,
        updated_at: new Date().toISOString()
      };
      
      await inspectionsApi.update(inspection.id, updatePayload);
      toast.success('Changes saved successfully');
      onRefresh(inspection.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };
  
  // Generate AI Report
  const generateAIReport = async () => {
    if (!inspection?.id) return;
    
    setGeneratingAI(true);
    try {
      const response = await inspectionsApi.generateAIReport(inspection.id, true);
      if (response.data.success) {
        toast.success('AI Report generated successfully');
        
        // Update local state with AI insights
        const ai = response.data.ai_insights;
        setEditData(prev => ({
          ...prev,
          overall_rating: ai.overall_rating || prev.overall_rating,
          recommended_to_buy: ai.recommended_to_buy ?? prev.recommended_to_buy,
          market_value_min: ai.market_value?.min || prev.market_value_min,
          market_value_max: ai.market_value?.max || prev.market_value_max,
          assessment_summary: typeof ai.assessment_summary === 'object' 
            ? ai.assessment_summary.overall || '' 
            : ai.assessment_summary || prev.assessment_summary,
          key_highlights: ai.key_highlights || prev.key_highlights,
          engine_condition: ai.condition_ratings?.engine || prev.engine_condition,
          interior_condition: ai.condition_ratings?.interior || prev.interior_condition,
          exterior_condition: ai.condition_ratings?.exterior || prev.exterior_condition,
          transmission_condition: ai.condition_ratings?.transmission || prev.transmission_condition
        }));
        
        onRefresh(inspection.id);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate AI report');
    } finally {
      setGeneratingAI(false);
    }
  };
  
  // Fetch Recommended Purchase Price (RPP) from car portals
  const fetchRPP = async () => {
    if (!inspection?.id) return;
    
    // Check if we have vehicle details
    const hasVehicleDetails = inspection.vehicle_make && inspection.vehicle_model;
    if (!hasVehicleDetails) {
      toast.error('Vehicle make and model are required to fetch market prices');
      return;
    }
    
    setFetchingRPP(true);
    try {
      const response = await inspectionsApi.fetchRPP(inspection.id);
      if (response.data.success) {
        toast.success(`Market prices fetched from ${response.data.sources_count} sources!`);
        
        // Update local state with RPP values
        setEditData(prev => ({
          ...prev,
          market_value_min: response.data.recommended_min || prev.market_value_min,
          market_value_max: response.data.recommended_max || prev.market_value_max,
        }));
        
        // Refresh inspection data to show full breakdown
        onRefresh(inspection.id);
      } else {
        toast.warning('Could not fetch market prices. Using estimation model.');
        onRefresh(inspection.id);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to fetch market prices');
    } finally {
      setFetchingRPP(false);
    }
  };
  
  // Generate Share URL
  const generateShareUrl = async () => {
    if (!inspection?.id) return;
    
    setGeneratingShareUrl(true);
    try {
      const response = await inspectionsApi.getShortUrl(inspection.id);
      if (response.data.url) {
        setShareUrl(response.data.url);
        toast.success('Share link generated!');
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate share link');
    } finally {
      setGeneratingShareUrl(false);
    }
  };
  
  // Copy share URL to clipboard
  const copyShareUrl = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Link copied to clipboard!');
    }
  };
  
  // Edit a single answer with predefined options
  const updateAnswer = async (questionId, newAnswer, options = []) => {
    if (!inspection?.id || !questionId) return;
    
    // If options provided, validate that newAnswer is in options
    if (options.length > 0 && !options.includes(newAnswer)) {
      toast.error('Please select a valid option');
      return;
    }
    
    setSavingAnswer(true);
    try {
      await inspectionsApi.editAnswer(inspection.id, questionId, { answer: newAnswer });
      toast.success('Answer updated successfully');
      setEditingAnswer(null);
      onRefresh(inspection.id);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update answer');
    } finally {
      setSavingAnswer(false);
    }
  };
  
  // Manual refresh - also fetches Vaahan data
  const handleManualRefresh = async () => {
    if (!inspection?.id) return;
    setRefreshing(true);
    try {
      // Fetch Vaahan data first to update vehicle details
      try {
        const vaahanResponse = await inspectionsApi.fetchVaahanData(inspection.id);
        if (vaahanResponse.data?.success) {
          // Update editData with fetched vehicle info
          const vaahanData = vaahanResponse.data.vaahan_data || {};
          const updatedInspection = vaahanResponse.data.inspection || {};
          
          setEditData(prev => ({
            ...prev,
            vehicle_make: updatedInspection.vehicle_make || prev.vehicle_make,
            vehicle_model: updatedInspection.vehicle_model || prev.vehicle_model,
            vehicle_year: updatedInspection.vehicle_year || prev.vehicle_year,
            vehicle_colour: updatedInspection.vehicle_colour || prev.vehicle_colour,
            fuel_type: updatedInspection.fuel_type || prev.fuel_type,
            owners: updatedInspection.owners || prev.owners,
            insurer_name: updatedInspection.insurer_name || prev.insurer_name,
            insurance_expiry: updatedInspection.insurance_expiry || prev.insurance_expiry,
            insurance_status: updatedInspection.insurance_status || prev.insurance_status,
            policy_number: updatedInspection.policy_number || prev.policy_number,
            hypothecation: updatedInspection.hypothecation || prev.hypothecation,
            blacklist_status: updatedInspection.blacklist_status || prev.blacklist_status,
            rto_verification_status: updatedInspection.rto_verification_status || prev.rto_verification_status,
          }));
          
          // Update the inspection object in parent component
          if (onInspectionUpdated) {
            onInspectionUpdated(updatedInspection);
          }
          
          toast.success('Vehicle data updated from Vaahan API');
        } else {
          // Vaahan API failed but we should still try to refresh the inspection data
          // to get any market_price_research that might have been generated by AI report
          try {
            const inspectionResponse = await inspectionsApi.getById(inspection.id);
            if (inspectionResponse.data && onInspectionUpdated) {
              onInspectionUpdated(inspectionResponse.data);
            }
          } catch (e) {
            console.log('Could not refresh inspection data:', e.message);
          }
        }
      } catch (vaahanError) {
        console.log('Vaahan fetch skipped or failed:', vaahanError?.response?.data?.error || vaahanError.message);
        // Even if Vaahan fails, still try to refresh the inspection data
        try {
          const inspectionResponse = await inspectionsApi.getById(inspection.id);
          if (inspectionResponse.data && onInspectionUpdated) {
            onInspectionUpdated(inspectionResponse.data);
          }
        } catch (e) {
          console.log('Could not refresh inspection data:', e.message);
        }
      }
      
      // Also refresh live progress data
      await onRefresh(inspection.id);
      toast.success('Data refreshed');
    } finally {
      setTimeout(() => setRefreshing(false), 500);
    }
  };
  
  // Get categories to display based on filter
  const categoriesToDisplay = selectedCategoryId 
    ? liveProgressData?.categories?.filter(c => c.category_id === selectedCategoryId)
    : liveProgressData?.categories;
  
  // Get completion stats
  const stats = liveProgressData?.overall_stats || {};
  const aiReport = liveProgressData?.ai_report || {};
  
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[1000px] max-h-[95vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white">
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-white/20 flex items-center justify-center">
                <Activity className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-lg font-semibold flex items-center gap-2">
                  Inspection Editor
                  {stats.completion_percentage === 100 && (
                    <span className="text-xs bg-green-400 text-green-900 px-2 py-0.5 rounded-full">Complete</span>
                  )}
                </p>
                <p className="text-sm text-blue-100 font-normal">
                  {inspection?.customer_name} • {inspection?.car_number}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Refresh Controls */}
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleManualRefresh}
                  disabled={refreshing}
                  className="h-9 px-3 bg-white/10 hover:bg-white/20 text-white"
                  data-testid="refresh-btn"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
                <div className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                  <span className="text-xs text-blue-100">Auto</span>
                  <Switch
                    checked={autoRefresh}
                    onCheckedChange={setAutoRefresh}
                    className="data-[state=checked]:bg-green-500 scale-75"
                  />
                  {autoRefresh && (
                    <span className="text-xs text-green-300 animate-pulse">5s</span>
                  )}
                </div>
              </div>
              
              {/* Progress indicator */}
              <div className="text-right">
                <p className="text-3xl font-bold">{stats.completion_percentage || 0}%</p>
                <p className="text-xs text-blue-200">{stats.answered_questions || 0}/{stats.total_questions || 0} questions</p>
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        {/* Tabs Navigation */}
        <div className="border-b bg-gray-50 px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-transparent h-12 p-0 gap-1">
              <TabsTrigger value="ai-analysis" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-t-lg rounded-b-none h-10 px-4">
                <Zap className="h-4 w-4 mr-2" />
                AI Analysis
              </TabsTrigger>
              <TabsTrigger value="vehicle" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-t-lg rounded-b-none h-10 px-4">
                <Car className="h-4 w-4 mr-2" />
                Vehicle & RTO
              </TabsTrigger>
              <TabsTrigger value="obd" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-t-lg rounded-b-none h-10 px-4">
                <Gauge className="h-4 w-4 mr-2" />
                OBD-2
                {liveProgressData?.obd_scan?.completed && (
                  <span className="ml-2 h-2 w-2 rounded-full bg-green-500"></span>
                )}
              </TabsTrigger>
              <TabsTrigger value="repairs" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-t-lg rounded-b-none h-10 px-4">
                <Wrench className="h-4 w-4 mr-2" />
                Repairs
                {calculatedRepairCosts.length > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">{calculatedRepairCosts.length}</span>
                )}
              </TabsTrigger>
              <TabsTrigger value="inspection" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-t-lg rounded-b-none h-10 px-4">
                <ClipboardList className="h-4 w-4 mr-2" />
                Q&A Details
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {/* Content - Scrollable area with proper height */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-4 pb-6">
              <Tabs value={activeTab} className="w-full">
                {/* AI Analysis Tab (formerly Overview) */}
                <TabsContent value="ai-analysis" className="space-y-4 mt-0">
              {/* Share Report Button */}
              <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                <div>
                  <h4 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Share2 className="h-5 w-5 text-blue-600" />
                    Share Report with Customer
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">Generate a secure OTP-protected link for the customer</p>
                </div>
                <div className="flex items-center gap-2">
                  {shareUrl ? (
                    <>
                      <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border">
                        <span className="text-xs text-gray-600 max-w-[200px] truncate">{shareUrl}</span>
                        <Button variant="ghost" size="sm" onClick={copyShareUrl} className="h-7 w-7 p-0">
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => window.open(shareUrl, '_blank')} className="h-7 w-7 p-0">
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </div>
                    </>
                  ) : (
                    <Button
                      onClick={generateShareUrl}
                      disabled={generatingShareUrl}
                      className="bg-blue-600 hover:bg-blue-700"
                      data-testid="share-report-btn"
                    >
                      {generatingShareUrl ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating...</>
                      ) : (
                        <><Share2 className="h-4 w-4 mr-2" />Generate Link</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
              
              {/* AI Report Section */}
              <div className={`rounded-xl p-4 border-2 ${
                aiReport.stale ? 'border-amber-300 bg-amber-50' : 'border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50'
              }`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">✨</span>
                    <h3 className="font-semibold text-gray-900">AI Analysis</h3>
                    {aiReport.generated && !aiReport.stale && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">Generated</span>
                    )}
                    {aiReport.stale && (
                      <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Needs Update</span>
                    )}
                  </div>
                  <Button
                    onClick={generateAIReport}
                    disabled={generatingAI}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    data-testid="generate-ai-btn"
                  >
                    {generatingAI ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" />Generating...</>
                    ) : (
                      <><Zap className="h-4 w-4 mr-2" />{aiReport.generated ? 'Regenerate' : 'Generate AI Report'}</>
                    )}
                  </Button>
                </div>
                
                {/* AI Generated Values - Editable */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-white rounded-lg p-3 border">
                    <Label className="text-xs text-gray-500">Overall Rating</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Input
                        type="number"
                        min="0"
                        max="10"
                        step="0.5"
                        value={editData.overall_rating}
                        onChange={(e) => updateField('overall_rating', parseFloat(e.target.value) || 0)}
                        className="h-8 w-16 text-center font-bold"
                        disabled={!canEdit}
                      />
                      <span className="text-sm text-gray-500">/ 10</span>
                      <Star className="h-5 w-5 text-yellow-500" />
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-lg p-3 border">
                    <Label className="text-xs text-gray-500">Recommendation</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <Switch
                        checked={editData.recommended_to_buy}
                        onCheckedChange={(val) => updateField('recommended_to_buy', val)}
                        disabled={!canEdit}
                      />
                      <span className={`text-sm font-medium ${editData.recommended_to_buy ? 'text-green-600' : 'text-red-600'}`}>
                        {editData.recommended_to_buy ? 'Recommended' : 'Not Recommended'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* RPP - Recommended Purchase Price Section */}
                <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border-2 border-green-200">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xl">💰</span>
                      <h3 className="font-semibold text-gray-900">Recommended Purchase Price (RPP)</h3>
                      {inspection?.market_price_research?.market_average > 0 && (
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                          {inspection.market_price_research.sources_count} sources
                        </span>
                      )}
                    </div>
                    <Button
                      onClick={fetchRPP}
                      disabled={fetchingRPP || !inspection?.vehicle_make || !inspection?.vehicle_model}
                      size="sm"
                      className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
                      data-testid="fetch-rpp-btn"
                    >
                      {fetchingRPP ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />Fetching...</>
                      ) : (
                        <><RefreshCw className="h-4 w-4 mr-2" />Fetch Market Prices</>
                      )}
                    </Button>
                  </div>
                  
                  <p className="text-xs text-gray-600 mb-3">
                    Scrapes prices from OLX, Spinny, Cars24, CarWale, CarDekho to recommend a fair purchase price (5-10% below market average)
                  </p>
                  
                  {/* RPP Input Fields */}
                  <div className="bg-white rounded-lg p-3 border mb-3">
                    <Label className="text-xs text-gray-500">Recommended Price Range</Label>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-gray-500 font-medium">₹</span>
                      <Input
                        type="number"
                        value={editData.market_value_min}
                        onChange={(e) => updateField('market_value_min', parseFloat(e.target.value) || 0)}
                        className="h-9 text-sm font-semibold"
                        placeholder="Min"
                        disabled={!canEdit}
                      />
                      <span className="text-gray-400 font-medium">to</span>
                      <span className="text-gray-500 font-medium">₹</span>
                      <Input
                        type="number"
                        value={editData.market_value_max}
                        onChange={(e) => updateField('market_value_max', parseFloat(e.target.value) || 0)}
                        className="h-9 text-sm font-semibold"
                        placeholder="Max"
                        disabled={!canEdit}
                      />
                    </div>
                    {editData.market_value_min > 0 && editData.market_value_max > 0 && (
                      <p className="text-sm font-bold text-green-700 mt-2">
                        ₹{(editData.market_value_min / 100000).toFixed(2)} - ₹{(editData.market_value_max / 100000).toFixed(2)} Lakh
                      </p>
                    )}
                  </div>
                  
                  {/* Market Research Results - Website-wise breakdown */}
                  {inspection?.market_price_research?.market_average > 0 ? (
                    <div className="space-y-3">
                      {/* Market Average Card */}
                      <div className="bg-white rounded-lg p-3 border">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600 font-medium">Market Average</span>
                          <span className="text-lg font-bold text-gray-800">
                            ₹{(inspection.market_price_research.market_average / 100000).toFixed(2)} Lakh
                          </span>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                          <span className="text-xs text-gray-500">Price Range</span>
                          <span className="text-sm text-gray-600">
                            ₹{(inspection.market_price_research.market_min / 100000).toFixed(2)}L - ₹{(inspection.market_price_research.market_max / 100000).toFixed(2)}L
                          </span>
                        </div>
                        {inspection.market_price_research.estimation_method && (
                          <div className="flex items-center gap-1 mt-2">
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                              {inspection.market_price_research.estimation_method === 'web_scraping' ? '🌐 Web Scraped' : '📊 Estimated'}
                            </span>
                            {inspection.market_price_research.fetched_at && (
                              <span className="text-xs text-gray-400">
                                {new Date(inspection.market_price_research.fetched_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Website-wise Price Cards */}
                      {inspection.market_price_research.sources?.length > 0 && (
                        <div>
                          <span className="text-xs font-semibold text-gray-700 mb-2 block">Prices by Portal</span>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {inspection.market_price_research.sources.map((source, idx) => {
                              // Website color coding
                              const getSourceStyle = (name) => {
                                switch(name) {
                                  case 'CarDekho': return 'bg-orange-50 border-orange-200 text-orange-700';
                                  case 'CarWale': return 'bg-blue-50 border-blue-200 text-blue-700';
                                  case 'Cars24': return 'bg-yellow-50 border-yellow-200 text-yellow-700';
                                  case 'Spinny': return 'bg-purple-50 border-purple-200 text-purple-700';
                                  case 'OLX': return 'bg-green-50 border-green-200 text-green-700';
                                  default: return 'bg-gray-50 border-gray-200 text-gray-700';
                                }
                              };
                              const getSourceIcon = (name) => {
                                switch(name) {
                                  case 'CarDekho': return '🚗';
                                  case 'CarWale': return '🏎️';
                                  case 'Cars24': return '🚙';
                                  case 'Spinny': return '🔄';
                                  case 'OLX': return '📦';
                                  default: return '🌐';
                                }
                              };
                              return (
                                <div 
                                  key={idx} 
                                  className={`flex items-center justify-between rounded-lg px-3 py-2 border ${getSourceStyle(source.source)}`}
                                >
                                  <div className="flex items-center gap-2">
                                    <span>{getSourceIcon(source.source)}</span>
                                    <span className="font-medium text-sm">{source.source}</span>
                                  </div>
                                  <span className="font-bold text-sm">₹{(source.price / 100000).toFixed(2)}L</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg p-3 border">
                      <div className="flex items-center gap-3 text-amber-700">
                        <AlertCircle className="h-5 w-5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium">No market price data available</p>
                          <p className="text-xs text-gray-500 mt-1">
                            {inspection?.vehicle_make && inspection?.vehicle_model 
                              ? 'Click "Fetch Market Prices" to get prices from OLX, Spinny, Cars24, CarWale, CarDekho'
                              : 'Vehicle make and model are required to fetch market prices'
                            }
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* AI-Powered Assessment Summary */}
              <Section title="AI Assessment Summary" icon={FileText} defaultOpen={true}>
                <div className="space-y-4">
                  {/* AI Generated Badge */}
                  {inspection?.ai_insights?.ai_generated && (
                    <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                      <Sparkles className="h-4 w-4 text-purple-600" />
                      <span className="text-sm text-purple-700 font-medium">AI Generated Analysis</span>
                      {inspection?.ai_insights?.generated_at && (
                        <span className="text-xs text-purple-500 ml-auto">
                          {new Date(inspection.ai_insights.generated_at).toLocaleString()}
                        </span>
                      )}
                    </div>
                  )}
                  
                  {/* Section-wise Assessment from AI */}
                  {inspection?.ai_insights?.assessment_summary && typeof inspection.ai_insights.assessment_summary === 'object' && (
                    <div className="bg-slate-50 rounded-lg p-4 border space-y-3">
                      <h4 className="font-semibold text-gray-800 flex items-center gap-2">
                        <ClipboardList className="h-4 w-4 text-blue-600" />
                        Section-wise Assessment
                      </h4>
                      
                      {/* Overall */}
                      {inspection.ai_insights.assessment_summary.overall && (
                        <div className="bg-white rounded-lg p-3 border-l-4 border-l-blue-500">
                          <p className="text-xs font-semibold text-blue-600 uppercase">Overall</p>
                          <p className="text-sm text-gray-700 mt-1">{inspection.ai_insights.assessment_summary.overall}</p>
                        </div>
                      )}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {/* Engine & Mechanical */}
                        {inspection.ai_insights.assessment_summary.engine_and_mechanical && (
                          <div className="bg-white rounded-lg p-3 border">
                            <p className="text-xs font-semibold text-gray-500 uppercase">🔧 Engine & Mechanical</p>
                            <p className="text-sm text-gray-700 mt-1">{inspection.ai_insights.assessment_summary.engine_and_mechanical}</p>
                          </div>
                        )}
                        
                        {/* Exterior Body */}
                        {inspection.ai_insights.assessment_summary.exterior_body && (
                          <div className="bg-white rounded-lg p-3 border">
                            <p className="text-xs font-semibold text-gray-500 uppercase">🚗 Exterior Body</p>
                            <p className="text-sm text-gray-700 mt-1">{inspection.ai_insights.assessment_summary.exterior_body}</p>
                          </div>
                        )}
                        
                        {/* Interior Comfort */}
                        {inspection.ai_insights.assessment_summary.interior_comfort && (
                          <div className="bg-white rounded-lg p-3 border">
                            <p className="text-xs font-semibold text-gray-500 uppercase">🛋️ Interior Comfort</p>
                            <p className="text-sm text-gray-700 mt-1">{inspection.ai_insights.assessment_summary.interior_comfort}</p>
                          </div>
                        )}
                        
                        {/* Safety Systems */}
                        {inspection.ai_insights.assessment_summary.safety_systems && (
                          <div className="bg-white rounded-lg p-3 border">
                            <p className="text-xs font-semibold text-gray-500 uppercase">🛡️ Safety Systems</p>
                            <p className="text-sm text-gray-700 mt-1">{inspection.ai_insights.assessment_summary.safety_systems}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Editable Summary (fallback or override) */}
                  <EditableField
                    label="Custom Summary"
                    value={editData.assessment_summary}
                    onChange={(val) => updateField('assessment_summary', val)}
                    type="textarea"
                    placeholder="Enter vehicle assessment summary..."
                    disabled={!canEdit}
                  />
                  
                  {/* Key Highlights from AI */}
                  <div className="bg-green-50 rounded-lg p-4 border border-green-200">
                    <Label className="text-sm font-semibold text-green-800 mb-3 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" />
                      Key Highlights
                    </Label>
                    <div className="space-y-2">
                      {/* AI Generated Highlights */}
                      {inspection?.ai_insights?.key_highlights?.length > 0 && (
                        <div className="space-y-1 mb-3">
                          {inspection.ai_insights.key_highlights.map((highlight, idx) => (
                            <div key={`ai-${idx}`} className="flex items-start gap-2 text-sm text-green-700">
                              <span className="text-green-500 mt-0.5">✓</span>
                              <span>{highlight}</span>
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Editable Highlights */}
                      {(editData.key_highlights || []).map((highlight, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <Input
                            value={highlight}
                            onChange={(e) => {
                              const newHighlights = [...editData.key_highlights];
                              newHighlights[idx] = e.target.value;
                              updateField('key_highlights', newHighlights);
                            }}
                            className="h-8 text-sm"
                            disabled={!canEdit}
                          />
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                const newHighlights = editData.key_highlights.filter((_, i) => i !== idx);
                                updateField('key_highlights', newHighlights);
                              }}
                              className="h-8 w-8 p-0 text-red-500"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      {canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => updateField('key_highlights', [...(editData.key_highlights || []), ''])}
                          className="text-xs"
                        >
                          + Add Highlight
                        </Button>
                      )}
                    </div>
                  </div>
                  
                  {/* Concerns from AI */}
                  {inspection?.ai_insights?.concerns?.length > 0 && (
                    <div className="bg-red-50 rounded-lg p-4 border border-red-200">
                      <Label className="text-sm font-semibold text-red-800 mb-3 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        Concerns Identified
                      </Label>
                      <div className="space-y-1">
                        {inspection.ai_insights.concerns.map((concern, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-sm text-red-700">
                            <span className="text-red-500 mt-0.5">⚠</span>
                            <span>{concern}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Risk Factors */}
                  {inspection?.ai_insights?.risk_factors?.length > 0 && (
                    <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                      <Label className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Risk Factors
                      </Label>
                      <div className="space-y-1">
                        {inspection.ai_insights.risk_factors.map((risk, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-sm text-amber-700">
                            <span className="text-amber-500 mt-0.5">!</span>
                            <span>{risk}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Recommendations */}
                  {inspection?.ai_insights?.recommendations?.length > 0 && (
                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
                      <Label className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4" />
                        Recommendations
                      </Label>
                      <div className="space-y-1">
                        {inspection.ai_insights.recommendations.map((rec, idx) => (
                          <div key={idx} className="flex items-start gap-2 text-sm text-blue-700">
                            <span className="text-blue-500 mt-0.5">→</span>
                            <span>{rec}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
              
              {/* Condition Ratings - From AI Analysis or inspection fields */}
              <Section title="Condition Ratings" icon={Gauge} defaultOpen={true}>
                {inspection?.inspection_status !== 'INSPECTION_COMPLETED' && inspection?.status !== 'COMPLETED' ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                    <AlertCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                    <p className="text-sm text-yellow-700 font-medium">Inspection Not Complete</p>
                    <p className="text-xs text-yellow-600 mt-1">
                      Condition ratings will be generated by AI after the mechanic completes all Q&A categories and marks the inspection as complete.
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 mb-3">
                      Vehicle condition ratings from AI analysis. POOR = needs attention, AVERAGE = acceptable, GOOD = excellent
                    </p>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {/* Engine */}
                      {(() => {
                        // Use AI insights condition_ratings first, then top-level field, then editData
                        const aiCondition = inspection?.ai_insights?.condition_ratings?.engine;
                        const topLevelCondition = inspection?.engine_condition || editData.engine_condition;
                        const condition = (aiCondition || topLevelCondition || 'PENDING').toUpperCase();
                    return (
                      <div className={`p-3 rounded-lg border ${
                        condition === 'GOOD' ? 'bg-green-50 border-green-300' :
                        condition === 'AVERAGE' ? 'bg-yellow-50 border-yellow-300' :
                        condition === 'POOR' ? 'bg-red-50 border-red-300' :
                        'bg-gray-50 border-gray-300'
                      }`}>
                        <p className="text-xs text-gray-500 font-medium">🔧 Engine</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className={`text-lg font-bold ${
                            condition === 'GOOD' ? 'text-green-700' :
                            condition === 'AVERAGE' ? 'text-yellow-700' :
                            condition === 'POOR' ? 'text-red-700' :
                            'text-gray-500'
                          }`}>{condition}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">From: AI Analysis</p>
                      </div>
                    );
                  })()}
                  
                  {/* Exterior */}
                  {(() => {
                    const aiCondition = inspection?.ai_insights?.condition_ratings?.exterior;
                    const topLevelCondition = inspection?.exterior_condition || editData.exterior_condition;
                    const condition = (aiCondition || topLevelCondition || 'PENDING').toUpperCase();
                    return (
                      <div className={`p-3 rounded-lg border ${
                        condition === 'GOOD' ? 'bg-green-50 border-green-300' :
                        condition === 'AVERAGE' ? 'bg-yellow-50 border-yellow-300' :
                        condition === 'POOR' ? 'bg-red-50 border-red-300' :
                        'bg-gray-50 border-gray-300'
                      }`}>
                        <p className="text-xs text-gray-500 font-medium">🚗 Exterior</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className={`text-lg font-bold ${
                            condition === 'GOOD' ? 'text-green-700' :
                            condition === 'AVERAGE' ? 'text-yellow-700' :
                            condition === 'POOR' ? 'text-red-700' :
                            'text-gray-500'
                          }`}>{condition}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">From: AI Analysis</p>
                      </div>
                    );
                  })()}
                  
                  {/* Interior */}
                  {(() => {
                    const aiCondition = inspection?.ai_insights?.condition_ratings?.interior;
                    const topLevelCondition = inspection?.interior_condition || editData.interior_condition;
                    const condition = (aiCondition || topLevelCondition || 'PENDING').toUpperCase();
                    return (
                      <div className={`p-3 rounded-lg border ${
                        condition === 'GOOD' ? 'bg-green-50 border-green-300' :
                        condition === 'AVERAGE' ? 'bg-yellow-50 border-yellow-300' :
                        condition === 'POOR' ? 'bg-red-50 border-red-300' :
                        'bg-gray-50 border-gray-300'
                      }`}>
                        <p className="text-xs text-gray-500 font-medium">🛋️ Interior</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className={`text-lg font-bold ${
                            condition === 'GOOD' ? 'text-green-700' :
                            condition === 'AVERAGE' ? 'text-yellow-700' :
                            condition === 'POOR' ? 'text-red-700' :
                            'text-gray-500'
                          }`}>{condition}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">From: AI Analysis</p>
                      </div>
                    );
                  })()}
                  
                  {/* Transmission */}
                  {(() => {
                    const aiCondition = inspection?.ai_insights?.condition_ratings?.transmission;
                    const topLevelCondition = inspection?.transmission_condition || editData.transmission_condition;
                    const condition = (aiCondition || topLevelCondition || 'PENDING').toUpperCase();
                    return (
                      <div className={`p-3 rounded-lg border ${
                        condition === 'GOOD' ? 'bg-green-50 border-green-300' :
                        condition === 'AVERAGE' ? 'bg-yellow-50 border-yellow-300' :
                        condition === 'POOR' ? 'bg-red-50 border-red-300' :
                        'bg-gray-50 border-gray-300'
                      }`}>
                        <p className="text-xs text-gray-500 font-medium">⚙️ Transmission</p>
                        <div className="flex items-center justify-between mt-1">
                          <span className={`text-lg font-bold ${
                            condition === 'GOOD' ? 'text-green-700' :
                            condition === 'AVERAGE' ? 'text-yellow-700' :
                            condition === 'POOR' ? 'text-red-700' :
                            'text-gray-500'
                          }`}>{condition}</span>
                        </div>
                        <p className="text-xs text-gray-400 mt-1">From: AI Analysis</p>
                      </div>
                    );
                  })()}
                    </div>
                  </>
                )}
              </Section>
              
              {/* Mechanic Info */}
              {liveProgressData?.mechanic_name && (
                <div className="bg-slate-50 rounded-xl p-4 border flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                      <User className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Assigned Mechanic</p>
                      <p className="font-semibold">{liveProgressData.mechanic_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Auto Refresh</p>
                      <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => onRefresh(inspection?.id)}>
                      <RefreshCw className="h-4 w-4 mr-1" />
                      Refresh
                    </Button>
                  </div>
                </div>
              )}
            </TabsContent>
            
            {/* Vehicle Tab - Comprehensive Vaahan API Data */}
            <TabsContent value="vehicle" className="space-y-4 mt-0">
              {/* Vaahan API Data Banner */}
              {inspection?.vaahan_data && (
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200 flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                    <Shield className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-blue-800">Vaahan API Verified</p>
                    <p className="text-xs text-blue-600">Data fetched from RTO database</p>
                  </div>
                  <span className={`ml-auto px-3 py-1 rounded-full text-xs font-semibold ${
                    inspection.vaahan_data.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {inspection.vaahan_data.status || 'ACTIVE'}
                  </span>
                </div>
              )}
              
              {/* Vehicle Identification */}
              <Section title="Vehicle Identification" icon={Car} defaultOpen={true}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <EditableField label="Registration No." value={editData.car_number || inspection?.car_number} onChange={(val) => updateField('car_number', val)} disabled={!canEdit} />
                  <EditableField label="Engine Number" value={editData.engine_number || inspection?.vaahan_data?.engine_number} onChange={(val) => updateField('engine_number', val)} disabled={!canEdit} placeholder="From Vaahan API" />
                  <EditableField label="Chassis Number" value={editData.chassis_number || inspection?.vaahan_data?.chassis_number} onChange={(val) => updateField('chassis_number', val)} disabled={!canEdit} placeholder="From Vaahan API" />
                </div>
              </Section>
              
              {/* Vehicle Details */}
              <Section title="Vehicle Details" icon={Car} defaultOpen={true}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <EditableField label="Make" value={editData.vehicle_make} onChange={(val) => updateField('vehicle_make', val)} disabled={!canEdit} />
                  <EditableField label="Model" value={editData.vehicle_model} onChange={(val) => updateField('vehicle_model', val)} disabled={!canEdit} />
                  <EditableField label="Year" value={editData.vehicle_year} onChange={(val) => updateField('vehicle_year', val)} type="number" disabled={!canEdit} />
                  <EditableField label="Colour" value={editData.vehicle_colour} onChange={(val) => updateField('vehicle_colour', val)} disabled={!canEdit} />
                  <EditableField label="Fuel Type" value={editData.fuel_type} onChange={(val) => updateField('fuel_type', val)} type="select" options={['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid', 'LPG']} disabled={!canEdit} />
                  <EditableField label="Transmission" value={editData.transmission} onChange={(val) => updateField('transmission', val)} type="select" options={['Manual', 'Automatic', 'CVT', 'DCT', 'AMT']} disabled={!canEdit} />
                  <EditableField label="Body Type" value={editData.body_type || inspection?.vaahan_data?.body_type} onChange={(val) => updateField('body_type', val)} disabled={!canEdit} />
                  <EditableField label="Vehicle Class" value={editData.vehicle_class || inspection?.vaahan_data?.vehicle_class} onChange={(val) => updateField('vehicle_class', val)} disabled={!canEdit} />
                </div>
              </Section>
              
              {/* Technical Specifications (from Vaahan API) */}
              <Section title="Technical Specifications" icon={Settings} defaultOpen={false}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <EditableField label="Engine CC" value={editData.engine_cc || inspection?.vaahan_data?.cubic_capacity} onChange={(val) => updateField('engine_cc', val)} type="number" disabled={!canEdit} />
                  <EditableField label="Cylinders" value={editData.cylinders || inspection?.vaahan_data?.cylinders} onChange={(val) => updateField('cylinders', val)} type="number" disabled={!canEdit} />
                  <EditableField label="Seating Capacity" value={editData.seating_capacity || inspection?.vaahan_data?.seating_capacity} onChange={(val) => updateField('seating_capacity', val)} type="number" disabled={!canEdit} />
                  <EditableField label="Gross Weight (kg)" value={editData.gross_weight || inspection?.vaahan_data?.gross_weight} onChange={(val) => updateField('gross_weight', val)} type="number" disabled={!canEdit} />
                  <EditableField label="Unladen Weight (kg)" value={editData.unladen_weight || inspection?.vaahan_data?.unladen_weight} onChange={(val) => updateField('unladen_weight', val)} type="number" disabled={!canEdit} />
                  <EditableField label="Wheelbase (mm)" value={editData.wheelbase || inspection?.vaahan_data?.wheelbase} onChange={(val) => updateField('wheelbase', val)} type="number" disabled={!canEdit} />
                  <EditableField label="Emission Norms" value={editData.emission_norms || inspection?.vaahan_data?.emission_norms} onChange={(val) => updateField('emission_norms', val)} disabled={!canEdit} />
                  <EditableField label="KMs Driven" value={editData.kms_driven} onChange={(val) => updateField('kms_driven', val)} type="number" disabled={!canEdit} />
                </div>
              </Section>
              
              {/* Registration & Manufacturing */}
              <Section title="Registration Details" icon={FileText} defaultOpen={false}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <EditableField label="Mfg. Date" value={editData.manufacturing_date || inspection?.vaahan_data?.manufacturing_date} onChange={(val) => updateField('manufacturing_date', val)} disabled={!canEdit} />
                  <EditableField label="Reg. Date" value={editData.registration_date || inspection?.vaahan_data?.registration_date} onChange={(val) => updateField('registration_date', val)} disabled={!canEdit} />
                  <EditableField label="RC Expiry" value={editData.rc_expiry_date || inspection?.vaahan_data?.rc_expiry_date} onChange={(val) => updateField('rc_expiry_date', val)} disabled={!canEdit} />
                  <EditableField label="Reg. Authority (RTO)" value={editData.registration_authority || inspection?.vaahan_data?.registration_authority} onChange={(val) => updateField('registration_authority', val)} disabled={!canEdit} />
                  <EditableField label="Owner Count" value={editData.owners || inspection?.vaahan_data?.owner_count} onChange={(val) => updateField('owners', val)} type="number" disabled={!canEdit} />
                  <EditableField label="Current Owner" value={editData.owner_name || inspection?.vaahan_data?.owner_name} onChange={(val) => updateField('owner_name', val)} disabled={!canEdit} />
                </div>
              </Section>
              
              {/* Insurance Details */}
              <Section title="Insurance Details" icon={Shield} defaultOpen={false}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <EditableField label="Status" value={editData.insurance_status} onChange={(val) => updateField('insurance_status', val)} type="select" options={['Active', 'Expired', 'Unknown']} disabled={!canEdit} />
                  <EditableField label="Insurance Company" value={editData.insurer_name || inspection?.vaahan_data?.insurance_company} onChange={(val) => updateField('insurer_name', val)} disabled={!canEdit} />
                  <EditableField label="Policy Number" value={editData.policy_number || inspection?.vaahan_data?.insurance_policy_number} onChange={(val) => updateField('policy_number', val)} disabled={!canEdit} />
                  <EditableField label="Valid Upto" value={editData.insurance_expiry || inspection?.vaahan_data?.insurance_valid_upto} onChange={(val) => updateField('insurance_expiry', val)} disabled={!canEdit} />
                  <EditableField label="Policy Type" value={editData.policy_type} onChange={(val) => updateField('policy_type', val)} type="select" options={['Comprehensive', 'Third Party', 'Zero Dep']} disabled={!canEdit} />
                  <EditableField label="IDV Value" value={editData.idv_value} onChange={(val) => updateField('idv_value', val)} type="number" disabled={!canEdit} />
                </div>
              </Section>
              
              {/* RTO Verification & Finance */}
              <Section title="RTO Verification & Finance" icon={Shield} defaultOpen={true}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <EditableField
                    label="Verification Status"
                    value={editData.rto_verification_status}
                    onChange={(val) => updateField('rto_verification_status', val)}
                    type="select"
                    options={['VERIFIED', 'PENDING', 'FAILED', 'NOT_AVAILABLE']}
                    disabled={!canEdit}
                  />
                  <EditableField
                    label="Financed"
                    value={editData.is_financed ?? inspection?.vaahan_data?.financed}
                    onChange={(val) => updateField('is_financed', val)}
                    type="switch"
                    disabled={!canEdit}
                  />
                  <EditableField
                    label="Financier / Hypothecation"
                    value={editData.hypothecation || inspection?.vaahan_data?.financer}
                    onChange={(val) => updateField('hypothecation', val)}
                    placeholder="Bank/Financier name"
                    disabled={!canEdit}
                  />
                  <EditableField
                    label="Blacklisted"
                    value={editData.blacklist_status ?? inspection?.vaahan_data?.blacklist_status}
                    onChange={(val) => updateField('blacklist_status', val)}
                    type="switch"
                    disabled={!canEdit}
                  />
                  <EditableField
                    label="Tax Valid Upto"
                    value={editData.tax_valid_upto || inspection?.vaahan_data?.tax_valid_upto}
                    onChange={(val) => updateField('tax_valid_upto', val)}
                    disabled={!canEdit}
                  />
                  <EditableField
                    label="Fitness Valid Upto"
                    value={editData.fitness_upto || inspection?.vaahan_data?.fitness_upto}
                    onChange={(val) => updateField('fitness_upto', val)}
                    disabled={!canEdit}
                  />
                </div>
              </Section>
              
              {/* PUCC Details */}
              <Section title="PUCC (Pollution) Details" icon={Zap} defaultOpen={false}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <EditableField label="PUCC Number" value={editData.pucc_number || inspection?.vaahan_data?.pucc_number} onChange={(val) => updateField('pucc_number', val)} disabled={!canEdit} />
                  <EditableField label="PUCC Valid Upto" value={editData.pucc_valid_upto || inspection?.vaahan_data?.pucc_valid_upto} onChange={(val) => updateField('pucc_valid_upto', val)} disabled={!canEdit} />
                </div>
              </Section>
              
              {/* Vehicle History */}
              <Section title="Vehicle History" icon={History} defaultOpen={false}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <EditableField label="Accident History" value={editData.accident_history} onChange={(val) => updateField('accident_history', val)} type="switch" disabled={!canEdit} />
                  <EditableField label="Flood Damage" value={editData.flood_damage} onChange={(val) => updateField('flood_damage', val)} type="switch" disabled={!canEdit} />
                  <EditableField label="Dents & Scratches" value={editData.dents_scratches} onChange={(val) => updateField('dents_scratches', val)} type="switch" disabled={!canEdit} />
                  <EditableField label="Is Commercial" value={editData.is_commercial ?? inspection?.vaahan_data?.is_commercial} onChange={(val) => updateField('is_commercial', val)} type="switch" disabled={!canEdit} />
                </div>
              </Section>
            </TabsContent>
            
            {/* Q&A Details Tab (formerly Inspection) - Last tab with editable answers */}
            <TabsContent value="inspection" className="space-y-4 mt-0">
              {/* Category Progress Summary - Clickable cards with editable ratings */}
              <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl p-4 border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    Category-wise Progress & Ratings (0-10)
                  </h3>
                  {selectedCategoryId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedCategoryId(null)}
                      className="text-blue-600 h-8"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Show All Categories
                    </Button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-3">
                  {inspection?.inspection_status === 'INSPECTION_COMPLETED' || inspection?.status === 'COMPLETED' 
                    ? 'AI-generated ratings (0-10) based on Q&A answers. Click a category to filter questions below.' 
                    : 'AI ratings will be generated after inspection is completed. Complete all Q&A categories to see ratings.'}
                </p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {liveProgressData?.categories?.map((category, idx) => {
                    const answered = category.answered_questions || 0;
                    const total = category.total_questions || 0;
                    const percentage = total > 0 ? Math.round((answered / total) * 100) : 0;
                    const isSelected = selectedCategoryId === category.category_id;
                    const isCompleted = inspection?.inspection_status === 'INSPECTION_COMPLETED' || inspection?.status === 'COMPLETED';
                    
                    // Get editable rating for this category (0-10 scale)
                    // Use normalized key that matches AI output (remove consecutive underscores, trim)
                    const categoryKey = (category.category_name?.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_') || '').replace(/^_+|_+$/g, '');
                    const categoryName = category.category_name;
                    
                    // Get AI rating from ai_insights.category_ratings (uses exact category name)
                    const getAICategoryRating = (catName, catKey) => {
                      const aiCategoryRatings = inspection?.ai_insights?.category_ratings || {};
                      
                      // Try exact match first
                      if (aiCategoryRatings[catName]) {
                        const ratingData = aiCategoryRatings[catName];
                        return typeof ratingData === 'object' ? ratingData.rating : ratingData;
                      }
                      
                      // Try key match (lowercase with underscores)
                      if (aiCategoryRatings[catKey]) {
                        const ratingData = aiCategoryRatings[catKey];
                        return typeof ratingData === 'object' ? ratingData.rating : ratingData;
                      }
                      
                      // Try case-insensitive and normalized key match
                      const normalizeKey = (str) => (str?.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_') || '').replace(/^_+|_+$/g, '');
                      const normalizedCatKey = normalizeKey(catName);
                      
                      for (const [key, value] of Object.entries(aiCategoryRatings)) {
                        const normalizedKey = normalizeKey(key);
                        if (normalizedKey === normalizedCatKey || key.toLowerCase() === catName?.toLowerCase()) {
                          return typeof value === 'object' ? value.rating : value;
                        }
                      }
                      
                      // Fallback: Try to match from condition_ratings for legacy data
                      const aiConditions = inspection?.ai_insights?.condition_ratings || {};
                      const name = catName?.toLowerCase() || '';
                      
                      if (name.includes('engine') || name.includes('health')) {
                        const cond = aiConditions.engine?.toUpperCase();
                        if (cond === 'POOR') return 2;
                        if (cond === 'AVERAGE' || cond === 'FAIR') return 5;
                        if (cond === 'GOOD') return 7;
                        if (cond === 'EXCELLENT') return 9;
                      }
                      if (name.includes('exterior')) {
                        const cond = aiConditions.exterior?.toUpperCase();
                        if (cond === 'POOR') return 2;
                        if (cond === 'AVERAGE' || cond === 'FAIR') return 5;
                        if (cond === 'GOOD') return 7;
                        if (cond === 'EXCELLENT') return 9;
                      }
                      if (name.includes('interior')) {
                        const cond = aiConditions.interior?.toUpperCase();
                        if (cond === 'POOR') return 2;
                        if (cond === 'AVERAGE' || cond === 'FAIR') return 5;
                        if (cond === 'GOOD') return 7;
                        if (cond === 'EXCELLENT') return 9;
                      }
                      if (name.includes('transmission')) {
                        const cond = aiConditions.transmission?.toUpperCase();
                        if (cond === 'POOR') return 2;
                        if (cond === 'AVERAGE' || cond === 'FAIR') return 5;
                        if (cond === 'GOOD') return 7;
                        if (cond === 'EXCELLENT') return 9;
                      }
                      
                      return null;
                    };
                    
                    // Priority: editData.category_ratings > AI category rating (only if completed) > 0
                    const savedRating = editData.category_ratings?.[categoryKey];
                    const aiRating = isCompleted ? getAICategoryRating(categoryName, categoryKey) : null;
                    const currentRating = savedRating ?? aiRating ?? 0;
                    const isAIRating = savedRating === undefined && aiRating !== null && isCompleted;
                    
                    // Helper to get condition text and color
                    const getCondition = (rating) => {
                      if (rating >= 8) return { text: 'Good', color: 'bg-green-500', bgColor: 'bg-green-50 border-green-300' };
                      if (rating >= 4) return { text: 'Average', color: 'bg-yellow-500', bgColor: 'bg-yellow-50 border-yellow-300' };
                      if (rating > 0) return { text: 'Poor', color: 'bg-red-500', bgColor: 'bg-red-50 border-red-300' };
                      return { text: 'Not Rated', color: 'bg-gray-400', bgColor: 'bg-gray-50 border-gray-300' };
                    };
                    
                    const condition = getCondition(currentRating);
                    
                    return (
                      <div
                        key={idx}
                        className={`bg-white rounded-lg p-3 border transition-all hover:shadow-md ${
                          isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-blue-300'
                        }`}
                      >
                        {/* Category Name - Clickable to filter */}
                        <button
                          onClick={() => setSelectedCategoryId(isSelected ? null : category.category_id)}
                          className="w-full text-left"
                        >
                          <p className="text-xs font-medium text-gray-700 truncate">{category.category_name}</p>
                          <div className="flex items-center justify-between mt-1">
                            <span className="text-sm font-bold text-gray-900">{answered}/{total}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              percentage === 100 ? 'bg-green-100 text-green-700' :
                              percentage > 50 ? 'bg-yellow-100 text-yellow-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {percentage}%
                            </span>
                          </div>
                        </button>
                        
                        {/* Editable Rating (0-10) */}
                        <div className={`mt-2 p-2 rounded border ${condition.bgColor}`}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold text-gray-600">
                              Rating {isAIRating && <span className="text-blue-500 ml-1">(AI)</span>}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded text-white ${condition.color}`}>
                              {condition.text}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <input
                              type="range"
                              min="0"
                              max="10"
                              value={currentRating}
                              onChange={(e) => {
                                const newRatings = { ...editData.category_ratings, [categoryKey]: parseInt(e.target.value) };
                                updateField('category_ratings', newRatings);
                              }}
                              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                              disabled={!canEdit}
                            />
                            <input
                              type="number"
                              min="0"
                              max="10"
                              value={currentRating}
                              onChange={(e) => {
                                const val = Math.min(10, Math.max(0, parseInt(e.target.value) || 0));
                                const newRatings = { ...editData.category_ratings, [categoryKey]: val };
                                updateField('category_ratings', newRatings);
                              }}
                              className="w-12 h-7 text-center text-sm font-bold border rounded"
                              disabled={!canEdit}
                            />
                          </div>
                        </div>
                        
                        {/* Progress bar */}
                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                          <div
                            className={`h-1.5 rounded-full ${
                              percentage === 100 ? 'bg-green-500' :
                              percentage > 50 ? 'bg-yellow-500' :
                              'bg-gray-400'
                            }`}
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              {/* Categories with Q&A - Filtered by selected category */}
              {categoriesToDisplay?.map((category, catIdx) => (
                <Section
                  key={category.category_id || catIdx}
                  title={category.category_name}
                  icon={ClipboardList}
                  badge={`${category.answered_questions || 0}/${category.total_questions || 0}`}
                  defaultOpen={selectedCategoryId ? true : catIdx === 0}
                >
                  <div className="space-y-3">
                    {category.questions?.map((q, qIdx) => {
                      const isEditing = editingAnswer?.questionId === q.question_id;
                      const hasOptions = q.options && q.options.length > 0;
                      const currentAnswer = typeof q.answer === 'object' ? q.answer?.selection : q.answer;
                      
                      return (
                        <div
                          key={q.question_id}
                          className={`p-3 rounded-lg border-l-4 ${
                            q.is_answered
                              ? 'bg-green-50 border-l-green-500'
                              : 'bg-gray-50 border-l-gray-300'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                              q.is_answered ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
                            }`}>
                              {qIdx + 1}
                            </span>
                            <div className="flex-1">
                              <div className="flex items-start justify-between">
                                <p className="text-sm font-medium text-gray-800">{q.question_text}</p>
                                {/* Edit button - only show for answered questions with predefined options */}
                                {q.is_answered && hasOptions && canEdit && !isEditing && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setEditingAnswer({ questionId: q.question_id, categoryId: category.category_id })}
                                    className="h-7 px-2 text-blue-600 hover:text-blue-800"
                                  >
                                    <Pencil className="h-3 w-3 mr-1" />
                                    Edit
                                  </Button>
                                )}
                              </div>
                              
                              {q.is_answered ? (
                                <div className="mt-2 p-2 bg-white rounded border">
                                  {isEditing ? (
                                    /* Edit mode - show dropdown for predefined options */
                                    <div className="space-y-2">
                                      <p className="text-xs text-gray-500">Select new answer:</p>
                                      <Select
                                        value={currentAnswer}
                                        onValueChange={(val) => updateAnswer(q.question_id, val, q.options)}
                                        disabled={savingAnswer}
                                      >
                                        <SelectTrigger className="h-9">
                                          <SelectValue placeholder="Select option" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {q.options.map((opt, optIdx) => (
                                            <SelectItem key={optIdx} value={opt}>{opt}</SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <div className="flex items-center gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => setEditingAnswer(null)}
                                          disabled={savingAnswer}
                                        >
                                          Cancel
                                        </Button>
                                        {savingAnswer && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                                      </div>
                                    </div>
                                  ) : (
                                    /* View mode */
                                    <>
                                      <p className="text-xs text-gray-500 mb-1">Answer:</p>
                                      {q.media_url ? (
                                        <div>
                                          {q.media_url.includes('video') || q.media_url.includes('.mp4') ? (
                                            <video src={q.media_url} controls className="max-h-32 rounded" />
                                          ) : (
                                            <img src={q.media_url} alt="Answer" className="max-h-32 rounded cursor-pointer" onClick={() => window.open(q.media_url, '_blank')} />
                                          )}
                                        </div>
                                      ) : (
                                        <p className="text-sm font-medium text-blue-700">{currentAnswer}</p>
                                      )}
                                      {hasOptions && (
                                        <p className="text-xs text-gray-400 mt-1">
                                          Options: {q.options.join(' | ')}
                                        </p>
                                      )}
                                      <p className="text-xs text-gray-400 mt-1">
                                        {q.answered_at && new Date(q.answered_at).toLocaleString()}
                                      </p>
                                    </>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Awaiting response...
                                  {hasOptions && <span className="text-blue-500 ml-1">({q.options.length} options available)</span>}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Section>
              ))}
            </TabsContent>
            
            {/* OBD-2 Diagnostics Tab - NEW */}
            <TabsContent value="obd" className="space-y-4 mt-0">
              {/* OBD Status Card */}
              <div className={`rounded-xl p-4 border ${liveProgressData?.obd_scan?.completed ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-200' : 'bg-gradient-to-r from-gray-50 to-slate-50 border-gray-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-12 w-12 rounded-full flex items-center justify-center ${liveProgressData?.obd_scan?.completed ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <Gauge className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {liveProgressData?.obd_scan?.completed ? 'OBD Scan Completed' : 'OBD Scan Pending'}
                      </h3>
                      {liveProgressData?.obd_scan?.scanned_at && (
                        <p className="text-sm text-gray-600">
                          Scanned: {new Date(liveProgressData.obd_scan.scanned_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  {/* Rescan Button */}
                  {canEdit && (
                    <Button
                      variant={liveProgressData?.obd_scan?.completed ? "outline" : "default"}
                      onClick={requestObdRescan}
                      disabled={requestingRescan}
                      className={liveProgressData?.obd_scan?.completed ? "" : "bg-blue-600 hover:bg-blue-700"}
                    >
                      {requestingRescan ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />Requesting...</>
                      ) : (
                        <><RotateCcw className="h-4 w-4 mr-2" />{liveProgressData?.obd_scan?.completed ? 'Request Rescan' : 'Request Scan'}</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
              
              {/* DTC Codes Section */}
              <Section title="Diagnostic Trouble Codes (DTC)" icon={AlertTriangle} defaultOpen={true} badge={dtcCodes.length > 0 ? `${dtcCodes.length} codes` : 'No codes'}>
                {dtcCodes.length > 0 ? (
                  <div className="space-y-2">
                    {dtcCodes.map((dtc, idx) => (
                      <div key={idx} className="flex items-start gap-3 p-3 bg-white rounded-lg border border-red-200">
                        <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                          <CircleDot className="h-4 w-4 text-red-600" />
                        </div>
                        <div className="flex-1">
                          <p className="font-mono font-bold text-red-700">{typeof dtc === 'string' ? dtc : dtc.code}</p>
                          {typeof dtc === 'object' && dtc.description && (
                            <p className="text-sm text-gray-600 mt-1">{dtc.description}</p>
                          )}
                          {typeof dtc === 'object' && dtc.system && (
                            <p className="text-xs text-gray-400 mt-1">System: {dtc.system}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
                    <p className="font-medium">No Trouble Codes Detected</p>
                    <p className="text-sm">The vehicle's onboard computer has no stored error codes</p>
                  </div>
                )}
              </Section>
              
              {/* Raw OBD Data Section */}
              {liveProgressData?.obd_scan?.data && (
                <Section title="Raw OBD Data" icon={FileText} badge="JSON">
                  <div className="bg-gray-900 rounded-lg p-4 overflow-auto max-h-60">
                    <pre className="text-xs text-green-400 font-mono">
                      {JSON.stringify(liveProgressData.obd_scan.data, null, 2)}
                    </pre>
                  </div>
                </Section>
              )}
            </TabsContent>
            
            {/* Repairs Tab - ENHANCED */}
            <TabsContent value="repairs" className="space-y-4 mt-0">
              {/* Auto-Calculated Repairs from Rules */}
              {calculatedRepairCosts.length > 0 && (
                <Section title="Auto-Detected Repairs" icon={Zap} defaultOpen={true} badge={`${calculatedRepairCosts.length} items`}>
                  <div className="space-y-3">
                    <p className="text-sm text-gray-600">
                      These repairs were automatically detected based on inspection answers and repair rules.
                    </p>
                    
                    {/* Repair Items from Rules */}
                    <div className="space-y-2">
                      {calculatedRepairCosts.map((repair, idx) => (
                        <div key={idx} className={`p-3 rounded-lg border-l-4 ${
                          repair.action === 'REPLACE' ? 'bg-red-50 border-l-red-500' : 'bg-amber-50 border-l-amber-500'
                        }`}>
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                  repair.action === 'REPLACE' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                                }`}>
                                  {repair.action}
                                </span>
                                <span className="font-medium text-gray-900">{repair.part_name}</span>
                                <span className="text-xs text-gray-500">({repair.category})</span>
                              </div>
                              <p className="text-xs text-gray-600 mt-1">
                                Q: {repair.question?.substring(0, 50)}...
                              </p>
                              <p className="text-xs text-blue-600 mt-0.5">
                                A: {repair.answer}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-lg font-bold text-gray-900">₹{repair.cost.toLocaleString()}</p>
                              <p className="text-xs text-gray-500">incl. labor</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Total from Auto-Detected */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Auto-Detected Total</p>
                          <p className="text-2xl font-bold text-blue-700">
                            ₹{calculatedRepairCosts.reduce((sum, r) => sum + r.cost, 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">
                            Replace: {calculatedRepairCosts.filter(r => r.action === 'REPLACE').length} |
                            Repair: {calculatedRepairCosts.filter(r => r.action === 'REPAIR').length}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </Section>
              )}
              
              {/* Manual Repairs Section */}
              <Section title="Manual Repair Entries" icon={Wrench} defaultOpen={calculatedRepairCosts.length === 0}>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Add additional repairs that weren't auto-detected. These will be included in the final estimate.
                  </p>
                  
                  {/* Repair Items */}
                  <div className="space-y-2">
                    {editData.repairs.map((repair, idx) => (
                      <RepairItem
                        key={idx}
                        repair={repair}
                        index={idx}
                        onUpdate={updateRepair}
                        onRemove={removeRepair}
                      />
                    ))}
                  </div>
                  
                  {canEdit && (
                    <Button variant="outline" onClick={addRepair} className="w-full">
                      + Add Manual Repair Item
                    </Button>
                  )}
                  
                  {/* Totals */}
                  {editData.repairs.length > 0 && (
                    <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-4 border border-orange-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Manual Entries Total</p>
                          <p className="text-2xl font-bold text-orange-700">
                            ₹{calculateRepairTotals().min.toLocaleString()} - ₹{calculateRepairTotals().max.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Items: {editData.repairs.length}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Section>
              
              {/* Combined Total */}
              {(calculatedRepairCosts.length > 0 || editData.repairs.length > 0) && (
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-5 text-white">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-purple-200 text-sm">Total Estimated Repair Cost</p>
                      <p className="text-3xl font-bold">
                        ₹{(calculatedRepairCosts.reduce((sum, r) => sum + r.cost, 0) + calculateRepairTotals().min).toLocaleString()}
                        {calculateRepairTotals().max !== calculateRepairTotals().min && (
                          <span className="text-xl font-normal text-purple-200"> - ₹{(calculatedRepairCosts.reduce((sum, r) => sum + r.cost, 0) + calculateRepairTotals().max).toLocaleString()}</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <Package className="h-10 w-10 text-purple-200" />
                      <p className="text-xs text-purple-200 mt-1">
                        {calculatedRepairCosts.length + editData.repairs.length} total items
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* No Repairs */}
              {calculatedRepairCosts.length === 0 && editData.repairs.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <CheckCircle className="h-12 w-12 mx-auto text-green-500 mb-2" />
                  <p className="font-medium">No Repairs Detected</p>
                  <p className="text-sm">No repair requirements have been identified from the inspection</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
            </div>
        </div>
        
        {/* Footer with Save Button */}
        {canEdit && (
          <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="text-xs text-gray-500">
                {liveProgressData?.updated_at && (
                  <span>Last updated: {new Date(liveProgressData.updated_at).toLocaleString()}</span>
                )}
              </div>
              {/* Unsaved Changes Indicator */}
              {hasUnsavedChanges && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 text-amber-700 rounded-full text-xs font-medium animate-pulse">
                  <AlertCircle className="h-3 w-3" />
                  Unsaved Changes
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={saveChanges}
                disabled={saving}
                className={`${hasUnsavedChanges ? 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600' : 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800'}`}
                data-testid="save-all-btn"
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" />Save All Changes{hasUnsavedChanges && ' *'}</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
