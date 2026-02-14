import React, { useState, useEffect, useCallback } from 'react';
import { attendanceApi, payrollApi, leaveApi, hrApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Loader2, Clock, DollarSign, Calendar, CheckCircle, XCircle, AlertCircle,
  Download, Users, PlayCircle, StopCircle, RefreshCw, FileText, Search, Filter
} from 'lucide-react';

// ==================== ATTENDANCE DASHBOARD ====================
export function AttendanceDashboard({ isHR }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeSessions, setActiveSessions] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [countries, setCountries] = useState([]);
  const [filterCountry, setFilterCountry] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [view, setView] = useState('active'); // active, records, approvals

  const fetchCountries = useCallback(async () => {
    try {
      const res = await hrApi.getAllCountries();
      setCountries(res.data || []);
    } catch (e) { console.error('Failed to load countries'); }
  }, []);

  const fetchActiveSessions = useCallback(async () => {
    try {
      const res = await attendanceApi.getActiveSessions(filterCountry || undefined);
      setActiveSessions(res.data || []);
    } catch (e) { console.error('Failed to load sessions'); }
  }, [filterCountry]);

  const fetchAttendanceRecords = useCallback(async () => {
    try {
      const res = await attendanceApi.getAttendance({ 
        month: filterMonth, 
        year: filterYear, 
        country_id: filterCountry || undefined 
      });
      setAttendanceRecords(res.data || []);
    } catch (e) { console.error('Failed to load attendance'); }
  }, [filterMonth, filterYear, filterCountry]);

  const fetchPendingApprovals = useCallback(async () => {
    if (!isHR) return;
    try {
      const res = await attendanceApi.getPendingApprovals(filterCountry || undefined);
      setPendingApprovals(res.data || []);
    } catch (e) { console.error('Failed to load approvals'); }
  }, [filterCountry, isHR]);

  useEffect(() => { fetchCountries(); }, [fetchCountries]);
  
  useEffect(() => {
    setLoading(true);
    Promise.all([fetchActiveSessions(), fetchAttendanceRecords(), fetchPendingApprovals()])
      .finally(() => setLoading(false));
  }, [fetchActiveSessions, fetchAttendanceRecords, fetchPendingApprovals]);

  const handleForceLogout = async (sessionId) => {
    if (!window.confirm('Force logout this session?')) return;
    try {
      await attendanceApi.forceLogout(sessionId);
      toast.success('Session ended');
      fetchActiveSessions();
    } catch (e) { toast.error('Failed to end session'); }
  };

  const handleOverride = async (recordId, status, notes) => {
    try {
      await attendanceApi.overrideAttendance(recordId, { status, notes });
      toast.success('Attendance updated');
      fetchPendingApprovals();
      fetchAttendanceRecords();
    } catch (e) { toast.error('Failed to update'); }
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '-';
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hrs}h ${mins}m`;
  };

  return (
    <div className="p-6" data-testid="attendance-dashboard">
      {/* View Tabs */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <Button
            variant={view === 'active' ? 'default' : 'outline'}
            onClick={() => setView('active')}
            className="gap-2"
          >
            <PlayCircle className="h-4 w-4" /> Active Sessions
          </Button>
          <Button
            variant={view === 'records' ? 'default' : 'outline'}
            onClick={() => setView('records')}
            className="gap-2"
          >
            <Clock className="h-4 w-4" /> Records
          </Button>
          {isHR && (
            <Button
              variant={view === 'approvals' ? 'default' : 'outline'}
              onClick={() => setView('approvals')}
              className="gap-2"
            >
              <AlertCircle className="h-4 w-4" /> Pending Approvals
              {pendingApprovals.length > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {pendingApprovals.length}
                </span>
              )}
            </Button>
          )}
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3">
          <Select value={filterCountry || 'all'} onValueChange={(v) => setFilterCountry(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {countries.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          
          {view === 'records' && (
            <>
              <Select value={String(filterMonth)} onValueChange={(v) => setFilterMonth(parseInt(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 12 }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(parseInt(v))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2023, 2024, 2025].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </>
          )}
          
          <Button variant="outline" size="icon" onClick={() => {
            fetchActiveSessions();
            fetchAttendanceRecords();
            fetchPendingApprovals();
          }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* Active Sessions View */}
          {view === 'active' && (
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Login Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Duration</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Last Activity</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                    {isHR && <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activeSessions.length === 0 ? (
                    <tr>
                      <td colSpan={isHR ? 6 : 5} className="text-center py-12 text-gray-500">
                        <PlayCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        No active sessions
                      </td>
                    </tr>
                  ) : (
                    activeSessions.map((session) => (
                      <tr key={session.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-emerald-500 flex items-center justify-center text-white text-sm font-medium">
                              {session.employee_name?.charAt(0)}
                            </div>
                            <span className="font-medium">{session.employee_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {session.login_time ? new Date(session.login_time).toLocaleTimeString() : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {formatDuration(session.active_minutes)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {session.last_activity ? new Date(session.last_activity).toLocaleTimeString() : '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs rounded-full">
                            <span className="h-2 w-2 bg-emerald-500 rounded-full animate-pulse"></span>
                            Active
                          </span>
                        </td>
                        {isHR && (
                          <td className="px-4 py-3">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleForceLogout(session.id)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <StopCircle className="h-4 w-4 mr-1" /> End
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Records View */}
          {view === 'records' && (
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Login</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Logout</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Active Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {attendanceRecords.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-gray-500">
                        <Clock className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        No attendance records found
                      </td>
                    </tr>
                  ) : (
                    attendanceRecords.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium">{record.employee_name}</td>
                        <td className="px-4 py-3 text-sm">{record.date}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{record.login_time || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{record.logout_time || '-'}</td>
                        <td className="px-4 py-3 text-sm">{formatDuration(record.active_minutes)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={record.status} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Pending Approvals View */}
          {view === 'approvals' && isHR && (
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Issue</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Active Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pendingApprovals.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-500">
                        <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-300" />
                        No pending approvals
                      </td>
                    </tr>
                  ) : (
                    pendingApprovals.map((record) => (
                      <tr key={record.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium">{record.employee_name}</td>
                        <td className="px-4 py-3 text-sm">{record.date}</td>
                        <td className="px-4 py-3 text-sm text-amber-600">{record.issue || 'Needs review'}</td>
                        <td className="px-4 py-3 text-sm">{formatDuration(record.active_minutes)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                              onClick={() => handleOverride(record.id, 'present', 'Approved by HR')}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-300 hover:bg-red-50"
                              onClick={() => handleOverride(record.id, 'absent', 'Rejected by HR')}
                            >
                              <XCircle className="h-4 w-4 mr-1" /> Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ==================== PAYROLL DASHBOARD (NEW BATCH-BASED GOVERNANCE) ====================
export function PayrollDashboard({ isHR, isFinance }) {
  // View states
  const [view, setView] = useState('batches'); // batches, preview, batch-detail
  const [loading, setLoading] = useState(true);
  
  // Data states
  const [batches, setBatches] = useState([]);
  const [countries, setCountries] = useState([]);
  const [previewData, setPreviewData] = useState(null);
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [batchRecords, setBatchRecords] = useState([]);
  
  // Filter states
  const [filterCountry, setFilterCountry] = useState('');
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterBatchStatus, setFilterBatchStatus] = useState('all');
  
  // Generate modal states
  const [isGenerateModalOpen, setIsGenerateModalOpen] = useState(false);
  const [generateMonth, setGenerateMonth] = useState(new Date().getMonth() + 1);
  const [generateYear, setGenerateYear] = useState(new Date().getFullYear());
  const [generateCountry, setGenerateCountry] = useState('');
  const [generating, setGenerating] = useState(false);
  
  // Payment modal states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentData, setPaymentData] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: 'BANK_TRANSFER',
    transaction_reference: '',
    notes: ''
  });
  
  // Editing states
  const [editingRecord, setEditingRecord] = useState(null);
  const [editingValues, setEditingValues] = useState({});
  const [saving, setSaving] = useState(false);
  
  // Preview editing states (for absent_days, other_deductions, and batch working_days)
  const [previewEdits, setPreviewEdits] = useState({});  // { employee_id: { absent_days, other_deductions } }
  const [previewErrors, setPreviewErrors] = useState({}); // { employee_id: { field: error_message } }
  const [batchWorkingDays, setBatchWorkingDays] = useState(null); // Editable working days for entire batch

  const fetchCountries = useCallback(async () => {
    try {
      const res = await hrApi.getAllCountries();
      setCountries(res.data || []);
      if (res.data?.length > 0 && !filterCountry) {
        setFilterCountry(res.data[0].id);
        setGenerateCountry(res.data[0].id);
      }
    } catch (e) { console.error('Failed to load countries'); }
  }, [filterCountry]);

  const fetchBatches = useCallback(async () => {
    setLoading(true);
    try {
      const res = await payrollApi.getBatches({
        country_id: filterCountry || undefined,
        year: filterYear,
        status: filterBatchStatus !== 'all' ? filterBatchStatus : undefined
      });
      setBatches(res.data || []);
    } catch (e) { 
      console.error('Failed to load batches');
      setBatches([]);
    } finally { 
      setLoading(false); 
    }
  }, [filterCountry, filterYear, filterBatchStatus]);

  useEffect(() => { fetchCountries(); }, [fetchCountries]);
  useEffect(() => { if (view === 'batches') fetchBatches(); }, [fetchBatches, view]);

  // Generate Payroll Preview
  const handleGeneratePreview = async () => {
    if (!generateCountry) {
      toast.error('Please select a country');
      return;
    }
    setGenerating(true);
    try {
      const res = await payrollApi.preview({
        month: generateMonth,
        year: generateYear,
        country_id: generateCountry
      });
      setPreviewData(res.data);
      // Set batch working days (editable at header level)
      setBatchWorkingDays(res.data.working_days);
      // Initialize preview edits with current values - now using absent_days (defaulting to 0)
      const initialEdits = {};
      res.data.records.forEach(record => {
        // Calculate absent days from working days and attendance days
        const absentDays = (record.working_days_in_month || res.data.working_days) - (record.attendance_days || record.working_days_in_month || res.data.working_days);
        initialEdits[record.employee_id] = {
          absent_days: Math.max(0, absentDays), // Default to 0 or calculated value
          other_deductions: record.other_deductions || 0
        };
      });
      setPreviewEdits(initialEdits);
      setPreviewErrors({});
      setIsGenerateModalOpen(false);
      setView('preview');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to generate preview');
    } finally {
      setGenerating(false);
    }
  };

  // Handle batch-level working days change
  const handleWorkingDaysChange = (value) => {
    const numValue = value === '' ? 0 : parseInt(value, 10);
    if (isNaN(numValue) || numValue < 1) return;
    
    setBatchWorkingDays(numValue);
    
    // Recalculate all employee records with new working days
    setPreviewData(prev => {
      if (!prev) return prev;

      const updatedRecords = prev.records.map(record => {
        const workingDays = numValue;
        const gross = record.gross_salary;
        const perDaySalary = workingDays > 0 ? gross / workingDays : 0;

        // Get absent days (from edit or default to 0)
        let absentDays = previewEdits[record.employee_id]?.absent_days ?? 0;
        // Cap absent days at working days
        absentDays = Math.min(Math.max(0, absentDays), workingDays);
        
        // Calculate attendance (present) days
        const attendanceDays = workingDays - absentDays;
        
        // Calculate attendance deduction
        const attendanceDeduction = Math.round(perDaySalary * absentDays * 100) / 100;

        // Get other deductions
        let otherDeductions = previewEdits[record.employee_id]?.other_deductions ?? record.other_deductions ?? 0;
        
        // Cap other deductions at net before other
        const netBeforeOther = gross - record.total_statutory_deductions - attendanceDeduction;
        otherDeductions = Math.min(Math.max(0, otherDeductions), Math.max(0, netBeforeOther));

        // Calculate totals
        const totalDeductions = record.total_statutory_deductions + attendanceDeduction + otherDeductions;
        const netSalary = Math.round((gross - totalDeductions) * 100) / 100;

        return {
          ...record,
          working_days_in_month: workingDays,
          attendance_days: attendanceDays,
          unapproved_absent_days: absentDays,
          attendance_deduction: attendanceDeduction,
          per_day_salary: Math.round(perDaySalary * 100) / 100,
          other_deductions: otherDeductions,
          total_deductions: Math.round(totalDeductions * 100) / 100,
          net_salary: netSalary
        };
      });

      // Recalculate batch totals
      const totalGross = updatedRecords.reduce((sum, r) => sum + r.gross_salary, 0);
      const totalStatutory = updatedRecords.reduce((sum, r) => sum + r.total_statutory_deductions, 0);
      const totalAttendance = updatedRecords.reduce((sum, r) => sum + r.attendance_deduction, 0);
      const totalOther = updatedRecords.reduce((sum, r) => sum + r.other_deductions, 0);
      const totalNet = updatedRecords.reduce((sum, r) => sum + r.net_salary, 0);

      return {
        ...prev,
        working_days: numValue,
        records: updatedRecords,
        total_gross: Math.round(totalGross * 100) / 100,
        total_statutory_deductions: Math.round(totalStatutory * 100) / 100,
        total_attendance_deductions: Math.round(totalAttendance * 100) / 100,
        total_other_deductions: Math.round(totalOther * 100) / 100,
        total_net: Math.round(totalNet * 100) / 100
      };
    });

    // Re-validate absent days for all employees
    const newErrors = {};
    Object.keys(previewEdits).forEach(employeeId => {
      const absentDays = previewEdits[employeeId]?.absent_days ?? 0;
      if (absentDays > numValue) {
        newErrors[employeeId] = { absent_days: `Cannot exceed ${numValue} working days` };
      }
    });
    setPreviewErrors(newErrors);
  };

  // Handle preview field edit with validation and recalculation (now uses absent_days)
  const handlePreviewEdit = (employeeId, field, value) => {
    const record = previewData.records.find(r => r.employee_id === employeeId);
    if (!record) return;

    // Parse value as integer (no half-days)
    const numValue = value === '' ? 0 : parseInt(value, 10);
    if (isNaN(numValue)) return;

    // Update edit state
    setPreviewEdits(prev => ({
      ...prev,
      [employeeId]: {
        ...prev[employeeId],
        [field]: numValue
      }
    }));

    // Validate
    const errors = { ...previewErrors };
    if (!errors[employeeId]) errors[employeeId] = {};

    const workingDays = batchWorkingDays || record.working_days_in_month;

    if (field === 'absent_days') {
      if (numValue < 0) {
        errors[employeeId].absent_days = 'Must be ≥ 0';
      } else if (numValue > workingDays) {
        errors[employeeId].absent_days = `Cannot exceed ${workingDays} working days`;
      } else {
        delete errors[employeeId].absent_days;
      }
    }

    if (field === 'other_deductions') {
      // Calculate net before other to validate cap
      const absentDays = field === 'absent_days' ? numValue : (previewEdits[employeeId]?.absent_days ?? 0);
      const perDaySalary = record.gross_salary / workingDays;
      const attendanceDeduction = perDaySalary * absentDays;
      const netBeforeOther = record.gross_salary - record.total_statutory_deductions - attendanceDeduction;

      if (numValue < 0) {
        errors[employeeId].other_deductions = 'Must be ≥ 0';
      } else if (numValue > netBeforeOther) {
        errors[employeeId].other_deductions = `Cannot exceed net salary (${formatCurrency(netBeforeOther, record.currency_symbol)})`;
      } else {
        delete errors[employeeId].other_deductions;
      }
    }

    // Clean up empty error objects
    if (Object.keys(errors[employeeId]).length === 0) {
      delete errors[employeeId];
    }
    setPreviewErrors(errors);

    // Recalculate preview data
    recalculatePreview(employeeId, field, numValue);
  };

  // Recalculate payroll for employee in preview (now uses absent_days)
  const recalculatePreview = (employeeId, changedField, newValue) => {
    setPreviewData(prev => {
      if (!prev) return prev;

      const updatedRecords = prev.records.map(record => {
        if (record.employee_id !== employeeId) return record;

        const workingDays = batchWorkingDays || record.working_days_in_month;
        const gross = record.gross_salary;
        const perDaySalary = workingDays > 0 ? gross / workingDays : 0;

        // Get absent days (from edit or default to 0)
        let absentDays = changedField === 'absent_days' 
          ? newValue 
          : (previewEdits[employeeId]?.absent_days ?? 0);
        
        // Cap absent days at working days
        absentDays = Math.min(Math.max(0, absentDays), workingDays);
        
        // Calculate attendance (present) days: Present = Working - Absent
        const attendanceDays = workingDays - absentDays;
        
        // Calculate attendance deduction based on absent days
        const attendanceDeduction = Math.round(perDaySalary * absentDays * 100) / 100;

        // Get other deductions
        let otherDeductions = changedField === 'other_deductions'
          ? newValue
          : (previewEdits[employeeId]?.other_deductions ?? record.other_deductions);
        
        // Cap other deductions at net before other
        const netBeforeOther = gross - record.total_statutory_deductions - attendanceDeduction;
        otherDeductions = Math.min(Math.max(0, otherDeductions), Math.max(0, netBeforeOther));

        // Calculate totals
        const totalDeductions = record.total_statutory_deductions + attendanceDeduction + otherDeductions;
        const netSalary = Math.round((gross - totalDeductions) * 100) / 100;

        return {
          ...record,
          working_days_in_month: workingDays,
          attendance_days: attendanceDays,
          unapproved_absent_days: absentDays,
          attendance_deduction: attendanceDeduction,
          other_deductions: otherDeductions,
          total_deductions: Math.round(totalDeductions * 100) / 100,
          net_salary: netSalary
        };
      });

      // Recalculate batch totals
      const totalGross = updatedRecords.reduce((sum, r) => sum + r.gross_salary, 0);
      const totalStatutory = updatedRecords.reduce((sum, r) => sum + r.total_statutory_deductions, 0);
      const totalAttendance = updatedRecords.reduce((sum, r) => sum + r.attendance_deduction, 0);
      const totalOther = updatedRecords.reduce((sum, r) => sum + r.other_deductions, 0);
      const totalNet = updatedRecords.reduce((sum, r) => sum + r.net_salary, 0);

      return {
        ...prev,
        records: updatedRecords,
        total_gross: Math.round(totalGross * 100) / 100,
        total_statutory_deductions: Math.round(totalStatutory * 100) / 100,
        total_attendance_deductions: Math.round(totalAttendance * 100) / 100,
        total_other_deductions: Math.round(totalOther * 100) / 100,
        total_net: Math.round(totalNet * 100) / 100
      };
    });
  };

  // Check if preview has any validation errors
  const hasPreviewErrors = () => {
    return Object.keys(previewErrors).length > 0;
  };

  // Create Batch from Preview
  const handleCreateBatch = async () => {
    if (!previewData) return;
    
    // Check for validation errors
    if (hasPreviewErrors()) {
      toast.error('Please fix validation errors before creating batch');
      return;
    }
    
    if (!window.confirm('Create payroll batch? Records can be edited before confirmation.')) return;
    
    setGenerating(true);
    try {
      const res = await payrollApi.createBatch({
        month: previewData.month,
        year: previewData.year,
        country_id: previewData.country_id,
        records: previewData.records
      });
      toast.success('Batch created successfully');
      setPreviewData(null);
      setPreviewEdits({});
      setPreviewErrors({});
      setSelectedBatch(res.data);
      fetchBatches();
      // Fetch batch details
      const batchRes = await payrollApi.getBatch(res.data.id);
      setBatchRecords(batchRes.data.records || []);
      setView('batch-detail');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to create batch');
    } finally {
      setGenerating(false);
    }
  };

  // Open batch detail
  const handleViewBatch = async (batch) => {
    setLoading(true);
    try {
      const res = await payrollApi.getBatch(batch.id);
      setSelectedBatch(res.data.batch);
      setBatchRecords(res.data.records || []);
      setView('batch-detail');
    } catch (e) {
      toast.error('Failed to load batch');
    } finally {
      setLoading(false);
    }
  };

  // Start editing a record
  const handleStartEdit = (record) => {
    setEditingRecord(record.id);
    setEditingValues({
      pf_employee: record.pf_employee || 0,
      professional_tax: record.professional_tax || 0,
      income_tax: record.income_tax || 0,
      esi: record.esi || 0,
      other_statutory: record.other_statutory || 0,
      attendance_days: record.attendance_days || record.working_days_in_month || 0,
      other_deductions: record.other_deductions || 0,
      other_deductions_reason: record.other_deductions_reason || '',
      attendance_deduction: record.attendance_deduction || 0,
      attendance_override: record.attendance_override || false,
      attendance_override_reason: record.attendance_override_reason || ''
    });
  };

  // Save edited record
  const handleSaveEdit = async () => {
    if (!selectedBatch || !editingRecord) return;
    setSaving(true);
    try {
      await payrollApi.updateBatchRecord(selectedBatch.id, editingRecord, editingValues);
      toast.success('Record updated');
      // Refresh batch
      const res = await payrollApi.getBatch(selectedBatch.id);
      setSelectedBatch(res.data.batch);
      setBatchRecords(res.data.records || []);
      setEditingRecord(null);
      setEditingValues({});
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update');
    } finally {
      setSaving(false);
    }
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingRecord(null);
    setEditingValues({});
  };

  // Confirm batch
  const handleConfirmBatch = async () => {
    if (!selectedBatch) return;
    if (!window.confirm('Confirm this batch? Records will be locked and payslips can be generated.')) return;
    
    try {
      await payrollApi.confirmBatch(selectedBatch.id, { notes: 'Confirmed by HR' });
      toast.success('Batch confirmed');
      // Refresh
      const res = await payrollApi.getBatch(selectedBatch.id);
      setSelectedBatch(res.data.batch);
      setBatchRecords(res.data.records || []);
      fetchBatches();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to confirm batch');
    }
  };

  // Mark batch as paid
  const handleMarkPaid = async () => {
    if (!selectedBatch || !paymentData.transaction_reference) {
      toast.error('Transaction reference is required');
      return;
    }
    
    try {
      await payrollApi.markBatchPaid(selectedBatch.id, paymentData);
      toast.success('Batch marked as paid and closed');
      setIsPaymentModalOpen(false);
      // Refresh
      const res = await payrollApi.getBatch(selectedBatch.id);
      setSelectedBatch(res.data.batch);
      setBatchRecords(res.data.records || []);
      fetchBatches();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to mark paid');
    }
  };

  // Delete draft batch
  const handleDeleteBatch = async () => {
    if (!selectedBatch) return;
    if (!window.confirm('Delete this DRAFT batch? This cannot be undone.')) return;
    
    try {
      await payrollApi.deleteBatch(selectedBatch.id);
      toast.success('Batch deleted');
      setSelectedBatch(null);
      setBatchRecords([]);
      setView('batches');
      fetchBatches();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to delete');
    }
  };

  // Generate payslip for a record (only after CONFIRMED)
  const handleGeneratePayslip = async (recordId) => {
    try {
      const res = await payrollApi.generatePayslip(recordId);
      toast.success('Payslip generated');
      if (res.data?.payslip_path) {
        // Refresh batch to get updated payslip_path
        const batchRes = await payrollApi.getBatch(selectedBatch.id);
        setBatchRecords(batchRes.data.records || []);
      }
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to generate payslip');
    }
  };

  const formatCurrency = (amount, symbol = '₹') => {
    if (amount === null || amount === undefined) return '-';
    return `${symbol}${new Intl.NumberFormat('en-IN').format(amount)}`;
  };

  const getStatusBadge = (status) => {
    const config = {
      'DRAFT': 'bg-amber-100 text-amber-700 border-amber-200',
      'CONFIRMED': 'bg-blue-100 text-blue-700 border-blue-200',
      'CLOSED': 'bg-emerald-100 text-emerald-700 border-emerald-200',
    };
    return config[status] || config.DRAFT;
  };

  // Calculate net for preview editing
  const calculateNet = (record, values) => {
    const gross = record.gross_salary || 0;
    const statutory = (values.pf_employee || 0) + (values.professional_tax || 0) + 
                     (values.income_tax || 0) + (values.esi || 0) + (values.other_statutory || 0);
    const attendance = values.attendance_deduction || 0;
    const other = values.other_deductions || 0;
    return gross - statutory - attendance - other;
  };

  return (
    <div className="p-6" data-testid="payroll-dashboard">
      {/* ========== BATCHES LIST VIEW ========== */}
      {view === 'batches' && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Payroll Batches</h2>
              <p className="text-sm text-gray-500">Manage monthly payroll batches</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Select value={filterCountry || 'all'} onValueChange={(v) => setFilterCountry(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-36" data-testid="filter-country">
                  <SelectValue placeholder="All Countries" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Countries</SelectItem>
                  {countries.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              
              <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(parseInt(v))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2023, 2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterBatchStatus} onValueChange={setFilterBatchStatus}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="DRAFT">Draft</SelectItem>
                  <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>

              {isHR && (
                <Button
                  onClick={() => setIsGenerateModalOpen(true)}
                  className="bg-gradient-to-r from-blue-600 to-blue-700"
                  data-testid="generate-payroll-btn"
                >
                  <DollarSign className="h-4 w-4 mr-2" /> Generate Payroll
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : (
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Period</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Country</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Employees</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Total Gross</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Total Net</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Generated</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {batches.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-gray-500">
                        <DollarSign className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        No payroll batches found
                      </td>
                    </tr>
                  ) : (
                    batches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-slate-50" data-testid={`batch-row-${batch.id}`}>
                        <td className="px-4 py-3">
                          <span className="font-medium">
                            {new Date(2000, batch.month - 1).toLocaleString('default', { month: 'long' })} {batch.year}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{batch.country_name}</td>
                        <td className="px-4 py-3 text-right text-sm">{batch.employee_count}</td>
                        <td className="px-4 py-3 text-right text-sm font-medium text-emerald-600">
                          {formatCurrency(batch.total_gross, batch.currency_symbol)}
                        </td>
                        <td className="px-4 py-3 text-right text-sm font-bold">
                          {formatCurrency(batch.total_net, batch.currency_symbol)}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(batch.status)}`}>
                            {batch.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {batch.generated_at ? new Date(batch.generated_at).toLocaleDateString() : '-'}
                          <br />
                          <span className="text-gray-400">by {batch.generated_by_name}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleViewBatch(batch)}
                            data-testid={`view-batch-${batch.id}`}
                          >
                            View Details
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* ========== PREVIEW VIEW (EDITABLE GRID) ========== */}
      {view === 'preview' && previewData && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => { setView('batches'); setPreviewData(null); setPreviewEdits({}); setPreviewErrors({}); }}>
                ← Back to Batches
              </Button>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Payroll Preview - {new Date(2000, previewData.month - 1).toLocaleString('default', { month: 'long' })} {previewData.year}
                </h2>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                  <span>{previewData.country_name}</span>
                  <span>•</span>
                  <span>{previewData.employee_count} employees</span>
                  <span>•</span>
                  <span className="font-medium text-slate-700">Pay Period: {previewData.pay_period_start} to {previewData.pay_period_end}</span>
                  <span>•</span>
                  <span className="font-medium text-indigo-600">{previewData.working_days} working days</span>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex gap-3">
                <div className="px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="text-xs text-emerald-600 block">Total Gross</span>
                  <span className="font-bold text-emerald-800">{formatCurrency(previewData.total_gross, previewData.currency_symbol)}</span>
                </div>
                <div className="px-3 py-1.5 bg-red-50 rounded-lg border border-red-200">
                  <span className="text-xs text-red-600 block">Total Deductions</span>
                  <span className="font-bold text-red-800">{formatCurrency((previewData.total_statutory_deductions || 0) + (previewData.total_attendance_deductions || 0) + (previewData.total_other_deductions || 0), previewData.currency_symbol)}</span>
                </div>
                <div className="px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-xs text-blue-600 block">Total Net</span>
                  <span className="font-bold text-blue-800">{formatCurrency(previewData.total_net, previewData.currency_symbol)}</span>
                </div>
              </div>
              
              <Button
                onClick={handleCreateBatch}
                disabled={generating || hasPreviewErrors()}
                className="bg-gradient-to-r from-blue-600 to-blue-700"
                data-testid="create-batch-btn"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Create Batch
              </Button>
            </div>
          </div>

          {hasPreviewErrors() && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700 text-sm">
              <AlertCircle className="h-4 w-4" />
              Please fix validation errors before creating batch
            </div>
          )}

          <div className="border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 sticky left-0 bg-slate-50">Employee</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Gross</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 bg-indigo-50">Working Days</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 bg-amber-50">
                    <div className="flex flex-col items-center">
                      <span>Attendance Days</span>
                      <span className="text-[10px] text-amber-600 font-normal">(Editable)</span>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 bg-red-50">PF</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 bg-red-50">PT</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 bg-red-50">TDS</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 bg-red-50">ESI</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 bg-amber-50">Attend. Ded.</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 bg-gray-100">
                    <div className="flex flex-col items-center">
                      <span>Other</span>
                      <span className="text-[10px] text-gray-500 font-normal">(Editable)</span>
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 bg-blue-50">Net Salary</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {previewData.records.map((record) => (
                  <tr key={record.employee_id} className={`hover:bg-slate-50 ${previewErrors[record.employee_id] ? 'bg-red-50/30' : ''}`}>
                    <td className="px-3 py-2 sticky left-0 bg-white">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                          {record.employee_name?.charAt(0)}
                        </div>
                        <div>
                          <span className="font-medium text-xs block">{record.employee_name}</span>
                          <span className="text-[10px] text-gray-500">{record.employee_code}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-emerald-600">{formatCurrency(record.gross_salary, record.currency_symbol)}</td>
                    <td className="px-3 py-2 text-center bg-indigo-50/50">
                      <span className="font-medium text-indigo-700">{record.working_days_in_month}</span>
                    </td>
                    <td className="px-3 py-2 bg-amber-50/50">
                      <div className="flex flex-col items-center">
                        <Input
                          type="number"
                          min="0"
                          max={record.working_days_in_month}
                          step="1"
                          value={previewEdits[record.employee_id]?.attendance_days ?? record.attendance_days}
                          onChange={(e) => handlePreviewEdit(record.employee_id, 'attendance_days', e.target.value)}
                          className={`w-16 h-7 text-center text-xs ${previewErrors[record.employee_id]?.attendance_days ? 'border-red-500 bg-red-50' : ''}`}
                          data-testid={`attendance-days-${record.employee_id}`}
                        />
                        {previewErrors[record.employee_id]?.attendance_days && (
                          <span className="text-[10px] text-red-600 mt-0.5">{previewErrors[record.employee_id].attendance_days}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right bg-red-50/50 text-red-600">{formatCurrency(record.pf_employee, record.currency_symbol)}</td>
                    <td className="px-3 py-2 text-right bg-red-50/50 text-red-600">{formatCurrency(record.professional_tax, record.currency_symbol)}</td>
                    <td className="px-3 py-2 text-right bg-red-50/50 text-red-600">{formatCurrency(record.income_tax, record.currency_symbol)}</td>
                    <td className="px-3 py-2 text-right bg-red-50/50 text-red-600">{formatCurrency(record.esi, record.currency_symbol)}</td>
                    <td className="px-3 py-2 text-right bg-amber-50/50 text-amber-600">{formatCurrency(record.attendance_deduction, record.currency_symbol)}</td>
                    <td className="px-3 py-2 bg-gray-100/50">
                      <div className="flex flex-col items-center">
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={previewEdits[record.employee_id]?.other_deductions ?? record.other_deductions}
                          onChange={(e) => handlePreviewEdit(record.employee_id, 'other_deductions', e.target.value)}
                          className={`w-20 h-7 text-center text-xs ${previewErrors[record.employee_id]?.other_deductions ? 'border-red-500 bg-red-50' : ''}`}
                          data-testid={`other-deductions-${record.employee_id}`}
                        />
                        {previewErrors[record.employee_id]?.other_deductions && (
                          <span className="text-[10px] text-red-600 mt-0.5 max-w-[100px] text-center">{previewErrors[record.employee_id].other_deductions}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right bg-blue-50/50 font-bold text-blue-800">{formatCurrency(record.net_salary, record.currency_symbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ========== BATCH DETAIL VIEW ========== */}
      {view === 'batch-detail' && selectedBatch && (
        <>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button variant="outline" onClick={() => { setView('batches'); setSelectedBatch(null); setBatchRecords([]); }}>
                ← Back to Batches
              </Button>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  {new Date(2000, selectedBatch.month - 1).toLocaleString('default', { month: 'long' })} {selectedBatch.year} - {selectedBatch.country_name}
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(selectedBatch.status)}`}>
                    {selectedBatch.status}
                  </span>
                </h2>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-500">
                  <span>{selectedBatch.employee_count} employees</span>
                  {selectedBatch.pay_period_start && selectedBatch.pay_period_end && (
                    <>
                      <span>•</span>
                      <span className="font-medium text-slate-600">Pay Period: {selectedBatch.pay_period_start} to {selectedBatch.pay_period_end}</span>
                    </>
                  )}
                  {selectedBatch.working_days && (
                    <>
                      <span>•</span>
                      <span className="font-medium text-indigo-600">{selectedBatch.working_days} working days</span>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Summary Cards */}
              <div className="flex gap-2">
                <div className="px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="text-xs text-emerald-600 block">Gross</span>
                  <span className="font-bold text-emerald-800 text-sm">{formatCurrency(selectedBatch.total_gross, selectedBatch.currency_symbol)}</span>
                </div>
                <div className="px-3 py-1.5 bg-red-50 rounded-lg border border-red-200">
                  <span className="text-xs text-red-600 block">Deductions</span>
                  <span className="font-bold text-red-800 text-sm">
                    {formatCurrency((selectedBatch.total_statutory_deductions || 0) + (selectedBatch.total_attendance_deductions || 0) + (selectedBatch.total_other_deductions || 0), selectedBatch.currency_symbol)}
                  </span>
                </div>
                <div className="px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-xs text-blue-600 block">Net</span>
                  <span className="font-bold text-blue-800 text-sm">{formatCurrency(selectedBatch.total_net, selectedBatch.currency_symbol)}</span>
                </div>
              </div>

              {/* Action Buttons based on status */}
              {selectedBatch.status === 'DRAFT' && isHR && (
                <>
                  <Button
                    variant="outline"
                    onClick={handleDeleteBatch}
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Delete
                  </Button>
                  <Button
                    onClick={handleConfirmBatch}
                    className="bg-gradient-to-r from-blue-600 to-blue-700"
                    data-testid="confirm-batch-btn"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" /> Confirm Batch
                  </Button>
                </>
              )}
              
              {selectedBatch.status === 'CONFIRMED' && isHR && (
                <Button
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="bg-gradient-to-r from-emerald-600 to-emerald-700"
                  data-testid="mark-paid-btn"
                >
                  <DollarSign className="h-4 w-4 mr-2" /> Mark as Paid
                </Button>
              )}
            </div>
          </div>

          {/* Records Table */}
          <div className="border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 sticky left-0 bg-slate-50">Employee</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Gross</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 bg-indigo-50">Working</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 bg-amber-50">Attended</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 bg-red-50">Statutory</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 bg-amber-50">Attend. Ded.</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">Other</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 bg-blue-50">Net</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {batchRecords.map((record) => (
                  <tr key={record.id} className={`hover:bg-slate-50 ${editingRecord === record.id ? 'bg-yellow-50' : ''}`}>
                    <td className="px-3 py-2 sticky left-0 bg-white">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                          {record.employee_name?.charAt(0)}
                        </div>
                        <div>
                          <span className="font-medium text-xs block">{record.employee_name}</span>
                          <span className="text-[10px] text-gray-500">{record.employee_code}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-medium text-emerald-600">
                      {formatCurrency(record.gross_salary, record.currency_symbol)}
                    </td>
                    
                    {/* Working Days (read-only) */}
                    <td className="px-3 py-2 text-center bg-indigo-50/50 text-indigo-700 font-medium">
                      {record.working_days_in_month || '-'}
                    </td>
                    
                    {/* Attendance Days */}
                    {editingRecord === record.id && selectedBatch.status === 'DRAFT' ? (
                      <td className="px-2 py-1 bg-amber-50/50">
                        <Input
                          type="number"
                          min="0"
                          max={record.working_days_in_month}
                          step="1"
                          value={editingValues.attendance_days ?? record.attendance_days}
                          onChange={(e) => setEditingValues({
                            ...editingValues, 
                            attendance_days: parseInt(e.target.value, 10) || 0
                          })}
                          className="h-6 text-xs w-14 text-center"
                        />
                      </td>
                    ) : (
                      <td className="px-3 py-2 text-center bg-amber-50/50 text-amber-700 font-medium">
                        {record.attendance_days ?? '-'}
                      </td>
                    )}
                    
                    {/* Statutory Deductions */}
                    {editingRecord === record.id ? (
                      <td className="px-2 py-1 bg-red-50/50">
                        <div className="flex flex-col gap-1">
                          <Input
                            type="number"
                            value={editingValues.pf_employee}
                            onChange={(e) => setEditingValues({...editingValues, pf_employee: parseFloat(e.target.value) || 0})}
                            className="h-6 text-xs w-20"
                            placeholder="PF"
                          />
                          <Input
                            type="number"
                            value={editingValues.professional_tax}
                            onChange={(e) => setEditingValues({...editingValues, professional_tax: parseFloat(e.target.value) || 0})}
                            className="h-6 text-xs w-20"
                            placeholder="PT"
                          />
                          <Input
                            type="number"
                            value={editingValues.income_tax}
                            onChange={(e) => setEditingValues({...editingValues, income_tax: parseFloat(e.target.value) || 0})}
                            className="h-6 text-xs w-20"
                            placeholder="TDS"
                          />
                        </div>
                      </td>
                    ) : (
                      <td className="px-3 py-2 text-right bg-red-50/50 text-red-600">
                        {formatCurrency(record.total_statutory_deductions, record.currency_symbol)}
                      </td>
                    )}
                    
                    {/* Attendance Deduction */}
                    {editingRecord === record.id ? (
                      <td className="px-2 py-1 bg-amber-50/50">
                        <Input
                          type="number"
                          value={editingValues.attendance_deduction}
                          onChange={(e) => setEditingValues({
                            ...editingValues, 
                            attendance_deduction: parseFloat(e.target.value) || 0,
                            attendance_override: true,
                            attendance_override_reason: 'Manual override by HR'
                          })}
                          className="h-6 text-xs w-20"
                        />
                      </td>
                    ) : (
                      <td className="px-3 py-2 text-right bg-amber-50/50 text-amber-600">
                        {formatCurrency(record.attendance_deduction, record.currency_symbol)}
                        {record.attendance_override && <span className="text-[10px] block text-amber-500">*overridden</span>}
                      </td>
                    )}
                    
                    {/* Other Deductions */}
                    {editingRecord === record.id ? (
                      <td className="px-2 py-1">
                        <Input
                          type="number"
                          value={editingValues.other_deductions}
                          onChange={(e) => setEditingValues({...editingValues, other_deductions: parseFloat(e.target.value) || 0})}
                          className="h-6 text-xs w-20"
                        />
                      </td>
                    ) : (
                      <td className="px-3 py-2 text-right">
                        {formatCurrency(record.other_deductions, record.currency_symbol)}
                      </td>
                    )}
                    
                    {/* Net Salary */}
                    <td className="px-3 py-2 text-right bg-blue-50/50 font-bold text-blue-800">
                      {editingRecord === record.id 
                        ? formatCurrency(calculateNet(record, editingValues), record.currency_symbol)
                        : formatCurrency(record.net_salary, record.currency_symbol)
                      }
                    </td>
                    
                    {/* Actions */}
                    <td className="px-3 py-2">
                      {selectedBatch.status === 'DRAFT' && isHR && (
                        editingRecord === record.id ? (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={handleSaveEdit} disabled={saving} className="h-7 text-xs">
                              {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Save'}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={handleCancelEdit} className="h-7 text-xs">Cancel</Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => handleStartEdit(record)} className="h-7 text-xs">
                            Edit
                          </Button>
                        )
                      )}
                      {selectedBatch.status === 'CONFIRMED' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleGeneratePayslip(record.id)}
                          className="h-7 text-xs"
                        >
                          <FileText className="h-3 w-3 mr-1" /> Payslip
                        </Button>
                      )}
                      {selectedBatch.status === 'CLOSED' && record.payslip_path && (
                        <span className="text-xs text-emerald-600">✓ Paid</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ========== GENERATE PAYROLL MODAL ========== */}
      <Dialog open={isGenerateModalOpen} onOpenChange={setIsGenerateModalOpen}>
        <DialogContent className="sm:max-w-[400px]" data-testid="generate-payroll-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white">
                <DollarSign className="h-5 w-5" />
              </div>
              Generate Payroll
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Country *</Label>
              <Select value={generateCountry} onValueChange={setGenerateCountry}>
                <SelectTrigger className="h-10" data-testid="select-country">
                  <SelectValue placeholder="Select Country" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Month</Label>
                <Select value={String(generateMonth)} onValueChange={(v) => setGenerateMonth(parseInt(v))}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>
                        {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Year</Label>
                <Select value={String(generateYear)} onValueChange={(v) => setGenerateYear(parseInt(v))}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsGenerateModalOpen(false)}>Cancel</Button>
              <Button
                onClick={handleGeneratePreview}
                disabled={generating || !generateCountry}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                {generating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Preview Payroll
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========== PAYMENT MODAL ========== */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent className="sm:max-w-[400px]" data-testid="payment-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-emerald-500 to-emerald-600 flex items-center justify-center text-white">
                <CheckCircle className="h-5 w-5" />
              </div>
              Mark Batch as Paid
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm text-blue-800">
                <strong>Total Amount:</strong> {selectedBatch && formatCurrency(selectedBatch.total_net, selectedBatch.currency_symbol)}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                This will mark all {selectedBatch?.employee_count} records as paid and close the batch.
              </p>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Payment Date *</Label>
              <Input
                type="date"
                value={paymentData.payment_date}
                onChange={(e) => setPaymentData({...paymentData, payment_date: e.target.value})}
                className="h-10"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Payment Mode *</Label>
              <Select value={paymentData.payment_mode} onValueChange={(v) => setPaymentData({...paymentData, payment_mode: v})}>
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                  <SelectItem value="NEFT">NEFT</SelectItem>
                  <SelectItem value="RTGS">RTGS</SelectItem>
                  <SelectItem value="IMPS">IMPS</SelectItem>
                  <SelectItem value="UPI">UPI</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Transaction Reference *</Label>
              <Input
                value={paymentData.transaction_reference}
                onChange={(e) => setPaymentData({...paymentData, transaction_reference: e.target.value})}
                className="h-10"
                placeholder="Enter transaction reference"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-sm font-medium">Notes</Label>
              <textarea
                value={paymentData.notes}
                onChange={(e) => setPaymentData({...paymentData, notes: e.target.value})}
                className="w-full min-h-[60px] px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Optional notes..."
              />
            </div>
            
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)}>Cancel</Button>
              <Button
                onClick={handleMarkPaid}
                disabled={!paymentData.transaction_reference}
                className="bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800"
              >
                <CheckCircle className="h-4 w-4 mr-2" /> Confirm Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== LEAVE MANAGEMENT ====================
export function LeaveManagement({ isHR }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myRequests, setMyRequests] = useState([]);
  const [myBalance, setMyBalance] = useState(null);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [view, setView] = useState('my'); // my, approvals
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Apply form state
  const [applyForm, setApplyForm] = useState({
    leave_type: 'casual',
    start_date: '',
    end_date: '',
    reason: ''
  });
  const [applying, setApplying] = useState(false);

  const fetchMyData = useCallback(async () => {
    try {
      const [requestsRes, balanceRes] = await Promise.all([
        leaveApi.getMyRequests(filterYear, filterStatus !== 'all' ? filterStatus : undefined),
        leaveApi.getMyBalance(filterYear)
      ]);
      setMyRequests(requestsRes.data || []);
      setMyBalance(balanceRes.data);
    } catch (e) { console.error('Failed to load leave data'); }
  }, [filterYear, filterStatus]);

  const fetchPendingApprovals = useCallback(async () => {
    if (!isHR) return;
    try {
      const res = await leaveApi.getPendingApprovals();
      setPendingApprovals(res.data || []);
    } catch (e) { console.error('Failed to load approvals'); }
  }, [isHR]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMyData(), fetchPendingApprovals()])
      .finally(() => setLoading(false));
  }, [fetchMyData, fetchPendingApprovals]);

  const handleApply = async () => {
    if (!applyForm.start_date || !applyForm.end_date || !applyForm.reason) {
      toast.error('Please fill all fields');
      return;
    }
    setApplying(true);
    try {
      await leaveApi.apply(applyForm);
      toast.success('Leave request submitted');
      setIsApplyModalOpen(false);
      setApplyForm({ leave_type: 'casual', start_date: '', end_date: '', reason: '' });
      fetchMyData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to apply');
    } finally {
      setApplying(false);
    }
  };

  const handleApprove = async (requestId, approved, comments = '') => {
    try {
      await leaveApi.approve(requestId, { approved, comments });
      toast.success(approved ? 'Leave approved' : 'Leave rejected');
      fetchPendingApprovals();
    } catch (e) { toast.error('Failed to process'); }
  };

  const handleCancel = async (requestId) => {
    if (!window.confirm('Cancel this leave request?')) return;
    try {
      await leaveApi.cancel(requestId, 'Cancelled by employee');
      toast.success('Leave cancelled');
      fetchMyData();
    } catch (e) { toast.error('Failed to cancel'); }
  };

  const getStatusBadge = (status) => {
    const config = {
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
      approved: 'bg-emerald-100 text-emerald-700 border-emerald-200',
      rejected: 'bg-red-100 text-red-700 border-red-200',
      cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
    };
    return config[status] || config.pending;
  };

  return (
    <div className="p-6" data-testid="leave-management">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <Button
            variant={view === 'my' ? 'default' : 'outline'}
            onClick={() => setView('my')}
            className="gap-2"
          >
            <Calendar className="h-4 w-4" /> My Leave
          </Button>
          {isHR && (
            <Button
              variant={view === 'approvals' ? 'default' : 'outline'}
              onClick={() => setView('approvals')}
              className="gap-2"
            >
              <Users className="h-4 w-4" /> Approvals
              {pendingApprovals.length > 0 && (
                <span className="ml-1 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                  {pendingApprovals.length}
                </span>
              )}
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Leave Balance */}
          {myBalance && view === 'my' && (
            <div className="flex gap-3 mr-4">
              <div className="px-3 py-1.5 bg-blue-50 rounded-lg border border-blue-200">
                <span className="text-xs text-blue-600 block">Casual</span>
                <span className="font-bold text-blue-800">{myBalance.casual_leave?.remaining || 0} / {myBalance.casual_leave?.total || 12}</span>
              </div>
              <div className="px-3 py-1.5 bg-emerald-50 rounded-lg border border-emerald-200">
                <span className="text-xs text-emerald-600 block">Sick</span>
                <span className="font-bold text-emerald-800">{myBalance.sick_leave?.remaining || 0} / {myBalance.sick_leave?.total || 6}</span>
              </div>
            </div>
          )}

          {view === 'my' && (
            <>
              <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(parseInt(v))}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[2023, 2024, 2025].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </>
          )}

          <Button
            onClick={() => setIsApplyModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-blue-700"
          >
            <Calendar className="h-4 w-4 mr-2" /> Apply Leave
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <>
          {/* My Leave View */}
          {view === 'my' && (
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">From</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">To</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Days</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Reason</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {myRequests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-500">
                        <Calendar className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                        No leave requests found
                      </td>
                    </tr>
                  ) : (
                    myRequests.map((request) => (
                      <tr key={request.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            request.leave_type === 'casual' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {request.leave_type === 'casual' ? 'Casual' : 'Sick'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{request.start_date}</td>
                        <td className="px-4 py-3 text-sm">{request.end_date}</td>
                        <td className="px-4 py-3 text-sm font-medium">{request.days || 1}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{request.reason}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(request.status)}`}>
                            {request.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {request.status === 'pending' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCancel(request.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4 mr-1" /> Cancel
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Approvals View */}
          {view === 'approvals' && isHR && (
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Employee</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Type</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">From</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">To</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Days</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Reason</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {pendingApprovals.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center py-12 text-gray-500">
                        <CheckCircle className="h-12 w-12 mx-auto mb-3 text-emerald-300" />
                        No pending approvals
                      </td>
                    </tr>
                  ) : (
                    pendingApprovals.map((request) => (
                      <tr key={request.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                              {request.employee_name?.charAt(0)}
                            </div>
                            <span className="font-medium">{request.employee_name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            request.leave_type === 'casual' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                          }`}>
                            {request.leave_type === 'casual' ? 'Casual' : 'Sick'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">{request.start_date}</td>
                        <td className="px-4 py-3 text-sm">{request.end_date}</td>
                        <td className="px-4 py-3 text-sm font-medium">{request.days || 1}</td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs truncate">{request.reason}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-emerald-600 border-emerald-300 hover:bg-emerald-50"
                              onClick={() => handleApprove(request.id, true)}
                            >
                              <CheckCircle className="h-4 w-4 mr-1" /> Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-300 hover:bg-red-50"
                              onClick={() => handleApprove(request.id, false)}
                            >
                              <XCircle className="h-4 w-4 mr-1" /> Reject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Apply Leave Modal */}
      <Dialog open={isApplyModalOpen} onOpenChange={setIsApplyModalOpen}>
        <DialogContent className="sm:max-w-[450px]" data-testid="apply-leave-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white">
                <Calendar className="h-5 w-5" />
              </div>
              Apply for Leave
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Leave Type</Label>
              <Select value={applyForm.leave_type} onValueChange={(v) => setApplyForm({...applyForm, leave_type: v})}>
                <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">Casual Leave</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">From Date</Label>
                <Input
                  type="date"
                  value={applyForm.start_date}
                  onChange={(e) => setApplyForm({...applyForm, start_date: e.target.value})}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">To Date</Label>
                <Input
                  type="date"
                  value={applyForm.end_date}
                  onChange={(e) => setApplyForm({...applyForm, end_date: e.target.value})}
                  className="h-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Reason</Label>
              <textarea
                value={applyForm.reason}
                onChange={(e) => setApplyForm({...applyForm, reason: e.target.value})}
                className="w-full min-h-[80px] px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Reason for leave..."
              />
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={() => setIsApplyModalOpen(false)}>Cancel</Button>
              <Button
                onClick={handleApply}
                disabled={applying}
                className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                {applying && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Submit Request
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Helper component for status badge
function StatusBadge({ status }) {
  const config = {
    present: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Present' },
    absent: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Absent' },
    half_day: { color: 'bg-amber-100 text-amber-800 border-amber-200', label: 'Half Day' },
    leave: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Leave' },
    pending: { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Pending' },
  };
  const cfg = config[status] || config.pending;
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}
