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
  ListChecks, ChevronDown, ChevronUp, GripVertical, Search,
  CheckCircle, XCircle, Filter, Clock, Image, PlayCircle
} from 'lucide-react';

// Answer type options
const ANSWER_TYPES = [
  { value: 'multiple_choice', label: 'Multiple Choice', icon: ListChecks, color: 'text-blue-600 bg-blue-50' },
  { value: 'photo', label: 'Photo Upload', icon: Camera, color: 'text-emerald-600 bg-emerald-50' },
  { value: 'video', label: 'Video Upload (45s max)', icon: Video, color: 'text-purple-600 bg-purple-50' },
];

// Default categories
const DEFAULT_CATEGORIES = [
  { id: 'engine', name: 'Engine Health' },
  { id: 'transmission', name: 'Transmission' },
  { id: 'exterior', name: 'Exterior Body' },
  { id: 'interior', name: 'Interior' },
  { id: 'electrical', name: 'Electrical & Lights' },
  { id: 'suspension', name: 'Suspension & Steering' },
  { id: 'brakes', name: 'Brakes' },
  { id: 'tyres', name: 'Tyres & Wheels' },
  { id: 'ac', name: 'AC & Climate' },
  { id: 'documents', name: 'Documents & RTO' },
];

// Answer Type Badge
const AnswerTypeBadge = ({ type }) => {
  const config = ANSWER_TYPES.find(t => t.value === type) || ANSWER_TYPES[0];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${config.color}`}>
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </span>
  );
};

// Options Display Component
const OptionsDisplay = ({ options, correctAnswer }) => {
  if (!options || options.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {options.map((opt, idx) => (
        <span 
          key={idx} 
          className={`px-2 py-0.5 rounded text-xs ${
            opt === correctAnswer 
              ? 'bg-emerald-100 text-emerald-700 font-medium border border-emerald-200' 
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {opt}
          {opt === correctAnswer && <CheckCircle className="h-3 w-3 inline ml-1" />}
        </span>
      ))}
    </div>
  );
};

// Question Row Component
const QuestionRow = ({ question, onEdit, onDelete, onToggle }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <tr className={`hover:bg-gray-50 ${!question.is_active ? 'opacity-60 bg-gray-50' : ''}`} data-testid={`qa-row-${question.id}`}>
      {/* Question */}
      <td className="px-4 py-3 align-top">
        <div className="flex items-start gap-2">
          <button className="mt-1 cursor-grab text-gray-300 hover:text-gray-500">
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <div className="font-medium text-gray-900">{question.question}</div>
            <div className="text-xs text-gray-500 mt-1">
              Category: <span className="font-medium">{question.category_name}</span>
              {question.is_mandatory && <span className="ml-2 text-red-500">*Required</span>}
            </div>
          </div>
        </div>
      </td>
      
      {/* Answer Type */}
      <td className="px-4 py-3 align-top">
        <AnswerTypeBadge type={question.answer_type} />
        {question.answer_type === 'multiple_choice' && (
          <OptionsDisplay options={question.options} correctAnswer={question.correct_answer} />
        )}
        {question.answer_type === 'video' && (
          <div className="text-xs text-gray-500 mt-1 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Max {question.video_max_duration || 45}s
          </div>
        )}
      </td>
      
      {/* Sub-Question 1 */}
      <td className="px-4 py-3 align-top">
        {question.sub_question_1 ? (
          <div>
            <div className="text-sm text-gray-700">{question.sub_question_1}</div>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        )}
      </td>
      
      {/* Sub-Answer 1 */}
      <td className="px-4 py-3 align-top">
        {question.sub_answer_type_1 ? (
          <div>
            <AnswerTypeBadge type={question.sub_answer_type_1} />
            {question.sub_answer_type_1 === 'multiple_choice' && (
              <OptionsDisplay options={question.sub_options_1} correctAnswer={question.sub_correct_answer_1} />
            )}
          </div>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        )}
      </td>
      
      {/* Sub-Question 2 */}
      <td className="px-4 py-3 align-top">
        {question.sub_question_2 ? (
          <div>
            <div className="text-sm text-gray-700">{question.sub_question_2}</div>
          </div>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        )}
      </td>
      
      {/* Sub-Answer 2 */}
      <td className="px-4 py-3 align-top">
        {question.sub_answer_type_2 ? (
          <div>
            <AnswerTypeBadge type={question.sub_answer_type_2} />
            {question.sub_answer_type_2 === 'multiple_choice' && (
              <OptionsDisplay options={question.sub_options_2} correctAnswer={question.sub_correct_answer_2} />
            )}
          </div>
        ) : (
          <span className="text-gray-400 text-sm">-</span>
        )}
      </td>
      
      {/* Actions */}
      <td className="px-4 py-3 align-top">
        <div className="flex items-center gap-1">
          <button 
            onClick={() => onEdit(question)} 
            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
            title="Edit"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button 
            onClick={() => onToggle(question)} 
            className={`p-1.5 rounded-lg ${question.is_active ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
            title={question.is_active ? 'Deactivate' : 'Activate'}
          >
            {question.is_active ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
          </button>
          <button 
            onClick={() => onDelete(question)} 
            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};

// Answer Type Selector with Options
const AnswerTypeSection = ({ label, answerType, setAnswerType, options, setOptions, correctAnswer, setCorrectAnswer }) => {
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
    <div className="space-y-3 p-4 bg-gray-50 rounded-lg border">
      <Label className="text-sm font-medium">{label}</Label>
      
      <div className="grid grid-cols-3 gap-2">
        {ANSWER_TYPES.map((type) => {
          const Icon = type.icon;
          const isSelected = answerType === type.value;
          return (
            <button
              key={type.value}
              type="button"
              onClick={() => setAnswerType(type.value)}
              className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${
                isSelected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
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
      
      {answerType === 'multiple_choice' && (
        <div className="space-y-3 mt-4">
          <div className="flex gap-2">
            <Input
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              placeholder="Add an option..."
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOption())}
            />
            <Button type="button" variant="outline" onClick={addOption}>Add</Button>
          </div>
          
          {options.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-gray-500">Options (click to set as correct answer)</Label>
              <div className="flex flex-wrap gap-2">
                {options.map((opt, idx) => (
                  <div
                    key={idx}
                    onClick={() => setCorrectAnswer(opt)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer transition-all ${
                      correctAnswer === opt 
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' 
                        : 'bg-white text-gray-700 border hover:border-gray-300'
                    }`}
                  >
                    {correctAnswer === opt && <CheckCircle className="h-4 w-4" />}
                    <span>{opt}</span>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeOption(opt); }}
                      className="text-gray-400 hover:text-red-500"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      
      {answerType === 'video' && (
        <div className="flex items-center gap-2 text-sm text-purple-600 mt-2">
          <Clock className="h-4 w-4" />
          <span>Video recording limited to 45 seconds</span>
        </div>
      )}
      
      {answerType === 'photo' && (
        <div className="flex items-center gap-2 text-sm text-emerald-600 mt-2">
          <Camera className="h-4 w-4" />
          <span>Mechanic will capture a photo during inspection</span>
        </div>
      )}
    </div>
  );
};

export default function InspectionQAPage() {
  const [questions, setQuestions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Filter states
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterActive, setFilterActive] = useState('all');
  
  // Form state
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
      if (filterCategory) params.category_id = filterCategory;
      if (filterActive !== '') params.is_active = filterActive === 'true';
      
      const [questionsRes, categoriesRes] = await Promise.all([
        inspectionQAApi.getQuestions(params),
        inspectionQAApi.getCategories(),
      ]);
      
      setQuestions(questionsRes.data);
      setCategories(categoriesRes.data);
    } catch (error) {
      toast.error('Failed to load questions');
    } finally {
      setLoading(false);
    }
  }, [filterCategory, filterActive]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
    const cat = DEFAULT_CATEGORIES.find(c => c.id === categoryId);
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
  const categoryCount = [...new Set(questions.map(q => q.category_id))].length;

  return (
    <div className="p-6" data-testid="inspection-qa-page">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Inspection Q&A</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure questions for mechanics to answer during inspections
          </p>
        </div>
        <Button onClick={openCreateModal} className="bg-blue-600 hover:bg-blue-700" data-testid="add-question-btn">
          <Plus className="h-4 w-4 mr-2" /> Add Question
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <HelpCircle className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{totalQuestions}</div>
              <div className="text-sm text-gray-500">Total Questions</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{activeQuestions}</div>
              <div className="text-sm text-gray-500">Active Questions</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ListChecks className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900">{categoryCount}</div>
              <div className="text-sm text-gray-500">Categories</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search questions..."
              className="pl-10"
              data-testid="search-input"
            />
          </div>
          
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]" data-testid="filter-category">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {DEFAULT_CATEGORIES.map(cat => (
                <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={filterActive} onValueChange={setFilterActive}>
            <SelectTrigger className="w-[150px]" data-testid="filter-active">
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
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase w-1/4">Question</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase w-1/6">Answer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase w-1/6">Sub-Question 1</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase w-1/8">Answer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase w-1/6">Sub-Question 2</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase w-1/8">Answer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600 mx-auto" />
                  </td>
                </tr>
              ) : filteredQuestions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
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

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[900px] max-h-[90vh] overflow-y-auto" data-testid="qa-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-blue-600" />
              {editingQuestion ? 'Edit Question' : 'Add New Question'}
            </DialogTitle>
            <DialogDescription>
              Configure the question and answer type for mechanics to complete during inspection
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            {/* Category & Main Question */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category *</Label>
                <Select value={formData.category_id} onValueChange={handleCategoryChange}>
                  <SelectTrigger data-testid="category-select">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {DEFAULT_CATEGORIES.map(cat => (
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
                placeholder="Enter the question for mechanics to answer..."
                className="min-h-[80px]"
                data-testid="question-input"
              />
            </div>
            
            {/* Main Answer Type */}
            <AnswerTypeSection
              label="Answer Type for Main Question *"
              answerType={formData.answer_type}
              setAnswerType={(v) => setFormData({...formData, answer_type: v})}
              options={formData.options}
              setOptions={(v) => setFormData({...formData, options: v})}
              correctAnswer={formData.correct_answer}
              setCorrectAnswer={(v) => setFormData({...formData, correct_answer: v})}
            />
            
            {/* Sub-Question 1 */}
            <div className="border-t pt-6">
              <h4 className="font-medium text-gray-700 mb-4 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-gray-100 rounded text-sm">Optional</span>
                Sub-Question 1
              </h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Sub-Question 1</Label>
                  <Input
                    value={formData.sub_question_1}
                    onChange={(e) => setFormData({...formData, sub_question_1: e.target.value})}
                    placeholder="Enter follow-up question (optional)..."
                  />
                </div>
                
                {formData.sub_question_1 && (
                  <AnswerTypeSection
                    label="Answer Type for Sub-Question 1"
                    answerType={formData.sub_answer_type_1}
                    setAnswerType={(v) => setFormData({...formData, sub_answer_type_1: v})}
                    options={formData.sub_options_1}
                    setOptions={(v) => setFormData({...formData, sub_options_1: v})}
                    correctAnswer={formData.sub_correct_answer_1}
                    setCorrectAnswer={(v) => setFormData({...formData, sub_correct_answer_1: v})}
                  />
                )}
              </div>
            </div>
            
            {/* Sub-Question 2 */}
            <div className="border-t pt-6">
              <h4 className="font-medium text-gray-700 mb-4 flex items-center gap-2">
                <span className="px-2 py-0.5 bg-gray-100 rounded text-sm">Optional</span>
                Sub-Question 2
              </h4>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Sub-Question 2</Label>
                  <Input
                    value={formData.sub_question_2}
                    onChange={(e) => setFormData({...formData, sub_question_2: e.target.value})}
                    placeholder="Enter second follow-up question (optional)..."
                  />
                </div>
                
                {formData.sub_question_2 && (
                  <AnswerTypeSection
                    label="Answer Type for Sub-Question 2"
                    answerType={formData.sub_answer_type_2}
                    setAnswerType={(v) => setFormData({...formData, sub_answer_type_2: v})}
                    options={formData.sub_options_2}
                    setOptions={(v) => setFormData({...formData, sub_options_2: v})}
                    correctAnswer={formData.sub_correct_answer_2}
                    setCorrectAnswer={(v) => setFormData({...formData, sub_correct_answer_2: v})}
                  />
                )}
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
