import React, { useState, useEffect, useCallback, useRef } from 'react';
import { attendanceApi, payrollApi, leaveApi, hrApi, holidayApi } from '@/services/api';
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
  Loader2, Clock, IndianRupee, Calendar, CheckCircle, XCircle, AlertCircle,
  Download, Users, PlayCircle, StopCircle, RefreshCw, FileText, Search, Filter, DollarSign,
  Plus, Trash2, CalendarDays, Globe, Info, MapPin
} from 'lucide-react';

// ==================== ATTENDANCE CALENDAR DASHBOARD ====================
export function AttendanceDashboard({ isHR }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [calendarData, setCalendarData] = useState(null);
  const [countries, setCountries] = useState([]);
  const [filterCountry, setFilterCountry] = useState('');
  
  // Get current date for restrictions
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  
  const [filterMonth, setFilterMonth] = useState(currentMonth);
  const [filterYear, setFilterYear] = useState(currentYear);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  
  // Edit attendance modal state (HR only)
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editData, setEditData] = useState({
    employee_id: '',
    employee_name: '',
    date: '',
    status: 'present',
    notes: ''
  });
  const [saving, setSaving] = useState(false);

  // Debounced search
  const searchTimeout = useRef(null);
  
  const fetchCalendarData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await attendanceApi.getCalendar(
        filterMonth, 
        filterYear, 
        filterCountry || undefined, 
        searchQuery || undefined
      );
      setCalendarData(res.data);
      setCountries(res.data.countries || []);
    } catch (e) { 
      console.error('Failed to load calendar data', e);
      toast.error('Failed to load attendance calendar');
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear, filterCountry, searchQuery]);

  useEffect(() => { 
    fetchCalendarData(); 
  }, [fetchCalendarData]);

  // Handle search with debounce
  const handleSearchChange = (value) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearchQuery(value);
    }, 400);
  };

  // Generate array of day numbers for calendar header
  const getDaysArray = () => {
    if (!calendarData) return [];
    return Array.from({ length: calendarData.total_days }, (_, i) => i + 1);
  };

  // Get weekday name abbreviation
  const getWeekdayAbbr = (day) => {
    if (!calendarData) return '';
    const date = new Date(calendarData.year, calendarData.month - 1, day);
    return date.toLocaleDateString('en', { weekday: 'short' }).charAt(0);
  };

  // Check if day is weekend (Saturday or Sunday)
  const isWeekend = (day) => {
    if (!calendarData) return false;
    const date = new Date(calendarData.year, calendarData.month - 1, day);
    return date.getDay() === 0 || date.getDay() === 6;
  };
  
  // Check if day is in the future
  const isFutureDay = (day) => {
    if (!calendarData) return false;
    const checkDate = new Date(calendarData.year, calendarData.month - 1, day);
    return checkDate > today;
  };

  // Get status color class - updated with LOP, weekly off, org holiday, overtime
  const getStatusColor = (status) => {
    switch (status) {
      case 'working':
      case 'present':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'weekly_off':
        return 'bg-slate-100 text-slate-500 border-slate-200';
      case 'org_holiday':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'holiday':
        return 'bg-slate-100 text-slate-500 border-slate-200';
      case 'leave_approved':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'leave_pending':
        return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'lop':
      case 'absent':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'half_day':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'overtime':
        return 'bg-pink-100 text-pink-800 border-pink-300';
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200';
    }
  };
  
  // Get status display text
  const getStatusDisplay = (status) => {
    switch (status) {
      case 'working':
      case 'present':
        return '✓';
      case 'weekly_off':
        return 'W';
      case 'org_holiday':
        return 'H';
      case 'holiday':
        return '-';
      case 'leave_approved':
        return 'L';
      case 'leave_pending':
        return 'P';
      case 'lop':
      case 'absent':
        return 'A';
      case 'half_day':
        return '½';
      case 'overtime':
        return 'O';
      default:
        return '?';
    }
  };

  // Get tooltip text for day
  const getDayTooltip = (employee, day) => {
    const dateStr = `${calendarData.year}-${String(calendarData.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayData = employee.days[dateStr];
    if (!dayData) return '';
    
    if (dayData.status === 'leave_approved') {
      return `Approved ${dayData.leave_type === 'casual' ? 'Casual' : 'Sick'} Leave${dayData.reason ? `: ${dayData.reason}` : ''}`;
    }
    if (dayData.status === 'leave_pending') {
      return `Pending ${dayData.leave_type === 'casual' ? 'Casual' : 'Sick'} Leave${dayData.reason ? `: ${dayData.reason}` : ''}`;
    }
    if (dayData.status === 'weekly_off') {
      return `Weekly Off (${dayData.weekday_name})`;
    }
    if (dayData.status === 'org_holiday') {
      return `Organization Holiday: ${dayData.reason || 'Holiday'}`;
    }
    if (dayData.status === 'holiday') {
      return `Holiday (${dayData.weekday_name})`;
    }
    if (dayData.status === 'lop' || dayData.status === 'absent') {
      return `LOP/Absent${dayData.reason ? `: ${dayData.reason}` : ''}`;
    }
    if (dayData.status === 'half_day') {
      return `Half Day${dayData.reason ? `: ${dayData.reason}` : ''}`;
    }
    if (dayData.status === 'overtime') {
      return `Overtime Day${dayData.reason ? `: ${dayData.reason}` : ''}`;
    }
    return `Working Day (${dayData.weekday_name})`;
  };
  
  // HR: Open edit modal for a specific day
  const handleDayClick = (employee, day) => {
    if (!isHR) return;
    if (isFutureDay(day)) {
      toast.error('Cannot edit future dates');
      return;
    }
    
    const dateStr = `${calendarData.year}-${String(calendarData.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dayData = employee.days[dateStr];
    
    setEditData({
      employee_id: employee.employee_id,
      employee_name: employee.employee_name,
      date: dateStr,
      status: dayData?.status === 'working' ? 'present' : (dayData?.status || 'present'),
      notes: dayData?.reason || ''
    });
    setEditModalOpen(true);
  };
  
  // HR: Save attendance update
  const handleSaveAttendance = async () => {
    if (!editData.employee_id || !editData.date) return;
    
    setSaving(true);
    try {
      await attendanceApi.updateDayStatus({
        employee_id: editData.employee_id,
        date: editData.date,
        status: editData.status,
        notes: editData.notes
      });
      toast.success('Attendance updated successfully');
      setEditModalOpen(false);
      fetchCalendarData();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to update attendance');
    } finally {
      setSaving(false);
    }
  };
  
  // Get available months (up to current month for current year, all months for past years)
  const getAvailableMonths = () => {
    const months = [];
    const maxMonth = filterYear === currentYear ? currentMonth : 12;
    for (let i = 1; i <= maxMonth; i++) {
      months.push(i);
    }
    return months;
  };
  
  // Get available years (current and past, not future)
  const getAvailableYears = () => {
    const years = [];
    for (let y = currentYear; y >= 2024; y--) {
      years.push(y);
    }
    return years;
  };
  
  // When year changes, adjust month if needed
  useEffect(() => {
    if (filterYear === currentYear && filterMonth > currentMonth) {
      setFilterMonth(currentMonth);
    }
  }, [filterYear, filterMonth, currentMonth, currentYear]);

  return (
    <div className="p-6" data-testid="attendance-dashboard">
      {/* Full Page Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <p className="text-sm font-medium text-gray-600">Loading attendance data...</p>
          </div>
        </div>
      )}

      {/* Header with Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Attendance Calendar
          </h2>
          <p className="text-sm text-gray-500">
            Consolidated view of employee attendance and leave status
            {isHR && <span className="text-blue-600 ml-2">(Click on any day to edit)</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search employee..."
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 w-56"
              data-testid="search-employee"
            />
          </div>

          {/* Country Filter */}
          <Select value={filterCountry || 'all'} onValueChange={(v) => setFilterCountry(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-40" data-testid="filter-country">
              <SelectValue placeholder="All Countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {countries.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>

          {/* Month Filter - restricted to current/past months */}
          <Select value={String(filterMonth)} onValueChange={(v) => setFilterMonth(parseInt(v))}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getAvailableMonths().map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {new Date(2000, m - 1).toLocaleString('default', { month: 'long' })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Year Filter - restricted to current/past years */}
          <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(parseInt(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getAvailableYears().map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>

          <Button variant="outline" size="icon" onClick={fetchCalendarData} data-testid="refresh-btn">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Legend - Updated with Weekly Off, Org Holiday, Overtime */}
      <div className="flex flex-wrap items-center gap-4 mb-4 p-3 bg-slate-50 rounded-lg border">
        <span className="text-xs font-medium text-gray-500 uppercase">Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-emerald-100 border border-emerald-200 flex items-center justify-center text-[8px]">✓</span>
          <span className="text-xs text-gray-600">Present</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[8px]">W</span>
          <span className="text-xs text-gray-600">Weekly Off</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-purple-100 border border-purple-300 flex items-center justify-center text-[8px]">H</span>
          <span className="text-xs text-gray-600">Org Holiday</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-blue-100 border border-blue-300 flex items-center justify-center text-[8px]">L</span>
          <span className="text-xs text-gray-600">Leave (Approved)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-amber-100 border border-amber-300 flex items-center justify-center text-[8px]">P</span>
          <span className="text-xs text-gray-600">Leave (Pending)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-red-100 border border-red-300 flex items-center justify-center text-[8px]">A</span>
          <span className="text-xs text-gray-600">LOP/Absent</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-orange-100 border border-orange-300 flex items-center justify-center text-[8px]">½</span>
          <span className="text-xs text-gray-600">Half Day</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-pink-100 border border-pink-300 flex items-center justify-center text-[8px]">O</span>
          <span className="text-xs text-gray-600">Overtime</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : calendarData && calendarData.employees.length > 0 ? (
        <div className="border rounded-xl overflow-hidden bg-white">
          {/* Calendar Grid */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600 sticky left-0 bg-slate-50 z-10 min-w-[200px]">
                    Employee
                  </th>
                  {getDaysArray().map(day => (
                    <th 
                      key={day} 
                      className={`px-0.5 py-2 text-center text-xs font-medium min-w-[28px] ${isWeekend(day) ? 'bg-slate-100 text-slate-400' : 'text-slate-600'} ${isFutureDay(day) ? 'opacity-40' : ''}`}
                    >
                      <div className="text-[10px] text-gray-400">{getWeekdayAbbr(day)}</div>
                      <div>{day}</div>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 bg-slate-50 min-w-[100px]">
                    Summary
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {calendarData.employees.map((employee) => (
                  <tr 
                    key={employee.employee_id} 
                    className={`hover:bg-slate-50/50 ${selectedEmployee === employee.employee_id ? 'bg-blue-50/50' : ''}`}
                  >
                    {/* Employee Info - Sticky */}
                    <td className="px-3 py-2 sticky left-0 bg-white z-10 border-r">
                      <div className="flex items-center gap-2">
                        {employee.photo_url ? (
                          <img 
                            src={employee.photo_url} 
                            alt={employee.employee_name} 
                            className="h-8 w-8 rounded-full object-cover border"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-medium">
                            {employee.employee_name?.charAt(0)}
                          </div>
                        )}
                        <div>
                          <span className="font-medium text-sm block truncate max-w-[140px]" title={employee.employee_name}>
                            {employee.employee_name}
                          </span>
                          <span className="text-[10px] text-gray-400">{employee.employee_code || employee.email}</span>
                        </div>
                      </div>
                    </td>

                    {/* Day Cells */}
                    {getDaysArray().map(day => {
                      const dateStr = `${calendarData.year}-${String(calendarData.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const dayData = employee.days[dateStr];
                      const isFuture = isFutureDay(day);
                      if (!dayData) return <td key={day} className="px-0.5 py-1.5"></td>;
                      
                      return (
                        <td key={day} className="px-0.5 py-1.5 text-center">
                          <div 
                            onClick={() => !isFuture && handleDayClick(employee, day)}
                            title={getDayTooltip(employee, day)}
                            className={`w-6 h-6 mx-auto rounded text-[10px] font-medium flex items-center justify-center border ${getStatusColor(dayData.status)} ${isFuture ? 'opacity-40 cursor-not-allowed' : isHR ? 'cursor-pointer hover:ring-2 hover:ring-blue-400' : 'cursor-help'}`}
                          >
                            {getStatusDisplay(dayData.status)}
                          </div>
                        </td>
                      );
                    })}

                    {/* Summary Column - Updated with LOP count */}
                    <td className="px-3 py-2 text-center bg-slate-50/50 border-l">
                      <div className="flex items-center justify-center gap-1 text-[10px] flex-wrap">
                        <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-medium" title="Working Days">
                          {employee.summary.working_days}W
                        </span>
                        {employee.summary.leave_approved > 0 && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium" title="Approved Leaves">
                            {employee.summary.leave_approved}L
                          </span>
                        )}
                        {employee.summary.leave_pending > 0 && (
                          <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded font-medium" title="Pending Leaves">
                            {employee.summary.leave_pending}P
                          </span>
                        )}
                        {employee.summary.lop_days > 0 && (
                          <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium" title="LOP Days">
                            {employee.summary.lop_days}LOP
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Stats */}
          <div className="px-4 py-3 bg-slate-50 border-t flex items-center justify-between text-sm">
            <span className="text-gray-500">
              {calendarData.month_name} {calendarData.year} • {calendarData.employees.length} employees
            </span>
            <span className="text-gray-500">
              Total Days: {calendarData.total_days}
            </span>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Users className="h-12 w-12 text-gray-300 mb-3" />
          <p className="font-medium">No employees found</p>
          <p className="text-sm">Try adjusting your filters or search query</p>
        </div>
      )}
      
      {/* HR Edit Attendance Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="sm:max-w-[400px]" data-testid="edit-attendance-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" />
              Update Attendance
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="bg-slate-50 p-3 rounded-lg">
              <p className="font-medium text-gray-900">{editData.employee_name}</p>
              <p className="text-sm text-gray-500">{editData.date}</p>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Status</Label>
              <Select value={editData.status} onValueChange={(v) => setEditData({...editData, status: v})}>
                <SelectTrigger className="mt-1.5" data-testid="attendance-status-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">✓ Present</SelectItem>
                  <SelectItem value="absent">A - Absent/LOP</SelectItem>
                  <SelectItem value="half_day">½ - Half Day</SelectItem>
                  <SelectItem value="leave_approved">L - Leave (Approved)</SelectItem>
                  <SelectItem value="holiday">- Weekend/Holiday</SelectItem>
                  <SelectItem value="overtime">O - Overtime</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Notes (Optional)</Label>
              <Input
                value={editData.notes}
                onChange={(e) => setEditData({...editData, notes: e.target.value})}
                placeholder="Add a note..."
                className="mt-1.5"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setEditModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveAttendance} 
              disabled={saving}
              className="bg-gradient-to-r from-blue-600 to-blue-700"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ==================== PAYROLL DASHBOARD (NEW BATCH-BASED GOVERNANCE) ====================
export function PayrollDashboard({ isHR, isFinance }) {
  const { user } = useAuth();
  
  // Determine currency icon based on user's country (Rupee for Indian users, $ for CEO or others)
  const isCEO = user?.role_code === 'CEO' || user?.roles?.some(r => r.code === 'CEO');
  const isIndianUser = user?.country_code === 'IN' || user?.country_name?.toLowerCase().includes('india');
  const CurrencyIcon = (!isCEO && isIndianUser) ? IndianRupee : DollarSign;
  
  // Simple number input - NO complex state management, just a plain text field
  const SimpleNumberInput = ({ defaultValue, onValueChange, className, ...props }) => {
    const [value, setValue] = useState(defaultValue?.toString() || '0');
    
    // Only update from parent on mount or when defaultValue changes externally
    useEffect(() => {
      setValue(defaultValue?.toString() || '0');
    }, [defaultValue]);
    
    return (
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={(e) => {
          const v = e.target.value;
          // Allow only digits
          if (v === '' || /^\d*$/.test(v)) {
            setValue(v);
          }
        }}
        onBlur={(e) => {
          // Only call parent on blur with final value
          const finalValue = value === '' ? '0' : value;
          setValue(finalValue);
          if (onValueChange) {
            onValueChange(parseInt(finalValue, 10) || 0);
          }
        }}
        className={`flex rounded-md border border-input bg-white px-2 py-1 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${className}`}
        {...props}
      />
    );
  };

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
  const [filterMonth, setFilterMonth] = useState(''); // Empty means all months
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
  
  // Preview editing states (for lop_days, other_deductions, and batch working_days)
  const [previewEdits, setPreviewEdits] = useState({});  // { employee_id: { lop_days, other_deductions } }
  const [previewErrors, setPreviewErrors] = useState({}); // { employee_id: { field: error_message } }
  const [batchWorkingDays, setBatchWorkingDays] = useState(null); // Editable working days for entire batch
  
  // Info modal states
  const [infoModal, setInfoModal] = useState({ open: false, type: '', data: null });

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
        month: filterMonth || undefined,
        status: filterBatchStatus !== 'all' ? filterBatchStatus : undefined
      });
      setBatches(res.data || []);
    } catch (e) { 
      console.error('Failed to load batches');
      setBatches([]);
    } finally { 
      setLoading(false); 
    }
  }, [filterCountry, filterYear, filterMonth, filterBatchStatus]);

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
      // Initialize preview edits with current values - LOP defaults to 0
      const initialEdits = {};
      res.data.records.forEach(record => {
        // LOP days defaults to 0 unless explicitly set in the record
        const lopDays = record.lop_days ?? 0;
        initialEdits[record.employee_id] = {
          lop_days: lopDays,
          other_deductions: record.other_deductions || 0,
          incentive_amount: record.incentive_amount || 0,
          overtime_days: record.overtime_days || 0
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

        // Get LOP days (from edit or default to 0)
        let lopDays = previewEdits[record.employee_id]?.lop_days ?? previewEdits[record.employee_id]?.absent_days ?? 0;
        // Cap LOP days at working days
        lopDays = Math.min(Math.max(0, lopDays), workingDays);
        
        // Calculate attendance (present) days
        const attendanceDays = workingDays - lopDays;
        
        // Calculate LOP deduction
        const attendanceDeduction = Math.round(perDaySalary * lopDays * 100) / 100;

        // Get other deductions
        let otherDeductions = previewEdits[record.employee_id]?.other_deductions ?? record.other_deductions ?? 0;
        
        // Get incentive amount
        let incentiveAmount = previewEdits[record.employee_id]?.incentive_amount ?? record.incentive_amount ?? 0;
        incentiveAmount = Math.max(0, incentiveAmount);
        
        // Get overtime days
        let overtimeDays = previewEdits[record.employee_id]?.overtime_days ?? record.overtime_days ?? 0;
        overtimeDays = Math.max(0, overtimeDays);
        
        // Calculate overtime pay
        const overtimeRate = record.overtime_rate_per_day || 0;
        const overtimePay = Math.round(overtimeRate * overtimeDays * 100) / 100;

        // Calculate totals: Net = Gross + Incentive + OT Pay - Statutory - LOP Ded. - Other Ded.
        const totalDeductions = record.total_statutory_deductions + attendanceDeduction + otherDeductions;
        const netSalary = Math.round((gross + incentiveAmount + overtimePay - totalDeductions) * 100) / 100;

        return {
          ...record,
          working_days_in_month: workingDays,
          attendance_days: attendanceDays,
          lop_days: lopDays,
          unapproved_absent_days: lopDays,  // Keep for backward compatibility
          attendance_deduction: attendanceDeduction,
          per_day_salary: Math.round(perDaySalary * 100) / 100,
          other_deductions: otherDeductions,
          incentive_amount: incentiveAmount,
          overtime_days: overtimeDays,
          overtime_pay: overtimePay,
          total_deductions: Math.round(totalDeductions * 100) / 100,
          net_salary: netSalary
        };
      });

      // Recalculate batch totals
      const totalGross = updatedRecords.reduce((sum, r) => sum + r.gross_salary, 0);
      const totalStatutory = updatedRecords.reduce((sum, r) => sum + r.total_statutory_deductions, 0);
      const totalAttendance = updatedRecords.reduce((sum, r) => sum + r.attendance_deduction, 0);
      const totalOther = updatedRecords.reduce((sum, r) => sum + r.other_deductions, 0);
      const totalIncentive = updatedRecords.reduce((sum, r) => sum + (r.incentive_amount || 0), 0);
      const totalOvertimePay = updatedRecords.reduce((sum, r) => sum + (r.overtime_pay || 0), 0);
      const totalNet = updatedRecords.reduce((sum, r) => sum + r.net_salary, 0);

      return {
        ...prev,
        working_days: numValue,
        records: updatedRecords,
        total_gross: Math.round(totalGross * 100) / 100,
        total_statutory_deductions: Math.round(totalStatutory * 100) / 100,
        total_attendance_deductions: Math.round(totalAttendance * 100) / 100,
        total_other_deductions: Math.round(totalOther * 100) / 100,
        total_incentive: Math.round(totalIncentive * 100) / 100,
        total_overtime_pay: Math.round(totalOvertimePay * 100) / 100,
        total_net: Math.round(totalNet * 100) / 100
      };
    });

    // Re-validate LOP days for all employees
    const newErrors = {};
    Object.keys(previewEdits).forEach(employeeId => {
      const lopDays = previewEdits[employeeId]?.lop_days ?? previewEdits[employeeId]?.absent_days ?? 0;
      if (lopDays > numValue) {
        newErrors[employeeId] = { lop_days: `Cannot exceed ${numValue} working days` };
      }
    });
    setPreviewErrors(newErrors);
  };

  // Handle preview field edit with validation and recalculation (now uses lop_days)
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

    if (field === 'lop_days' || field === 'absent_days') {
      if (numValue < 0) {
        errors[employeeId].lop_days = 'Must be ≥ 0';
      } else if (numValue > workingDays) {
        errors[employeeId].lop_days = `Cannot exceed ${workingDays} working days`;
      } else {
        delete errors[employeeId].lop_days;
      }
    }

    if (field === 'other_deductions') {
      // Calculate net before other to validate cap
      const lopDays = field === 'lop_days' ? numValue : (previewEdits[employeeId]?.lop_days ?? previewEdits[employeeId]?.absent_days ?? 0);
      const perDaySalary = record.gross_salary / workingDays;
      const attendanceDeduction = perDaySalary * lopDays;
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

  // Recalculate payroll for employee in preview (NEW formula)
  // Net = Pro-rated Gross + Incentive + OT Pay - Statutory - Other Deductions
  // Pro-rated Gross = (Monthly Gross / Working Days) × Actual Working Days
  // Actual Working Days = Working Days - LOP Days - Leaves Beyond Entitlement
  const recalculatePreview = (employeeId, changedField, newValue) => {
    setPreviewData(prev => {
      if (!prev) return prev;

      const updatedRecords = prev.records.map(record => {
        if (record.employee_id !== employeeId) return record;

        const workingDays = record.working_days || prev.working_days;
        const monthlyGross = record.monthly_gross || record.gross_salary;
        const perDaySalary = workingDays > 0 ? monthlyGross / workingDays : 0;

        // Get LOP days (from edit or default to 0)
        let lopDays = (changedField === 'lop_days' || changedField === 'absent_days')
          ? newValue 
          : (previewEdits[employeeId]?.lop_days ?? record.lop_days ?? 0);
        
        // Cap LOP days at working days
        lopDays = Math.min(Math.max(0, lopDays), workingDays);
        
        // Get leaves beyond entitlement (calculated server-side, not editable)
        const leavesBeyondEntitlement = record.leaves_beyond_entitlement || 0;
        
        // Calculate actual working days
        const actualWorkingDays = Math.max(0, workingDays - lopDays - leavesBeyondEntitlement);
        
        // Calculate pro-rated gross salary
        const proratedGross = Math.round(perDaySalary * actualWorkingDays * 100) / 100;

        // Get other deductions
        let otherDeductions = changedField === 'other_deductions'
          ? newValue
          : (previewEdits[employeeId]?.other_deductions ?? record.other_deductions ?? 0);
        otherDeductions = Math.max(0, otherDeductions);
        
        // Get incentive amount (editable)
        let incentiveAmount = changedField === 'incentive_amount'
          ? newValue
          : (previewEdits[employeeId]?.incentive_amount ?? record.incentive_amount ?? 0);
        incentiveAmount = Math.max(0, incentiveAmount);
        
        // Get overtime days (editable)
        let overtimeDays = changedField === 'overtime_days'
          ? newValue
          : (previewEdits[employeeId]?.overtime_days ?? record.overtime_days ?? 0);
        overtimeDays = Math.max(0, overtimeDays);
        
        // Calculate overtime pay (overtime_rate_per_day * overtime_days)
        const overtimeRate = record.overtime_rate_per_day || 0;
        const overtimePay = Math.round(overtimeRate * overtimeDays * 100) / 100;

        // Calculate totals: Net = Pro-rated Gross + Incentive + OT Pay - Statutory - Other Ded.
        const totalDeductions = record.total_statutory_deductions + otherDeductions;
        const netSalary = Math.round((proratedGross + incentiveAmount + overtimePay - totalDeductions) * 100) / 100;

        return {
          ...record,
          working_days: workingDays,
          actual_working_days: actualWorkingDays,
          lop_days: lopDays,
          gross_salary: proratedGross,  // This is now pro-rated gross
          per_day_salary: Math.round(perDaySalary * 100) / 100,
          other_deductions: otherDeductions,
          incentive_amount: incentiveAmount,
          overtime_days: overtimeDays,
          overtime_pay: overtimePay,
          total_deductions: Math.round(totalDeductions * 100) / 100,
          net_salary: netSalary
        };
      });

      // Recalculate batch totals
      const totalGross = updatedRecords.reduce((sum, r) => sum + r.gross_salary, 0);
      const totalStatutory = updatedRecords.reduce((sum, r) => sum + r.total_statutory_deductions, 0);
      const totalOther = updatedRecords.reduce((sum, r) => sum + r.other_deductions, 0);
      const totalIncentive = updatedRecords.reduce((sum, r) => sum + (r.incentive_amount || 0), 0);
      const totalOvertimePay = updatedRecords.reduce((sum, r) => sum + (r.overtime_pay || 0), 0);
      const totalNet = updatedRecords.reduce((sum, r) => sum + r.net_salary, 0);

      return {
        ...prev,
        records: updatedRecords,
        total_gross: Math.round(totalGross * 100) / 100,
        total_statutory_deductions: Math.round(totalStatutory * 100) / 100,
        total_other_deductions: Math.round(totalOther * 100) / 100,
        total_incentive: Math.round(totalIncentive * 100) / 100,
        total_overtime_pay: Math.round(totalOvertimePay * 100) / 100,
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
    const workingDays = record.working_days_in_month || 0;
    const attendanceDays = record.attendance_days || workingDays;
    const lopDays = record.lop_days ?? (workingDays - attendanceDays);
    
    setEditingRecord(record.id);
    setEditingValues({
      pf_employee: record.pf_employee || 0,
      professional_tax: record.professional_tax || 0,
      income_tax: record.income_tax || 0,
      esi: record.esi || 0,
      other_statutory: record.other_statutory || 0,
      lop_days: Math.max(0, lopDays),  // Use lop_days
      attendance_days: attendanceDays,  // Keep for calculation
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

              <Select value={filterMonth || 'all'} onValueChange={(v) => setFilterMonth(v === 'all' ? '' : v)}>
                <SelectTrigger className="w-32" data-testid="filter-month">
                  <SelectValue placeholder="All Months" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Months</SelectItem>
                  {[...Array(12)].map((_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {new Date(2000, i).toLocaleString('default', { month: 'long' })}
                    </SelectItem>
                  ))}
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
                  <CurrencyIcon className="h-4 w-4 mr-2" /> Generate Payroll
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
                        <CurrencyIcon className="h-12 w-12 mx-auto mb-3 text-gray-300" />
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
              <Button variant="outline" onClick={() => { setView('batches'); setPreviewData(null); setPreviewEdits({}); setPreviewErrors({}); setBatchWorkingDays(null); }}>
                ← Back to Batches
              </Button>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Payroll Preview - {new Date(2000, previewData.month - 1).toLocaleString('default', { month: 'long' })} {previewData.year}
                </h2>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-500">
                  <span>{previewData.country_name}</span>
                  <span>•</span>
                  <span>{previewData.employee_count} employees</span>
                  <span>•</span>
                  <span className="font-medium text-slate-700">Pay Period: {previewData.pay_period_start} to {previewData.pay_period_end}</span>
                  <span>•</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-indigo-600">Working Days:</span>
                    <SimpleNumberInput
                      defaultValue={batchWorkingDays ?? previewData.working_days}
                      onValueChange={(val) => handleWorkingDaysChange(val.toString())}
                      className="w-16 h-7 text-center text-sm font-medium border-indigo-300 focus:border-indigo-500"
                      data-testid="batch-working-days-input"
                    />
                  </div>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex gap-2 flex-wrap">
                <div className="px-2 py-1 bg-emerald-50 rounded-lg border border-emerald-200">
                  <span className="text-[10px] text-emerald-600 block">Gross</span>
                  <span className="font-bold text-emerald-800 text-sm">{formatCurrency(previewData.total_gross, previewData.currency_symbol)}</span>
                </div>
                <div className="px-2 py-1 bg-teal-50 rounded-lg border border-teal-200">
                  <span className="text-[10px] text-teal-600 block">Incentives</span>
                  <span className="font-bold text-teal-800 text-sm">{formatCurrency(previewData.total_incentive || 0, previewData.currency_symbol)}</span>
                </div>
                <div className="px-2 py-1 bg-pink-50 rounded-lg border border-pink-200">
                  <span className="text-[10px] text-pink-600 block">OT Pay</span>
                  <span className="font-bold text-pink-800 text-sm">{formatCurrency(previewData.total_overtime_pay || 0, previewData.currency_symbol)}</span>
                </div>
                <div className="px-2 py-1 bg-red-50 rounded-lg border border-red-200">
                  <span className="text-[10px] text-red-600 block">Deductions</span>
                  <span className="font-bold text-red-800 text-sm">{formatCurrency((previewData.total_statutory_deductions || 0) + (previewData.total_attendance_deductions || 0) + (previewData.total_other_deductions || 0), previewData.currency_symbol)}</span>
                </div>
                <div className="px-2 py-1 bg-blue-50 rounded-lg border border-blue-200">
                  <span className="text-[10px] text-blue-600 block">Net</span>
                  <span className="font-bold text-blue-800 text-sm">{formatCurrency(previewData.total_net, previewData.currency_symbol)}</span>
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
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">Working Days</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600">
                    <div className="flex items-center justify-center gap-1">
                      Actual Working
                      <Info className="h-3 w-3 text-blue-500 cursor-pointer" />
                    </div>
                  </th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600">
                    <div className="flex items-center justify-end gap-1">
                      Gross Salary
                      <Info className="h-3 w-3 text-blue-500 cursor-pointer" />
                    </div>
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 bg-emerald-100">
                    <span className="text-emerald-700">Incentive (+)</span>
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 bg-emerald-100">
                    <span className="text-emerald-700">OT Pay (+)</span>
                  </th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 bg-red-100">
                    <span className="text-red-700">Other Ded. (-)</span>
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
                    <td className="px-3 py-2 text-center">
                      <span className="font-medium">{record.working_days || previewData.working_days}</span>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className="font-medium">{record.actual_working_days ?? (record.working_days - (previewEdits[record.employee_id]?.lop_days || 0))}</span>
                        <button
                          onClick={() => setInfoModal({
                            open: true,
                            type: 'actual_working',
                            data: {
                              employee_name: record.employee_name,
                              working_days: record.working_days || previewData.working_days,
                              lop_days: previewEdits[record.employee_id]?.lop_days ?? record.lop_days ?? 0,
                              leaves_taken: record.leaves_taken || 0,
                              leave_entitlement: record.total_leave_entitlement || 3,
                              leaves_beyond_entitlement: record.leaves_beyond_entitlement || 0,
                              weekly_offs: record.weekly_offs_in_month || 4,
                              deduction_breakdown: record.deduction_breakdown
                            }
                          })}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className="font-medium text-emerald-600">{formatCurrency(record.gross_salary, record.currency_symbol)}</span>
                        <button
                          onClick={() => setInfoModal({
                            open: true,
                            type: 'gross_salary',
                            data: {
                              employee_name: record.employee_name,
                              monthly_gross: record.monthly_gross || record.gross_salary,
                              working_days: record.working_days || previewData.working_days,
                              actual_working_days: record.actual_working_days ?? (record.working_days - (previewEdits[record.employee_id]?.lop_days || 0)),
                              per_day_salary: record.per_day_salary,
                              prorated_gross: record.gross_salary,
                              currency_symbol: record.currency_symbol,
                              gross_calculation: record.gross_calculation
                            }
                          })}
                          className="text-blue-500 hover:text-blue-700"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2 bg-emerald-50">
                      <div className="flex flex-col items-center">
                        <SimpleNumberInput
                          defaultValue={previewEdits[record.employee_id]?.incentive_amount ?? record.incentive_amount ?? 0}
                          onValueChange={(val) => handlePreviewEdit(record.employee_id, 'incentive_amount', val.toString())}
                          className="w-20 h-7 text-center text-xs bg-white border-emerald-300"
                          data-testid={`incentive-${record.employee_id}`}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 bg-emerald-50">
                      <div className="flex flex-col items-center gap-0.5">
                        <SimpleNumberInput
                          defaultValue={previewEdits[record.employee_id]?.overtime_days ?? record.overtime_days ?? 0}
                          onValueChange={(val) => handlePreviewEdit(record.employee_id, 'overtime_days', val.toString())}
                          className="w-14 h-7 text-center text-xs bg-white border-emerald-300"
                          data-testid={`overtime-days-${record.employee_id}`}
                        />
                        <span className="text-[10px] text-emerald-600">
                          {formatCurrency(record.overtime_pay || ((previewEdits[record.employee_id]?.overtime_days || 0) * (record.overtime_rate_per_day || 0)), record.currency_symbol)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2 bg-red-50">
                      <div className="flex flex-col items-center">
                        <SimpleNumberInput
                          defaultValue={previewEdits[record.employee_id]?.other_deductions ?? record.other_deductions ?? 0}
                          onValueChange={(val) => handlePreviewEdit(record.employee_id, 'other_deductions', val.toString())}
                          className={`w-20 h-7 text-center text-xs bg-white border-red-300 ${previewErrors[record.employee_id]?.other_deductions ? 'border-red-500 bg-red-50' : ''}`}
                          data-testid={`other-deductions-${record.employee_id}`}
                        />
                        {previewErrors[record.employee_id]?.other_deductions && (
                          <span className="text-[10px] text-red-600 mt-0.5">{previewErrors[record.employee_id].other_deductions}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right bg-blue-50/50 font-bold text-blue-800">{formatCurrency(record.net_salary, record.currency_symbol)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          {/* Info Modal for Actual Working Days */}
          <Dialog open={infoModal.open && infoModal.type === 'actual_working'} onOpenChange={(open) => !open && setInfoModal({ open: false, type: '', data: null })}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-lg">Actual Working Days Calculation</DialogTitle>
              </DialogHeader>
              {infoModal.data && (
                <div className="space-y-4">
                  <div className="text-sm font-medium text-gray-700">{infoModal.data.employee_name}</div>
                  <div className="bg-slate-50 p-4 rounded-lg space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Working Days (in month)</span>
                      <span className="font-medium">{infoModal.data.working_days}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>− LOP Days</span>
                      <span className="font-medium">{infoModal.data.lop_days}</span>
                    </div>
                    <div className="flex justify-between text-amber-600">
                      <span>− Leaves Beyond Entitlement</span>
                      <span className="font-medium">{infoModal.data.leaves_beyond_entitlement}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>= Actual Working Days</span>
                      <span className="text-blue-600">{infoModal.data.working_days - infoModal.data.lop_days - infoModal.data.leaves_beyond_entitlement}</span>
                    </div>
                  </div>
                  <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-700">
                    <div className="font-medium mb-1">Leave Entitlement Info:</div>
                    <div>• Leaves Taken: {infoModal.data.leaves_taken} days</div>
                    <div>• Entitlement: {infoModal.data.leave_entitlement} days/month</div>
                    <div>• Weekly Offs: {infoModal.data.weekly_offs} (not deducted)</div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
          
          {/* Info Modal for Gross Salary */}
          <Dialog open={infoModal.open && infoModal.type === 'gross_salary'} onOpenChange={(open) => !open && setInfoModal({ open: false, type: '', data: null })}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle className="text-lg">Gross Salary Calculation</DialogTitle>
              </DialogHeader>
              {infoModal.data && (
                <div className="space-y-4">
                  <div className="text-sm font-medium text-gray-700">{infoModal.data.employee_name}</div>
                  <div className="bg-slate-50 p-4 rounded-lg space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Monthly Gross Salary</span>
                      <span className="font-medium">{infoModal.data.currency_symbol}{infoModal.data.monthly_gross?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>÷ Working Days</span>
                      <span>{infoModal.data.working_days}</span>
                    </div>
                    <div className="flex justify-between text-gray-500">
                      <span>= Per Day Salary</span>
                      <span>{infoModal.data.currency_symbol}{infoModal.data.per_day_salary?.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600">
                      <span>× Actual Working Days</span>
                      <span>{infoModal.data.actual_working_days}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>= Pro-rated Gross</span>
                      <span className="text-emerald-600">{infoModal.data.currency_symbol}{infoModal.data.prorated_gross?.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="bg-emerald-50 p-3 rounded-lg text-xs text-emerald-700">
                    <div className="font-medium">Formula:</div>
                    <div>(Monthly Gross ÷ Working Days) × Actual Working Days</div>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>
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
                  <CurrencyIcon className="h-4 w-4 mr-2" /> Mark as Paid
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
                  <th className="px-3 py-2 text-center text-xs font-semibold text-slate-600 bg-amber-50">LOP Days</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 bg-red-50">Statutory</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold text-slate-600 bg-amber-50">LOP Ded.</th>
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
                    
                    {/* LOP Days */}
                    {editingRecord === record.id && selectedBatch.status === 'DRAFT' ? (
                      <td className="px-2 py-1 bg-amber-50/50">
                        <Input
                          type="number"
                          min="0"
                          max={record.working_days_in_month}
                          step="1"
                          value={editingValues.lop_days ?? editingValues.absent_days ?? record.lop_days ?? record.unapproved_absent_days ?? 0}
                          onChange={(e) => {
                            const lopDays = parseInt(e.target.value, 10) || 0;
                            const workingDays = record.working_days_in_month || 0;
                            const attendanceDays = workingDays - lopDays;
                            setEditingValues({
                              ...editingValues, 
                              lop_days: lopDays,
                              attendance_days: Math.max(0, attendanceDays)
                            });
                          }}
                          className="h-6 text-xs w-14 text-center"
                        />
                      </td>
                    ) : (
                      <td className="px-3 py-2 text-center bg-amber-50/50 text-amber-700 font-medium">
                        {record.lop_days ?? record.unapproved_absent_days ?? (record.working_days_in_month - (record.attendance_days || 0)) ?? 0}
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
                <CurrencyIcon className="h-5 w-5" />
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
  
  // Employee list for Country Head to apply on behalf
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  
  // Check if user is Country Head (can apply leave for others)
  const isCountryHead = user?.role_code === 'COUNTRY_HEAD' || user?.roles?.some(r => r.code === 'COUNTRY_HEAD');
  const isCEO = user?.role_code === 'CEO' || user?.roles?.some(r => r.code === 'CEO');
  const canApplyForOthers = isCountryHead || isCEO;
  
  // Apply form state - now includes employee_id for Country Head
  const [applyForm, setApplyForm] = useState({
    employee_id: '',
    leave_type: 'casual',
    start_date: '',
    end_date: '',
    reason: ''
  });
  const [applying, setApplying] = useState(false);

  // Fetch employees for Country Head dropdown
  useEffect(() => {
    if (canApplyForOthers && isApplyModalOpen) {
      setLoadingEmployees(true);
      hrApi.getEmployees({ is_active: true })
        .then(res => setEmployees(res.data || []))
        .catch(() => setEmployees([]))
        .finally(() => setLoadingEmployees(false));
    }
  }, [canApplyForOthers, isApplyModalOpen]);

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
    // Validation
    if (canApplyForOthers && !applyForm.employee_id) {
      toast.error('Please select an employee');
      return;
    }
    if (!applyForm.start_date || !applyForm.end_date || !applyForm.reason) {
      toast.error('Please fill all fields');
      return;
    }
    setApplying(true);
    try {
      const payload = { ...applyForm };
      // If applying for self, remove employee_id
      if (!canApplyForOthers) {
        delete payload.employee_id;
      }
      await leaveApi.apply(payload);
      toast.success('Leave request submitted');
      setIsApplyModalOpen(false);
      setApplyForm({ employee_id: '', leave_type: 'casual', start_date: '', end_date: '', reason: '' });
      fetchMyData();
      fetchPendingApprovals();
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
        <DialogContent className="sm:max-w-[500px]" data-testid="apply-leave-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white">
                <Calendar className="h-5 w-5" />
              </div>
              Apply for Leave
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            {/* Employee Selection - Only for Country Head/CEO */}
            {canApplyForOthers && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Select Employee <span className="text-red-500">*</span></Label>
                <Select 
                  value={applyForm.employee_id} 
                  onValueChange={(v) => setApplyForm({...applyForm, employee_id: v})}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder={loadingEmployees ? "Loading..." : "Select an employee"} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map(emp => (
                      <SelectItem key={emp.id} value={emp.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{emp.name}</span>
                          <span className="text-gray-400 text-xs">({emp.employee_code || emp.email})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            
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
                <Label className="text-sm font-medium">From Date <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={applyForm.start_date}
                  onChange={(e) => setApplyForm({...applyForm, start_date: e.target.value})}
                  className="h-10"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">To Date <span className="text-red-500">*</span></Label>
                <Input
                  type="date"
                  value={applyForm.end_date}
                  onChange={(e) => setApplyForm({...applyForm, end_date: e.target.value})}
                  className="h-10"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Reason <span className="text-red-500">*</span></Label>
              <textarea
                value={applyForm.reason}
                onChange={(e) => setApplyForm({...applyForm, reason: e.target.value})}
                className="w-full min-h-[80px] px-3 py-2 border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Please provide a reason for the leave request..."
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

// ==================== HOLIDAY CALENDAR ====================
export function HolidayCalendar() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [holidays, setHolidays] = useState([]);
  const [countries, setCountries] = useState([]);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [filterCountry, setFilterCountry] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newHoliday, setNewHoliday] = useState({
    date: '',
    name: '',
    reason: '',
    country_id: ''
  });
  
  // Fetch holidays
  const fetchHolidays = useCallback(async () => {
    setLoading(true);
    try {
      const res = await holidayApi.getAll({ 
        year: filterYear, 
        country_id: filterCountry || undefined 
      });
      setHolidays(res.data || []);
    } catch (e) {
      toast.error('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  }, [filterYear, filterCountry]);
  
  // Fetch countries
  const fetchCountries = useCallback(async () => {
    try {
      const res = await hrApi.getAllCountries();
      setCountries(res.data || []);
    } catch (e) {
      console.error('Failed to load countries');
    }
  }, []);
  
  useEffect(() => {
    fetchCountries();
  }, [fetchCountries]);
  
  useEffect(() => {
    fetchHolidays();
  }, [fetchHolidays]);
  
  // Add new holiday
  const handleAddHoliday = async () => {
    if (!newHoliday.date || !newHoliday.name || !newHoliday.country_id) {
      toast.error('Please fill in all required fields');
      return;
    }
    setSaving(true);
    try {
      await holidayApi.create(newHoliday);
      toast.success('Holiday added successfully');
      setIsAddModalOpen(false);
      setNewHoliday({ date: '', name: '', reason: '', country_id: '' });
      fetchHolidays();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to add holiday');
    } finally {
      setSaving(false);
    }
  };
  
  // Delete holiday
  const handleDeleteHoliday = async (holidayId) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) return;
    try {
      await holidayApi.delete(holidayId);
      toast.success('Holiday deleted');
      fetchHolidays();
    } catch (e) {
      toast.error('Failed to delete holiday');
    }
  };
  
  // Get years for filter
  const years = [new Date().getFullYear(), new Date().getFullYear() + 1, new Date().getFullYear() - 1].sort((a, b) => b - a);
  
  return (
    <div className="p-6" data-testid="holiday-calendar">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-purple-600" />
            Holiday Calendar
          </h2>
          <p className="text-sm text-gray-500">
            Configure organization-wide holidays (country-specific)
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {/* Year Filter */}
          <Select value={String(filterYear)} onValueChange={(v) => setFilterYear(parseInt(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
            </SelectContent>
          </Select>
          
          {/* Country Filter */}
          <Select value={filterCountry || 'all'} onValueChange={(v) => setFilterCountry(v === 'all' ? '' : v)}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Countries" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Countries</SelectItem>
              {countries.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          
          <Button 
            onClick={() => setIsAddModalOpen(true)}
            className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800"
          >
            <Plus className="h-4 w-4 mr-2" /> Add Holiday
          </Button>
        </div>
      </div>
      
      {/* Holidays Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
        </div>
      ) : holidays.length > 0 ? (
        <div className="border rounded-xl overflow-hidden bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Holiday Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600">Country</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {holidays.map((holiday) => {
                const dateObj = new Date(holiday.date);
                const dayName = dateObj.toLocaleDateString('en', { weekday: 'long' });
                const formattedDate = dateObj.toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' });
                
                return (
                  <tr key={holiday.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex flex-col">
                        <span className="font-medium">{formattedDate}</span>
                        <span className="text-xs text-gray-500">{dayName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium text-purple-700">{holiday.name}</td>
                    <td className="px-4 py-3 text-gray-600">{holiday.reason || '-'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs">
                        <Globe className="h-3 w-3 mr-1" />
                        {holiday.country_name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleDeleteHoliday(holiday.id)}
                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <CalendarDays className="h-12 w-12 text-gray-300 mb-3" />
          <p className="font-medium">No holidays configured</p>
          <p className="text-sm">Add holidays to mark organization-wide days off</p>
        </div>
      )}
      
      {/* Add Holiday Modal */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="sm:max-w-[450px]" data-testid="add-holiday-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-purple-600" />
              Add Holiday
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div>
              <Label className="text-sm font-medium">Country *</Label>
              <Select 
                value={newHoliday.country_id} 
                onValueChange={(v) => setNewHoliday({...newHoliday, country_id: v})}
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select country" />
                </SelectTrigger>
                <SelectContent>
                  {countries.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label className="text-sm font-medium">Date *</Label>
              <Input
                type="date"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday({...newHoliday, date: e.target.value})}
                className="mt-1.5"
              />
            </div>
            
            <div>
              <Label className="text-sm font-medium">Holiday Name *</Label>
              <Input
                value={newHoliday.name}
                onChange={(e) => setNewHoliday({...newHoliday, name: e.target.value})}
                placeholder="e.g., Christmas, Diwali"
                className="mt-1.5"
              />
            </div>
            
            <div>
              <Label className="text-sm font-medium">Reason (Optional)</Label>
              <Input
                value={newHoliday.reason}
                onChange={(e) => setNewHoliday({...newHoliday, reason: e.target.value})}
                placeholder="e.g., Festival, National Holiday"
                className="mt-1.5"
              />
            </div>
          </div>
          
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleAddHoliday} 
              disabled={saving}
              className="bg-gradient-to-r from-purple-600 to-purple-700"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Holiday
            </Button>
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


// ==================== INSPECTION CITY MANAGEMENT ====================
export function InspectionCityManagement() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mechanics, setMechanics] = useState([]);
  const [countries, setCountries] = useState([]);
  const [selectedCountryId, setSelectedCountryId] = useState('');
  const [selectedMechanic, setSelectedMechanic] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCities, setSelectedCities] = useState([]);
  const [availableInspectionCities, setAvailableInspectionCities] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Fetch countries and mechanics
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch countries
      const countriesRes = await hrApi.getCountries();
      const countriesData = countriesRes.data || [];
      setCountries(countriesData);
      
      // Set default country from user
      const userCountryId = user?.country_id;
      if (userCountryId && countriesData.find(c => c.id === userCountryId)) {
        setSelectedCountryId(userCountryId);
      } else if (countriesData.length > 0) {
        setSelectedCountryId(countriesData[0].id);
      }
    } catch (error) {
      toast.error('Failed to load countries');
    } finally {
      setLoading(false);
    }
  }, [user?.country_id]);
  
  // Fetch mechanics for selected country
  const fetchMechanics = useCallback(async () => {
    if (!selectedCountryId) return;
    
    try {
      // Fetch employees with MECHANIC role for the selected country
      const response = await hrApi.getEmployees({ country_id: selectedCountryId });
      const employees = response.data || [];
      
      // Filter only mechanics (check role)
      const mechanicEmployees = employees.filter(emp => {
        const roleCode = emp.roles?.[0]?.code || emp.role_code || '';
        return roleCode === 'MECHANIC' || roleCode.toLowerCase().includes('mechanic');
      });
      
      setMechanics(mechanicEmployees);
      
      // Update available inspection cities from selected country
      const selectedCountry = countries.find(c => c.id === selectedCountryId);
      const inspCities = selectedCountry?.inspection_cities || [];
      setAvailableInspectionCities(inspCities);
    } catch (error) {
      toast.error('Failed to load mechanics');
    }
  }, [selectedCountryId, countries]);
  
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  useEffect(() => {
    if (selectedCountryId) {
      fetchMechanics();
    }
  }, [selectedCountryId, fetchMechanics]);
  
  // Open modal to edit mechanic's inspection cities
  const handleEditMechanic = (mechanic) => {
    setSelectedMechanic(mechanic);
    setSelectedCities(mechanic.inspection_cities || []);
    setIsModalOpen(true);
  };
  
  // Save mechanic's inspection cities
  const handleSaveCities = async () => {
    if (!selectedMechanic) return;
    
    setSaving(true);
    try {
      await hrApi.updateInspectionCities(selectedMechanic.id, selectedCities);
      toast.success(`Inspection cities updated for ${selectedMechanic.name}`);
      setIsModalOpen(false);
      fetchMechanics(); // Refresh list
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update inspection cities');
    } finally {
      setSaving(false);
    }
  };
  
  // Toggle city selection
  const toggleCity = (city) => {
    if (selectedCities.includes(city)) {
      setSelectedCities(selectedCities.filter(c => c !== city));
    } else {
      setSelectedCities([...selectedCities, city]);
    }
  };
  
  // Filter mechanics by search term
  const filteredMechanics = mechanics.filter(m => 
    m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    m.employee_id?.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }
  
  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Inspection City Assignment</h2>
          <p className="text-sm text-gray-500">Assign inspection cities to mechanics. Mechanics can only be assigned to inspections in their assigned cities.</p>
        </div>
        
        {/* Country Filter */}
        <div className="flex items-center gap-2">
          <Select value={selectedCountryId} onValueChange={setSelectedCountryId}>
            <SelectTrigger className="w-[180px]">
              <Globe className="h-4 w-4 mr-2 text-gray-500" />
              <SelectValue placeholder="Select Country" />
            </SelectTrigger>
            <SelectContent>
              {countries.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Info Box */}
      {availableInspectionCities.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">No Inspection Cities Configured</p>
            <p className="text-xs text-amber-600 mt-1">
              Please add inspection cities in the Countries tab (Settings → Countries → Edit Country → Inspection Cities tab) before assigning cities to mechanics.
            </p>
          </div>
        </div>
      )}
      
      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input 
          placeholder="Search mechanics by name or email..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-10"
        />
      </div>
      
      {/* Mechanics Table */}
      {filteredMechanics.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed">
          <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No mechanics found</p>
          <p className="text-sm text-gray-400 mt-1">
            {searchTerm ? 'Try a different search term' : 'Add employees with "Mechanic" role to see them here'}
          </p>
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Mechanic</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Employee ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Assigned Cities</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredMechanics.map(mechanic => (
                <tr key={mechanic.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm">
                        {mechanic.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{mechanic.name}</p>
                        <p className="text-xs text-gray-500">{mechanic.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm font-mono text-gray-600">{mechanic.employee_id || '-'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {(mechanic.inspection_cities || []).length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {mechanic.inspection_cities.map((city, idx) => (
                          <span key={idx} className="px-2 py-0.5 bg-purple-100 text-purple-700 text-xs font-medium rounded-full">
                            {city}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400 italic">No cities assigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleEditMechanic(mechanic)}
                      disabled={availableInspectionCities.length === 0}
                      data-testid={`edit-mechanic-cities-${mechanic.id}`}
                    >
                      Edit Cities
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 flex items-center justify-center text-white">
                {selectedMechanic?.name?.charAt(0)?.toUpperCase()}
              </div>
              <div>
                <p className="font-semibold">{selectedMechanic?.name}</p>
                <p className="text-sm font-normal text-gray-500">Assign Inspection Cities</p>
              </div>
            </DialogTitle>
          </DialogHeader>
          
          <div className="py-4 space-y-4">
            <p className="text-sm text-gray-600">
              Select the cities where this mechanic can perform inspections. Only inspections from these cities can be assigned to them.
            </p>
            
            {/* City Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Available Cities</Label>
              {availableInspectionCities.length > 0 ? (
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 bg-slate-50 rounded-lg">
                  {availableInspectionCities.map((city, idx) => {
                    const isSelected = selectedCities.includes(city);
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleCity(city)}
                        className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors border ${
                          isSelected 
                            ? 'bg-purple-600 text-white border-purple-600' 
                            : 'bg-white text-gray-700 border-gray-200 hover:border-purple-400 hover:text-purple-700'
                        }`}
                      >
                        {isSelected && <CheckCircle className="h-3.5 w-3.5 inline mr-1.5" />}
                        {city}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4 bg-slate-50 rounded-lg">
                  No inspection cities available. Add cities in Countries settings.
                </p>
              )}
            </div>
            
            {/* Selected Count */}
            <div className="text-sm text-gray-500">
              {selectedCities.length} {selectedCities.length === 1 ? 'city' : 'cities'} selected
            </div>
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleSaveCities}
              disabled={saving}
              className="bg-gradient-to-r from-purple-600 to-purple-700"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Cities
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
