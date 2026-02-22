import React, { useState, useEffect, useCallback } from 'react';
import { inspectionTemplatesApi, inspectionQAApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Plus, Loader2, Pencil, Trash2, FileText, Star,
  ChevronDown, ChevronRight, ToggleLeft, ToggleRight, 
  Search, ClipboardList, GripVertical
} from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Template Card Component
const TemplateCard = ({ template, onEdit, onToggle, onDelete, onSetDefault }) => {
  return (
    <div 
      className={`border rounded-xl p-4 ${template.is_active ? 'bg-white' : 'bg-gray-50 opacity-75'} ${template.is_default ? 'ring-2 ring-indigo-500' : ''}`}
      data-testid={`template-card-${template.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-indigo-100">
            <ClipboardList className="h-6 w-6 text-indigo-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              {template.name}
              {template.is_default && (
                <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-medium rounded-full flex items-center gap-1">
                  <Star className="h-3 w-3" /> Default
                </span>
              )}
              {!template.is_active && (
                <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-full">Inactive</span>
              )}
            </h3>
            <p className="text-sm text-gray-500">{template.question_count} questions</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {!template.is_default && (
            <button 
              onClick={() => onSetDefault(template)} 
              className="p-2 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors"
              title="Set as Default"
              data-testid={`set-default-${template.id}`}
            >
              <Star className="h-4 w-4" />
            </button>
          )}
          <button 
            onClick={() => onEdit(template)} 
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            data-testid={`edit-template-${template.id}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button 
            onClick={() => onToggle(template)} 
            className={`p-2 rounded-lg transition-colors ${template.is_active ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
            data-testid={`toggle-template-${template.id}`}
          >
            {template.is_active ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
          </button>
          {!template.is_default && (
            <button 
              onClick={() => onDelete(template)} 
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              data-testid={`delete-template-${template.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Description */}
      {template.description && (
        <p className="mt-3 text-sm text-gray-500">{template.description}</p>
      )}
    </div>
  );
};

// Category with Questions Selector
const CategoryQuestionSelector = ({ category, questions, selectedIds, onToggle }) => {
  const [expanded, setExpanded] = useState(false);
  const categoryQuestions = questions.filter(q => q.category_id === category.category_id);
  const selectedCount = categoryQuestions.filter(q => selectedIds.includes(q.id)).length;
  const allSelected = categoryQuestions.length > 0 && selectedCount === categoryQuestions.length;
  
  const handleCategoryToggle = () => {
    if (allSelected) {
      categoryQuestions.forEach(q => {
        if (selectedIds.includes(q.id)) {
          onToggle(q.id);
        }
      });
    } else {
      categoryQuestions.forEach(q => {
        if (!selectedIds.includes(q.id)) {
          onToggle(q.id);
        }
      });
    }
  };
  
  return (
    <div className="border rounded-lg overflow-hidden">
      <div 
        className="flex items-center gap-3 p-3 bg-gray-50 cursor-pointer hover:bg-gray-100"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown className="h-4 w-4 text-gray-500" /> : <ChevronRight className="h-4 w-4 text-gray-500" />}
        <Checkbox 
          checked={allSelected} 
          onCheckedChange={handleCategoryToggle}
          onClick={(e) => e.stopPropagation()}
        />
        <span className="font-medium text-gray-700 flex-1">{category.category_name}</span>
        <span className="text-sm text-gray-500">{selectedCount}/{categoryQuestions.length}</span>
      </div>
      
      {expanded && categoryQuestions.length > 0 && (
        <div className="p-3 space-y-2 bg-white">
          {categoryQuestions.map(question => (
            <div 
              key={question.id} 
              className="flex items-start gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer"
              onClick={() => onToggle(question.id)}
            >
              <Checkbox 
                checked={selectedIds.includes(question.id)}
                onCheckedChange={() => onToggle(question.id)}
              />
              <div className="flex-1">
                <p className="text-sm text-gray-700">{question.question}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`px-2 py-0.5 text-xs rounded-full ${
                    question.answer_type === 'multiple_choice' ? 'bg-blue-100 text-blue-700' :
                    question.answer_type === 'photo' ? 'bg-green-100 text-green-700' :
                    question.answer_type === 'video' ? 'bg-purple-100 text-purple-700' :
                    question.answer_type === 'multiple_choice_photo' ? 'bg-cyan-100 text-cyan-700' :
                    question.answer_type === 'multiple_choice_video' ? 'bg-pink-100 text-pink-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {question.answer_type === 'multiple_choice' ? 'MCQ' : 
                     question.answer_type === 'photo' ? 'Photo' : 
                     question.answer_type === 'video' ? 'Video' :
                     question.answer_type === 'multiple_choice_photo' ? 'MCQ+Photo' :
                     question.answer_type === 'multiple_choice_video' ? 'MCQ+Video' :
                     question.answer_type}
                  </span>
                  {question.sub_question_1 && <span className="text-xs text-gray-400">+1 sub-Q</span>}
                  {question.sub_question_2 && <span className="text-xs text-gray-400">+2 sub-Q</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      {expanded && categoryQuestions.length === 0 && (
        <div className="p-3 text-sm text-gray-400 text-center">No questions in this category</div>
      )}
    </div>
  );
};

const InspectionTemplatesPage = () => {
  const [templates, setTemplates] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    question_ids: [],
    is_default: false,
    is_active: true,
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [templatesRes, questionsRes, categoriesRes] = await Promise.all([
        inspectionTemplatesApi.getTemplates(),
        inspectionQAApi.getQuestions(),
        inspectionQAApi.getCategories(),
      ]);
      setTemplates(templatesRes.data);
      setQuestions(questionsRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openModal = async (template = null) => {
    if (template) {
      try {
        const res = await inspectionTemplatesApi.getTemplate(template.id);
        const fullTemplate = res.data;
        setEditingTemplate(fullTemplate);
        setFormData({
          name: fullTemplate.name || '',
          description: fullTemplate.description || '',
          question_ids: fullTemplate.question_ids || [],
          is_default: fullTemplate.is_default || false,
          is_active: fullTemplate.is_active !== false,
        });
      } catch (error) {
        console.error('Error fetching template details:', error);
        toast.error('Failed to load template details');
        return;
      }
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        description: '',
        question_ids: [],
        is_default: false,
        is_active: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleQuestionToggle = (questionId) => {
    setFormData(prev => ({
      ...prev,
      question_ids: prev.question_ids.includes(questionId)
        ? prev.question_ids.filter(id => id !== questionId)
        : [...prev.question_ids, questionId]
    }));
  };

  const handleSelectAllQuestions = () => {
    if (formData.question_ids.length === questions.length) {
      setFormData(prev => ({ ...prev, question_ids: [] }));
    } else {
      setFormData(prev => ({ ...prev, question_ids: questions.map(q => q.id) }));
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (formData.question_ids.length === 0) {
      toast.error('Please select at least one question');
      return;
    }

    try {
      setSaving(true);
      // Add dummy partner_id for backward compatibility (will be linked via ReportTemplate)
      const saveData = {
        ...formData,
        partner_id: editingTemplate?.partner_id || 'placeholder',
        report_template_id: null,
      };
      
      if (editingTemplate) {
        await inspectionTemplatesApi.updateTemplate(editingTemplate.id, saveData);
        toast.success('Template updated');
      } else {
        await inspectionTemplatesApi.createTemplate(saveData);
        toast.success('Template created');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error(error.response?.data?.detail || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (template) => {
    try {
      await inspectionTemplatesApi.toggleTemplate(template.id);
      toast.success(`Template ${template.is_active ? 'deactivated' : 'activated'}`);
      fetchData();
    } catch (error) {
      console.error('Error toggling template:', error);
      toast.error('Failed to toggle template status');
    }
  };

  const handleDelete = async (template) => {
    if (!window.confirm(`Are you sure you want to delete "${template.name}"?`)) {
      return;
    }
    
    try {
      await inspectionTemplatesApi.deleteTemplate(template.id);
      toast.success('Template deleted');
      fetchData();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete template');
    }
  };

  const handleSetDefault = async (template) => {
    try {
      await inspectionTemplatesApi.setDefault(template.id);
      toast.success(`"${template.name}" set as default template`);
      fetchData();
    } catch (error) {
      console.error('Error setting default:', error);
      toast.error('Failed to set default template');
    }
  };

  const handleSeedDefault = async () => {
    try {
      const res = await inspectionTemplatesApi.seedDefault();
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      console.error('Error seeding default:', error);
      toast.error('Failed to seed default template');
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    return template.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Stats
  const stats = {
    total: templates.length,
    active: templates.filter(t => t.is_active).length,
    hasDefault: templates.some(t => t.is_default),
  };

  return (
    <div className="p-4" data-testid="inspection-templates-page">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-4 text-white">
          <p className="text-indigo-100 text-sm">Total Questionnaires</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
          <p className="text-emerald-100 text-sm">Active</p>
          <p className="text-2xl font-bold">{stats.active}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <p className="text-blue-100 text-sm">Questions Pool</p>
          <p className="text-2xl font-bold">{questions.length}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
          <p className="text-purple-100 text-sm">Categories</p>
          <p className="text-2xl font-bold">{categories.length}</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 mb-6">
        <p className="text-indigo-800 text-sm">
          <strong>Inspection Templates</strong> define the set of questions for an inspection. 
          Connect these to Partners via <strong>Report Templates</strong> to complete the flow.
        </p>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search questionnaires..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="search-templates"
          />
        </div>
        {!stats.hasDefault && (
          <Button 
            variant="outline"
            onClick={handleSeedDefault}
            data-testid="seed-default-btn"
          >
            <Star className="h-4 w-4 mr-2" /> Create Default
          </Button>
        )}
        <Button 
          onClick={() => openModal()}
          className="bg-gradient-to-r from-indigo-600 to-indigo-700"
          data-testid="add-template-btn"
        >
          <Plus className="h-4 w-4 mr-2" /> Create Questionnaire
        </Button>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto" />
          <p className="text-gray-500 mt-2">Loading questionnaires...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12 border rounded-xl bg-gray-50">
          <ClipboardList className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No inspection questionnaires found</p>
          <p className="text-sm text-gray-400 mt-1">Create a questionnaire to define inspection questions</p>
          <div className="flex justify-center gap-3 mt-4">
            {!stats.hasDefault && (
              <Button variant="outline" onClick={handleSeedDefault}>
                <Star className="h-4 w-4 mr-2" /> Create Default
              </Button>
            )}
            <Button onClick={() => openModal()}>
              <Plus className="h-4 w-4 mr-2" /> Create Questionnaire
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map(template => (
            <TemplateCard 
              key={template.id} 
              template={template} 
              onEdit={openModal} 
              onToggle={handleToggle}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
            />
          ))}
        </div>
      )}

      {/* Template Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="template-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-indigo-600" />
              {editingTemplate ? 'Edit Questionnaire' : 'Create Questionnaire'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-700 flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm">1</span>
                Basic Information
              </h4>
              
              <div className="grid gap-4 pl-8">
                <div>
                  <Label>Questionnaire Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g., Standard Vehicle Inspection"
                    data-testid="template-name-input"
                  />
                </div>
                
                <div>
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Brief description of this questionnaire..."
                    rows={2}
                    data-testid="description-input"
                  />
                </div>
              </div>
            </div>

            {/* Question Selection */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-700 flex items-center gap-2">
                  <span className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm">2</span>
                  Select Questions
                </h4>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {formData.question_ids.length}/{questions.length} selected
                  </span>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleSelectAllQuestions}
                  >
                    {formData.question_ids.length === questions.length ? 'Deselect All' : 'Select All'}
                  </Button>
                </div>
              </div>
              
              <div className="pl-8 space-y-2 max-h-[300px] overflow-y-auto">
                {categories.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <ClipboardList className="h-8 w-8 mx-auto mb-2" />
                    <p>No questions available</p>
                    <p className="text-sm">Add questions in the "Inspection Q&A" tab first</p>
                  </div>
                ) : (
                  categories.map(category => (
                    <CategoryQuestionSelector
                      key={category.category_id}
                      category={category}
                      questions={questions}
                      selectedIds={formData.question_ids}
                      onToggle={handleQuestionToggle}
                    />
                  ))
                )}
              </div>
            </div>

            {/* Status */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-700 flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-sm">3</span>
                Status
              </h4>
              
              <div className="pl-8 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Active</Label>
                    <p className="text-sm text-gray-500">Questionnaire can be used in Report Templates</p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                    data-testid="active-switch"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Set as Default</Label>
                    <p className="text-sm text-gray-500">Use this questionnaire as default</p>
                  </div>
                  <Switch
                    checked={formData.is_default}
                    onCheckedChange={(checked) => setFormData({...formData, is_default: checked})}
                    data-testid="default-switch"
                  />
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="bg-gradient-to-r from-indigo-600 to-indigo-700"
              data-testid="save-template-btn"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTemplate ? 'Update Questionnaire' : 'Create Questionnaire'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InspectionTemplatesPage;
