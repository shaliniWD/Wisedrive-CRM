import React, { useState, useEffect } from 'react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import { inspectionsApi } from '@/services/api';
import {
  Loader2, User, Activity, Car, FileText, Settings, Wrench, Shield,
  AlertTriangle, CheckCircle, Clock, RefreshCw, Save, Pencil, X,
  ChevronDown, ChevronRight, DollarSign, Gauge, History, Download,
  Star, ThumbsUp, ThumbsDown, AlertCircle, Info, Zap, Eye, Share2,
  ExternalLink, Copy, ClipboardList
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
  const [activeTab, setActiveTab] = useState('overview');
  const [saving, setSaving] = useState(false);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  
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
      
      setEditData({
        // From AI insights
        overall_rating: inspection.overall_rating || liveProgressData?.ai_report?.overall_rating || 0,
        recommended_to_buy: inspection.recommended_to_buy || liveProgressData?.ai_report?.recommended_to_buy || false,
        market_value_min: inspection.market_value_min || 0,
        market_value_max: inspection.market_value_max || 0,
        assessment_summary: assessmentSummary,
        key_highlights: inspection.key_highlights || [],
        
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
            
            {/* Progress indicator */}
            <div className="text-right">
              <p className="text-3xl font-bold">{stats.completion_percentage || 0}%</p>
              <p className="text-xs text-blue-200">{stats.answered_questions || 0}/{stats.total_questions || 0} questions</p>
            </div>
          </DialogTitle>
        </DialogHeader>
        
        {/* Tabs Navigation */}
        <div className="border-b bg-gray-50 px-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-transparent h-12 p-0 gap-1">
              <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-t-lg rounded-b-none h-10 px-4">
                <FileText className="h-4 w-4 mr-2" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="vehicle" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-t-lg rounded-b-none h-10 px-4">
                <Car className="h-4 w-4 mr-2" />
                Vehicle
              </TabsTrigger>
              <TabsTrigger value="inspection" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-t-lg rounded-b-none h-10 px-4">
                <Settings className="h-4 w-4 mr-2" />
                Inspection
              </TabsTrigger>
              <TabsTrigger value="repairs" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-t-lg rounded-b-none h-10 px-4">
                <Wrench className="h-4 w-4 mr-2" />
                Repairs
              </TabsTrigger>
              <TabsTrigger value="verification" className="data-[state=active]:bg-white data-[state=active]:shadow-sm rounded-t-lg rounded-b-none h-10 px-4">
                <Shield className="h-4 w-4 mr-2" />
                Verification
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        
        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          <Tabs value={activeTab} className="w-full">
            {/* Overview Tab */}
            <TabsContent value="overview" className="space-y-4 mt-0">
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
                    <Label className="text-xs text-gray-500">Market Value Estimate</Label>
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
                    {/* Market Research Info */}
                    {inspection?.market_price_research?.market_average > 0 && (
                      <div className="mt-2 pt-2 border-t border-gray-100">
                        <div className="flex items-center gap-1 text-xs text-gray-500">
                          <Info className="h-3 w-3" />
                          <span>
                            Market avg: ₹{(inspection.market_price_research.market_average / 100000).toFixed(2)}L
                            {inspection.market_price_research.sources_count > 0 && (
                              <span className="text-blue-600 ml-1">
                                ({inspection.market_price_research.sources_count} sources)
                              </span>
                            )}
                          </span>
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
            </TabsContent>
            
            {/* Inspection Tab */}
            <TabsContent value="inspection" className="space-y-4 mt-0">
              {/* Categories from live progress */}
              {liveProgressData?.categories?.map((category, catIdx) => (
                <Section
                  key={category.category_id || catIdx}
                  title={category.category_name}
                  icon={Settings}
                  badge={`${category.answered}/${category.total}`}
                  defaultOpen={catIdx === 0}
                >
                  <div className="space-y-3">
                    {category.questions?.map((q, qIdx) => (
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
                            <p className="text-sm font-medium text-gray-800">{q.question_text}</p>
                            {q.is_answered ? (
                              <div className="mt-2 p-2 bg-white rounded border">
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
                                  <p className="text-sm font-medium text-blue-700">
                                    {typeof q.answer === 'object' ? q.answer?.selection : q.answer}
                                  </p>
                                )}
                                <p className="text-xs text-gray-400 mt-1">
                                  {q.answered_at && new Date(q.answered_at).toLocaleString()}
                                </p>
                              </div>
                            ) : (
                              <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Awaiting response...
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
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
            
            {/* Verification Tab */}
            <TabsContent value="verification" className="space-y-4 mt-0">
              <Section title="RTO Verification" icon={Shield} defaultOpen={true}>
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
          </Tabs>
        </ScrollArea>
        
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
