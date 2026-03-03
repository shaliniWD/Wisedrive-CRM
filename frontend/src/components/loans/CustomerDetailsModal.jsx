// Customer Details Modal Component - Combined Vehicles & Documents
import React, { useState, useEffect, useRef } from 'react';
import { loansApi } from '@/services/api';
import { toast } from 'sonner';
import {
  Car, FileText, CheckCircle, Plus, Trash2, RefreshCw, Upload, 
  Loader2, Info, Users, Building2, AlertCircle, ExternalLink, Eye,
  User, CreditCard, Phone, Mail, MapPin, Calendar, Edit, Save, X
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

  useEffect(() => {
    if (lead) {
      const nameParts = (lead.customer_name || '').split(' ');
      // Get mobile from customer_phone, clean it up
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
    setSaving(true);
    try {
      await loansApi.update(lead.id, {
        credit_first_name: formData.first_name,
        credit_last_name: formData.last_name,
        pan_number: formData.pan_number,
        customer_phone: formData.mobile_number ? `+91${formData.mobile_number}` : '',
        email: formData.email,
        gender: formData.gender
      });
      toast.success('Customer info saved');
      onUpdate();
    } catch (err) {
      toast.error('Failed to save customer info');
    } finally {
      setSaving(false);
    }
  };

  // Check if PAN is missing (required for credit reports)
  const isPanMissing = !formData.pan_number || formData.pan_number.length !== 10;

  return (
    <div className="space-y-4">
      {/* Customer Name & Phone - Read Only Info */}
      <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
        <div className="flex justify-between items-center">
          <div>
            <p className="text-xs text-slate-500">Lead Customer</p>
            <p className="font-semibold text-slate-900">{lead?.customer_name || 'Unknown'}</p>
            <p className="text-sm text-slate-600">{lead?.customer_phone || 'No phone'}</p>
          </div>
          {lead?.city_name && (
            <div className="text-right">
              <p className="text-xs text-slate-500">City</p>
              <p className="text-sm font-medium text-slate-700">{lead.city_name}</p>
            </div>
          )}
        </div>
      </div>

      <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-xs text-blue-700">
          <Info className="h-3 w-3 inline mr-1" />
          Add PAN number to fetch credit reports from CIBIL, Equifax, Experian & CRIF
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">First Name *</Label>
          <Input
            value={formData.first_name}
            onChange={(e) => setFormData({...formData, first_name: e.target.value})}
            placeholder="First name"
            className="h-9"
            data-testid="customer-first-name"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Last Name</Label>
          <Input
            value={formData.last_name}
            onChange={(e) => setFormData({...formData, last_name: e.target.value})}
            placeholder="Last name"
            className="h-9"
            data-testid="customer-last-name"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">PAN Number *</Label>
          <Input
            value={formData.pan_number}
            onChange={(e) => setFormData({...formData, pan_number: e.target.value.toUpperCase()})}
            placeholder="ABCDE1234F"
            maxLength={10}
            className={`h-9 uppercase font-mono ${isPanMissing ? 'border-amber-400' : 'border-green-400'}`}
            data-testid="customer-pan"
          />
          {isPanMissing && <p className="text-[10px] text-amber-600">Required for credit reports</p>}
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Gender *</Label>
          <Select value={formData.gender} onValueChange={(val) => setFormData({...formData, gender: val})}>
            <SelectTrigger className="h-9" data-testid="customer-gender">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Mobile Number *</Label>
          <div className="flex">
            <span className="inline-flex items-center px-2 bg-gray-100 border border-r-0 border-gray-200 rounded-l text-gray-500 text-xs">+91</span>
            <Input
              value={formData.mobile_number}
              onChange={(e) => setFormData({...formData, mobile_number: e.target.value.replace(/\D/g, '')})}
              placeholder="9876543210"
              maxLength={10}
              className="h-9 rounded-l-none font-mono"
              data-testid="customer-mobile"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Email</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            placeholder="email@example.com"
            className="h-9"
            data-testid="customer-email"
          />
        </div>
      </div>

      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full"
        data-testid="save-customer-info-btn"
      >
        {saving ? (
          <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving...</>
        ) : (
          'Save Customer Info'
        )}
      </Button>
    </div>
  );
};

// ==================== VEHICLES TAB ====================
const VehiclesTab = ({ lead, onUpdate }) => {
  const [vehicles, setVehicles] = useState(lead?.vehicles || []);
  const [newCarNumber, setNewCarNumber] = useState('');
  const [adding, setAdding] = useState(false);
  const [fetchingVaahan, setFetchingVaahan] = useState(null);
  const [addingWithVaahan, setAddingWithVaahan] = useState(false);
  const [editingLoanDetails, setEditingLoanDetails] = useState(null);
  const [loanForm, setLoanForm] = useState({
    vehicle_valuation: '',
    required_loan_amount: '',
    expected_emi: '',
    expected_tenure_months: ''
  });
  
  useEffect(() => {
    if (lead) {
      setVehicles(lead.vehicles || []);
    }
  }, [lead]);
  
  const handleCarNumberChange = (value) => {
    setNewCarNumber(value.toUpperCase());
  };
  
  const handleFetchVaahanForNew = async () => {
    if (!newCarNumber || newCarNumber.length < 8) {
      toast.error('Please enter a valid vehicle number');
      return;
    }
    
    setAddingWithVaahan(true);
    try {
      const res = await loansApi.addVehicle(lead.id, { car_number: newCarNumber });
      if (res.data?.vehicle) {
        toast.success('Vehicle added with Vaahan data');
        setNewCarNumber('');
        onUpdate();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add vehicle');
    } finally {
      setAddingWithVaahan(false);
    }
  };
  
  const handleAddVehicle = async () => {
    if (!newCarNumber.trim()) {
      toast.error('Please enter a vehicle number');
      return;
    }
    
    setAdding(true);
    try {
      await loansApi.addVehicle(lead.id, { car_number: newCarNumber });
      toast.success('Vehicle added');
      setNewCarNumber('');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add vehicle');
    } finally {
      setAdding(false);
    }
  };
  
  const handleFetchVaahan = async (vehicleId) => {
    setFetchingVaahan(vehicleId);
    try {
      await loansApi.fetchVaahanForVehicle(lead.id, vehicleId);
      toast.success('Vehicle data updated from Vaahan');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to fetch Vaahan data');
    } finally {
      setFetchingVaahan(null);
    }
  };
  
  const handleDeleteVehicle = async (vehicleId) => {
    if (!confirm('Are you sure you want to remove this vehicle?')) return;
    
    try {
      await loansApi.removeVehicle(lead.id, vehicleId);
      toast.success('Vehicle removed');
      onUpdate();
    } catch (err) {
      toast.error('Failed to remove vehicle');
    }
  };
  
  const handleSetPrimary = async (vehicleId) => {
    try {
      await loansApi.updateVehicle(lead.id, vehicleId, { is_primary: true });
      toast.success('Primary vehicle updated');
      onUpdate();
    } catch (err) {
      toast.error('Failed to set primary vehicle');
    }
  };
  
  const handleEditLoanDetails = (vehicle) => {
    setEditingLoanDetails(vehicle.vehicle_id);
    setLoanForm({
      vehicle_valuation: vehicle.vehicle_valuation || '',
      required_loan_amount: vehicle.required_loan_amount || '',
      expected_emi: vehicle.expected_emi || '',
      expected_tenure_months: vehicle.expected_tenure_months || ''
    });
  };
  
  const handleSaveLoanDetails = async (vehicleId) => {
    try {
      await loansApi.updateVehicle(lead.id, vehicleId, {
        vehicle_valuation: parseFloat(loanForm.vehicle_valuation) || null,
        required_loan_amount: parseFloat(loanForm.required_loan_amount) || null,
        expected_emi: parseFloat(loanForm.expected_emi) || null,
        expected_tenure_months: parseInt(loanForm.expected_tenure_months) || null
      });
      toast.success('Loan details updated');
      setEditingLoanDetails(null);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to update loan details');
    }
  };
  
  const formatCurrency = (val) => {
    if (!val) return '—';
    return `₹${parseFloat(val).toLocaleString()}`;
  };

  return (
    <div className="space-y-4">
      {/* Add Vehicle */}
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <Label className="text-xs text-gray-500">Vehicle Number</Label>
          <Input
            placeholder="e.g., KA01AB1234"
            value={newCarNumber}
            onChange={(e) => handleCarNumberChange(e.target.value)}
            className="mt-1"
          />
        </div>
        <Button
          onClick={handleFetchVaahanForNew}
          disabled={addingWithVaahan || !newCarNumber}
          size="sm"
        >
          {addingWithVaahan ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Plus className="h-4 w-4 mr-1" />
              Add & Fetch
            </>
          )}
        </Button>
      </div>
      
      {/* Vehicles List */}
      <div className="space-y-3 max-h-[350px] overflow-y-auto">
        {vehicles.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Car className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No vehicles added yet</p>
          </div>
        ) : (
          vehicles.map((vehicle) => (
            <div
              key={vehicle.vehicle_id}
              className={`p-3 rounded-lg border ${
                vehicle.is_primary ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm">{vehicle.car_number}</span>
                    {vehicle.is_primary && (
                      <span className="text-[10px] bg-blue-500 text-white px-1.5 py-0.5 rounded">PRIMARY</span>
                    )}
                  </div>
                  {vehicle.car_make && (
                    <p className="text-sm text-gray-600 mt-1">
                      {vehicle.car_make} {vehicle.car_model} {vehicle.car_year ? `(${vehicle.car_year})` : ''}
                    </p>
                  )}
                  {vehicle.fuel_type && (
                    <p className="text-xs text-gray-500">{vehicle.fuel_type}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {!vehicle.is_primary && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleSetPrimary(vehicle.vehicle_id)}
                      className="text-xs h-7"
                    >
                      Set Primary
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleFetchVaahan(vehicle.vehicle_id)}
                    disabled={fetchingVaahan === vehicle.vehicle_id}
                    className="h-7 w-7"
                    title="Refresh Vaahan Data"
                  >
                    {fetchingVaahan === vehicle.vehicle_id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => handleDeleteVehicle(vehicle.vehicle_id)}
                    className="h-7 w-7 text-red-500 hover:text-red-700"
                    title="Remove Vehicle"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              {/* Vaahan Data */}
              {vehicle.vaahan_data && (
                <div className="mt-2 pt-2 border-t border-gray-100 grid grid-cols-2 gap-1 text-xs text-gray-500">
                  {vehicle.vaahan_data.owner_name && (
                    <span>Owner: {vehicle.vaahan_data.owner_name}</span>
                  )}
                  {vehicle.vaahan_data.registration_date && (
                    <span>Reg: {vehicle.vaahan_data.registration_date}</span>
                  )}
                  {vehicle.vaahan_data.insurance_valid_upto && (
                    <span>Insurance: {vehicle.vaahan_data.insurance_valid_upto}</span>
                  )}
                  {vehicle.vaahan_data.hypothecation_bank && (
                    <span className="text-orange-600">HP: {vehicle.vaahan_data.hypothecation_bank}</span>
                  )}
                </div>
              )}
              
              {/* Loan Details Section */}
              <div className="mt-2 pt-2 border-t border-gray-100">
                {editingLoanDetails === vehicle.vehicle_id ? (
                  // Edit Mode
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-gray-500">Vehicle Valuation (₹)</Label>
                        <Input
                          type="number"
                          placeholder="e.g., 500000"
                          value={loanForm.vehicle_valuation}
                          onChange={(e) => setLoanForm({...loanForm, vehicle_valuation: e.target.value})}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-gray-500">Required Loan (₹)</Label>
                        <Input
                          type="number"
                          placeholder="e.g., 400000"
                          value={loanForm.required_loan_amount}
                          onChange={(e) => setLoanForm({...loanForm, required_loan_amount: e.target.value})}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-gray-500">Expected EMI (₹)</Label>
                        <Input
                          type="number"
                          placeholder="e.g., 12000"
                          value={loanForm.expected_emi}
                          onChange={(e) => setLoanForm({...loanForm, expected_emi: e.target.value})}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label className="text-[10px] text-gray-500">Tenure (months)</Label>
                        <Input
                          type="number"
                          placeholder="e.g., 36"
                          value={loanForm.expected_tenure_months}
                          onChange={(e) => setLoanForm({...loanForm, expected_tenure_months: e.target.value})}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => setEditingLoanDetails(null)} className="h-7 text-xs">
                        Cancel
                      </Button>
                      <Button size="sm" onClick={() => handleSaveLoanDetails(vehicle.vehicle_id)} className="h-7 text-xs">
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  // Display Mode
                  <div className="flex items-start justify-between">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div>
                        <span className="text-gray-400">Valuation:</span>{' '}
                        <span className="font-medium text-gray-700">{formatCurrency(vehicle.vehicle_valuation)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Loan Required:</span>{' '}
                        <span className="font-medium text-gray-700">{formatCurrency(vehicle.required_loan_amount)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Expected EMI:</span>{' '}
                        <span className="font-medium text-gray-700">{formatCurrency(vehicle.expected_emi)}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">Tenure:</span>{' '}
                        <span className="font-medium text-gray-700">
                          {vehicle.expected_tenure_months ? `${vehicle.expected_tenure_months} months` : '—'}
                        </span>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEditLoanDetails(vehicle)}
                      className="h-6 text-xs text-blue-600"
                    >
                      <Edit className="h-3 w-3 mr-1" />
                      Edit
                    </Button>
                  </div>
                )}
              </div>
              
              {/* Loan Details Section */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-medium text-gray-700">Loan Details</h4>
                  {editingLoanDetails === vehicle.vehicle_id ? (
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleSaveLoanDetails(vehicle.vehicle_id)}
                        className="h-6 w-6 text-green-600"
                        title="Save"
                      >
                        <Save className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingLoanDetails(null)}
                        className="h-6 w-6 text-gray-500"
                        title="Cancel"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEditLoanDetails(vehicle)}
                      className="h-6 w-6 text-blue-600"
                      title="Edit Loan Details"
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                
                {editingLoanDetails === vehicle.vehicle_id ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-gray-500">Vehicle Valuation</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={loanForm.vehicle_valuation}
                        onChange={(e) => setLoanForm({...loanForm, vehicle_valuation: e.target.value})}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-gray-500">Required Loan</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={loanForm.required_loan_amount}
                        onChange={(e) => setLoanForm({...loanForm, required_loan_amount: e.target.value})}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-gray-500">Expected EMI</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={loanForm.expected_emi}
                        onChange={(e) => setLoanForm({...loanForm, expected_emi: e.target.value})}
                        className="h-7 text-xs"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-gray-500">Tenure (months)</Label>
                      <Input
                        type="number"
                        placeholder="0"
                        value={loanForm.expected_tenure_months}
                        onChange={(e) => setLoanForm({...loanForm, expected_tenure_months: e.target.value})}
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">Valuation:</span>
                      <span className="ml-1 font-medium">{formatCurrency(vehicle.vehicle_valuation)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Loan Amount:</span>
                      <span className="ml-1 font-medium">{formatCurrency(vehicle.required_loan_amount)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Expected EMI:</span>
                      <span className="ml-1 font-medium">{formatCurrency(vehicle.expected_emi)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Tenure:</span>
                      <span className="ml-1 font-medium">
                        {vehicle.expected_tenure_months ? `${vehicle.expected_tenure_months} months` : '—'}
                      </span>
                    </div>
                  </div>
                )}
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
  const [customerType, setCustomerType] = useState(lead?.customer_type || '');
  const [requirements, setRequirements] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(null);
  const fileInputRef = useRef(null);
  const [selectedDocType, setSelectedDocType] = useState(null);
  
  useEffect(() => {
    if (lead?.id) {
      setCustomerType(lead?.customer_type || '');
      fetchRequirements();
    }
  }, [lead?.id]);
  
  useEffect(() => {
    if (customerType) {
      fetchRequirements();
    }
  }, [customerType]);
  
  const fetchRequirements = async () => {
    try {
      const res = await loansApi.getDocumentRequirements(lead.id);
      setRequirements(res.data);
    } catch (err) {
      console.error('Error fetching requirements:', err);
    }
  };
  
  const handleCustomerTypeChange = async (type) => {
    setCustomerType(type);
    try {
      await loansApi.update(lead.id, { customer_type: type });
      toast.success('Customer type updated');
      onUpdate();
    } catch (err) {
      toast.error('Failed to update customer type');
    }
  };
  
  const getDocList = () => {
    if (!requirements) return [];
    // API returns requirements array directly with document_type and display_name
    return requirements.requirements || [];
  };
  
  const uploadedDocs = lead?.documents || [];
  const getUploadedDoc = (docType) => uploadedDocs.find(d => d.document_type === docType);
  const isDocUploaded = (docType) => uploadedDocs.some(d => d.document_type === docType);
  
  const handleFileSelect = async (docType, file) => {
    if (!file) return;
    
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload PDF, JPG, or PNG files only');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }
    
    setUploadingDoc(docType);
    try {
      // Step 1: Generate a signed upload URL
      const uploadUrlRes = await loansApi.generateUploadUrl(lead.id, {
        document_type: docType,
        filename: file.name,
        content_type: file.type
      });
      
      const { upload_url, file_url } = uploadUrlRes.data;
      
      // Step 2: Upload file to storage
      await fetch(upload_url, {
        method: 'PUT',
        body: file,
        headers: {
          'Content-Type': file.type
        }
      });
      
      // Step 3: Save document metadata
      await loansApi.uploadDocument(lead.id, {
        document_type: docType,
        file_url: file_url,
        file_name: file.name
      });
      
      toast.success('Document uploaded successfully');
      onUpdate();
    } catch (err) {
      console.error('Upload error:', err);
      toast.error(err.response?.data?.detail || 'Failed to upload document');
    } finally {
      setUploadingDoc(null);
    }
  };
  
  const handleDelete = async (docId) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    setDeletingDoc(docId);
    try {
      await loansApi.deleteDocument(lead.id, docId);
      toast.success('Document deleted');
      onUpdate();
    } catch (err) {
      toast.error('Failed to delete document');
    } finally {
      setDeletingDoc(null);
    }
  };
  
  const handleFileInputClick = (docType) => {
    setSelectedDocType(docType);
    fileInputRef.current?.click();
  };
  
  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file && selectedDocType) {
      handleFileSelect(selectedDocType, file);
    }
    e.target.value = '';
    setSelectedDocType(null);
  };

  return (
    <div className="space-y-4">
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleFileInputChange}
      />
      
      {/* Customer Type Selection */}
      <div>
        <Label className="text-xs text-gray-500 mb-2 block">Customer Type</Label>
        <div className="flex gap-2">
          <Button
            variant={customerType === 'SALARIED' ? 'default' : 'outline'}
            onClick={() => handleCustomerTypeChange('SALARIED')}
            size="sm"
            className="flex-1"
          >
            <Users className="h-4 w-4 mr-1" />
            Salaried
          </Button>
          <Button
            variant={customerType === 'SELF_EMPLOYED' ? 'default' : 'outline'}
            onClick={() => handleCustomerTypeChange('SELF_EMPLOYED')}
            size="sm"
            className="flex-1"
          >
            <Building2 className="h-4 w-4 mr-1" />
            Self Employed
          </Button>
        </div>
      </div>
      
      {/* Document List */}
      {!customerType ? (
        <div className="text-center py-6 text-gray-500">
          <FileText className="h-10 w-10 mx-auto mb-2 opacity-50" />
          <p>Select customer type to see required documents</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[320px] overflow-y-auto">
          {getDocList().map((doc) => {
            const uploaded = getUploadedDoc(doc.document_type);
            const isUploading = uploadingDoc === doc.document_type;
            
            return (
              <div
                key={doc.document_type}
                className={`p-3 rounded-lg border ${
                  uploaded ? 'border-green-200 bg-green-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {uploaded ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-gray-400" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{doc.display_name || doc.name}</p>
                      {doc.description && (
                        <p className="text-[10px] text-gray-500">{doc.description}</p>
                      )}
                      {doc.required && (
                        <span className="text-[10px] text-red-500">Required</span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    {uploaded ? (
                      <>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => window.open(uploaded.file_url, '_blank')}
                          className="h-7 w-7"
                          title="View"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleDelete(uploaded.id)}
                          disabled={deletingDoc === uploaded.id}
                          className="h-7 w-7 text-red-500"
                          title="Delete"
                        >
                          {deletingDoc === uploaded.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Trash2 className="h-3 w-3" />
                          )}
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleFileInputClick(doc.document_type)}
                        disabled={isUploading}
                        className="h-7 text-xs"
                      >
                        {isUploading ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Upload className="h-3 w-3 mr-1" />
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
        </div>
      )}
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
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Customer Details</DialogTitle>
          <DialogDescription>
            {lead.customer_name} - {lead.customer_phone}
          </DialogDescription>
        </DialogHeader>
        
        {/* Tabs */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('info')}
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'info'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            data-testid="tab-customer-info"
          >
            <User className="h-4 w-4 inline mr-1" />
            Customer Info
          </button>
          <button
            onClick={() => setActiveTab('vehicles')}
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'vehicles'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            data-testid="tab-vehicles"
          >
            <Car className="h-4 w-4 inline mr-1" />
            Vehicles ({lead.vehicles?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('documents')}
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'documents'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            data-testid="tab-documents"
          >
            <FileText className="h-4 w-4 inline mr-1" />
            Documents ({lead.documents?.length || 0})
          </button>
        </div>
        
        {/* Tab Content */}
        <div className="py-2">
          {activeTab === 'info' ? (
            <CustomerInfoTab lead={lead} onUpdate={onUpdate} />
          ) : activeTab === 'vehicles' ? (
            <VehiclesTab lead={lead} onUpdate={onUpdate} />
          ) : (
            <DocumentsTab lead={lead} onUpdate={onUpdate} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerDetailsModal;
