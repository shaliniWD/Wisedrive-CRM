import React, { useState, useEffect, useCallback } from 'react';
import { partnersApi, reportTemplatesApi } from '@/services/api';
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
  Plus, Loader2, Pencil, Trash2, Building2, Users, Landmark, ShieldCheck,
  Phone, Mail, MapPin, ToggleLeft, ToggleRight, Search, FileText
} from 'lucide-react';

const PARTNER_TYPES = [
  { value: 'b2c', label: 'B2C (Direct Customers)', icon: Users, color: 'blue' },
  { value: 'bank', label: 'Bank', icon: Landmark, color: 'green' },
  { value: 'insurance', label: 'Insurance', icon: ShieldCheck, color: 'purple' },
  { value: 'b2b', label: 'B2B Partner', icon: Building2, color: 'orange' },
];

const getTypeConfig = (type) => PARTNER_TYPES.find(t => t.value === type) || PARTNER_TYPES[0];

// Partner Card Component
const PartnerCard = ({ partner, onEdit, onToggle, onDelete, reportTemplates }) => {
  const typeConfig = getTypeConfig(partner.type);
  const TypeIcon = typeConfig.icon;
  const defaultTemplate = reportTemplates?.find(t => t.id === partner.default_report_template_id);
  
  return (
    <div 
      className={`border rounded-xl p-4 ${partner.is_active ? 'bg-white' : 'bg-gray-50 opacity-75'}`}
      data-testid={`partner-card-${partner.id}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`h-12 w-12 rounded-xl flex items-center justify-center bg-${typeConfig.color}-100`}>
            <TypeIcon className={`h-6 w-6 text-${typeConfig.color}-600`} />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              {partner.name}
              {!partner.is_active && (
                <span className="px-2 py-0.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-full">Inactive</span>
              )}
            </h3>
            <p className="text-sm text-gray-500">{typeConfig.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
            onClick={() => onEdit(partner)} 
            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            data-testid={`edit-partner-${partner.id}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button 
            onClick={() => onToggle(partner)} 
            className={`p-2 rounded-lg transition-colors ${partner.is_active ? 'text-gray-400 hover:text-amber-600 hover:bg-amber-50' : 'text-gray-400 hover:text-emerald-600 hover:bg-emerald-50'}`}
            data-testid={`toggle-partner-${partner.id}`}
          >
            {partner.is_active ? <ToggleLeft className="h-4 w-4" /> : <ToggleRight className="h-4 w-4" />}
          </button>
          {partner.type !== 'b2c' && (
            <button 
              onClick={() => onDelete(partner)} 
              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              data-testid={`delete-partner-${partner.id}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Default Report Template */}
      {defaultTemplate && (
        <div className="mt-3 p-2 bg-violet-50 rounded-lg border border-violet-100">
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-violet-600" />
            <span className="text-violet-700 font-medium">Default Template:</span>
            <span className="text-violet-600">{defaultTemplate.name}</span>
          </div>
        </div>
      )}
      
      {/* Contact Info */}
      {(partner.contact_person || partner.contact_email || partner.contact_phone) && (
        <div className="mt-4 pt-4 border-t space-y-2">
          {partner.contact_person && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="h-4 w-4 text-gray-400" />
              {partner.contact_person}
            </div>
          )}
          {partner.contact_email && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Mail className="h-4 w-4 text-gray-400" />
              {partner.contact_email}
            </div>
          )}
          {partner.contact_phone && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Phone className="h-4 w-4 text-gray-400" />
              {partner.contact_phone}
            </div>
          )}
          {partner.address && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="h-4 w-4 text-gray-400" />
              {partner.address}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const PartnersPage = () => {
  const [partners, setPartners] = useState([]);
  const [reportTemplates, setReportTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('all');
  
  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    type: 'b2b',
    contact_person: '',
    contact_email: '',
    contact_phone: '',
    address: '',
    notes: '',
    is_active: true,
    default_report_template_id: '',
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterType !== 'all') {
        params.type = filterType;
      }
      const [partnersRes, templatesRes] = await Promise.all([
        partnersApi.getPartners(params),
        reportTemplatesApi.getTemplates(),
      ]);
      setPartners(partnersRes.data);
      setReportTemplates(templatesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [filterType]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openModal = (partner = null) => {
    if (partner) {
      setEditingPartner(partner);
      setFormData({
        name: partner.name || '',
        type: partner.type || 'b2b',
        contact_person: partner.contact_person || '',
        contact_email: partner.contact_email || '',
        contact_phone: partner.contact_phone || '',
        address: partner.address || '',
        notes: partner.notes || '',
        is_active: partner.is_active !== false,
      });
    } else {
      setEditingPartner(null);
      setFormData({
        name: '',
        type: 'b2b',
        contact_person: '',
        contact_email: '',
        contact_phone: '',
        address: '',
        notes: '',
        is_active: true,
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('Partner name is required');
      return;
    }

    try {
      setSaving(true);
      if (editingPartner) {
        await partnersApi.updatePartner(editingPartner.id, formData);
        toast.success('Partner updated');
      } else {
        await partnersApi.createPartner(formData);
        toast.success('Partner created');
      }
      setIsModalOpen(false);
      fetchPartners();
    } catch (error) {
      console.error('Error saving partner:', error);
      toast.error(error.response?.data?.detail || 'Failed to save partner');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async (partner) => {
    try {
      await partnersApi.togglePartner(partner.id);
      toast.success(`Partner ${partner.is_active ? 'deactivated' : 'activated'}`);
      fetchPartners();
    } catch (error) {
      console.error('Error toggling partner:', error);
      toast.error('Failed to toggle partner status');
    }
  };

  const handleDelete = async (partner) => {
    if (!window.confirm(`Are you sure you want to delete "${partner.name}"?`)) {
      return;
    }
    
    try {
      await partnersApi.deletePartner(partner.id);
      toast.success('Partner deleted');
      fetchPartners();
    } catch (error) {
      console.error('Error deleting partner:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete partner');
    }
  };

  // Filter partners
  const filteredPartners = partners.filter(partner => {
    const matchesSearch = partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (partner.contact_person && partner.contact_person.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesSearch;
  });

  // Stats
  const stats = {
    total: partners.length,
    active: partners.filter(p => p.is_active).length,
    b2c: partners.filter(p => p.type === 'b2c').length,
    b2b: partners.filter(p => p.type !== 'b2c').length,
  };

  return (
    <div className="p-4" data-testid="partners-page">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white">
          <p className="text-blue-100 text-sm">Total Partners</p>
          <p className="text-2xl font-bold">{stats.total}</p>
        </div>
        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white">
          <p className="text-emerald-100 text-sm">Active</p>
          <p className="text-2xl font-bold">{stats.active}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl p-4 text-white">
          <p className="text-purple-100 text-sm">B2C</p>
          <p className="text-2xl font-bold">{stats.b2c}</p>
        </div>
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-white">
          <p className="text-orange-100 text-sm">B2B Partners</p>
          <p className="text-2xl font-bold">{stats.b2b}</p>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search partners..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="search-partners"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[180px]" data-testid="filter-type">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {PARTNER_TYPES.map(type => (
              <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button 
          onClick={() => openModal()}
          className="bg-gradient-to-r from-blue-600 to-blue-700"
          data-testid="add-partner-btn"
        >
          <Plus className="h-4 w-4 mr-2" /> Add Partner
        </Button>
      </div>

      {/* Partners Grid */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-gray-500 mt-2">Loading partners...</p>
        </div>
      ) : filteredPartners.length === 0 ? (
        <div className="text-center py-12 border rounded-xl bg-gray-50">
          <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No partners found</p>
          <button 
            onClick={() => openModal()} 
            className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Add your first partner
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPartners.map(partner => (
            <PartnerCard 
              key={partner.id} 
              partner={partner} 
              onEdit={openModal} 
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Partner Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-lg" data-testid="partner-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              {editingPartner ? 'Edit Partner' : 'Add New Partner'}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label>Partner Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                  placeholder="e.g., HDFC Bank"
                  data-testid="partner-name-input"
                />
              </div>
              
              <div className="col-span-2">
                <Label>Partner Type *</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(value) => setFormData({...formData, type: value})}
                >
                  <SelectTrigger data-testid="partner-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTNER_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Contact Person</Label>
                <Input
                  value={formData.contact_person}
                  onChange={(e) => setFormData({...formData, contact_person: e.target.value})}
                  placeholder="John Doe"
                  data-testid="contact-person-input"
                />
              </div>
              
              <div>
                <Label>Contact Phone</Label>
                <Input
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({...formData, contact_phone: e.target.value})}
                  placeholder="+91 98765 43210"
                  data-testid="contact-phone-input"
                />
              </div>
              
              <div className="col-span-2">
                <Label>Contact Email</Label>
                <Input
                  type="email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({...formData, contact_email: e.target.value})}
                  placeholder="contact@company.com"
                  data-testid="contact-email-input"
                />
              </div>
              
              <div className="col-span-2">
                <Label>Address</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({...formData, address: e.target.value})}
                  placeholder="Office address"
                  data-testid="address-input"
                />
              </div>
              
              <div className="col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  placeholder="Additional notes about this partner..."
                  rows={2}
                  data-testid="notes-input"
                />
              </div>
              
              <div className="col-span-2 flex items-center justify-between">
                <Label>Active Status</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({...formData, is_active: checked})}
                  data-testid="active-switch"
                />
              </div>
            </div>
          </div>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving} data-testid="save-partner-btn">
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingPartner ? 'Update Partner' : 'Create Partner'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PartnersPage;
