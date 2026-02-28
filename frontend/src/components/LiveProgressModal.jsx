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
  ExternalLink, Copy, ClipboardList, CircleDot, RotateCcw, Package
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
    dtc_codes: []
  });
  
  // Initialize edit data from inspection and live progress
  useEffect(() => {
    if (inspection && liveProgressData) {
      // Handle assessment_summary - it might be an object or a string
      let assessmentSummary = inspection.assessment_summary || '';
      if (typeof assessmentSummary === 'object' && assessmentSummary !== null) {
        assessmentSummary = assessmentSummary.overall || '';
      }
      
      // Get market values from multiple possible sources
      const aiInsights = inspection.ai_insights || {};
      const marketValueMin = inspection.market_value_min || aiInsights.market_value?.min || 0;
      const marketValueMax = inspection.market_value_max || aiInsights.market_value?.max || 0;
      
      setEditData({
        // From AI insights
        overall_rating: inspection.overall_rating || aiInsights.overall_rating || liveProgressData?.ai_report?.overall_rating || 0,
        recommended_to_buy: inspection.recommended_to_buy ?? aiInsights.recommended_to_buy ?? liveProgressData?.ai_report?.recommended_to_buy ?? false,
        market_value_min: marketValueMin,
        market_value_max: marketValueMax,
        assessment_summary: assessmentSummary,
        key_highlights: inspection.key_highlights || aiInsights.key_highlights || [],
        
        // Vehicle
        vehicle_make: inspection.vehicle_make || '',
        vehicle_model: inspection.vehicle_model || '',
        vehicle_year: inspection.vehicle_year || '',
        fuel_type: inspection.fuel_type || '',
        transmission: inspection.transmission || '',
        vehicle_colour: inspection.vehicle_colour || '',
        engine_cc: inspection.engine_cc || 0,
        kms_driven: inspection.kms_driven || 0,
        owners: inspection.owners || 0,
        
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
        dtc_codes: inspection.dtc_codes || []
      });
    }
  }, [inspection, liveProgressData]);
  
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
  
  // Update a single field
  const updateField = (field, value) => {
    setEditData(prev => ({ ...prev, [field]: value }));
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
  
  // Manual refresh
  const handleManualRefresh = async () => {
    if (!inspection?.id) return;
    setRefreshing(true);
    try {
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
              <TabsTrigger value="repairs" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-t-lg rounded-b-none h-10 px-4">
                <Wrench className="h-4 w-4 mr-2" />
                Repairs
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
                        max="5"
                        step="0.5"
                        value={editData.overall_rating}
                        onChange={(e) => updateField('overall_rating', parseFloat(e.target.value) || 0)}
                        className="h-8 w-16 text-center font-bold"
                        disabled={!canEdit}
                      />
                      <span className="text-sm text-gray-500">/ 5</span>
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
                  
                  <div className="bg-white rounded-lg p-3 border col-span-2">
                    <Label className="text-xs text-gray-500">Recommended Purchase Price</Label>
                    <p className="text-xs text-green-600 mb-2">(5-10% below market average)</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-gray-500">₹</span>
                      <Input
                        type="number"
                        value={editData.market_value_min}
                        onChange={(e) => updateField('market_value_min', parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                        placeholder="Min"
                        disabled={!canEdit}
                      />
                      <span className="text-gray-400">to</span>
                      <Input
                        type="number"
                        value={editData.market_value_max}
                        onChange={(e) => updateField('market_value_max', parseFloat(e.target.value) || 0)}
                        className="h-8 text-sm"
                        placeholder="Max"
                        disabled={!canEdit}
                      />
                    </div>
                    
                    {/* Market Research Results - Website-wise breakdown */}
                    {inspection?.market_price_research?.market_average > 0 ? (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-gray-700">Market Research Data</span>
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                            {inspection.market_price_research.sources_count} sources
                          </span>
                        </div>
                        
                        {/* Market Average */}
                        <div className="bg-gray-50 rounded-lg p-2 mb-2">
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-600">Market Average:</span>
                            <span className="text-sm font-bold text-gray-800">
                              ₹{(inspection.market_price_research.market_average / 100000).toFixed(2)} Lakh
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-1">
                            <span className="text-xs text-gray-600">Range:</span>
                            <span className="text-xs text-gray-700">
                              ₹{(inspection.market_price_research.market_min / 100000).toFixed(2)}L - ₹{(inspection.market_price_research.market_max / 100000).toFixed(2)}L
                            </span>
                          </div>
                        </div>
                        
                        {/* Website-wise breakdown */}
                        {inspection.market_price_research.sources?.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-xs text-gray-500">Prices by Source:</span>
                            <div className="grid grid-cols-2 gap-1">
                              {inspection.market_price_research.sources.slice(0, 6).map((source, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-white rounded px-2 py-1 border text-xs">
                                  <span className="text-blue-600 font-medium">{source.source}</span>
                                  <span className="text-gray-700">₹{(source.price / 100000).toFixed(2)}L</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">
                          <AlertCircle className="h-4 w-4" />
                          <span>Click "Regenerate" above to fetch latest market prices from web sources</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Assessment Summary */}
              <Section title="Assessment Summary" icon={FileText} defaultOpen={true}>
                <div className="space-y-4">
                  <EditableField
                    label="Summary"
                    value={editData.assessment_summary}
                    onChange={(val) => updateField('assessment_summary', val)}
                    type="textarea"
                    placeholder="Enter vehicle assessment summary..."
                    disabled={!canEdit}
                  />
                  
                  <div>
                    <Label className="text-xs text-gray-600 mb-2 block">Key Highlights</Label>
                    <div className="space-y-2">
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
                </div>
              </Section>
              
              {/* Condition Ratings */}
              <Section title="Condition Ratings" icon={Gauge} defaultOpen={true}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <EditableField
                    label="Engine"
                    value={editData.engine_condition}
                    onChange={(val) => updateField('engine_condition', val)}
                    type="select"
                    options={CONDITION_OPTIONS}
                    disabled={!canEdit}
                  />
                  <EditableField
                    label="Interior"
                    value={editData.interior_condition}
                    onChange={(val) => updateField('interior_condition', val)}
                    type="select"
                    options={CONDITION_OPTIONS}
                    disabled={!canEdit}
                  />
                  <EditableField
                    label="Exterior"
                    value={editData.exterior_condition}
                    onChange={(val) => updateField('exterior_condition', val)}
                    type="select"
                    options={CONDITION_OPTIONS}
                    disabled={!canEdit}
                  />
                  <EditableField
                    label="Transmission"
                    value={editData.transmission_condition}
                    onChange={(val) => updateField('transmission_condition', val)}
                    type="select"
                    options={CONDITION_OPTIONS}
                    disabled={!canEdit}
                  />
                </div>
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
            
            {/* Vehicle Tab */}
            <TabsContent value="vehicle" className="space-y-4 mt-0">
              <Section title="Vehicle Details" icon={Car} defaultOpen={true}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <EditableField label="Make" value={editData.vehicle_make} onChange={(val) => updateField('vehicle_make', val)} disabled={!canEdit} />
                  <EditableField label="Model" value={editData.vehicle_model} onChange={(val) => updateField('vehicle_model', val)} disabled={!canEdit} />
                  <EditableField label="Year" value={editData.vehicle_year} onChange={(val) => updateField('vehicle_year', val)} type="number" disabled={!canEdit} />
                  <EditableField label="Fuel Type" value={editData.fuel_type} onChange={(val) => updateField('fuel_type', val)} type="select" options={['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid']} disabled={!canEdit} />
                  <EditableField label="Transmission" value={editData.transmission} onChange={(val) => updateField('transmission', val)} type="select" options={['Manual', 'Automatic', 'CVT', 'DCT']} disabled={!canEdit} />
                  <EditableField label="Colour" value={editData.vehicle_colour} onChange={(val) => updateField('vehicle_colour', val)} disabled={!canEdit} />
                  <EditableField label="Engine CC" value={editData.engine_cc} onChange={(val) => updateField('engine_cc', val)} type="number" disabled={!canEdit} />
                  <EditableField label="KMs Driven" value={editData.kms_driven} onChange={(val) => updateField('kms_driven', val)} type="number" disabled={!canEdit} />
                  <EditableField label="Owners" value={editData.owners} onChange={(val) => updateField('owners', val)} type="number" disabled={!canEdit} />
                </div>
              </Section>
              
              <Section title="Vehicle History" icon={History}>
                <div className="space-y-3">
                  <EditableField label="Accident History" value={editData.accident_history} onChange={(val) => updateField('accident_history', val)} type="switch" disabled={!canEdit} />
                  <EditableField label="Flood Damage" value={editData.flood_damage} onChange={(val) => updateField('flood_damage', val)} type="switch" disabled={!canEdit} />
                  <EditableField label="Dents & Scratches" value={editData.dents_scratches} onChange={(val) => updateField('dents_scratches', val)} type="switch" disabled={!canEdit} />
                </div>
              </Section>
              
              <Section title="Insurance Details" icon={Shield}>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <EditableField label="Status" value={editData.insurance_status} onChange={(val) => updateField('insurance_status', val)} type="select" options={['Active', 'Expired', 'Unknown']} disabled={!canEdit} />
                  <EditableField label="Insurer" value={editData.insurer_name} onChange={(val) => updateField('insurer_name', val)} disabled={!canEdit} />
                  <EditableField label="Policy Number" value={editData.policy_number} onChange={(val) => updateField('policy_number', val)} disabled={!canEdit} />
                  <EditableField label="Expiry Date" value={editData.insurance_expiry} onChange={(val) => updateField('insurance_expiry', val)} type="date" disabled={!canEdit} />
                  <EditableField label="Policy Type" value={editData.policy_type} onChange={(val) => updateField('policy_type', val)} type="select" options={['Comprehensive', 'Third Party', 'Zero Dep']} disabled={!canEdit} />
                  <EditableField label="IDV Value" value={editData.idv_value} onChange={(val) => updateField('idv_value', val)} type="number" disabled={!canEdit} />
                </div>
              </Section>
              
              {/* RTO Verification (from Vaahan API) - moved from Verification tab */}
              <Section title="RTO Verification (Vaahan API)" icon={Shield}>
                <div className="grid grid-cols-2 gap-4">
                  <EditableField
                    label="Verification Status"
                    value={editData.rto_verification_status}
                    onChange={(val) => updateField('rto_verification_status', val)}
                    type="select"
                    options={['VERIFIED', 'PENDING', 'FAILED', 'NOT_AVAILABLE']}
                    disabled={!canEdit}
                  />
                  <EditableField
                    label="Hypothecation"
                    value={editData.hypothecation}
                    onChange={(val) => updateField('hypothecation', val)}
                    placeholder="Bank/Financier name if any"
                    disabled={!canEdit}
                  />
                  <div className="col-span-2">
                    <EditableField
                      label="Blacklisted"
                      value={editData.blacklist_status}
                      onChange={(val) => updateField('blacklist_status', val)}
                      type="switch"
                      disabled={!canEdit}
                    />
                  </div>
                </div>
              </Section>
            </TabsContent>
            
            {/* Q&A Details Tab (formerly Inspection) - Last tab with editable answers */}
            <TabsContent value="inspection" className="space-y-4 mt-0">
              {/* Category Progress Summary - Clickable cards for filtering */}
              <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl p-4 border">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    Category-wise Progress
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
                <p className="text-xs text-gray-500 mb-3">Click a category to filter questions below</p>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {liveProgressData?.categories?.map((category, idx) => {
                    const answered = category.answered_questions || 0;
                    const total = category.total_questions || 0;
                    const percentage = total > 0 ? Math.round((answered / total) * 100) : 0;
                    const isSelected = selectedCategoryId === category.category_id;
                    return (
                      <button
                        key={idx}
                        onClick={() => setSelectedCategoryId(isSelected ? null : category.category_id)}
                        className={`bg-white rounded-lg p-3 border text-left transition-all hover:shadow-md ${
                          isSelected ? 'ring-2 ring-blue-500 border-blue-500' : 'hover:border-blue-300'
                        }`}
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
                      </button>
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
              
              {/* OBD Section */}
              <Section title="OBD-2 Diagnostics" icon={Gauge} badge={liveProgressData?.obd_scan?.completed ? 'Scanned' : 'Pending'}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white rounded-lg border">
                    <div className="flex items-center gap-2">
                      <div className={`h-3 w-3 rounded-full ${liveProgressData?.obd_scan?.completed ? 'bg-green-500' : 'bg-gray-300'}`} />
                      <span className="text-sm">{liveProgressData?.obd_scan?.completed ? 'OBD Scan Completed' : 'OBD Scan Pending'}</span>
                    </div>
                    {liveProgressData?.obd_scan?.scanned_at && (
                      <span className="text-xs text-gray-500">
                        {new Date(liveProgressData.obd_scan.scanned_at).toLocaleString()}
                      </span>
                    )}
                  </div>
                  
                  {liveProgressData?.obd_scan?.data && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <p className="text-xs text-gray-500 mb-2">Diagnostic Data</p>
                      <pre className="text-xs overflow-auto max-h-40">
                        {JSON.stringify(liveProgressData.obd_scan.data, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </Section>
            </TabsContent>
            
            {/* Repairs Tab */}
            <TabsContent value="repairs" className="space-y-4 mt-0">
              <Section title="Estimated Repairs" icon={Wrench} defaultOpen={true}>
                <div className="space-y-4">
                  <p className="text-sm text-gray-600">
                    Add repairs needed based on the inspection findings. This helps estimate the true cost of ownership.
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
                      + Add Repair Item
                    </Button>
                  )}
                  
                  {/* Totals */}
                  {editData.repairs.length > 0 && (
                    <div className="bg-gradient-to-r from-orange-50 to-red-50 rounded-xl p-4 border border-orange-200">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600">Estimated Total Repair Cost</p>
                          <p className="text-2xl font-bold text-orange-700">
                            ₹{calculateRepairTotals().min.toLocaleString()} - ₹{calculateRepairTotals().max.toLocaleString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Items: {editData.repairs.length}</p>
                          <p className="text-xs text-gray-500">
                            Critical: {editData.repairs.filter(r => r.type === 'CRITICAL').length} |
                            Major: {editData.repairs.filter(r => r.type === 'MAJOR').length} |
                            Minor: {editData.repairs.filter(r => r.type === 'MINOR').length}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            </TabsContent>
          </Tabs>
            </div>
        </div>
        
        {/* Footer with Save Button */}
        {canEdit && (
          <div className="p-4 border-t bg-gray-50 flex items-center justify-between">
            <div className="text-xs text-gray-500">
              {liveProgressData?.updated_at && (
                <span>Last updated: {new Date(liveProgressData.updated_at).toLocaleString()}</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <Button variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                onClick={saveChanges}
                disabled={saving}
                className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                data-testid="save-all-btn"
              >
                {saving ? (
                  <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</>
                ) : (
                  <><Save className="h-4 w-4 mr-2" />Save All Changes</>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
