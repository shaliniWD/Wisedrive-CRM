import React, { useState, useEffect, useCallback } from 'react';
import { repairsApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import {
  Wrench, Plus, Search, Edit2, Trash2, Loader2, Package,
  DollarSign, Link2, Car, ChevronDown, ChevronRight, Save,
  X, AlertCircle, CheckCircle, HelpCircle, Settings, Filter
} from 'lucide-react';

// Car type options
const CAR_TYPES = ['hatchback', 'sedan', 'suv'];

// Common Indian car brands
const CAR_BRANDS = [
  'Maruti Suzuki', 'Hyundai', 'Tata', 'Mahindra', 'Kia', 'Toyota',
  'Honda', 'Ford', 'Volkswagen', 'Skoda', 'Renault', 'Nissan',
  'MG', 'Jeep', 'BMW', 'Mercedes-Benz', 'Audi', 'Land Rover'
];

// Operator options for rules
const OPERATORS = [
  { value: 'equals', label: 'Equals' },
  { value: 'greater_than', label: 'Greater Than' },
  { value: 'less_than', label: 'Less Than' },
  { value: 'greater_than_or_equal', label: 'Greater Than or Equal' },
  { value: 'less_than_or_equal', label: 'Less Than or Equal' },
  { value: 'between', label: 'Between (range)' },
  { value: 'contains', label: 'Contains' }
];

// Priority options
const PRIORITIES = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-700' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'critical', label: 'Critical', color: 'bg-red-100 text-red-700' }
];

// Action types
const ACTION_TYPES = [
  { value: 'repair', label: 'Repair' },
  { value: 'replace', label: 'Replace' },
  { value: 'inspect_further', label: 'Inspect Further' }
];

// Pricing Input Component
const PricingInput = ({ carType, pricing, onChange, disabled }) => {
  const handleChange = (field, value) => {
    onChange({
      ...pricing,
      [field]: parseFloat(value) || 0
    });
  };

  return (
    <div className="space-y-3 p-3 bg-gray-50 rounded-lg">
      <div className="flex items-center gap-2 mb-2">
        <Car className="h-4 w-4 text-gray-500" />
        <span className="font-medium text-sm capitalize">{carType}</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-gray-500">Repair Price (₹)</Label>
          <Input
            type="number"
            value={pricing?.repair_price || 0}
            onChange={(e) => handleChange('repair_price', e.target.value)}
            disabled={disabled}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Replace Price (₹)</Label>
          <Input
            type="number"
            value={pricing?.replace_price || 0}
            onChange={(e) => handleChange('replace_price', e.target.value)}
            disabled={disabled}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Repair Labor (₹)</Label>
          <Input
            type="number"
            value={pricing?.repair_labor || 0}
            onChange={(e) => handleChange('repair_labor', e.target.value)}
            disabled={disabled}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <Label className="text-xs text-gray-500">Replace Labor (₹)</Label>
          <Input
            type="number"
            value={pricing?.replace_labor || 0}
            onChange={(e) => handleChange('replace_labor', e.target.value)}
            disabled={disabled}
            className="h-8 text-sm"
          />
        </div>
      </div>
    </div>
  );
};

// Brand Override Section
const BrandOverrideSection = ({ overrides, onChange, disabled }) => {
  const [expanded, setExpanded] = useState({});

  const addBrandOverride = () => {
    onChange([...overrides, {
      brand: '',
      hatchback: { repair_price: 0, replace_price: 0, repair_labor: 0, replace_labor: 0 },
      sedan: { repair_price: 0, replace_price: 0, repair_labor: 0, replace_labor: 0 },
      suv: { repair_price: 0, replace_price: 0, repair_labor: 0, replace_labor: 0 }
    }]);
  };

  const updateOverride = (index, field, value) => {
    const updated = [...overrides];
    if (field === 'brand') {
      updated[index].brand = value;
    } else {
      updated[index][field] = value;
    }
    onChange(updated);
  };

  const removeOverride = (index) => {
    onChange(overrides.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold">Brand-Specific Pricing Overrides</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addBrandOverride}
          disabled={disabled}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Brand
        </Button>
      </div>
      
      {overrides.length === 0 ? (
        <p className="text-xs text-gray-500 italic">No brand overrides. Default prices will apply to all brands.</p>
      ) : (
        <div className="space-y-2">
          {overrides.map((override, idx) => (
            <div key={idx} className="border rounded-lg">
              <div className="flex items-center justify-between p-3 bg-gray-50">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setExpanded({ ...expanded, [idx]: !expanded[idx] })}
                    className="text-gray-500"
                  >
                    {expanded[idx] ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <Select
                    value={override.brand}
                    onValueChange={(val) => updateOverride(idx, 'brand', val)}
                    disabled={disabled}
                  >
                    <SelectTrigger className="w-48 h-8">
                      <SelectValue placeholder="Select brand" />
                    </SelectTrigger>
                    <SelectContent>
                      {CAR_BRANDS.map(brand => (
                        <SelectItem key={brand} value={brand}>{brand}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeOverride(idx)}
                  disabled={disabled}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              
              {expanded[idx] && (
                <div className="p-3 grid grid-cols-3 gap-3">
                  {CAR_TYPES.map(carType => (
                    <PricingInput
                      key={carType}
                      carType={carType}
                      pricing={override[carType] || {}}
                      onChange={(pricing) => updateOverride(idx, carType, pricing)}
                      disabled={disabled}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Repair Part Form Modal
const PartFormModal = ({ isOpen, onClose, part, categories, onSave }) => {
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    description: '',
    part_number: '',
    hatchback: { repair_price: 0, replace_price: 0, repair_labor: 0, replace_labor: 0 },
    sedan: { repair_price: 0, replace_price: 0, repair_labor: 0, replace_labor: 0 },
    suv: { repair_price: 0, replace_price: 0, repair_labor: 0, replace_labor: 0 },
    brand_overrides: [],
    is_active: true
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (part) {
      setFormData({
        name: part.name || '',
        category: part.category || '',
        description: part.description || '',
        part_number: part.part_number || '',
        hatchback: part.hatchback || { repair_price: 0, replace_price: 0, repair_labor: 0, replace_labor: 0 },
        sedan: part.sedan || { repair_price: 0, replace_price: 0, repair_labor: 0, replace_labor: 0 },
        suv: part.suv || { repair_price: 0, replace_price: 0, repair_labor: 0, replace_labor: 0 },
        brand_overrides: part.brand_overrides || [],
        is_active: part.is_active !== false
      });
    } else {
      setFormData({
        name: '',
        category: '',
        description: '',
        part_number: '',
        hatchback: { repair_price: 0, replace_price: 0, repair_labor: 0, replace_labor: 0 },
        sedan: { repair_price: 0, replace_price: 0, repair_labor: 0, replace_labor: 0 },
        suv: { repair_price: 0, replace_price: 0, repair_labor: 0, replace_labor: 0 },
        brand_overrides: [],
        is_active: true
      });
    }
  }, [part, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.category) {
      toast.error('Name and category are required');
      return;
    }

    setSaving(true);
    try {
      if (part?.id) {
        await repairsApi.updatePart(part.id, formData);
        toast.success('Part updated successfully');
      } else {
        await repairsApi.createPart(formData);
        toast.success('Part created successfully');
      }
      onSave();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save part');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            {part ? 'Edit Repair Part' : 'Add New Repair Part'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto pr-4" style={{ maxHeight: 'calc(90vh - 160px)' }}>
            <div className="space-y-6 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Part Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Front Right Fender"
                  />
                </div>
                <div>
                  <Label>Category *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(val) => setFormData({ ...formData, category: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Part Number (Optional)</Label>
                  <Input
                    value={formData.part_number}
                    onChange={(e) => setFormData({ ...formData, part_number: e.target.value })}
                    placeholder="e.g., FRF-001"
                  />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label>Active</Label>
                </div>
              </div>
              
              <div>
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the part"
                  rows={2}
                />
              </div>

              {/* Default Pricing by Car Type */}
              <div>
                <Label className="text-sm font-semibold mb-3 block">Default Pricing (All Brands)</Label>
                <div className="grid grid-cols-3 gap-4">
                  {CAR_TYPES.map(carType => (
                    <PricingInput
                      key={carType}
                      carType={carType}
                      pricing={formData[carType]}
                      onChange={(pricing) => setFormData({ ...formData, [carType]: pricing })}
                    />
                  ))}
                </div>
              </div>

              {/* Brand Overrides */}
              <BrandOverrideSection
                overrides={formData.brand_overrides}
                onChange={(overrides) => setFormData({ ...formData, brand_overrides: overrides })}
              />
            </div>
          </div>
          
          <DialogFooter className="flex-shrink-0 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save Part</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Rule Condition Row Component
const RuleConditionRow = ({ condition, index, onChange, onRemove }) => {
  const [showRange, setShowRange] = useState(condition?.condition?.operator === 'between');

  const updateCondition = (field, value) => {
    const updated = { ...condition };
    if (!updated.condition) updated.condition = {};
    updated.condition[field] = value;
    if (field === 'operator' && value === 'between') {
      updated.condition.value = [0, 0];
      setShowRange(true);
    } else if (field === 'operator') {
      setShowRange(false);
    }
    onChange(updated);
  };

  const updateAction = (field, value) => {
    const updated = { ...condition };
    if (!updated.action) updated.action = {};
    updated.action[field] = value;
    onChange(updated);
  };

  const updateRangeValue = (idx, val) => {
    const updated = { ...condition };
    if (!updated.condition.value || !Array.isArray(updated.condition.value)) {
      updated.condition.value = [0, 0];
    }
    updated.condition.value[idx] = parseFloat(val) || 0;
    onChange(updated);
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Condition {index + 1}</span>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-red-500 h-8">
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="grid grid-cols-3 gap-3">
        {/* Operator */}
        <div>
          <Label className="text-xs">If answer</Label>
          <Select
            value={condition?.condition?.operator || ''}
            onValueChange={(val) => updateCondition('operator', val)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select operator" />
            </SelectTrigger>
            <SelectContent>
              {OPERATORS.map(op => (
                <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Value */}
        <div>
          <Label className="text-xs">Value</Label>
          {showRange ? (
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={condition?.condition?.value?.[0] || 0}
                onChange={(e) => updateRangeValue(0, e.target.value)}
                className="h-9"
                placeholder="Min"
              />
              <span className="text-gray-400">-</span>
              <Input
                type="number"
                value={condition?.condition?.value?.[1] || 0}
                onChange={(e) => updateRangeValue(1, e.target.value)}
                className="h-9"
                placeholder="Max"
              />
            </div>
          ) : (
            <Input
              value={condition?.condition?.value || ''}
              onChange={(e) => updateCondition('value', e.target.value)}
              className="h-9"
              placeholder="Value to compare"
            />
          )}
        </div>
        
        {/* Action Type */}
        <div>
          <Label className="text-xs">Then</Label>
          <Select
            value={condition?.action?.action_type || ''}
            onValueChange={(val) => updateAction('action_type', val)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Action" />
            </SelectTrigger>
            <SelectContent>
              {ACTION_TYPES.map(at => (
                <SelectItem key={at.value} value={at.value}>{at.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {/* Priority */}
        <div>
          <Label className="text-xs">Priority</Label>
          <Select
            value={condition?.action?.priority || 'normal'}
            onValueChange={(val) => updateAction('priority', val)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        {/* Notes */}
        <div>
          <Label className="text-xs">Notes (Optional)</Label>
          <Input
            value={condition?.action?.notes || ''}
            onChange={(e) => updateAction('notes', e.target.value)}
            className="h-9"
            placeholder="Additional notes"
          />
        </div>
      </div>
    </div>
  );
};

// Repair Rule Form Modal
const RuleFormModal = ({ isOpen, onClose, rule, parts, questions, onSave }) => {
  const [formData, setFormData] = useState({
    part_id: '',
    question_id: '',
    question_text: '',
    conditions: [],
    is_active: true
  });
  const [saving, setSaving] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);

  useEffect(() => {
    if (rule) {
      setFormData({
        part_id: rule.part_id || '',
        question_id: rule.question_id || '',
        question_text: rule.question_text || '',
        conditions: rule.conditions || [],
        is_active: rule.is_active !== false
      });
      const q = questions.find(q => q.question_id === rule.question_id);
      setSelectedQuestion(q);
    } else {
      setFormData({
        part_id: '',
        question_id: '',
        question_text: '',
        conditions: [],
        is_active: true
      });
      setSelectedQuestion(null);
    }
  }, [rule, isOpen, questions]);

  const handleQuestionSelect = (qId) => {
    const q = questions.find(q => q.question_id === qId);
    setSelectedQuestion(q);
    setFormData({
      ...formData,
      question_id: qId,
      question_text: q?.question_text || ''
    });
  };

  const addCondition = () => {
    setFormData({
      ...formData,
      conditions: [
        ...formData.conditions,
        {
          condition: { operator: 'equals', value: '' },
          action: { action_type: 'repair', priority: 'normal', notes: '' }
        }
      ]
    });
  };

  const updateCondition = (index, updated) => {
    const conditions = [...formData.conditions];
    conditions[index] = updated;
    setFormData({ ...formData, conditions });
  };

  const removeCondition = (index) => {
    setFormData({
      ...formData,
      conditions: formData.conditions.filter((_, i) => i !== index)
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.part_id || !formData.question_id) {
      toast.error('Part and Question are required');
      return;
    }
    if (formData.conditions.length === 0) {
      toast.error('At least one condition is required');
      return;
    }

    setSaving(true);
    try {
      if (rule?.id) {
        await repairsApi.updateRule(rule.id, formData);
        toast.success('Rule updated successfully');
      } else {
        await repairsApi.createRule(formData);
        toast.success('Rule created successfully');
      }
      onSave();
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save rule');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-purple-600" />
            {rule ? 'Edit Repair Rule' : 'Create Repair Rule'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
          <div className="flex-1 min-h-0 overflow-y-auto pr-4" style={{ maxHeight: 'calc(90vh - 160px)' }}>
            <div className="space-y-6 py-4">
              {/* Part Selection */}
              <div>
                <Label>Repair Part *</Label>
                <Select
                  value={formData.part_id}
                  onValueChange={(val) => setFormData({ ...formData, part_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a repair part" />
                  </SelectTrigger>
                  <SelectContent>
                    {parts.map(part => (
                      <SelectItem key={part.id} value={part.id}>
                        {part.name} ({part.category})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Question Selection */}
              <div>
                <Label>Linked Question *</Label>
                <Select
                  value={formData.question_id}
                  onValueChange={handleQuestionSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a question" />
                  </SelectTrigger>
                  <SelectContent>
                    {questions.map(q => (
                      <SelectItem key={q.question_id} value={q.question_id}>
                        <div className="flex flex-col">
                          <span className="truncate max-w-[400px]">{q.question_text}</span>
                          <span className="text-xs text-gray-500">{q.category_name} • {q.package_name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                
                {selectedQuestion && (
                  <div className="mt-2 p-3 bg-blue-50 rounded-lg text-sm">
                    <p className="font-medium text-blue-800">{selectedQuestion.question_text}</p>
                    <p className="text-xs text-blue-600 mt-1">
                      Type: {selectedQuestion.question_type} • Category: {selectedQuestion.category_name}
                    </p>
                    {selectedQuestion.options?.length > 0 && (
                      <p className="text-xs text-blue-600 mt-1">
                        Options: {selectedQuestion.options.join(', ')}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Conditions */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="text-sm font-semibold">Conditions & Actions *</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addCondition}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Condition
                  </Button>
                </div>
                
                {formData.conditions.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 rounded-lg border-2 border-dashed">
                    <HelpCircle className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No conditions defined</p>
                    <p className="text-xs text-gray-400 mt-1">Click "Add Condition" to define when this repair should be recommended</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.conditions.map((cond, idx) => (
                      <RuleConditionRow
                        key={idx}
                        condition={cond}
                        index={idx}
                        onChange={(updated) => updateCondition(idx, updated)}
                        onRemove={() => removeCondition(idx)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Active Status */}
              <div className="flex items-center gap-3">
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label>Rule is Active</Label>
              </div>
            </div>
          </ScrollArea>
          
          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Saving...</> : <><Save className="h-4 w-4 mr-2" />Save Rule</>}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

// Main Repairs Module Page
export default function RepairsModulePage() {
  const [activeSubTab, setActiveSubTab] = useState('parts');
  const [loading, setLoading] = useState(true);
  
  // Data
  const [parts, setParts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [rules, setRules] = useState([]);
  const [questions, setQuestions] = useState([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  
  // Modals
  const [partModal, setPartModal] = useState({ open: false, part: null });
  const [ruleModal, setRuleModal] = useState({ open: false, rule: null });

  // Fetch data
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [partsRes, categoriesRes, rulesRes, questionsRes] = await Promise.all([
        repairsApi.getParts({}),
        repairsApi.getPartCategories(),
        repairsApi.getRules({}),
        repairsApi.getAvailableQuestions()
      ]);
      
      setParts(partsRes.data || []);
      setCategories(categoriesRes.data || []);
      setRules(rulesRes.data || []);
      setQuestions(questionsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load repairs data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter parts
  const filteredParts = parts.filter(part => {
    const matchesSearch = !searchTerm || 
      part.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      part.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !categoryFilter || part.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  // Filter rules
  const filteredRules = rules.filter(rule => {
    const matchesSearch = !searchTerm ||
      rule.part?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.question_text?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const handleDeletePart = async (partId) => {
    if (!confirm('Are you sure you want to delete this part?')) return;
    try {
      await repairsApi.deletePart(partId);
      toast.success('Part deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete part');
    }
  };

  const handleDeleteRule = async (ruleId) => {
    if (!confirm('Are you sure you want to delete this rule?')) return;
    try {
      await repairsApi.deleteRule(ruleId);
      toast.success('Rule deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete rule');
    }
  };

  const getCategoryName = (catId) => {
    const cat = categories.find(c => c.id === catId);
    return cat?.name || catId;
  };

  const getPriorityBadge = (priority) => {
    const p = PRIORITIES.find(pr => pr.value === priority);
    return <Badge className={p?.color || 'bg-gray-100'}>{p?.label || priority}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="repairs-module-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Wrench className="h-6 w-6 text-orange-600" />
            Repairs Module
          </h2>
          <p className="text-sm text-gray-500">Manage spare parts pricing and repair rules</p>
        </div>
      </div>

      {/* Sub Tabs */}
      <Tabs value={activeSubTab} onValueChange={setActiveSubTab}>
        <TabsList>
          <TabsTrigger value="parts" className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Spare Parts ({parts.length})
          </TabsTrigger>
          <TabsTrigger value="rules" className="flex items-center gap-2">
            <Link2 className="h-4 w-4" />
            Question Rules ({rules.length})
          </TabsTrigger>
        </TabsList>

        {/* Spare Parts Tab */}
        <TabsContent value="parts" className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search parts..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={categoryFilter || "all"} onValueChange={(val) => setCategoryFilter(val === "all" ? "" : val)}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => setPartModal({ open: true, part: null })}>
              <Plus className="h-4 w-4 mr-2" />
              Add Part
            </Button>
          </div>

          {/* Parts Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Part Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-center">Hatchback</TableHead>
                  <TableHead className="text-center">Sedan</TableHead>
                  <TableHead className="text-center">SUV</TableHead>
                  <TableHead>Overrides</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredParts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No parts found. Click "Add Part" to create one.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredParts.map(part => (
                    <TableRow key={part.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{part.name}</p>
                          {part.part_number && <p className="text-xs text-gray-500">{part.part_number}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getCategoryName(part.category)}</Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        <div>R: ₹{part.hatchback?.repair_price?.toLocaleString() || 0}</div>
                        <div className="text-gray-500">Re: ₹{part.hatchback?.replace_price?.toLocaleString() || 0}</div>
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        <div>R: ₹{part.sedan?.repair_price?.toLocaleString() || 0}</div>
                        <div className="text-gray-500">Re: ₹{part.sedan?.replace_price?.toLocaleString() || 0}</div>
                      </TableCell>
                      <TableCell className="text-center text-xs">
                        <div>R: ₹{part.suv?.repair_price?.toLocaleString() || 0}</div>
                        <div className="text-gray-500">Re: ₹{part.suv?.replace_price?.toLocaleString() || 0}</div>
                      </TableCell>
                      <TableCell>
                        {part.brand_overrides?.length > 0 ? (
                          <Badge className="bg-purple-100 text-purple-700">{part.brand_overrides.length} brands</Badge>
                        ) : (
                          <span className="text-xs text-gray-400">None</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setPartModal({ open: true, part })}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeletePart(part.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        {/* Question Rules Tab */}
        <TabsContent value="rules" className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search rules..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button onClick={() => setRuleModal({ open: true, rule: null })}>
              <Plus className="h-4 w-4 mr-2" />
              Create Rule
            </Button>
          </div>

          {/* Rules Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead>Part</TableHead>
                  <TableHead>Linked Question</TableHead>
                  <TableHead>Conditions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                      No rules found. Click "Create Rule" to link a part to a question.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRules.map(rule => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{rule.part?.name || 'Unknown'}</p>
                          <p className="text-xs text-gray-500">{getCategoryName(rule.part?.category)}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-sm max-w-md truncate">{rule.question_text}</p>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {rule.conditions?.slice(0, 3).map((cond, idx) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {cond.condition?.operator}: {Array.isArray(cond.condition?.value) ? cond.condition.value.join('-') : cond.condition?.value} → {cond.action?.action_type}
                            </Badge>
                          ))}
                          {rule.conditions?.length > 3 && (
                            <Badge variant="outline" className="text-xs">+{rule.conditions.length - 3} more</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {rule.is_active ? (
                          <Badge className="bg-green-100 text-green-700">Active</Badge>
                        ) : (
                          <Badge className="bg-gray-100 text-gray-600">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setRuleModal({ open: true, rule })}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteRule(rule.id)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modals */}
      <PartFormModal
        isOpen={partModal.open}
        onClose={() => setPartModal({ open: false, part: null })}
        part={partModal.part}
        categories={categories}
        onSave={fetchData}
      />
      
      <RuleFormModal
        isOpen={ruleModal.open}
        onClose={() => setRuleModal({ open: false, rule: null })}
        rule={ruleModal.rule}
        parts={parts}
        questions={questions}
        onSave={fetchData}
      />
    </div>
  );
}
