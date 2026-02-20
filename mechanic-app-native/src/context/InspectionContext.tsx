import React, { createContext, useContext, useState, ReactNode } from 'react';

interface OBDScanResult {
  completed: boolean;
  dtcCount: number;
  liveDataCount: number;
  sessionId?: string;
  timestamp?: string;
}

interface InspectionContextType {
  currentInspectionId: string | null;
  currentInspection: any | null;
  obdScanResult: OBDScanResult | null;
  setCurrentInspection: (id: string | null, data?: any) => void;
  setOBDScanResult: (result: OBDScanResult | null) => void;
  clearInspection: () => void;
}

const InspectionContext = createContext<InspectionContextType | undefined>(undefined);

export function InspectionProvider({ children }: { children: ReactNode }) {
  const [currentInspectionId, setCurrentInspectionId] = useState<string | null>(null);
  const [currentInspection, setCurrentInspectionData] = useState<any | null>(null);
  const [obdScanResult, setObdScanResultState] = useState<OBDScanResult | null>(null);

  const setCurrentInspection = (id: string | null, data?: any) => {
    setCurrentInspectionId(id);
    setCurrentInspectionData(data || null);
  };

  const setOBDScanResult = (result: OBDScanResult | null) => {
    setObdScanResultState(result);
  };

  const clearInspection = () => {
    setCurrentInspectionId(null);
    setCurrentInspectionData(null);
    setObdScanResultState(null);
  };

  return (
    <InspectionContext.Provider value={{
      currentInspectionId,
      currentInspection,
      obdScanResult,
      setCurrentInspection,
      setOBDScanResult,
      clearInspection,
    }}>
      {children}
    </InspectionContext.Provider>
  );
}

export function useInspection() {
  const context = useContext(InspectionContext);
  if (context === undefined) {
    throw new Error('useInspection must be used within an InspectionProvider');
  }
  return context;
}
