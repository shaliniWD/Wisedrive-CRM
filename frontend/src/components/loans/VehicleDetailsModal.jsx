// Vehicle Details Modal Component - Manages vehicles for loan consideration
import React, { useState, useEffect } from 'react';
import { loansApi } from '@/services/api';
import { toast } from 'sonner';
import {
  Car, CheckCircle, Plus, Trash2, RefreshCw, Upload, Loader2, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" data-testid="vehicle-details-modal">
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
                data-testid="new-car-number-input"
              />
              <Button onClick={handleAddVehicle} disabled={adding || addingWithVaahan} data-testid="add-vehicle-btn">
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
                <div key={vehicle.vehicle_id} className="p-4 rounded-xl border bg-white shadow-sm" data-testid={`vehicle-card-${idx}`}>
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

export default VehicleDetailsModal;
