import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { repairsApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  X, AlertCircle, CheckCircle, HelpCircle, Settings, Filter, ArrowRight
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

// Action types - now includes Labor and Both options
const ACTION_TYPES = [
  { value: 'repair', label: 'Repair (Part Cost Only)' },
  { value: 'labor', label: 'Labor (Labor Cost Only)' },
  { value: 'both', label: 'Both (Part + Labor)' },
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
      <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-blue-600" />
            {part ? 'Edit Repair Part' : 'Add New Repair Part'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto pr-2">
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
                  <Label>Component *</Label>
                  <Select
                    value={formData.category}
                    onValueChange={(val) => setFormData({ ...formData, category: val })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select component type" />
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
const RuleConditionRow = ({ condition, index, onChange, onRemove, selectedQuestion }) => {
  // Get available answer options from the selected question
  const getAnswerOptions = () => {
    if (!selectedQuestion) return [];
    
    const options = [];
    
    // Add main options if available
    if (selectedQuestion.options?.length > 0) {
      selectedQuestion.options.forEach(opt => {
        options.push({ value: opt, label: opt, type: 'answer' });
      });
    }
    
    // Add sub-question 1 options (Dent)
    if (selectedQuestion.sub_options_1?.length > 0) {
      options.push({ value: '__divider_dent__', label: `── ${selectedQuestion.sub_question_1 || 'Dent Options'} ──`, disabled: true });
      selectedQuestion.sub_options_1.forEach(opt => {
        options.push({ value: `dent:${opt}`, label: opt, type: 'dent' });
      });
    }
    
    // Add sub-question 2 options (Scratch)
    if (selectedQuestion.sub_options_2?.length > 0) {
      options.push({ value: '__divider_scratch__', label: `── ${selectedQuestion.sub_question_2 || 'Scratch Options'} ──`, disabled: true });
      selectedQuestion.sub_options_2.forEach(opt => {
        options.push({ value: `scratch:${opt}`, label: opt, type: 'scratch' });
      });
    }
    
    return options;
  };

  const answerOptions = getAnswerOptions();

  const updateCondition = (field, value) => {
    const updated = { ...condition };
    if (!updated.condition) updated.condition = {};
    
    if (field === 'answer') {
      // Parse the answer value to determine type
      if (value.startsWith('dent:')) {
        updated.condition.sub_answer_type = 'dent';
        updated.condition.value = value.replace('dent:', '');
      } else if (value.startsWith('scratch:')) {
        updated.condition.sub_answer_type = 'scratch';
        updated.condition.value = value.replace('scratch:', '');
      } else {
        updated.condition.sub_answer_type = 'answer';
        updated.condition.value = value;
      }
      updated.condition.answer = value; // Store full value for UI
    } else {
      updated.condition[field] = value;
    }
    onChange(updated);
  };

  const updateAction = (field, value) => {
    const updated = { ...condition };
    if (!updated.action) updated.action = {};
    updated.action[field] = value;
    onChange(updated);
  };

  // Get current selected answer value for display
  const getCurrentAnswerValue = () => {
    if (condition?.condition?.answer) return condition.condition.answer;
    // Reconstruct from sub_answer_type and value
    if (condition?.condition?.sub_answer_type && condition?.condition?.value) {
      if (condition.condition.sub_answer_type === 'dent') {
        return `dent:${condition.condition.value}`;
      } else if (condition.condition.sub_answer_type === 'scratch') {
        return `scratch:${condition.condition.value}`;
      }
      return condition.condition.value;
    }
    return '';
  };

  return (
    <div className="border rounded-lg p-4 bg-gray-50 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Condition {index + 1}</span>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="text-red-500 h-8">
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {/* Answer Selection */}
        <div>
          <Label className="text-xs">If answer is</Label>
          <Select
            value={getCurrentAnswerValue()}
            onValueChange={(val) => updateCondition('answer', val)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select answer" />
            </SelectTrigger>
            <SelectContent>
              {answerOptions.length === 0 ? (
                <SelectItem value="__none__" disabled>Select a question first</SelectItem>
              ) : (
                answerOptions.map((opt, idx) => (
                  opt.disabled ? (
                    <div key={idx} className="px-2 py-1.5 text-xs text-gray-500 font-medium bg-gray-50">
                      {opt.label}
                    </div>
                  ) : (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  )
                ))
              )}
            </SelectContent>
          </Select>
        </div>
        
        {/* Action Type */}
        <div>
          <Label className="text-xs">Then charge</Label>
          <Select
            value={condition?.action?.action_type || ''}
            onValueChange={(val) => updateAction('action_type', val)}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select action" />
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

// Grouped Rules View - displays rules grouped by Inspection Category then Question
const GroupedRulesView = ({ rules, onEdit, onDelete }) => {
  const [expandedCategories, setExpandedCategories] = useState({});
  const [expandedQuestions, setExpandedQuestions] = useState({});

  // Group rules by inspection_category_name, then by question_text
  const groupedRules = useMemo(() => {
    const grouped = {};
    
    rules.forEach(rule => {
      // Use inspection_category_name (from linked question's category), fallback to category_name for backward compatibility
      const categoryName = rule.inspection_category_name || rule.category_name || 'Uncategorized';
      const questionText = rule.question_text || 'Unknown Question';
      
      if (!grouped[categoryName]) {
        grouped[categoryName] = {
          questions: {},
          totalRules: 0,
          categoryId: rule.inspection_category_id || rule.category_id
        };
      }
      
      if (!grouped[categoryName].questions[questionText]) {
        grouped[categoryName].questions[questionText] = {
          rules: [],
          questionId: rule.question_id
        };
      }
      
      grouped[categoryName].questions[questionText].rules.push(rule);
      grouped[categoryName].totalRules++;
    });
    
    return grouped;
  }, [rules]);

  const toggleCategory = (categoryName) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryName]: !prev[categoryName]
    }));
  };

  const toggleQuestion = (key) => {
    setExpandedQuestions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Get condition display text
  const getConditionDisplay = (rule) => {
    // Handle new format with conditions array
    if (rule.conditions && rule.conditions.length > 0) {
      const cond = rule.conditions[0];
      const answer = cond.condition?.answer || cond.condition?.value || 'N/A';
      const action = cond.action?.action_type || 'repair';
      return { answer, action };
    }
    // Handle old format
    const answer = rule.condition_value || 'N/A';
    const action = rule.action_type || 'repair';
    return { answer, action };
  };

  const getActionBadgeColor = (action) => {
    switch (action?.toLowerCase()) {
      case 'repair': return 'bg-blue-100 text-blue-700';
      case 'labor': return 'bg-purple-100 text-purple-700';
      case 'both': return 'bg-green-100 text-green-700';
      case 'replace': return 'bg-orange-100 text-orange-700';
      case 'inspect_further': return 'bg-yellow-100 text-yellow-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  if (rules.length === 0) {
    return (
      <div className="border rounded-lg p-8 text-center text-gray-500">
        <HelpCircle className="h-12 w-12 mx-auto text-gray-400 mb-3" />
        <p className="font-medium">No rules found</p>
        <p className="text-sm">Click "Create Rule" to link a part to a question.</p>
      </div>
    );
  }

  const categories = Object.keys(groupedRules).sort();

  return (
    <div className="space-y-3">
      {categories.map(categoryName => {
        const categoryData = groupedRules[categoryName];
        const isCategoryExpanded = expandedCategories[categoryName] !== false; // Default expanded
        const questionCount = Object.keys(categoryData.questions).length;
        
        return (
          <div key={categoryName} className="border rounded-lg overflow-hidden">
            {/* Category Header */}
            <div
              className="flex items-center justify-between p-3 bg-gradient-to-r from-gray-50 to-white cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => toggleCategory(categoryName)}
            >
              <div className="flex items-center gap-3">
                {isCategoryExpanded ? (
                  <ChevronDown className="h-5 w-5 text-gray-500" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-gray-500" />
                )}
                <div>
                  <h3 className="font-semibold text-gray-900">{categoryName}</h3>
                  <p className="text-xs text-gray-500">
                    {questionCount} question{questionCount !== 1 ? 's' : ''} • {categoryData.totalRules} rule{categoryData.totalRules !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="bg-white">
                {categoryData.totalRules} rules
              </Badge>
            </div>
            
            {/* Questions within Category */}
            {isCategoryExpanded && (
              <div className="border-t">
                {Object.entries(categoryData.questions).map(([questionText, questionData], qIdx) => {
                  const questionKey = `${categoryName}-${questionText}`;
                  const isQuestionExpanded = expandedQuestions[questionKey] !== false; // Default expanded
                  
                  return (
                    <div key={questionKey} className={qIdx > 0 ? 'border-t' : ''}>
                      {/* Question Header */}
                      <div
                        className="flex items-center justify-between px-4 py-2 bg-gray-50/50 cursor-pointer hover:bg-gray-100 transition-colors"
                        onClick={() => toggleQuestion(questionKey)}
                      >
                        <div className="flex items-center gap-2">
                          {isQuestionExpanded ? (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-gray-400" />
                          )}
                          <span className="text-sm font-medium text-gray-700 max-w-lg truncate">
                            {questionText}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {questionData.rules.length} rule{questionData.rules.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      
                      {/* Rules for this Question */}
                      {isQuestionExpanded && (
                        <div className="divide-y divide-gray-100">
                          {questionData.rules.map(rule => {
                            const { answer, action } = getConditionDisplay(rule);
                            
                            return (
                              <div
                                key={rule.id}
                                className="flex items-center justify-between px-6 py-2 hover:bg-blue-50/50 transition-colors"
                              >
                                <div className="flex items-center gap-4 flex-1">
                                  {/* Part Name */}
                                  <div className="w-32">
                                    <p className="text-sm font-medium text-gray-900">{rule.part?.name || rule.part_name || 'N/A'}</p>
                                  </div>
                                  
                                  {/* Answer Badge */}
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500">If answer:</span>
                                    <Badge variant="outline" className="bg-white text-xs font-medium">
                                      {answer}
                                    </Badge>
                                  </div>
                                  
                                  {/* Arrow */}
                                  <ArrowRight className="h-4 w-4 text-gray-400" />
                                  
                                  {/* Action Badge */}
                                  <Badge className={`${getActionBadgeColor(action)} text-xs`}>
                                    {action?.toUpperCase() || 'REPAIR'}
                                  </Badge>
                                  
                                  {/* Status */}
                                  {rule.is_active ? (
                                    <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge>
                                  ) : (
                                    <Badge className="bg-gray-100 text-gray-600 text-xs">Inactive</Badge>
                                  )}
                                </div>
                                
                                {/* Actions */}
                                <div className="flex items-center gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onEdit(rule);
                                    }}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onDelete(rule.id);
                                    }}
                                    className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Repair Rule Form Modal
const RuleFormModal = ({ isOpen, onClose, rule, parts, questions, onSave }) => {
  const [formData, setFormData] = useState({
    part_id: '',
    question_id: '',
    question_text: '',
    inspection_category_id: '',
    inspection_category_name: '',
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
        inspection_category_id: rule.inspection_category_id || rule.category_id || '',
        inspection_category_name: rule.inspection_category_name || rule.category_name || '',
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
        inspection_category_id: '',
        inspection_category_name: '',
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
      question_text: q?.question_text || '',
      inspection_category_id: q?.category_id || '',
      inspection_category_name: q?.category_name || ''
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
      <DialogContent className="max-w-3xl h-[85vh] flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-purple-600" />
            {rule ? 'Edit Repair Rule' : 'Create Repair Rule'}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-y-auto pr-2">
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
                        selectedQuestion={selectedQuestion}
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
          </div>
          
          <DialogFooter className="flex-shrink-0 pt-4 border-t">
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
  const [categories, setCategories] = useState([]); // Component categories for parts
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
    // Get condition value from conditions array or fallback to condition_value
    const conditionValue = rule.conditions?.[0]?.condition?.value || 
                          rule.conditions?.[0]?.condition?.answer || 
                          rule.condition_value || '';
    
    const matchesSearch = !searchTerm ||
      rule.part?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.part_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.question_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.inspection_category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.category_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      conditionValue?.toLowerCase().includes(searchTerm.toLowerCase());
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

  const getComponentName = (catId) => {
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
                  <SelectValue placeholder="All Components" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Components</SelectItem>
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
                  <TableHead>Component</TableHead>
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
                        <Badge variant="outline">{getComponentName(part.category)}</Badge>
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

          {/* Grouped Rules Display */}
          <GroupedRulesView 
            rules={filteredRules} 
            onEdit={(rule) => setRuleModal({ open: true, rule })}
            onDelete={handleDeleteRule}
          />
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
