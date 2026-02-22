/**
 * Lead Status Configuration and Dropdown Component
 * Extracted from LeadsPage.jsx for reusability
 */
import React, { useState } from 'react';
import { leadsApi } from '@/services/api';
import { toast } from 'sonner';
import { ChevronDown, Loader2 } from 'lucide-react';
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';

// Status colors based on the 22 statuses
export const getStatusConfig = (status) => {
  const configs = {
    'NEW LEAD': { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'New Lead' },
    'RNR': { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'RNR' },
    'RNR1': { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'RNR1' },
    'RNR2': { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'RNR2' },
    'RNR3': { color: 'bg-red-100 text-red-800 border-red-200', label: 'RNR3' },
    'FOLLOW UP': { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Follow Up' },
    'WHATSAPP FOLLOW UP': { color: 'bg-green-100 text-green-800 border-green-200', label: 'WhatsApp Follow Up' },
    'Repeat follow up': { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Repeat Follow Up' },
    'HOT LEADS': { color: 'bg-red-100 text-red-800 border-red-200', label: 'Hot Leads' },
    'NOT INTERESTED': { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Not Interested' },
    'DEAD LEAD': { color: 'bg-gray-200 text-gray-800 border-gray-300', label: 'Dead Lead' },
    'ESCALATION': { color: 'bg-red-100 text-red-800 border-red-200', label: 'Escalation' },
    'STOP': { color: 'bg-gray-200 text-gray-700 border-gray-300', label: 'Stop' },
    'OUT OF SERVICE AREA': { color: 'bg-slate-100 text-slate-800 border-slate-200', label: 'Out of Service Area' },
    'WRONG NUMBER': { color: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Wrong Number' },
    'PURCHASED FROM COMPETITOR': { color: 'bg-gray-100 text-gray-700 border-gray-200', label: 'Purchased from Competitor' },
    'PAYMENT LINK SENT': { color: 'bg-purple-100 text-purple-800 border-purple-200', label: 'Payment Link Sent' },
    'PAID': { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Paid' },
    'CAR FINALIZED': { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Car Finalized' },
    'Car purchased': { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Car Purchased' },
    'CC GENERATED': { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'CC Generated' },
    'RCB WHATSAPP': { color: 'bg-green-100 text-green-800 border-green-200', label: 'RCB WhatsApp' },
  };
  return configs[status] || { color: 'bg-gray-100 text-gray-800 border-gray-200', label: status };
};

// Inline Status Dropdown Component - Click to update status
export const StatusDropdown = ({ lead, statuses, onUpdate }) => {
  const [open, setOpen] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  const cfg = getStatusConfig(lead.status);

  const handleStatusChange = async (newStatus) => {
    if (newStatus === lead.status) {
      setOpen(false);
      return;
    }
    setUpdating(true);
    try {
      await leadsApi.updateStatus(lead.id, newStatus);
      toast.success(`Status updated to ${getStatusConfig(newStatus).label}`);
      onUpdate();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update status');
    } finally {
      setUpdating(false);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${cfg.color} hover:opacity-80 transition-opacity cursor-pointer`}
          disabled={updating}
          data-testid={`status-dropdown-${lead.id}`}
        >
          {updating ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <>
              {cfg.label}
              <ChevronDown className="h-3 w-3" />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1 max-h-[300px] overflow-y-auto" align="start">
        <div className="space-y-0.5">
          {statuses.map((status) => {
            const statusCfg = getStatusConfig(status.name);
            const isSelected = lead.status === status.name;
            return (
              <button
                key={status.name}
                onClick={() => handleStatusChange(status.name)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                  isSelected 
                    ? 'bg-blue-50 text-blue-700 font-medium' 
                    : 'hover:bg-gray-100'
                }`}
              >
                <span className={`inline-block w-2 h-2 rounded-full mr-2 ${statusCfg.color.split(' ')[0]}`} />
                {statusCfg.label}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default StatusDropdown;
