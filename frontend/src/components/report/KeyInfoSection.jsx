import React, { useState } from 'react';
import { useEditMode } from '@/contexts/EditModeContext';
import { InsuranceModal, TyreModal, RepairsModal } from './MediaModal';
import { 
  Key,
  Gauge, 
  Settings, 
  Sofa, 
  Car, 
  Shield, 
  AlertTriangle,
  Droplets,
  CircleDot,
  Wrench,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronRight,
  Info
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/data/inspectionData';

const StatusBadge = ({ status }) => {
  const getStatusStyle = () => {
    const s = status ? status.toLowerCase() : '';
    if (s === 'good' || s === 'no') return 'status-good';
    if (s === 'average') return 'status-average';
    if (s === 'poor' || s === 'expired' || s === 'yes') return 'status-poor';
    return 'bg-muted text-muted-foreground';
  };

  const getLabel = () => {
    const s = status ? status.toLowerCase() : '';
    if (s === 'good') return 'Good';
    if (s === 'average') return 'Average';
    if (s === 'poor') return 'Poor';
    if (s === 'expired') return 'Expired';
    if (s === 'yes') return 'Yes';
    if (s === 'no') return 'No';
    return status;
  };

  return (
    <span className={`status-badge ${getStatusStyle()}`}>
      {getLabel()}
    </span>
  );
};

const KeyInfoItem = ({ icon: Icon, label, value, status, isBoolean, isCurrency, isPercentage, onClick, hasModal }) => {
  const { isEditMode } = useEditMode();
  
  const getDisplayValue = () => {
    if (isBoolean) return value ? 'Yes' : 'No';
    if (isCurrency) return formatCurrency(value);
    if (typeof value === 'number' && !isPercentage) return formatNumber(value);
    return value;
  };

  const content = (
    <div className={`flex items-center gap-3 p-3 md:p-4 bg-secondary/30 rounded-xl transition-all ${hasModal ? 'cursor-pointer hover:bg-secondary/50' : ''}`}>
      <div className="p-2 rounded-lg bg-card border border-border flex-shrink-0">
        <Icon className="h-4 w-4 md:h-5 md:w-5 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] md:text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
        {status ? (
          <StatusBadge status={status} />
        ) : isPercentage ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{value}%</span>
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full ${value >= 70 ? 'bg-success' : value >= 40 ? 'bg-warning' : 'bg-destructive'}`}
                style={{ width: `${value}%` }}
              />
            </div>
          </div>
        ) : (
          <p className={`text-sm font-semibold truncate ${isEditMode && !hasModal ? 'border border-dashed border-yellow-500 rounded px-1' : ''}`}>
            {getDisplayValue()}
          </p>
        )}
      </div>
      {hasModal && (
        <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      )}
    </div>
  );

  if (onClick && hasModal) {
    return <button className="w-full text-left" onClick={onClick}>{content}</button>;
  }
  
  return content;
};

export function KeyInfoSection({ data }) {
  const { isEditMode } = useEditMode();
  const [insuranceModal, setInsuranceModal] = useState(false);
  const [tyreModal, setTyreModal] = useState(false);
  const [minorRepairsModal, setMinorRepairsModal] = useState(false);
  const [majorRepairsModal, setMajorRepairsModal] = useState(false);

  const getConditionStatus = (condition) => {
    const c = condition ? condition.toLowerCase() : '';
    if (c === 'good') return 'good';
    if (c === 'average') return 'average';
    return 'poor';
  };

  // Safely access repairs array
  const repairs = data?.repairs || [];
  const minorTotal = repairs.filter(r => r.type === 'minor').reduce((sum, r) => sum + (r.cost || 0), 0);
  const majorTotal = repairs.filter(r => r.type === 'major').reduce((sum, r) => sum + (r.cost || 0), 0);

  // Safely access other data
  const insurance = data?.insurance || {};
  const tyreDetails = data?.tyreDetails || { avgLife: 0, tyres: [] };

  return (
    <section className="px-4 md:px-0 mt-4 md:mt-6">
      <div className="mobile-card md:rounded-2xl">
        <div className="mobile-card-header flex items-center gap-2">
          <div className="p-1.5 md:p-2 rounded-lg bg-accent/10">
            <Key className="h-4 w-4 md:h-5 md:w-5 text-accent" />
          </div>
          <h2 className="font-semibold font-display text-base md:text-lg">Key Information</h2>
        </div>
        
        <div className="mobile-card-body">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
            <KeyInfoItem icon={Gauge} label="KMs Driven" value={data?.kmsDriven || 0} />
            <KeyInfoItem icon={Settings} label="Engine" status={getConditionStatus(data?.engineCondition)} />
            <KeyInfoItem icon={Sofa} label="Interior" status={getConditionStatus(data?.interiorCondition)} />
            <KeyInfoItem icon={Car} label="Exterior" status={getConditionStatus(data?.exteriorCondition)} />
            
            {/* Insurance with Modal */}
            <KeyInfoItem 
              icon={Shield} 
              label="Insurance" 
              status={insurance.status === 'Expired' ? 'expired' : 'good'}
              hasModal={true}
              onClick={() => setInsuranceModal(true)}
            />
            
            <KeyInfoItem icon={AlertTriangle} label="Accident" status={data?.accident ? 'yes' : 'no'} />
            <KeyInfoItem icon={Droplets} label="Flood Damage" status={data?.floodDamage ? 'yes' : 'no'} />
            
            {/* Tyre Life with Modal */}
            <KeyInfoItem 
              icon={CircleDot} 
              label="Tyre Life" 
              value={tyreDetails.avgLife || 0} 
              isPercentage={true}
              hasModal={true}
              onClick={() => setTyreModal(true)}
            />
            
            {/* Minor Repairs with Modal */}
            <KeyInfoItem 
              icon={Wrench} 
              label="Minor Repairs" 
              value={minorTotal}
              isCurrency={true}
              hasModal={true}
              onClick={() => setMinorRepairsModal(true)}
            />
            
            {/* Major Repairs with Modal */}
            <KeyInfoItem 
              icon={Wrench} 
              label="Major Repairs" 
              value={majorTotal}
              isCurrency={true}
              hasModal={true}
              onClick={() => setMajorRepairsModal(true)}
            />
          </div>
        </div>
      </div>
      
      {/* Modals */}
      <InsuranceModal 
        isOpen={insuranceModal} 
        onClose={() => setInsuranceModal(false)} 
        insurance={insurance}
        isEditMode={isEditMode}
      />
      <TyreModal 
        isOpen={tyreModal} 
        onClose={() => setTyreModal(false)} 
        tyreDetails={tyreDetails}
        isEditMode={isEditMode}
      />
      <RepairsModal 
        isOpen={minorRepairsModal} 
        onClose={() => setMinorRepairsModal(false)} 
        repairs={repairs}
        type="minor"
        isEditMode={isEditMode}
      />
      <RepairsModal 
        isOpen={majorRepairsModal} 
        onClose={() => setMajorRepairsModal(false)} 
        repairs={repairs}
        type="major"
        isEditMode={isEditMode}
      />
    </section>
  );
}

export default KeyInfoSection;
