import React, { useState, useEffect } from 'react';
import { adCityMappingsApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { 
  Plus, Loader2, Pencil, Trash2, Search, Settings, RefreshCw,
  IndianRupee, ToggleLeft, ToggleRight, X, Package
} from 'lucide-react';
import InspectionPackagesPage from './InspectionPackagesPage';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('inspection_packages');
  const [adMappings, setAdMappings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState(null);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [formData, setFormData] = useState({
    ad_id: '',
    ad_name: '',
    ad_amount: '',
    city: '',
    language: '',
    campaign: '',
    source: '',
  });

  const cities = ['Bangalore', 'Chennai', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad', 'Vizag'];
  const languages = ['Hindi', 'English', 'Kannada', 'Tamil', 'Telugu', 'Malayalam', 'Marathi', 'Bengali'];
  const sources = ['Instagram', 'Facebook', 'Google', 'YouTube', 'Website', 'Referral'];

  const fetchAdMappings = async () => {
    setLoading(true);
    try {
      const response = await adCityMappingsApi.getAll();
      setAdMappings(response.data || []);
    } catch (error) {
      console.error('Failed to load ad mappings:', error);
      toast.error('Failed to load ad mappings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    if (activeTab === 'ad_mapping') {
      fetchAdMappings(); 
    }
  }, [activeTab]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.ad_id || !formData.city) {
      toast.error('Please fill in required fields (Ad ID and City)');
      return;
    }
    setSaving(true);
    try {
      const submitData = {
        ad_id: formData.ad_id,
        city: formData.city,
        ad_name: formData.ad_name || null,
        ad_amount: formData.ad_amount ? parseFloat(formData.ad_amount) : null,
        language: formData.language || null,
        campaign: formData.campaign || null,
        source: formData.source || null,
        is_active: true
      };

      if (editingAd) {
        await adCityMappingsApi.update(editingAd.id, submitData);
        toast.success('Ad mapping updated');
      } else {
        await adCityMappingsApi.create(submitData);
        toast.success('Ad mapping created');
      }
      setIsModalOpen(false);
      resetForm();
      fetchAdMappings();
    } catch (error) {
      console.error('Failed to save ad mapping:', error);
      toast.error(error.response?.data?.detail || 'Failed to save ad mapping');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({ ad_id: '', ad_name: '', ad_amount: '', city: '', language: '', campaign: '', source: '' });
    setEditingAd(null);
  };

  const openEditModal = (ad) => {
    setEditingAd(ad);
    setFormData({
      ad_id: ad.ad_id || '',
      ad_name: ad.ad_name || '',
      ad_amount: ad.ad_amount || '',
      city: ad.city || '',
      language: ad.language || '',
      campaign: ad.campaign || '',
      source: ad.source || '',
    });
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleToggleActive = async (ad) => {
    try {
      await adCityMappingsApi.toggleStatus(ad.id);
      toast.success(ad.is_active ? 'Ad mapping deactivated' : 'Ad mapping activated');
      fetchAdMappings();
    } catch (error) {
      console.error('Failed to toggle status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (ad) => {
    if (!window.confirm(`Delete ad mapping "${ad.ad_name || ad.ad_id}"?`)) return;
    try {
      await adCityMappingsApi.delete(ad.id);
      toast.success('Ad mapping deleted');
      fetchAdMappings();
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Failed to delete');
    }
  };

  // Filter ad mappings based on search
  const filteredMappings = adMappings.filter(ad => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      ad.ad_id?.toLowerCase().includes(query) ||
      ad.ad_name?.toLowerCase().includes(query) ||
      ad.city?.toLowerCase().includes(query) ||
      ad.language?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="settings-page">
      {/* Page Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-500 mt-1">Configure system settings and integrations</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="flex border-b bg-slate-50">
          <button
            onClick={() => setActiveTab('inspection_packages')}
            className={`px-6 py-4 text-sm font-medium flex items-center gap-2 transition-all border-b-2 -mb-px ${
              activeTab === 'inspection_packages' 
                ? 'border-blue-600 text-blue-600 bg-white' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            data-testid="inspection-packages-tab"
          >
            <Package className="h-4 w-4" /> Inspection Packages
          </button>
          <button
            onClick={() => setActiveTab('ad_mapping')}
            className={`px-6 py-4 text-sm font-medium flex items-center gap-2 transition-all border-b-2 -mb-px ${
              activeTab === 'ad_mapping' 
                ? 'border-blue-600 text-blue-600 bg-white' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            data-testid="ad-mapping-tab"
          >
            <Settings className="h-4 w-4" /> AD ID Mapping
          </button>
        </div>

        {/* Inspection Packages Tab Content */}
        {activeTab === 'inspection_packages' && (
          <InspectionPackagesPage />
        )}

        {/* AD ID Mapping Tab Content */}
        {activeTab === 'ad_mapping' && (
          <div className="p-4">
            {/* Filters and Actions */}
            <div className="flex items-center justify-between mb-4 gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by Ad ID, name, city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10"
                  data-testid="search-ad-mapping"
                />
              </div>
              <button 
                className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/25 transition-all"
                onClick={openCreateModal}
                data-testid="create-ad-btn"
              >
                <Plus className="h-4 w-4" /> Create Ad
              </button>
            </div>

            {/* AD Mappings Table */}
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Ad ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Ad Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">City</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Language</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Campaign Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Source</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Active</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                          <span className="text-gray-500">Loading ad mappings...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredMappings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12">
                        <Settings className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No ad mappings found</p>
                        <button 
                          onClick={openCreateModal}
                          className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Create your first ad mapping
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredMappings.map((ad) => (
                      <tr key={ad.id} className="hover:bg-slate-50 transition-colors" data-testid={`ad-row-${ad.id}`}>
                        <td className="px-4 py-4">
                          <span className="font-mono text-sm text-gray-900">{ad.ad_id}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-medium text-gray-900">{ad.ad_name || '-'}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-700">{ad.city}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-700">{ad.language}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-700">{ad.campaign || '-'}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                            {ad.source}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleActive(ad)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                ad.is_active ? 'bg-emerald-500' : 'bg-gray-300'
                              }`}
                              data-testid={`toggle-active-${ad.id}`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                ad.is_active ? 'translate-x-6' : 'translate-x-1'
                              }`} />
                            </button>
                            <span className={`text-sm font-medium ${ad.is_active ? 'text-emerald-600' : 'text-gray-500'}`}>
                              {ad.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => openEditModal(ad)}
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                              data-testid={`edit-ad-${ad.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => {/* Open amount modal - placeholder */}}
                              className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                              title="Set Amount"
                              data-testid={`amount-ad-${ad.id}`}
                            >
                              <IndianRupee className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(ad)}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                              data-testid={`delete-ad-${ad.id}`}
                            >
                              <RefreshCw className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Ad Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="ad-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center justify-between">
              <span>{editingAd ? 'Edit Ad' : 'Create Ad'}</span>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Ad Id:</Label>
                <Input 
                  value={formData.ad_id} 
                  onChange={(e) => setFormData({ ...formData, ad_id: e.target.value })}
                  className="h-10"
                  placeholder="Enter Ad ID"
                  data-testid="ad-id-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Ad Amount:</Label>
                <Input 
                  value={formData.ad_amount} 
                  onChange={(e) => setFormData({ ...formData, ad_amount: e.target.value })}
                  className="h-10"
                  placeholder="Amount"
                  type="number"
                  data-testid="ad-amount-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">City</Label>
                <Select value={formData.city || 'select'} onValueChange={(v) => setFormData({ ...formData, city: v === 'select' ? '' : v })}>
                  <SelectTrigger className="h-10" data-testid="ad-city-select">
                    <SelectValue placeholder="-- Select --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="select">-- Select --</SelectItem>
                    {cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Language:</Label>
                <Select value={formData.language || 'select'} onValueChange={(v) => setFormData({ ...formData, language: v === 'select' ? '' : v })}>
                  <SelectTrigger className="h-10" data-testid="ad-language-select">
                    <SelectValue placeholder="-- Select --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="select">-- Select --</SelectItem>
                    {languages.map((l) => (<SelectItem key={l} value={l}>{l}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Campaign:</Label>
                <Input 
                  value={formData.campaign} 
                  onChange={(e) => setFormData({ ...formData, campaign: e.target.value })}
                  className="h-10"
                  placeholder="Campaign name"
                  data-testid="ad-campaign-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Source</Label>
                <Select value={formData.source || 'select'} onValueChange={(v) => setFormData({ ...formData, source: v === 'select' ? '' : v })}>
                  <SelectTrigger className="h-10" data-testid="ad-source-select">
                    <SelectValue placeholder="-- Select --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="select">-- Select --</SelectItem>
                    {sources.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsModalOpen(false)}
                className="px-6"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={saving}
                className="px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                data-testid="save-ad-btn"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Add
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
