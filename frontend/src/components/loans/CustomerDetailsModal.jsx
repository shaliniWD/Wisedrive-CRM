// Customer Details Modal Component - Clean, Modern UI Design
import React, { useState, useEffect, useRef } from 'react';
import { loansApi } from '@/services/api';
import { toast } from 'sonner';
import {
  Car, FileText, CheckCircle, Plus, Trash2, RefreshCw, Upload, 
  Loader2, AlertCircle, Eye, User, Phone, Mail, Edit, Save, X,
  Banknote, Calendar, Shield, ChevronRight, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ==================== CUSTOMER INFO TAB ====================
const CustomerInfoTab = ({ lead, onUpdate }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    pan_number: '',
    mobile_number: '',
    email: '',
    gender: 'male'
  });
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (lead) {
      const nameParts = (lead.customer_name || '').split(' ');
      let mobile = lead.customer_phone || '';
      mobile = mobile.replace('+91', '').replace('91', '').replace(/\D/g, '');
      if (mobile.length > 10) mobile = mobile.slice(-10);
      
      setFormData({
        first_name: lead.credit_first_name || nameParts[0] || '',
        last_name: lead.credit_last_name || nameParts.slice(1).join(' ') || '',
        pan_number: lead.pan_number || '',
        mobile_number: mobile,
        email: lead.customer_email || lead.email || '',
        gender: lead.gender || 'male'
      });
    }
  }, [lead]);

  const handleSave = async () => {
    if (!formData.pan_number || formData.pan_number.length !== 10) {
      toast.error('Please enter a valid 10-character PAN number');
      return;
    }
    
    setSaving(true);
    try {
      await loansApi.updateLead(lead.id, {
        credit_first_name: formData.first_name,
        credit_last_name: formData.last_name,
        pan_number: formData.pan_number.toUpperCase(),
        customer_phone: '+91' + formData.mobile_number,
        customer_email: formData.email,
        gender: formData.gender
      });
      toast.success('Customer details saved');
      setIsEditing(false);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const InfoField = ({ icon: Icon, label, value, className = "" }) => (
    <div className={`flex items-start gap-3 ${className}`}>
      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
        <Icon className="h-4 w-4 text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-slate-800 truncate">{value || '—'}</p>
      </div>
    </div>
  );

  if (!isEditing) {
    return (
      <div className="space-y-6">
        {/* Header with Edit Button */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Customer Information</h3>
            <p className="text-sm text-slate-500">Personal and contact details</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsEditing(true)}
            className="gap-2"
            data-testid="edit-customer-info-btn"
          >
            <Edit className="h-4 w-4" />
            Edit
          </Button>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white rounded-xl border border-slate-200">
          <InfoField icon={User} label="First Name" value={formData.first_name} />
          <InfoField icon={User} label="Last Name" value={formData.last_name} />
          <InfoField icon={Shield} label="PAN Number" value={formData.pan_number} />
          <InfoField icon={User} label="Gender" value={formData.gender === 'male' ? 'Male' : 'Female'} />
          <InfoField icon={Phone} label="Mobile" value={formData.mobile_number ? `+91 ${formData.mobile_number}` : null} />
          <InfoField icon={Mail} label="Email" value={formData.email} />
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
            <p className="text-xs font-medium text-blue-600 uppercase">Vehicles</p>
            <p className="text-2xl font-bold text-blue-700">{lead?.vehicles?.length || 0}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-xl border border-green-100">
            <p className="text-xs font-medium text-green-600 uppercase">Documents</p>
            <p className="text-2xl font-bold text-green-700">{lead?.documents?.length || 0}</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-xl border border-purple-100">
            <p className="text-xs font-medium text-purple-600 uppercase">Credit Score</p>
            <p className="text-2xl font-bold text-purple-700">{lead?.credit_score || '—'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Edit Mode
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Edit Customer Information</h3>
          <p className="text-sm text-slate-500">Update personal and contact details</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setIsEditing(false)}
            data-testid="cancel-edit-btn"
          >
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button 
            size="sm" 
            onClick={handleSave}
            disabled={saving}
            className="bg-[#2E3192] hover:bg-[#2E3192]/90"
            data-testid="save-customer-info-btn"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="p-6 bg-white rounded-xl border border-slate-200">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-500">First Name</Label>
            <Input
              value={formData.first_name}
              onChange={(e) => setFormData({...formData, first_name: e.target.value})}
              placeholder="Enter first name"
              data-testid="first-name-input"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-500">Last Name</Label>
            <Input
              value={formData.last_name}
              onChange={(e) => setFormData({...formData, last_name: e.target.value})}
              placeholder="Enter last name"
              data-testid="last-name-input"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-500">PAN Number *</Label>
            <Input
              value={formData.pan_number}
              onChange={(e) => setFormData({...formData, pan_number: e.target.value.toUpperCase()})}
              placeholder="ABCDE1234F"
              maxLength={10}
              className="font-mono uppercase"
              data-testid="pan-input"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-500">Gender</Label>
            <Select value={formData.gender} onValueChange={(v) => setFormData({...formData, gender: v})}>
              <SelectTrigger data-testid="gender-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-500">Mobile Number</Label>
            <div className="flex">
              <span className="inline-flex items-center px-3 text-sm text-slate-500 bg-slate-100 border border-r-0 border-slate-200 rounded-l-md">
                +91
              </span>
              <Input
                value={formData.mobile_number}
                onChange={(e) => setFormData({...formData, mobile_number: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                placeholder="9876543210"
                className="rounded-l-none"
                data-testid="mobile-input"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-medium text-slate-500">Email</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              placeholder="email@example.com"
              data-testid="email-input"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

// ==================== VEHICLES TAB ====================
const VehiclesTab = ({ lead, onUpdate }) => {
  const vehicles = lead?.vehicles || [];
  const [newCarNumber, setNewCarNumber] = useState('');
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [fetchingVaahan, setFetchingVaahan] = useState(null);
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [loanForm, setLoanForm] = useState({
    vehicle_valuation: '',
    required_loan_amount: '',
    expected_emi: '',
    expected_tenure_months: ''
  });
  
  const handleAddVehicle = async () => {
    if (!newCarNumber.trim()) {
      toast.error('Please enter a vehicle number');
      return;
    }
    
    setAddingVehicle(true);
    try {
      await loansApi.addVehicle(lead.id, { car_number: newCarNumber.trim().toUpperCase() });
      toast.success('Vehicle added successfully');
      setNewCarNumber('');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add vehicle');
    } finally {
      setAddingVehicle(false);
    }
  };
  
  const handleFetchVaahan = async (vehicleId) => {
    setFetchingVaahan(vehicleId);
    try {
      await loansApi.fetchVaahanForVehicle(lead.id, vehicleId);
      toast.success('Vehicle data refreshed');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to fetch data');
    } finally {
      setFetchingVaahan(null);
    }
  };
  
  const handleDeleteVehicle = async (vehicleId) => {
    if (!window.confirm('Remove this vehicle?')) return;
    try {
      await loansApi.deleteVehicle(lead.id, vehicleId);
      toast.success('Vehicle removed');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to remove');
    }
  };
  
  const handleEditLoan = (vehicle) => {
    setEditingVehicle(vehicle.vehicle_id);
    setLoanForm({
      vehicle_valuation: vehicle.vehicle_valuation || '',
      required_loan_amount: vehicle.required_loan_amount || '',
      expected_emi: vehicle.expected_emi || '',
      expected_tenure_months: vehicle.expected_tenure_months || ''
    });
  };
  
  const handleSaveLoan = async (vehicleId) => {
    try {
      await loansApi.updateVehicle(lead.id, vehicleId, {
        vehicle_valuation: parseFloat(loanForm.vehicle_valuation) || null,
        required_loan_amount: parseFloat(loanForm.required_loan_amount) || null,
        expected_emi: parseFloat(loanForm.expected_emi) || null,
        expected_tenure_months: parseInt(loanForm.expected_tenure_months) || null
      });
      toast.success('Loan details updated');
      setEditingVehicle(null);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update');
    }
  };

  const formatCurrency = (val) => val ? `₹${parseFloat(val).toLocaleString()}` : '—';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900">Vehicles</h3>
          <p className="text-sm text-slate-500">{vehicles.length} vehicle{vehicles.length !== 1 ? 's' : ''} added</p>
        </div>
      </div>

      {/* Add Vehicle */}
      <div className="p-4 bg-white rounded-xl border border-slate-200">
        <Label className="text-xs font-medium text-slate-500 mb-2 block">Add New Vehicle</Label>
        <div className="flex gap-2">
          <Input
            value={newCarNumber}
            onChange={(e) => setNewCarNumber(e.target.value.toUpperCase())}
            placeholder="Enter vehicle number (e.g., KA01AB1234)"
            className="flex-1 font-mono"
            data-testid="new-vehicle-input"
          />
          <Button 
            onClick={handleAddVehicle}
            disabled={addingVehicle}
            className="bg-[#2E3192] hover:bg-[#2E3192]/90"
            data-testid="add-vehicle-btn"
          >
            {addingVehicle ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
            Add
          </Button>
        </div>
      </div>

      {/* Vehicle Cards */}
      <div className="space-y-4">
        {vehicles.length === 0 ? (
          <div className="p-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <Car className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No vehicles added yet</p>
            <p className="text-sm text-slate-400">Add a vehicle number above to get started</p>
          </div>
        ) : (
          vehicles.map((vehicle) => (
            <div key={vehicle.vehicle_id} className="bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid={`vehicle-card-${vehicle.vehicle_id}`}>
              {/* Vehicle Header */}
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Car className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 font-mono">{vehicle.car_number}</p>
                    <p className="text-sm text-slate-500">
                      {[vehicle.car_make, vehicle.car_model].filter(Boolean).join(' ') || 'Vehicle details pending'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleFetchVaahan(vehicle.vehicle_id)}
                    disabled={fetchingVaahan === vehicle.vehicle_id}
                    className="h-8 w-8"
                    title="Refresh Vaahan data"
                    data-testid={`refresh-vaahan-${vehicle.vehicle_id}`}
                  >
                    <RefreshCw className={`h-4 w-4 ${fetchingVaahan === vehicle.vehicle_id ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeleteVehicle(vehicle.vehicle_id)}
                    className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                    title="Remove vehicle"
                    data-testid={`delete-vehicle-${vehicle.vehicle_id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Vehicle Content */}
              <div className="p-5 space-y-4">
                {/* Vaahan Data */}
                {vehicle.vaahan_data && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <p className="text-xs text-slate-400 uppercase">Owner</p>
                      <p className="text-sm font-medium text-slate-700 truncate">{vehicle.vaahan_data.owner_name || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase">Registration</p>
                      <p className="text-sm font-medium text-slate-700">{vehicle.vaahan_data.registration_date || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase">Insurance Until</p>
                      <p className="text-sm font-medium text-slate-700">{vehicle.vaahan_data.insurance_valid_upto || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-400 uppercase">Hypothecation</p>
                      <p className={`text-sm font-medium ${vehicle.vaahan_data.hypothecation_bank ? 'text-orange-600' : 'text-green-600'}`}>
                        {vehicle.vaahan_data.hypothecation_bank || 'None'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Loan Details */}
                <div className="pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Loan Requirements</p>
                    {editingVehicle !== vehicle.vehicle_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEditLoan(vehicle)}
                        className="h-7 text-xs text-blue-600"
                        data-testid={`edit-loan-${vehicle.vehicle_id}`}
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                    )}
                  </div>

                  {editingVehicle === vehicle.vehicle_id ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs text-slate-500">Vehicle Valuation (₹)</Label>
                          <Input
                            type="number"
                            value={loanForm.vehicle_valuation}
                            onChange={(e) => setLoanForm({...loanForm, vehicle_valuation: e.target.value})}
                            placeholder="500000"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Loan Required (₹)</Label>
                          <Input
                            type="number"
                            value={loanForm.required_loan_amount}
                            onChange={(e) => setLoanForm({...loanForm, required_loan_amount: e.target.value})}
                            placeholder="400000"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Expected EMI (₹)</Label>
                          <Input
                            type="number"
                            value={loanForm.expected_emi}
                            onChange={(e) => setLoanForm({...loanForm, expected_emi: e.target.value})}
                            placeholder="12000"
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-slate-500">Tenure (months)</Label>
                          <Input
                            type="number"
                            value={loanForm.expected_tenure_months}
                            onChange={(e) => setLoanForm({...loanForm, expected_tenure_months: e.target.value})}
                            placeholder="36"
                            className="mt-1"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditingVehicle(null)}>
                          Cancel
                        </Button>
                        <Button size="sm" onClick={() => handleSaveLoan(vehicle.vehicle_id)} className="bg-[#2E3192] hover:bg-[#2E3192]/90">
                          Save
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-400">Valuation</p>
                        <p className="text-sm font-semibold text-slate-800">{formatCurrency(vehicle.vehicle_valuation)}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-400">Loan Required</p>
                        <p className="text-sm font-semibold text-slate-800">{formatCurrency(vehicle.required_loan_amount)}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-400">Expected EMI</p>
                        <p className="text-sm font-semibold text-slate-800">{formatCurrency(vehicle.expected_emi)}</p>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-lg">
                        <p className="text-xs text-slate-400">Tenure</p>
                        <p className="text-sm font-semibold text-slate-800">{vehicle.expected_tenure_months ? `${vehicle.expected_tenure_months} months` : '—'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

// ==================== DOCUMENTS TAB ====================
const DocumentsTab = ({ lead, onUpdate }) => {
  const [requirements, setRequirements] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(null);
  const fileInputRef = useRef(null);
  const [currentDocType, setCurrentDocType] = useState(null);

  useEffect(() => {
    fetchRequirements();
  }, [lead?.id, lead?.customer_type]);

  const fetchRequirements = async () => {
    if (!lead?.id) return;
    setLoading(true);
    try {
      const res = await loansApi.getDocumentRequirements(lead.id);
      setRequirements(res.data);
    } catch (err) {
      console.error('Failed to fetch requirements:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileInputClick = (docType) => {
    setCurrentDocType(docType);
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !currentDocType) return;

    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload PDF, JPG, or PNG files only');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setUploadingDoc(currentDocType);
    try {
      const uploadUrlRes = await loansApi.generateUploadUrl(lead.id, {
        document_type: currentDocType,
        filename: file.name,
        content_type: file.type
      });

      const { upload_url, file_url } = uploadUrlRes.data;

      await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type }
      });

      await loansApi.uploadDocument(lead.id, {
        document_type: currentDocType,
        file_url: file_url,
        file_name: file.name
      });

      toast.success('Document uploaded');
      onUpdate();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(err.response?.data?.detail || 'Failed to upload');
    } finally {
      setUploadingDoc(null);
      setCurrentDocType(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Delete this document?')) return;
    setDeletingDoc(docId);
    try {
      await loansApi.deleteDocument(lead.id, docId);
      toast.success('Document deleted');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    } finally {
      setDeletingDoc(null);
    }
  };

  const docList = requirements?.requirements || [];
  const uploadedDocs = lead?.documents || [];
  const getUploadedDoc = (docType) => uploadedDocs.find(d => d.document_type === docType);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
      />

      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Documents</h3>
        <p className="text-sm text-slate-500">
          {uploadedDocs.length} of {docList.length} documents uploaded
        </p>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-600">Upload Progress</span>
          <span className="text-sm font-semibold text-[#2E3192]">
            {Math.round((uploadedDocs.length / Math.max(docList.length, 1)) * 100)}%
          </span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div 
            className="h-full bg-[#2E3192] rounded-full transition-all duration-500"
            style={{ width: `${(uploadedDocs.length / Math.max(docList.length, 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Document List */}
      <div className="space-y-2">
        {docList.map((doc) => {
          const uploaded = getUploadedDoc(doc.document_type);
          const isUploading = uploadingDoc === doc.document_type;

          return (
            <div
              key={doc.document_type}
              className={`p-4 bg-white rounded-xl border transition-all duration-200 ${
                uploaded 
                  ? 'border-green-200 bg-green-50/30' 
                  : 'border-slate-200 hover:border-slate-300'
              }`}
              data-testid={`doc-item-${doc.document_type}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    uploaded ? 'bg-green-100' : 'bg-slate-100'
                  }`}>
                    {uploaded ? (
                      <CheckCircle className="h-5 w-5 text-green-600" />
                    ) : (
                      <FileText className="h-5 w-5 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-slate-800">{doc.display_name || doc.name}</p>
                    <p className="text-xs text-slate-500">
                      {doc.description || (doc.required ? 'Required document' : 'Optional document')}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {uploaded ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(uploaded.file_url, '_blank')}
                        className="text-blue-600 hover:text-blue-700"
                        data-testid={`view-doc-${doc.document_type}`}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(uploaded.id)}
                        disabled={deletingDoc === uploaded.id}
                        className="text-red-500 hover:text-red-600"
                        data-testid={`delete-doc-${doc.document_type}`}
                      >
                        {deletingDoc === uploaded.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleFileInputClick(doc.document_type)}
                      disabled={isUploading}
                      className="bg-[#2E3192] hover:bg-[#2E3192]/90"
                      data-testid={`upload-doc-${doc.document_type}`}
                    >
                      {isUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Upload className="h-4 w-4 mr-1" />
                          Upload
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {docList.length === 0 && (
          <div className="p-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300">
            <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No document requirements</p>
            <p className="text-sm text-slate-400">Select a customer type to see required documents</p>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== MAIN MODAL ====================
const CustomerDetailsModal = ({ isOpen, onClose, lead, onUpdate }) => {
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    if (isOpen) {
      setActiveTab('info');
    }
  }, [isOpen]);

  if (!lead) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden bg-white" data-testid="customer-details-modal">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2E3192] to-[#6366F1] flex items-center justify-center">
                <User className="h-6 w-6 text-white" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold text-slate-900">
                  {lead.customer_name || 'Customer Details'}
                </DialogTitle>
                <p className="text-sm text-slate-500">{lead.customer_phone}</p>
              </div>
            </div>
            {lead.credit_score && (
              <div className="px-4 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
                <p className="text-xs text-emerald-600 font-medium">Credit Score</p>
                <p className="text-xl font-bold text-emerald-700">{lead.credit_score}</p>
              </div>
            )}
          </div>
        </DialogHeader>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <TabsList className="w-full justify-start border-b border-slate-200 bg-transparent p-0 h-auto rounded-none px-6">
            <TabsTrigger 
              value="info" 
              className="data-[state=active]:border-[#2E3192] data-[state=active]:text-[#2E3192] data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors bg-transparent"
              data-testid="tab-info"
            >
              <User className="h-4 w-4 mr-2" />
              Customer Info
            </TabsTrigger>
            <TabsTrigger 
              value="vehicles" 
              className="data-[state=active]:border-[#2E3192] data-[state=active]:text-[#2E3192] data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors bg-transparent"
              data-testid="tab-vehicles"
            >
              <Car className="h-4 w-4 mr-2" />
              Vehicles
              {lead.vehicles?.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                  {lead.vehicles.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger 
              value="documents" 
              className="data-[state=active]:border-[#2E3192] data-[state=active]:text-[#2E3192] data-[state=active]:shadow-none border-b-2 border-transparent rounded-none px-4 py-3 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors bg-transparent"
              data-testid="tab-documents"
            >
              <FileText className="h-4 w-4 mr-2" />
              Documents
              {lead.documents?.length > 0 && (
                <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                  {lead.documents.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 min-h-[400px] max-h-[60vh]">
            <TabsContent value="info" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <CustomerInfoTab lead={lead} onUpdate={onUpdate} />
            </TabsContent>
            <TabsContent value="vehicles" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <VehiclesTab lead={lead} onUpdate={onUpdate} />
            </TabsContent>
            <TabsContent value="documents" className="mt-0 focus-visible:outline-none focus-visible:ring-0">
              <DocumentsTab lead={lead} onUpdate={onUpdate} />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerDetailsModal;
