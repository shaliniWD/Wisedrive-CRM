import React, { useState, useEffect } from 'react';
import { loansApi, banksApi } from '@/services/api';
import { toast } from 'sonner';
import {
  Building2, Plus, IndianRupee, Percent, Calculator, CheckCircle,
  XCircle, Edit2, Trash2, Loader2, ChevronDown, ChevronUp, Save,
  AlertTriangle, Clock, FileText, Info, X, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';

// Format currency helper
const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '₹ 0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

// Offer status badge
const OfferStatusBadge = ({ status }) => {
  const config = {
    PENDING: { color: 'bg-yellow-100 text-yellow-700', icon: Clock },
    NEGOTIATING: { color: 'bg-blue-100 text-blue-700', icon: Edit2 },
    ACCEPTED: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
    REJECTED: { color: 'bg-red-100 text-red-700', icon: XCircle },
    EXPIRED: { color: 'bg-gray-100 text-gray-500', icon: AlertTriangle },
  };
  
  const { color, icon: Icon } = config[status] || config.PENDING;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {status}
    </span>
  );
};

// Single Charge Row Component
const ChargeRow = ({ charge, onUpdate, isEditing, disabled }) => {
  const [editAmount, setEditAmount] = useState(charge.amount);
  const [isWaived, setIsWaived] = useState(charge.is_waived);

  useEffect(() => {
    setEditAmount(charge.amount);
    setIsWaived(charge.is_waived);
  }, [charge]);

  const handleSave = () => {
    onUpdate({
      charge_type: charge.charge_type,
      new_amount: parseFloat(editAmount) || 0,
      is_waived: isWaived
    });
  };

  return (
    <div className={`flex items-center justify-between py-2 px-3 rounded-lg ${isWaived ? 'bg-gray-50 opacity-60' : 'bg-white border'}`}>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${isWaived ? 'line-through text-gray-400' : ''}`}>
            {charge.charge_name}
          </span>
          {charge.is_percentage && (
            <span className="text-xs text-gray-500">({charge.percentage_value}%)</span>
          )}
          {charge.is_negotiable && !isWaived && (
            <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded">Negotiable</span>
          )}
        </div>
        {charge.notes && (
          <p className="text-xs text-gray-400 mt-0.5">{charge.notes}</p>
        )}
      </div>
      
      <div className="flex items-center gap-3">
        {isEditing && !disabled ? (
          <>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-gray-500">Waive</Label>
              <Switch
                checked={isWaived}
                onCheckedChange={setIsWaived}
                className="h-4 w-8"
              />
            </div>
            {!isWaived && (
              <Input
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                className="w-28 h-8 text-right"
              />
            )}
            <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={handleSave}>
              <Save className="h-3.5 w-3.5" />
            </Button>
          </>
        ) : (
          <span className={`font-semibold ${isWaived ? 'line-through text-gray-400' : 'text-gray-900'}`}>
            {formatCurrency(charge.amount)}
          </span>
        )}
      </div>
    </div>
  );
};

// Single Offer Card Component
const OfferCard = ({ offer, onUpdate, onAccept, lead, expanded, onToggleExpand, chargeTypes }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [chargesUpdates, setChargesUpdates] = useState([]);
  const [saving, setSaving] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [showAddCharge, setShowAddCharge] = useState(false);
  const [addingCharge, setAddingCharge] = useState(false);
  const [newCharge, setNewCharge] = useState({
    charge_type: '',
    charge_name: '',
    amount: '',
    is_percentage: false,
    is_negotiable: true,
    notes: ''
  });

  const handleChargeUpdate = (update) => {
    setChargesUpdates(prev => {
      const existing = prev.findIndex(u => u.charge_type === update.charge_type);
      if (existing >= 0) {
        const newUpdates = [...prev];
        newUpdates[existing] = update;
        return newUpdates;
      }
      return [...prev, update];
    });
  };

  const handleSaveNegotiation = async () => {
    if (chargesUpdates.length === 0) {
      setIsEditing(false);
      return;
    }

    setSaving(true);
    try {
      await loansApi.updateOffer(lead.id, offer.id, {
        charges_updates: chargesUpdates,
        negotiation_notes: 'Charges negotiated'
      });
      toast.success('Charges updated successfully');
      setChargesUpdates([]);
      setIsEditing(false);
      onUpdate();
    } catch (err) {
      toast.error('Failed to update charges');
    } finally {
      setSaving(false);
    }
  };

  const handleAcceptOffer = async () => {
    setAccepting(true);
    try {
      await loansApi.acceptOffer(lead.id, offer.id);
      toast.success('Offer accepted!');
      onAccept?.();
      onUpdate();
    } catch (err) {
      toast.error('Failed to accept offer');
    } finally {
      setAccepting(false);
    }
  };

  const handleAddCharge = async () => {
    if (!newCharge.charge_type || !newCharge.amount) {
      toast.error('Please select charge type and enter amount');
      return;
    }

    setAddingCharge(true);
    try {
      await loansApi.addChargeToOffer(lead.id, offer.id, {
        charge_type: newCharge.charge_type,
        charge_name: newCharge.charge_name || newCharge.charge_type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        amount: parseFloat(newCharge.amount),
        is_percentage: newCharge.is_percentage,
        percentage_value: newCharge.is_percentage ? parseFloat(newCharge.amount) : null,
        is_negotiable: newCharge.is_negotiable,
        notes: newCharge.notes || null
      });
      toast.success('Charge added successfully');
      setShowAddCharge(false);
      setNewCharge({ charge_type: '', charge_name: '', amount: '', is_percentage: false, is_negotiable: true, notes: '' });
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add charge');
    } finally {
      setAddingCharge(false);
    }
  };

  const handleRemoveCharge = async (chargeType) => {
    try {
      await loansApi.removeChargeFromOffer(lead.id, offer.id, chargeType);
      toast.success('Charge removed');
      onUpdate();
    } catch (err) {
      toast.error('Failed to remove charge');
    }
  };

  const handleChargeTypeSelect = (value) => {
    const selectedType = chargeTypes.find(ct => ct.charge_key === value);
    if (selectedType) {
      setNewCharge({
        ...newCharge,
        charge_type: selectedType.charge_key,
        charge_name: selectedType.charge_name,
        amount: selectedType.is_percentage ? (selectedType.default_percentage || '') : (selectedType.default_amount || ''),
        is_percentage: selectedType.is_percentage,
        is_negotiable: selectedType.is_negotiable
      });
    }
  };

  // Get existing charge types on this offer
  const existingChargeTypes = offer.charges?.map(c => c.charge_type) || [];
  const availableChargeTypes = chargeTypes.filter(ct => !existingChargeTypes.includes(ct.charge_key));

  // Calculate current totals from charges
  const activeCharges = offer.charges?.filter(c => !c.is_waived) || [];
  const totalCharges = activeCharges.reduce((sum, c) => sum + (c.amount || 0), 0);

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${offer.offer_status === 'ACCEPTED' ? 'border-green-300 bg-green-50/30' : 'bg-white'}`}>
      {/* Offer Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
        onClick={() => onToggleExpand(offer.id)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${offer.offer_status === 'ACCEPTED' ? 'bg-green-100' : 'bg-blue-100'}`}>
              <Building2 className={`h-5 w-5 ${offer.offer_status === 'ACCEPTED' ? 'text-green-600' : 'text-blue-600'}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-gray-900">{offer.bank_name}</h4>
                <OfferStatusBadge status={offer.offer_status} />
                {offer.is_manual && (
                  <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">Manual</span>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Ref: {offer.bank_reference_number || 'N/A'} • Created {new Date(offer.created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-gray-500">Net Disbursal</p>
              <p className="text-lg font-bold text-green-600">{formatCurrency(offer.net_disbursal_amount)}</p>
            </div>
            {expanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
          </div>
        </div>
        
        {/* Quick Summary */}
        <div className="mt-3 grid grid-cols-4 gap-4 text-sm">
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500">Loan Approved</p>
            <p className="font-semibold">{formatCurrency(offer.loan_amount_approved)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500">Interest Rate</p>
            <p className="font-semibold">{offer.interest_rate}%</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500">EMI</p>
            <p className="font-semibold">{formatCurrency(offer.emi_amount)}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-500">Tenure</p>
            <p className="font-semibold">{offer.tenure_months} months</p>
          </div>
        </div>
      </div>
      
      {/* Expanded Details */}
      {expanded && (
        <div className="border-t p-4 bg-gray-50/50">
          {/* Loan Amount Breakdown */}
          <div className="mb-4">
            <h5 className="text-sm font-medium text-gray-700 mb-2">Loan Amount Breakdown</h5>
            <div className="bg-white rounded-lg p-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Loan Amount Approved</span>
                <span className="font-medium">{formatCurrency(offer.loan_amount_approved)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">+ Loan Insurance</span>
                <span className="font-medium">{formatCurrency(offer.loan_insurance)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-semibold">
                <span>Total Loan Amount</span>
                <span className="text-blue-600">{formatCurrency(offer.total_loan_amount)}</span>
              </div>
            </div>
          </div>
          
          {/* Charges Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-sm font-medium text-gray-700">Charges (Deducted from Loan)</h5>
              <div className="flex items-center gap-2">
                {offer.offer_status === 'PENDING' && (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setShowAddCharge(!showAddCharge)}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Charge
                    </Button>
                    <Button 
                      size="sm" 
                      variant={isEditing ? "default" : "outline"}
                      onClick={() => {
                        if (isEditing) {
                          handleSaveNegotiation();
                        } else {
                          setIsEditing(true);
                        }
                      }}
                      disabled={saving}
                    >
                      {saving ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : isEditing ? (
                        <Save className="h-3 w-3 mr-1" />
                      ) : (
                        <Edit2 className="h-3 w-3 mr-1" />
                      )}
                      {isEditing ? 'Save Changes' : 'Negotiate'}
                    </Button>
                  </>
                )}
              </div>
            </div>
            
            {/* Add Charge Form */}
            {showAddCharge && offer.offer_status === 'PENDING' && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h6 className="text-sm font-medium text-blue-900 mb-3">Add New Charge</h6>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Charge Type</Label>
                    <Select value={newCharge.charge_type} onValueChange={handleChargeTypeSelect}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Select charge type" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableChargeTypes.map((ct) => (
                          <SelectItem key={ct.charge_key} value={ct.charge_key}>
                            <div className="flex items-center gap-2">
                              <span>{ct.charge_name}</span>
                              {ct.is_system && <span className="text-[10px] text-gray-400">(System)</span>}
                            </div>
                          </SelectItem>
                        ))}
                        <SelectItem value="custom">
                          <div className="flex items-center gap-2 text-purple-600">
                            <Plus className="h-3 w-3" />
                            Custom Charge
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {newCharge.charge_type === 'custom' && (
                    <div>
                      <Label className="text-xs">Custom Name</Label>
                      <Input
                        value={newCharge.charge_name}
                        onChange={(e) => setNewCharge({...newCharge, charge_name: e.target.value, charge_type: e.target.value.toLowerCase().replace(/\s+/g, '_')})}
                        placeholder="Enter charge name"
                        className="h-9"
                      />
                    </div>
                  )}
                  
                  <div>
                    <Label className="text-xs">
                      Amount {newCharge.is_percentage ? '(%)' : '(₹)'}
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        value={newCharge.amount}
                        onChange={(e) => setNewCharge({...newCharge, amount: e.target.value})}
                        placeholder={newCharge.is_percentage ? "1.5" : "5000"}
                        className="h-9"
                      />
                      <div className="flex items-center gap-1">
                        <Switch
                          checked={newCharge.is_percentage}
                          onCheckedChange={(v) => setNewCharge({...newCharge, is_percentage: v})}
                          className="h-4 w-8"
                        />
                        <span className="text-xs text-gray-500">%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <Label className="text-xs">Notes (optional)</Label>
                    <Input
                      value={newCharge.notes}
                      onChange={(e) => setNewCharge({...newCharge, notes: e.target.value})}
                      placeholder="Additional notes"
                      className="h-9"
                    />
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={newCharge.is_negotiable}
                      onCheckedChange={(v) => setNewCharge({...newCharge, is_negotiable: v})}
                      className="h-4 w-8"
                    />
                    <span className="text-xs text-gray-600">Negotiable</span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setShowAddCharge(false)}>Cancel</Button>
                    <Button size="sm" onClick={handleAddCharge} disabled={addingCharge}>
                      {addingCharge ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Plus className="h-3 w-3 mr-1" />}
                      Add
                    </Button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-2">
              {offer.charges?.map((charge, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1">
                    <ChargeRow
                      charge={charge}
                      isEditing={isEditing}
                      disabled={offer.offer_status !== 'PENDING'}
                      onUpdate={handleChargeUpdate}
                    />
                  </div>
                  {offer.offer_status === 'PENDING' && isEditing && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                      onClick={() => handleRemoveCharge(charge.charge_type)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
              
              {(!offer.charges || offer.charges.length === 0) && (
                <p className="text-sm text-gray-500 text-center py-4">No charges added</p>
              )}
            </div>
            
            {/* Charges Total */}
            <div className="mt-3 bg-amber-50 rounded-lg p-3 flex justify-between items-center">
              <span className="text-sm font-medium text-amber-800">Total Charges</span>
              <span className="text-lg font-bold text-amber-700">- {formatCurrency(offer.total_charges)}</span>
            </div>
          </div>
          
          {/* Net Disbursal Calculation */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl p-4 border border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700 font-medium">Net Disbursal to Customer</p>
                <p className="text-xs text-green-600 mt-0.5">Total Loan Amount - Total Charges</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-green-700">{formatCurrency(offer.net_disbursal_amount)}</p>
                <p className="text-xs text-green-600">{formatCurrency(offer.total_loan_amount)} - {formatCurrency(offer.total_charges)}</p>
              </div>
            </div>
          </div>
          
          {/* Action Buttons */}
          {offer.offer_status === 'PENDING' && (
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditing(false)} disabled={!isEditing}>
                Cancel
              </Button>
              <Button 
                className="bg-green-600 hover:bg-green-700"
                onClick={handleAcceptOffer}
                disabled={accepting}
              >
                {accepting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Check className="h-4 w-4 mr-2" />
                )}
                Accept This Offer
              </Button>
            </div>
          )}
          
          {/* Negotiation History */}
          {offer.negotiation_history?.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <h5 className="text-sm font-medium text-gray-700 mb-2">Negotiation History</h5>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {offer.negotiation_history.map((entry, idx) => (
                  <div key={idx} className="text-xs bg-white rounded p-2 border">
                    <div className="flex justify-between">
                      <span className="text-gray-500">{new Date(entry.timestamp).toLocaleString()}</span>
                      <span className="text-gray-500">{entry.user}</span>
                    </div>
                    {entry.notes && <p className="text-gray-700 mt-1">{entry.notes}</p>}
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

// Add New Offer Form
const AddOfferForm = ({ lead, application, onClose, onSuccess }) => {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    loan_amount_approved: application?.approved_amount || '',
    loan_insurance: 0,
    interest_rate: application?.interest_rate || '',
    tenure_months: application?.tenure_months || 60,
    bank_reference_number: '',
    processing_fee_percent: '',
    processing_fee_amount: '',
    document_handling_fee: '',
    rto_charges: '',
    insurance_charges: '',
    valuation_charges: '',
    stamp_duty: '',
  });

  // Calculate totals in real-time
  const loanAmount = parseFloat(formData.loan_amount_approved) || 0;
  const loanInsurance = parseFloat(formData.loan_insurance) || 0;
  const totalLoan = loanAmount + loanInsurance;
  
  const processingFee = formData.processing_fee_percent 
    ? (loanAmount * parseFloat(formData.processing_fee_percent) / 100)
    : (parseFloat(formData.processing_fee_amount) || 0);
  const docFee = parseFloat(formData.document_handling_fee) || 0;
  const rtoCharges = parseFloat(formData.rto_charges) || 0;
  const insuranceCharges = parseFloat(formData.insurance_charges) || 0;
  const valuationCharges = parseFloat(formData.valuation_charges) || 0;
  const stampDuty = parseFloat(formData.stamp_duty) || 0;
  const totalCharges = processingFee + docFee + rtoCharges + insuranceCharges + valuationCharges + stampDuty;
  const netDisbursal = totalLoan - totalCharges;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.loan_amount_approved || !formData.interest_rate) {
      toast.error('Please fill required fields');
      return;
    }

    setLoading(true);
    try {
      await loansApi.createOffer(lead.id, {
        application_id: application.id,
        loan_amount_approved: parseFloat(formData.loan_amount_approved),
        loan_insurance: parseFloat(formData.loan_insurance) || 0,
        interest_rate: parseFloat(formData.interest_rate),
        tenure_months: parseInt(formData.tenure_months),
        bank_reference_number: formData.bank_reference_number || null,
        processing_fee_percent: formData.processing_fee_percent ? parseFloat(formData.processing_fee_percent) : null,
        processing_fee_amount: !formData.processing_fee_percent && formData.processing_fee_amount ? parseFloat(formData.processing_fee_amount) : null,
        document_handling_fee: formData.document_handling_fee ? parseFloat(formData.document_handling_fee) : null,
        rto_charges: formData.rto_charges ? parseFloat(formData.rto_charges) : null,
        insurance_charges: formData.insurance_charges ? parseFloat(formData.insurance_charges) : null,
      });
      toast.success('Bank offer added successfully');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add offer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Bank Info */}
      <div className="bg-blue-50 rounded-lg p-3 flex items-center gap-3">
        <Building2 className="h-5 w-5 text-blue-600" />
        <div>
          <p className="font-medium text-blue-900">{application.bank_name}</p>
          <p className="text-xs text-blue-700">Application ID: {application.id.slice(0, 8)}...</p>
        </div>
      </div>

      {/* Loan Amount Section */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm">Loan Amount Approved <span className="text-red-500">*</span></Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="number"
              placeholder="500000"
              value={formData.loan_amount_approved}
              onChange={(e) => setFormData({...formData, loan_amount_approved: e.target.value})}
              className="pl-9"
              required
            />
          </div>
        </div>
        <div>
          <Label className="text-sm">Loan Insurance</Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="number"
              placeholder="0"
              value={formData.loan_insurance}
              onChange={(e) => setFormData({...formData, loan_insurance: e.target.value})}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Interest & Tenure */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="text-sm">Interest Rate (%) <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="number"
              step="0.01"
              placeholder="12.5"
              value={formData.interest_rate}
              onChange={(e) => setFormData({...formData, interest_rate: e.target.value})}
              className="pl-9"
              required
            />
          </div>
        </div>
        <div>
          <Label className="text-sm">Tenure (Months)</Label>
          <Input
            type="number"
            placeholder="60"
            value={formData.tenure_months}
            onChange={(e) => setFormData({...formData, tenure_months: e.target.value})}
          />
        </div>
        <div>
          <Label className="text-sm">Bank Reference #</Label>
          <Input
            placeholder="REF123456"
            value={formData.bank_reference_number}
            onChange={(e) => setFormData({...formData, bank_reference_number: e.target.value})}
          />
        </div>
      </div>

      {/* Charges Section */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Processing Charges (Deducted from Disbursal)
        </h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">Processing Fee (%)</Label>
            <div className="relative">
              <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="number"
                step="0.1"
                placeholder="1.5"
                value={formData.processing_fee_percent}
                onChange={(e) => setFormData({...formData, processing_fee_percent: e.target.value, processing_fee_amount: ''})}
                className="pl-9"
                disabled={!!formData.processing_fee_amount}
              />
            </div>
          </div>
          <div>
            <Label className="text-sm">Or Fixed Amount</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="number"
                placeholder="5000"
                value={formData.processing_fee_amount}
                onChange={(e) => setFormData({...formData, processing_fee_amount: e.target.value, processing_fee_percent: ''})}
                className="pl-9"
                disabled={!!formData.processing_fee_percent}
              />
            </div>
          </div>
          <div>
            <Label className="text-sm">Document Handling Fee</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="number"
                placeholder="1000"
                value={formData.document_handling_fee}
                onChange={(e) => setFormData({...formData, document_handling_fee: e.target.value})}
                className="pl-9"
              />
            </div>
          </div>
          <div>
            <Label className="text-sm">RTO Charges</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="number"
                placeholder="3000"
                value={formData.rto_charges}
                onChange={(e) => setFormData({...formData, rto_charges: e.target.value})}
                className="pl-9"
              />
            </div>
          </div>
          <div className="col-span-2">
            <Label className="text-sm">Insurance Charges (if car not insured)</Label>
            <div className="relative">
              <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                type="number"
                placeholder="15000"
                value={formData.insurance_charges}
                onChange={(e) => setFormData({...formData, insurance_charges: e.target.value})}
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Real-time Calculation Preview */}
      <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-4 border">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Calculation Preview</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Loan Amount Approved</span>
            <span className="font-medium">{formatCurrency(loanAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">+ Loan Insurance</span>
            <span className="font-medium">{formatCurrency(loanInsurance)}</span>
          </div>
          <div className="flex justify-between font-semibold border-t pt-2">
            <span>Total Loan Amount</span>
            <span className="text-blue-600">{formatCurrency(totalLoan)}</span>
          </div>
          <div className="flex justify-between text-amber-700">
            <span>- Total Charges</span>
            <span>{formatCurrency(totalCharges)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t pt-2">
            <span className="text-green-700">Net Disbursal</span>
            <span className="text-green-600">{formatCurrency(netDisbursal)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          Add Bank Offer
        </Button>
      </div>
    </form>
  );
};

// Manual Offer Form (for banks where auto eligibility failed)
const ManualOfferForm = ({ lead, vehicle, onClose, onSuccess }) => {
  const [banks, setBanks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    bank_id: '',
    loan_amount_approved: '',
    loan_insurance: 0,
    interest_rate: '',
    tenure_months: 60,
    bank_reference_number: '',
    processing_fee_percent: '',
    processing_fee_amount: '',
    document_handling_fee: '',
    rto_charges: '',
    insurance_charges: '',
    notes: ''
  });

  useEffect(() => {
    fetchBanks();
  }, []);

  const fetchBanks = async () => {
    try {
      const res = await banksApi.getAll({ is_active: true });
      setBanks(res.data || []);
    } catch (err) {
      console.error('Failed to fetch banks:', err);
    }
  };

  // Calculate totals
  const loanAmount = parseFloat(formData.loan_amount_approved) || 0;
  const loanInsurance = parseFloat(formData.loan_insurance) || 0;
  const totalLoan = loanAmount + loanInsurance;
  
  const processingFee = formData.processing_fee_percent 
    ? (loanAmount * parseFloat(formData.processing_fee_percent) / 100)
    : (parseFloat(formData.processing_fee_amount) || 0);
  const docFee = parseFloat(formData.document_handling_fee) || 0;
  const rtoCharges = parseFloat(formData.rto_charges) || 0;
  const insuranceCharges = parseFloat(formData.insurance_charges) || 0;
  const totalCharges = processingFee + docFee + rtoCharges + insuranceCharges;
  const netDisbursal = totalLoan - totalCharges;

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.bank_id || !formData.loan_amount_approved || !formData.interest_rate) {
      toast.error('Please fill required fields');
      return;
    }

    setLoading(true);
    try {
      await loansApi.createManualOffer(lead.id, {
        bank_id: formData.bank_id,
        vehicle_loan_id: vehicle.vehicle_id,
        loan_amount_approved: parseFloat(formData.loan_amount_approved),
        loan_insurance: parseFloat(formData.loan_insurance) || 0,
        interest_rate: parseFloat(formData.interest_rate),
        tenure_months: parseInt(formData.tenure_months),
        bank_reference_number: formData.bank_reference_number || null,
        processing_fee_percent: formData.processing_fee_percent ? parseFloat(formData.processing_fee_percent) : null,
        processing_fee_amount: !formData.processing_fee_percent && formData.processing_fee_amount ? parseFloat(formData.processing_fee_amount) : null,
        document_handling_fee: formData.document_handling_fee ? parseFloat(formData.document_handling_fee) : null,
        rto_charges: formData.rto_charges ? parseFloat(formData.rto_charges) : null,
        insurance_charges: formData.insurance_charges ? parseFloat(formData.insurance_charges) : null,
        notes: formData.notes || null
      });
      toast.success('Manual bank offer added successfully');
      onSuccess();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add manual offer');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Info Banner */}
      <div className="bg-purple-50 rounded-lg p-3 flex items-start gap-3 border border-purple-200">
        <Info className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm">
          <p className="font-medium text-purple-900">Manual Offer Entry</p>
          <p className="text-purple-700 text-xs mt-0.5">
            Use this when a bank approves a loan outside of normal eligibility criteria
          </p>
        </div>
      </div>

      {/* Bank Selection */}
      <div>
        <Label className="text-sm">Select Bank <span className="text-red-500">*</span></Label>
        <Select value={formData.bank_id} onValueChange={(v) => setFormData({...formData, bank_id: v})}>
          <SelectTrigger>
            <SelectValue placeholder="Select a bank" />
          </SelectTrigger>
          <SelectContent>
            {banks.map((bank) => (
              <SelectItem key={bank.id} value={bank.id}>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  {bank.bank_name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Loan Amount Section */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label className="text-sm">Loan Amount Approved <span className="text-red-500">*</span></Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="number"
              placeholder="500000"
              value={formData.loan_amount_approved}
              onChange={(e) => setFormData({...formData, loan_amount_approved: e.target.value})}
              className="pl-9"
              required
            />
          </div>
        </div>
        <div>
          <Label className="text-sm">Loan Insurance</Label>
          <div className="relative">
            <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="number"
              placeholder="0"
              value={formData.loan_insurance}
              onChange={(e) => setFormData({...formData, loan_insurance: e.target.value})}
              className="pl-9"
            />
          </div>
        </div>
      </div>

      {/* Interest & Tenure */}
      <div className="grid grid-cols-3 gap-4">
        <div>
          <Label className="text-sm">Interest Rate (%) <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="number"
              step="0.01"
              placeholder="12.5"
              value={formData.interest_rate}
              onChange={(e) => setFormData({...formData, interest_rate: e.target.value})}
              className="pl-9"
              required
            />
          </div>
        </div>
        <div>
          <Label className="text-sm">Tenure (Months)</Label>
          <Input
            type="number"
            placeholder="60"
            value={formData.tenure_months}
            onChange={(e) => setFormData({...formData, tenure_months: e.target.value})}
          />
        </div>
        <div>
          <Label className="text-sm">Bank Reference #</Label>
          <Input
            placeholder="REF123456"
            value={formData.bank_reference_number}
            onChange={(e) => setFormData({...formData, bank_reference_number: e.target.value})}
          />
        </div>
      </div>

      {/* Charges Section */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Processing Charges
        </h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">Processing Fee (%)</Label>
            <Input
              type="number"
              step="0.1"
              placeholder="1.5"
              value={formData.processing_fee_percent}
              onChange={(e) => setFormData({...formData, processing_fee_percent: e.target.value, processing_fee_amount: ''})}
              disabled={!!formData.processing_fee_amount}
            />
          </div>
          <div>
            <Label className="text-sm">Or Fixed Amount (₹)</Label>
            <Input
              type="number"
              placeholder="5000"
              value={formData.processing_fee_amount}
              onChange={(e) => setFormData({...formData, processing_fee_amount: e.target.value, processing_fee_percent: ''})}
              disabled={!!formData.processing_fee_percent}
            />
          </div>
          <div>
            <Label className="text-sm">Document Handling Fee (₹)</Label>
            <Input
              type="number"
              placeholder="1000"
              value={formData.document_handling_fee}
              onChange={(e) => setFormData({...formData, document_handling_fee: e.target.value})}
            />
          </div>
          <div>
            <Label className="text-sm">RTO Charges (₹)</Label>
            <Input
              type="number"
              placeholder="3000"
              value={formData.rto_charges}
              onChange={(e) => setFormData({...formData, rto_charges: e.target.value})}
            />
          </div>
          <div className="col-span-2">
            <Label className="text-sm">Insurance Charges (₹)</Label>
            <Input
              type="number"
              placeholder="15000"
              value={formData.insurance_charges}
              onChange={(e) => setFormData({...formData, insurance_charges: e.target.value})}
            />
          </div>
        </div>
      </div>

      {/* Notes */}
      <div>
        <Label className="text-sm">Notes (why manual entry)</Label>
        <Input
          placeholder="Banker approved despite credit score..."
          value={formData.notes}
          onChange={(e) => setFormData({...formData, notes: e.target.value})}
        />
      </div>

      {/* Calculation Preview */}
      <div className="bg-gradient-to-r from-gray-50 to-slate-50 rounded-xl p-4 border">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between font-semibold">
            <span>Total Loan Amount</span>
            <span className="text-blue-600">{formatCurrency(totalLoan)}</span>
          </div>
          <div className="flex justify-between text-amber-700">
            <span>- Total Charges</span>
            <span>{formatCurrency(totalCharges)}</span>
          </div>
          <div className="flex justify-between font-bold text-lg border-t pt-2">
            <span className="text-green-700">Net Disbursal</span>
            <span className="text-green-600">{formatCurrency(netDisbursal)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
        <Button type="submit" disabled={loading} className="bg-purple-600 hover:bg-purple-700">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          Add Manual Offer
        </Button>
      </div>
    </form>
  );
};

// Main Bank Offers Modal
export default function BankOffersModal({ isOpen, onClose, lead, vehicle, application, onUpdate }) {
  const [offers, setOffers] = useState([]);
  const [chargeTypes, setChargeTypes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [expandedOffer, setExpandedOffer] = useState(null);

  useEffect(() => {
    if (isOpen && lead?.id) {
      fetchOffers();
      fetchChargeTypes();
    }
  }, [isOpen, lead?.id]);

  const fetchChargeTypes = async () => {
    try {
      const res = await loansApi.getChargeTypes();
      setChargeTypes(res.data || []);
    } catch (err) {
      console.error('Failed to fetch charge types:', err);
    }
  };

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const res = await loansApi.getOffers(lead.id);
      // Filter offers for this vehicle if vehicle is specified
      let filteredOffers = res.data || [];
      if (vehicle?.vehicle_id) {
        filteredOffers = filteredOffers.filter(o => o.vehicle_loan_id === vehicle.vehicle_id);
      }
      setOffers(filteredOffers);
      // Expand first offer by default
      if (filteredOffers.length > 0 && !expandedOffer) {
        setExpandedOffer(filteredOffers[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch offers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleExpand = (offerId) => {
    setExpandedOffer(expandedOffer === offerId ? null : offerId);
  };

  const handleFormSuccess = () => {
    setShowAddForm(false);
    setShowManualForm(false);
    fetchOffers();
    onUpdate?.();
  };

  // Get accepted offer if any
  const acceptedOffer = offers.find(o => o.offer_status === 'ACCEPTED');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600" />
            Bank Loan Offers
          </DialogTitle>
          <DialogDescription>
            {lead?.customer_name} • {vehicle ? `Vehicle: ${vehicle.car_number}` : 'All Vehicles'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {/* Add Offer Buttons */}
          {!showAddForm && !showManualForm && (
            <div className="flex gap-2">
              {application && (
                <Button onClick={() => setShowAddForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Offer from {application.bank_name}
                </Button>
              )}
              <Button variant="outline" onClick={() => setShowManualForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Manual Offer
              </Button>
            </div>
          )}

          {/* Add Offer Form */}
          {showAddForm && application && (
            <div className="border rounded-xl p-4 bg-blue-50/30">
              <h3 className="font-semibold text-gray-900 mb-4">Add New Bank Offer</h3>
              <AddOfferForm
                lead={lead}
                application={application}
                onClose={() => setShowAddForm(false)}
                onSuccess={handleFormSuccess}
              />
            </div>
          )}

          {/* Manual Offer Form */}
          {showManualForm && vehicle && (
            <div className="border rounded-xl p-4 bg-purple-50/30">
              <h3 className="font-semibold text-gray-900 mb-4">Add Manual Bank Offer</h3>
              <ManualOfferForm
                lead={lead}
                vehicle={vehicle}
                onClose={() => setShowManualForm(false)}
                onSuccess={handleFormSuccess}
              />
            </div>
          )}

          {/* Accepted Offer Banner */}
          {acceptedOffer && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-900">Offer Accepted: {acceptedOffer.bank_name}</p>
                    <p className="text-sm text-green-700">Net Disbursal: {formatCurrency(acceptedOffer.final_net_disbursal || acceptedOffer.net_disbursal_amount)}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Offers List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : offers.length > 0 ? (
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-gray-700">
                {offers.length} Bank Offer{offers.length > 1 ? 's' : ''} Available
              </h4>
              {offers.map((offer) => (
                <OfferCard
                  key={offer.id}
                  offer={offer}
                  lead={lead}
                  expanded={expandedOffer === offer.id}
                  onToggleExpand={handleToggleExpand}
                  onUpdate={fetchOffers}
                  onAccept={onUpdate}
                  chargeTypes={chargeTypes}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-600 font-medium">No Bank Offers Yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Add offers from banks after loan approval or create a manual offer
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 pt-4 border-t">
          <div className="flex justify-end">
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
