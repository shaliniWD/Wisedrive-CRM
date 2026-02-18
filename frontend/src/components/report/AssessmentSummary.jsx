import React from 'react';
import { useEditMode } from '@/contexts/EditModeContext';
import { 
  FileText, 
  AlertTriangle, 
  AlertCircle, 
  Info
} from 'lucide-react';

export function AssessmentSummary({ data }) {
  const { isEditMode } = useEditMode();

  // Handle missing data gracefully
  if (!data) {
    return (
      <section className="px-4 md:px-0 mt-4 md:mt-6">
        <div className="mobile-card md:rounded-2xl">
          <div className="mobile-card-header flex items-center gap-2">
            <div className="p-1.5 md:p-2 rounded-lg bg-muted/50">
              <FileText className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
            </div>
            <h2 className="font-semibold font-display text-base md:text-lg">Assessment Summary</h2>
          </div>
          <div className="mobile-card-body text-center py-6">
            <p className="text-sm text-muted-foreground">Assessment summary not available yet</p>
          </div>
        </div>
      </section>
    );
  }

  const paragraph = data.paragraph || 'Assessment details pending.';
  const keyHighlights = data.keyHighlights || [];

  const getHighlightIcon = (type) => {
    if (type === 'critical') return <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0" />;
    if (type === 'warning') return <AlertCircle className="h-4 w-4 text-warning flex-shrink-0" />;
    return <Info className="h-4 w-4 text-info flex-shrink-0" />;
  };

  const getHighlightClass = (type) => {
    if (type === 'critical') return 'border-l-destructive bg-destructive/5';
    if (type === 'warning') return 'border-l-warning bg-warning/5';
    return 'border-l-info bg-info/5';
  };

  return (
    <section className="px-4 md:px-0 mt-4 md:mt-6">
      <div className="mobile-card md:rounded-2xl">
        <div className="mobile-card-header flex items-center gap-2">
          <div className="p-1.5 md:p-2 rounded-lg bg-primary/10">
            <FileText className="h-4 w-4 md:h-5 md:w-5 text-primary" />
          </div>
          <h2 className="font-semibold font-display text-base md:text-lg">Assessment Summary</h2>
        </div>
        
        <div className="mobile-card-body">
          {/* Desktop: Side by side | Mobile: Stacked */}
          <div className="md:flex md:gap-6">
            {/* Summary Paragraph */}
            <div className="md:flex-1">
              <p className={`text-sm md:text-base text-muted-foreground leading-relaxed ${isEditMode ? 'border border-dashed border-yellow-500 rounded p-2' : ''}`}>
                {paragraph}
              </p>
            </div>
            
            {/* Key Highlights */}
            {keyHighlights.length > 0 && (
              <div className="mt-4 md:mt-0 md:w-[380px] lg:w-[420px] flex-shrink-0">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Key Findings
                </h3>
                
                <div className="space-y-2">
                  {keyHighlights.map((highlight, index) => (
                    <div 
                      key={index}
                      className={`flex items-start gap-3 p-3 rounded-lg border-l-4 ${getHighlightClass(highlight.type)}`}
                    >
                      {getHighlightIcon(highlight.type)}
                      <p className={`text-sm flex-1 ${isEditMode ? 'border border-dashed border-yellow-500 rounded px-1' : ''}`}>
                        {highlight.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

export default AssessmentSummary;
