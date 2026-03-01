// Loan module utility functions and shared components

import { Clock, CheckCircle, XCircle, PhoneOff, PhoneCall, Calendar } from 'lucide-react';

// Format currency in Indian format
export const formatCurrency = (amount) => {
  if (!amount) return '₹ 0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

// Status configuration for loan leads
export const STATUS_CONFIG = {
  NEW: { color: 'bg-gray-100 text-gray-700', icon: Clock },
  INTERESTED: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
  NOT_INTERESTED: { color: 'bg-red-100 text-red-700', icon: XCircle },
  RNR: { color: 'bg-yellow-100 text-yellow-700', icon: PhoneOff },
  CALL_BACK: { color: 'bg-blue-100 text-blue-700', icon: PhoneCall },
  FOLLOW_UP: { color: 'bg-purple-100 text-purple-700', icon: Calendar },
};

// Application status configuration
export const APP_STATUS_CONFIG = {
  DRAFT: { color: 'bg-gray-100 text-gray-600' },
  APPLIED: { color: 'bg-blue-100 text-blue-700' },
  ACCEPTED_BY_BANK: { color: 'bg-cyan-100 text-cyan-700' },
  IN_PROCESS: { color: 'bg-yellow-100 text-yellow-700' },
  REJECTED_BY_BANK: { color: 'bg-red-100 text-red-700' },
  APPROVED_BY_BANK: { color: 'bg-green-100 text-green-700' },
  LOAN_DISBURSED: { color: 'bg-emerald-100 text-emerald-800' },
};
