import React, { useState } from 'react';
import { useEditMode } from '@/contexts/EditModeContext';
import { 
  Car, 
  ChevronDown,
  Calendar, 
  Fuel, 
  Settings, 
  Hash, 
  Palette,
  User
} from 'lucide-react';

const InfoRow = ({ label, value, isEditMode }) => (
  <div className="flex justify-between items-center py-2.5 border-b border-border last:border-b-0">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className={`text-sm font-medium text-right max-w-[60%] truncate ${isEditMode ? 'border border-dashed border-yellow-500 rounded px-2 py-0.5' : ''}`}>
      {value || 'N/A'}
    </span>
  </div>
);

export function VehicleDetailsSection({ data }) {
  const { isEditMode } = useEditMode();
  const [isExpanded, setIsExpanded] = useState(false);

  const primaryInfo = [
    { label: 'Make', value: data.make },
    { label: 'Model', value: data.model },
    { label: 'Year', value: data.year },
    { label: 'Fuel', value: data.fuel },
    { label: 'Transmission', value: data.transmission },
  ];

  const secondaryInfo = [
    { label: 'Mfg. Date', value: data.mfgDate },
    { label: 'Reg. Number', value: data.regNo },
    { label: 'Reg. Date', value: data.regDate },
    { label: 'Colour', value: data.colour },
    { label: 'Engine CC', value: data.engineCC + ' cc' },
    { label: 'Engine No.', value: data.engineNo },
    { label: 'Chassis No.', value: data.chassisNo },
  ];

  return (
    <section className="px-4 md:px-0 mt-4 md:mt-6">
      <div className="mobile-card md:rounded-2xl">
        <button 
          className="w-full mobile-card-header flex items-center justify-between"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 md:p-2 rounded-lg bg-accent/10">
              <Car className="h-4 w-4 md:h-5 md:w-5 text-accent" />
            </div>
            <h2 className="font-semibold font-display text-base md:text-lg">Vehicle Details</h2>
          </div>
          <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
        </button>
        
        <div className="mobile-card-body pt-0">
          {/* Always visible primary info */}
          {primaryInfo.map((item, index) => (
            <InfoRow key={index} {...item} isEditMode={isEditMode} />
          ))}
          
          {/* Collapsible secondary info */}
          {isExpanded && secondaryInfo.map((item, index) => (
            <InfoRow key={`sec-${index}`} {...item} isEditMode={isEditMode} />
          ))}
          
          {!isExpanded && (
            <button 
              className="w-full py-2 text-xs text-accent hover:text-accent/80 transition-colors"
              onClick={() => setIsExpanded(true)}
            >
              Show more details...
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export default VehicleDetailsSection;
