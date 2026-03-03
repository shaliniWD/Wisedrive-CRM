// Customer Profile Modal - Comprehensive customer profile view for loan eligibility
import React, { useState, useEffect } from 'react';
import { loansApi } from '@/services/api';
import { toast } from 'sonner';
import {
  User, Building2, CreditCard, Car, MapPin, FileText,
  CheckCircle, XCircle, AlertCircle, RefreshCw, Loader2,
  TrendingUp, TrendingDown, Banknote, Shield, Calendar,
  ChevronRight, Edit2, Save, ArrowRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { formatCurrency } from './utils';

// Profile Status Badge
const ProfileStatusBadge = ({ status, score }) => {
  const statusConfig = {
    INCOMPLETE: { color: 'bg-red-100 text-red-700', icon: AlertCircle },
    PARTIAL: { color: 'bg-yellow-100 text-yellow-700', icon: AlertCircle },
    COMPLETE: { color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
    VERIFIED: { color: 'bg-green-100 text-green-700', icon: Shield },
  };
  
  const config = statusConfig[status] || statusConfig.INCOMPLETE;
  const Icon = config.icon;
  
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.color}`}>
        <Icon className="h-3 w-3" />
        {status?.replace('_', ' ')}
      </span>
      <span className="text-xs text-gray-500">{score}% complete</span>
    </div>
  );
};

// Eligibility Score Gauge
const EligibilityGauge = ({ score }) => {
  const getColor = (s) => {
    if (s >= 75) return 'text-green-600';
    if (s >= 50) return 'text-yellow-600';
    if (s >= 25) return 'text-orange-600';
    return 'text-red-600';
  };
  
  return (
    <div className="flex items-center gap-4">
      <div className="relative w-24 h-24">
        <svg className="w-24 h-24 transform -rotate-90">
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            className="text-gray-200"
          />
          <circle
            cx="48"
            cy="48"
            r="40"
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeDasharray={251.2}
            strokeDashoffset={251.2 - (251.2 * (score || 0)) / 100}
            className={getColor(score)}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-bold ${getColor(score)}`}>
            {score || 0}
          </span>
        </div>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-700">Eligibility Score</p>
        <p className="text-xs text-gray-500">
          {score >= 75 ? 'High approval chance' : 
           score >= 50 ? 'Moderate approval chance' :
           score >= 25 ? 'Low approval chance' : 
           'Very low approval chance'}
        </p>
      </div>
    </div>
  );
};

// Section Card Component
const SectionCard = ({ title, icon: Icon, status, children, action }) => {
  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="p-4 bg-gray-50 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-blue-600" />
          <h3 className="font-semibold">{title}</h3>
          {status && (
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              status === 'complete' ? 'bg-green-100 text-green-700' :
              status === 'partial' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>
              {status}
            </span>
          )}
        </div>
        {action}
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
};

const CustomerProfileModal = ({ isOpen, onClose, lead, onUpdate }) => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [editingKyc, setEditingKyc] = useState(false);
  const [kycForm, setKycForm] = useState({});
  const [pdfPassword, setPdfPassword] = useState('');
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  
  useEffect(() => {
    if (isOpen && lead?.id) {
      fetchProfile();
    }
  }, [isOpen, lead?.id]);
  
  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await loansApi.getProfile(lead.id);
      setProfile(res.data);
      setKycForm(res.data.kyc || {});
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      toast.error('Failed to load customer profile');
    } finally {
      setLoading(false);
    }
  };
  
  // Find bank statement document
  const bankStatementDoc = (lead?.documents || []).find(d => d.document_type === 'bank_statement');
  
  const handleAnalyzeBankStatement = async () => {
    if (!bankStatementDoc) {
      toast.error('Please upload bank statement first in Documents tab');
      return;
    }
    
    setAnalyzing(true);
    try {
      const res = await loansApi.analyzeBankStatement(lead.id, bankStatementDoc.id, pdfPassword || null);
      toast.success('Bank statement analyzed successfully');
      fetchProfile();
      onUpdate();
      setShowPasswordInput(false);
      setPdfPassword('');
    } catch (err) {
      console.error('Analysis failed:', err);
      const errorMsg = err.response?.data?.detail || 'Failed to analyze bank statement';
      // Check if it's a password-related error
      if (errorMsg.toLowerCase().includes('password') || errorMsg.toLowerCase().includes('unlock') || errorMsg.toLowerCase().includes('encrypted')) {
        setShowPasswordInput(true);
        toast.error('PDF is password protected. Please enter the password.');
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setAnalyzing(false);
    }
  };
  
  const handleSyncCreditReport = async () => {
    if (!lead?.credit_score) {
      toast.error('Please check credit score first');
      return;
    }
    
    setSyncing(true);
    try {
      const res = await loansApi.syncCreditReport(lead.id);
      toast.success('Credit report synced');
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to sync credit report');
    } finally {
      setSyncing(false);
    }
  };
  
  const handleCalculateEligibility = async () => {
    setCalculating(true);
    try {
      const res = await loansApi.calculateEligibility(lead.id);
      toast.success(`Eligibility calculated: ${res.data.overall_eligibility_score}%`);
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to calculate eligibility');
    } finally {
      setCalculating(false);
    }
  };
  
  const handleUpdateLocation = async (locationType) => {
    try {
      await loansApi.updateProfile(lead.id, { location_type: locationType });
      toast.success('Location updated');
      fetchProfile();
    } catch (err) {
      toast.error('Failed to update location');
    }
  };
  
  const handleSaveKyc = async () => {
    try {
      await loansApi.updateProfile(lead.id, { kyc: kycForm });
      toast.success('KYC details saved');
      setEditingKyc(false);
      fetchProfile();
    } catch (err) {
      toast.error('Failed to save KYC');
    }
  };
  
  const bankAnalysis = profile?.bank_statement_analysis;
  const creditProfile = profile?.credit_profile;
  const vehicleAnalyses = profile?.vehicle_analyses || [];
  const kyc = profile?.kyc || {};
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="customer-profile-modal">
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-blue-600" />
                Customer Profile
              </DialogTitle>
              <DialogDescription>
                {lead?.customer_name} • {lead?.customer_phone}
              </DialogDescription>
            </div>
            {profile && (
              <ProfileStatusBadge 
                status={profile.profile_status} 
                score={profile.profile_score} 
              />
            )}
          </div>
        </DialogHeader>
        
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto space-y-4 py-4 pr-2">
            {/* Eligibility Overview */}
            {profile?.overall_eligibility_score !== null && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
                <div className="flex items-center justify-between">
                  <EligibilityGauge score={profile.overall_eligibility_score} />
                  <Button onClick={handleCalculateEligibility} disabled={calculating}>
                    {calculating ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <RefreshCw className="h-4 w-4 mr-2" />
                    )}
                    Recalculate
                  </Button>
                </div>
                
                {/* Eligibility Factors */}
                {profile.eligibility_factors?.length > 0 && (
                  <div className="mt-4 grid grid-cols-5 gap-2">
                    {profile.eligibility_factors.map((factor, idx) => (
                      <div key={idx} className="bg-white rounded-lg p-2 text-center border">
                        <p className="text-xs text-gray-500 truncate">{factor.factor}</p>
                        <p className={`text-lg font-bold ${
                          factor.score >= 60 ? 'text-green-600' : 
                          factor.score >= 40 ? 'text-yellow-600' : 'text-red-600'
                        }`}>
                          {factor.score}
                        </p>
                        <p className="text-xs text-gray-400">{factor.weight}% weight</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* 1. Bank Statement Analysis */}
            <SectionCard 
              title="Bank Statement Analysis" 
              icon={Banknote}
              status={bankAnalysis ? 'complete' : 'pending'}
              action={
                <Button 
                  size="sm" 
                  onClick={handleAnalyzeBankStatement}
                  disabled={analyzing || !bankStatementDoc}
                >
                  {analyzing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  {bankAnalysis ? 'Re-analyze' : 'Analyze'}
                </Button>
              }
            >
              {!bankStatementDoc ? (
                <div className="text-center py-6 text-gray-500">
                  <FileText className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p>Bank statement not uploaded</p>
                  <p className="text-sm">Upload in Documents tab first</p>
                </div>
              ) : !bankAnalysis ? (
                <div className="text-center py-6 text-gray-500">
                  <Banknote className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p>Click "Analyze" to extract bank statement data</p>
                  <p className="text-sm">AI will extract ABB, spending patterns & more</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Bank Info */}
                  <div className="flex items-center gap-4 pb-3 border-b">
                    <Building2 className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="font-semibold text-lg">{bankAnalysis.bank_name || 'Unknown Bank'}</p>
                      <p className="text-sm text-gray-500">
                        A/C: {bankAnalysis.account_number_masked || 'N/A'} • 
                        Period: {bankAnalysis.statement_period_from} to {bankAnalysis.statement_period_to}
                      </p>
                    </div>
                    {bankAnalysis.confidence_score && (
                      <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                        {bankAnalysis.confidence_score}% confidence
                      </span>
                    )}
                  </div>
                  
                  {/* ABB & Balance */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-3">
                      <p className="text-xs text-blue-600 font-medium">Avg Bank Balance</p>
                      <p className="text-xl font-bold text-blue-800">
                        {formatCurrency(bankAnalysis.average_bank_balance)}
                      </p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3">
                      <p className="text-xs text-green-600 font-medium">Max Balance</p>
                      <p className="text-xl font-bold text-green-800">
                        {formatCurrency(bankAnalysis.maximum_balance)}
                      </p>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3">
                      <p className="text-xs text-red-600 font-medium">Min Balance</p>
                      <p className="text-xl font-bold text-red-800">
                        {formatCurrency(bankAnalysis.minimum_balance)}
                      </p>
                    </div>
                    <div className={`rounded-lg p-3 ${bankAnalysis.bounce_count > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <p className="text-xs text-gray-600 font-medium">Bounces</p>
                      <p className={`text-xl font-bold ${bankAnalysis.bounce_count > 0 ? 'text-red-600' : 'text-gray-800'}`}>
                        {bankAnalysis.bounce_count || 0}
                      </p>
                    </div>
                  </div>
                  
                  {/* Income & Spending */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-green-600" />
                        <p className="font-medium">Income Analysis</p>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Total Credits:</span>
                          <span className="font-medium">{formatCurrency(bankAnalysis.total_credits)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Avg Monthly:</span>
                          <span className="font-medium">{formatCurrency(bankAnalysis.average_monthly_credits)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Salary Identified:</span>
                          <span className="font-medium text-green-600">{formatCurrency(bankAnalysis.salary_credits_identified)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="h-4 w-4 text-red-600" />
                        <p className="font-medium">Spending Analysis</p>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Total Debits:</span>
                          <span className="font-medium">{formatCurrency(bankAnalysis.total_debits)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Avg Monthly:</span>
                          <span className="font-medium">{formatCurrency(bankAnalysis.average_monthly_debits)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">EMI Payments:</span>
                          <span className="font-medium text-red-600">{formatCurrency(bankAnalysis.loan_repayments_total)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Analysis Notes */}
                  {bankAnalysis.analysis_notes && (
                    <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                      <p className="text-xs font-medium text-yellow-700 mb-1">AI Analysis Notes</p>
                      <p className="text-sm text-yellow-800">{bankAnalysis.analysis_notes}</p>
                    </div>
                  )}
                </div>
              )}
            </SectionCard>
            
            {/* 2. Credit Bureau Analysis */}
            <SectionCard 
              title="Credit Bureau Report" 
              icon={CreditCard}
              status={creditProfile ? 'complete' : 'pending'}
              action={
                <Button 
                  size="sm" 
                  onClick={handleSyncCreditReport}
                  disabled={syncing || !lead?.credit_score}
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-1" />
                  )}
                  Sync from Report
                </Button>
              }
            >
              {!lead?.credit_score ? (
                <div className="text-center py-6 text-gray-500">
                  <CreditCard className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p>Credit score not checked</p>
                  <p className="text-sm">Check credit score first to sync report</p>
                </div>
              ) : !creditProfile ? (
                <div className="text-center py-6 text-gray-500">
                  <p>Credit score: <strong className="text-blue-600">{lead.credit_score}</strong></p>
                  <p className="text-sm">Click "Sync from Report" to analyze</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Credit Score */}
                  <div className="flex items-center gap-4 pb-3 border-b">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                      creditProfile.score_rating === 'EXCELLENT' ? 'bg-green-100 text-green-700' :
                      creditProfile.score_rating === 'GOOD' ? 'bg-blue-100 text-blue-700' :
                      creditProfile.score_rating === 'FAIR' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      <span className="text-xl font-bold">{creditProfile.credit_score}</span>
                    </div>
                    <div>
                      <p className="font-semibold text-lg">{creditProfile.score_rating}</p>
                      <p className="text-sm text-gray-500">
                        Source: {creditProfile.bureau_source?.toUpperCase()} • 
                        {creditProfile.total_accounts} accounts
                      </p>
                    </div>
                  </div>
                  
                  {/* Account Summary */}
                  <div className="grid grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Active</p>
                      <p className="text-xl font-bold">{creditProfile.active_accounts}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Closed</p>
                      <p className="text-xl font-bold">{creditProfile.closed_accounts}</p>
                    </div>
                    <div className={`rounded-lg p-3 text-center ${creditProfile.delinquent_accounts > 0 ? 'bg-red-50' : 'bg-gray-50'}`}>
                      <p className="text-xs text-gray-500">Delinquent</p>
                      <p className={`text-xl font-bold ${creditProfile.delinquent_accounts > 0 ? 'text-red-600' : ''}`}>
                        {creditProfile.delinquent_accounts}
                      </p>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <p className="text-xs text-gray-500">Outstanding</p>
                      <p className="text-lg font-bold text-blue-700">{formatCurrency(creditProfile.total_outstanding)}</p>
                    </div>
                  </div>
                  
                  {/* Existing Loans */}
                  {creditProfile.existing_auto_loans?.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Existing Auto Loans</p>
                      <div className="space-y-1">
                        {creditProfile.existing_auto_loans.map((loan, idx) => (
                          <div key={idx} className="flex justify-between text-sm bg-gray-50 p-2 rounded">
                            <span>{loan.lender}</span>
                            <span className="font-medium">{formatCurrency(loan.emi)}/mo</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Risk Flags */}
                  <div className="flex gap-2 flex-wrap">
                    {creditProfile.has_write_offs && (
                      <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">⚠️ Write-offs</span>
                    )}
                    {creditProfile.has_settlements && (
                      <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs">⚠️ Settlements</span>
                    )}
                    {creditProfile.has_defaults && (
                      <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs">⚠️ Defaults</span>
                    )}
                    {!creditProfile.has_write_offs && !creditProfile.has_settlements && !creditProfile.has_defaults && (
                      <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs">✓ No negative flags</span>
                    )}
                  </div>
                </div>
              )}
            </SectionCard>
            
            {/* 3. Location Classification */}
            <SectionCard 
              title="Location Classification" 
              icon={MapPin}
              status={profile?.location_type ? 'complete' : 'partial'}
            >
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <Label className="text-sm text-gray-500">Customer Location Type</Label>
                    <Select 
                      value={profile?.location_type || ''} 
                      onValueChange={handleUpdateLocation}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select location type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="METRO">Metro City</SelectItem>
                        <SelectItem value="URBAN">Urban</SelectItem>
                        <SelectItem value="SEMI_URBAN">Semi-Urban</SelectItem>
                        <SelectItem value="RURAL">Rural</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex-1">
                    <Label className="text-sm text-gray-500">City</Label>
                    <Input value={profile?.location_city || lead?.city_name || ''} disabled className="mt-1" />
                  </div>
                  <div className="w-32">
                    <Label className="text-sm text-gray-500">Pincode</Label>
                    <Input value={profile?.location_pincode || ''} placeholder="Enter" className="mt-1" />
                  </div>
                </div>
                {profile?.location_auto_detected && (
                  <p className="text-xs text-gray-500">
                    <CheckCircle className="h-3 w-3 inline mr-1 text-green-500" />
                    Auto-detected from city. You can override if incorrect.
                  </p>
                )}
              </div>
            </SectionCard>
            
            {/* 4. Vehicle Analysis */}
            <SectionCard 
              title="Vehicle Eligibility Analysis" 
              icon={Car}
              status={vehicleAnalyses.length > 0 ? 
                (vehicleAnalyses.every(v => v.vehicle_valuation) ? 'complete' : 'partial') : 
                'pending'
              }
            >
              {vehicleAnalyses.length === 0 ? (
                <div className="text-center py-6 text-gray-500">
                  <Car className="h-10 w-10 mx-auto mb-2 text-gray-300" />
                  <p>No vehicles added for this lead</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {vehicleAnalyses.map((v, idx) => (
                    <div key={v.vehicle_id} className={`p-3 rounded-lg border ${
                      v.is_excluded_make ? 'bg-red-50 border-red-200' : 
                      !v.is_within_15_years ? 'bg-yellow-50 border-yellow-200' :
                      'bg-green-50 border-green-200'
                    }`}>
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold">{v.car_number}</p>
                            {v.is_excluded_make && (
                              <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-xs">
                                ⚠️ Excluded Make
                              </span>
                            )}
                            {!v.is_within_15_years && !v.is_excluded_make && (
                              <span className="bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded text-xs">
                                ⚠️ Age &gt; 15 years
                              </span>
                            )}
                            {v.is_within_10_years && !v.is_excluded_make && (
                              <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-xs">
                                ✓ Age OK (≤10 yrs)
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-600">
                            {v.car_make} {v.car_model} {v.car_year}
                          </p>
                          {v.excluded_make_reason && (
                            <p className="text-xs text-red-600 mt-1">{v.excluded_make_reason}</p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-gray-500">Valuation</p>
                          <p className="font-bold text-lg">
                            {v.vehicle_valuation ? formatCurrency(v.vehicle_valuation) : '-'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-4 text-xs text-gray-500">
                        <span>Age: {v.vehicle_age_years || '-'} years</span>
                        <span>Within 10 yrs: {v.is_within_10_years ? '✓' : '✗'}</span>
                        <span>Within 15 yrs: {v.is_within_15_years ? '✓' : '✗'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
            
            {/* 5. KYC Details */}
            <SectionCard 
              title="KYC Details" 
              icon={User}
              status={kyc.pan_number ? 'complete' : 'partial'}
              action={
                editingKyc ? (
                  <Button size="sm" onClick={handleSaveKyc}>
                    <Save className="h-4 w-4 mr-1" /> Save
                  </Button>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setEditingKyc(true)}>
                    <Edit2 className="h-4 w-4 mr-1" /> Edit
                  </Button>
                )
              }
            >
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Full Name</Label>
                  {editingKyc ? (
                    <Input 
                      value={kycForm.full_name || ''} 
                      onChange={(e) => setKycForm(f => ({...f, full_name: e.target.value}))}
                      className="mt-1"
                    />
                  ) : (
                    <p className="font-medium">{kyc.full_name || '-'}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Mobile</Label>
                  <p className="font-medium">{kyc.mobile_primary || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Email</Label>
                  <p className="font-medium">{kyc.email || '-'}</p>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">PAN Number</Label>
                  {editingKyc ? (
                    <Input 
                      value={kycForm.pan_number || ''} 
                      onChange={(e) => setKycForm(f => ({...f, pan_number: e.target.value.toUpperCase()}))}
                      className="mt-1"
                      maxLength={10}
                    />
                  ) : (
                    <p className="font-medium">{kyc.pan_number || '-'}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Employment Type</Label>
                  {editingKyc ? (
                    <Select 
                      value={kycForm.employment_type || ''} 
                      onValueChange={(v) => setKycForm(f => ({...f, employment_type: v}))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SALARIED">Salaried</SelectItem>
                        <SelectItem value="SELF_EMPLOYED">Self Employed</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium">{kyc.employment_type?.replace('_', ' ') || '-'}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Monthly Income</Label>
                  {editingKyc ? (
                    <Input 
                      type="number"
                      value={kycForm.monthly_income || ''} 
                      onChange={(e) => setKycForm(f => ({...f, monthly_income: parseFloat(e.target.value)}))}
                      className="mt-1"
                      placeholder="₹"
                    />
                  ) : (
                    <p className="font-medium">{kyc.monthly_income ? formatCurrency(kyc.monthly_income) : '-'}</p>
                  )}
                </div>
                <div className="col-span-2">
                  <Label className="text-xs text-gray-500">Current Address</Label>
                  {editingKyc ? (
                    <Input 
                      value={kycForm.current_address || ''} 
                      onChange={(e) => setKycForm(f => ({...f, current_address: e.target.value}))}
                      className="mt-1"
                    />
                  ) : (
                    <p className="font-medium">{kyc.current_address || '-'}</p>
                  )}
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Employer</Label>
                  {editingKyc ? (
                    <Input 
                      value={kycForm.employer_name || ''} 
                      onChange={(e) => setKycForm(f => ({...f, employer_name: e.target.value}))}
                      className="mt-1"
                    />
                  ) : (
                    <p className="font-medium">{kyc.employer_name || '-'}</p>
                  )}
                </div>
              </div>
            </SectionCard>
            
            {/* Calculate Eligibility Button */}
            {!profile?.overall_eligibility_score && (
              <div className="text-center py-4">
                <Button 
                  size="lg" 
                  onClick={handleCalculateEligibility}
                  disabled={calculating}
                  className="bg-gradient-to-r from-blue-600 to-indigo-600"
                >
                  {calculating ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : (
                    <ArrowRight className="h-5 w-5 mr-2" />
                  )}
                  Calculate Eligibility Score
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CustomerProfileModal;
