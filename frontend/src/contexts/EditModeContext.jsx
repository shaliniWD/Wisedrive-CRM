import React, { createContext, useContext, useState } from 'react';

const EditModeContext = createContext();

export function EditModeProvider({ children }) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [reportData, setReportData] = useState(null);

  const toggleEditMode = () => {
    setIsEditMode(!isEditMode);
  };

  const updateField = (section, field, value) => {
    setHasUnsavedChanges(true);
    // In real app, this would update the report data
    console.log('Updating:', section, field, value);
  };

  const saveChanges = () => {
    setHasUnsavedChanges(false);
    // In real app, this would save to API
    alert('Changes saved successfully!');
  };

  const publishReport = () => {
    setHasUnsavedChanges(false);
    // In real app, this would publish and send WhatsApp
    alert('Report published! WhatsApp message sent to customer.');
  };

  const shareReport = () => {
    const reportUrl = window.location.href;
    const message = `View your vehicle inspection report: ${reportUrl}`;
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <EditModeContext.Provider value={{
      isEditMode,
      toggleEditMode,
      hasUnsavedChanges,
      updateField,
      saveChanges,
      publishReport,
      shareReport,
      reportData,
      setReportData
    }}>
      {children}
    </EditModeContext.Provider>
  );
}

export function useEditMode() {
  const context = useContext(EditModeContext);
  if (!context) {
    throw new Error('useEditMode must be used within EditModeProvider');
  }
  return context;
}
