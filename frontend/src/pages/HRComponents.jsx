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
                          {new Date(session.login_time).toLocaleTimeString()}
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

// ==================== PAYROLL DASHBOARD ====================
export function PayrollDashboard({ isHR, isFinance }) {
  const [loading, setLoading] = useState(true);
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [countries, setCountries] = useState([]);
  const [filterCountry, setFilterCountry] = useState('');
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterStatus, setFilterStatus] = useState('all');
  const [generating, setGenerating] = useState(false);

  const fetchCountries = useCallback(async () => {
    try {
      const res = await hrApi.getAllCountries();
      setCountries(res.data || []);
    } catch (e) { console.error('Failed to load countries'); }
  }, []);

  const fetchPayroll = useCallback(async () => {
    setLoading(true);
    try {
      const [recordsRes, summaryRes] = await Promise.all([
        payrollApi.getAll({
          month: filterMonth,
          year: filterYear,
          country_id: filterCountry || undefined,
          status: filterStatus !== 'all' ? filterStatus : undefined
        }),
        payrollApi.getSummary(filterMonth, filterYear, filterCountry || undefined)
      ]);
      setPayrollRecords(recordsRes.data || []);
      setSummary(summaryRes.data);
    } catch (e) { 
      console.error('Failed to load payroll');
      setPayrollRecords([]);
    } finally { 
      setLoading(false); 
    }
  }, [filterMonth, filterYear, filterCountry, filterStatus]);

  useEffect(() => { fetchCountries(); }, [fetchCountries]);
  useEffect(() => { fetchPayroll(); }, [fetchPayroll]);

  const handleGenerateBulk = async () => {
    if (!window.confirm(`Generate payroll for ${filterMonth}/${filterYear}?`)) return;
    setGenerating(true);
    try {
      await payrollApi.generateBulk({
        month: filterMonth,
        year: filterYear,
        country_id: filterCountry || undefined
      });
      toast.success('Payroll generated');
      fetchPayroll();
    } catch (e) { 
      toast.error(e.response?.data?.detail || 'Failed to generate payroll'); 
    } finally { 
      setGenerating(false); 
    }
  };

  const handleMarkPaid = async (payrollId) => {
    try {
      await payrollApi.markPaid(payrollId, { 
        payment_date: new Date().toISOString().split('T')[0],
        payment_method: 'bank_transfer'
      });
      toast.success('Marked as paid');
      fetchPayroll();
    } catch (e) { toast.error('Failed to mark paid'); }
  };

  const handleGeneratePayslip = async (payrollId) => {
    try {
      const res = await payrollApi.generatePayslip(payrollId);
      toast.success('Payslip generated');
      if (res.data?.payslip_url) {
        window.open(res.data.payslip_url, '_blank');
      }
    } catch (e) { toast.error('Failed to generate payslip'); }
  };

  const formatCurrency = (amount, symbol = '₹') => {
    if (!amount) return '-';
    return `${symbol}${new Intl.NumberFormat('en-IN').format(amount)}`;
  };

  return (
    <div className="p-6" data-testid="payroll-dashboard">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        {/* Summary Cards */}
        {summary && (
          <div className="flex gap-4">
            <div className="px-4 py-2 bg-blue-50 rounded-lg border border-blue-200">
              <span className="text-xs text-blue-600 block">Total Payroll</span>
              <span className="font-bold text-blue-800">{formatCurrency(summary.total_gross)}</span>
            </div>
            <div className="px-4 py-2 bg-emerald-50 rounded-lg border border-emerald-200">
              <span className="text-xs text-emerald-600 block">Paid</span>
              <span className="font-bold text-emerald-800">{summary.paid_count || 0}</span>
            </div>
            <div className="px-4 py-2 bg-amber-50 rounded-lg border border-amber-200">
              <span className="text-xs text-amber-600 block">Pending</span>
              <span className="font-bold text-amber-800">{summary.pending_count || 0}</span>
            </div>
          </div>
        )}

        {/* Filters & Actions */}
        <div className="flex items-center gap-3">
          <Select value={filterCountry || 'all'} onValueChange={(v) => setFilterCountry(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="All Countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {countries.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          
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

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>

          {isHR && (
            <Button
              onClick={handleGenerateBulk}
              disabled={generating}
              className="bg-gradient-to-r from-blue-600 to-blue-700"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <DollarSign className="h-4 w-4 mr-2" />}
              Generate Payroll
            </Button>
          )}
        </div>
      </div>

      {/* Payroll Table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Period</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Gross</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Deductions</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600">Net Pay</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payrollRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">
                    <DollarSign className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                    No payroll records found
                  </td>
                </tr>
              ) : (
                payrollRecords.map((record) => (
                  <tr key={record.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                          {record.employee_name?.charAt(0)}
                        </div>
                        <div>
                          <span className="font-medium block">{record.employee_name}</span>
                          <span className="text-xs text-gray-500">{record.employee_code}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {new Date(2000, record.month - 1).toLocaleString('default', { month: 'short' })} {record.year}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-medium text-emerald-600">
                      {formatCurrency(record.gross_salary)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-red-600">
                      {formatCurrency(record.total_deductions)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold">
                      {formatCurrency(record.net_salary)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        record.status === 'paid' 
                          ? 'bg-emerald-100 text-emerald-700' 
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {record.status === 'paid' ? 'Paid' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {record.status !== 'paid' && isFinance && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleMarkPaid(record.id)}
                            className="text-emerald-600"
                          >
                            <CheckCircle className="h-4 w-4 mr-1" /> Pay
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleGeneratePayslip(record.id)}
                        >
                          <FileText className="h-4 w-4 mr-1" /> Payslip
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
