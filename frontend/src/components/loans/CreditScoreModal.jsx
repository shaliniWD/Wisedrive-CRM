import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { loansApi } from '@/services/api';
import { toast } from 'sonner';
import {
  ShieldCheck, AlertCircle, CreditCard, User,
  Phone, MapPin, Building2, Search, Eye, X, Loader2,
  ChevronDown, CheckCircle, ArrowRight, RefreshCw,
  Download, FileText, AlertTriangle, Lock, Activity, Info,
  XCircle, Ban, Filter
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent,
} from '@/components/ui/dialog';

// Sample data with MORE realistic scenarios including defaults, write-offs, missed payments
const SAMPLE_EQUIFAX_REPORT = {
  creditScore: 742,
  CreditProfileHeader: { ReportDate: 20260228, ReportNumber: 'EQF-2026-001234' },
  SCORE: { FCIREXScore: 742, FCIREXScoreConfidLevel: 'HIGH' },
  CAIS_Account: {
    CAIS_Summary: {
      Credit_Account: { CreditAccountTotal: 7, CreditAccountActive: 4, CreditAccountClosed: 2, CreditAccountDefault: 1 },
      Total_Outstanding_Balance: { Outstanding_Balance_All: 535000, Outstanding_Balance_Secured: 400000, Outstanding_Balance_UnSecured: 135000 }
    },
    CAIS_Account_DETAILS: [
      // Active accounts
      { Subscriber_Name: 'HDFC Bank', Account_Type: '10', Account_Number: '4532XXXXXXXX1234', Account_Status: '11', Current_Balance: 45000, Highest_Credit_or_Original_Loan_Amount: 100000, Open_Date: 20220315, Date_of_Last_Payment: 20260215, Amount_Past_Due: 0, CAIS_Account_History: [{Month: '02', Year: '2026', Days_Past_Due: 0}, {Month: '01', Year: '2026', Days_Past_Due: 0}, {Month: '12', Year: '2025', Days_Past_Due: 0}, {Month: '11', Year: '2025', Days_Past_Due: 0}, {Month: '10', Year: '2025', Days_Past_Due: 0}, {Month: '09', Year: '2025', Days_Past_Due: 0}] },
      { Subscriber_Name: 'ICICI Bank', Account_Type: '05', Account_Number: 'PL98XXXXXXXX5678', Account_Status: '11', Current_Balance: 180000, Highest_Credit_or_Original_Loan_Amount: 300000, Open_Date: 20230601, Date_of_Last_Payment: 20260220, Amount_Past_Due: 12500, CAIS_Account_History: [{Month: '02', Year: '2026', Days_Past_Due: 15}, {Month: '01', Year: '2026', Days_Past_Due: 0}, {Month: '12', Year: '2025', Days_Past_Due: 30}, {Month: '11', Year: '2025', Days_Past_Due: 0}, {Month: '10', Year: '2025', Days_Past_Due: 0}, {Month: '09', Year: '2025', Days_Past_Due: 45}] },
      { Subscriber_Name: 'Axis Bank Auto Loan', Account_Type: '01', Account_Number: 'AL76XXXXXXXX9012', Account_Status: '11', Current_Balance: 220000, Highest_Credit_or_Original_Loan_Amount: 500000, Open_Date: 20210901, Date_of_Last_Payment: 20260218, Amount_Past_Due: 0, CAIS_Account_History: [{Month: '02', Year: '2026', Days_Past_Due: 0}, {Month: '01', Year: '2026', Days_Past_Due: 0}, {Month: '12', Year: '2025', Days_Past_Due: 0}, {Month: '11', Year: '2025', Days_Past_Due: 0}, {Month: '10', Year: '2025', Days_Past_Due: 0}, {Month: '09', Year: '2025', Days_Past_Due: 0}] },
      { Subscriber_Name: 'Bajaj Finance EMI', Account_Type: '06', Account_Number: 'BF34XXXXXXXX7890', Account_Status: '11', Current_Balance: 25000, Highest_Credit_or_Original_Loan_Amount: 50000, Open_Date: 20250601, Date_of_Last_Payment: 20260215, Amount_Past_Due: 0, CAIS_Account_History: [{Month: '02', Year: '2026', Days_Past_Due: 0}, {Month: '01', Year: '2026', Days_Past_Due: 0}] },
      // Closed account (good standing)
      { Subscriber_Name: 'SBI Cards', Account_Type: '10', Account_Number: '5234XXXXXXXX3456', Account_Status: '13', Current_Balance: 0, Highest_Credit_or_Original_Loan_Amount: 75000, Open_Date: 20190315, Date_Closed: 20240601, Amount_Past_Due: 0, CAIS_Account_History: [] },
      // Written-off account (BAD)
      { Subscriber_Name: 'Kotak Credit Card', Account_Type: '10', Account_Number: '4567XXXXXXXX8901', Account_Status: '78', Current_Balance: 0, Highest_Credit_or_Original_Loan_Amount: 50000, Open_Date: 20180601, Date_Closed: 20220301, Written_Off_Amt_Total: 35000, Written_Off_Amt_Principal: 28000, Date_Written_Off: 20220301, Amount_Past_Due: 0, CAIS_Account_History: [{Month: '02', Year: '2022', Days_Past_Due: 180}, {Month: '01', Year: '2022', Days_Past_Due: 150}, {Month: '12', Year: '2021', Days_Past_Due: 120}] },
      // Default account (BAD)
      { Subscriber_Name: 'Home Credit Finance', Account_Type: '05', Account_Number: 'HC89XXXXXXXX2345', Account_Status: '97', Current_Balance: 65000, Highest_Credit_or_Original_Loan_Amount: 100000, Open_Date: 20200801, Date_of_Last_Payment: 20230515, Amount_Past_Due: 65000, Days_Past_Due: 180, SuitFiledWilfulDefault: 'Y', CAIS_Account_History: [{Month: '02', Year: '2026', Days_Past_Due: 180}, {Month: '01', Year: '2026', Days_Past_Due: 150}, {Month: '12', Year: '2025', Days_Past_Due: 120}, {Month: '11', Year: '2025', Days_Past_Due: 90}, {Month: '10', Year: '2025', Days_Past_Due: 60}, {Month: '09', Year: '2025', Days_Past_Due: 30}] }
    ]
  },
  TotalCAPS_Summary: { TotalCAPSLast7Days: 0, TotalCAPSLast30Days: 1, TotalCAPSLast90Days: 2, TotalCAPSLast180Days: 3 },
  CAPS: { CAPS_Summary: { CAPSLast7Days: 0, CAPSLast30Days: 1, CAPSLast90Days: 2, CAPSLast180Days: 3 } },
  NonCreditCAPS: { NonCreditCAPS_Summary: { NonCreditCAPSLast7Days: 1, NonCreditCAPSLast30Days: 2, NonCreditCAPSLast90Days: 4, NonCreditCAPSLast180Days: 6 } },
  Current_Application: { Current_Application_Details: { Current_Applicant_Details: { First_Name: 'RAJESH', Last_Name: 'SHARMA', Date_Of_Birth_Applicant: 19850515, Gender_Code: 1, IncomeTaxPan: 'ABCDE1234F', MobilePhoneNumber: '9876543210', EMailId: 'rajesh.sharma@email.com' }, Current_Applicant_Address_Details: { FlatNoPlotNoHouseNo: '123', BldgNoSocietyName: 'Sunshine Apartments', RoadNoNameAreaLocality: 'MG Road', City: 'Bangalore', PINCode: '560001' } } },
  Match_result: { Exact_match: 'Y' }
};

const SAMPLE_EXPERIAN_REPORT = {
  creditScore: 758,
  CreditProfileHeader: { ReportDate: 20260228, ReportNumber: 'EXP-2026-005678' },
  SCORE: { FCIREXScore: 758, BureauScore: 758, FCIREXScoreConfidLevel: 'VERY HIGH' },
  CAIS_Account: {
    CAIS_Summary: {
      Credit_Account: { CreditAccountTotal: 6, CreditAccountActive: 3, CreditAccountClosed: 2, CreditAccountDefault: 1 },
      Total_Outstanding_Balance: { Outstanding_Balance_All: 570000, Outstanding_Balance_Secured: 450000, Outstanding_Balance_UnSecured: 120000 }
    },
    CAIS_Account_DETAILS: [
      // Active - Housing Loan with some late payments
      { Subscriber_Name: 'Kotak Mahindra Bank', Account_Type: '02', Account_Number: 'HL45XXXXXXXX7890', Account_Status: '11', Current_Balance: 450000, Highest_Credit_or_Original_Loan_Amount: 2500000, Open_Date: 20200115, Date_of_Last_Payment: 20260210, Amount_Past_Due: 8500, CAIS_Account_History: [{Month: '02', Year: '2026', Days_Past_Due: 0}, {Month: '01', Year: '2026', Days_Past_Due: 15}, {Month: '12', Year: '2025', Days_Past_Due: 30}, {Month: '11', Year: '2025', Days_Past_Due: 0}, {Month: '10', Year: '2025', Days_Past_Due: 0}, {Month: '09', Year: '2025', Days_Past_Due: 0}] },
      // Active - Consumer Loan (good)
      { Subscriber_Name: 'Bajaj Finserv', Account_Type: '06', Account_Number: 'CL23XXXXXXXX4567', Account_Status: '11', Current_Balance: 35000, Highest_Credit_or_Original_Loan_Amount: 80000, Open_Date: 20240801, Date_of_Last_Payment: 20260212, Amount_Past_Due: 0, CAIS_Account_History: [{Month: '02', Year: '2026', Days_Past_Due: 0}, {Month: '01', Year: '2026', Days_Past_Due: 0}, {Month: '12', Year: '2025', Days_Past_Due: 0}] },
      // Active - Credit Card (good)
      { Subscriber_Name: 'HDFC Bank Credit Card', Account_Type: '10', Account_Number: '4147XXXXXXXX8901', Account_Status: '11', Current_Balance: 35000, Highest_Credit_or_Original_Loan_Amount: 150000, Open_Date: 20210601, Date_of_Last_Payment: 20260205, Amount_Past_Due: 0, CAIS_Account_History: [{Month: '02', Year: '2026', Days_Past_Due: 0}, {Month: '01', Year: '2026', Days_Past_Due: 0}, {Month: '12', Year: '2025', Days_Past_Due: 0}, {Month: '11', Year: '2025', Days_Past_Due: 0}] },
      // Closed - Personal Loan (settled for less - CAUTION)
      { Subscriber_Name: 'IndusInd Bank', Account_Type: '05', Account_Number: 'PL67XXXXXXXX2345', Account_Status: '13', Current_Balance: 0, Highest_Credit_or_Original_Loan_Amount: 200000, Open_Date: 20180901, Date_Closed: 20230301, Settlement_Amount: 150000, Amount_Past_Due: 0, CAIS_Account_History: [] },
      // Closed - Two Wheeler Loan (good)
      { Subscriber_Name: 'Tata Capital', Account_Type: '13', Account_Number: 'TW89XXXXXXXX6789', Account_Status: '13', Current_Balance: 0, Highest_Credit_or_Original_Loan_Amount: 85000, Open_Date: 20190601, Date_Closed: 20220601, Amount_Past_Due: 0, CAIS_Account_History: [] },
      // Default - Credit Card (BAD)
      { Subscriber_Name: 'ICICI Bank Credit Card', Account_Type: '10', Account_Number: '5432XXXXXXXX1098', Account_Status: '97', Current_Balance: 50000, Highest_Credit_or_Original_Loan_Amount: 75000, Open_Date: 20190301, Date_of_Last_Payment: 20230801, Amount_Past_Due: 50000, Days_Past_Due: 270, SuitFiledWilfulDefault: 'N', CAIS_Account_History: [{Month: '02', Year: '2026', Days_Past_Due: 270}, {Month: '01', Year: '2026', Days_Past_Due: 240}, {Month: '12', Year: '2025', Days_Past_Due: 210}, {Month: '11', Year: '2025', Days_Past_Due: 180}, {Month: '10', Year: '2025', Days_Past_Due: 150}, {Month: '09', Year: '2025', Days_Past_Due: 120}] }
    ]
  },
  TotalCAPS_Summary: { TotalCAPSLast7Days: 1, TotalCAPSLast30Days: 2, TotalCAPSLast90Days: 4, TotalCAPSLast180Days: 5 },
  CAPS: { CAPS_Summary: { CAPSLast7Days: 1, CAPSLast30Days: 2, CAPSLast90Days: 4, CAPSLast180Days: 5 }, CAPS_Application_Details: [{ Subscriber_Name: 'HDFC Bank', Amount_Financed: 500000, Date_of_Request: 20260215 }] },
  NonCreditCAPS: { NonCreditCAPS_Summary: { NonCreditCAPSLast7Days: 0, NonCreditCAPSLast30Days: 1, NonCreditCAPSLast90Days: 3, NonCreditCAPSLast180Days: 5 } },
  Current_Application: { Current_Application_Details: { Current_Applicant_Details: { First_Name: 'RAJESH', Last_Name: 'SHARMA', Date_Of_Birth_Applicant: 19850515, Gender_Code: 1, IncomeTaxPan: 'ABCDE1234F', MobilePhoneNumber: '9876543210', EMailId: 'rajesh.sharma@email.com' }, Current_Applicant_Address_Details: { FlatNoPlotNoHouseNo: '123', BldgNoSocietyName: 'Sunshine Apartments', RoadNoNameAreaLocality: 'MG Road', City: 'Bangalore', PINCode: '560001' } } },
  Match_result: { Exact_match: 'Y' }
};

// REDESIGNED Score Card - Clean layout without overlap
const ScoreCard = ({ score, bureauName, bureauColor, reportDate, reportNumber }) => {
  const getScoreColor = (s) => {
    if (s >= 750) return { bg: 'bg-emerald-500', text: 'text-emerald-600', label: 'Excellent', risk: 'Low Risk' };
    if (s >= 700) return { bg: 'bg-blue-500', text: 'text-blue-600', label: 'Good', risk: 'Moderate' };
    if (s >= 650) return { bg: 'bg-amber-500', text: 'text-amber-600', label: 'Fair', risk: 'Medium' };
    if (s >= 550) return { bg: 'bg-orange-500', text: 'text-orange-600', label: 'Poor', risk: 'High' };
    return { bg: 'bg-red-500', text: 'text-red-600', label: 'Very Poor', risk: 'Very High' };
  };
  
  const colors = getScoreColor(score);
  const percentage = Math.max(0, Math.min(100, ((score - 300) / 600) * 100));
  
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
      {/* Bureau Header */}
      <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
        <div className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full text-xs font-semibold ${bureauColor}`}>
          <span className="w-2 h-2 rounded-full bg-current opacity-80"></span>
          {bureauName}
        </div>
        {reportDate && <span className="text-xs text-slate-400">{formatDateFromNum(reportDate)}</span>}
      </div>
      
      {/* Score Display - Clean Layout */}
      <div className="p-4">
        <div className="flex items-center gap-4">
          {/* Big Score Number */}
          <div className="text-center">
            <motion.div 
              className="text-5xl font-bold text-slate-900 tabular-nums"
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              {score}
            </motion.div>
            <div className={`text-sm font-semibold uppercase tracking-wider mt-1 ${colors.text}`}>
              {colors.label}
            </div>
          </div>
          
          {/* Score Bar Visualization */}
          <div className="flex-1">
            <div className="flex justify-between text-xs text-slate-400 mb-1">
              <span>300</span>
              <span>900</span>
            </div>
            <div className="h-3 bg-gradient-to-r from-red-200 via-amber-200 via-emerald-200 to-emerald-300 rounded-full overflow-hidden relative">
              <motion.div 
                className="absolute top-0 bottom-0 w-1 bg-slate-900 rounded-full shadow-lg"
                initial={{ left: '0%' }}
                animate={{ left: `${percentage}%` }}
                transition={{ duration: 1, ease: 'easeOut' }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-400 mt-1">
              <span>Poor</span>
              <span>Fair</span>
              <span>Good</span>
              <span>Excellent</span>
            </div>
          </div>
        </div>
        
        {/* Risk Level */}
        <div className="flex items-center gap-2 mt-4 p-2.5 bg-slate-50 rounded-lg">
          <div className={`w-3 h-3 rounded-full ${colors.bg}`} />
          <span className="text-sm font-semibold text-slate-900">{colors.risk}</span>
          <span className="text-xs text-slate-500">• Repayment probability assessment</span>
        </div>
      </div>
      
      {/* Report Number Footer */}
      {reportNumber && (
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 text-xs text-slate-400 text-center">
          Report #{reportNumber}
        </div>
      )}
    </div>
  );
};

// Data Card Component
const DataCard = ({ label, value, icon: Icon, alert, className = '' }) => (
  <div className={`bg-white p-3 rounded-xl border ${alert ? 'border-red-200 bg-red-50' : 'border-slate-100'} shadow-sm ${className}`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
        <p className={`text-xl font-bold mt-1 ${alert ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
      </div>
      {Icon && <div className={`p-1.5 rounded-lg ${alert ? 'bg-red-100' : 'bg-slate-50'}`}><Icon className={`h-4 w-4 ${alert ? 'text-red-600' : 'text-slate-600'}`} /></div>}
    </div>
  </div>
);

// Format currency
const formatINR = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
};

// Format date from YYYYMMDD
const formatDateFromNum = (dateNum) => {
  if (!dateNum) return '-';
  const str = String(dateNum);
  if (str.length === 8) return `${str.slice(6,8)}/${str.slice(4,6)}/${str.slice(0,4)}`;
  return str;
};

// Account Type Config
const getAccountTypeConfig = (code) => {
  const types = {
    '01': { name: 'Auto Loan', icon: '🚗' }, '02': { name: 'Housing Loan', icon: '🏠' },
    '05': { name: 'Personal Loan', icon: '💰' }, '06': { name: 'Consumer Loan', icon: '🛒' },
    '10': { name: 'Credit Card', icon: '💳' }, '13': { name: 'Two-Wheeler', icon: '🛵' },
  };
  return types[String(code).padStart(2, '0')] || { name: `Loan Type ${code}`, icon: '📄' };
};

// Account Status Config
const getAccountStatus = (status, account) => {
  // Check for written off
  if (account.Written_Off_Amt_Total > 0 || status === '78' || status === '89') {
    return { label: 'Written Off', color: 'bg-red-600 text-white', severity: 'critical' };
  }
  // Check for default/suit filed
  if (status === '97' || status === '98' || account.SuitFiledWilfulDefault === 'Y') {
    return { label: 'Default', color: 'bg-red-500 text-white', severity: 'critical' };
  }
  // Check for settlement
  if (account.Settlement_Amount > 0) {
    return { label: 'Settled', color: 'bg-orange-500 text-white', severity: 'warning' };
  }
  // Closed
  if (status === '13' || status === '14' || status === '15') {
    return { label: 'Closed', color: 'bg-slate-500 text-white', severity: 'normal' };
  }
  // Check for overdue
  if (account.Amount_Past_Due > 0 || account.Days_Past_Due > 30) {
    return { label: 'Overdue', color: 'bg-orange-500 text-white', severity: 'warning' };
  }
  // Active/Current
  return { label: 'Active', color: 'bg-emerald-500 text-white', severity: 'good' };
};

// Payment History Bar with Legend
const PaymentHistoryBar = ({ history }) => {
  if (!history || history.length === 0) return null;
  
  const getStatusColor = (dpd) => {
    if (dpd === 0 || dpd === '0' || dpd === 'STD') return { bg: 'bg-emerald-500', label: 'On Time' };
    if (dpd === '?' || dpd === 'XXX' || dpd === 'NEW') return { bg: 'bg-slate-300', label: 'No Data' };
    const days = parseInt(dpd);
    if (isNaN(days)) return { bg: 'bg-slate-300', label: 'N/A' };
    if (days <= 30) return { bg: 'bg-amber-500', label: '1-30 DPD' };
    if (days <= 60) return { bg: 'bg-orange-500', label: '31-60 DPD' };
    if (days <= 90) return { bg: 'bg-red-400', label: '61-90 DPD' };
    return { bg: 'bg-red-600', label: '90+ DPD' };
  };
  
  // Count missed payments
  const missedCount = history.filter(h => parseInt(h.Days_Past_Due) > 0).length;
  
  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-slate-500">Payment History (Last {history.length} months)</p>
        {missedCount > 0 && (
          <span className="text-xs font-medium text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
            {missedCount} missed
          </span>
        )}
      </div>
      <div className="flex gap-0.5">
        {history.slice(0, 12).map((h, i) => {
          const status = getStatusColor(h.Days_Past_Due);
          return (
            <div key={i} className="flex-1 flex flex-col items-center group relative">
              <div className={`w-full h-5 rounded-sm ${status.bg} cursor-pointer`} />
              <span className="text-[7px] text-slate-400 mt-0.5">{h.Month}</span>
              {/* Tooltip */}
              <div className="absolute bottom-full mb-1 hidden group-hover:block z-10">
                <div className="bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                  {h.Month}/{h.Year}: {h.Days_Past_Due || 0} days late
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-2 text-[9px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-sm" />On Time</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-sm" />1-30</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-orange-500 rounded-sm" />31-60</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-400 rounded-sm" />61-90</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-600 rounded-sm" />90+</span>
      </div>
    </div>
  );
};

// Single Bureau Report View
const BureauReportView = ({ report, bureauName, bureauColor }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedAccounts, setExpandedAccounts] = useState({});
  const [accountFilter, setAccountFilter] = useState('all'); // all, active, closed, problem
  
  // Normalize data across different bureau formats
  // CIBIL uses: score_info, accounts, enquiries, summary
  // Equifax uses: SCORE, CAIS_Account, CAPS
  // Experian uses: similar to Equifax
  
  // Extract score - handle all formats
  const score = report?.score_info?.score 
    || report?.SCORE?.FCIREXScore 
    || report?.SCORE?.BureauScore 
    || report?.creditScore 
    || 0;
  
  // Extract accounts - handle all formats
  const accounts = report?.accounts 
    || report?.CAIS_Account?.CAIS_Account_DETAILS 
    || [];
  
  // Extract enquiries
  const enquiries = report?.enquiries 
    || report?.CAPS?.CAPS_Application_Details 
    || [];
  
  // Extract summary data
  const summary = report?.summary || {};
  const caisSummary = report?.CAIS_Account?.CAIS_Summary || {};
  const creditAccount = caisSummary?.Credit_Account || {};
  const outstanding = caisSummary?.Total_Outstanding_Balance || {};
  const capsData = report?.CAPS || {};
  const nonCreditCaps = report?.NonCreditCAPS || {};
  const totalCaps = report?.TotalCAPS_Summary || {};
  const currentApp = report?.Current_Application?.Current_Application_Details || {};
  const profileHeader = report?.CreditProfileHeader || {};
  const scoreData = report?.SCORE || report?.score_info || {};
  
  // Extract personal info - handle all formats
  const personalInfo = report?.personal_info || {};
  const idInfo = report?.id_info || [];
  const phoneInfo = report?.phone_info || [];
  const addressInfo = report?.address_info || [];
  
  // Calculate summary from accounts if not provided
  const totalAccounts = summary?.total_accounts || creditAccount?.CreditAccountTotal || accounts.length;
  const activeAccounts = summary?.active_accounts || creditAccount?.CreditAccountActive || 0;
  const closedAccounts = totalAccounts - activeAccounts;
  const totalBalance = summary?.total_balance || outstanding?.Outstanding_Balance_All || 0;
  const totalOverdueAmt = summary?.total_overdue || outstanding?.Outstanding_Balance_All_Overdue || 0;
  
  // Calculate problem accounts (defaults, write-offs, overdue)
  const problemAccounts = accounts.filter(acc => {
    // Handle CIBIL format
    if (acc.credit_status === 'Written-off' || acc.amount_overdue > 0) return true;
    // Handle Equifax format
    const status = getAccountStatus(acc.Account_Status, acc);
    return status.severity === 'critical' || status.severity === 'warning';
  });
  
  // Calculate total overdue amount
  const totalOverdue = accounts.reduce((sum, acc) => {
    return sum + (parseInt(acc.amount_overdue) || acc.Amount_Past_Due || 0);
  }, 0);
  const totalWrittenOff = accounts.reduce((sum, acc) => {
    return sum + (parseInt(acc.written_off_amount) || acc.Written_Off_Amt_Total || 0);
  }, 0);
  
  // Filter accounts
  const filteredAccounts = accounts.filter(acc => {
    if (accountFilter === 'all') return true;
    // Handle CIBIL format
    if (acc.credit_status) {
      if (accountFilter === 'active') return !acc.credit_status || acc.credit_status === 'Active';
      if (accountFilter === 'closed') return acc.credit_status === 'Closed' || acc.credit_status === 'Settled';
      if (accountFilter === 'problem') return acc.credit_status === 'Written-off' || parseInt(acc.amount_overdue) > 0;
    }
    // Handle Equifax format
    const status = getAccountStatus(acc.Account_Status, acc);
    if (accountFilter === 'active') return status.label === 'Active' || status.label === 'Overdue';
    if (accountFilter === 'closed') return status.label === 'Closed' || status.label === 'Settled';
    if (accountFilter === 'problem') return status.severity === 'critical' || status.severity === 'warning';
    return true;
  });
  
  const tabs = [
    { id: 'overview', label: 'Overview', icon: Eye },
    { id: 'accounts', label: 'Accounts', icon: Building2, count: accounts.length },
    { id: 'enquiries', label: 'Enquiries', icon: Search, count: enquiries.length },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'raw', label: 'Raw Data', icon: FileText },
  ];
  
  const toggleAccount = (idx) => setExpandedAccounts(prev => ({ ...prev, [idx]: !prev[idx] }));
  
  return (
    <div className="space-y-4">
      {/* Score Header - REDESIGNED */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Score Card - NEW CLEAN DESIGN */}
        <div className="lg:col-span-4">
          <ScoreCard 
            score={score} 
            bureauName={bureauName} 
            bureauColor={bureauColor}
            reportDate={profileHeader.ReportDate}
            reportNumber={profileHeader.ReportNumber}
          />
        </div>
        
        {/* Summary Cards */}
        <div className="lg:col-span-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <DataCard label="Total Accounts" value={totalAccounts} icon={Building2} />
            <DataCard label="Active" value={activeAccounts} icon={CheckCircle} />
            <DataCard label="Closed" value={closedAccounts} icon={Lock} />
            <DataCard 
              label="Defaults" 
              value={problemAccounts.length} 
              icon={AlertTriangle}
              alert={problemAccounts.length > 0}
            />
          </div>
          
          {/* Outstanding Balances */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl p-4 text-white">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Outstanding</p>
              <p className="text-2xl font-bold mt-1">{formatINR(totalBalance)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-100">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Secured</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatINR(outstanding.Outstanding_Balance_Secured || 0)}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-slate-100">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Unsecured</p>
              <p className="text-xl font-bold text-slate-900 mt-1">{formatINR(outstanding.Outstanding_Balance_UnSecured || 0)}</p>
            </div>
          </div>
          
          {/* Problem Indicators - NEW */}
          {(totalOverdue > 0 || totalWrittenOff > 0 || problemAccounts.length > 0) && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                <span className="text-sm font-semibold text-red-800">Warning Indicators</span>
              </div>
              <div className="flex flex-wrap gap-3 text-sm">
                {totalOverdue > 0 && (
                  <span className="text-red-700">
                    <strong>Overdue:</strong> {formatINR(totalOverdue)}
                  </span>
                )}
                {totalWrittenOff > 0 && (
                  <span className="text-red-700">
                    <strong>Written Off:</strong> {formatINR(totalWrittenOff)}
                  </span>
                )}
                {problemAccounts.length > 0 && (
                  <span className="text-red-700">
                    <strong>Problem Accounts:</strong> {problemAccounts.length}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.count > 0 && <span className="text-xs bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full">{tab.count}</span>}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="min-h-[300px] max-h-[350px] overflow-y-auto">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-3">
            {/* Strengths & Concerns */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
                <div className="flex items-center gap-2 mb-2"><CheckCircle className="h-5 w-5 text-emerald-600" /><h4 className="font-semibold text-emerald-900">Strengths</h4></div>
                <ul className="space-y-1 text-sm text-emerald-800">
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />{creditAccount.CreditAccountActive || 0} Active credit accounts</li>
                  <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />{creditAccount.CreditAccountClosed || 0} Successfully closed accounts</li>
                  {score >= 700 && <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />Good credit score ({score})</li>}
                </ul>
              </div>
              <div className="bg-red-50 rounded-xl p-4 border border-red-100">
                <div className="flex items-center gap-2 mb-2"><AlertTriangle className="h-5 w-5 text-red-600" /><h4 className="font-semibold text-red-900">Concerns</h4></div>
                <ul className="space-y-1 text-sm text-red-800">
                  {(creditAccount.CreditAccountDefault || 0) > 0 && <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-500 rounded-full" /><strong>{creditAccount.CreditAccountDefault}</strong> Default account(s)</li>}
                  {totalOverdue > 0 && <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-500 rounded-full" />Overdue: <strong>{formatINR(totalOverdue)}</strong></li>}
                  {totalWrittenOff > 0 && <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-500 rounded-full" />Written Off: <strong>{formatINR(totalWrittenOff)}</strong></li>}
                  {(totalCaps.TotalCAPSLast30Days || 0) > 3 && <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-500 rounded-full" />High recent enquiries ({totalCaps.TotalCAPSLast30Days})</li>}
                  {score < 650 && <li className="flex items-center gap-2"><span className="w-1.5 h-1.5 bg-red-500 rounded-full" />Low credit score</li>}
                  {problemAccounts.length === 0 && totalOverdue === 0 && totalWrittenOff === 0 && <li className="text-slate-500">No major concerns</li>}
                </ul>
              </div>
            </div>
            
            {/* Enquiries Timeline */}
            <div className="bg-white rounded-xl p-4 border border-slate-100">
              <h4 className="font-semibold text-slate-900 mb-3">Credit Enquiries Timeline</h4>
              <div className="grid grid-cols-4 gap-3">
                {[{ label: '7 Days', value: totalCaps.TotalCAPSLast7Days || 0 }, { label: '30 Days', value: totalCaps.TotalCAPSLast30Days || 0 }, { label: '90 Days', value: totalCaps.TotalCAPSLast90Days || 0 }, { label: '180 Days', value: totalCaps.TotalCAPSLast180Days || 0 }].map((item, i) => (
                  <div key={i} className="text-center p-3 bg-slate-50 rounded-xl">
                    <p className={`text-2xl font-bold ${item.value > 3 ? 'text-orange-600' : 'text-slate-900'}`}>{item.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {/* Accounts Tab - ENHANCED with filters */}
        {activeTab === 'accounts' && (
          <div className="space-y-3">
            {/* Account Filters */}
            <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg flex-wrap">
              <Filter className="h-4 w-4 text-slate-500" />
              <span className="text-xs text-slate-500 mr-2">Filter:</span>
              {[
                { id: 'all', label: 'All', count: accounts.length },
                { id: 'active', label: 'Active', count: accounts.filter(a => 
                  (!a.credit_status || a.credit_status === 'Active') && 
                  (['11', '21', '31'].includes(a.Account_Status) || !a.Account_Status)
                ).length },
                { id: 'closed', label: 'Closed', count: accounts.filter(a => 
                  a.credit_status === 'Closed' || a.credit_status === 'Settled' ||
                  ['13', '14', '15'].includes(a.Account_Status)
                ).length },
                { id: 'problem', label: 'Problem', count: problemAccounts.length, alert: problemAccounts.length > 0 },
              ].map(filter => (
                <button
                  key={filter.id}
                  onClick={() => setAccountFilter(filter.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    accountFilter === filter.id
                      ? filter.alert ? 'bg-red-500 text-white' : 'bg-white shadow-sm text-slate-900'
                      : filter.alert ? 'text-red-600 hover:bg-red-100' : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  {filter.label} ({filter.count})
                </button>
              ))}
            </div>
            
            {/* Account List */}
            {filteredAccounts.length > 0 ? filteredAccounts.map((account, idx) => {
              const isExpanded = expandedAccounts[idx];
              
              // Handle both CIBIL and Equifax formats
              const accountType = account.type || account.Account_Type || 'Unknown';
              const memberName = account.member || account.Subscriber_Name || 'Unknown';
              const accountNumber = account.account_number || account.Account_Number || '';
              const currentBalance = parseInt(account.current_balance) || account.Current_Balance || 0;
              const amountOverdue = parseInt(account.amount_overdue) || account.Amount_Past_Due || 0;
              const writtenOffAmt = parseInt(account.written_off_amount) || account.Written_Off_Amt_Total || 0;
              const highCredit = parseInt(account.high_credit) || account.Highest_Credit_or_Original_Loan_Amount || 0;
              const dateOpened = account.date_opened || account.Open_Date;
              const dateReported = account.date_reported || account.Date_Reported;
              const lastPaymentDate = account.last_payment_date || account.Payment_Date;
              const creditStatus = account.credit_status || '';
              const paymentHistory = account.payment_history || '';
              
              // Determine status
              const hasOverdue = amountOverdue > 0;
              const hasWriteOff = writtenOffAmt > 0 || creditStatus === 'Written-off';
              const isClosed = creditStatus === 'Closed' || creditStatus === 'Settled' || ['13', '14', '15'].includes(account.Account_Status);
              
              const status = hasWriteOff ? { label: 'Written-off', color: 'bg-red-100 text-red-700', severity: 'critical' }
                : hasOverdue ? { label: 'Overdue', color: 'bg-orange-100 text-orange-700', severity: 'warning' }
                : isClosed ? { label: 'Closed', color: 'bg-slate-100 text-slate-700', severity: 'normal' }
                : { label: 'Active', color: 'bg-green-100 text-green-700', severity: 'normal' };
              
              return (
                <div key={idx} className={`bg-white rounded-xl border overflow-hidden ${
                  status.severity === 'critical' ? 'border-red-300' : 
                  status.severity === 'warning' ? 'border-orange-300' : 'border-slate-100'
                }`}>
                  <button onClick={() => toggleAccount(idx)} className="w-full p-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                        status.severity === 'critical' ? 'bg-red-100' : 
                        status.severity === 'warning' ? 'bg-orange-100' : 'bg-slate-100'
                      }`}>
                        {status.severity === 'critical' ? <XCircle className="h-5 w-5 text-red-500" /> : 
                         status.severity === 'warning' ? <AlertTriangle className="h-5 w-5 text-orange-500" /> : 
                         <Building2 className="h-5 w-5 text-slate-500" />}
                      </div>
                      <div className="text-left">
                        <p className="font-semibold text-slate-900 text-sm">{memberName}</p>
                        <p className="text-xs text-slate-500">{accountType} {accountNumber && `• ****${accountNumber.slice(-4)}`}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className={`font-bold text-sm ${hasOverdue || hasWriteOff ? 'text-red-600' : 'text-slate-900'}`}>
                          {formatINR(currentBalance)}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </button>
                  
                  {isExpanded && (
                    <div className="p-4 bg-slate-50 border-t border-slate-100">
                      {/* Account Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                        <div>
                          <p className="text-slate-500">High Credit / Sanctioned</p>
                          <p className="font-semibold">{formatINR(highCredit)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Current Balance</p>
                          <p className="font-semibold">{formatINR(currentBalance)}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Date Opened</p>
                          <p className="font-semibold">{dateOpened || '-'}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Last Reported</p>
                          <p className="font-semibold">{dateReported || '-'}</p>
                        </div>
                      </div>
                      
                      {/* Overdue/Write-off Alert */}
                      {(hasOverdue || hasWriteOff) && (
                        <div className="mt-3 p-3 bg-red-100 rounded-lg border border-red-200">
                          <div className="flex items-center gap-2 text-red-800 font-semibold text-sm mb-2">
                            <AlertTriangle className="h-4 w-4" />
                            {hasWriteOff ? 'Account Written Off' : 'Payment Overdue'}
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            {hasOverdue && (
                              <div>
                                <p className="text-red-700">Amount Overdue</p>
                                <p className="font-bold text-red-800">{formatINR(amountOverdue)}</p>
                              </div>
                            )}
                            {hasWriteOff && (
                              <div>
                                <p className="text-red-700">Written Off Amount</p>
                                <p className="font-bold text-red-800">{formatINR(writtenOffAmt)}</p>
                              </div>
                            )}
                            {lastPaymentDate && (
                              <div>
                                <p className="text-red-700">Last Payment</p>
                                <p className="font-bold text-red-800">{lastPaymentDate}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      {/* Payment History - CIBIL format */}
                      {paymentHistory && (
                        <div className="mt-3">
                          <p className="text-sm font-semibold text-slate-700 mb-2">Payment History (Last 36 months)</p>
                          <div className="flex flex-wrap gap-1">
                            {paymentHistory.match(/.{1,3}/g)?.slice(0, 36).map((code, i) => {
                              const dpd = parseInt(code) || 0;
                              let color = 'bg-green-400';
                              if (dpd >= 180) color = 'bg-red-600';
                              else if (dpd >= 90) color = 'bg-red-400';
                              else if (dpd >= 60) color = 'bg-orange-500';
                              else if (dpd >= 30) color = 'bg-orange-400';
                              else if (dpd > 0) color = 'bg-yellow-400';
                              return (
                                <div key={i} className={`w-5 h-5 rounded ${color}`} title={`Month ${i+1}: ${dpd} DPD`} />
                              );
                            })}
                          </div>
                          <div className="flex gap-3 mt-2 text-xs text-slate-500">
                            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-green-400 rounded" /> On-time</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-yellow-400 rounded" /> 1-29 DPD</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-orange-400 rounded" /> 30-59 DPD</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-400 rounded" /> 60-89 DPD</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 bg-red-600 rounded" /> 90+ DPD</span>
                          </div>
                        </div>
                      )}
                      
                      {/* Equifax Payment History */}
                      {account.CAIS_Account_History && (
                        <PaymentHistoryBar history={account.CAIS_Account_History} />
                      )}
                    </div>
                  )}
                </div>
              );
            }) : (
              <div className="text-center py-8 text-slate-500">
                <Building2 className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                <p>No accounts match this filter</p>
              </div>
            )}
          </div>
        )}
                  </button>
                  
                  {isExpanded && (
                    <div className="p-3 pt-0 border-t border-slate-100 bg-slate-50">
                      {/* Account Details Grid */}
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 text-xs">
                        <div><p className="text-slate-500">Sanctioned</p><p className="font-semibold">{formatINR(account.Highest_Credit_or_Original_Loan_Amount || account.Credit_Limit_Amount)}</p></div>
                        <div><p className="text-slate-500">Balance</p><p className="font-semibold">{formatINR(account.Current_Balance)}</p></div>
                        <div>
                          <p className="text-slate-500">Past Due</p>
                          <p className={`font-semibold ${hasOverdue ? 'text-red-600' : ''}`}>{formatINR(account.Amount_Past_Due || 0)}</p>
                        </div>
                        <div><p className="text-slate-500">Opened</p><p className="font-semibold">{formatDateFromNum(account.Open_Date)}</p></div>
                        <div><p className="text-slate-500">Last Payment</p><p className="font-semibold">{formatDateFromNum(account.Date_of_Last_Payment)}</p></div>
                        <div><p className="text-slate-500">Closed</p><p className="font-semibold">{account.Date_Closed ? formatDateFromNum(account.Date_Closed) : '-'}</p></div>
                      </div>
                      
                      {/* Written Off Alert */}
                      {hasWriteOff && (
                        <div className="mt-3 p-3 bg-red-100 rounded-lg border border-red-200">
                          <div className="flex items-center gap-2 text-red-800 font-semibold text-sm">
                            <Ban className="h-4 w-4" />
                            Written Off Account
                          </div>
                          <div className="grid grid-cols-3 gap-3 mt-2 text-xs">
                            <div><p className="text-red-600">Total Written Off</p><p className="font-bold text-red-800">{formatINR(account.Written_Off_Amt_Total)}</p></div>
                            <div><p className="text-red-600">Principal</p><p className="font-bold text-red-800">{formatINR(account.Written_Off_Amt_Principal)}</p></div>
                            <div><p className="text-red-600">Date</p><p className="font-bold text-red-800">{formatDateFromNum(account.Date_Written_Off)}</p></div>
                          </div>
                        </div>
                      )}
                      
                      {/* Settlement Alert */}
                      {account.Settlement_Amount > 0 && (
                        <div className="mt-3 p-3 bg-orange-100 rounded-lg border border-orange-200">
                          <div className="flex items-center gap-2 text-orange-800 font-semibold text-sm">
                            <AlertTriangle className="h-4 w-4" />
                            Settled for Less Than Full Amount
                          </div>
                          <div className="grid grid-cols-2 gap-3 mt-2 text-xs">
                            <div><p className="text-orange-600">Original Amount</p><p className="font-bold text-orange-800">{formatINR(account.Highest_Credit_or_Original_Loan_Amount)}</p></div>
                            <div><p className="text-orange-600">Settlement Amount</p><p className="font-bold text-orange-800">{formatINR(account.Settlement_Amount)}</p></div>
                          </div>
                        </div>
                      )}
                      
                      {/* Default/Suit Filed Alert */}
                      {(account.SuitFiledWilfulDefault === 'Y' || account.Account_Status === '97') && (
                        <div className="mt-3 p-3 bg-red-100 rounded-lg border border-red-200">
                          <div className="flex items-center gap-2 text-red-800 font-semibold text-sm">
                            <XCircle className="h-4 w-4" />
                            {account.SuitFiledWilfulDefault === 'Y' ? 'Suit Filed / Wilful Default' : 'Account in Default'}
                          </div>
                          {account.Days_Past_Due > 0 && (
                            <p className="text-xs text-red-700 mt-1">Days Past Due: <strong>{account.Days_Past_Due}</strong></p>
                          )}
                        </div>
                      )}
                      
                      {/* Payment History */}
                      <PaymentHistoryBar history={account.CAIS_Account_History} />
                    </div>
                  )}
                </div>
              );
            }) : (
              <div className="text-center py-8 text-slate-500">
                <Building2 className="h-10 w-10 mx-auto mb-2 text-slate-300" />
                <p>No accounts match this filter</p>
              </div>
            )}
          </div>
        )}
        
        {/* Enquiries Tab */}
        {activeTab === 'enquiries' && (
          <div className="space-y-3">
            {/* Enquiries Summary */}
            <div className="bg-white rounded-xl p-4 border border-slate-100">
              <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><Search className="h-5 w-5 text-slate-600" />Credit Enquiries Timeline</h4>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label: '7 Days', value: capsData?.CAPS_Summary?.CAPSLast7Days ?? totalCaps.TotalCAPSLast7Days ?? 0 }, 
                  { label: '30 Days', value: capsData?.CAPS_Summary?.CAPSLast30Days ?? totalCaps.TotalCAPSLast30Days ?? 0 }, 
                  { label: '90 Days', value: capsData?.CAPS_Summary?.CAPSLast90Days ?? totalCaps.TotalCAPSLast90Days ?? 0 }, 
                  { label: '180 Days', value: capsData?.CAPS_Summary?.CAPSLast180Days ?? totalCaps.TotalCAPSLast180Days ?? summary.total_enquiries ?? enquiries.length ?? 0 }
                ].map((item, i) => (
                  <div key={i} className="text-center p-3 bg-slate-50 rounded-xl">
                    <p className={`text-2xl font-bold ${item.value > 3 ? 'text-orange-600' : 'text-slate-900'}`}>{item.value}</p>
                    <p className="text-xs text-slate-500 mt-1">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
            
            {/* Enquiries List - handles CIBIL format */}
            {enquiries.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-slate-100">
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><Eye className="h-5 w-5 text-blue-600" />Enquiry Details ({enquiries.length})</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {enquiries.map((enq, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 rounded-lg flex justify-between items-center">
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{enq.member || enq.Subscriber_Name || 'Unknown'}</p>
                        <p className="text-xs text-slate-500">{enq.purpose || enq.Purpose || 'Credit Application'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-slate-700">{enq.date || enq.Date_of_Request || '-'}</p>
                        {(enq.amount || enq.Amount) && (
                          <p className="text-xs text-slate-500">{formatINR(enq.amount || enq.Amount)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Non-Credit CAPS - Equifax specific */}
            {nonCreditCaps?.NonCreditCAPS_Summary && (
              <div className="bg-white rounded-xl p-4 border border-slate-100">
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><Eye className="h-5 w-5 text-blue-600" />Soft Enquiries</h4>
                <div className="grid grid-cols-4 gap-3">
                  {[{ label: '7 Days', value: nonCreditCaps.NonCreditCAPS_Summary.NonCreditCAPSLast7Days || 0 }, { label: '30 Days', value: nonCreditCaps.NonCreditCAPS_Summary.NonCreditCAPSLast30Days || 0 }, { label: '90 Days', value: nonCreditCaps.NonCreditCAPS_Summary.NonCreditCAPSLast90Days || 0 }, { label: '180 Days', value: nonCreditCaps.NonCreditCAPS_Summary.NonCreditCAPSLast180Days || 0 }].map((item, i) => (
                    <div key={i} className="text-center p-3 bg-blue-50 rounded-xl">
                      <p className="text-2xl font-bold text-blue-900">{item.value}</p>
                      <p className="text-xs text-blue-600 mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-3">
            {/* Personal Information - handles both formats */}
            {(personalInfo.name || currentApp.Current_Applicant_Details) && (
              <div className="bg-white rounded-xl p-4 border border-slate-100">
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><User className="h-5 w-5 text-slate-600" />Personal Information</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  <div><p className="text-slate-500">Full Name</p><p className="font-semibold text-slate-900">{personalInfo.name || `${currentApp.Current_Applicant_Details?.First_Name || ''} ${currentApp.Current_Applicant_Details?.Last_Name || ''}`.trim() || '-'}</p></div>
                  <div><p className="text-slate-500">Date of Birth</p><p className="font-semibold text-slate-900">{personalInfo.birth_date || formatDateFromNum(currentApp.Current_Applicant_Details?.Date_Of_Birth_Applicant) || '-'}</p></div>
                  <div><p className="text-slate-500">Gender</p><p className="font-semibold text-slate-900">{personalInfo.gender || (currentApp.Current_Applicant_Details?.Gender_Code === 1 ? 'Male' : 'Female') || '-'}</p></div>
                </div>
              </div>
            )}
            
            {/* ID Documents - handles CIBIL format */}
            {idInfo.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-slate-100">
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><CreditCard className="h-5 w-5 text-slate-600" />ID Documents</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  {idInfo.map((id, idx) => (
                    <div key={idx} className="p-2 bg-slate-50 rounded-lg">
                      <p className="text-slate-500 text-xs">{id.type || 'ID'}</p>
                      <p className="font-mono font-semibold text-slate-900">{id.number}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Phone Numbers - handles CIBIL format */}
            {phoneInfo.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-slate-100">
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><Phone className="h-5 w-5 text-slate-600" />Phone Numbers</h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                  {phoneInfo.map((phone, idx) => (
                    <div key={idx} className="p-2 bg-slate-50 rounded-lg">
                      <p className="text-slate-500 text-xs">{phone.type || 'Phone'}</p>
                      <p className="font-mono font-semibold text-slate-900">{phone.number}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Addresses - handles both formats */}
            {(addressInfo.length > 0 || currentApp.Current_Applicant_Address_Details) && (
              <div className="bg-white rounded-xl p-4 border border-slate-100">
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><MapPin className="h-5 w-5 text-slate-600" />Addresses</h4>
                {addressInfo.length > 0 ? (
                  <div className="space-y-3">
                    {addressInfo.map((addr, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg">
                        <div className="flex justify-between items-start mb-1">
                          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{addr.category || 'Address'}</span>
                          <span className="text-xs text-slate-500">{addr.date_reported}</span>
                        </div>
                        <p className="text-sm text-slate-700">{addr.line1}</p>
                        {addr.line2 && <p className="text-sm text-slate-700">{addr.line2}</p>}
                        <p className="text-sm text-slate-700">PIN: {addr.pin_code}</p>
                      </div>
                    ))}
                  </div>
                ) : currentApp.Current_Applicant_Address_Details && (
                  <div>
                    <p className="text-sm text-slate-700">{currentApp.Current_Applicant_Address_Details.FlatNoPlotNoHouseNo}, {currentApp.Current_Applicant_Address_Details.BldgNoSocietyName}</p>
                    <p className="text-sm text-slate-700">{currentApp.Current_Applicant_Address_Details.RoadNoNameAreaLocality}</p>
                    <p className="text-sm text-slate-700">{currentApp.Current_Applicant_Address_Details.City}, PIN: {currentApp.Current_Applicant_Address_Details.PINCode}</p>
                  </div>
                )}
              </div>
            )}
            
            {/* Score Analysis */}
            {scoreData && (
              <div className="bg-white rounded-xl p-4 border border-slate-100">
                <h4 className="font-semibold text-slate-900 mb-3 flex items-center gap-2"><Activity className="h-5 w-5 text-slate-600" />Score Analysis</h4>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600">Credit Score</span>
                  <span className={`text-2xl font-bold ${score >= 700 ? 'text-emerald-600' : score >= 600 ? 'text-amber-600' : 'text-red-600'}`}>{score}</span>
                </div>
                {scoreData.score_name && (
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg mt-2">
                    <span className="text-slate-600">Score Type</span>
                    <span className="font-semibold text-slate-900">{scoreData.score_name}</span>
                  </div>
                )}
                {scoreData.score_date && (
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg mt-2">
                    <span className="text-slate-600">Score Date</span>
                    <span className="font-semibold text-slate-900">{scoreData.score_date}</span>
                  </div>
                )}
                {scoreData.FCIREXScoreConfidLevel && (
                  <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg mt-2">
                    <span className="text-slate-600">Confidence</span>
                    <span className="font-semibold text-slate-900">{scoreData.FCIREXScoreConfidLevel}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        
        {/* Raw Data Tab */}
        {activeTab === 'raw' && (
          <div className="bg-slate-900 rounded-xl p-3 overflow-auto max-h-[350px]">
            <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap">{JSON.stringify(report, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
};

// Step 1: Customer Info Form
const CustomerInfoForm = ({ formData, setFormData, onSubmit, loading }) => (
  <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
    <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
      <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-amber-800">OTP Verification Required</p>
        <p className="text-sm text-amber-700 mt-1">An OTP will be sent to the customer's mobile. Reports from <strong>both Equifax & Experian</strong> will be fetched.</p>
      </div>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-1.5"><Label className="text-sm font-medium text-slate-700">First Name *</Label><Input data-testid="credit-first-name" value={formData.first_name} onChange={(e) => setFormData({...formData, first_name: e.target.value})} placeholder="Enter first name" className="h-10" /></div>
      <div className="space-y-1.5"><Label className="text-sm font-medium text-slate-700">Last Name *</Label><Input data-testid="credit-last-name" value={formData.last_name} onChange={(e) => setFormData({...formData, last_name: e.target.value})} placeholder="Enter last name" className="h-10" /></div>
      <div className="space-y-1.5"><Label className="text-sm font-medium text-slate-700">PAN Number *</Label><Input data-testid="credit-pan" value={formData.pan_number} onChange={(e) => setFormData({...formData, pan_number: e.target.value.toUpperCase()})} placeholder="ABCDE1234F" maxLength={10} className="h-10 uppercase font-mono" /></div>
      <div className="space-y-1.5"><Label className="text-sm font-medium text-slate-700">Date of Birth *</Label><Input data-testid="credit-dob" value={formData.dob} onChange={(e) => setFormData({...formData, dob: e.target.value.replace(/\D/g, '')})} placeholder="YYYYMMDD" maxLength={8} className="h-10 font-mono" /><p className="text-xs text-slate-400">Format: YYYYMMDD</p></div>
      <div className="space-y-1.5"><Label className="text-sm font-medium text-slate-700">Mobile Number *</Label><div className="flex"><span className="inline-flex items-center px-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-lg text-slate-600 text-sm">+91</span><Input data-testid="credit-mobile" value={formData.mobile_number} onChange={(e) => setFormData({...formData, mobile_number: e.target.value.replace(/\D/g, '')})} placeholder="9876543210" maxLength={10} className="h-10 rounded-l-none font-mono" /></div></div>
      <div className="space-y-1.5"><Label className="text-sm font-medium text-slate-700">Email *</Label><Input data-testid="credit-email" type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} placeholder="customer@email.com" className="h-10" /></div>
      <div className="space-y-1.5"><Label className="text-sm font-medium text-slate-700">Gender *</Label><Select value={formData.gender} onValueChange={(val) => setFormData({...formData, gender: val})}><SelectTrigger data-testid="credit-gender" className="h-10"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem></SelectContent></Select></div>
      <div className="space-y-1.5"><Label className="text-sm font-medium text-slate-700">PIN Code *</Label><Input data-testid="credit-pincode" value={formData.pin_code} onChange={(e) => setFormData({...formData, pin_code: e.target.value.replace(/\D/g, '')})} placeholder="560001" maxLength={6} className="h-10 font-mono" /></div>
    </div>
    <Button data-testid="credit-submit-btn" className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl" onClick={onSubmit} disabled={loading}>
      {loading ? <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" />Requesting OTP...</span> : <span className="flex items-center gap-2">Send OTP & Fetch Both Reports<ArrowRight className="h-5 w-5" /></span>}
    </Button>
  </motion.div>
);

// Step 2: OTP Verification
const OTPVerification = ({ mobile, onVerify, onBack, loading }) => {
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(60);
  useEffect(() => { if (countdown > 0) { const timer = setTimeout(() => setCountdown(countdown - 1), 1000); return () => clearTimeout(timer); } }, [countdown]);
  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="flex flex-col items-center py-6 space-y-6">
      <motion.div className="w-16 h-16 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}><Phone className="h-8 w-8 text-white" /></motion.div>
      <div className="text-center">
        <h3 className="text-lg font-bold text-slate-900">OTP Sent Successfully!</h3>
        <p className="text-slate-500 mt-1">Verification code sent to <span className="font-mono font-semibold">+91 {mobile}</span></p>
        <p className="text-sm text-slate-400 mt-1">Ask customer to share the OTP</p>
      </div>
      <div className="w-full max-w-xs">
        <Input data-testid="credit-otp-input" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} placeholder="Enter 6-digit OTP" maxLength={6} className="h-14 text-center text-2xl tracking-[0.5em] font-mono border-2" autoFocus />
      </div>
      {countdown > 0 ? <p className="text-sm text-slate-500">Resend in <span className="font-semibold text-blue-600">{countdown}s</span></p> : <button onClick={onBack} className="text-sm text-blue-600 hover:text-blue-700 font-medium">Request again</button>}
      <div className="flex gap-3 w-full max-w-xs">
        <Button data-testid="credit-back-btn" variant="outline" className="flex-1 h-11 rounded-xl" onClick={onBack}>Back</Button>
        <Button data-testid="credit-verify-btn" className="flex-1 h-11 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl" onClick={() => onVerify(otp)} disabled={loading || otp.length < 4}>{loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Verify & Fetch'}</Button>
      </div>
    </motion.div>
  );
};

// Step 3: Dual Bureau Credit Report View
const DualBureauReportView = ({ equifaxReport, experianReport, onRecheck, onClose }) => {
  const [activeBureau, setActiveBureau] = useState('equifax');
  
  const equifaxScore = equifaxReport?.SCORE?.FCIREXScore || equifaxReport?.creditScore || 0;
  const experianScore = experianReport?.SCORE?.FCIREXScore || experianReport?.SCORE?.BureauScore || experianReport?.creditScore || 0;
  
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
      {/* Bureau Tabs */}
      <div className="flex gap-2 p-1.5 bg-slate-100 rounded-xl">
        <button
          onClick={() => setActiveBureau('equifax')}
          className={`flex-1 flex items-center justify-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
            activeBureau === 'equifax' ? 'bg-white shadow-md text-red-700' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <span className={`w-3 h-3 rounded-full ${activeBureau === 'equifax' ? 'bg-red-500' : 'bg-red-300'}`}></span>
          <span>Equifax</span>
          <span className={`px-2 py-0.5 rounded-full text-xs ${activeBureau === 'equifax' ? 'bg-red-100 text-red-700' : 'bg-slate-200 text-slate-600'}`}>{equifaxScore}</span>
        </button>
        <button
          onClick={() => setActiveBureau('experian')}
          className={`flex-1 flex items-center justify-center gap-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all ${
            activeBureau === 'experian' ? 'bg-white shadow-md text-blue-700' : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
        >
          <span className={`w-3 h-3 rounded-full ${activeBureau === 'experian' ? 'bg-blue-500' : 'bg-blue-300'}`}></span>
          <span>Experian</span>
          <span className={`px-2 py-0.5 rounded-full text-xs ${activeBureau === 'experian' ? 'bg-blue-100 text-blue-700' : 'bg-slate-200 text-slate-600'}`}>{experianScore}</span>
        </button>
      </div>
      
      {/* Score Comparison Bar */}
      <div className="bg-gradient-to-r from-slate-800 to-slate-900 rounded-xl p-4 text-white">
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-medium text-slate-400">Score Comparison</span>
          <span className="text-xs text-slate-500">300 - 900 range</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-red-400">Equifax</span>
              <span className="font-bold">{equifaxScore}</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <motion.div className="h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full" initial={{ width: 0 }} animate={{ width: `${((equifaxScore - 300) / 600) * 100}%` }} transition={{ duration: 1, delay: 0.2 }} />
            </div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-blue-400">Experian</span>
              <span className="font-bold">{experianScore}</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <motion.div className="h-full bg-gradient-to-r from-blue-500 to-blue-400 rounded-full" initial={{ width: 0 }} animate={{ width: `${((experianScore - 300) / 600) * 100}%` }} transition={{ duration: 1, delay: 0.3 }} />
            </div>
          </div>
        </div>
        <div className="flex justify-between mt-3 text-xs text-slate-500">
          <span>Difference: <span className="text-white font-semibold">{Math.abs(equifaxScore - experianScore)} points</span></span>
          <span>Average: <span className="text-white font-semibold">{Math.round((equifaxScore + experianScore) / 2)}</span></span>
        </div>
      </div>
      
      {/* Bureau Report Content */}
      <AnimatePresence mode="wait">
        {activeBureau === 'equifax' && (
          <motion.div key="equifax" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
            <BureauReportView report={equifaxReport} bureauName="Equifax" bureauColor="bg-red-100 text-red-700" />
          </motion.div>
        )}
        {activeBureau === 'experian' && (
          <motion.div key="experian" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
            <BureauReportView report={experianReport} bureauName="Experian" bureauColor="bg-blue-100 text-blue-700" />
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Action Buttons */}
      <div className="flex gap-3 pt-3 border-t border-slate-100">
        <Button data-testid="credit-recheck-btn" variant="outline" className="flex-1 h-11 rounded-xl" onClick={onRecheck}><RefreshCw className="h-4 w-4 mr-2" />Re-check</Button>
        <Button data-testid="credit-download-btn" variant="outline" className="h-11 rounded-xl" onClick={() => toast.info('PDF export coming soon')}><Download className="h-4 w-4 mr-2" />PDF</Button>
        <Button data-testid="credit-done-btn" className="flex-1 h-11 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl" onClick={onClose}>Done</Button>
      </div>
    </motion.div>
  );
};

// Main Credit Score Modal Component
const CreditScoreModal = ({ isOpen, onClose, lead, onUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [fetchingProvider, setFetchingProvider] = useState(null);
  const [reports, setReports] = useState({
    cibil: null,
    equifax: null,
    experian: null,
    crif: null
  });
  const [activeReport, setActiveReport] = useState(null);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (isOpen && lead) {
      // Check if lead has customer info for credit reports
      if (!lead.pan_number) {
        setError('Please add PAN number in Customer Details before fetching credit reports');
      } else {
        setError(null);
      }
      
      // Load any existing credit reports
      if (lead.credit_score_full_report) {
        setReports(prev => ({ ...prev, cibil: lead.credit_score_full_report }));
        setActiveReport('cibil');
      }
    }
  }, [isOpen, lead]);
  
  const fetchReport = async (provider) => {
    if (!lead.pan_number) {
      toast.error('Please add PAN number in Customer Details first');
      return;
    }
    
    setFetchingProvider(provider);
    setError(null);
    
    try {
      const firstName = lead.credit_first_name || lead.customer_name?.split(' ')[0] || '';
      const lastName = lead.credit_last_name || lead.customer_name?.split(' ').slice(1).join(' ') || '';
      const mobile = (lead.customer_phone || '').replace('+91', '').replace(/\D/g, '');
      
      let result;
      
      if (provider === 'cibil') {
        result = await loansApi.fetchCibilReport({
          name: `${firstName} ${lastName}`.trim(),
          pan: lead.pan_number,
          mobile: mobile,
          gender: lead.gender || 'male',
          consent: 'Y'
        });
      } else if (provider === 'equifax') {
        result = await loansApi.fetchEquifaxReport({
          name: `${firstName} ${lastName}`.trim(),
          id_number: lead.pan_number,
          id_type: 'pan',
          mobile: mobile,
          consent: 'Y'
        });
      } else if (provider === 'experian') {
        result = await loansApi.fetchExperianReport({
          name: `${firstName} ${lastName}`.trim(),
          pan: lead.pan_number,
          mobile: mobile,
          consent: 'Y'
        });
      } else if (provider === 'crif') {
        result = await loansApi.fetchCrifReport({
          business_name: `${firstName} ${lastName}`.trim(),
          pan: lead.pan_number,
          mobile: mobile,
          consent: 'Y'
        });
      }
      
      if (result?.data?.success) {
        setReports(prev => ({ ...prev, [provider]: result.data }));
        setActiveReport(provider);
        toast.success(`${provider.toUpperCase()} report fetched successfully`);
        onUpdate();
      } else {
        toast.error(result?.data?.error || `Failed to fetch ${provider.toUpperCase()} report`);
      }
    } catch (err) {
      console.error(`${provider} fetch error:`, err);
      const errorMsg = err.response?.data?.error || err.response?.data?.detail || `Failed to fetch ${provider.toUpperCase()} report`;
      toast.error(errorMsg);
      
      // Use sample data for preview
      if (provider === 'equifax') {
        setReports(prev => ({ ...prev, [provider]: { ...SAMPLE_EQUIFAX_REPORT, creditScore: SAMPLE_EQUIFAX_REPORT.creditScore } }));
        setActiveReport(provider);
        toast.info('Loaded sample data for preview');
      } else if (provider === 'experian') {
        setReports(prev => ({ ...prev, [provider]: { ...SAMPLE_EXPERIAN_REPORT, creditScore: SAMPLE_EXPERIAN_REPORT.creditScore } }));
        setActiveReport(provider);
        toast.info('Loaded sample data for preview');
      }
    } finally {
      setFetchingProvider(null);
    }
  };
  
  const handleClose = () => { 
    setReports({ cibil: null, equifax: null, experian: null, crif: null }); 
    setActiveReport(null);
    setError(null);
    onClose(); 
  };
  
  const providers = [
    { id: 'cibil', name: 'CIBIL', color: 'bg-purple-100 text-purple-700 border-purple-200' },
    { id: 'equifax', name: 'Equifax', color: 'bg-red-100 text-red-700 border-red-200' },
    { id: 'experian', name: 'Experian', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    { id: 'crif', name: 'CRIF', color: 'bg-green-100 text-green-700 border-green-200' }
  ];
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={`${activeReport ? 'max-w-5xl' : 'max-w-lg'} max-h-[90vh] overflow-y-auto p-0 bg-slate-50`}>
        <div className="sticky top-0 z-10 px-5 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl"><CreditCard className="h-5 w-5 text-white" /></div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Credit Reports</h2>
              <p className="text-sm text-slate-500">{lead?.customer_name} • {lead?.pan_number || 'No PAN'}</p>
            </div>
          </div>
          <button onClick={handleClose} className="p-2 hover:bg-slate-100 rounded-lg"><X className="h-5 w-5 text-slate-500" /></button>
        </div>
        
        <div className="p-5">
          {error ? (
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-amber-800">{error}</p>
                  <p className="text-xs text-amber-700 mt-1">Go to Customer Details → Customer Info tab to add required information.</p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Provider Buttons */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {providers.map(provider => (
                  <div key={provider.id} className="relative">
                    <button
                      onClick={() => fetchReport(provider.id)}
                      disabled={fetchingProvider !== null}
                      className={`w-full p-4 rounded-xl border-2 text-center transition-all ${
                        reports[provider.id] 
                          ? `${provider.color} border-current` 
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      } ${activeReport === provider.id ? 'ring-2 ring-blue-500' : ''}`}
                    >
                      {fetchingProvider === provider.id ? (
                        <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                      ) : (
                        <>
                          <p className="font-semibold">{provider.name}</p>
                          {reports[provider.id]?.credit_score && (
                            <p className="text-2xl font-bold mt-1">{reports[provider.id].credit_score}</p>
                          )}
                          {!reports[provider.id] && <p className="text-xs text-slate-500 mt-1">Click to fetch</p>}
                        </>
                      )}
                    </button>
                    {/* PDF Button */}
                    {reports[provider.id]?.pdf_link && (
                      <button
                        onClick={() => window.open(reports[provider.id].pdf_link, '_blank')}
                        className="absolute -top-2 -right-2 p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg"
                        title="View PDF Report"
                      >
                        <FileText className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Active Report Display */}
              {activeReport && reports[activeReport] && (
                <div className="border-t border-slate-200 pt-4">
                  <BureauReportView 
                    report={reports[activeReport].parsed_report || reports[activeReport]} 
                    bureauName={providers.find(p => p.id === activeReport)?.name || ''} 
                    bureauColor={providers.find(p => p.id === activeReport)?.color || ''} 
                  />
                </div>
              )}
              
              {/* No reports message */}
              {!activeReport && (
                <div className="text-center py-8 text-slate-500">
                  <CreditCard className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p className="font-medium">Select a credit bureau to fetch report</p>
                  <p className="text-sm mt-1">Reports from CIBIL, Equifax, Experian & CRIF available</p>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreditScoreModal;
