import React, { useState, useEffect } from 'react';
import { banksApi, citiesApi } from '@/services/api';
import { toast } from 'sonner';
import {
  Building2, Plus, Edit2, Trash2, Search, Loader2, RefreshCw,
  Percent, Clock, IndianRupee, Users, Phone, Mail, MapPin,
  CheckCircle, XCircle, ChevronDown, ChevronUp, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// Format currency
const formatCurrency = (amount) => {
  if (!amount) return '₹ 0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

// Bank Card Component
const BankCard = ({ bank, onEdit, onDelete, onToggle }) => {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <div className={`bg-white rounded-xl border transition-all ${bank.is_active ? 'border-gray-200' : 'border-red-200 bg-red-50/50'}`}>
      {/* Header */}
      <div className="p-4 flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bank.is_active ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <Building2 className={`h-6 w-6 ${bank.is_active ? 'text-blue-600' : 'text-gray-400'}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900">{bank.bank_name}</h3>
              <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
                {bank.bank_code}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Percent className="h-3.5 w-3.5" />
                {bank.interest_rate_min}% - {bank.interest_rate_max}%
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                Up to {bank.max_tenure_months} months
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={bank.is_active}
            onCheckedChange={() => onToggle(bank)}
          />
          <Button size="sm" variant="ghost" onClick={() => onEdit(bank)}>
            <Edit2 className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="ghost" className="text-red-600" onClick={() => onDelete(bank)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Quick Stats */}
      <div className="px-4 pb-3 flex items-center gap-6 text-sm">
        <div>
          <span className="text-gray-500">LTV:</span>
          <span className="ml-1 font-medium">{bank.max_ltv_percent}%</span>
        </div>
        <div>
          <span className="text-gray-500">Processing Fee:</span>
          <span className="ml-1 font-medium">{bank.processing_fee_percent}%</span>
        </div>
        <div>
          <span className="text-gray-500">Commission:</span>
          <span className="ml-1 font-medium text-green-600">{bank.payout_commission_percent}%</span>
        </div>
        <div>
          <span className="text-gray-500">POCs:</span>
          <span className="ml-1 font-medium">{bank.city_pocs?.length || 0}</span>
        </div>
      </div>
      
      {/* Expand/Collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 border-t flex items-center justify-center gap-1 text-sm text-gray-500 hover:bg-gray-50"
      >
        {expanded ? (
          <>
            <ChevronUp className="h-4 w-4" /> Hide Details
          </>
        ) : (
          <>
            <ChevronDown className="h-4 w-4" /> Show Details
          </>
        )}
      </button>
      
      {/* Expanded Details */}
      {expanded && (
        <div className="p-4 border-t bg-gray-50/50 space-y-4">
          {/* Eligibility Rules */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Eligibility Rules</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {bank.eligibility_rules?.min_income && (
                <div className="bg-white p-2 rounded border">
                  <p className="text-gray-500 text-xs">Min Income</p>
                  <p className="font-medium">{formatCurrency(bank.eligibility_rules.min_income)}</p>
                </div>
              )}
              {bank.eligibility_rules?.min_credit_score && (
                <div className="bg-white p-2 rounded border">
                  <p className="text-gray-500 text-xs">Min Credit Score</p>
                  <p className="font-medium">{bank.eligibility_rules.min_credit_score}</p>
                </div>
              )}
              {bank.eligibility_rules?.max_vehicle_age && (
                <div className="bg-white p-2 rounded border">
                  <p className="text-gray-500 text-xs">Max Vehicle Age</p>
                  <p className="font-medium">{bank.eligibility_rules.max_vehicle_age} years</p>
                </div>
              )}
              {bank.eligibility_rules?.max_loan_amount && (
                <div className="bg-white p-2 rounded border">
                  <p className="text-gray-500 text-xs">Max Loan Amount</p>
                  <p className="font-medium">{formatCurrency(bank.eligibility_rules.max_loan_amount)}</p>
                </div>
              )}
            </div>
          </div>
          
          {/* City POCs */}
          {bank.city_pocs?.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">City Contacts</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {bank.city_pocs.map((poc, idx) => (
                  <div key={idx} className="bg-white p-3 rounded border flex items-start gap-3">
                    <MapPin className="h-4 w-4 text-gray-400 mt-0.5" />
                    <div className="flex-1">
                      <p className="font-medium text-sm">{poc.city_name}</p>
                      <p className="text-sm text-gray-600">{poc.contact_name}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {poc.contact_phone}
                        </span>
                        {poc.contact_email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" /> {poc.contact_email}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Bank Form Modal
const BankFormModal = ({ isOpen, onClose, bank, onSave, cities }) => {
  const [formData, setFormData] = useState({
    bank_name: '',
    bank_code: '',
    interest_rate_min: 10,
    interest_rate_max: 14,
    max_tenure_months: 84,
    max_ltv_percent: 80,
    processing_fee_percent: 1,
    payout_commission_percent: 0.5,
    eligibility_rules: {
      min_income: 25000,
      min_credit_score: 650,
      max_vehicle_age: 10,
      max_loan_amount: 2500000
    },
    city_pocs: [],
    is_active: true
  });
  const [saving, setSaving] = useState(false);
  const [newPoc, setNewPoc] = useState({ city_id: '', city_name: '', contact_name: '', contact_phone: '', contact_email: '' });
  
  useEffect(() => {
    if (bank) {
      setFormData({
        bank_name: bank.bank_name || '',
        bank_code: bank.bank_code || '',
        interest_rate_min: bank.interest_rate_min || 10,
        interest_rate_max: bank.interest_rate_max || 14,
        max_tenure_months: bank.max_tenure_months || 84,
        max_ltv_percent: bank.max_ltv_percent || 80,
        processing_fee_percent: bank.processing_fee_percent || 1,
        payout_commission_percent: bank.payout_commission_percent || 0.5,
        eligibility_rules: bank.eligibility_rules || {},
        city_pocs: bank.city_pocs || [],
        is_active: bank.is_active !== false
      });
    } else {
      setFormData({
        bank_name: '',
        bank_code: '',
        interest_rate_min: 10,
        interest_rate_max: 14,
        max_tenure_months: 84,
        max_ltv_percent: 80,
        processing_fee_percent: 1,
        payout_commission_percent: 0.5,
        eligibility_rules: {
          min_income: 25000,
          min_credit_score: 650,
          max_vehicle_age: 10,
          max_loan_amount: 2500000
        },
        city_pocs: [],
        is_active: true
      });
    }
  }, [bank, isOpen]);
  
  const handleAddPoc = () => {
    if (!newPoc.city_id || !newPoc.contact_name || !newPoc.contact_phone) {
      toast.error('Please fill all required POC fields');
      return;
    }
    const city = cities.find(c => c.id === newPoc.city_id);
    const poc = { ...newPoc, city_name: city?.name || newPoc.city_id };
    setFormData(prev => ({
      ...prev,
      city_pocs: [...prev.city_pocs, poc]
    }));
    setNewPoc({ city_id: '', city_name: '', contact_name: '', contact_phone: '', contact_email: '' });
  };
  
  const handleRemovePoc = (idx) => {
    setFormData(prev => ({
      ...prev,
      city_pocs: prev.city_pocs.filter((_, i) => i !== idx)
    }));
  };
  
  const handleSubmit = async () => {
    if (!formData.bank_name || !formData.bank_code) {
      toast.error('Bank name and code are required');
      return;
    }
    
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save bank');
    } finally {
      setSaving(false);
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            {bank ? 'Edit Bank' : 'Add New Bank'}
          </DialogTitle>
          <DialogDescription>
            Configure bank details for loan processing
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bank Name *</Label>
              <Input
                value={formData.bank_name}
                onChange={(e) => setFormData(prev => ({ ...prev, bank_name: e.target.value }))}
                placeholder="e.g., HDFC Bank"
              />
            </div>
            <div>
              <Label>Bank Code *</Label>
              <Input
                value={formData.bank_code}
                onChange={(e) => setFormData(prev => ({ ...prev, bank_code: e.target.value.toUpperCase() }))}
                placeholder="e.g., HDFC"
              />
            </div>
          </div>
          
          {/* Interest & Tenure */}
          <div>
            <Label className="mb-2 block">Interest Rate & Tenure</Label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-gray-500">Min Interest %</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.interest_rate_min}
                  onChange={(e) => setFormData(prev => ({ ...prev, interest_rate_min: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Max Interest %</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.interest_rate_max}
                  onChange={(e) => setFormData(prev => ({ ...prev, interest_rate_max: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Max Tenure (months)</Label>
                <Input
                  type="number"
                  value={formData.max_tenure_months}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_tenure_months: parseInt(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>
          
          {/* Fees & Commission */}
          <div>
            <Label className="mb-2 block">LTV, Fees & Commission</Label>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs text-gray-500">Max LTV %</Label>
                <Input
                  type="number"
                  value={formData.max_ltv_percent}
                  onChange={(e) => setFormData(prev => ({ ...prev, max_ltv_percent: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Processing Fee %</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.processing_fee_percent}
                  onChange={(e) => setFormData(prev => ({ ...prev, processing_fee_percent: parseFloat(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Payout Commission %</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.payout_commission_percent}
                  onChange={(e) => setFormData(prev => ({ ...prev, payout_commission_percent: parseFloat(e.target.value) || 0 }))}
                />
              </div>
            </div>
          </div>
          
          {/* Eligibility Rules */}
          <div>
            <Label className="mb-2 block">Eligibility Rules</Label>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-gray-500">Min Monthly Income (₹)</Label>
                <Input
                  type="number"
                  value={formData.eligibility_rules?.min_income || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    eligibility_rules: { ...prev.eligibility_rules, min_income: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Min Credit Score</Label>
                <Input
                  type="number"
                  value={formData.eligibility_rules?.min_credit_score || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    eligibility_rules: { ...prev.eligibility_rules, min_credit_score: parseInt(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Max Vehicle Age (years)</Label>
                <Input
                  type="number"
                  value={formData.eligibility_rules?.max_vehicle_age || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    eligibility_rules: { ...prev.eligibility_rules, max_vehicle_age: parseInt(e.target.value) || 0 }
                  }))}
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500">Max Loan Amount (₹)</Label>
                <Input
                  type="number"
                  value={formData.eligibility_rules?.max_loan_amount || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    eligibility_rules: { ...prev.eligibility_rules, max_loan_amount: parseFloat(e.target.value) || 0 }
                  }))}
                />
              </div>
            </div>
          </div>
          
          {/* City POCs */}
          <div>
            <Label className="mb-2 block">City Points of Contact</Label>
            
            {/* Existing POCs */}
            {formData.city_pocs.length > 0 && (
              <div className="space-y-2 mb-4">
                {formData.city_pocs.map((poc, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <div className="flex-1">
                      <span className="font-medium">{poc.city_name}</span>
                      <span className="mx-2 text-gray-400">•</span>
                      <span className="text-sm text-gray-600">{poc.contact_name}</span>
                      <span className="mx-2 text-gray-400">•</span>
                      <span className="text-sm text-gray-500">{poc.contact_phone}</span>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => handleRemovePoc(idx)}>
                      <X className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Add New POC */}
            <div className="grid grid-cols-5 gap-2">
              <Select value={newPoc.city_id} onValueChange={(v) => setNewPoc(prev => ({ ...prev, city_id: v }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="City" />
                </SelectTrigger>
                <SelectContent>
                  {cities.map((city) => (
                    <SelectItem key={city.id} value={city.id}>{city.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                className="h-9"
                placeholder="Contact Name"
                value={newPoc.contact_name}
                onChange={(e) => setNewPoc(prev => ({ ...prev, contact_name: e.target.value }))}
              />
              <Input
                className="h-9"
                placeholder="Phone"
                value={newPoc.contact_phone}
                onChange={(e) => setNewPoc(prev => ({ ...prev, contact_phone: e.target.value }))}
              />
              <Input
                className="h-9"
                placeholder="Email (optional)"
                value={newPoc.contact_email}
                onChange={(e) => setNewPoc(prev => ({ ...prev, contact_email: e.target.value }))}
              />
              <Button className="h-9" variant="outline" onClick={handleAddPoc}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          {/* Active Status */}
          <div className="flex items-center gap-3 pt-2">
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_active: checked }))}
            />
            <Label>Bank is Active</Label>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {bank ? 'Update Bank' : 'Add Bank'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Main Bank Master Component
export default function BankMasterPage() {
  const [loading, setLoading] = useState(true);
  const [banks, setBanks] = useState([]);
  const [cities, setCities] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingBank, setEditingBank] = useState(null);
  
  useEffect(() => {
    fetchBanks();
    fetchCities();
  }, [showInactive]);
  
  const fetchBanks = async () => {
    setLoading(true);
    try {
      const params = showInactive ? {} : { is_active: true };
      const res = await banksApi.getAll(params);
      setBanks(res.data || []);
    } catch (err) {
      toast.error('Failed to fetch banks');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchCities = async () => {
    try {
      const res = await citiesApi.getAll();
      setCities(res.data || []);
    } catch (err) {
      console.error('Failed to fetch cities:', err);
    }
  };
  
  const handleSaveBank = async (formData) => {
    if (editingBank) {
      await banksApi.update(editingBank.id, formData);
      toast.success('Bank updated');
    } else {
      await banksApi.create(formData);
      toast.success('Bank added');
    }
    fetchBanks();
  };
  
  const handleDeleteBank = async (bank) => {
    if (!confirm(`Delete ${bank.bank_name}? This action cannot be undone.`)) return;
    try {
      await banksApi.delete(bank.id);
      toast.success('Bank deleted');
      fetchBanks();
    } catch (err) {
      toast.error('Failed to delete bank');
    }
  };
  
  const handleToggleBank = async (bank) => {
    try {
      await banksApi.update(bank.id, { is_active: !bank.is_active });
      toast.success(bank.is_active ? 'Bank deactivated' : 'Bank activated');
      fetchBanks();
    } catch (err) {
      toast.error('Failed to update bank');
    }
  };
  
  const filteredBanks = banks.filter(b => 
    b.bank_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.bank_code.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  return (
    <div className="space-y-6" data-testid="bank-master-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Bank Master</h2>
          <p className="text-sm text-gray-500">Manage banks for loan processing</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch checked={showInactive} onCheckedChange={setShowInactive} />
            <span className="text-sm text-gray-600">Show Inactive</span>
          </div>
          <Button onClick={() => { setEditingBank(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Bank
          </Button>
        </div>
      </div>
      
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search banks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>
      
      {/* Banks List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : filteredBanks.length === 0 ? (
        <div className="text-center py-12">
          <Building2 className="h-16 w-16 mx-auto mb-4 text-gray-300" />
          <p className="text-gray-500 text-lg">No banks configured</p>
          <p className="text-gray-400 text-sm mt-1">Add banks to enable loan processing</p>
          <Button className="mt-4" onClick={() => { setEditingBank(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Bank
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredBanks.map((bank) => (
            <BankCard
              key={bank.id}
              bank={bank}
              onEdit={(b) => { setEditingBank(b); setModalOpen(true); }}
              onDelete={handleDeleteBank}
              onToggle={handleToggleBank}
            />
          ))}
        </div>
      )}
      
      {/* Bank Form Modal */}
      <BankFormModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingBank(null); }}
        bank={editingBank}
        onSave={handleSaveBank}
        cities={cities}
      />
    </div>
  );
}
