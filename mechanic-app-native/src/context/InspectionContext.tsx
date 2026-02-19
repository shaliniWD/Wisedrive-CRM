import React, { createContext, useContext, useState, ReactNode } from 'react';

interface InspectionContextType {
  currentInspectionId: string | null;
  currentInspection: any | null;
  setCurrentInspection: (id: string | null, data?: any) => void;
  clearInspection: () => void;
}

const InspectionContext = createContext<InspectionContextType | undefined>(undefined);

export function InspectionProvider({ children }: { children: ReactNode }) {
  const [currentInspectionId, setCurrentInspectionId] = useState<string | null>(null);
  const [currentInspection, setCurrentInspectionData] = useState<any | null>(null);

  const setCurrentInspection = (id: string | null, data?: any) => {
    setCurrentInspectionId(id);
    setCurrentInspectionData(data || null);
  };

  const clearInspection = () => {
    setCurrentInspectionId(null);
    setCurrentInspectionData(null);
  };

  return (
    <InspectionContext.Provider value={{
      currentInspectionId,
      currentInspection,
      setCurrentInspection,
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
