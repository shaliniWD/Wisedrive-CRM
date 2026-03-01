// Vehicle Dropdown Component for loan leads table
import React from 'react';
import { Car, ChevronDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { formatCurrency } from './utils';

const VehicleDropdown = ({ vehicles, onManageClick }) => {
  if (!vehicles || vehicles.length === 0) {
    return (
      <Button size="sm" variant="outline" onClick={onManageClick} data-testid="add-vehicle-btn">
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
          <Button size="sm" variant="outline" className="max-w-[200px]" data-testid="vehicle-dropdown">
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
        <Button size="sm" variant="outline" data-testid="vehicles-dropdown">
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

export default VehicleDropdown;
