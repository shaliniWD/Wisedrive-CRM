import React, { useState, useEffect, useMemo } from 'react';
import { loansApi, inspectionsApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Users, Phone, MapPin, Calendar, RefreshCw, Search, Filter,
  FileText, Car, CreditCard, Building2, ChevronRight, Plus,
  CheckCircle, XCircle, Clock, AlertCircle, Upload, Eye,
  Trash2, ExternalLink, IndianRupee, Percent, X, Loader2,
  PhoneCall, PhoneOff, ArrowUpRight, ChevronDown, Info
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
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { formatDate, formatDateTime } from '@/utils/dateFormat';

// Status badge component
const StatusBadge = ({ status }) => {
  const config = {
    NEW: { color: 'bg-gray-100 text-gray-700', icon: Clock },
    INTERESTED: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
    NOT_INTERESTED: { color: 'bg-red-100 text-red-700', icon: XCircle },
    RNR: { color: 'bg-yellow-100 text-yellow-700', icon: PhoneOff },
    CALL_BACK: { color: 'bg-blue-100 text-blue-700', icon: PhoneCall },
    FOLLOW_UP: { color: 'bg-purple-100 text-purple-700', icon: Calendar },
  };
  
  const { color, icon: Icon } = config[status] || config.NEW;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {status?.replace(/_/g, ' ')}
    </span>
  );
};

// Application Status Badge
const AppStatusBadge = ({ status }) => {
  const config = {
    DRAFT: { color: 'bg-gray-100 text-gray-600' },
    APPLIED: { color: 'bg-blue-100 text-blue-700' },
    ACCEPTED_BY_BANK: { color: 'bg-cyan-100 text-cyan-700' },
    IN_PROCESS: { color: 'bg-yellow-100 text-yellow-700' },
    REJECTED_BY_BANK: { color: 'bg-red-100 text-red-700' },
    APPROVED_BY_BANK: { color: 'bg-green-100 text-green-700' },
    LOAN_DISBURSED: { color: 'bg-emerald-100 text-emerald-800' },
  };
  
  const { color } = config[status] || config.DRAFT;
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
};

// Format currency
const formatCurrency = (amount) => {
  if (!amount) return '₹ 0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

// Vehicle Dropdown Component for table column
const VehicleDropdown = ({ vehicles, onManageClick }) => {
  if (!vehicles || vehicles.length === 0) {
    return (
      <Button size="sm" variant="outline" onClick={onManageClick}>
        <Car className="h-3 w-3 mr-1" />
        Add
      </Button>
    );
  }

  if (vehicles.length === 1) {
    const v = vehicles[0];
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="max-w-[200px]">
            <Car className="h-3 w-3 mr-1" />
            <span className="truncate">{v.car_number}</span>
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-3 border-b bg-gray-50">
            <p className="font-semibold">{v.car_number}</p>
            <p className="text-sm text-gray-600">{v.car_make} {v.car_model} {v.car_year}</p>
          </div>
          <div className="p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Valuation:</span>
              <span className="font-medium">{formatCurrency(v.vehicle_valuation)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Required Amount:</span>
              <span className="font-medium">{formatCurrency(v.required_loan_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Expected EMI:</span>
              <span className="font-medium">{formatCurrency(v.expected_emi)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Interest Rate:</span>
              <span className="font-medium">{v.expected_interest_rate ? `${v.expected_interest_rate}%` : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tenure:</span>
              <span className="font-medium">{v.expected_tenure_months ? `${v.expected_tenure_months} months` : '-'}</span>
            </div>
          </div>
          <div className="p-2 border-t">
            <Button size="sm" variant="outline" className="w-full" onClick={onManageClick}>
              Manage Vehicles
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Multiple vehicles - show dropdown
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Car className="h-3 w-3 mr-1" />
          {vehicles.length} Cars
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <div className="p-2 border-b bg-gray-50">
          <p className="text-sm font-medium text-gray-700">{vehicles.length} Vehicles</p>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {vehicles.map((v, idx) => (
            <div key={v.vehicle_id} className={`p-3 ${idx > 0 ? 'border-t' : ''}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm">{v.car_number}</p>
                  <p className="text-xs text-gray-500">{v.car_make} {v.car_model} {v.car_year}</p>
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                  #{idx + 1}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Valuation:</span>
                  <span className="font-medium">{formatCurrency(v.vehicle_valuation)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Loan Amt:</span>
                  <span className="font-medium">{formatCurrency(v.required_loan_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">EMI:</span>
                  <span className="font-medium">{formatCurrency(v.expected_emi)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tenure:</span>
                  <span className="font-medium">{v.expected_tenure_months ? `${v.expected_tenure_months}m` : '-'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-2 border-t">
          <Button size="sm" variant="outline" className="w-full" onClick={onManageClick}>
            Manage Vehicles
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Documents Modal Component
const DocumentsModal = ({ isOpen, onClose, lead, onUpdate }) => {
  const [customerType, setCustomerType] = useState(lead?.customer_type || '');
  const [requirements, setRequirements] = useState(null);
  
  useEffect(() => {
    if (isOpen && lead?.id) {
      fetchRequirements();
    }
  }, [isOpen, lead?.id, customerType]);
  
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
  const isDocUploaded = (docType) => uploadedDocs.some(d => d.document_type === docType);
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Customer Documents
          </DialogTitle>
          <DialogDescription>
            {lead?.customer_name} - {lead?.customer_phone}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Customer Type Selection */}
          <div>
            <Label className="text-sm font-medium mb-2 block">Customer Type</Label>
            <div className="flex gap-3">
              <button
                onClick={() => handleCustomerTypeChange('SALARIED')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  customerType === 'SALARIED' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-center">
                  <Building2 className={`h-8 w-8 mx-auto mb-2 ${customerType === 'SALARIED' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <p className="font-medium">Salaried</p>
                  <p className="text-xs text-gray-500">Working professional</p>
                </div>
              </button>
              <button
                onClick={() => handleCustomerTypeChange('SELF_EMPLOYED')}
                className={`flex-1 p-4 rounded-xl border-2 transition-all ${
                  customerType === 'SELF_EMPLOYED' ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-center">
                  <Users className={`h-8 w-8 mx-auto mb-2 ${customerType === 'SELF_EMPLOYED' ? 'text-blue-600' : 'text-gray-400'}`} />
                  <p className="font-medium">Self Employed</p>
                  <p className="text-xs text-gray-500">Business owner</p>
                </div>
              </button>
            </div>
          </div>
          
          {/* Document Checklist */}
          {customerType && (
            <div>
              <Label className="text-sm font-medium mb-3 block">Required Documents</Label>
              <div className="space-y-2">
                {getDocList().map((doc, idx) => (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3 rounded-lg border ${
                      isDocUploaded(doc.document_type) ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {isDocUploaded(doc.document_type) ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-gray-300" />
                      )}
                      <div>
                        <p className="text-sm font-medium">{doc.display_name}</p>
                        {doc.description && <p className="text-xs text-gray-500">{doc.description}</p>}
                      </div>
                      {doc.required && <span className="text-xs text-red-500">*Required</span>}
                    </div>
                    <Button size="sm" variant={isDocUploaded(doc.document_type) ? 'outline' : 'default'} className="h-8">
                      <Upload className="h-3 w-3 mr-1" />
                      {isDocUploaded(doc.document_type) ? 'Replace' : 'Upload'}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Enhanced Vehicle Details Modal with Vaahan data display
const VehicleDetailsModal = ({ isOpen, onClose, lead, onUpdate }) => {
  const [vehicles, setVehicles] = useState(lead?.vehicles || []);
  const [newCarNumber, setNewCarNumber] = useState('');
  const [adding, setAdding] = useState(false);
  const [fetchingVaahan, setFetchingVaahan] = useState(null);
  const [newVehicleVaahanData, setNewVehicleVaahanData] = useState(null);
  const [addingWithVaahan, setAddingWithVaahan] = useState(false);
  
  useEffect(() => {
    if (lead) {
      setVehicles(lead.vehicles || []);
    }
  }, [lead]);
  
  // Fetch Vaahan data when car number is entered (with debounce effect)
  const handleCarNumberChange = (value) => {
    setNewCarNumber(value.toUpperCase());
    setNewVehicleVaahanData(null);
  };
  
  const handleFetchVaahanForNew = async () => {
    if (!newCarNumber || newCarNumber.length < 8) {
      toast.error('Please enter a valid vehicle number');
      return;
    }
    
    setAddingWithVaahan(true);
    try {
      // First add the vehicle
      const res = await loansApi.addVehicle(lead.id, { car_number: newCarNumber });
      if (res.data?.vehicle) {
        // The backend already fetches Vaahan data when adding
        setNewVehicleVaahanData(res.data.vehicle.vaahan_data);
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
      setNewVehicleVaahanData(null);
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
      const res = await loansApi.fetchVaahanForVehicle(lead.id, vehicleId);
      if (res.data.success) {
        toast.success('Vehicle data fetched from Vaahan');
        onUpdate();
      } else {
        toast.error(res.data.error || 'Vaahan API error');
      }
    } catch (err) {
      toast.error('Failed to fetch Vaahan data');
    } finally {
      setFetchingVaahan(null);
    }
  };
  
  const handleUpdateVehicle = async (vehicleId, data) => {
    try {
      await loansApi.updateVehicle(lead.id, vehicleId, data);
      onUpdate();
    } catch (err) {
      toast.error('Failed to update vehicle');
    }
  };
  
  const handleRemoveVehicle = async (vehicleId) => {
    if (!confirm('Remove this vehicle?')) return;
    try {
      await loansApi.removeVehicle(lead.id, vehicleId);
      toast.success('Vehicle removed');
      onUpdate();
    } catch (err) {
      toast.error('Failed to remove vehicle');
    }
  };
  
  const customerInspections = lead?.customer_inspections || [];
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-blue-600" />
            Vehicle Details for Loan
          </DialogTitle>
          <DialogDescription>
            {lead?.customer_name} - Manage vehicles for loan consideration
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Add from Inspections */}
          {customerInspections.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Vehicles from Inspections</Label>
              <div className="grid gap-2">
                {customerInspections.map((insp) => {
                  const alreadyAdded = vehicles.some(v => v.car_number === insp.car_number);
                  return (
                    <div
                      key={insp.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        alreadyAdded ? 'bg-green-50 border-green-200' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Car className={`h-5 w-5 ${alreadyAdded ? 'text-green-600' : 'text-gray-400'}`} />
                        <div>
                          <p className="font-medium">{insp.car_number || 'No number'}</p>
                          <p className="text-xs text-gray-500">
                            {insp.vehicle_make} {insp.vehicle_model} {insp.vehicle_year}
                          </p>
                        </div>
                      </div>
                      {alreadyAdded ? (
                        <span className="text-xs text-green-600 font-medium">Added</span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => loansApi.addVehicle(lead.id, {
                            car_number: insp.car_number,
                            car_make: insp.vehicle_make,
                            car_model: insp.vehicle_model,
                            car_year: insp.vehicle_year,
                            vehicle_valuation: insp.market_price_research?.market_average,
                            inspection_id: insp.id
                          }).then(() => { toast.success('Vehicle added'); onUpdate(); })}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Add New Vehicle with Vaahan Integration */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <Label className="text-sm font-medium mb-2 block">Add New Vehicle</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter vehicle number (e.g., KA01AB1234)"
                value={newCarNumber}
                onChange={(e) => handleCarNumberChange(e.target.value)}
                className="flex-1 bg-white"
              />
              <Button onClick={handleAddVehicle} disabled={adding || addingWithVaahan}>
                {adding || addingWithVaahan ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    Add & Fetch Vaahan
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              <Info className="h-3 w-3 inline mr-1" />
              Vehicle details will be automatically fetched from Vaahan API
            </p>
          </div>
          
          {/* Vehicles List with Details */}
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Vehicles for Loan ({vehicles.length})
            </Label>
            <div className="space-y-4">
              {vehicles.map((vehicle, idx) => (
                <div key={vehicle.vehicle_id} className="p-4 rounded-xl border bg-white shadow-sm">
                  {/* Vehicle Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Car className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-lg">{vehicle.car_number}</p>
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">#{idx + 1}</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {vehicle.car_make} {vehicle.car_model} {vehicle.car_year}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleFetchVaahan(vehicle.vehicle_id)}
                        disabled={fetchingVaahan === vehicle.vehicle_id}
                      >
                        {fetchingVaahan === vehicle.vehicle_id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Refresh Vaahan
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => handleRemoveVehicle(vehicle.vehicle_id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Vaahan Data Display */}
                  {vehicle.vaahan_data && (
                    <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Vaahan API Data
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {vehicle.vaahan_data.manufacturer && (
                          <div>
                            <span className="text-gray-500">Manufacturer:</span>
                            <span className="ml-1 font-medium">{vehicle.vaahan_data.manufacturer}</span>
                          </div>
                        )}
                        {vehicle.vaahan_data.model && (
                          <div>
                            <span className="text-gray-500">Model:</span>
                            <span className="ml-1 font-medium">{vehicle.vaahan_data.model}</span>
                          </div>
                        )}
                        {vehicle.vaahan_data.fuel_type && (
                          <div>
                            <span className="text-gray-500">Fuel:</span>
                            <span className="ml-1 font-medium">{vehicle.vaahan_data.fuel_type}</span>
                          </div>
                        )}
                        {vehicle.vaahan_data.owner_count && (
                          <div>
                            <span className="text-gray-500">Owners:</span>
                            <span className="ml-1 font-medium">{vehicle.vaahan_data.owner_count}</span>
                          </div>
                        )}
                        {vehicle.vaahan_data.registration_date && (
                          <div>
                            <span className="text-gray-500">Reg Date:</span>
                            <span className="ml-1 font-medium">{vehicle.vaahan_data.registration_date}</span>
                          </div>
                        )}
                        {vehicle.vaahan_data.insurance_valid_upto && (
                          <div>
                            <span className="text-gray-500">Insurance:</span>
                            <span className="ml-1 font-medium">{vehicle.vaahan_data.insurance_valid_upto}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Loan Details Form */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs text-gray-500">Vehicle Valuation</Label>
                      <Input
                        type="number"
                        placeholder="₹ 0"
                        value={vehicle.vehicle_valuation || ''}
                        onChange={(e) => handleUpdateVehicle(vehicle.vehicle_id, { vehicle_valuation: parseFloat(e.target.value) || 0 })}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Required Loan Amount</Label>
                      <Input
                        type="number"
                        placeholder="₹ 0"
                        value={vehicle.required_loan_amount || ''}
                        onChange={(e) => handleUpdateVehicle(vehicle.vehicle_id, { required_loan_amount: parseFloat(e.target.value) || 0 })}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Expected EMI</Label>
                      <Input
                        type="number"
                        placeholder="₹ 0"
                        value={vehicle.expected_emi || ''}
                        onChange={(e) => handleUpdateVehicle(vehicle.vehicle_id, { expected_emi: parseFloat(e.target.value) || 0 })}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Interest Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="0%"
                        value={vehicle.expected_interest_rate || ''}
                        onChange={(e) => handleUpdateVehicle(vehicle.vehicle_id, { expected_interest_rate: parseFloat(e.target.value) || 0 })}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Tenure (months)</Label>
                      <Input
                        type="number"
                        placeholder="60"
                        value={vehicle.expected_tenure_months || ''}
                        onChange={(e) => handleUpdateVehicle(vehicle.vehicle_id, { expected_tenure_months: parseInt(e.target.value) || 0 })}
                        className="h-9"
                      />
                    </div>
                  </div>
                  
                  {/* Document Uploads */}
                  <div className="mt-4 pt-4 border-t flex gap-2">
                    <Button size="sm" variant="outline" className="h-8">
                      <Upload className="h-3 w-3 mr-1" />
                      RC Card {vehicle.rc_card_url && <CheckCircle className="h-3 w-3 ml-1 text-green-600" />}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8">
                      <Upload className="h-3 w-3 mr-1" />
                      Insurance {vehicle.insurance_doc_url && <CheckCircle className="h-3 w-3 ml-1 text-green-600" />}
                    </Button>
                  </div>
                </div>
              ))}
              
              {vehicles.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Car className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No vehicles added yet</p>
                  <p className="text-sm">Add vehicles from inspections or enter a new vehicle number</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Enhanced Loan Processing Modal - Vehicle-wise eligibility
const LoanProcessingModal = ({ isOpen, onClose, lead, onUpdate }) => {
  const [checking, setChecking] = useState(null);
  const [vehicleEligibility, setVehicleEligibility] = useState({});
  const [applying, setApplying] = useState(null);
  
  const vehicles = lead?.vehicles || [];
  const applications = lead?.applications || [];
  
  const handleCheckEligibility = async (vehicleId) => {
    const vehicle = vehicles.find(v => v.vehicle_id === vehicleId);
    if (!vehicle?.vehicle_valuation) {
      toast.error('Please set vehicle valuation first');
      return;
    }
    
    setChecking(vehicleId);
    try {
      const res = await loansApi.checkEligibility(lead.id, vehicleId);
      setVehicleEligibility(prev => ({
        ...prev,
        [vehicleId]: res.data.results || []
      }));
      toast.success(`Checked ${res.data.eligible_banks} eligible banks`);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to check eligibility');
    } finally {
      setChecking(null);
    }
  };
  
  const handleApplyLoan = async (vehicleId, bankId) => {
    setApplying(`${vehicleId}-${bankId}`);
    try {
      await loansApi.createApplication(lead.id, {
        vehicle_loan_id: vehicleId,
        bank_id: bankId
      });
      toast.success('Loan application submitted');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit application');
    } finally {
      setApplying(null);
    }
  };
  
  const getVehicleApplications = (vehicleId) => {
    return applications.filter(a => a.vehicle_loan_id === vehicleId);
  };
  
  const hasAppliedToBank = (vehicleId, bankId) => {
    return applications.some(a => a.vehicle_loan_id === vehicleId && a.bank_id === bankId);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Loan Processing - Vehicle Wise Eligibility
          </DialogTitle>
          <DialogDescription>
            {lead?.customer_name} - Check bank eligibility and apply for loans per vehicle
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {vehicles.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Car className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">No vehicles added</p>
              <p className="text-sm">Please add vehicles first to check loan eligibility</p>
            </div>
          ) : (
            vehicles.map((vehicle, idx) => {
              const eligibilityResults = vehicleEligibility[vehicle.vehicle_id] || [];
              const vehicleApps = getVehicleApplications(vehicle.vehicle_id);
              
              return (
                <div key={vehicle.vehicle_id} className="border rounded-xl overflow-hidden">
                  {/* Vehicle Header */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white border flex items-center justify-center">
                          <Car className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{vehicle.car_number}</h3>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              Vehicle #{idx + 1}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {vehicle.car_make} {vehicle.car_model} {vehicle.car_year}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Valuation</p>
                        <p className="text-xl font-bold text-gray-900">
                          {formatCurrency(vehicle.vehicle_valuation)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Vehicle Loan Summary */}
                    <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-gray-500 text-xs">Loan Amount</p>
                        <p className="font-semibold">{formatCurrency(vehicle.required_loan_amount)}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-gray-500 text-xs">Expected EMI</p>
                        <p className="font-semibold">{formatCurrency(vehicle.expected_emi)}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-gray-500 text-xs">Interest Rate</p>
                        <p className="font-semibold">{vehicle.expected_interest_rate ? `${vehicle.expected_interest_rate}%` : '-'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-gray-500 text-xs">Tenure</p>
                        <p className="font-semibold">{vehicle.expected_tenure_months ? `${vehicle.expected_tenure_months} months` : '-'}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Check Eligibility Button */}
                  <div className="p-4 bg-gray-50 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Bank Eligibility Check</p>
                        <p className="text-sm text-gray-500">
                          {eligibilityResults.length > 0 
                            ? `${eligibilityResults.filter(r => r.is_eligible).length} of ${eligibilityResults.length} banks eligible`
                            : 'Check eligibility with all partner banks'
                          }
                        </p>
                      </div>
                      <Button
                        onClick={() => handleCheckEligibility(vehicle.vehicle_id)}
                        disabled={checking === vehicle.vehicle_id || !vehicle.vehicle_valuation}
                      >
                        {checking === vehicle.vehicle_id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        {eligibilityResults.length > 0 ? 'Re-check Eligibility' : 'Check Eligibility'}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Existing Applications for this vehicle */}
                  {vehicleApps.length > 0 && (
                    <div className="p-4 border-b">
                      <p className="text-sm font-medium text-gray-700 mb-2">Active Applications</p>
                      <div className="flex flex-wrap gap-2">
                        {vehicleApps.map((app) => (
                          <div key={app.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            <span className="text-sm font-medium">{app.bank_name}</span>
                            <AppStatusBadge status={app.status} />
                            {app.approved_amount && (
                              <span className="text-xs text-green-600">{formatCurrency(app.approved_amount)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Eligibility Results Table */}
                  {eligibilityResults.length > 0 && (
                    <div className="p-4">
                      <p className="text-sm font-medium text-gray-700 mb-3">Bank Eligibility Results</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="text-left p-3 font-medium">Bank</th>
                              <th className="text-center p-3 font-medium">Status</th>
                              <th className="text-right p-3 font-medium">Interest</th>
                              <th className="text-right p-3 font-medium">Max Amount (80% LTV)</th>
                              <th className="text-right p-3 font-medium">EMI</th>
                              <th className="text-right p-3 font-medium">Tenure</th>
                              <th className="text-right p-3 font-medium">Processing Fee</th>
                              <th className="text-center p-3 font-medium">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {eligibilityResults.map((result) => (
                              <tr key={result.bank_id} className={result.is_eligible ? 'bg-green-50/50' : 'bg-red-50/30'}>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-gray-400" />
                                    <div>
                                      <p className="font-medium">{result.bank_name}</p>
                                      <p className="text-xs text-gray-500">{result.bank_code}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  {result.is_eligible ? (
                                    <span className="inline-flex items-center gap-1 text-green-600">
                                      <CheckCircle className="h-4 w-4" /> Eligible
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-red-600" title={result.rejection_reason}>
                                      <XCircle className="h-4 w-4" /> Not Eligible
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-right font-medium">
                                  {result.interest_rate ? `${result.interest_rate}%` : '-'}
                                </td>
                                <td className="p-3 text-right font-medium text-blue-600">
                                  {result.max_loan_amount ? formatCurrency(result.max_loan_amount) : '-'}
                                </td>
                                <td className="p-3 text-right font-medium">
                                  {result.emi_amount ? formatCurrency(result.emi_amount) : '-'}
                                </td>
                                <td className="p-3 text-right">
                                  {result.tenure_months ? `${result.tenure_months} mo` : '-'}
                                </td>
                                <td className="p-3 text-right">
                                  {result.processing_fee ? formatCurrency(result.processing_fee) : '-'}
                                </td>
                                <td className="p-3 text-center">
                                  {result.is_eligible && !hasAppliedToBank(vehicle.vehicle_id, result.bank_id) ? (
                                    <Button
                                      size="sm"
                                      onClick={() => handleApplyLoan(vehicle.vehicle_id, result.bank_id)}
                                      disabled={applying === `${vehicle.vehicle_id}-${result.bank_id}`}
                                    >
                                      {applying === `${vehicle.vehicle_id}-${result.bank_id}` ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        'Apply'
                                      )}
                                    </Button>
                                  ) : hasAppliedToBank(vehicle.vehicle_id, result.bank_id) ? (
                                    <span className="text-xs text-blue-600 font-medium">Applied</span>
                                  ) : (
                                    <span className="text-xs text-gray-400">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Main Loans Page Component
export default function LoansPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(0);
  const pageSize = 20;
  
  // Modals
  const [selectedLead, setSelectedLead] = useState(null);
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [processingModalOpen, setProcessingModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  
  // Status update
  const [statusNotes, setStatusNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  useEffect(() => {
    fetchLeads();
    fetchStats();
  }, [statusFilter, page]);
  
  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = { skip: page * pageSize, limit: pageSize };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;
      
      const res = await loansApi.getAll(params);
      setLeads(res.data.items || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      toast.error('Failed to fetch loan leads');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchStats = async () => {
    try {
      const res = await loansApi.getStats();
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };
  
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await loansApi.syncCustomers();
      toast.success(res.data.message);
      fetchLeads();
      fetchStats();
    } catch (err) {
      toast.error('Failed to sync customers');
    } finally {
      setSyncing(false);
    }
  };
  
  const handleSearch = () => {
    setPage(0);
    fetchLeads();
  };
  
  const handleStatusUpdate = async (newStatus) => {
    if (!selectedLead) return;
    
    setUpdatingStatus(true);
    try {
      await loansApi.update(selectedLead.id, {
        status: newStatus,
        status_notes: statusNotes || null
      });
      toast.success('Status updated');
      setStatusModalOpen(false);
      setStatusNotes('');
      fetchLeads();
      fetchStats();
    } catch (err) {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };
  
  const openLeadDetails = async (leadId) => {
    try {
      const res = await loansApi.getById(leadId);
      setSelectedLead(res.data);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch lead details');
      return null;
    }
  };
  
  const refreshSelectedLead = async () => {
    if (selectedLead) {
      await openLeadDetails(selectedLead.id);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50/50 p-6" data-testid="loans-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loans</h1>
          <p className="text-sm text-gray-500 mt-1">Used car loan management for inspection customers</p>
        </div>
        <Button onClick={handleSync} disabled={syncing}>
          {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Sync Customers
        </Button>
      </div>
      
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase">Total Leads</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total_leads}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase">Interested</p>
            <p className="text-2xl font-bold text-green-600">{stats.leads_by_status?.INTERESTED || 0}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase">Follow Up</p>
            <p className="text-2xl font-bold text-purple-600">{stats.leads_by_status?.FOLLOW_UP || 0}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase">Call Back</p>
            <p className="text-2xl font-bold text-blue-600">{stats.leads_by_status?.CALL_BACK || 0}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase">Not Interested</p>
            <p className="text-2xl font-bold text-red-600">{stats.leads_by_status?.NOT_INTERESTED || 0}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase">Active Banks</p>
            <p className="text-2xl font-bold text-gray-700">{stats.active_banks}</p>
          </div>
        </div>
      )}
      
      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="NEW">New</SelectItem>
              <SelectItem value="INTERESTED">Interested</SelectItem>
              <SelectItem value="NOT_INTERESTED">Not Interested</SelectItem>
              <SelectItem value="RNR">RNR</SelectItem>
              <SelectItem value="CALL_BACK">Call Back</SelectItem>
              <SelectItem value="FOLLOW_UP">Follow Up</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleSearch}>
            <Filter className="h-4 w-4 mr-2" />
            Apply Filters
          </Button>
        </div>
      </div>
      
      {/* Leads Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-20">
            <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 text-lg">No loan leads found</p>
            <p className="text-gray-400 text-sm mt-1">Click "Sync Customers" to import from inspections</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left p-4 font-medium text-gray-600">Date/Time</th>
                  <th className="text-left p-4 font-medium text-gray-600">Customer</th>
                  <th className="text-left p-4 font-medium text-gray-600">City</th>
                  <th className="text-left p-4 font-medium text-gray-600">Status</th>
                  <th className="text-center p-4 font-medium text-gray-600">Documents</th>
                  <th className="text-center p-4 font-medium text-gray-600">Vehicles</th>
                  <th className="text-center p-4 font-medium text-gray-600">Credit Score</th>
                  <th className="text-center p-4 font-medium text-gray-600">Loan Processing</th>
                  <th className="text-center p-4 font-medium text-gray-600">Loan Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <p className="text-sm font-medium">{formatDate(lead.created_at)}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(lead.created_at)?.split(',')[1]}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-gray-900">{lead.customer_name}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {lead.customer_phone}
                      </p>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-gray-600">{lead.city_name || '-'}</span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={async () => {
                          const fullLead = await openLeadDetails(lead.id);
                          if (fullLead) setStatusModalOpen(true);
                        }}
                        className="hover:opacity-80 transition-opacity"
                      >
                        <StatusBadge status={lead.status} />
                      </button>
                      {lead.status_notes && (
                        <p className="text-xs text-gray-500 mt-1 max-w-[150px] truncate" title={lead.status_notes}>
                          {lead.status_notes}
                        </p>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const fullLead = await openLeadDetails(lead.id);
                          if (fullLead) setDocumentsModalOpen(true);
                        }}
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        {lead.documents?.length || 0}
                      </Button>
                    </td>
                    <td className="p-4 text-center">
                      <VehicleDropdown
                        vehicles={lead.vehicles}
                        onManageClick={async () => {
                          const fullLead = await openLeadDetails(lead.id);
                          if (fullLead) setVehicleModalOpen(true);
                        }}
                      />
                    </td>
                    <td className="p-4 text-center">
                      <span className="text-gray-400">-</span>
                    </td>
                    <td className="p-4 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const fullLead = await openLeadDetails(lead.id);
                          if (fullLead) setProcessingModalOpen(true);
                        }}
                        disabled={!lead.vehicles?.length}
                      >
                        <CreditCard className="h-3 w-3 mr-1" />
                        Check
                      </Button>
                    </td>
                    <td className="p-4 text-center">
                      {lead.applications?.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {lead.applications.slice(0, 2).map((app, i) => (
                            <AppStatusBadge key={i} status={app.status} />
                          ))}
                          {lead.applications.length > 2 && (
                            <span className="text-xs text-gray-500">+{lead.applications.length - 2} more</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        {total > pageSize && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-gray-500">
              Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= total} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* Status Update Modal */}
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Lead Status</DialogTitle>
            <DialogDescription>
              {selectedLead?.customer_name} - {selectedLead?.customer_phone}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-2">
              {['NEW', 'INTERESTED', 'NOT_INTERESTED', 'RNR', 'CALL_BACK', 'FOLLOW_UP'].map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusUpdate(status)}
                  disabled={updatingStatus}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    selectedLead?.status === status
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {status.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            
            <div>
              <Label className="text-sm font-medium">Notes</Label>
              <Input
                placeholder="Add notes about this status change..."
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Documents Modal */}
      <DocumentsModal
        isOpen={documentsModalOpen}
        onClose={() => setDocumentsModalOpen(false)}
        lead={selectedLead}
        onUpdate={refreshSelectedLead}
      />
      
      {/* Vehicle Details Modal */}
      <VehicleDetailsModal
        isOpen={vehicleModalOpen}
        onClose={() => setVehicleModalOpen(false)}
        lead={selectedLead}
        onUpdate={refreshSelectedLead}
      />
      
      {/* Loan Processing Modal */}
      <LoanProcessingModal
        isOpen={processingModalOpen}
        onClose={() => setProcessingModalOpen(false)}
        lead={selectedLead}
        onUpdate={refreshSelectedLead}
      />
    </div>
  );
}
