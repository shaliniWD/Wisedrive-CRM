// Status Badge components for loan module
import React from 'react';
import { STATUS_CONFIG, APP_STATUS_CONFIG } from './utils';

// Lead Status Badge
export const StatusBadge = ({ status }) => {
  const { color, icon: Icon } = STATUS_CONFIG[status] || STATUS_CONFIG.NEW;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {status?.replace(/_/g, ' ')}
    </span>
  );
};

// Application Status Badge
export const AppStatusBadge = ({ status }) => {
  const { color } = APP_STATUS_CONFIG[status] || APP_STATUS_CONFIG.DRAFT;
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
};
