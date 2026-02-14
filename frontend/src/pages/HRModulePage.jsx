import React, { useState, useEffect, useCallback } from 'react';
import { attendanceApi, payrollApi, leaveApi, hrApi, rolesApi, departmentsApi, teamsApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
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
  UserCheck, UserX, Search, Plus, Pencil, Globe, ChevronDown, ChevronUp,
  Building, Phone, Mail, MapPin, Briefcase, History, X, PauseCircle, PlayCircle,
  Shield, UserPlus, Settings, Lock, Wallet, Receipt
} from 'lucide-react';

const MONTHS = [
  { value: 1, label: 'January' }, { value: 2, label: 'February' },
  { value: 3, label: 'March' }, { value: 4, label: 'April' },
  { value: 5, label: 'May' }, { value: 6, label: 'June' },
  { value: 7, label: 'July' }, { value: 8, label: 'August' },
  { value: 9, label: 'September' }, { value: 10, label: 'October' },
  { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Page permissions for role configuration
const PAGE_PERMISSIONS = [
  { id: 'dashboard', name: 'Dashboard', description: 'View dashboard and statistics' },
  { id: 'leads', name: 'Leads', description: 'Manage sales leads' },
  { id: 'customers', name: 'Customers', description: 'Manage customer records' },
  { id: 'inspections', name: 'Inspections', description: 'Manage vehicle inspections' },
  { id: 'hr', name: 'HR Module', description: 'Attendance, payroll, leave, employees' },
  { id: 'finance', name: 'Finance', description: 'Manage payments and billing' },
  { id: 'settings', name: 'Settings', description: 'System configuration' },
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
    employee: {
      active: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', label: 'Active' },
      exited: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Exited' },
      inactive: { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Inactive' },
    },
  };
  
  const cfg = configs[type]?.[status] || { color: 'bg-gray-100 text-gray-800', label: status };
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.label}
    </span>
  );
};

// Role Badges Component
const RoleBadges = ({ roles }) => {
  if (!roles || roles.length === 0) return <span className="text-gray-400 text-xs">No role</span>;
  
  const colors = {
    CEO: 'bg-purple-100 text-purple-800 border-purple-200',
    HR_MANAGER: 'bg-blue-100 text-blue-800 border-blue-200',
    MECHANIC: 'bg-orange-100 text-orange-800 border-orange-200',
    FINANCE_MANAGER: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    COUNTRY_HEAD: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    SALES_HEAD: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    SALES_EXECUTIVE: 'bg-sky-100 text-sky-800 border-sky-200',
    INSPECTION_HEAD: 'bg-amber-100 text-amber-800 border-amber-200',
  };
  
  return (
    <div className="flex flex-wrap gap-1">
      {roles.map((role, idx) => (
        <span key={idx} className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${colors[role.code] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
          {role.name || role.code}
        </span>
      ))}
    </div>
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

// ==================== EMPLOYEES TAB ====================
const EmployeesTab = ({ isHR }) => {
  const [employees, setEmployees] = useState([]);
  const [countries, setCountries] = useState([]);
  const [roles, setRoles] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCountry, setFilterCountry] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('active');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [isEmployeeModalOpen, setIsEmployeeModalOpen] = useState(false);
  const [isExitModalOpen, setIsExitModalOpen] = useState(false);
  const [exitData, setExitData] = useState({ exit_date: '', exit_reason: '', exit_notes: '' });
  const [employeeModalTab, setEmployeeModalTab] = useState('details');

  const fetchBaseData = useCallback(async () => {
    try {
      const [rolesRes, deptsRes, teamsRes, countriesRes] = await Promise.all([
        rolesApi.getAll(),
        departmentsApi.getAll(),
        teamsApi.getAll(),
        hrApi.getCountries(),
      ]);
      setRoles(rolesRes.data);
      setDepartments(deptsRes.data);
      setTeams(teamsRes.data);
      setCountries(countriesRes.data);
    } catch (error) {
      console.error('Failed to load base data:', error);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (searchQuery) params.search = searchQuery;
      if (filterCountry) params.country_id = filterCountry;
      if (filterRole) params.role_id = filterRole;
      if (filterStatus === 'active') params.is_active = true;
      else if (filterStatus === 'exited') params.is_active = false;
      
      const response = await hrApi.getEmployees(params);
      setEmployees(response.data);
    } catch (error) {
      toast.error('Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterCountry, filterRole, filterStatus]);

  useEffect(() => {
    fetchBaseData();
  }, [fetchBaseData]);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleViewEmployee = async (employee) => {
    try {
      const response = await hrApi.getEmployee(employee.id);
      setSelectedEmployee(response.data);
      setEmployeeModalTab('details');
      setIsEmployeeModalOpen(true);
    } catch (error) {
      toast.error('Failed to load employee details');
    }
  };

  const handleExitEmployee = async () => {
    if (!exitData.exit_date || !exitData.exit_reason) {
      toast.error('Please fill required fields');
      return;
    }
    try {
      await hrApi.exitEmployee(selectedEmployee.id, exitData);
      toast.success('Employee marked as exited');
      setIsExitModalOpen(false);
      setIsEmployeeModalOpen(false);
      fetchEmployees();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update employee');
    }
  };

  const handleRejoinEmployee = async (employeeId) => {
    try {
      await hrApi.rejoinEmployee(employeeId);
      toast.success('Employee rejoined successfully');
      fetchEmployees();
      setIsEmployeeModalOpen(false);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to rejoin employee');
    }
  };

  const stats = {
    total: employees.length,
    active: employees.filter(e => e.status === 'active').length,
    exited: employees.filter(e => e.status === 'exited').length,
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard title="Total Employees" value={stats.total} icon={Users} color="blue" />
        <SummaryCard title="Active" value={stats.active} icon={UserCheck} color="emerald" />
        <SummaryCard title="Exited" value={stats.exited} icon={UserX} color="red" />
        <SummaryCard title="Countries" value={countries.length} icon={Globe} color="purple" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-white rounded-xl border p-4">
        <div className="flex-1 min-w-[200px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        <Select value={filterCountry} onValueChange={setFilterCountry}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Countries" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Countries</SelectItem>
            {countries.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterRole} onValueChange={setFilterRole}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Roles</SelectItem>
            {roles.map(r => (
              <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="exited">Exited</SelectItem>
          </SelectContent>
        </Select>
        {isHR && (
          <Button onClick={() => { setSelectedEmployee(null); setIsEmployeeModalOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />
            Add Employee
          </Button>
        )}
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm" data-testid="employees-table">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-3">Employee</th>
              <th className="text-left p-3">Role(s)</th>
              <th className="text-left p-3">Country</th>
              <th className="text-left p-3">Department</th>
              <th className="text-center p-3">Status</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></td></tr>
            ) : employees.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-gray-500">No employees found</td></tr>
            ) : (
              employees.map(emp => (
                <tr key={emp.id} className="hover:bg-gray-50">
                  <td className="p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-sm">
                        {emp.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{emp.name}</p>
                        <p className="text-xs text-gray-500">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-3"><RoleBadges roles={emp.roles} /></td>
                  <td className="p-3">{emp.country_name || '-'}</td>
                  <td className="p-3">{emp.department_name || '-'}</td>
                  <td className="p-3 text-center">
                    <StatusBadge status={emp.status} type="employee" />
                  </td>
                  <td className="p-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => handleViewEmployee(emp)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Employee Modal - Simplified for this merge */}
      <Dialog open={isEmployeeModalOpen} onOpenChange={setIsEmployeeModalOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedEmployee ? 'Employee Details' : 'Add Employee'}</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-2xl">
                  {selectedEmployee.name?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-semibold">{selectedEmployee.name}</h3>
                  <p className="text-gray-500">{selectedEmployee.email}</p>
                  <RoleBadges roles={selectedEmployee.roles} />
                </div>
                <div className="ml-auto">
                  <StatusBadge status={selectedEmployee.status} type="employee" />
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><strong>Phone:</strong> {selectedEmployee.phone || '-'}</div>
                <div><strong>Country:</strong> {selectedEmployee.country_name || '-'}</div>
                <div><strong>Department:</strong> {selectedEmployee.department_name || '-'}</div>
                <div><strong>Team:</strong> {selectedEmployee.team_name || '-'}</div>
                <div><strong>Joined:</strong> {selectedEmployee.date_of_joining || '-'}</div>
                <div><strong>Employee Code:</strong> {selectedEmployee.employee_code || '-'}</div>
              </div>

              {selectedEmployee.status === 'active' && isHR && (
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button variant="destructive" onClick={() => setIsExitModalOpen(true)}>
                    <UserX className="h-4 w-4 mr-2" />
                    Mark as Exited
                  </Button>
                </div>
              )}
              {selectedEmployee.status === 'exited' && isHR && (
                <div className="flex justify-end gap-2 pt-4 border-t">
                  <Button onClick={() => handleRejoinEmployee(selectedEmployee.id)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Rejoin Employee
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Exit Modal */}
      <Dialog open={isExitModalOpen} onOpenChange={setIsExitModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Employee as Exited</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Exit Date *</Label>
              <Input type="date" value={exitData.exit_date} onChange={(e) => setExitData(prev => ({ ...prev, exit_date: e.target.value }))} />
            </div>
            <div>
              <Label>Exit Reason *</Label>
              <Select value={exitData.exit_reason} onValueChange={(v) => setExitData(prev => ({ ...prev, exit_reason: v }))}>
                <SelectTrigger><SelectValue placeholder="Select reason" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="resignation">Resignation</SelectItem>
                  <SelectItem value="termination">Termination</SelectItem>
                  <SelectItem value="retirement">Retirement</SelectItem>
                  <SelectItem value="contract_end">Contract End</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={exitData.exit_notes} onChange={(e) => setExitData(prev => ({ ...prev, exit_notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsExitModalOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleExitEmployee}>Confirm Exit</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ==================== ATTENDANCE DASHBOARD ====================
const AttendanceDashboard = ({ isHR }) => {
  const [loading, setLoading] = useState(true);
  const [activeSessions, setActiveSessions] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [overrideDialog, setOverrideDialog] = useState({ open: false, record: null });
  const [overrideReason, setOverrideReason] = useState('');
  const [processing, setProcessing] = useState(false);

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
    if (!confirm('Force logout this session?')) return;
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
      toast.success(`Processed ${result.data.processed} records`);
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Calculation failed');
    } finally {
      setProcessing(false);
    }
  };

  const stats = {
    totalPresent: attendanceRecords.filter(r => r.system_status === 'PRESENT').length,
    totalPending: attendanceRecords.filter(r => r.system_status === 'PENDING' && !r.hr_override_status).length,
    totalAbsent: attendanceRecords.filter(r => r.system_status === 'ABSENT').length,
    activeNow: activeSessions.length,
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              {MONTHS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadData}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
        </div>
        {isHR && (
          <Button onClick={handleRunDailyCalculation} disabled={processing}>
            {processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
            Run Daily Calculation
          </Button>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <SummaryCard title="Present" value={stats.totalPresent} icon={UserCheck} color="emerald" />
        <SummaryCard title="Pending Approval" value={stats.totalPending} icon={AlertCircle} color="amber" />
        <SummaryCard title="Absent" value={stats.totalAbsent} icon={UserX} color="red" />
        {isHR && <SummaryCard title="Active Now" value={stats.activeNow} icon={Users} color="blue" />}
      </div>

      {/* Pending Approvals */}
      {isHR && pendingApprovals.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />Pending Attendance Approvals ({pendingApprovals.length})
          </h3>
          <div className="space-y-2">
            {pendingApprovals.slice(0, 5).map(record => (
              <div key={record.id} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                <div>
                  <p className="font-medium">{record.employee_name}</p>
                  <p className="text-sm text-gray-500">{record.date} • {Math.floor(record.total_active_minutes / 60)}h {record.total_active_minutes % 60}m</p>
                </div>
                <Button size="sm" onClick={() => { setOverrideDialog({ open: true, record }); setOverrideReason(''); }}>Review</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Active Sessions */}
      {isHR && activeSessions.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><Users className="h-5 w-5 text-blue-600" />Active Sessions ({activeSessions.length})</h3>
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
                    <td className="p-3"><p className="font-medium">{session.employee_name}</p><p className="text-xs text-gray-500">{session.employee_email}</p></td>
                    <td className="p-3">{new Date(session.login_at).toLocaleTimeString()}</td>
                    <td className="p-3">{new Date(session.last_activity_at).toLocaleTimeString()}</td>
                    <td className="p-3 text-gray-500">{session.ip_address || '-'}</td>
                    <td className="p-3 text-right"><Button size="sm" variant="destructive" onClick={() => handleForceLogout(session.id)}>Force Logout</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Attendance Records */}
      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b"><h3 className="text-lg font-semibold">Attendance Records</h3></div>
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
                <tr><td colSpan={isHR ? 8 : 7} className="p-8 text-center text-gray-500">No attendance records found</td></tr>
              ) : (
                attendanceRecords.map(record => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="p-3 font-medium">{record.employee_name}</td>
                    <td className="p-3">{record.date}</td>
                    <td className="p-3">{record.first_login ? new Date(record.first_login).toLocaleTimeString() : '-'}</td>
                    <td className="p-3">{record.last_logout ? new Date(record.last_logout).toLocaleTimeString() : '-'}</td>
                    <td className="p-3 text-center">{Math.floor(record.total_active_minutes / 60)}h {record.total_active_minutes % 60}m</td>
                    <td className="p-3 text-center"><StatusBadge status={record.system_status} type="attendance" /></td>
                    <td className="p-3 text-center">{record.hr_override_status ? <StatusBadge status={record.hr_override_status} type="attendance" /> : '-'}</td>
                    {isHR && (
                      <td className="p-3 text-right">
                        {record.system_status === 'PENDING' && !record.hr_override_status && (
                          <Button size="sm" variant="outline" onClick={() => { setOverrideDialog({ open: true, record }); setOverrideReason(''); }}>Review</Button>
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
          <DialogHeader><DialogTitle>Override Attendance</DialogTitle></DialogHeader>
          {overrideDialog.record && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p><strong>Employee:</strong> {overrideDialog.record.employee_name}</p>
                <p><strong>Date:</strong> {overrideDialog.record.date}</p>
                <p><strong>Hours:</strong> {Math.floor(overrideDialog.record.total_active_minutes / 60)}h {overrideDialog.record.total_active_minutes % 60}m</p>
              </div>
              <div><Label>Reason *</Label><Textarea placeholder="Enter reason..." value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} /></div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOverrideDialog({ open: false, record: null })}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleOverride('REJECTED')} disabled={processing}><XCircle className="h-4 w-4 mr-2" />Reject</Button>
            <Button onClick={() => handleOverride('APPROVED')} disabled={processing}><CheckCircle className="h-4 w-4 mr-2" />Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ==================== PAYROLL DASHBOARD ====================
const PayrollDashboard = ({ isHR, isFinance }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [generateDialog, setGenerateDialog] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState({ open: false, payroll: null });
  const [detailsDialog, setDetailsDialog] = useState({ open: false, payroll: null });
  const [processing, setProcessing] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ transaction_reference: '', payment_date: new Date().toISOString().split('T')[0], payment_mode: '' });

  const canGenerate = isHR;
  const canMarkPaid = isFinance;

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
      toast.error('Failed to load payroll data');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleGenerateBulk = async () => {
    setProcessing(true);
    try {
      const result = await payrollApi.generateBulk({ month: selectedMonth, year: selectedYear });
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
      setPaymentForm({ transaction_reference: '', payment_date: new Date().toISOString().split('T')[0], payment_mode: '' });
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
      toast.error('Failed to generate payslip');
    }
  };

  const handleDownloadPayslip = async (payrollId) => {
    try {
      const result = await payrollApi.downloadPayslip(payrollId);
      window.open(result.data.download_url, '_blank');
    } catch (error) {
      toast.error('Failed to download payslip');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Select value={String(selectedMonth)} onValueChange={(v) => setSelectedMonth(Number(v))}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS.map(m => <SelectItem key={m.value} value={String(m.value)}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{[2024, 2025, 2026].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" onClick={loadData}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
        </div>
        {canGenerate && <Button onClick={() => setGenerateDialog(true)}><DollarSign className="h-4 w-4 mr-2" />Generate Payroll</Button>}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SummaryCard title="Total Employees" value={summary.total_employees} icon={Users} color="blue" />
          <SummaryCard title="Total Net Salary" value={`₹${summary.total_net_salary?.toLocaleString()}`} icon={Wallet} color="purple" />
          <SummaryCard title="Paid" value={summary.paid_count} subtitle={`₹${summary.total_paid_amount?.toLocaleString()}`} icon={CheckCircle} color="emerald" />
          <SummaryCard title="Pending Payment" value={summary.pending_count} subtitle={`₹${summary.total_pending_amount?.toLocaleString()}`} icon={AlertCircle} color="amber" />
        </div>
      )}

      {/* Payroll Table */}
      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b"><h3 className="text-lg font-semibold">Payroll Records - {MONTHS[selectedMonth - 1]?.label} {selectedYear}</h3></div>
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
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">No payroll records. {canGenerate && 'Click "Generate Payroll".'}</td></tr>
              ) : (
                payrollRecords.map(record => (
                  <tr key={record.id} className="hover:bg-gray-50">
                    <td className="p-3"><p className="font-medium">{record.employee_name}</p><p className="text-xs text-gray-500">{record.department_name || '-'}</p></td>
                    <td className="p-3 text-right">₹{record.gross_salary?.toLocaleString()}</td>
                    <td className="p-3 text-right text-red-600">-₹{(record.total_statutory_deductions + record.attendance_deduction)?.toLocaleString()}</td>
                    <td className="p-3 text-right font-semibold">₹{record.net_salary?.toLocaleString()}</td>
                    <td className="p-3 text-center"><StatusBadge status={record.payment_status} type="payment" /></td>
                    <td className="p-3 text-gray-500">{record.transaction_reference || '-'}</td>
                    <td className="p-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => setDetailsDialog({ open: true, payroll: record })}><Eye className="h-4 w-4" /></Button>
                        {record.payment_status !== 'PAID' && canMarkPaid && <Button size="sm" variant="outline" onClick={() => setPaymentDialog({ open: true, payroll: record })}>Mark Paid</Button>}
                        {record.payslip_path ? (
                          <Button size="sm" variant="ghost" onClick={() => handleDownloadPayslip(record.id)}><Download className="h-4 w-4" /></Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => handleGeneratePayslip(record.id)}><FileText className="h-4 w-4" /></Button>
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

      {/* Generate Dialog */}
      <Dialog open={generateDialog} onOpenChange={setGenerateDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Generate Payroll</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-gray-600">Generate payroll for all active employees for <strong>{MONTHS[selectedMonth - 1]?.label} {selectedYear}</strong>.</p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              <strong>Note:</strong> Ensure attendance records are finalized before generating.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGenerateDialog(false)}>Cancel</Button>
            <Button onClick={handleGenerateBulk} disabled={processing}>{processing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <DollarSign className="h-4 w-4 mr-2" />}Generate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Dialog */}
      <Dialog open={paymentDialog.open} onOpenChange={(open) => !open && setPaymentDialog({ open: false, payroll: null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Confirm Salary Payment</DialogTitle></DialogHeader>
          {paymentDialog.payroll && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p><strong>Employee:</strong> {paymentDialog.payroll.employee_name}</p>
                <p><strong>Amount:</strong> ₹{paymentDialog.payroll.net_salary?.toLocaleString()}</p>
              </div>
              <div><Label>Transaction Reference *</Label><Input placeholder="UTR/Transaction number" value={paymentForm.transaction_reference} onChange={(e) => setPaymentForm(prev => ({ ...prev, transaction_reference: e.target.value }))} /></div>
              <div><Label>Payment Date *</Label><Input type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm(prev => ({ ...prev, payment_date: e.target.value }))} /></div>
              <div>
                <Label>Payment Mode *</Label>
                <Select value={paymentForm.payment_mode} onValueChange={(v) => setPaymentForm(prev => ({ ...prev, payment_mode: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                    <SelectItem value="NEFT">NEFT</SelectItem>
                    <SelectItem value="RTGS">RTGS</SelectItem>
                    <SelectItem value="IMPS">IMPS</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog({ open: false, payroll: null })}>Cancel</Button>
            <Button onClick={handleMarkPaid} disabled={processing}><CheckCircle className="h-4 w-4 mr-2" />Confirm Payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Details Dialog */}
      <Dialog open={detailsDialog.open} onOpenChange={(open) => !open && setDetailsDialog({ open: false, payroll: null })}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Payroll Details</DialogTitle></DialogHeader>
          {detailsDialog.payroll && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto">
              <div className="bg-blue-50 rounded-lg p-4">
                <h4 className="font-semibold mb-2">Employee</h4>
                <p>{detailsDialog.payroll.employee_name} • {detailsDialog.payroll.department_name || '-'}</p>
                <p className="text-sm text-gray-500">{MONTHS[detailsDialog.payroll.month - 1]?.label} {detailsDialog.payroll.year}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2 text-emerald-700">Earnings</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span>Basic</span><span>₹{detailsDialog.payroll.basic_salary?.toLocaleString()}</span></div>
                    {detailsDialog.payroll.hra > 0 && <div className="flex justify-between"><span>HRA</span><span>₹{detailsDialog.payroll.hra?.toLocaleString()}</span></div>}
                    <div className="flex justify-between font-semibold border-t pt-1"><span>Gross</span><span>₹{detailsDialog.payroll.gross_salary?.toLocaleString()}</span></div>
                  </div>
                </div>
                <div className="border rounded-lg p-4">
                  <h4 className="font-semibold mb-2 text-red-700">Deductions</h4>
                  <div className="space-y-1 text-sm">
                    {detailsDialog.payroll.pf_employee > 0 && <div className="flex justify-between"><span>PF</span><span>-₹{detailsDialog.payroll.pf_employee?.toLocaleString()}</span></div>}
                    {detailsDialog.payroll.attendance_deduction > 0 && <div className="flex justify-between"><span>Attendance ({detailsDialog.payroll.unapproved_absent_days} days)</span><span>-₹{detailsDialog.payroll.attendance_deduction?.toLocaleString()}</span></div>}
                    <div className="flex justify-between font-semibold border-t pt-1"><span>Total</span><span>-₹{(detailsDialog.payroll.total_statutory_deductions + detailsDialog.payroll.attendance_deduction)?.toLocaleString()}</span></div>
                  </div>
                </div>
              </div>
              <div className="bg-emerald-50 rounded-lg p-4 flex justify-between items-center">
                <span className="text-lg font-semibold">Net Salary</span>
                <span className="text-2xl font-bold text-emerald-700">₹{detailsDialog.payroll.net_salary?.toLocaleString()}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ==================== LEAVE MANAGEMENT ====================
const LeaveManagement = ({ isHR }) => {
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
  const [leaveForm, setLeaveForm] = useState({ leave_type: '', start_date: '', end_date: '', duration_type: 'FULL_DAY', reason: '' });

  const roleCode = user?.roles?.[0]?.code || '';
  const canApprove = ['CEO', 'HR_MANAGER', 'COUNTRY_HEAD', 'SALES_HEAD', 'INSPECTION_HEAD'].includes(roleCode);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const promises = [leaveApi.getMyBalance(), leaveApi.getMyRequests()];
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
      toast.error('Failed to load leave data');
    } finally {
      setLoading(false);
    }
  }, [canApprove]);

  useEffect(() => { loadData(); }, [loadData]);

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
      setLeaveForm({ leave_type: '', start_date: '', end_date: '', duration_type: 'FULL_DAY', reason: '' });
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to submit');
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
      await leaveApi.approve(approvalDialog.request.id, { action, rejection_reason: rejectionReason || null });
      toast.success(`Leave request ${action.toLowerCase()}`);
      setApprovalDialog({ open: false, request: null });
      setRejectionReason('');
      loadData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed');
    } finally {
      setProcessing(false);
    }
  };

  const handleCancelRequest = async (requestId) => {
    if (!confirm('Cancel this leave request?')) return;
    try {
      await leaveApi.cancel(requestId, 'Cancelled by employee');
      toast.success('Leave request cancelled');
      loadData();
    } catch (error) {
      toast.error('Failed to cancel');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-blue-600" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-end gap-3">
        <Button variant="outline" onClick={loadData}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
        <Button onClick={() => setApplyDialog(true)}><Calendar className="h-4 w-4 mr-2" />Apply for Leave</Button>
      </div>

      {/* Balance Cards */}
      {myBalance && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <SummaryCard title="Casual Leave" value={myBalance.casual_leave_balance} subtitle={`Used: ${myBalance.casual_leave_used}`} icon={Calendar} color="blue" />
          <SummaryCard title="Sick Leave" value={myBalance.sick_leave_balance} subtitle={`Used: ${myBalance.sick_leave_used}`} icon={Briefcase} color="amber" />
          <SummaryCard title="Total Available" value={myBalance.total_leave_balance} icon={CheckCircle} color="emerald" />
          <SummaryCard title="Pending Requests" value={myBalance.pending_requests} icon={AlertCircle} color="purple" />
        </div>
      )}

      {/* Pending Approvals */}
      {canApprove && pendingApprovals.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h3 className="text-lg font-semibold text-amber-800 mb-3 flex items-center gap-2"><AlertCircle className="h-5 w-5" />Pending Leave Approvals ({pendingApprovals.length})</h3>
          <div className="space-y-2">
            {pendingApprovals.map(request => (
              <div key={request.id} className="flex items-center justify-between bg-white rounded-lg p-3 border">
                <div>
                  <p className="font-medium">{request.employee_name}</p>
                  <p className="text-sm text-gray-500">{request.leave_type} • {request.start_date} to {request.end_date} ({request.total_days} days)</p>
                </div>
                <Button size="sm" onClick={() => { setApprovalDialog({ open: true, request }); setRejectionReason(''); }}>Review</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Requests */}
      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b"><h3 className="text-lg font-semibold">My Leave Requests</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="leave-requests-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left p-3">Type</th>
                <th className="text-left p-3">Start</th>
                <th className="text-left p-3">End</th>
                <th className="text-center p-3">Days</th>
                <th className="text-left p-3">Reason</th>
                <th className="text-center p-3">Status</th>
                <th className="text-right p-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {myRequests.length === 0 ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">No leave requests</td></tr>
              ) : (
                myRequests.map(request => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="p-3"><span className={`px-2 py-1 rounded text-xs font-medium ${request.leave_type === 'CASUAL' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'}`}>{request.leave_type}</span></td>
                    <td className="p-3">{request.start_date}</td>
                    <td className="p-3">{request.end_date}</td>
                    <td className="p-3 text-center">{request.total_days}</td>
                    <td className="p-3 max-w-xs truncate">{request.reason}</td>
                    <td className="p-3 text-center"><StatusBadge status={request.status} type="leave" /></td>
                    <td className="p-3 text-right">{request.status === 'PENDING' && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => handleCancelRequest(request.id)}>Cancel</Button>}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Apply Dialog */}
      <Dialog open={applyDialog} onOpenChange={setApplyDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Apply for Leave</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Leave Type *</Label>
              <Select value={leaveForm.leave_type} onValueChange={(v) => setLeaveForm(prev => ({ ...prev, leave_type: v }))}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASUAL">Casual Leave ({myBalance?.casual_leave_balance} available)</SelectItem>
                  <SelectItem value="SICK">Sick Leave ({myBalance?.sick_leave_balance} available)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Start Date *</Label><Input type="date" value={leaveForm.start_date} onChange={(e) => setLeaveForm(prev => ({ ...prev, start_date: e.target.value }))} /></div>
              <div><Label>End Date *</Label><Input type="date" value={leaveForm.end_date} onChange={(e) => setLeaveForm(prev => ({ ...prev, end_date: e.target.value }))} /></div>
            </div>
            <div>
              <Label>Duration</Label>
              <Select value={leaveForm.duration_type} onValueChange={(v) => setLeaveForm(prev => ({ ...prev, duration_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL_DAY">Full Day</SelectItem>
                  <SelectItem value="HALF_DAY_FIRST">Half Day (First)</SelectItem>
                  <SelectItem value="HALF_DAY_SECOND">Half Day (Second)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Reason *</Label><Textarea placeholder="Reason for leave..." value={leaveForm.reason} onChange={(e) => setLeaveForm(prev => ({ ...prev, reason: e.target.value }))} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyDialog(false)}>Cancel</Button>
            <Button onClick={handleApplyLeave} disabled={processing}>Submit Request</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={approvalDialog.open} onOpenChange={(open) => !open && setApprovalDialog({ open: false, request: null })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review Leave Request</DialogTitle></DialogHeader>
          {approvalDialog.request && (
            <div className="space-y-4">
              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <p><strong>Employee:</strong> {approvalDialog.request.employee_name}</p>
                <p><strong>Type:</strong> {approvalDialog.request.leave_type}</p>
                <p><strong>Duration:</strong> {approvalDialog.request.start_date} to {approvalDialog.request.end_date} ({approvalDialog.request.total_days} days)</p>
                <p><strong>Reason:</strong> {approvalDialog.request.reason}</p>
              </div>
              <div><Label>Rejection Reason (if rejecting)</Label><Textarea placeholder="Reason..." value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} /></div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setApprovalDialog({ open: false, request: null })}>Cancel</Button>
            <Button variant="destructive" onClick={() => handleApproval('REJECTED')} disabled={processing}><XCircle className="h-4 w-4 mr-2" />Reject</Button>
            <Button onClick={() => handleApproval('APPROVED')} disabled={processing}><CheckCircle className="h-4 w-4 mr-2" />Approve</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ==================== MAIN HR MODULE PAGE ====================
export default function HRModulePage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('employees');

  const roleCode = user?.roles?.[0]?.code || '';
  const isHR = ['CEO', 'HR_MANAGER'].includes(roleCode);
  const isFinance = ['CEO', 'FINANCE_MANAGER'].includes(roleCode);
  const isHROrFinance = isHR || isFinance || ['COUNTRY_HEAD'].includes(roleCode);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">HR Module</h1>
          <p className="text-gray-500">Manage employees, attendance, payroll, and leave</p>
        </div>

        {/* Tabs Navigation */}
        <div className="mb-6">
          <div className="flex gap-1 p-1 bg-white rounded-xl border w-fit">
            <button
              onClick={() => setActiveTab('employees')}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'employees' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
              data-testid="employees-tab"
            >
              <Users className="h-4 w-4" />
              Employees
            </button>
            <button
              onClick={() => setActiveTab('attendance')}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'attendance' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
              data-testid="attendance-tab"
            >
              <Clock className="h-4 w-4" />
              Attendance
            </button>
            {isHROrFinance && (
              <button
                onClick={() => setActiveTab('payroll')}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'payroll' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                }`}
                data-testid="payroll-tab"
              >
                <DollarSign className="h-4 w-4" />
                Payroll
              </button>
            )}
            <button
              onClick={() => setActiveTab('leave')}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'leave' ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
              }`}
              data-testid="leave-tab"
            >
              <Calendar className="h-4 w-4" />
              Leave
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'employees' && <EmployeesTab isHR={isHR} />}
        {activeTab === 'attendance' && <AttendanceDashboard isHR={isHR} />}
        {activeTab === 'payroll' && isHROrFinance && <PayrollDashboard isHR={isHR} isFinance={isFinance} />}
        {activeTab === 'leave' && <LeaveManagement isHR={isHR} />}
      </div>
    </div>
  );
}
