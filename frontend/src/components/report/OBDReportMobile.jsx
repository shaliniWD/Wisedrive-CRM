import React, { useState } from 'react';
import { useEditMode } from '@/contexts/EditModeContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Cpu,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  AlertCircle,
  Info,
  Settings,
  Shield,
  Cog,
  Snowflake,
  Wrench,
  CheckCircle2
} from 'lucide-react';
import { getSeverityColor } from '@/data/inspectionData';

const iconMap = {
  Shield: Shield,
  Settings: Settings,
  Cog: Cog,
  Snowflake: Snowflake
};

const SeverityIcon = ({ severity }) => {
  if (severity === 'critical') return <AlertTriangle className="h-4 w-4 text-destructive" />;
  if (severity === 'warning') return <AlertCircle className="h-4 w-4 text-warning" />;
  return <Info className="h-4 w-4 text-info" />;
};

const FaultCard = ({ fault, isEditMode }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const getSeverityClass = () => {
    if (fault.severity === 'critical') return 'obd-error-critical';
    if (fault.severity === 'warning') return 'obd-error-warning';
    return 'obd-error-info';
  };

  return (
    <div className={`obd-error-card ${getSeverityClass()}`}>
      <button 
        className="w-full flex items-start justify-between text-left"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-3 flex-1">
          <SeverityIcon severity={fault.severity} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-sm font-bold">{fault.code}</span>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {fault.status}
              </Badge>
            </div>
            <p className={`text-sm text-muted-foreground mt-1 ${isEditMode ? 'edit-field' : ''}`}>
              {fault.description}
            </p>
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
        )}
      </button>
      
      {isExpanded && (
        <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
          {/* Possible Causes */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Possible Causes
            </p>
            <ul className="space-y-1">
              {fault.possibleCauses.map((cause, idx) => (
                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-warning">•</span>
                  <span className={isEditMode ? 'edit-field' : ''}>{cause}</span>
                </li>
              ))}
            </ul>
          </div>
          
          {/* Symptoms */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
              <Info className="h-3 w-3" /> Symptoms
            </p>
            <ul className="space-y-1">
              {fault.symptoms.map((symptom, idx) => (
                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-info">•</span>
                  {symptom}
                </li>
              ))}
            </ul>
          </div>
          
          {/* Solutions */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
              <Wrench className="h-3 w-3" /> Solutions
            </p>
            <ul className="space-y-1">
              {fault.solutions.map((solution, idx) => (
                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-2">
                  <span className="text-success">{idx + 1}.</span>
                  <span className={isEditMode ? 'edit-field' : ''}>{solution}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

const SystemGroup = ({ system, isEditMode }) => {
  const [isExpanded, setIsExpanded] = useState(system.faults.some(f => f.severity === 'critical'));
  const Icon = iconMap[system.icon] || Settings;
  
  const criticalCount = system.faults.filter(f => f.severity === 'critical').length;
  const warningCount = system.faults.filter(f => f.severity === 'warning').length;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button 
        className="w-full p-3 flex items-center justify-between bg-secondary/30"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-card border border-border">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="text-left">
            <p className="font-medium text-sm">{system.name}</p>
            <div className="flex items-center gap-2 mt-0.5">
              {criticalCount > 0 && (
                <span className="text-[10px] text-destructive">{criticalCount} Critical</span>
              )}
              {warningCount > 0 && (
                <span className="text-[10px] text-warning">{warningCount} Warning</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">
            {system.errorCount}
          </Badge>
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>
      
      {isExpanded && (
        <div className="p-3 space-y-2 bg-card">
          {system.faults.map((fault, idx) => (
            <FaultCard key={idx} fault={fault} isEditMode={isEditMode} />
          ))}
        </div>
      )}
    </div>
  );
};

export function OBDReportMobile({ data }) {
  const { isEditMode } = useEditMode();
  
  // Handle missing or malformed data gracefully
  if (!data || !data.systems) {
    return (
      <section className="px-4 mt-4">
        <div className="mobile-card">
          <div className="mobile-card-header flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-muted/50">
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </div>
              <h2 className="font-semibold font-display">OBD-2 Diagnostics</h2>
            </div>
            <Badge variant="outline" className="bg-muted/50 text-muted-foreground">
              Not Available
            </Badge>
          </div>
          <div className="mobile-card-body">
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Cpu className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-medium text-muted-foreground">OBD Data Not Connected</p>
              <p className="text-sm text-muted-foreground mt-1">
                OBD-2 diagnostic data will appear here once connected
              </p>
            </div>
          </div>
        </div>
      </section>
    );
  }
  
  const hasErrors = (data.totalErrors || 0) > 0;

  const criticalTotal = (data.systems || []).reduce((sum, sys) => 
    sum + (sys.faults || []).filter(f => f.severity === 'critical').length, 0);

  return (
    <section className="px-4 mt-4">
      <div className="mobile-card">
        <div className="mobile-card-header flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${hasErrors ? 'bg-destructive/10' : 'bg-success/10'}`}>
              <Cpu className={`h-4 w-4 ${hasErrors ? 'text-destructive' : 'text-success'}`} />
            </div>
            <h2 className="font-semibold font-display">OBD-2 Diagnostics</h2>
          </div>
          <Badge 
            variant="outline" 
            className={hasErrors 
              ? 'bg-destructive/10 text-destructive border-destructive/20' 
              : 'bg-success/10 text-success border-success/20'
            }
          >
            {data.totalErrors || 0} {(data.totalErrors || 0) === 1 ? 'Error' : 'Errors'}
          </Badge>
        </div>
        
        <div className="mobile-card-body">
          {hasErrors ? (
            <>
              {/* Summary */}
              {criticalTotal > 0 && (
                <div className="p-3 bg-destructive/5 border border-destructive/20 rounded-xl mb-4 flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
                  <p className="text-sm text-destructive">
                    <strong>{criticalTotal} critical</strong> issue{criticalTotal > 1 ? 's' : ''} require immediate attention
                  </p>
                </div>
              )}
              
              {/* System Groups */}
              <div className="space-y-3">
                {(data.systems || []).map((system, idx) => (
                  <SystemGroup key={idx} system={system} isEditMode={isEditMode} />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="h-6 w-6 text-success" />
              </div>
              <p className="font-medium">No Diagnostic Errors</p>
              <p className="text-sm text-muted-foreground mt-1">
                All systems functioning normally
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default OBDReportMobile;
