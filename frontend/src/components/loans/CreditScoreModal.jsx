import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { loansApi } from '@/services/api';
import { toast } from 'sonner';
import {
  ShieldCheck, AlertCircle, CreditCard, History, TrendingUp, User,
  Calendar, Mail, Phone, MapPin, Building2, Search, Eye, X, Loader2,
  ChevronDown, ChevronRight, CheckCircle, ArrowRight, RefreshCw,
  Download, FileText, AlertTriangle, Clock, Wallet, PieChart,
  Activity, Target, Shield, Zap, Info, Hash, IndianRupee, Lock
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

// Premium Score Gauge Component
const ScoreGauge = ({ score, maxScore = 900, minScore = 300 }) => {
  const percentage = Math.max(0, Math.min(100, ((score - minScore) / (maxScore - minScore)) * 100));
  const circumference = 2 * Math.PI * 88;
  const strokeDashoffset = circumference - (percentage / 100) * circumference * 0.75;
  
  const getScoreColor = (s) => {
    if (s >= 750) return { stroke: '#10B981', bg: 'bg-emerald-50', text: 'text-emerald-600' };
    if (s >= 700) return { stroke: '#3B82F6', bg: 'bg-blue-50', text: 'text-blue-600' };
    if (s >= 650) return { stroke: '#F59E0B', bg: 'bg-amber-50', text: 'text-amber-600' };
    if (s >= 550) return { stroke: '#F97316', bg: 'bg-orange-50', text: 'text-orange-600' };
    return { stroke: '#EF4444', bg: 'bg-red-50', text: 'text-red-600' };
  };
  
  const getScoreLabel = (s) => {
    if (s >= 750) return 'Excellent';
    if (s >= 700) return 'Good';
    if (s >= 650) return 'Fair';
    if (s >= 550) return 'Poor';
    return 'Very Poor';
  };
  
  const colors = getScoreColor(score);
  
  return (
    <div className="relative flex flex-col items-center">
      <svg width="200" height="160" viewBox="0 0 200 160" className="overflow-visible">
        {/* Background arc */}
        <path
          d="M 20 140 A 88 88 0 0 1 180 140"
          fill="none"
          stroke="#E2E8F0"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Score arc */}
        <motion.path
          d="M 20 140 A 88 88 0 0 1 180 140"
          fill="none"
          stroke={colors.stroke}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={circumference * 0.75}
          initial={{ strokeDashoffset: circumference * 0.75 }}
          animate={{ strokeDashoffset }}
          transition={{ duration: 1.5, ease: 'easeOut', delay: 0.2 }}
        />
        {/* Score markers */}
        {[300, 450, 600, 750, 900].map((mark, i) => {
          const angle = -180 + (i * 45);
          const rad = (angle * Math.PI) / 180;
          const x = 100 + 72 * Math.cos(rad);
          const y = 140 + 72 * Math.sin(rad);
          return (
            <text
              key={mark}
              x={x}
              y={y}
              textAnchor="middle"
              className="fill-slate-400 text-[10px] font-medium"
            >
              {mark}
            </text>
          );
        })}
      </svg>
      
      {/* Score value */}
      <motion.div 
        className="absolute top-12 flex flex-col items-center"
        initial={{ opacity: 0, scale: 0.5 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.5, duration: 0.5 }}
      >
        <span className="text-5xl font-bold tracking-tighter text-slate-900">{score}</span>
        <span className={`text-sm font-semibold uppercase tracking-wider mt-1 ${colors.text}`}>
          {getScoreLabel(score)}
        </span>
      </motion.div>
    </div>
  );
};

// Data Card Component
const DataCard = ({ label, value, icon: Icon, trend, className = '' }) => (
  <motion.div 
    className={`bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow ${className}`}
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.3 }}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
        {trend && (
          <p className={`text-xs mt-1 ${trend > 0 ? 'text-green-600' : 'text-red-600'}`}>
            {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
          </p>
        )}
      </div>
      {Icon && (
        <div className="p-2 bg-slate-50 rounded-lg">
          <Icon className="h-5 w-5 text-slate-600" />
        </div>
      )}
    </div>
  </motion.div>
);

// Status Badge
const StatusBadge = ({ status, className = '' }) => {
  const configs = {
    active: { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Active' },
    closed: { bg: 'bg-slate-100', text: 'text-slate-800', label: 'Closed' },
    default: { bg: 'bg-red-100', text: 'text-red-800', label: 'Default' },
    current: { bg: 'bg-green-100', text: 'text-green-800', label: 'Current' },
    overdue: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'Overdue' },
    settled: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Settled' },
    written_off: { bg: 'bg-red-100', text: 'text-red-800', label: 'Written Off' },
  };
  
  const config = configs[status?.toLowerCase()] || configs.active;
  
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg} ${config.text} ${className}`}>
      {config.label}
    </span>
  );
};

// Account Type Icons/Colors
const getAccountTypeConfig = (code) => {
  const types = {
    '01': { name: 'Auto Loan', icon: '🚗', color: 'bg-blue-500' },
    '02': { name: 'Housing Loan', icon: '🏠', color: 'bg-purple-500' },
    '05': { name: 'Personal Loan', icon: '💰', color: 'bg-green-500' },
    '10': { name: 'Credit Card', icon: '💳', color: 'bg-orange-500' },
    '13': { name: 'Two-Wheeler Loan', icon: '🛵', color: 'bg-cyan-500' },
    '17': { name: 'Commercial Vehicle', icon: '🚛', color: 'bg-indigo-500' },
    '32': { name: 'Used Car Loan', icon: '🚙', color: 'bg-teal-500' },
  };
  return types[String(code).padStart(2, '0')] || { name: `Type ${code}`, icon: '📄', color: 'bg-slate-500' };
};

// Format currency
const formatINR = (amount) => {
  if (!amount && amount !== 0) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

// Format date from YYYYMMDD
const formatDateFromNum = (dateNum) => {
  if (!dateNum) return '-';
  const str = String(dateNum);
  if (str.length === 8) {
    return `${str.slice(6,8)}/${str.slice(4,6)}/${str.slice(0,4)}`;
  }
  return str;
};

// Payment History Visualization
const PaymentHistoryBar = ({ history }) => {
  if (!history || history.length === 0) return null;
  
  const getStatusColor = (dpd) => {
    if (dpd === 0 || dpd === '0' || dpd === 'STD') return 'bg-emerald-500';
    if (dpd === '?' || dpd === 'XXX' || dpd === 'NEW') return 'bg-slate-300';
    const days = parseInt(dpd);
    if (isNaN(days)) return 'bg-slate-300';
    if (days <= 30) return 'bg-amber-500';
    if (days <= 60) return 'bg-orange-500';
    if (days <= 90) return 'bg-red-400';
    return 'bg-red-600';
  };
  
  return (
    <div className="mt-4">
      <p className="text-xs font-medium text-slate-500 mb-2">Payment History (Last 12 months)</p>
      <div className="flex gap-1">
        {history.slice(0, 12).map((h, i) => (
          <motion.div 
            key={i} 
            className="flex-1 flex flex-col items-center"
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            transition={{ delay: i * 0.05 }}
          >
            <div 
              className={`w-full h-6 rounded-sm ${getStatusColor(h.Days_Past_Due)}`}
              title={`${h.Month}/${h.Year}: ${h.Days_Past_Due || 0} DPD`}
            />
            <span className="text-[8px] text-slate-400 mt-0.5">{h.Month}</span>
          </motion.div>
        ))}
      </div>
      <div className="flex gap-3 mt-2 text-[10px] text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-sm" />On Time</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-sm" />1-30</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-orange-500 rounded-sm" />31-60</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-sm" />60+</span>
      </div>
    </div>
  );
};

// Risk Level Indicator
const RiskIndicator = ({ score }) => {
  const getRisk = (s) => {
    if (s >= 750) return { level: 'Low Risk', color: 'bg-emerald-500', desc: 'Excellent repayment probability' };
    if (s >= 700) return { level: 'Moderate', color: 'bg-blue-500', desc: 'Good credit standing' };
    if (s >= 650) return { level: 'Medium', color: 'bg-amber-500', desc: 'Some concerns noted' };
    if (s >= 550) return { level: 'High Risk', color: 'bg-orange-500', desc: 'Significant concerns' };
    return { level: 'Very High', color: 'bg-red-500', desc: 'Poor credit history' };
  };
  
  const risk = getRisk(score);
  
  return (
    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
      <div className={`w-3 h-3 rounded-full ${risk.color}`} />
      <div>
        <p className="text-sm font-semibold text-slate-900">{risk.level}</p>
        <p className="text-xs text-slate-500">{risk.desc}</p>
      </div>
    </div>
  );
};

// Step 1: Customer Info Form
const CustomerInfoForm = ({ formData, setFormData, onSubmit, loading }) => {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Alert Banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 rounded-xl border border-amber-200">
        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-amber-800">OTP Verification Required</p>
          <p className="text-sm text-amber-700 mt-1">An OTP will be sent to the customer's mobile number. Please ensure they are available to share it.</p>
        </div>
      </div>
      
      {/* Form Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* First Name */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">First Name <span className="text-red-500">*</span></Label>
          <Input
            data-testid="credit-first-name"
            value={formData.first_name}
            onChange={(e) => setFormData({...formData, first_name: e.target.value})}
            placeholder="Enter first name"
            className="h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        
        {/* Last Name */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">Last Name <span className="text-red-500">*</span></Label>
          <Input
            data-testid="credit-last-name"
            value={formData.last_name}
            onChange={(e) => setFormData({...formData, last_name: e.target.value})}
            placeholder="Enter last name"
            className="h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        
        {/* PAN Number */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">PAN Number <span className="text-red-500">*</span></Label>
          <Input
            data-testid="credit-pan"
            value={formData.pan_number}
            onChange={(e) => setFormData({...formData, pan_number: e.target.value.toUpperCase()})}
            placeholder="ABCDE1234F"
            maxLength={10}
            className="h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500 uppercase font-mono"
          />
        </div>
        
        {/* Date of Birth */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">Date of Birth <span className="text-red-500">*</span></Label>
          <Input
            data-testid="credit-dob"
            value={formData.dob}
            onChange={(e) => setFormData({...formData, dob: e.target.value.replace(/\D/g, '')})}
            placeholder="YYYYMMDD (e.g., 19901231)"
            maxLength={8}
            className="h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500 font-mono"
          />
          <p className="text-xs text-slate-400">Format: YYYYMMDD</p>
        </div>
        
        {/* Mobile Number */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">Mobile Number <span className="text-red-500">*</span></Label>
          <div className="flex">
            <span className="inline-flex items-center px-4 bg-slate-100 border border-r-0 border-slate-200 rounded-l-lg text-slate-600 text-sm font-medium">
              +91
            </span>
            <Input
              data-testid="credit-mobile"
              value={formData.mobile_number}
              onChange={(e) => setFormData({...formData, mobile_number: e.target.value.replace(/\D/g, '')})}
              placeholder="9876543210"
              maxLength={10}
              className="h-11 rounded-l-none border-slate-200 focus:border-blue-500 focus:ring-blue-500 font-mono"
            />
          </div>
        </div>
        
        {/* Email */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">Email <span className="text-red-500">*</span></Label>
          <Input
            data-testid="credit-email"
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({...formData, email: e.target.value})}
            placeholder="customer@email.com"
            className="h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500"
          />
        </div>
        
        {/* Gender */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">Gender <span className="text-red-500">*</span></Label>
          <Select
            value={formData.gender}
            onValueChange={(val) => setFormData({...formData, gender: val})}
          >
            <SelectTrigger data-testid="credit-gender" className="h-11 border-slate-200">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="male">Male</SelectItem>
              <SelectItem value="female">Female</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {/* PIN Code */}
        <div className="space-y-2">
          <Label className="text-sm font-medium text-slate-700">PIN Code <span className="text-red-500">*</span></Label>
          <Input
            data-testid="credit-pincode"
            value={formData.pin_code}
            onChange={(e) => setFormData({...formData, pin_code: e.target.value.replace(/\D/g, '')})}
            placeholder="560001"
            maxLength={6}
            className="h-11 border-slate-200 focus:border-blue-500 focus:ring-blue-500 font-mono"
          />
        </div>
      </div>
      
      {/* API Provider Selection */}
      <div className="space-y-2">
        <Label className="text-sm font-medium text-slate-700">Credit Bureau</Label>
        <Select
          value={formData.bureau}
          onValueChange={(val) => setFormData({...formData, bureau: val})}
        >
          <SelectTrigger data-testid="credit-bureau" className="h-11 border-slate-200">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="equifax">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-600"></span>
                Equifax (V1)
              </span>
            </SelectItem>
            <SelectItem value="experian">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                Experian (V4)
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-slate-400">Select the credit bureau for fetching the report</p>
      </div>
      
      {/* Submit Button */}
      <Button
        data-testid="credit-submit-btn"
        className="w-full h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/25"
        onClick={onSubmit}
        disabled={loading}
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            Requesting OTP...
          </span>
        ) : (
          <span className="flex items-center gap-2">
            Send OTP to Customer
            <ArrowRight className="h-5 w-5" />
          </span>
        )}
      </Button>
    </motion.div>
  );
};

// Step 2: OTP Verification
const OTPVerification = ({ mobile, onVerify, onBack, loading }) => {
  const [otp, setOtp] = useState('');
  const [countdown, setCountdown] = useState(60);
  
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);
  
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col items-center py-8 space-y-8"
    >
      {/* Success Icon */}
      <motion.div 
        className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      >
        <Phone className="h-10 w-10 text-white" />
      </motion.div>
      
      {/* Message */}
      <div className="text-center">
        <h3 className="text-xl font-bold text-slate-900">OTP Sent Successfully!</h3>
        <p className="text-slate-500 mt-2">
          A verification code has been sent to
        </p>
        <p className="font-mono text-lg font-semibold text-slate-900 mt-1">+91 {mobile}</p>
        <p className="text-sm text-slate-400 mt-2">Please ask the customer to share the OTP</p>
      </div>
      
      {/* OTP Input */}
      <div className="w-full max-w-xs">
        <Input
          data-testid="credit-otp-input"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
          placeholder="Enter 6-digit OTP"
          maxLength={6}
          className="h-16 text-center text-3xl tracking-[0.5em] font-mono border-2 border-slate-200 focus:border-blue-500 rounded-xl"
          autoFocus
        />
      </div>
      
      {/* Countdown */}
      {countdown > 0 ? (
        <p className="text-sm text-slate-500">
          Resend OTP in <span className="font-semibold text-blue-600">{countdown}s</span>
        </p>
      ) : (
        <button
          onClick={onBack}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium"
        >
          Didn't receive? Request again
        </button>
      )}
      
      {/* Action Buttons */}
      <div className="flex gap-3 w-full max-w-xs">
        <Button
          data-testid="credit-back-btn"
          variant="outline"
          className="flex-1 h-12 rounded-xl"
          onClick={onBack}
        >
          Back
        </Button>
        <Button
          data-testid="credit-verify-btn"
          className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl"
          onClick={() => onVerify(otp)}
          disabled={loading || otp.length < 4}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            'Verify & Fetch'
          )}
        </Button>
      </div>
    </motion.div>
  );
};

// Step 3: Credit Report View
const CreditReportView = ({ data, fullReport, bureau, onRecheck, onClose }) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [expandedAccounts, setExpandedAccounts] = useState({});
  
  // Extract data based on bureau type
  const score = data?.credit_score || 0;
  const summary = data?.summary || {};
  
  // Normalize data from different bureaus
  const accounts = fullReport?.CAIS_Account?.CAIS_Account_DETAILS || 
                   fullReport?.accountDetails || [];
  const caisSummary = fullReport?.CAIS_Account?.CAIS_Summary || 
                      summary || {};
  const profileHeader = fullReport?.CreditProfileHeader || 
                        fullReport?.header || {};
  const currentApp = fullReport?.Current_Application?.Current_Application_Details || 
                     fullReport?.applicantDetails || {};
  const capsData = fullReport?.CAPS || fullReport?.enquiries || {};
  const nonCreditCaps = fullReport?.NonCreditCAPS || {};
  const scoreData = fullReport?.SCORE || {};
  
  const tabs = [
    { id: 'overview', label: 'Overview', icon: Eye },
    { id: 'accounts', label: 'Accounts', icon: Building2, count: accounts.length || caisSummary?.Credit_Account?.CreditAccountTotal },
    { id: 'enquiries', label: 'Enquiries', icon: Search },
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'raw', label: 'Raw Data', icon: FileText },
  ];
  
  const toggleAccount = (idx) => {
    setExpandedAccounts(prev => ({ ...prev, [idx]: !prev[idx] }));
  };
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header with Score */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Score Section */}
        <div className="lg:col-span-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
            {/* Bureau Badge */}
            <div className="flex items-center justify-between mb-4">
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold ${
                bureau === 'equifax' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
              }`}>
                <span className={`w-2 h-2 rounded-full ${bureau === 'equifax' ? 'bg-red-500' : 'bg-blue-500'}`}></span>
                {bureau === 'equifax' ? 'Equifax' : 'Experian'}
              </div>
              {profileHeader.ReportDate && (
                <span className="text-xs text-slate-400">
                  {formatDateFromNum(profileHeader.ReportDate)}
                </span>
              )}
            </div>
            
            {/* Score Gauge */}
            <ScoreGauge score={score} />
            
            {/* Risk Indicator */}
            <RiskIndicator score={score} />
            
            {/* Report Info */}
            {profileHeader.ReportNumber && (
              <p className="text-xs text-slate-400 text-center mt-4">
                Report #{profileHeader.ReportNumber}
              </p>
            )}
          </div>
        </div>
        
        {/* Summary Cards */}
        <div className="lg:col-span-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <DataCard
              label="Total Accounts"
              value={caisSummary?.Credit_Account?.CreditAccountTotal || summary?.accounts?.total || 0}
              icon={Building2}
            />
            <DataCard
              label="Active"
              value={caisSummary?.Credit_Account?.CreditAccountActive || summary?.accounts?.active || 0}
              icon={CheckCircle}
            />
            <DataCard
              label="Closed"
              value={caisSummary?.Credit_Account?.CreditAccountClosed || summary?.accounts?.closed || 0}
              icon={Lock}
            />
            <DataCard
              label="Defaults"
              value={caisSummary?.Credit_Account?.CreditAccountDefault || summary?.accounts?.default || 0}
              icon={AlertTriangle}
            />
          </div>
          
          {/* Outstanding Balance */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl p-5 text-white">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Outstanding</p>
              <p className="text-3xl font-bold mt-2">
                {formatINR(caisSummary?.Total_Outstanding_Balance?.Outstanding_Balance_All || summary?.outstanding_balance?.total || 0)}
              </p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-100">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Secured</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {formatINR(caisSummary?.Total_Outstanding_Balance?.Outstanding_Balance_Secured || summary?.outstanding_balance?.secured || 0)}
              </p>
            </div>
            <div className="bg-white rounded-xl p-5 border border-slate-100">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">Unsecured</p>
              <p className="text-2xl font-bold text-slate-900 mt-2">
                {formatINR(caisSummary?.Total_Outstanding_Balance?.Outstanding_Balance_UnSecured || summary?.outstanding_balance?.unsecured || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Tab Navigation */}
      <div className="flex gap-1 p-1.5 bg-slate-100 rounded-xl overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            data-testid={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-white shadow-sm text-slate-900'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full">{tab.count}</span>
            )}
          </button>
        ))}
      </div>
      
      {/* Tab Content */}
      <div className="min-h-[400px] max-h-[500px] overflow-y-auto">
        <AnimatePresence mode="wait">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Merits & Risks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Merits */}
                <div className="bg-emerald-50 rounded-xl p-5 border border-emerald-100">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="h-5 w-5 text-emerald-600" />
                    <h4 className="font-semibold text-emerald-900">Strengths</h4>
                  </div>
                  <ul className="space-y-2 text-sm text-emerald-800">
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      {caisSummary?.Credit_Account?.CreditAccountActive || summary?.accounts?.active || 0} Active credit accounts
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                      {caisSummary?.Credit_Account?.CreditAccountClosed || summary?.accounts?.closed || 0} Successfully closed accounts
                    </li>
                    {score >= 700 && (
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                        Good credit score ({score})
                      </li>
                    )}
                  </ul>
                </div>
                
                {/* Risks */}
                <div className="bg-red-50 rounded-xl p-5 border border-red-100">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                    <h4 className="font-semibold text-red-900">Concerns</h4>
                  </div>
                  <ul className="space-y-2 text-sm text-red-800">
                    {(caisSummary?.Credit_Account?.CreditAccountDefault || summary?.accounts?.default || 0) > 0 && (
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                        {caisSummary?.Credit_Account?.CreditAccountDefault || summary?.accounts?.default} Default account(s)
                      </li>
                    )}
                    {(summary?.enquiries?.last_30_days || 0) > 3 && (
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                        High recent enquiries ({summary?.enquiries?.last_30_days} in 30 days)
                      </li>
                    )}
                    {score < 650 && (
                      <li className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                        Low credit score
                      </li>
                    )}
                    {(caisSummary?.Credit_Account?.CreditAccountDefault || summary?.accounts?.default || 0) === 0 && 
                     (summary?.enquiries?.last_30_days || 0) <= 3 && score >= 650 && (
                      <li className="text-slate-500">No major concerns identified</li>
                    )}
                  </ul>
                </div>
              </div>
              
              {/* Enquiry Summary */}
              <div className="bg-white rounded-xl p-5 border border-slate-100">
                <h4 className="font-semibold text-slate-900 mb-4">Credit Enquiries Timeline</h4>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: '7 Days', value: summary?.enquiries?.last_7_days || 0 },
                    { label: '30 Days', value: summary?.enquiries?.last_30_days || 0 },
                    { label: '90 Days', value: summary?.enquiries?.last_90_days || 0 },
                    { label: '180 Days', value: summary?.enquiries?.last_180_days || 0 },
                  ].map((item, i) => (
                    <div key={i} className="text-center p-4 bg-slate-50 rounded-xl">
                      <p className={`text-3xl font-bold ${item.value > 3 ? 'text-orange-600' : 'text-slate-900'}`}>{item.value}</p>
                      <p className="text-xs text-slate-500 mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
          
          {/* Accounts Tab */}
          {activeTab === 'accounts' && (
            <motion.div
              key="accounts"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {accounts.length > 0 ? accounts.map((account, idx) => {
                const isExpanded = expandedAccounts[idx];
                const typeConfig = getAccountTypeConfig(account.Account_Type);
                const history = account.CAIS_Account_History || [];
                
                return (
                  <div key={idx} className="bg-white rounded-xl border border-slate-100 overflow-hidden">
                    <button
                      onClick={() => toggleAccount(idx)}
                      className="w-full p-4 flex items-center justify-between hover:bg-slate-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${typeConfig.color} bg-opacity-10`}>
                          {typeConfig.icon}
                        </div>
                        <div className="text-left">
                          <p className="font-semibold text-slate-900">{account.Subscriber_Name || 'Unknown Lender'}</p>
                          <p className="text-sm text-slate-500">{typeConfig.name} • ****{account.Account_Number?.slice(-4)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-bold text-slate-900">{formatINR(account.Current_Balance)}</p>
                          <StatusBadge status={account.Account_Status === '11' ? 'current' : account.Account_Status === '13' ? 'closed' : 'active'} />
                        </div>
                        <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>
                    
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="p-4 pt-0 border-t border-slate-100 bg-slate-50"
                      >
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-4 text-sm">
                          <div>
                            <p className="text-slate-500">Sanctioned</p>
                            <p className="font-semibold">{formatINR(account.Highest_Credit_or_Original_Loan_Amount || account.Credit_Limit_Amount)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Current Balance</p>
                            <p className="font-semibold">{formatINR(account.Current_Balance)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Past Due</p>
                            <p className={`font-semibold ${account.Amount_Past_Due > 0 ? 'text-red-600' : ''}`}>{formatINR(account.Amount_Past_Due)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Opened</p>
                            <p className="font-semibold">{formatDateFromNum(account.Open_Date)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Last Payment</p>
                            <p className="font-semibold">{formatDateFromNum(account.Date_of_Last_Payment)}</p>
                          </div>
                          <div>
                            <p className="text-slate-500">Closed</p>
                            <p className="font-semibold">{account.Date_Closed ? formatDateFromNum(account.Date_Closed) : '-'}</p>
                          </div>
                        </div>
                        
                        <PaymentHistoryBar history={history} />
                        
                        {(account.Written_Off_Amt_Total || account.Settlement_Amount) && (
                          <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-100 text-sm">
                            {account.Written_Off_Amt_Total > 0 && (
                              <p className="text-red-700 font-medium">Written Off: {formatINR(account.Written_Off_Amt_Total)}</p>
                            )}
                            {account.Settlement_Amount > 0 && (
                              <p className="text-orange-700 font-medium">Settled For: {formatINR(account.Settlement_Amount)}</p>
                            )}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </div>
                );
              }) : (
                <div className="text-center py-12 text-slate-500">
                  <Building2 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p className="font-medium">No account details available</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Summary: {caisSummary?.Credit_Account?.CreditAccountTotal || summary?.accounts?.total || 0} accounts on record
                  </p>
                </div>
              )}
            </motion.div>
          )}
          
          {/* Enquiries Tab */}
          {activeTab === 'enquiries' && (
            <motion.div
              key="enquiries"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Credit Enquiries */}
              <div className="bg-white rounded-xl p-5 border border-slate-100">
                <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                  <Search className="h-5 w-5 text-slate-600" />
                  Hard Enquiries (Loan Applications)
                </h4>
                <div className="grid grid-cols-4 gap-4">
                  {[
                    { label: '7 Days', value: capsData?.CAPS_Summary?.CAPSLast7Days ?? summary?.enquiries?.last_7_days ?? 0 },
                    { label: '30 Days', value: capsData?.CAPS_Summary?.CAPSLast30Days ?? summary?.enquiries?.last_30_days ?? 0 },
                    { label: '90 Days', value: capsData?.CAPS_Summary?.CAPSLast90Days ?? summary?.enquiries?.last_90_days ?? 0 },
                    { label: '180 Days', value: capsData?.CAPS_Summary?.CAPSLast180Days ?? summary?.enquiries?.last_180_days ?? 0 },
                  ].map((item, i) => (
                    <div key={i} className="text-center p-4 bg-slate-50 rounded-xl">
                      <p className={`text-3xl font-bold ${item.value > 3 ? 'text-orange-600' : 'text-slate-900'}`}>{item.value}</p>
                      <p className="text-xs text-slate-500 mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Non-Credit Enquiries */}
              {nonCreditCaps?.NonCreditCAPS_Summary && (
                <div className="bg-white rounded-xl p-5 border border-slate-100">
                  <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Eye className="h-5 w-5 text-blue-600" />
                    Soft Enquiries
                  </h4>
                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: '7 Days', value: nonCreditCaps.NonCreditCAPS_Summary.NonCreditCAPSLast7Days || 0 },
                      { label: '30 Days', value: nonCreditCaps.NonCreditCAPS_Summary.NonCreditCAPSLast30Days || 0 },
                      { label: '90 Days', value: nonCreditCaps.NonCreditCAPS_Summary.NonCreditCAPSLast90Days || 0 },
                      { label: '180 Days', value: nonCreditCaps.NonCreditCAPS_Summary.NonCreditCAPSLast180Days || 0 },
                    ].map((item, i) => (
                      <div key={i} className="text-center p-4 bg-blue-50 rounded-xl">
                        <p className="text-3xl font-bold text-blue-900">{item.value}</p>
                        <p className="text-xs text-blue-600 mt-1">{item.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Recent Enquiry Details */}
              {capsData?.CAPS_Application_Details?.length > 0 && (
                <div className="bg-white rounded-xl p-5 border border-slate-100">
                  <h4 className="font-semibold text-slate-900 mb-4">Recent Enquiry Details</h4>
                  <div className="space-y-2">
                    {capsData.CAPS_Application_Details.slice(0, 5).map((enq, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-medium text-slate-900">{enq.Subscriber_Name || 'Unknown'}</p>
                          <p className="text-sm text-slate-500">Amount: {formatINR(enq.Amount_Financed)}</p>
                        </div>
                        <span className="text-sm text-slate-400">{formatDateFromNum(enq.Date_of_Request)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Info Box */}
              <div className="bg-amber-50 rounded-xl p-5 border border-amber-100">
                <h4 className="font-semibold text-amber-900 mb-2 flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Impact on Credit Score
                </h4>
                <ul className="text-sm text-amber-800 space-y-1">
                  <li>• Multiple enquiries may lower score by 5-10 points each</li>
                  <li>• Enquiries remain on report for 2 years</li>
                  <li>• Less than 3 enquiries in 6 months is healthy</li>
                </ul>
              </div>
            </motion.div>
          )}
          
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {/* Personal Info */}
              {currentApp && (
                <div className="bg-white rounded-xl p-5 border border-slate-100">
                  <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <User className="h-5 w-5 text-slate-600" />
                    Personal Information
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    <div>
                      <p className="text-slate-500">Full Name</p>
                      <p className="font-semibold text-slate-900">
                        {currentApp.First_Name || currentApp.firstName || ''} {currentApp.Middle_Name1 || ''} {currentApp.Last_Name || currentApp.lastName || ''}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Date of Birth</p>
                      <p className="font-semibold text-slate-900">{formatDateFromNum(currentApp.Date_Of_Birth_Applicant || currentApp.dob)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Gender</p>
                      <p className="font-semibold text-slate-900">{(currentApp.Gender_Code === 1 || currentApp.gender === 'M') ? 'Male' : 'Female'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">PAN</p>
                      <p className="font-semibold text-slate-900 font-mono">{currentApp.IncomeTaxPan || currentApp.pan || '-'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Mobile</p>
                      <p className="font-semibold text-slate-900">{currentApp.MobilePhoneNumber || currentApp.mobile || '-'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Email</p>
                      <p className="font-semibold text-slate-900">{currentApp.EMailId || currentApp.email || '-'}</p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Address */}
              {(fullReport?.Current_Application?.Current_Applicant_Address_Details || fullReport?.address) && (
                <div className="bg-white rounded-xl p-5 border border-slate-100">
                  <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-slate-600" />
                    Address on Record
                  </h4>
                  {(() => {
                    const addr = fullReport?.Current_Application?.Current_Applicant_Address_Details || fullReport?.address || {};
                    return (
                      <div className="text-sm text-slate-700">
                        <p>{addr.FlatNoPlotNoHouseNo || addr.flatNo}, {addr.BldgNoSocietyName || addr.building}</p>
                        <p>{addr.RoadNoNameAreaLocality || addr.locality}</p>
                        <p>{addr.City || addr.city}, PIN: {addr.PINCode || addr.pinCode}</p>
                      </div>
                    );
                  })()}
                </div>
              )}
              
              {/* Score Details */}
              {scoreData && (
                <div className="bg-white rounded-xl p-5 border border-slate-100">
                  <h4 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-slate-600" />
                    Score Analysis
                  </h4>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                      <span className="text-slate-600">Credit Score</span>
                      <span className={`text-2xl font-bold ${score >= 700 ? 'text-emerald-600' : score >= 600 ? 'text-amber-600' : 'text-red-600'}`}>
                        {scoreData.FCIREXScore || scoreData.score || score}
                      </span>
                    </div>
                    {(scoreData.FCIREXScoreConfidLevel || scoreData.confidence) && (
                      <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <span className="text-slate-600">Confidence Level</span>
                        <span className="font-semibold text-slate-900">{scoreData.FCIREXScoreConfidLevel || scoreData.confidence}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* Match Result */}
              {fullReport?.Match_result && (
                <div className={`rounded-xl p-5 border ${
                  fullReport.Match_result.Exact_match === 'Y' 
                    ? 'bg-emerald-50 border-emerald-200' 
                    : 'bg-amber-50 border-amber-200'
                }`}>
                  <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                    <ShieldCheck className="h-5 w-5" />
                    Identity Match
                  </h4>
                  <p className={`text-sm ${fullReport.Match_result.Exact_match === 'Y' ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {fullReport.Match_result.Exact_match === 'Y' 
                      ? '✓ Identity verified - Exact match confirmed' 
                      : '⚠ Partial match - Please verify details'}
                  </p>
                </div>
              )}
            </motion.div>
          )}
          
          {/* Raw Data Tab */}
          {activeTab === 'raw' && (
            <motion.div
              key="raw"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <div className="bg-slate-900 rounded-xl p-4 overflow-auto max-h-[500px]">
                <pre className="text-xs text-emerald-400 font-mono whitespace-pre-wrap">
                  {JSON.stringify(fullReport || data, null, 2)}
                </pre>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      {/* Action Buttons */}
      <div className="flex gap-3 pt-4 border-t border-slate-100">
        <Button
          data-testid="credit-recheck-btn"
          variant="outline"
          className="flex-1 h-12 rounded-xl"
          onClick={onRecheck}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Re-check Score
        </Button>
        <Button
          data-testid="credit-download-btn"
          variant="outline"
          className="h-12 rounded-xl"
          onClick={() => toast.info('PDF export coming soon')}
        >
          <Download className="h-4 w-4 mr-2" />
          Download PDF
        </Button>
        <Button
          data-testid="credit-done-btn"
          className="flex-1 h-12 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl"
          onClick={onClose}
        >
          Done
        </Button>
      </div>
    </motion.div>
  );
};

// Main Credit Score Modal Component
const CreditScoreModal = ({ isOpen, onClose, lead, onUpdate }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');
  const [creditResult, setCreditResult] = useState(null);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    pan_number: '',
    dob: '',
    mobile_number: '',
    email: '',
    gender: 'male',
    pin_code: '',
    bureau: 'equifax'
  });
  
  // Initialize form with lead data
  useEffect(() => {
    if (isOpen && lead) {
      const nameParts = (lead.customer_name || '').split(' ');
      setFormData(prev => ({
        ...prev,
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
        mobile_number: (lead.customer_phone || '').replace('+91', '').replace(/\D/g, ''),
        email: lead.customer_email || '',
      }));
      
      // Check for existing credit report
      if (lead.credit_score) {
        setCreditResult({
          credit_score: lead.credit_score,
          summary: lead.credit_score_summary
        });
        setStep(3);
      } else {
        setStep(1);
        setCreditResult(null);
      }
    }
  }, [isOpen, lead]);
  
  const validateForm = () => {
    if (!formData.first_name || !formData.last_name) {
      toast.error('Please enter full name');
      return false;
    }
    if (!formData.pan_number || formData.pan_number.length !== 10) {
      toast.error('Please enter valid 10-digit PAN number');
      return false;
    }
    if (!formData.dob || formData.dob.length !== 8) {
      toast.error('Please enter DOB in YYYYMMDD format');
      return false;
    }
    if (!formData.mobile_number || formData.mobile_number.length !== 10) {
      toast.error('Please enter valid 10-digit mobile number');
      return false;
    }
    if (!formData.email) {
      toast.error('Please enter email address');
      return false;
    }
    if (!formData.pin_code || formData.pin_code.length !== 6) {
      toast.error('Please enter valid 6-digit PIN code');
      return false;
    }
    return true;
  };
  
  const handleRequestOTP = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      const res = await loansApi.requestCreditScoreOTP(lead.id, {
        ...formData,
        bureau: formData.bureau
      });
      if (res.data.success) {
        setToken(res.data.token);
        toast.success('OTP sent to customer\'s mobile number');
        setStep(2);
      } else {
        toast.error(res.data.message || 'Failed to send OTP');
      }
    } catch (err) {
      console.error('OTP request error:', err);
      toast.error(err.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };
  
  const handleVerifyOTP = async (otp) => {
    if (!otp || otp.length < 4) {
      toast.error('Please enter valid OTP');
      return;
    }
    
    setLoading(true);
    try {
      const res = await loansApi.verifyCreditScoreOTP(lead.id, {
        token,
        otp,
        bureau: formData.bureau
      });
      if (res.data.success) {
        setCreditResult(res.data);
        toast.success('Credit report fetched successfully!');
        setStep(3);
        onUpdate();
      } else {
        toast.error(res.data.message || 'Failed to verify OTP');
      }
    } catch (err) {
      console.error('OTP verify error:', err);
      toast.error(err.response?.data?.detail || 'Verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleClose = () => {
    setStep(1);
    setToken('');
    setCreditResult(null);
    onClose();
  };
  
  const handleRecheck = () => {
    setStep(1);
    setToken('');
    setCreditResult(null);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className={`${step === 3 ? 'max-w-5xl' : 'max-w-xl'} max-h-[90vh] overflow-y-auto p-0 bg-slate-50`}>
        {/* Header */}
        <div className="sticky top-0 z-10 px-6 py-4 bg-white border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Credit Score Check</h2>
              <p className="text-sm text-slate-500">{lead?.customer_name} • {lead?.customer_phone}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>
        
        {/* Step Indicator */}
        {step < 3 && (
          <div className="px-6 py-4 bg-white border-b border-slate-100">
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3].map((s) => (
                <React.Fragment key={s}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                    step === s 
                      ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25' 
                      : step > s 
                        ? 'bg-emerald-100 text-emerald-700' 
                        : 'bg-slate-100 text-slate-400'
                  }`}>
                    {step > s ? <CheckCircle className="h-5 w-5" /> : s}
                  </div>
                  {s < 3 && <div className={`w-16 h-1 rounded-full ${step > s ? 'bg-emerald-400' : 'bg-slate-200'}`} />}
                </React.Fragment>
              ))}
            </div>
            <div className="flex justify-center gap-8 text-xs text-slate-500 mt-2">
              <span className={step === 1 ? 'font-semibold text-blue-600' : ''}>Customer Info</span>
              <span className={step === 2 ? 'font-semibold text-blue-600' : ''}>Verify OTP</span>
              <span className={step === 3 ? 'font-semibold text-blue-600' : ''}>Credit Report</span>
            </div>
          </div>
        )}
        
        {/* Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === 1 && (
              <CustomerInfoForm
                key="form"
                formData={formData}
                setFormData={setFormData}
                onSubmit={handleRequestOTP}
                loading={loading}
              />
            )}
            
            {step === 2 && (
              <OTPVerification
                key="otp"
                mobile={formData.mobile_number}
                onVerify={handleVerifyOTP}
                onBack={handleRecheck}
                loading={loading}
              />
            )}
            
            {step === 3 && creditResult && (
              <CreditReportView
                key="report"
                data={creditResult}
                fullReport={lead?.credit_score_full_report}
                bureau={formData.bureau}
                onRecheck={handleRecheck}
                onClose={handleClose}
              />
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CreditScoreModal;
