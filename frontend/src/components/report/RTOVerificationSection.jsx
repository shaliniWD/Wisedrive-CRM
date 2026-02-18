import React from 'react';
import { useEditMode } from '@/contexts/EditModeContext';
import { Badge } from '@/components/ui/badge';
import { 
  ShieldCheck, 
  Banknote,
  Building2,
  FileWarning,
  CheckCircle2,
  AlertTriangle
} from 'lucide-react';

export function RTOVerificationSection({ data }) {
  const { isEditMode } = useEditMode();
  
  // Handle missing data gracefully
  if (!data) {
    return (
      <section className="px-4 md:px-0 mt-4 md:mt-6">
        <div className="mobile-card md:rounded-2xl">
          <div className="mobile-card-header flex items-center gap-2">
            <div className="p-1.5 md:p-2 rounded-lg bg-muted/50">
              <ShieldCheck className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
            </div>
            <h2 className="font-semibold font-display text-base md:text-lg">RTO Verification</h2>
          </div>
          <div className="mobile-card-body text-center py-6">
            <p className="text-sm text-muted-foreground">RTO verification data not available</p>
          </div>
        </div>
      </section>
    );
  }
  
  const trafficChallans = data.trafficChallans || 0;
  const hypothecation = data.hypothecation || false;
  const blacklistStatus = data.blacklistStatus || false;
  const bankNOC = data.bankNOC || 'Not Available';
  const financierName = data.financierName || '';
  
  const allClear = !hypothecation && !blacklistStatus && trafficChallans === 0;

  const items = [
    { 
      icon: Banknote, 
      label: 'Traffic Challans', 
      value: `₹${trafficChallans}`,
      isGood: trafficChallans === 0
    },
    { 
      icon: Building2, 
      label: 'Hypothecation', 
      value: hypothecation ? 'Yes' : 'No',
      isGood: !hypothecation,
      subtext: hypothecation ? `Financier: ${financierName}` : null
    },
    { 
      icon: FileWarning, 
      label: 'Blacklist', 
      value: blacklistStatus ? 'Yes' : 'No',
      isGood: !blacklistStatus
    },
    { 
      icon: CheckCircle2, 
      label: 'Bank NOC', 
      value: bankNOC,
      isGood: bankNOC === 'Not Required'
    }
  ];

  return (
    <section className="px-4 md:px-0 mt-4 md:mt-6">
      <div className="mobile-card md:rounded-2xl">
        <div className="mobile-card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 md:p-2 rounded-lg bg-success/10">
              <ShieldCheck className="h-4 w-4 md:h-5 md:w-5 text-success" />
            </div>
            <h2 className="font-semibold font-display text-base md:text-lg">RTO Verification</h2>
          </div>
          {allClear ? (
            <Badge className="bg-success/10 text-success border-0 text-xs">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              All Clear
            </Badge>
          ) : (
            <Badge className="bg-warning/10 text-warning border-0 text-xs">
              <AlertTriangle className="h-3 w-3 mr-1" />
              Action Needed
            </Badge>
          )}
        </div>
        
        <div className="mobile-card-body">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {items.map((item, index) => (
              <div 
                key={index}
                className="flex items-start gap-2 p-3 md:p-4 rounded-xl bg-secondary/30"
              >
                <div className={`p-2 rounded-lg flex-shrink-0 ${item.isGood ? 'bg-success/10' : 'bg-destructive/10'}`}>
                  <item.icon className={`h-4 w-4 ${item.isGood ? 'text-success' : 'text-destructive'}`} />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] md:text-xs text-muted-foreground">{item.label}</p>
                  <p className={`text-sm font-semibold ${item.isGood ? 'text-success' : 'text-destructive'} ${isEditMode ? 'border border-dashed border-yellow-500 rounded px-1' : ''}`}>
                    {item.value}
                  </p>
                  {item.subtext && (
                    <p className={`text-[10px] text-muted-foreground mt-1 ${isEditMode ? 'border border-dashed border-yellow-500 rounded px-1' : ''}`}>
                      {item.subtext}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default RTOVerificationSection;
