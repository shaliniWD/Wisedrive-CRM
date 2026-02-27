import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Shield, Phone, Car, Calendar, CheckCircle, Lock, RefreshCw } from 'lucide-react';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// OTP Input Component
function OTPInput({ value, onChange, disabled }) {
  const handleChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    onChange(val);
  };

  return (
    <div className="flex justify-center gap-2">
      {[0, 1, 2, 3, 4, 5].map((idx) => (
        <input
          key={idx}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={value[idx] || ''}
          onChange={(e) => {
            const newVal = value.split('');
            newVal[idx] = e.target.value.replace(/\D/g, '');
            onChange(newVal.join('').slice(0, 6));
            // Auto-focus next input
            if (e.target.value && idx < 5) {
              const next = e.target.nextElementSibling;
              if (next) next.focus();
            }
          }}
          onKeyDown={(e) => {
            // Handle backspace
            if (e.key === 'Backspace' && !value[idx] && idx > 0) {
              const prev = e.target.previousElementSibling;
              if (prev) prev.focus();
            }
          }}
          disabled={disabled}
          className="w-12 h-14 text-center text-2xl font-bold border-2 rounded-lg focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all disabled:bg-gray-100"
          data-testid={`otp-input-${idx}`}
        />
      ))}
    </div>
  );
}

export default function CustomerReportPage() {
  const { shortCode } = useParams();
  const [step, setStep] = useState('loading'); // loading, info, otp, report
  const [reportInfo, setReportInfo] = useState(null);
  const [otp, setOtp] = useState('');
  const [accessToken, setAccessToken] = useState(null);
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState(null);

  // Check for existing session
  useEffect(() => {
    const storedToken = sessionStorage.getItem(`report_token_${shortCode}`);
    if (storedToken) {
      setAccessToken(storedToken);
      fetchReportData(storedToken);
    } else {
      fetchReportInfo();
    }
  }, [shortCode]);

  // Countdown timer for resend OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const fetchReportInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/api/report/public/${shortCode}`);
      setReportInfo(response.data);
      setStep('info');
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to load report information';
      setError(msg);
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  const sendOtp = async () => {
    setSendingOtp(true);
    try {
      const response = await axios.post(`${API_URL}/api/report/public/${shortCode}/send-otp`);
      toast.success('OTP sent to your phone');
      setStep('otp');
      setCountdown(60); // 60 second cooldown
    } catch (err) {
      const msg = err.response?.data?.detail || 'Failed to send OTP';
      toast.error(msg);
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setVerifyingOtp(true);
    try {
      const response = await axios.post(`${API_URL}/api/report/public/${shortCode}/verify-otp`, {
        otp: otp,
        phone: reportInfo?.masked_phone?.slice(-4) || '0000'
      });
      
      const token = response.data.access_token;
      setAccessToken(token);
      sessionStorage.setItem(`report_token_${shortCode}`, token);
      toast.success('Verified successfully!');
      fetchReportData(token);
    } catch (err) {
      const msg = err.response?.data?.detail || 'Invalid OTP';
      toast.error(msg);
      setOtp('');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const fetchReportData = async (token) => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${API_URL}/api/report/public/${shortCode}/data?token=${token}`
      );
      setReportData(response.data);
      setStep('report');
    } catch (err) {
      // Token might be expired
      sessionStorage.removeItem(`report_token_${shortCode}`);
      setAccessToken(null);
      setStep('info');
      if (err.response?.status === 401) {
        toast.error('Session expired. Please verify again.');
      } else {
        toast.error('Failed to load report');
      }
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (step === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading report...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (step === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Lock className="h-8 w-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Report Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button onClick={fetchReportInfo} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Info & OTP Verification screen
  if (step === 'info' || step === 'otp') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="h-8 w-8 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Vehicle Inspection Report</h1>
            <p className="text-gray-600">Secure access to your inspection report</p>
          </div>

          {/* Vehicle Info Card */}
          {reportInfo && (
            <div className="bg-gray-50 rounded-xl p-4 mb-6 space-y-3">
              <div className="flex items-center gap-3">
                <Car className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Vehicle</p>
                  <p className="font-semibold text-gray-900">
                    {reportInfo.vehicle_number || 'N/A'}
                    {reportInfo.vehicle_info && <span className="text-gray-600 font-normal ml-2">({reportInfo.vehicle_info})</span>}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Registered Phone</p>
                  <p className="font-semibold text-gray-900">{reportInfo.masked_phone || 'N/A'}</p>
                </div>
              </div>
              {reportInfo.inspection_date && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Inspection Date</p>
                    <p className="font-semibold text-gray-900">
                      {new Date(reportInfo.inspection_date).toLocaleDateString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* OTP Section */}
          {step === 'info' ? (
            <div className="text-center">
              <p className="text-gray-600 mb-4">
                To view your inspection report, we'll send a verification code to your registered phone number.
              </p>
              <Button 
                onClick={sendOtp} 
                disabled={sendingOtp}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 text-lg"
                data-testid="send-otp-btn"
              >
                {sendingOtp ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Sending OTP...
                  </>
                ) : (
                  <>
                    <Phone className="h-5 w-5 mr-2" />
                    Send OTP to {reportInfo?.masked_phone}
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <Label className="text-center block mb-4 text-gray-700">
                  Enter the 6-digit OTP sent to {reportInfo?.masked_phone}
                </Label>
                <OTPInput value={otp} onChange={setOtp} disabled={verifyingOtp} />
              </div>

              <Button 
                onClick={verifyOtp} 
                disabled={verifyingOtp || otp.length !== 6}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-6 text-lg"
                data-testid="verify-otp-btn"
              >
                {verifyingOtp ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    Verifying...
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-5 w-5 mr-2" />
                    Verify & View Report
                  </>
                )}
              </Button>

              <div className="text-center">
                <button
                  onClick={sendOtp}
                  disabled={countdown > 0 || sendingOtp}
                  className="text-sm text-blue-600 hover:text-blue-700 disabled:text-gray-400"
                >
                  {countdown > 0 ? (
                    `Resend OTP in ${countdown}s`
                  ) : (
                    'Resend OTP'
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Security Note */}
          <p className="text-xs text-gray-500 text-center mt-6">
            🔒 Your report is protected. Only the registered phone number can access this report.
          </p>
        </div>
      </div>
    );
  }

  // Report View - Redirect to actual report page with token
  if (step === 'report' && reportData) {
    // Instead of showing report here, redirect to the report page with access
    window.location.href = `/inspection-report/${reportData.inspection.id}?access_token=${accessToken}`;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading your report...</p>
        </div>
      </div>
    );
  }

  return null;
}
