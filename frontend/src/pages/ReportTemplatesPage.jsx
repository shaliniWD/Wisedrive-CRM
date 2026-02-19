import React, { useState, useEffect, useCallback } from 'react';
import { reportTemplatesApi, partnersApi, inspectionTemplatesApi } from '@/services/api';
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
import { toast } from 'sonner';
import { 
  Plus, Loader2, Pencil, Trash2, FileText, Star, Eye,
  Users, Building2, Landmark, ShieldCheck, ClipboardList,
  ToggleLeft, ToggleRight, Search, FileCheck, Sparkles
} from 'lucide-react';

const PARTNER_TYPE_ICONS = {
  b2c: Users,
  bank: Landmark,
  insurance: ShieldCheck,
  b2b: Building2,
};

// Report Style Preview Component
const ReportStylePreview = ({ style, styleInfo, selected, onSelect }) => {
  return (
    <div 
      onClick={() => onSelect(style)}
      className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${
        selected 
          ? 'border-blue-500 bg-blue-50 shadow-lg' 
          : 'border-gray-200 hover:border-gray-300 hover:shadow'
      }`}
      data-testid={`style-${style}`}
    >
      <div 
        className="h-24 rounded-lg mb-3 flex items-center justify-center"
        style={{ backgroundColor: styleInfo.preview_color + '20' }}
      >
        <FileText className="h-10 w-10" style={{ color: styleInfo.preview_color }} />
      </div>
      <h4 className="font-semibold text-gray-900">{styleInfo.name}</h4>
      <p className="text-xs text-gray-500 mt-1">{styleInfo.description}</p>
      <div className="mt-3 space-y-1">
        {styleInfo.features.map((feature, idx) => (
          <div key={idx} className="flex items-center gap-1 text-xs text-gray-600">
            <div className="h-1 w-1 rounded-full bg-gray-400" />
            {feature}
          </div>
        ))}
      </div>
    </div>
  );
};

// Report Template Card Component
const ReportTemplateCard = ({ template, onEdit, onToggle, onDelete, onSetDefault, onViewReport }) => {
  const TypeIcon = PARTNER_TYPE_ICONS[template.partner_type] || Building2;
  
  return (
    <div 
      className={`border rounded-xl p-4 ${template.is_active ? 'bg-white' : 'bg-gray-50 opacity-75'} ${template.is_default ? 'ring-2 ring-blue-500' : ''}`}
      data-testid={`report-template-card-${template.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div 
            className="h-12 w-12 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: (template.style_info?.preview_color || '#3B82F6') + '20' }}
          >
            <FileText className="h-6 w-6" style={{ color: template.style_info?.preview_color || '#3B82F6' }} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              {template.name}
              {template.is_default && (
                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded-full flex items-center gap-1">
                  <Star className="h-3 w-3" /> Default
                </span>
              )}
              {!template.is_active && (
                <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-full">Inactive</span>
              )}
            </h3>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <TypeIcon className="h-4 w-4" />
              {template.partner_name}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => onViewReport(template)} 
            className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="View Report Preview"
            data-testid={`view-report-${template.id}`}
          >
            <Eye className="h-4 w-4" />
          </button>
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
            data-testid={`edit-report-template-${template.id}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button 
            onClick={() => onToggle(template)} 
            className={`p-2 rounded-lg transition-colors ${template.is_active ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
            data-testid={`toggle-report-template-${template.id}`}
          >
            {template.is_active ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
          </button>
          {!template.is_default && (
            <button 
              onClick={() => onDelete(template)} 
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              data-testid={`delete-report-template-${template.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Info */}
      <div className="mt-4 pt-4 border-t flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <ClipboardList className="h-4 w-4 text-gray-400" />
          <span>{template.inspection_template_name}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <FileCheck className="h-4 w-4 text-gray-400" />
          <span>{template.question_count} Questions</span>
        </div>
        <div 
          className="px-2 py-1 rounded-full text-xs font-medium"
          style={{ 
            backgroundColor: (template.style_info?.preview_color || '#3B82F6') + '20',
            color: template.style_info?.preview_color || '#3B82F6'
          }}
        >
          {template.style_info?.name || 'Standard'}
        </div>
      </div>
      
      {template.description && (
        <p className="mt-3 text-sm text-gray-500">{template.description}</p>
      )}
    </div>
  );
};

const ReportTemplatesPage = () => {
  const [templates, setTemplates] = useState([]);
  const [partners, setPartners] = useState([]);
  const [inspectionTemplates, setInspectionTemplates] = useState([]);
  const [reportStyles, setReportStyles] = useState({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Preview modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    partner_id: '',
    inspection_template_id: '',
    report_style: 'standard',
    description: '',
    is_default: false,
    is_active: true,
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [templatesRes, partnersRes, inspTemplatesRes, stylesRes] = await Promise.all([
        reportTemplatesApi.getTemplates(),
        partnersApi.getPartners({ is_active: true }),
        inspectionTemplatesApi.getTemplates({ is_active: true }),
        reportTemplatesApi.getStyles(),
      ]);
      setTemplates(templatesRes.data);
      setPartners(partnersRes.data);
      setInspectionTemplates(inspTemplatesRes.data);
      setReportStyles(stylesRes.data);
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
      setEditingTemplate(template);
      setFormData({
        name: template.name || '',
        partner_id: template.partner_id || '',
        inspection_template_id: template.inspection_template_id || '',
        report_style: template.report_style || 'standard',
        description: template.description || '',
        is_default: template.is_default || false,
        is_active: template.is_active !== false,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        partner_id: partners[0]?.id || '',
        inspection_template_id: inspectionTemplates[0]?.id || '',
        report_style: 'standard',
        description: '',
        is_default: false,
        is_active: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (!formData.partner_id) {
      toast.error('Please select a partner');
      return;
    }
    if (!formData.inspection_template_id) {
      toast.error('Please select an inspection template');
      return;
    }

    try {
      setSaving(true);
      if (editingTemplate) {
        await reportTemplatesApi.updateTemplate(editingTemplate.id, formData);
        toast.success('Report template updated');
      } else {
        await reportTemplatesApi.createTemplate(formData);
        toast.success('Report template created');
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
      await reportTemplatesApi.toggleTemplate(template.id);
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
      await reportTemplatesApi.deleteTemplate(template.id);
      toast.success('Template deleted');
      fetchData();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete template');
    }
  };

  const handleSetDefault = async (template) => {
    try {
      await reportTemplatesApi.setDefault(template.id);
      toast.success(`"${template.name}" set as default for ${template.partner_name}`);
      fetchData();
    } catch (error) {
      console.error('Error setting default:', error);
      toast.error('Failed to set default template');
    }
  };

  const handleViewReport = (template) => {
    setPreviewTemplate(template);
    setIsPreviewOpen(true);
  };

  const handleSeedSamples = async () => {
    try {
      const res = await reportTemplatesApi.seedSamples();
      toast.success(res.data.message);
      fetchData();
    } catch (error) {
      console.error('Error seeding samples:', error);
      toast.error(error.response?.data?.detail || 'Failed to seed sample templates');
    }
  };

  // Filter templates
  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (template.partner_name && template.partner_name.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  // Stats
  const stats = {
    total: templates.length,
    active: templates.filter(t => t.is_active).length,
    styles: Object.keys(reportStyles).length,
    partners: new Set(templates.map(t => t.partner_id)).size,
  };

  return (
    <div className="p-4" data-testid="report-templates-page">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-4 text-white">
          <p className="text-violet-100 text-sm">Total Report Templates</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
          <p className="text-emerald-100 text-sm">Active</p>
          <p className="text-2xl font-bold">{stats.active}</p>
        </div>
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <p className="text-blue-100 text-sm">Report Styles</p>
          <p className="text-2xl font-bold">{stats.styles}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
          <p className="text-orange-100 text-sm">Partners Covered</p>
          <p className="text-2xl font-bold">{stats.partners}</p>
        </div>
      </div>

      {/* Search and Actions */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search report templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="search-report-templates"
          />
        </div>
        {templates.length === 0 && (
          <Button 
            variant="outline"
            onClick={handleSeedSamples}
            data-testid="seed-samples-btn"
          >
            <Sparkles className="h-4 w-4 mr-2" /> Create Sample Templates
          </Button>
        )}
        <Button 
          onClick={() => openModal()}
          className="bg-gradient-to-r from-violet-600 to-violet-700"
          data-testid="add-report-template-btn"
        >
          <Plus className="h-4 w-4 mr-2" /> Create Report Template
        </Button>
      </div>

      {/* Templates Grid */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-violet-600 mx-auto" />
          <p className="text-gray-500 mt-2">Loading report templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12 border rounded-xl bg-gray-50">
          <FileText className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No report templates found</p>
          <p className="text-sm text-gray-400 mt-1">Create a report template to connect partners with inspection questionnaires</p>
          <div className="flex justify-center gap-3 mt-4">
            <Button variant="outline" onClick={handleSeedSamples}>
              <Sparkles className="h-4 w-4 mr-2" /> Create Sample Templates
            </Button>
            <Button onClick={() => openModal()}>
              <Plus className="h-4 w-4 mr-2" /> Create Report Template
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredTemplates.map(template => (
            <ReportTemplateCard 
              key={template.id} 
              template={template} 
              onEdit={openModal} 
              onToggle={handleToggle}
              onDelete={handleDelete}
              onSetDefault={handleSetDefault}
              onViewReport={handleViewReport}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" data-testid="report-template-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-violet-600" />
              {editingTemplate ? 'Edit Report Template' : 'Create Report Template'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-700 flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-sm">1</span>
                Basic Information
              </h4>
              
              <div className="grid grid-cols-2 gap-4 pl-8">
                <div className="col-span-2">
                  <Label>Report Template Name *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="e.g., HDFC Bank Standard Report"
                    data-testid="report-template-name-input"
                  />
                </div>
                
                <div>
                  <Label>Partner/Client *</Label>
                  <Select 
                    value={formData.partner_id} 
                    onValueChange={(value) => setFormData({...formData, partner_id: value})}
                  >
                    <SelectTrigger data-testid="partner-select">
                      <SelectValue placeholder="Select partner" />
                    </SelectTrigger>
                    <SelectContent>
                      {partners.map(partner => (
                        <SelectItem key={partner.id} value={partner.id}>
                          {partner.name} ({partner.type.toUpperCase()})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label>Inspection Template *</Label>
                  <Select 
                    value={formData.inspection_template_id} 
                    onValueChange={(value) => setFormData({...formData, inspection_template_id: value})}
                  >
                    <SelectTrigger data-testid="inspection-template-select">
                      <SelectValue placeholder="Select inspection template" />
                    </SelectTrigger>
                    <SelectContent>
                      {inspectionTemplates.map(template => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name} ({template.question_count} questions)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="col-span-2">
                  <Label>Description</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    placeholder="Brief description of this report template..."
                    rows={2}
                    data-testid="description-input"
                  />
                </div>
              </div>
            </div>

            {/* Report Style Selection */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-700 flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-sm">2</span>
                Select Report Style
              </h4>
              
              <div className="pl-8 grid grid-cols-3 gap-4">
                {Object.entries(reportStyles).map(([style, styleInfo]) => (
                  <ReportStylePreview
                    key={style}
                    style={style}
                    styleInfo={styleInfo}
                    selected={formData.report_style === style}
                    onSelect={(s) => setFormData({...formData, report_style: s})}
                  />
                ))}
              </div>
            </div>

            {/* Status */}
            <div className="space-y-4">
              <h4 className="font-medium text-gray-700 flex items-center gap-2">
                <span className="h-6 w-6 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-sm">3</span>
                Status
              </h4>
              
              <div className="pl-8 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Active</Label>
                    <p className="text-sm text-gray-500">Template can be used for reports</p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                    data-testid="active-switch"
                  />
                </div>
                
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Set as Default for Partner</Label>
                    <p className="text-sm text-gray-500">Use this template as default for the selected partner</p>
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
              className="bg-gradient-to-r from-violet-600 to-violet-700"
              data-testid="save-report-template-btn"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingTemplate ? 'Update Template' : 'Create Template'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="preview-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-violet-600" />
              Report Preview: {previewTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          
          {previewTemplate && (
            <div className="py-4">
              {/* Preview Header */}
              <div 
                className="rounded-t-xl p-6"
                style={{ backgroundColor: previewTemplate.style_info?.preview_color || '#3B82F6' }}
              >
                <h2 className="text-2xl font-bold text-white">{previewTemplate.style_info?.name || 'Standard Report'}</h2>
                <p className="text-white/80 mt-1">{previewTemplate.style_info?.description}</p>
              </div>
              
              {/* Preview Body */}
              <div className="border border-t-0 rounded-b-xl p-6 bg-white">
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Partner</h3>
                    <p className="text-gray-900">{previewTemplate.partner_name}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Inspection Template</h3>
                    <p className="text-gray-900">{previewTemplate.inspection_template_name}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Questions</h3>
                    <p className="text-gray-900">{previewTemplate.question_count} questions</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 mb-1">Status</h3>
                    <p className="text-gray-900">{previewTemplate.is_default ? 'Default' : 'Standard'}</p>
                  </div>
                </div>
                
                <div className="border-t pt-6">
                  <h3 className="font-medium text-gray-900 mb-4">Report Features</h3>
                  <div className="grid grid-cols-2 gap-4">
                    {previewTemplate.style_info?.features?.map((feature, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <div 
                          className="h-6 w-6 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: previewTemplate.style_info?.preview_color + '20' }}
                        >
                          <FileCheck className="h-3 w-3" style={{ color: previewTemplate.style_info?.preview_color }} />
                        </div>
                        <span className="text-gray-700">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="mt-6 p-4 bg-gray-50 rounded-lg text-center">
                  <p className="text-gray-500 text-sm">
                    This is a preview of the report template configuration. 
                    The actual report will be generated based on inspection data.
                  </p>
                  <Button 
                    className="mt-3"
                    onClick={() => window.open(`/inspection-report/sample?style=${previewTemplate?.report_style || 'standard'}`, '_blank')}
                  >
                    <Eye className="h-4 w-4 mr-2" /> View Sample Report
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReportTemplatesPage;
