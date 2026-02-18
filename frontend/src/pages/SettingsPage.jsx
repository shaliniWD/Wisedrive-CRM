import React from 'react';
import InspectionPackagesPage from './InspectionPackagesPage';

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-gray-50" data-testid="settings-page">
      <InspectionPackagesPage />
    </div>
  );
}
