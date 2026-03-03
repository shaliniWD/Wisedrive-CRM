// Customer Details Modal Component - Combined Vehicles & Documents
import React, { useState, useEffect, useRef } from 'react';
import { loansApi } from '@/services/api';
import { toast } from 'sonner';
import {
  Car, FileText, CheckCircle, Plus, Trash2, RefreshCw, Upload, 
  Loader2, Info, Users, Building2, AlertCircle, ExternalLink, Eye,
  User, CreditCard, Phone, Mail, MapPin, Calendar
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
    dob: '',
    mobile_number: '',
    email: '',
    gender: 'male',
    pin_code: ''
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (lead) {
      const nameParts = (lead.customer_name || '').split(' ');
      setFormData({
        first_name: lead.credit_first_name || nameParts[0] || '',
        last_name: lead.credit_last_name || nameParts.slice(1).join(' ') || '',
        pan_number: lead.pan_number || '',
        dob: lead.dob || '',
        mobile_number: (lead.customer_phone || '').replace('+91', '').replace(/\D/g, ''),
        email: lead.customer_email || lead.email || '',
        gender: lead.gender || 'male',
        pin_code: lead.pin_code || ''
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
        dob: formData.dob,
        email: formData.email,
        gender: formData.gender,
        pin_code: formData.pin_code
      });
      toast.success('Customer info saved');
      onUpdate();
    } catch (err) {
      toast.error('Failed to save customer info');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
        <p className="text-xs text-blue-700">
          <Info className="h-3 w-3 inline mr-1" />
          This information is used to fetch credit reports from bureaus
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
          <Label className="text-xs text-gray-500">Last Name *</Label>
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
            className="h-9 uppercase font-mono"
            data-testid="customer-pan"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-gray-500">Date of Birth *</Label>
          <Input
            value={formData.dob}
            onChange={(e) => setFormData({...formData, dob: e.target.value.replace(/\D/g, '')})}
            placeholder="YYYYMMDD"
            maxLength={8}
            className="h-9 font-mono"
            data-testid="customer-dob"
          />
          <p className="text-[10px] text-gray-400">Format: YYYYMMDD</p>
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
          <Label className="text-xs text-gray-500">Email *</Label>
          <Input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            placeholder="email@example.com"
            className="h-9"
            data-testid="customer-email"
          />
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
          <Label className="text-xs text-gray-500">PIN Code *</Label>
          <Input
            value={formData.pin_code}
            onChange={(e) => setFormData({...formData, pin_code: e.target.value.replace(/\D/g, '')})}
            placeholder="560001"
            maxLength={6}
            className="h-9 font-mono"
            data-testid="customer-pincode"
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
      await loansApi.deleteVehicle(lead.id, vehicleId);
      toast.success('Vehicle removed');
      onUpdate();
    } catch (err) {
      toast.error('Failed to remove vehicle');
    }
  };
  
  const handleSetPrimary = async (vehicleId) => {
    try {
      await loansApi.setPrimaryVehicle(lead.id, vehicleId);
      toast.success('Primary vehicle updated');
      onUpdate();
    } catch (err) {
      toast.error('Failed to set primary vehicle');
    }
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
    if (customerType === 'SALARIED') {
      return requirements.requirements?.SALARIED || requirements.requirements || [];
    } else if (customerType === 'SELF_EMPLOYED') {
      return requirements.requirements?.SELF_EMPLOYED || requirements.requirements || [];
    }
    return [];
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
      await loansApi.uploadDocument(lead.id, docType, file);
      toast.success('Document uploaded successfully');
      onUpdate();
    } catch (err) {
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
            const uploaded = getUploadedDoc(doc.id);
            const isUploading = uploadingDoc === doc.id;
            
            return (
              <div
                key={doc.id}
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
                      <p className="text-sm font-medium">{doc.name}</p>
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
                        onClick={() => handleFileInputClick(doc.id)}
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
  const [activeTab, setActiveTab] = useState('vehicles');
  
  useEffect(() => {
    if (isOpen) {
      setActiveTab('vehicles');
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
            onClick={() => setActiveTab('vehicles')}
            className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'vehicles'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
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
          >
            <FileText className="h-4 w-4 inline mr-1" />
            Documents ({lead.documents?.length || 0})
          </button>
        </div>
        
        {/* Tab Content */}
        <div className="py-2">
          {activeTab === 'vehicles' ? (
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
