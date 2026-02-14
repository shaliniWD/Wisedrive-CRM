import React, { useState, useEffect, useCallback } from 'react';
import { attendanceApi, payrollApi, leaveApi, hrApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Clock, Users, DollarSign, Calendar, CheckCircle, XCircle, 
  AlertCircle, Download, FileText, RefreshCw, Loader2, Eye,
  UserCheck, UserX, Search, Filter, ChevronLeft, ChevronRight,
  Briefcase, TrendingUp, Wallet, Receipt
} from 'lucide-react';

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' }, { value: 4, label: 'April' },
  { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' },
  { value: 9, label: 'September' }, { value: 10, label: 'October' },
  { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

// Status Badge Component
const StatusBadge = ({ status, type = 'attendance' }) => {
  const configs = {
    attendance: {
      PRESENT: { color: 'bg-emerald-100 text-emerald-800', label: 'Present' },
      PENDING: { color: 'bg-amber-100 text-amber-800', label: 'Pending' },
      ABSENT: { color: 'bg-red-100 text-red-800', label: 'Absent' },
      APPROVED: { color: 'bg-blue-100 text-blue-800', label: 'Approved' },
      REJECTED: { color: 'bg-red-100 text-red-800', label: 'Rejected' },
    },
    payment: {
      GENERATED: { color: 'bg-gray-100 text-gray-800', label: 'Generated' },
      PENDING: { color: 'bg-amber-100 text-amber-800', label: 'Pending' },
      PAID: { color: 'bg-emerald-100 text-emerald-800', label: 'Paid' },
    },
    leave: {
      PENDING: { color: 'bg-amber-100 text-amber-800', label: 'Pending' },
      APPROVED: { color: 'bg-emerald-100 text-emerald-800', label: 'Approved' },
      REJECTED: { color: 'bg-red-100 text-red-800', label: 'Rejected' },
      CANCELLED: { color: 'bg-gray-100 text-gray-800', label: 'Cancelled' },
    },
  };
  
  const cfg = configs[type]?.[status] || { color: 'bg-gray-100 text-gray-800', label: status };
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
};

// Summary Card Component
const SummaryCard = ({ title, value, subtitle, icon: Icon, color = 'blue', onClick }) => (
  <div 
    className={`rounded-xl border bg-white p-5 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    onClick={onClick}
  >
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-xl bg-gradient-to-r from-${color}-500 to-${color}-600`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
    </div>
  </div>
);

// ==================== ATTENDANCE DASHBOARD ====================
const AttendanceDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [activeSessions, setActiveSessions] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [overrideDialog, setOverrideDialog] = useState({ open: false, record: null });
  const [overrideReason, setOverrideReason] = useState('');
  const [processing, setProcessing] = useState(false);

  const roleCode = user?.roles?.[0]?.code || '';
  const isHR = ['CEO', 'HR_MANAGER'].includes(roleCode);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const promises = [
        attendanceApi.getAttendance({ month: selectedMonth, year: selectedYear }),
      ];
      
      if (isHR) {
        promises.push(attendanceApi.getActiveSessions());
        promises.push(attendanceApi.getPendingApprovals());
      }
      
      const results = await Promise.all(promises);
      setAttendanceRecords(results[0].data);
      
      if (isHR) {
        setActiveSessions(results[1].data);
        setPendingApprovals(results[2].data);
      }
    } catch (error) {
      console.error('Error loading attendance data:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear, isHR]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOverride = async (status) => {
    if (!overrideReason.trim()) {
      toast.error('Please provide a reason');
      return;
    }
    
    setProcessing(true);
    try {
      await attendanceApi.overrideAttendance(overrideDialog.record.id, {
        override_status: status,
        reason: overrideReason
      });
      toast.success(`Attendance ${status.toLowerCase()} successfully`);
      setOverrideDialog({ open: false, record: null });
      setOverrideReason('');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update attendance');
    } finally {
      setProcessing(false);
    }
  };

  const handleForceLogout = async (sessionId) => {
    if (!confirm('Are you sure you want to force logout this session?')) return;
    
    try {
      await attendanceApi.forceLogout(sessionId);
      toast.success('Session terminated');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to terminate session');
    }
  };

  const handleRunDailyCalculation = async () => {
    setProcessing(true);
    try {
      const result = await attendanceApi.calculateDaily();
      toast.success(`Processed ${result.data.processed} records, created ${result.data.absent_created} absent records`);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Calculation failed');
    } finally {
      setProcessing(false);
    }
  };

  // Calculate stats
  const stats = {
    totalPresent: attendanceRecords.filter(r => r.system_status === 'PRESENT').length,
    totalPending: attendanceRecords.filter(r => r.system_status === 'PENDING' && !r.hr_override_status).length,
    totalAbsent: attendanceRecords.filter(r => r.system_status === 'ABSENT').length,
    activeNow: activeSessions.length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Attendance Dashboard</h2>
          <p className="text-sm text-gray-500">Track employee attendance and sessions</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => (
                <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {isHR && (
            <Button onClick={handleRunDailyCalculation} disabled={processing}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
              Run Daily Calculation
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard 
          title="Present" 
          value={stats.totalPresent} 
          icon={UserCheck} 
          color="emerald"
        />
        <SummaryCard 
          title="Pending Approval" 
          value={stats.totalPending} 
          icon={AlertCircle} 
          color="amber"
        />
        <SummaryCard 
          title="Absent" 
          value={stats.totalAbsent} 
          icon={UserX} 
          color="red"
        />
        {isHR && (
          <SummaryCard 
            title="Active Now" 
            value={stats.activeNow} 
            icon={Users} 
            color="blue"
          />
        )}
      </div>

      {/* Pending Approvals Section */}
      {isHR && pendingApprovals.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Pending Attendance Approvals ({pendingApprovals.length})
          </h3>
          <div className="space-y-2">
            {pendingApprovals.slice(0, 5).map(record => (
              <div key={record.id} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                <div>
                  <p className="font-medium">{record.employee_name}</p>
                  <p className="text-sm text-gray-500">
                    {record.date} • {Math.floor(record.total_active_minutes / 60)}h {record.total_active_minutes % 60}m logged
                  </p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => {
                    setOverrideDialog({ open: true, record });
                    setOverrideReason('');
                  }}
                >
                  Review
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Sessions */}
      {isHR && activeSessions.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            Active Sessions ({activeSessions.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left p-3">Employee</th>
                  <th className="text-left p-3">Login Time</th>
                  <th className="text-left p-3">Last Activity</th>
                  <th className="text-left p-3">IP Address</th>
                  <th className="text-right p-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activeSessions.map(session => (
                  <tr key={session.id}>
                    <td className="p-3">
                      <p className="font-medium">{session.employee_name}</p>
                      <p className="text-xs text-gray-500">{session.employee_email}</p>
                    </td>
                    <td className="p-3">{new Date(session.login_at).toLocaleTimeString()}</td>
                    <td className="p-3">{new Date(session.last_activity_at).toLocaleTimeString()}</td>
                    <td className="p-3 text-gray-500">{session.ip_address || '-'}</td>
                    <td className="p-3 text-right">
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => handleForceLogout(session.id)}
                      >
                        Force Logout
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attendance Records Table */}
      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Attendance Records</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="attendance-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Employee</th>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">First Login</th>
                <th className="text-left p-3">Last Logout</th>
                <th className="text-center p-3">Hours</th>
                <th className="text-center p-3">Status</th>
                <th className="text-center p-3">HR Override</th>
                {isHR && <th className="text-right p-3">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y">
              {attendanceRecords.length === 0 ? (
                <tr>
                  <td colSpan={isHR ? 8 : 7} className="p-8 text-center text-gray-500">
                    No attendance records found
                  </td>
                </tr>
              ) : (
                attendanceRecords.map(record => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="p-3 font-medium">{record.employee_name}</td>
                    <td className="p-3">{record.date}</td>
                    <td className="p-3">{record.first_login ? new Date(record.first_login).toLocaleTimeString() : '-'}</td>
                    <td className="p-3">{record.last_logout ? new Date(record.last_logout).toLocaleTimeString() : '-'}</td>
                    <td className="p-3 text-center">
                      {Math.floor(record.total_active_minutes / 60)}h {record.total_active_minutes % 60}m
                    </td>
                    <td className="p-3 text-center">
                      <StatusBadge status={record.system_status} type="attendance" />
                    </td>
                    <td className="p-3 text-center">
                      {record.hr_override_status ? (
                        <StatusBadge status={record.hr_override_status} type="attendance" />
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    {isHR && (
                      <td className="p-3 text-right">
                        {record.system_status === 'PENDING' && !record.hr_override_status && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => {
                              setOverrideDialog({ open: true, record });
                              setOverrideReason('');
                            }}
                          >
                            Review
                          </Button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Override Dialog */}
      <Dialog open={overrideDialog.open} onOpenChange={(open) => !open && setOverrideDialog({ open: false, record: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Override Attendance</DialogTitle>
          </DialogHeader>
          {overrideDialog.record && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p><strong>Employee:</strong> {overrideDialog.record.employee_name}</p>
                <p><strong>Date:</strong> {overrideDialog.record.date}</p>
                <p><strong>Hours Logged:</strong> {Math.floor(overrideDialog.record.total_active_minutes / 60)}h {overrideDialog.record.total_active_minutes % 60}m</p>
                <p><strong>Current Status:</strong> <StatusBadge status={overrideDialog.record.system_status} type="attendance" /></p>
              </div>
              
              <div className="space-y-2">
                <Label>Reason for Override *</Label>
                <Textarea 
                  placeholder="Enter reason for approval or rejection..."
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOverrideDialog({ open: false, record: null })}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleOverride('REJECTED')}
              disabled={processing}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Reject
            </Button>
            <Button 
              onClick={() => handleOverride('APPROVED')}
              disabled={processing}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ==================== PAYROLL DASHBOARD ====================
const PayrollDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [generateDialog, setGenerateDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState({ open: false, payroll: null });
  const [detailsDialog, setDetailsDialog] = useState({ open: false, payroll: null });
  const [processing, setProcessing] = useState(false);
  
  // Payment form state
  const [paymentForm, setPaymentForm] = useState({
    transaction_reference: '',
    payment_date: new Date().toISOString().split('T')[0],
    payment_mode: '',
  });

  const roleCode = user?.roles?.[0]?.code || '';
  const canGenerate = ['CEO', 'HR_MANAGER'].includes(roleCode);
  const canMarkPaid = ['CEO', 'FINANCE_MANAGER'].includes(roleCode);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [recordsRes, summaryRes] = await Promise.all([
        payrollApi.getAll({ month: selectedMonth, year: selectedYear }),
        payrollApi.getSummary(selectedMonth, selectedYear),
      ]);
      setPayrollRecords(recordsRes.data);
      setSummary(summaryRes.data);
    } catch (error) {
      console.error('Error loading payroll data:', error);
      toast.error('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  const loadEmployees = async () => {
    try {
      const res = await hrApi.getEmployees();
      setEmployees(res.data.filter(e => e.status === 'active'));
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  useEffect(() => {
    loadData();
    loadEmployees();
  }, [loadData]);

  const handleGenerateBulk = async () => {
    setProcessing(true);
    try {
      const result = await payrollApi.generateBulk({
        month: selectedMonth,
        year: selectedYear,
      });
      
      const { success, failed, skipped } = result.data;
      toast.success(`Generated ${success.length} payrolls. Skipped: ${skipped.length}, Failed: ${failed.length}`);
      setGenerateDialog(false);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Payroll generation failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!paymentForm.transaction_reference || !paymentForm.payment_mode) {
      toast.error('Please fill all required fields');
      return;
    }
    
    setProcessing(true);
    try {
      await payrollApi.markPaid(paymentDialog.payroll.id, paymentForm);
      toast.success('Payment marked successfully');
      setPaymentDialog({ open: false, payroll: null });
      setPaymentForm({
        transaction_reference: '',
        payment_date: new Date().toISOString().split('T')[0],
        payment_mode: '',
      });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to mark payment');
    } finally {
      setProcessing(false);
    }
  };

  const handleGeneratePayslip = async (payrollId) => {
    try {
      await payrollApi.generatePayslip(payrollId);
      toast.success('Payslip generated');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate payslip');
    }
  };

  const handleDownloadPayslip = async (payrollId) => {
    try {
      const result = await payrollApi.downloadPayslip(payrollId);
      window.open(result.data.download_url, '_blank');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to download payslip');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Payroll Management</h2>
          <p className="text-sm text-gray-500">Generate and manage employee payroll</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => (
                <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          {canGenerate && (
            <Button onClick={() => setGenerateDialog(true)}>
              <DollarSign className="h-4 w-4 mr-2" />
              Generate Payroll
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SummaryCard 
            title="Total Employees" 
            value={summary.total_employees} 
            icon={Users} 
            color="blue"
          />
          <SummaryCard 
            title="Total Net Salary" 
            value={`${summary.currency_symbol || '₹'}${summary.total_net_salary?.toLocaleString()}`} 
            icon={Wallet} 
            color="purple"
          />
          <SummaryCard 
            title="Paid" 
            value={summary.paid_count}
            subtitle={`${summary.currency_symbol || '₹'}${summary.total_paid_amount?.toLocaleString()}`}
            icon={CheckCircle} 
            color="emerald"
          />
          <SummaryCard 
            title="Pending Payment" 
            value={summary.pending_count}
            subtitle={`${summary.currency_symbol || '₹'}${summary.total_pending_amount?.toLocaleString()}`}
            icon={AlertCircle} 
            color="amber"
          />
        </div>
      )}

      {/* Payroll Records Table */}
      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">Payroll Records - {MONTHS[selectedMonth - 1]?.label} {selectedYear}</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="payroll-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Employee</th>
                <th className="text-right p-3">Gross</th>
                <th className="text-right p-3">Deductions</th>
                <th className="text-right p-3">Net Salary</th>
                <th className="text-center p-3">Status</th>
                <th className="text-left p-3">Transaction Ref</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payrollRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    No payroll records for this month. {canGenerate && 'Click "Generate Payroll" to create.'}
                  </td>
                </tr>
              ) : (
                payrollRecords.map(record => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <p className="font-medium">{record.employee_name}</p>
                      <p className="text-xs text-gray-500">{record.department_name || '-'}</p>
                    </td>
                    <td className="p-3 text-right">{record.currency_symbol}{record.gross_salary?.toLocaleString()}</td>
                    <td className="p-3 text-right text-red-600">
                      -{record.currency_symbol}{(record.total_statutory_deductions + record.attendance_deduction)?.toLocaleString()}
                    </td>
                    <td className="p-3 text-right font-semibold">{record.currency_symbol}{record.net_salary?.toLocaleString()}</td>
                    <td className="p-3 text-center">
                      <StatusBadge status={record.payment_status} type="payment" />
                    </td>
                    <td className="p-3 text-gray-500">{record.transaction_reference || '-'}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => setDetailsDialog({ open: true, payroll: record })}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {record.payment_status !== 'PAID' && canMarkPaid && (
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => setPaymentDialog({ open: true, payroll: record })}
                          >
                            Mark Paid
                          </Button>
                        )}
                        {record.payslip_path ? (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleDownloadPayslip(record.id)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button 
                            size="sm" 
                            variant="ghost"
                            onClick={() => handleGeneratePayslip(record.id)}
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Payroll Dialog */}
      <Dialog open={generateDialog} onOpenChange={setGenerateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Generate Payroll</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">
              This will generate payroll for all active employees for <strong>{MONTHS[selectedMonth - 1]?.label} {selectedYear}</strong>.
            </p>
            <p className="text-sm text-gray-600">
              Payroll already generated for this month will be skipped.
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>Note:</strong> Make sure all attendance records for this month are finalized before generating payroll.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialog(false)}>Cancel</Button>
            <Button onClick={handleGenerateBulk} disabled={processing}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <DollarSign className="h-4 w-4 mr-2" />}
              Generate for All Employees
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Mark Dialog */}
      <Dialog open={paymentDialog.open} onOpenChange={(open) => !open && setPaymentDialog({ open: false, payroll: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Salary Payment</DialogTitle>
          </DialogHeader>
          {paymentDialog.payroll && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p><strong>Employee:</strong> {paymentDialog.payroll.employee_name}</p>
                <p><strong>Amount:</strong> {paymentDialog.payroll.currency_symbol}{paymentDialog.payroll.net_salary?.toLocaleString()}</p>
                <p><strong>Bank:</strong> {paymentDialog.payroll.bank_name || '-'}</p>
                <p><strong>Account:</strong> {paymentDialog.payroll.bank_account_number ? `XXXX${paymentDialog.payroll.bank_account_number.slice(-4)}` : '-'}</p>
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label>Transaction Reference *</Label>
                  <Input 
                    placeholder="Enter transaction/UTR number"
                    value={paymentForm.transaction_reference}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, transaction_reference: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Payment Date *</Label>
                  <Input 
                    type="date"
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_date: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Payment Mode *</Label>
                  <Select 
                    value={paymentForm.payment_mode} 
                    onValueChange={(v) => setPaymentForm(prev => ({ ...prev, payment_mode: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select payment mode" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                      <SelectItem value="NEFT">NEFT</SelectItem>
                      <SelectItem value="RTGS">RTGS</SelectItem>
                      <SelectItem value="IMPS">IMPS</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="CHEQUE">Cheque</SelectItem>
                      <SelectItem value="CASH">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog({ open: false, payroll: null })}>Cancel</Button>
            <Button onClick={handleMarkPaid} disabled={processing}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payroll Details Dialog */}
      <Dialog open={detailsDialog.open} onOpenChange={(open) => !open && setDetailsDialog({ open: false, payroll: null })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payroll Details</DialogTitle>
          </DialogHeader>
          {detailsDialog.payroll && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              {/* Employee Info */}
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Employee Information</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <p><strong>Name:</strong> {detailsDialog.payroll.employee_name}</p>
                  <p><strong>Code:</strong> {detailsDialog.payroll.employee_code || '-'}</p>
                  <p><strong>Department:</strong> {detailsDialog.payroll.department_name || '-'}</p>
                  <p><strong>Period:</strong> {MONTHS[detailsDialog.payroll.month - 1]?.label} {detailsDialog.payroll.year}</p>
                </div>
              </div>
              
              {/* Earnings */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-emerald-700">Earnings</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between"><span>Basic Salary</span><span>{detailsDialog.payroll.currency_symbol}{detailsDialog.payroll.basic_salary?.toLocaleString()}</span></div>
                  {detailsDialog.payroll.hra > 0 && <div className="flex justify-between"><span>HRA</span><span>{detailsDialog.payroll.currency_symbol}{detailsDialog.payroll.hra?.toLocaleString()}</span></div>}
                  {detailsDialog.payroll.conveyance_allowance > 0 && <div className="flex justify-between"><span>Conveyance</span><span>{detailsDialog.payroll.currency_symbol}{detailsDialog.payroll.conveyance_allowance?.toLocaleString()}</span></div>}
                  {detailsDialog.payroll.medical_allowance > 0 && <div className="flex justify-between"><span>Medical</span><span>{detailsDialog.payroll.currency_symbol}{detailsDialog.payroll.medical_allowance?.toLocaleString()}</span></div>}
                  {detailsDialog.payroll.special_allowance > 0 && <div className="flex justify-between"><span>Special Allowance</span><span>{detailsDialog.payroll.currency_symbol}{detailsDialog.payroll.special_allowance?.toLocaleString()}</span></div>}
                  {detailsDialog.payroll.variable_pay > 0 && <div className="flex justify-between"><span>Variable Pay</span><span>{detailsDialog.payroll.currency_symbol}{detailsDialog.payroll.variable_pay?.toLocaleString()}</span></div>}
                  <div className="flex justify-between font-semibold border-t pt-1"><span>Gross Salary</span><span>{detailsDialog.payroll.currency_symbol}{detailsDialog.payroll.gross_salary?.toLocaleString()}</span></div>
                </div>
              </div>
              
              {/* Deductions */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2 text-red-700">Deductions</h4>
                <div className="space-y-1 text-sm">
                  {detailsDialog.payroll.pf_employee > 0 && <div className="flex justify-between"><span>Provident Fund</span><span>-{detailsDialog.payroll.currency_symbol}{detailsDialog.payroll.pf_employee?.toLocaleString()}</span></div>}
                  {detailsDialog.payroll.professional_tax > 0 && <div className="flex justify-between"><span>Professional Tax</span><span>-{detailsDialog.payroll.currency_symbol}{detailsDialog.payroll.professional_tax?.toLocaleString()}</span></div>}
                  {detailsDialog.payroll.income_tax > 0 && <div className="flex justify-between"><span>Income Tax (TDS)</span><span>-{detailsDialog.payroll.currency_symbol}{detailsDialog.payroll.income_tax?.toLocaleString()}</span></div>}
                  {detailsDialog.payroll.other_deductions > 0 && <div className="flex justify-between"><span>Other Deductions</span><span>-{detailsDialog.payroll.currency_symbol}{detailsDialog.payroll.other_deductions?.toLocaleString()}</span></div>}
                  {detailsDialog.payroll.attendance_deduction > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Attendance Deduction ({detailsDialog.payroll.unapproved_absent_days} days)</span>
                      <span>-{detailsDialog.payroll.currency_symbol}{detailsDialog.payroll.attendance_deduction?.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-semibold border-t pt-1">
                    <span>Total Deductions</span>
                    <span>-{detailsDialog.payroll.currency_symbol}{(detailsDialog.payroll.total_statutory_deductions + detailsDialog.payroll.attendance_deduction)?.toLocaleString()}</span>
                  </div>
                </div>
              </div>
              
              {/* Attendance Summary */}
              <div className="border rounded-lg p-4">
                <h4 className="font-semibold mb-2">Attendance Summary</h4>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <p><strong>Working Days:</strong> {detailsDialog.payroll.working_days_in_month}</p>
                  <p><strong>Present:</strong> {detailsDialog.payroll.present_days}</p>
                  <p><strong>Absent:</strong> {detailsDialog.payroll.absent_days}</p>
                  <p><strong>Hours Worked:</strong> {detailsDialog.payroll.total_hours_worked}h</p>
                  <p><strong>Per Day Rate:</strong> {detailsDialog.payroll.currency_symbol}{detailsDialog.payroll.per_day_salary?.toLocaleString()}</p>
                </div>
              </div>
              
              {/* Net Pay */}
              <div className="bg-emerald-50 rounded-lg p-4">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Net Salary</span>
                  <span className="text-2xl font-bold text-emerald-700">
                    {detailsDialog.payroll.currency_symbol}{detailsDialog.payroll.net_salary?.toLocaleString()}
                  </span>
                </div>
              </div>
              
              {/* Payment Info */}
              {detailsDialog.payroll.payment_status === 'PAID' && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">Payment Information</h4>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <p><strong>Status:</strong> <StatusBadge status="PAID" type="payment" /></p>
                    <p><strong>Date:</strong> {detailsDialog.payroll.payment_date}</p>
                    <p><strong>Mode:</strong> {detailsDialog.payroll.payment_mode}</p>
                    <p><strong>Reference:</strong> {detailsDialog.payroll.transaction_reference}</p>
                    <p><strong>Paid By:</strong> {detailsDialog.payroll.payment_by_name}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ==================== LEAVE MANAGEMENT ====================
const LeaveManagement = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [myBalance, setMyBalance] = useState(null);
  const [myRequests, setMyRequests] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [teamSummary, setTeamSummary] = useState(null);
  const [applyDialog, setApplyDialog] = useState(false);
  const [approvalDialog, setApprovalDialog] = useState({ open: false, request: null });
  const [processing, setProcessing] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  
  // Leave application form
  const [leaveForm, setLeaveForm] = useState({
    leave_type: '',
    start_date: '',
    end_date: '',
    duration_type: 'FULL_DAY',
    reason: '',
  });

  const roleCode = user?.roles?.[0]?.code || '';
  const canApprove = ['CEO', 'HR_MANAGER', 'COUNTRY_HEAD', 'SALES_HEAD', 'INSPECTION_HEAD'].includes(roleCode);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const promises = [
        leaveApi.getMyBalance(),
        leaveApi.getMyRequests(),
      ];
      
      if (canApprove) {
        promises.push(leaveApi.getPendingApprovals());
        promises.push(leaveApi.getTeamSummary());
      }
      
      const results = await Promise.all(promises);
      setMyBalance(results[0].data);
      setMyRequests(results[1].data);
      
      if (canApprove) {
        setPendingApprovals(results[2].data);
        setTeamSummary(results[3].data);
      }
    } catch (error) {
      console.error('Error loading leave data:', error);
      toast.error('Failed to load leave data');
    } finally {
      setLoading(false);
    }
  }, [canApprove]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApplyLeave = async () => {
    if (!leaveForm.leave_type || !leaveForm.start_date || !leaveForm.end_date || !leaveForm.reason) {
      toast.error('Please fill all required fields');
      return;
    }
    
    setProcessing(true);
    try {
      await leaveApi.apply(leaveForm);
      toast.success('Leave request submitted');
      setApplyDialog(false);
      setLeaveForm({
        leave_type: '',
        start_date: '',
        end_date: '',
        duration_type: 'FULL_DAY',
        reason: '',
      });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit leave request');
    } finally {
      setProcessing(false);
    }
  };

  const handleApproval = async (action) => {
    if (action === 'REJECTED' && !rejectionReason.trim()) {
      toast.error('Please provide rejection reason');
      return;
    }
    
    setProcessing(true);
    try {
      await leaveApi.approve(approvalDialog.request.id, {
        action,
        rejection_reason: rejectionReason || null,
      });
      toast.success(`Leave request ${action.toLowerCase()}`);
      setApprovalDialog({ open: false, request: null });
      setRejectionReason('');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to process request');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelRequest = async (requestId) => {
    if (!confirm('Are you sure you want to cancel this leave request?')) return;
    
    try {
      await leaveApi.cancel(requestId, 'Cancelled by employee');
      toast.success('Leave request cancelled');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel request');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Leave Management</h2>
          <p className="text-sm text-gray-500">Apply for leave and manage approvals</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setApplyDialog(true)}>
            <Calendar className="h-4 w-4 mr-2" />
            Apply for Leave
          </Button>
        </div>
      </div>

      {/* Balance Cards */}
      {myBalance && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SummaryCard 
            title="Casual Leave" 
            value={myBalance.casual_leave_balance}
            subtitle={`Used: ${myBalance.casual_leave_used}`}
            icon={Calendar} 
            color="blue"
          />
          <SummaryCard 
            title="Sick Leave" 
            value={myBalance.sick_leave_balance}
            subtitle={`Used: ${myBalance.sick_leave_used}`}
            icon={Briefcase} 
            color="amber"
          />
          <SummaryCard 
            title="Total Available" 
            value={myBalance.total_leave_balance}
            icon={CheckCircle} 
            color="emerald"
          />
          <SummaryCard 
            title="Pending Requests" 
            value={myBalance.pending_requests}
            icon={AlertCircle} 
            color="purple"
          />
        </div>
      )}

      {/* Team Summary (for managers) */}
      {canApprove && teamSummary && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <h4 className="text-sm font-medium text-gray-500 mb-2">On Leave Today</h4>
            {teamSummary.on_leave_today.length > 0 ? (
              <ul className="space-y-1">
                {teamSummary.on_leave_today.map((emp, idx) => (
                  <li key={idx} className="text-sm">{emp.employee_name} ({emp.leave_type})</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No one on leave today</p>
            )}
          </div>
          <div className="bg-white rounded-xl border p-4">
            <h4 className="text-sm font-medium text-gray-500 mb-2">Upcoming Leaves</h4>
            {teamSummary.upcoming_leaves.length > 0 ? (
              <ul className="space-y-1">
                {teamSummary.upcoming_leaves.slice(0, 3).map((leave, idx) => (
                  <li key={idx} className="text-sm">{leave.employee_name} - {leave.start_date}</li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-400">No upcoming leaves</p>
            )}
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <h4 className="text-sm font-medium text-amber-800 mb-2">Pending Approvals</h4>
            <p className="text-2xl font-bold text-amber-800">{pendingApprovals.length}</p>
          </div>
        </div>
      )}

      {/* Pending Approvals Section */}
      {canApprove && pendingApprovals.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Pending Leave Approvals ({pendingApprovals.length})
          </h3>
          <div className="space-y-2">
            {pendingApprovals.map(request => (
              <div key={request.id} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                <div>
                  <p className="font-medium">{request.employee_name}</p>
                  <p className="text-sm text-gray-500">
                    {request.leave_type} • {request.start_date} to {request.end_date} ({request.total_days} days)
                  </p>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => {
                    setApprovalDialog({ open: true, request });
                    setRejectionReason('');
                  }}
                >
                  Review
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Leave Requests */}
      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold">My Leave Requests</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="leave-requests-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Start Date</th>
                <th className="text-left p-3">End Date</th>
                <th className="text-center p-3">Days</th>
                <th className="text-left p-3">Reason</th>
                <th className="text-center p-3">Status</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {myRequests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    No leave requests found
                  </td>
                </tr>
              ) : (
                myRequests.map(request => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        request.leave_type === 'CASUAL' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {request.leave_type}
                      </span>
                    </td>
                    <td className="p-3">{request.start_date}</td>
                    <td className="p-3">{request.end_date}</td>
                    <td className="p-3 text-center">{request.total_days}</td>
                    <td className="p-3 max-w-xs truncate">{request.reason}</td>
                    <td className="p-3 text-center">
                      <StatusBadge status={request.status} type="leave" />
                    </td>
                    <td className="p-3 text-right">
                      {request.status === 'PENDING' && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => handleCancelRequest(request.id)}
                        >
                          Cancel
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Leave Dialog */}
      <Dialog open={applyDialog} onOpenChange={setApplyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply for Leave</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Leave Type *</Label>
              <Select 
                value={leaveForm.leave_type} 
                onValueChange={(v) => setLeaveForm(prev => ({ ...prev, leave_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select leave type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASUAL">Casual Leave ({myBalance?.casual_leave_balance} available)</SelectItem>
                  <SelectItem value="SICK">Sick Leave ({myBalance?.sick_leave_balance} available)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date *</Label>
                <Input 
                  type="date"
                  value={leaveForm.start_date}
                  onChange={(e) => setLeaveForm(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>End Date *</Label>
                <Input 
                  type="date"
                  value={leaveForm.end_date}
                  onChange={(e) => setLeaveForm(prev => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Duration Type</Label>
              <Select 
                value={leaveForm.duration_type} 
                onValueChange={(v) => setLeaveForm(prev => ({ ...prev, duration_type: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL_DAY">Full Day</SelectItem>
                  <SelectItem value="HALF_DAY_FIRST">Half Day (First Half)</SelectItem>
                  <SelectItem value="HALF_DAY_SECOND">Half Day (Second Half)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Reason *</Label>
              <Textarea 
                placeholder="Enter reason for leave..."
                value={leaveForm.reason}
                onChange={(e) => setLeaveForm(prev => ({ ...prev, reason: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyDialog(false)}>Cancel</Button>
            <Button onClick={handleApplyLeave} disabled={processing}>
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Submit Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={approvalDialog.open} onOpenChange={(open) => !open && setApprovalDialog({ open: false, request: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Review Leave Request</DialogTitle>
          </DialogHeader>
          {approvalDialog.request && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p><strong>Employee:</strong> {approvalDialog.request.employee_name}</p>
                <p><strong>Type:</strong> {approvalDialog.request.leave_type}</p>
                <p><strong>Duration:</strong> {approvalDialog.request.start_date} to {approvalDialog.request.end_date} ({approvalDialog.request.total_days} days)</p>
                <p><strong>Reason:</strong> {approvalDialog.request.reason}</p>
              </div>
              
              <div className="space-y-2">
                <Label>Rejection Reason (required if rejecting)</Label>
                <Textarea 
                  placeholder="Enter reason for rejection..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApprovalDialog({ open: false, request: null })}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => handleApproval('REJECTED')}
              disabled={processing}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
              Reject
            </Button>
            <Button 
              onClick={() => handleApproval('APPROVED')}
              disabled={processing}
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ==================== MAIN HR MODULE PAGE ====================
export default function HRModulePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('attendance');

  const roleCode = user?.roles?.[0]?.code || '';
  const isHROrFinance = ['CEO', 'HR_MANAGER', 'FINANCE_MANAGER', 'COUNTRY_HEAD'].includes(roleCode);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">HR Module</h1>
          <p className="text-gray-500">Manage attendance, payroll, and leave</p>
        </div>

        {/* Tabs Navigation */}
        <div className="mb-6">
          <div className="flex gap-2 p-1 bg-gray-100 rounded-lg w-fit">
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'attendance' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              data-testid="attendance-tab"
            >
              <Clock className="h-4 w-4 inline mr-2" />
              Attendance
            </button>
            {isHROrFinance && (
              <button
                onClick={() => setActiveTab('payroll')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'payroll' 
                    ? 'bg-white text-blue-600 shadow-sm' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
                data-testid="payroll-tab"
              >
                <DollarSign className="h-4 w-4 inline mr-2" />
                Payroll
              </button>
            )}
            <button
              onClick={() => setActiveTab('leave')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'leave' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
              }`}
              data-testid="leave-tab"
            >
              <Calendar className="h-4 w-4 inline mr-2" />
              Leave
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'attendance' && <AttendanceDashboard />}
        {activeTab === 'payroll' && isHROrFinance && <PayrollDashboard />}
        {activeTab === 'leave' && <LeaveManagement />}
      </div>
    </div>
  );
}
