import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { loansApi } from '@/services/api';
import { toast } from 'sonner';
import {
  ShieldCheck, AlertCircle, CreditCard, User, Phone, MapPin, Building2, Search, Eye, X, Loader2,
  ChevronDown, ChevronUp, CheckCircle, ArrowRight, RefreshCw, Download, FileText, AlertTriangle, 
  Lock, Activity, Info, XCircle, Ban, Filter, TrendingUp, TrendingDown, Clock, AlertOctagon,
  Scale, Gavel, BadgeAlert, CircleDollarSign, Calendar, BarChart3, PieChart, Banknote, Receipt
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

// ============= UTILITY FUNCTIONS =============
const formatINR = (amount) => {
  if (amount === null || amount === undefined) return '₹0';
  const num = parseFloat(amount) || 0;
  if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
  if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
  if (num >= 1000) return `₹${(num / 1000).toFixed(1)}K`;
  return `₹${num.toLocaleString('en-IN')}`;
};

const formatDate = (dateValue) => {
  if (!dateValue) return '-';
  if (typeof dateValue === 'number') {
    const str = String(dateValue);
    if (str.length === 8) {
      return `${str.slice(6, 8)}/${str.slice(4, 6)}/${str.slice(0, 4)}`;
    }
  }
  return dateValue;
};

// Account Type Mapping
const ACCOUNT_TYPES = {
  '01': { name: 'Auto Loan', category: 'secured' },
  '02': { name: 'Housing Loan', category: 'secured' },
  '03': { name: 'Property Loan', category: 'secured' },
  '04': { name: 'Loan Against Shares', category: 'secured' },
  '05': { name: 'Personal Loan', category: 'unsecured' },
  '06': { name: 'Consumer Loan', category: 'unsecured' },
  '07': { name: 'Gold Loan', category: 'secured' },
  '08': { name: 'Education Loan', category: 'unsecured' },
  '09': { name: 'Loan to Prof', category: 'unsecured' },
  '10': { name: 'Credit Card', category: 'unsecured' },
  '11': { name: 'Leasing', category: 'secured' },
  '12': { name: 'Overdraft', category: 'unsecured' },
  '13': { name: 'Two Wheeler', category: 'secured' },
  '14': { name: 'Non-Fund Based', category: 'other' },
  '15': { name: 'Business Loan', category: 'unsecured' },
  '16': { name: 'Loan Against FD', category: 'secured' },
  '17': { name: 'Microfinance', category: 'unsecured' },
  '31': { name: 'Secured Credit Card', category: 'secured' },
  '32': { name: 'Used Car Loan', category: 'secured' },
  '33': { name: 'Construction Equipment', category: 'secured' },
  '34': { name: 'Tractor Loan', category: 'secured' },
  '35': { name: 'Corporate Credit Card', category: 'unsecured' },
  '36': { name: 'Kisan Credit Card', category: 'secured' },
  '37': { name: 'Loan on CC', category: 'unsecured' },
  '38': { name: 'Prime Minister Housing', category: 'secured' },
  '39': { name: 'P2P Personal', category: 'unsecured' },
  '40': { name: 'P2P Auto', category: 'secured' },
  '41': { name: 'P2P Education', category: 'unsecured' },
  '42': { name: 'Mudra Shishu', category: 'unsecured' },
  '43': { name: 'Mudra Kishore', category: 'unsecured' },
  '44': { name: 'Mudra Tarun', category: 'unsecured' },
  '51': { name: 'Business CC', category: 'unsecured' },
  '52': { name: 'Business Loan Against Bank Deposits', category: 'secured' },
  '53': { name: 'Staff Loan', category: 'unsecured' },
  '61': { name: 'BNPL', category: 'unsecured' },
  '00': { name: 'Other', category: 'other' },
};

const getAccountType = (code) => {
  const type = ACCOUNT_TYPES[String(code).padStart(2, '0')];
  return type || { name: `Type ${code}`, category: 'other' };
};

// ============= RISK CALCULATION =============
const calculateRiskScore = (data) => {
  const {
    score, accounts, totalWrittenOff, totalOverdue, totalSettled,
    suitFiledCount, dpdOver90Count, recentEnquiries, creditUtilization
  } = data;
  
  let riskPoints = 0;
  let maxPoints = 100;
  
  // Credit Score (40 points)
  if (score >= 750) riskPoints += 40;
  else if (score >= 700) riskPoints += 32;
  else if (score >= 650) riskPoints += 24;
  else if (score >= 600) riskPoints += 16;
  else if (score >= 550) riskPoints += 8;
  else riskPoints += 0;
  
  // Written-off accounts (20 points - deduct)
  const writeOffCount = accounts.filter(a => 
    a.Written_Off_Amt_Total > 0 || a.Account_Status === '78' || a.Account_Status === '89'
  ).length;
  riskPoints -= writeOffCount * 15;
  
  // Suit Filed / Willful Default (15 points - deduct)
  riskPoints -= suitFiledCount * 15;
  
  // DPD > 90 days (15 points - deduct)
  riskPoints -= dpdOver90Count * 10;
  
  // Settlements (5 points - deduct)
  const settledCount = accounts.filter(a => a.Settlement_Amount > 0).length;
  riskPoints -= settledCount * 5;
  
  // Recent Enquiries (5 points - deduct if too many)
  if (recentEnquiries > 5) riskPoints -= 5;
  if (recentEnquiries > 10) riskPoints -= 10;
  
  // Credit Utilization (5 points)
  if (creditUtilization < 30) riskPoints += 5;
  else if (creditUtilization > 80) riskPoints -= 5;
  
  // Normalize to 0-100
  const finalScore = Math.max(0, Math.min(100, riskPoints));
  
  // Risk Level
  if (finalScore >= 80) return { score: finalScore, level: 'LOW', color: 'emerald', recommendation: 'APPROVE' };
  if (finalScore >= 60) return { score: finalScore, level: 'MODERATE', color: 'amber', recommendation: 'REVIEW' };
  if (finalScore >= 40) return { score: finalScore, level: 'HIGH', color: 'orange', recommendation: 'CAUTION' };
  return { score: finalScore, level: 'CRITICAL', color: 'red', recommendation: 'REJECT' };
};

// ============= COMPONENTS =============

// Score Gauge Component
const ScoreGauge = ({ score, size = 'large' }) => {
  const getScoreData = (s) => {
    if (s >= 750) return { label: 'Excellent', color: 'emerald', ring: 'ring-emerald-500' };
    if (s >= 700) return { label: 'Good', color: 'blue', ring: 'ring-blue-500' };
    if (s >= 650) return { label: 'Fair', color: 'amber', ring: 'ring-amber-500' };
    if (s >= 550) return { label: 'Poor', color: 'orange', ring: 'ring-orange-500' };
    return { label: 'Very Poor', color: 'red', ring: 'ring-red-500' };
  };
  
  const { label, color, ring } = getScoreData(score);
  const percentage = Math.max(0, Math.min(100, ((score - 300) / 600) * 100));
  const strokeDasharray = `${percentage * 2.51} 251`;
  
  const sizeClasses = size === 'large' ? 'w-40 h-40' : 'w-28 h-28';
  const textSize = size === 'large' ? 'text-4xl' : 'text-2xl';
  
  return (
    <div className={`relative ${sizeClasses}`} data-testid="score-gauge">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="8" />
        <circle
          cx="50" cy="50" r="40" fill="none"
          stroke={`url(#gradient-${color})`}
          strokeWidth="8" strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          className="transition-all duration-1000"
        />
        <defs>
          <linearGradient id={`gradient-${color}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={color === 'emerald' ? '#10b981' : color === 'blue' ? '#3b82f6' : color === 'amber' ? '#f59e0b' : color === 'orange' ? '#f97316' : '#ef4444'} />
            <stop offset="100%" stopColor={color === 'emerald' ? '#059669' : color === 'blue' ? '#2563eb' : color === 'amber' ? '#d97706' : color === 'orange' ? '#ea580c' : '#dc2626'} />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-mono font-bold ${textSize} text-slate-900`}>{score || '-'}</span>
        <span className={`text-xs font-semibold text-${color}-600 uppercase tracking-wide`}>{label}</span>
      </div>
    </div>
  );
};

// Risk Badge Component
const RiskBadge = ({ level, recommendation }) => {
  const styles = {
    LOW: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    MODERATE: 'bg-amber-100 text-amber-800 border-amber-300',
    HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
    CRITICAL: 'bg-red-100 text-red-800 border-red-300 ring-2 ring-red-400',
  };
  
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full border ${styles[level]} font-semibold`} data-testid="risk-badge">
      {level === 'CRITICAL' && <AlertOctagon className="w-4 h-4" />}
      {level === 'HIGH' && <AlertTriangle className="w-4 h-4" />}
      {level === 'MODERATE' && <AlertCircle className="w-4 h-4" />}
      {level === 'LOW' && <ShieldCheck className="w-4 h-4" />}
      <span>{level} RISK</span>
      <span className="text-xs">• {recommendation}</span>
    </div>
  );
};

// Metric Card Component
const MetricCard = ({ label, value, subValue, icon: Icon, alert, alertColor = 'red', className = '' }) => (
  <div className={`bg-white rounded-xl border p-4 ${alert ? `border-${alertColor}-200 bg-${alertColor}-50` : 'border-slate-100'} ${className}`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{label}</p>
        <p className={`text-2xl font-mono font-bold mt-1 ${alert ? `text-${alertColor}-700` : 'text-slate-900'}`}>{value}</p>
        {subValue && <p className="text-xs text-slate-500 mt-0.5">{subValue}</p>}
      </div>
      {Icon && (
        <div className={`p-2 rounded-lg ${alert ? `bg-${alertColor}-100` : 'bg-slate-100'}`}>
          <Icon className={`w-5 h-5 ${alert ? `text-${alertColor}-600` : 'text-slate-600'}`} />
        </div>
      )}
    </div>
  </div>
);

// Red Flags Section
const RedFlagsSection = ({ flags }) => {
  if (!flags || flags.length === 0) return null;
  
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-5 mb-6" data-testid="red-flags-section">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-red-100 rounded-lg">
          <AlertOctagon className="w-6 h-6 text-red-600" />
        </div>
        <div>
          <h3 className="font-bold text-red-900 text-lg">Critical Risk Indicators</h3>
          <p className="text-sm text-red-700">{flags.length} issue(s) require immediate attention</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {flags.map((flag, idx) => (
          <div key={idx} className="flex items-start gap-3 bg-white rounded-lg p-3 border border-red-100">
            {flag.icon}
            <div>
              <p className="font-semibold text-red-800 text-sm">{flag.title}</p>
              <p className="text-xs text-red-600">{flag.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// Payment History Heatmap (Compact)
const PaymentHeatmap = ({ history, months = 24 }) => {
  if (!history || history.length === 0) return <span className="text-xs text-slate-400">No history</span>;
  
  const getColor = (dpd) => {
    if (dpd === 0 || dpd === '0' || dpd === 'STD') return 'bg-emerald-500';
    if (dpd === '?' || dpd === 'XXX' || dpd === 'NEW') return 'bg-slate-200';
    const days = parseInt(dpd);
    if (isNaN(days)) return 'bg-slate-200';
    if (days <= 30) return 'bg-amber-400';
    if (days <= 60) return 'bg-orange-500';
    if (days <= 90) return 'bg-red-500';
    return 'bg-red-700';
  };
  
  return (
    <div className="flex gap-0.5" data-testid="payment-heatmap">
      {history.slice(0, months).map((h, i) => (
        <div
          key={i}
          className={`w-2.5 h-5 rounded-sm ${getColor(h.Days_Past_Due)} cursor-help`}
          title={`${h.Month || ''}/${h.Year || ''}: ${h.Days_Past_Due || 0} DPD`}
        />
      ))}
    </div>
  );
};

// DPD Analysis Card
const DPDAnalysisCard = ({ accounts }) => {
  // Analyze DPD across all accounts
  const dpdStats = useMemo(() => {
    let dpd0 = 0, dpd30 = 0, dpd60 = 0, dpd90 = 0, dpd90Plus = 0;
    let totalHistoryMonths = 0;
    
    accounts.forEach(acc => {
      const history = acc.CAIS_Account_History || acc.payment_history || [];
      history.forEach(h => {
        totalHistoryMonths++;
        const days = parseInt(h.Days_Past_Due) || 0;
        if (days === 0) dpd0++;
        else if (days <= 30) dpd30++;
        else if (days <= 60) dpd60++;
        else if (days <= 90) dpd90++;
        else dpd90Plus++;
      });
    });
    
    return { dpd0, dpd30, dpd60, dpd90, dpd90Plus, total: totalHistoryMonths };
  }, [accounts]);
  
  const getPercentage = (count) => dpdStats.total > 0 ? ((count / dpdStats.total) * 100).toFixed(1) : 0;
  
  return (
    <div className="bg-white rounded-xl border border-slate-100 p-5">
      <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-slate-600" />
        DPD Analysis (All Accounts)
      </h4>
      <div className="space-y-3">
        <DPDBar label="On Time (0 DPD)" count={dpdStats.dpd0} percentage={getPercentage(dpdStats.dpd0)} color="emerald" />
        <DPDBar label="1-30 Days" count={dpdStats.dpd30} percentage={getPercentage(dpdStats.dpd30)} color="amber" />
        <DPDBar label="31-60 Days" count={dpdStats.dpd60} percentage={getPercentage(dpdStats.dpd60)} color="orange" />
        <DPDBar label="61-90 Days" count={dpdStats.dpd90} percentage={getPercentage(dpdStats.dpd90)} color="red-400" />
        <DPDBar label="90+ Days" count={dpdStats.dpd90Plus} percentage={getPercentage(dpdStats.dpd90Plus)} color="red-700" alert />
      </div>
    </div>
  );
};

const DPDBar = ({ label, count, percentage, color, alert }) => (
  <div className="flex items-center gap-3">
    <div className="w-24 text-xs text-slate-600">{label}</div>
    <div className="flex-1 h-4 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full bg-${color} rounded-full transition-all duration-500`} style={{ width: `${percentage}%` }} />
    </div>
    <div className={`w-20 text-right text-xs font-mono ${alert && count > 0 ? 'text-red-700 font-bold' : 'text-slate-600'}`}>
      {count} ({percentage}%)
    </div>
  </div>
);

// Account Row Component
const AccountRow = ({ account, index, expanded, onToggle }) => {
  const type = getAccountType(account.Account_Type || account.account_type);
  const status = getAccountStatus(account);
  const balance = parseFloat(account.Current_Balance || account.current_balance || 0);
  const overdue = parseFloat(account.Amount_Past_Due || account.amount_overdue || 0);
  const writtenOff = parseFloat(account.Written_Off_Amt_Total || account.written_off_amount || 0);
  const limit = parseFloat(account.Highest_Credit_or_Original_Loan_Amount || account.Credit_Limit_Amount || account.credit_limit || 0);
  const history = account.CAIS_Account_History || account.payment_history || [];
  const currentDPD = parseInt(account.Days_Past_Due) || (history[0]?.Days_Past_Due ? parseInt(history[0].Days_Past_Due) : 0);
  const suitFiled = account.SuitFiledWilfulDefault === 'Y';
  const settlement = parseFloat(account.Settlement_Amount || 0);
  
  return (
    <div className={`border rounded-xl overflow-hidden ${status.severity === 'critical' ? 'border-red-200 bg-red-50/50' : status.severity === 'warning' ? 'border-orange-200 bg-orange-50/50' : 'border-slate-100'}`}>
      <div 
        className="p-4 cursor-pointer hover:bg-slate-50 transition-colors"
        onClick={onToggle}
        data-testid={`account-row-${index}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            {/* Institution & Type */}
            <div className="min-w-[200px]">
              <p className="font-semibold text-slate-900 text-sm">{account.Subscriber_Name || account.institution || 'Unknown'}</p>
              <p className="text-xs text-slate-500">{type.name} • {account.Account_Number || account.account_number || '-'}</p>
            </div>
            
            {/* Status Badge */}
            <Badge className={status.className} variant="outline">{status.label}</Badge>
            
            {/* Special Flags */}
            {suitFiled && <Badge className="bg-red-600 text-white">SUIT FILED</Badge>}
            {settlement > 0 && <Badge className="bg-orange-500 text-white">SETTLED</Badge>}
            {writtenOff > 0 && <Badge className="bg-red-700 text-white">WRITTEN OFF</Badge>}
            
            {/* Current DPD */}
            {currentDPD > 0 && (
              <div className={`px-2 py-1 rounded text-xs font-bold ${currentDPD > 90 ? 'bg-red-600 text-white' : currentDPD > 60 ? 'bg-red-500 text-white' : currentDPD > 30 ? 'bg-orange-500 text-white' : 'bg-amber-400 text-white'}`}>
                {currentDPD} DPD
              </div>
            )}
          </div>
          
          {/* Balance Info */}
          <div className="flex items-center gap-6 text-right">
            <div>
              <p className="text-xs text-slate-500">Balance</p>
              <p className="font-mono font-semibold text-slate-900">{formatINR(balance)}</p>
            </div>
            {overdue > 0 && (
              <div>
                <p className="text-xs text-red-500">Overdue</p>
                <p className="font-mono font-bold text-red-600">{formatINR(overdue)}</p>
              </div>
            )}
            {writtenOff > 0 && (
              <div>
                <p className="text-xs text-red-500">Written Off</p>
                <p className="font-mono font-bold text-red-700">{formatINR(writtenOff)}</p>
              </div>
            )}
            
            {/* Payment History Mini */}
            <div className="w-32">
              <PaymentHeatmap history={history} months={12} />
            </div>
            
            <ChevronDown className={`w-5 h-5 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          </div>
        </div>
      </div>
      
      {/* Expanded Details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-200"
          >
            <div className="p-4 bg-slate-50 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <DetailItem label="Opened" value={formatDate(account.Open_Date || account.Date_Opened || account.open_date)} />
              <DetailItem label="Last Payment" value={formatDate(account.Date_of_Last_Payment || account.last_payment_date)} />
              <DetailItem label="Sanctioned" value={formatINR(limit)} />
              <DetailItem label="Ownership" value={account.Ownership_Type || account.ownership_type || '-'} />
              {settlement > 0 && <DetailItem label="Settlement Amt" value={formatINR(settlement)} alert />}
              {writtenOff > 0 && <DetailItem label="Write-off Date" value={formatDate(account.Date_Written_Off)} alert />}
            </div>
            
            {/* Full Payment History */}
            {history.length > 0 && (
              <div className="p-4 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-600 mb-2">Payment History (Last {history.length} months)</p>
                <div className="flex gap-1 flex-wrap">
                  {history.map((h, i) => {
                    const dpd = parseInt(h.Days_Past_Due) || 0;
                    let bg = 'bg-emerald-500';
                    if (dpd > 90) bg = 'bg-red-700';
                    else if (dpd > 60) bg = 'bg-red-500';
                    else if (dpd > 30) bg = 'bg-orange-500';
                    else if (dpd > 0) bg = 'bg-amber-400';
                    
                    return (
                      <div key={i} className="text-center">
                        <div className={`w-6 h-6 rounded ${bg} text-white text-[8px] flex items-center justify-center font-mono`}>
                          {dpd || '✓'}
                        </div>
                        <div className="text-[8px] text-slate-400 mt-0.5">{h.Month}/{String(h.Year).slice(-2)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const DetailItem = ({ label, value, alert }) => (
  <div>
    <p className="text-xs text-slate-500">{label}</p>
    <p className={`font-mono text-sm ${alert ? 'text-red-600 font-bold' : 'text-slate-900'}`}>{value}</p>
  </div>
);

// Get Account Status Helper
const getAccountStatus = (account) => {
  const status = account.Account_Status || account.credit_status;
  const writtenOff = parseFloat(account.Written_Off_Amt_Total || account.written_off_amount || 0);
  const settlement = parseFloat(account.Settlement_Amount || 0);
  const overdue = parseFloat(account.Amount_Past_Due || account.amount_overdue || 0);
  const suitFiled = account.SuitFiledWilfulDefault === 'Y';
  
  if (writtenOff > 0 || status === '78' || status === '89') {
    return { label: 'Written Off', severity: 'critical', className: 'bg-red-100 text-red-800 border-red-200' };
  }
  if (suitFiled || status === '97' || status === '98') {
    return { label: 'Default', severity: 'critical', className: 'bg-red-100 text-red-800 border-red-200' };
  }
  if (settlement > 0) {
    return { label: 'Settled', severity: 'warning', className: 'bg-orange-100 text-orange-800 border-orange-200' };
  }
  if (status === '13' || status === '14' || status === '15' || account.credit_status === 'Closed') {
    return { label: 'Closed', severity: 'normal', className: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
  if (overdue > 0) {
    return { label: 'Overdue', severity: 'warning', className: 'bg-orange-100 text-orange-800 border-orange-200' };
  }
  return { label: 'Active', severity: 'good', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
};

// ============= MAIN BUREAU REPORT VIEW =============
const CreditRiskBureauView = ({ report, creditScore, bureauName, bureauColor }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedAccounts, setExpandedAccounts] = useState({});
  const [accountFilter, setAccountFilter] = useState('all');
  
  // Extract data with fallbacks for different bureau formats
  // Use passed creditScore first, then try to extract from report
  const score = creditScore || report?.score_info?.score || report?.SCORE?.FCIREXScore || report?.SCORE?.BureauScore || report?.creditScore || 0;
  const accounts = report?.accounts || report?.CAIS_Account?.CAIS_Account_DETAILS || [];
  const enquiries = report?.enquiries || report?.CAPS?.CAPS_Application_Details || [];
  const caisSummary = report?.CAIS_Account?.CAIS_Summary || {};
  const creditAccount = caisSummary?.Credit_Account || {};
  const outstanding = caisSummary?.Total_Outstanding_Balance || {};
  const profileHeader = report?.CreditProfileHeader || {};
  const personalInfo = report?.personal_info || report?.Current_Application?.Current_Application_Details?.Current_Applicant_Details || {};
  const capsData = report?.CAPS?.CAPS_Summary || report?.TotalCAPS_Summary || {};
  
  // Calculate key metrics
  const totalAccounts = creditAccount?.CreditAccountTotal || report?.summary?.total_accounts || accounts.length;
  const activeAccounts = creditAccount?.CreditAccountActive || report?.summary?.active_accounts || 0;
  const closedAccounts = creditAccount?.CreditAccountClosed || (totalAccounts - activeAccounts);
  const defaultAccounts = creditAccount?.CreditAccountDefault || 0;
  
  // Calculate risk metrics
  const writtenOffAccounts = accounts.filter(a => (a.Written_Off_Amt_Total || a.written_off_amount || 0) > 0 || a.Account_Status === '78' || a.Account_Status === '89');
  const settledAccounts = accounts.filter(a => (a.Settlement_Amount || 0) > 0);
  const suitFiledAccounts = accounts.filter(a => a.SuitFiledWilfulDefault === 'Y');
  const overdueAccounts = accounts.filter(a => (a.Amount_Past_Due || a.amount_overdue || 0) > 0);
  
  const totalOutstanding = outstanding?.Outstanding_Balance_All || report?.summary?.total_balance || 0;
  const securedBalance = outstanding?.Outstanding_Balance_Secured || report?.summary?.secured_balance || 0;
  const unsecuredBalance = outstanding?.Outstanding_Balance_UnSecured || report?.summary?.unsecured_balance || 0;
  const totalOverdue = accounts.reduce((sum, a) => sum + (parseFloat(a.Amount_Past_Due || a.amount_overdue) || 0), 0);
  const totalWrittenOff = accounts.reduce((sum, a) => sum + (parseFloat(a.Written_Off_Amt_Total || a.written_off_amount) || 0), 0);
  const totalSettled = accounts.reduce((sum, a) => sum + (parseFloat(a.Settlement_Amount) || 0), 0);
  
  // DPD > 90 count
  const dpdOver90Count = accounts.filter(a => {
    const history = a.CAIS_Account_History || a.payment_history || [];
    return history.some(h => parseInt(h.Days_Past_Due) > 90) || parseInt(a.Days_Past_Due) > 90;
  }).length;
  
  // Recent enquiries
  const recentEnquiries = capsData?.TotalCAPSLast90Days || capsData?.CAPSLast90Days || 0;
  
  // Credit Utilization (for credit cards and revolving credit)
  const creditCardAccounts = accounts.filter(a => ['10', '31', '35'].includes(a.Account_Type));
  const totalLimit = creditCardAccounts.reduce((sum, a) => sum + (parseFloat(a.Highest_Credit_or_Original_Loan_Amount || a.Credit_Limit_Amount) || 0), 0);
  const totalUsed = creditCardAccounts.reduce((sum, a) => sum + (parseFloat(a.Current_Balance || a.current_balance) || 0), 0);
  const creditUtilization = totalLimit > 0 ? (totalUsed / totalLimit) * 100 : 0;
  
  // Calculate Risk Score
  const riskAssessment = calculateRiskScore({
    score,
    accounts,
    totalWrittenOff,
    totalOverdue,
    totalSettled,
    suitFiledCount: suitFiledAccounts.length,
    dpdOver90Count,
    recentEnquiries,
    creditUtilization
  });
  
  // Build Red Flags
  const redFlags = [];
  if (writtenOffAccounts.length > 0) {
    redFlags.push({
      icon: <Ban className="w-5 h-5 text-red-600" />,
      title: `${writtenOffAccounts.length} Written-Off Account(s)`,
      detail: `Total: ${formatINR(totalWrittenOff)}`
    });
  }
  if (suitFiledAccounts.length > 0) {
    redFlags.push({
      icon: <Gavel className="w-5 h-5 text-red-600" />,
      title: `${suitFiledAccounts.length} Suit Filed / Willful Default`,
      detail: 'Legal action initiated'
    });
  }
  if (settledAccounts.length > 0) {
    redFlags.push({
      icon: <Scale className="w-5 h-5 text-orange-600" />,
      title: `${settledAccounts.length} Settled Account(s)`,
      detail: `Settlement: ${formatINR(totalSettled)}`
    });
  }
  if (dpdOver90Count > 0) {
    redFlags.push({
      icon: <Clock className="w-5 h-5 text-red-600" />,
      title: `${dpdOver90Count} Account(s) with 90+ DPD`,
      detail: 'Severe delinquency detected'
    });
  }
  if (totalOverdue > 0) {
    redFlags.push({
      icon: <CircleDollarSign className="w-5 h-5 text-red-600" />,
      title: `${overdueAccounts.length} Overdue Account(s)`,
      detail: `Total Overdue: ${formatINR(totalOverdue)}`
    });
  }
  if (recentEnquiries > 5) {
    redFlags.push({
      icon: <Search className="w-5 h-5 text-amber-600" />,
      title: `${recentEnquiries} Enquiries in 90 Days`,
      detail: 'High credit seeking behavior'
    });
  }
  
  // Filter accounts
  const filteredAccounts = accounts.filter(acc => {
    if (accountFilter === 'all') return true;
    const status = getAccountStatus(acc);
    if (accountFilter === 'active') return status.label === 'Active' || status.label === 'Overdue';
    if (accountFilter === 'closed') return status.label === 'Closed';
    if (accountFilter === 'problem') return status.severity === 'critical' || status.severity === 'warning';
    if (accountFilter === 'written-off') return acc.Written_Off_Amt_Total > 0 || acc.Account_Status === '78';
    return true;
  });
  
  return (
    <div className="space-y-6" data-testid="credit-risk-view">
      {/* Risk Summary Hero */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-6 text-white">
        <div className="flex flex-col lg:flex-row items-center gap-8">
          {/* Score Section */}
          <div className="flex flex-col items-center">
            <div className="bg-white rounded-full p-2">
              <ScoreGauge score={score} />
            </div>
            <p className="text-slate-400 text-sm mt-3 uppercase tracking-wider">{bureauName} Score</p>
          </div>
          
          {/* Risk Assessment */}
          <div className="flex-1 text-center lg:text-left">
            <RiskBadge level={riskAssessment.level} recommendation={riskAssessment.recommendation} />
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <p className="text-3xl font-mono font-bold">{totalAccounts}</p>
                <p className="text-xs text-slate-400 uppercase">Total Accounts</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-mono font-bold text-emerald-400">{activeAccounts}</p>
                <p className="text-xs text-slate-400 uppercase">Active</p>
              </div>
              <div className="text-center">
                <p className={`text-3xl font-mono font-bold ${writtenOffAccounts.length > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {writtenOffAccounts.length}
                </p>
                <p className="text-xs text-slate-400 uppercase">Written Off</p>
              </div>
              <div className="text-center">
                <p className={`text-3xl font-mono font-bold ${defaultAccounts > 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {defaultAccounts}
                </p>
                <p className="text-xs text-slate-400 uppercase">Defaults</p>
              </div>
            </div>
          </div>
          
          {/* Key Amounts */}
          <div className="grid grid-cols-1 gap-3 min-w-[200px]">
            <div className="bg-white/10 rounded-xl p-4">
              <p className="text-xs text-slate-400">Total Outstanding</p>
              <p className="text-2xl font-mono font-bold">{formatINR(totalOutstanding)}</p>
            </div>
            {totalOverdue > 0 && (
              <div className="bg-red-500/20 rounded-xl p-4 border border-red-400">
                <p className="text-xs text-red-200">Total Overdue</p>
                <p className="text-2xl font-mono font-bold text-red-300">{formatINR(totalOverdue)}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Red Flags */}
      <RedFlagsSection flags={redFlags} />
      
      {/* Detailed Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5 bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="overview" data-testid="tab-overview" className="rounded-lg">Overview</TabsTrigger>
          <TabsTrigger value="accounts" data-testid="tab-accounts" className="rounded-lg">Accounts ({accounts.length})</TabsTrigger>
          <TabsTrigger value="dpd" data-testid="tab-dpd" className="rounded-lg">DPD Analysis</TabsTrigger>
          <TabsTrigger value="enquiries" data-testid="tab-enquiries" className="rounded-lg">Enquiries</TabsTrigger>
          <TabsTrigger value="profile" data-testid="tab-profile" className="rounded-lg">Profile</TabsTrigger>
        </TabsList>
        
        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Total Accounts" value={totalAccounts} icon={Building2} />
            <MetricCard label="Active Accounts" value={activeAccounts} icon={CheckCircle} />
            <MetricCard label="Closed Accounts" value={closedAccounts} icon={Lock} />
            <MetricCard 
              label="Problem Accounts" 
              value={writtenOffAccounts.length + settledAccounts.length + overdueAccounts.length}
              icon={AlertTriangle}
              alert={writtenOffAccounts.length > 0 || overdueAccounts.length > 0}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Total Outstanding" value={formatINR(totalOutstanding)} icon={Banknote} subValue="All accounts" />
            <MetricCard label="Secured Balance" value={formatINR(securedBalance)} icon={ShieldCheck} subValue="Auto, Home, Gold" />
            <MetricCard label="Unsecured Balance" value={formatINR(unsecuredBalance)} icon={CreditCard} subValue="Personal, Cards" />
            <MetricCard 
              label="Total Overdue" 
              value={formatINR(totalOverdue)} 
              icon={AlertCircle} 
              alert={totalOverdue > 0}
              subValue={`${overdueAccounts.length} account(s)`}
            />
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DPDAnalysisCard accounts={accounts} />
            
            {/* Enquiries Summary */}
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Search className="w-5 h-5 text-slate-600" />
                Credit Enquiries Summary
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Last 7 Days</p>
                  <p className={`text-2xl font-mono font-bold ${capsData?.TotalCAPSLast7Days > 2 ? 'text-red-600' : 'text-slate-900'}`}>
                    {capsData?.TotalCAPSLast7Days || capsData?.CAPSLast7Days || 0}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Last 30 Days</p>
                  <p className={`text-2xl font-mono font-bold ${capsData?.TotalCAPSLast30Days > 5 ? 'text-amber-600' : 'text-slate-900'}`}>
                    {capsData?.TotalCAPSLast30Days || capsData?.CAPSLast30Days || 0}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Last 90 Days</p>
                  <p className={`text-2xl font-mono font-bold ${recentEnquiries > 5 ? 'text-amber-600' : 'text-slate-900'}`}>
                    {recentEnquiries}
                  </p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <p className="text-xs text-slate-500">Last 180 Days</p>
                  <p className="text-2xl font-mono font-bold text-slate-900">
                    {capsData?.TotalCAPSLast180Days || capsData?.CAPSLast180Days || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
        
        {/* Accounts Tab */}
        <TabsContent value="accounts" className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-slate-900">Account Details</h3>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <Select value={accountFilter} onValueChange={setAccountFilter}>
                <SelectTrigger className="w-[180px]" data-testid="account-filter">
                  <SelectValue placeholder="Filter accounts" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Accounts ({accounts.length})</SelectItem>
                  <SelectItem value="active">Active ({accounts.filter(a => getAccountStatus(a).label === 'Active').length})</SelectItem>
                  <SelectItem value="closed">Closed ({accounts.filter(a => getAccountStatus(a).label === 'Closed').length})</SelectItem>
                  <SelectItem value="problem">Problem ({accounts.filter(a => ['critical', 'warning'].includes(getAccountStatus(a).severity)).length})</SelectItem>
                  <SelectItem value="written-off">Written Off ({writtenOffAccounts.length})</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-4 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-emerald-500 rounded" />On Time</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-amber-400 rounded" />1-30 DPD</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-500 rounded" />31-60 DPD</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded" />61-90 DPD</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-700 rounded" />90+ DPD</span>
          </div>
          
          <div className="space-y-3">
            {filteredAccounts.map((acc, idx) => (
              <AccountRow
                key={idx}
                account={acc}
                index={idx}
                expanded={expandedAccounts[idx]}
                onToggle={() => setExpandedAccounts(prev => ({ ...prev, [idx]: !prev[idx] }))}
              />
            ))}
            {filteredAccounts.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <Building2 className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p>No accounts match the selected filter</p>
              </div>
            )}
          </div>
        </TabsContent>
        
        {/* DPD Analysis Tab */}
        <TabsContent value="dpd" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <DPDAnalysisCard accounts={accounts} />
            
            {/* Accounts with DPD Issues */}
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" />
                Accounts with DPD Issues
              </h4>
              <div className="space-y-3 max-h-[400px] overflow-y-auto">
                {accounts
                  .filter(acc => {
                    const history = acc.CAIS_Account_History || acc.payment_history || [];
                    return history.some(h => parseInt(h.Days_Past_Due) > 0) || parseInt(acc.Days_Past_Due) > 0;
                  })
                  .map((acc, idx) => {
                    const history = acc.CAIS_Account_History || acc.payment_history || [];
                    const maxDPD = Math.max(...history.map(h => parseInt(h.Days_Past_Due) || 0), parseInt(acc.Days_Past_Due) || 0);
                    const dpdCount = history.filter(h => parseInt(h.Days_Past_Due) > 0).length;
                    
                    return (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-semibold text-slate-900 text-sm">{acc.Subscriber_Name || acc.institution}</p>
                            <p className="text-xs text-slate-500">{getAccountType(acc.Account_Type).name}</p>
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${maxDPD > 90 ? 'bg-red-600 text-white' : maxDPD > 60 ? 'bg-red-500 text-white' : maxDPD > 30 ? 'bg-orange-500 text-white' : 'bg-amber-400 text-white'}`}>
                              Max {maxDPD} DPD
                            </span>
                            <p className="text-xs text-slate-500 mt-1">{dpdCount} delayed payment(s)</p>
                          </div>
                        </div>
                        <div className="mt-2">
                          <PaymentHeatmap history={history} months={24} />
                        </div>
                      </div>
                    );
                  })}
                {accounts.filter(acc => {
                  const history = acc.CAIS_Account_History || acc.payment_history || [];
                  return history.some(h => parseInt(h.Days_Past_Due) > 0);
                }).length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    <CheckCircle className="w-12 h-12 mx-auto text-emerald-300 mb-3" />
                    <p>No DPD issues found</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
        
        {/* Enquiries Tab */}
        <TabsContent value="enquiries" className="mt-6">
          <div className="space-y-4">
            {enquiries.length > 0 ? (
              enquiries.map((enq, idx) => (
                <div key={idx} className="bg-white rounded-xl border border-slate-100 p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-slate-900">{enq.Subscriber_Name || enq.institution || 'Unknown'}</p>
                      <p className="text-xs text-slate-500">{enq.Enquiry_Purpose || enq.purpose || 'Credit Application'}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-sm text-slate-600">{formatDate(enq.Date_of_Request || enq.date)}</p>
                      <p className="text-sm font-semibold text-slate-900">{formatINR(enq.Enquiry_Amount || enq.Amount_Financed || enq.amount)}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-12 text-slate-500">
                <Search className="w-12 h-12 mx-auto text-slate-300 mb-3" />
                <p>No enquiry details available</p>
              </div>
            )}
          </div>
        </TabsContent>
        
        {/* Profile Tab */}
        <TabsContent value="profile" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-slate-600" />
                Personal Information
              </h4>
              <div className="space-y-3">
                <DetailItem label="Name" value={personalInfo.name || personalInfo.First_Name ? `${personalInfo.First_Name || ''} ${personalInfo.Last_Name || ''}`.trim() : '-'} />
                <DetailItem label="PAN" value={personalInfo.pan || personalInfo.IncomeTaxPan || '-'} />
                <DetailItem label="Date of Birth" value={formatDate(personalInfo.Date_Of_Birth_Applicant || personalInfo.birth_date)} />
                <DetailItem label="Gender" value={personalInfo.gender || (personalInfo.Gender_Code === 1 ? 'Male' : personalInfo.Gender_Code === 2 ? 'Female' : '-')} />
              </div>
            </div>
            
            <div className="bg-white rounded-xl border border-slate-100 p-5">
              <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Phone className="w-5 h-5 text-slate-600" />
                Contact Information
              </h4>
              <div className="space-y-3">
                <DetailItem label="Mobile" value={personalInfo.MobilePhoneNumber || personalInfo.phone || '-'} />
                <DetailItem label="Email" value={personalInfo.EMailId || personalInfo.email || '-'} />
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ============= MAIN MODAL COMPONENT =============
export const CreditRiskDashboard = ({ isOpen, onClose, lead, pan: initialPan }) => {
  const [activeView, setActiveView] = useState('report');
  const [activeBureau, setActiveBureau] = useState(null);
  const [bureauData, setBureauData] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetchingBureau, setFetchingBureau] = useState(null);
  
  // OTP States
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [verifying, setVerifying] = useState(false);
  
  const bureaus = [
    { id: 'CIBIL', name: 'CIBIL', color: 'blue' },
    { id: 'Equifax', name: 'Equifax', color: 'purple' },
    { id: 'Experian', name: 'Experian', color: 'emerald' },
    { id: 'CRIF', name: 'CRIF', color: 'amber' },
  ];
  
  // Load existing reports
  useEffect(() => {
    if (isOpen && (initialPan || lead?.pan_number || lead?.pan)) {
      loadExistingReports();
    }
  }, [isOpen, initialPan, lead]);
  
  const loadExistingReports = async () => {
    const pan = initialPan || lead?.pan_number || lead?.pan;
    if (!pan) return;
    
    setLoading(true);
    try {
      const response = await loansApi.getLatestCreditReports(pan);
      if (response.data?.reports) {
        const reports = response.data.reports;
        const newBureauData = {};
        
        Object.entries(reports).forEach(([bureau, reportData]) => {
          if (reportData) {
            // Map lowercase API keys to frontend bureau IDs
            const bureauIdMap = {
              'cibil': 'CIBIL',
              'equifax': 'Equifax',
              'experian': 'Experian',
              'crif': 'CRIF'
            };
            const bureauId = bureauIdMap[bureau.toLowerCase()] || bureau;
            
            newBureauData[bureauId] = {
              score: reportData.credit_score,
              report: reportData.parsed_report || reportData.raw_report,
              fetchedAt: reportData.fetched_at,
              status: 'fetched'
            };
          }
        });
        
        setBureauData(newBureauData);
        
        // Set active bureau to first available
        const firstBureau = Object.keys(newBureauData)[0];
        if (firstBureau) setActiveBureau(firstBureau);
      }
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleFetchReport = async (bureauId) => {
    const pan = lead?.pan_number || lead?.pan;
    if (!pan) {
      toast.error('PAN number is required');
      return;
    }
    
    setFetchingBureau(bureauId);
    try {
      let response;
      const mobile = lead.customer_phone?.replace('+91', '').replace('+', '');
      
      switch (bureauId) {
        case 'CIBIL':
          response = await loansApi.fetchCibilReport({
            name: lead.customer_name,
            pan: pan,
            mobile: mobile,
            gender: lead.gender || 'male',
            consent: 'Y',
            loan_lead_id: lead.id
          });
          break;
        case 'Equifax':
          response = await loansApi.fetchEquifaxReport({
            name: lead.customer_name,
            id_number: pan,
            id_type: 'pan',
            mobile: mobile,
            consent: 'Y',
            loan_lead_id: lead.id
          });
          break;
        case 'Experian':
          response = await loansApi.fetchExperianReport({
            name: lead.customer_name,
            pan: pan,
            mobile: mobile,
            consent: 'Y',
            loan_lead_id: lead.id
          });
          break;
        case 'CRIF':
          response = await loansApi.fetchCrifReport({
            business_name: lead.customer_name,
            pan: pan,
            mobile: mobile,
            consent: 'Y',
            loan_lead_id: lead.id
          });
          break;
      }
      
      if (response.data?.success) {
        setBureauData(prev => ({
          ...prev,
          [bureauId]: {
            score: response.data.credit_score,
            report: response.data.parsed_report || response.data.credit_report,
            fetchedAt: new Date().toISOString(),
            status: 'fetched'
          }
        }));
        setActiveBureau(bureauId);
        toast.success(`${bureauId} report fetched successfully`);
      } else {
        toast.error(response.data?.error || `Failed to fetch ${bureauId} report`);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || `Failed to fetch ${bureauId} report`);
    } finally {
      setFetchingBureau(null);
    }
  };
  
  const handleFetchAll = async () => {
    for (const bureau of bureaus) {
      if (!bureauData[bureau.id]?.status) {
        await handleFetchReport(bureau.id);
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] w-[1400px] max-h-[95vh] p-0 overflow-hidden bg-slate-50">
        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <div className="p-2 bg-slate-900 rounded-lg">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Credit Risk Assessment</h2>
              <p className="text-sm text-slate-500">
                {lead?.customer_name} • PAN: {lead?.pan_number || lead?.pan || 'Not provided'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              onClick={handleFetchAll}
              disabled={loading || fetchingBureau}
              data-testid="fetch-all-btn"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${fetchingBureau ? 'animate-spin' : ''}`} />
              Fetch All Reports
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} data-testid="close-modal-btn">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>
        
        {/* Content */}
        <div className="flex h-[calc(95vh-80px)]">
          {/* Bureau Sidebar */}
          <div className="w-64 bg-white border-r border-slate-200 p-4 overflow-y-auto">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Credit Bureaus</p>
            <div className="space-y-2">
              {bureaus.map(bureau => {
                const data = bureauData[bureau.id];
                const isActive = activeBureau === bureau.id;
                const isFetching = fetchingBureau === bureau.id;
                
                return (
                  <div
                    key={bureau.id}
                    className={`p-3 rounded-xl cursor-pointer transition-all ${
                      isActive 
                        ? `bg-${bureau.color}-50 border-2 border-${bureau.color}-200` 
                        : 'bg-slate-50 border-2 border-transparent hover:border-slate-200'
                    }`}
                    onClick={() => data?.status && setActiveBureau(bureau.id)}
                    data-testid={`bureau-${bureau.id}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900">{bureau.name}</span>
                      {data?.status === 'fetched' && (
                        <span className={`text-xl font-mono font-bold text-${bureau.color}-600`}>
                          {data.score}
                        </span>
                      )}
                    </div>
                    
                    {data?.status === 'fetched' ? (
                      <div className="flex items-center gap-1 mt-1">
                        <CheckCircle className="w-3 h-3 text-emerald-500" />
                        <span className="text-xs text-slate-500">Saved</span>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 w-full"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleFetchReport(bureau.id);
                        }}
                        disabled={isFetching || !(lead?.pan_number || lead?.pan)}
                      >
                        {isFetching ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          'Fetch Report'
                        )}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Main Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
              </div>
            ) : activeBureau && bureauData[activeBureau]?.report ? (
              <CreditRiskBureauView
                report={bureauData[activeBureau].report}
                creditScore={bureauData[activeBureau].score}
                bureauName={activeBureau}
                bureauColor={bureaus.find(b => b.id === activeBureau)?.color || 'slate'}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-500">
                <ShieldCheck className="w-16 h-16 text-slate-300 mb-4" />
                <p className="text-lg font-medium">No Credit Report Selected</p>
                <p className="text-sm">Select a bureau from the sidebar or fetch a new report</p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreditRiskDashboard;
