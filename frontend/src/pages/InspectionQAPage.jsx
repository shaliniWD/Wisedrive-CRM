import React, { useState, useEffect, useCallback } from 'react';
import { inspectionQAApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Plus, Loader2, Pencil, Trash2, HelpCircle, Camera, Video, 
  ListChecks, GripVertical, Search, CheckCircle, XCircle, Clock, 
  Layers, FolderPlus
} from 'lucide-react';

// Answer type options
const ANSWER_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice', icon: ListChecks, color: 'text-blue-600 bg-blue-50' },
  { value: 'photo', label: 'Photo Upload', icon: Camera, color: 'text-emerald-600 bg-emerald-50' },
  { value: 'video', label: 'Video (45s)', icon: Video, color: 'text-purple-600 bg-purple-50' },
  { value: 'multiple_choice_photo', label: 'MCQ + Photo', icon: Camera, color: 'text-cyan-600 bg-cyan-50' },
  { value: 'multiple_choice_video', label: 'MCQ + Video', icon: Video, color: 'text-pink-600 bg-pink-50' },
];

// Check if answer type includes multiple choice
const hasMultipleChoice = (type) => type === 'multiple_choice' || type === 'multiple_choice_photo' || type === 'multiple_choice_video';

// Check if answer type includes photo/video
const hasMedia = (type) => type === 'photo' || type === 'video' || type === 'multiple_choice_photo' || type === 'multiple_choice_video';
const hasPhoto = (type) => type === 'photo' || type === 'multiple_choice_photo';
const hasVideo = (type) => type === 'video' || type === 'multiple_choice_video';

// Answer Type Badge
const AnswerTypeBadge = ({ type }) => {
  const config = ANSWER_TYPES.find(t => t.value === type) || ANSWER_TYPES[0];
  const Icon = config.icon;
  
  // For combined types, show both icons
  if (type === 'multiple_choice_photo') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-cyan-600 bg-cyan-50">
        <ListChecks className="h-3 w-3" />
        <span>+</span>
        <Camera className="h-3 w-3" />
        MCQ + Photo
      </span>
    );
  }
  if (type === 'multiple_choice_video') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-pink-600 bg-pink-50">
        <ListChecks className="h-3 w-3" />
        <span>+</span>
        <Video className="h-3 w-3" />
        MCQ + Video
      </span>
    );
  }
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.color}`}>
      <Icon className="h-3 w-3" />
      {config.label}
    </span>
  );
};

// Options Display Component
const OptionsDisplay = ({ options, correctAnswer }) => {
  if (!options || options.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1 mt-1">
      {options.map((opt, idx) => (
        <span 
          key={idx} 
          className={`px-1.5 py-0.5 rounded text-xs ${
            opt === correctAnswer 
              ? 'bg-emerald-100 text-emerald-700 font-medium' 
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {opt}
          {opt === correctAnswer && <CheckCircle className="h-2.5 w-2.5 inline ml-0.5" />}
        </span>
      ))}
    </div>
  );
};

// Question Row Component
const QuestionRow = ({ question, onEdit, onDelete, onToggle }) => {
  return (
    <tr className={`hover:bg-gray-50 ${!question.is_active ? 'opacity-60 bg-gray-50' : ''}`} data-testid={`qa-row-${question.id}`}>
      {/* Category */}
      <td className="px-3 py-3 align-top">
        <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
          <Layers className="h-3 w-3" />
          {question.category_name}
        </span>
      </td>
      
      {/* Question */}
      <td className="px-3 py-3 align-top">
        <div className="flex items-start gap-2">
          <button className="mt-0.5 cursor-grab text-gray-300 hover:text-gray-500">
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <div className="font-medium text-gray-900 text-sm">{question.question}</div>
            {question.is_mandatory && <span className="text-xs text-red-500">*Required</span>}
          </div>
        </div>
      </td>
      
      {/* Answer Type */}
      <td className="px-3 py-3 align-top">
        <AnswerTypeBadge type={question.answer_type} />
        {hasMultipleChoice(question.answer_type) && (
          <OptionsDisplay options={question.options} correctAnswer={question.correct_answer} />
        )}
        {hasVideo(question.answer_type) && (
          <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <Clock className="h-3 w-3" /> {question.video_max_duration || 45}s max
          </div>
        )}
        {hasPhoto(question.answer_type) && !hasMultipleChoice(question.answer_type) && (
          <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <Camera className="h-3 w-3" /> Photo capture
          </div>
        )}
      </td>
      
      {/* Sub-Question 1 */}
      <td className="px-3 py-3 align-top">
        {question.sub_question_1 ? (
          <div className="text-sm text-gray-700">{question.sub_question_1}</div>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        )}
      </td>
      
      {/* Sub-Answer 1 */}
      <td className="px-3 py-3 align-top">
        {question.sub_answer_type_1 ? (
          <div>
            <AnswerTypeBadge type={question.sub_answer_type_1} />
            {hasMultipleChoice(question.sub_answer_type_1) && (
              <OptionsDisplay options={question.sub_options_1} correctAnswer={question.sub_correct_answer_1} />
            )}
          </div>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        )}
      </td>
      
      {/* Sub-Question 2 */}
      <td className="px-3 py-3 align-top">
        {question.sub_question_2 ? (
          <div className="text-sm text-gray-700">{question.sub_question_2}</div>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        )}
      </td>
      
      {/* Sub-Answer 2 */}
      <td className="px-3 py-3 align-top">
        {question.sub_answer_type_2 ? (
          <div>
            <AnswerTypeBadge type={question.sub_answer_type_2} />
            {hasMultipleChoice(question.sub_answer_type_2) && (
              <OptionsDisplay options={question.sub_options_2} correctAnswer={question.sub_correct_answer_2} />
            )}
          </div>
        ) : (
          <span className="text-gray-400 text-xs">-</span>
        )}
      </td>
      
      {/* Actions */}
      <td className="px-3 py-3 align-top">
        <div className="flex items-center gap-1">
          <button onClick={() => onEdit(question)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => onToggle(question)} className={`p-1.5 rounded ${question.is_active ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`} title={question.is_active ? 'Deactivate' : 'Activate'}>
            {question.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
          </button>
          <button onClick={() => onDelete(question)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};

// Answer Type Selector with Options
const AnswerTypeSection = ({ label, answerType, setAnswerType, options, setOptions, correctAnswer, setCorrectAnswer, required = false }) => {
  const [newOption, setNewOption] = useState('');
  
  const addOption = () => {
    if (newOption.trim() && !options.includes(newOption.trim())) {
      setOptions([...options, newOption.trim()]);
      setNewOption('');
    }
  };
  
  const removeOption = (opt) => {
    setOptions(options.filter(o => o !== opt));
    if (correctAnswer === opt) setCorrectAnswer('');
  };
  
  return (
    <div className="space-y-3 p-3 bg-gray-50 rounded-lg border">
      <Label className="text-sm font-medium">{label} {required && <span className="text-red-500">*</span>}</Label>
      
      {/* Single Type Selection */}
      <div>
        <Label className="text-xs text-gray-500 mb-2 block">Single Answer Type</Label>
        <div className="grid grid-cols-3 gap-2">
          {ANSWER_TYPES.slice(0, 3).map((type) => {
            const Icon = type.icon;
            const isSelected = answerType === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => setAnswerType(type.value)}
                className={`p-2.5 rounded-lg border-2 transition-all flex flex-col items-center gap-1.5 ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <Icon className={`h-5 w-5 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className={`text-xs font-medium ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                  {type.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Combined Type Selection */}
      <div>
        <Label className="text-xs text-gray-500 mb-2 block">Combined (MCQ + Media)</Label>
        <div className="grid grid-cols-2 gap-2">
          {ANSWER_TYPES.slice(3).map((type) => {
            const isSelected = answerType === type.value;
            return (
              <button
                key={type.value}
                type="button"
                onClick={() => setAnswerType(type.value)}
                className={`p-2.5 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                  isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300 bg-white'
                }`}
              >
                <ListChecks className={`h-4 w-4 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                <span className={`text-xs ${isSelected ? 'text-blue-600' : 'text-gray-400'}`}>+</span>
                {type.value === 'multiple_choice_photo' ? (
                  <Camera className={`h-4 w-4 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                ) : (
                  <Video className={`h-4 w-4 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                )}
                <span className={`text-xs font-medium ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>
                  {type.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      
      {/* Multiple Choice Options - Show for any type that includes MCQ */}
      {hasMultipleChoice(answerType) && (
        <div className="space-y-2 mt-3 pt-3 border-t">
          <div className="flex gap-2">
            <Input
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              placeholder="Add an option..."
              className="h-9"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
            />
            <Button type="button" variant="outline" size="sm" onClick={addOption}>Add</Button>
          </div>
          
          {options.length > 0 && (
            <div className="space-y-1">
              <Label className="text-xs text-gray-500">Click option to mark as correct answer</Label>
              <div className="flex flex-wrap gap-2">
                {options.map((opt, idx) => (
                  <div
                    key={idx}
                    onClick={() => setCorrectAnswer(opt)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded cursor-pointer transition-all text-sm ${
                      correctAnswer === opt 
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' 
                        : 'bg-white text-gray-700 border hover:border-gray-300'
                    }`}
                  >
                    {correctAnswer === opt && <CheckCircle className="h-3.5 w-3.5" />}
                    <span>{opt}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); removeOption(opt); }} className="text-gray-400 hover:text-red-500 ml-1">
                      <XCircle className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {/* Media indicators */}
      {hasVideo(answerType) && (
        <div className="flex items-center gap-2 text-xs text-purple-600 mt-2">
          <Clock className="h-3.5 w-3.5" />
          <span>Video recording limited to 45 seconds</span>
        </div>
      )}
      
      {hasPhoto(answerType) && (
        <div className="flex items-center gap-2 text-xs text-emerald-600 mt-2">
          <Camera className="h-3.5 w-3.5" />
          <span>Mechanic will capture a photo</span>
        </div>
      )}
    </div>
  );
};

export default function InspectionQAPage() {
  const [questions, setQuestions] = useState([]);
  const [qaCategories, setQaCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editingCategory, setEditingCategory] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Filter states
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterActive, setFilterActive] = useState('all');
  
  // Category form
  const [categoryForm, setCategoryForm] = useState({ id: '', name: '', description: '', color: '#6366f1' });
  
  // Question form
  const [formData, setFormData] = useState({
    category_id: '',
    category_name: '',
    question: '',
    answer_type: 'multiple_choice',
    options: [],
    correct_answer: '',
    is_mandatory: true,
    sub_question_1: '',
    sub_answer_type_1: '',
    sub_options_1: [],
    sub_correct_answer_1: '',
    sub_question_2: '',
    sub_answer_type_2: '',
    sub_options_2: [],
    sub_correct_answer_2: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterCategory && filterCategory !== 'all') params.category_id = filterCategory;
      if (filterActive !== 'all') params.is_active = filterActive === 'true';
      
      const [questionsRes, categoriesRes] = await Promise.all([
        inspectionQAApi.getQuestions(params),
        inspectionQAApi.getCategories(),
      ]);
      
      setQuestions(questionsRes.data);
      
      // Get stored categories from localStorage or use fetched ones
      const storedCategories = localStorage.getItem('qa_categories');
      if (storedCategories) {
        setQaCategories(JSON.parse(storedCategories));
      } else if (categoriesRes.data.length > 0) {
        // Build categories from existing questions
        const cats = categoriesRes.data.map(c => ({ id: c.category_id, name: c.category_name }));
        setQaCategories(cats);
      }
    } catch (error) {
      toast.error('Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterActive]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Category management
  const openCategoryModal = (category = null) => {
    if (category) {
      setEditingCategory(category);
      setCategoryForm({ id: category.id, name: category.name, description: category.description || '', color: category.color || '#6366f1' });
    } else {
      setEditingCategory(null);
      setCategoryForm({ id: '', name: '', description: '', color: '#6366f1' });
    }
    setIsCategoryModalOpen(true);
  };

  const handleSaveCategory = () => {
    if (!categoryForm.name.trim()) {
      toast.error('Category name is required');
      return;
    }
    
    const newCategory = {
      id: editingCategory?.id || categoryForm.name.toLowerCase().replace(/\s+/g, '_'),
      name: categoryForm.name.trim(),
      description: categoryForm.description,
      color: categoryForm.color
    };
    
    let updatedCategories;
    if (editingCategory) {
      updatedCategories = qaCategories.map(c => c.id === editingCategory.id ? newCategory : c);
      toast.success('Category updated');
    } else {
      if (qaCategories.some(c => c.id === newCategory.id)) {
        toast.error('Category with this name already exists');
        return;
      }
      updatedCategories = [...qaCategories, newCategory];
      toast.success('Category created');
    }
    
    setQaCategories(updatedCategories);
    localStorage.setItem('qa_categories', JSON.stringify(updatedCategories));
    setIsCategoryModalOpen(false);
  };

  const handleDeleteCategory = (categoryId) => {
    const hasQuestions = questions.some(q => q.category_id === categoryId);
    if (hasQuestions) {
      toast.error('Cannot delete category with existing questions');
      return;
    }
    
    if (!confirm('Delete this category?')) return;
    
    const updatedCategories = qaCategories.filter(c => c.id !== categoryId);
    setQaCategories(updatedCategories);
    localStorage.setItem('qa_categories', JSON.stringify(updatedCategories));
    toast.success('Category deleted');
  };

  const resetForm = () => {
    setFormData({
      category_id: '',
      category_name: '',
      question: '',
      answer_type: 'multiple_choice',
      options: [],
      correct_answer: '',
      is_mandatory: true,
      sub_question_1: '',
      sub_answer_type_1: '',
      sub_options_1: [],
      sub_correct_answer_1: '',
      sub_question_2: '',
      sub_answer_type_2: '',
      sub_options_2: [],
      sub_correct_answer_2: '',
    });
  };

  const openCreateModal = () => {
    resetForm();
    setEditingQuestion(null);
    setIsModalOpen(true);
  };

  const openEditModal = (question) => {
    setEditingQuestion(question);
    setFormData({
      category_id: question.category_id,
      category_name: question.category_name,
      question: question.question,
      answer_type: question.answer_type,
      options: question.options || [],
      correct_answer: question.correct_answer || '',
      is_mandatory: question.is_mandatory,
      sub_question_1: question.sub_question_1 || '',
      sub_answer_type_1: question.sub_answer_type_1 || '',
      sub_options_1: question.sub_options_1 || [],
      sub_correct_answer_1: question.sub_correct_answer_1 || '',
      sub_question_2: question.sub_question_2 || '',
      sub_answer_type_2: question.sub_answer_type_2 || '',
      sub_options_2: question.sub_options_2 || [],
      sub_correct_answer_2: question.sub_correct_answer_2 || '',
    });
    setIsModalOpen(true);
  };

  const handleCategoryChange = (categoryId) => {
    const cat = qaCategories.find(c => c.id === categoryId);
    setFormData({
      ...formData,
      category_id: categoryId,
      category_name: cat?.name || categoryId
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.category_id || !formData.question || !formData.answer_type) {
      toast.error('Please fill in required fields');
      return;
    }
    
    if (formData.answer_type === 'multiple_choice' && formData.options.length < 2) {
      toast.error('Multiple choice requires at least 2 options');
      return;
    }
    
    setSaving(true);
    try {
      if (editingQuestion) {
        await inspectionQAApi.updateQuestion(editingQuestion.id, formData);
        toast.success('Question updated');
      } else {
        await inspectionQAApi.createQuestion(formData);
        toast.success('Question created');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to save question');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (question) => {
    if (!confirm(`Delete this question?\n"${question.question}"`)) return;
    
    try {
      await inspectionQAApi.deleteQuestion(question.id);
      toast.success('Question deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete question');
    }
  };

  const handleToggle = async (question) => {
    try {
      await inspectionQAApi.toggleQuestion(question.id);
      toast.success(question.is_active ? 'Question deactivated' : 'Question activated');
      fetchData();
    } catch (error) {
      toast.error('Failed to toggle question');
    }
  };

  // Filter questions by search
  const filteredQuestions = questions.filter(q => 
    !search || 
    q.question.toLowerCase().includes(search.toLowerCase()) ||
    q.category_name.toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const totalQuestions = questions.length;
  const activeQuestions = questions.filter(q => q.is_active).length;

  // Merge stored categories with fetched ones
  const allCategories = [...new Map([...qaCategories].map(c => [c.id, c])).values()];

  return (
    <div className="p-4" data-testid="inspection-qa-page">
      {/* Header */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <p className="text-sm text-gray-500">Configure questions for mechanics during inspections</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => openCategoryModal()} className="flex items-center gap-2" data-testid="manage-categories-btn">
            <FolderPlus className="h-4 w-4" /> Manage Categories
          </Button>
          <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700" data-testid="add-question-btn">
            <Plus className="h-4 w-4 mr-2" /> Add Question
          </Button>
        </div>
      </div>

      {/* Stats & Filters Row */}
      <div className="flex items-center gap-4 mb-4">
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Total:</span>
            <span className="font-semibold text-gray-900">{totalQuestions}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Active:</span>
            <span className="font-semibold text-emerald-600">{activeQuestions}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Categories:</span>
            <span className="font-semibold text-indigo-600">{allCategories.length}</span>
          </div>
        </div>
        
        <div className="flex-1" />
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              className="pl-9 w-48 h-9"
              data-testid="search-input"
            />
          </div>
          
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-40 h-9" data-testid="filter-category">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {allCategories.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={filterActive} onValueChange={setFilterActive}>
            <SelectTrigger className="w-32 h-9" data-testid="filter-active">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="true">Active</SelectItem>
              <SelectItem value="false">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase w-28">Category</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Question</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase w-32">Answer</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Sub-Q 1</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase w-32">Answer</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase">Sub-Q 2</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase w-32">Answer</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-600 uppercase w-24">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
                  </td>
                </tr>
              ) : filteredQuestions.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12">
                    <HelpCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No questions found</p>
                    <Button variant="outline" onClick={openCreateModal} className="mt-3">
                      <Plus className="h-4 w-4 mr-2" /> Add First Question
                    </Button>
                  </td>
                </tr>
              ) : (
                filteredQuestions.map(question => (
                  <QuestionRow
                    key={question.id}
                    question={question}
                    onEdit={openEditModal}
                    onDelete={handleDelete}
                    onToggle={handleToggle}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Category Modal */}
      <Dialog open={isCategoryModalOpen} onOpenChange={setIsCategoryModalOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="category-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-indigo-600" />
              {editingCategory ? 'Edit Category' : 'Manage Q&A Categories'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 mt-4">
            {/* Existing Categories List */}
            {!editingCategory && allCategories.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-gray-500">Existing Categories</Label>
                <div className="max-h-40 overflow-y-auto space-y-1 border rounded-lg p-2">
                  {allCategories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-2 bg-gray-50 rounded hover:bg-gray-100">
                      <span className="text-sm font-medium">{cat.name}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openCategoryModal(cat)} className="p-1 text-gray-400 hover:text-blue-600">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => handleDeleteCategory(cat.id)} className="p-1 text-gray-400 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Add/Edit Category Form */}
            <div className="space-y-3 pt-3 border-t">
              <Label>{editingCategory ? 'Edit Category' : 'Add New Category'}</Label>
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Category Name *</Label>
                  <Input
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({...categoryForm, name: e.target.value})}
                    placeholder="e.g., Engine Health"
                    data-testid="category-name-input"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-gray-500">Description</Label>
                  <Input
                    value={categoryForm.description}
                    onChange={(e) => setCategoryForm({...categoryForm, description: e.target.value})}
                    placeholder="Brief description of this category"
                  />
                </div>
              </div>
            </div>
            
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsCategoryModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveCategory} className="bg-indigo-600 hover:bg-indigo-700">
                {editingCategory ? 'Update Category' : 'Add Category'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Question Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto" data-testid="qa-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-blue-600" />
              {editingQuestion ? 'Edit Question' : 'Add New Question'}
            </DialogTitle>
            <DialogDescription>
              Configure the question and answer types for mechanics
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-5 mt-4">
            {/* Category & Main Question */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={formData.category_id} onValueChange={handleCategoryChange}>
                  <SelectTrigger data-testid="category-select">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {allCategories.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-4 pt-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_mandatory}
                    onCheckedChange={(v) => setFormData({...formData, is_mandatory: v})}
                  />
                  <Label className="text-sm">Required Question</Label>
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label>Main Question *</Label>
              <Textarea
                value={formData.question}
                onChange={(e) => setFormData({...formData, question: e.target.value})}
                placeholder="Enter the question..."
                className="min-h-[70px]"
                data-testid="question-input"
              />
            </div>
            
            {/* Main Answer Type */}
            <AnswerTypeSection
              label="Answer Type"
              answerType={formData.answer_type}
              setAnswerType={(v) => setFormData({...formData, answer_type: v})}
              options={formData.options}
              setOptions={(v) => setFormData({...formData, options: v})}
              correctAnswer={formData.correct_answer}
              setCorrectAnswer={(v) => setFormData({...formData, correct_answer: v})}
              required={true}
            />
            
            {/* Sub-Question 1 */}
            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">Optional</span>
                Sub-Question 1
              </h4>
              <div className="space-y-3">
                <Input
                  value={formData.sub_question_1}
                  onChange={(e) => setFormData({...formData, sub_question_1: e.target.value})}
                  placeholder="Enter follow-up question (optional)..."
                />
                
                {/* Always show answer type selector for Sub-Question 1 */}
                <AnswerTypeSection
                  label="Answer Type for Sub-Question 1"
                  answerType={formData.sub_answer_type_1 || 'multiple_choice'}
                  setAnswerType={(v) => setFormData({...formData, sub_answer_type_1: v})}
                  options={formData.sub_options_1}
                  setOptions={(v) => setFormData({...formData, sub_options_1: v})}
                  correctAnswer={formData.sub_correct_answer_1}
                  setCorrectAnswer={(v) => setFormData({...formData, sub_correct_answer_1: v})}
                />
              </div>
            </div>
            
            {/* Sub-Question 2 */}
            <div className="border-t pt-4">
              <h4 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">Optional</span>
                Sub-Question 2
              </h4>
              <div className="space-y-3">
                <Input
                  value={formData.sub_question_2}
                  onChange={(e) => setFormData({...formData, sub_question_2: e.target.value})}
                  placeholder="Enter second follow-up question (optional)..."
                />
                
                {/* Always show answer type selector for Sub-Question 2 */}
                <AnswerTypeSection
                  label="Answer Type for Sub-Question 2"
                  answerType={formData.sub_answer_type_2 || 'multiple_choice'}
                  setAnswerType={(v) => setFormData({...formData, sub_answer_type_2: v})}
                  options={formData.sub_options_2}
                  setOptions={(v) => setFormData({...formData, sub_options_2: v})}
                  correctAnswer={formData.sub_correct_answer_2}
                  setCorrectAnswer={(v) => setFormData({...formData, sub_correct_answer_2: v})}
                />
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="flex-1 bg-blue-600 hover:bg-blue-700" data-testid="save-question-btn">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingQuestion ? 'Update Question' : 'Create Question'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
