import React, { useState, useEffect, useCallback } from 'react';
import { inspectionsApi, utilityApi } from '@/services/api';
import { formatDate, formatTime, formatDateTime } from '@/utils/dateFormat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Search, Loader2, ClipboardCheck, Filter, Calendar, MapPin, 
  Car, User, Download, Eye, Edit2, Clock, CheckCircle, XCircle, 
  AlertCircle, Play, Plus, Send, CreditCard, DollarSign, FileText
} from 'lucide-react';

// Inspection Status Badge Component
const InspectionStatusBadge = ({ status }) => {
  const config = {
    NEW_INSPECTION: { color: 'bg-slate-100 text-slate-800 border-slate-200', icon: Plus, label: 'New' },
    ASSIGNED_TO_MECHANIC: { color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: User, label: 'Assigned' },
    INSPECTION_CONFIRMED: { color: 'bg-cyan-100 text-cyan-800 border-cyan-200', icon: CheckCircle, label: 'Confirmed' },
    INSPECTION_STARTED: { color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Play, label: 'Started' },
    INSPECTION_IN_PROGRESS: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: Clock, label: 'In Progress' },
    INSPECTION_COMPLETED: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle, label: 'Completed' },
    SCHEDULED: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Calendar, label: 'Scheduled' },
    UNSCHEDULED: { color: 'bg-purple-100 text-purple-800 border-purple-200', icon: AlertCircle, label: 'Unscheduled' },
    CANCELLED: { color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle, label: 'Cancelled' },
  };
  const cfg = config[status] || config.SCHEDULED;
  const Icon = cfg.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
};

// Payment Status Badge Component
const PaymentStatusBadge = ({ status, balanceDue }) => {
  const config = {
    FULLY_PAID: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle, label: 'Fully Paid' },
    PARTIALLY_PAID: { color: 'bg-amber-100 text-amber-800 border-amber-200', icon: DollarSign, label: `Partial (₹${balanceDue?.toLocaleString() || 0} due)` },
    PAID: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle, label: 'Paid' },
    PENDING: { color: 'bg-red-100 text-red-800 border-red-200', icon: AlertCircle, label: 'Pending' },
  };
  const cfg = config[status] || config.PENDING;
  const Icon = cfg.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
};

// Summary Card Component
const SummaryCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <div className="rounded-xl border bg-white p-5">
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className={`text-2xl font-bold ${color || 'text-gray-900'}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-xl bg-gradient-to-r ${
        color?.includes('emerald') ? 'from-emerald-500 to-emerald-600' : 
        color?.includes('blue') ? 'from-blue-500 to-blue-600' : 
        color?.includes('amber') ? 'from-amber-500 to-amber-600' :
        'from-gray-500 to-gray-600'
      }`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
    </div>
  </div>
);

export default function InspectionsPage() {
  const [inspections, setInspections] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInspection, setEditingInspection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('scheduled');

  // Collect Balance Modal state
  const [isCollectBalanceModalOpen, setIsCollectBalanceModalOpen] = useState(false);
  const [collectBalanceInspection, setCollectBalanceInspection] = useState(null);
  const [collectingBalance, setCollectingBalance] = useState(false);

  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [formData, setFormData] = useState({
    customer_name: '', customer_mobile: '', address: '', city: '',
    payment_status: 'PENDING', inspection_status: 'SCHEDULED',
    mechanic_name: '', car_number: '', car_details: '',
    scheduled_date: '', scheduled_time: '', notes: '',
  });

  // Handle Collect Balance action
  const handleCollectBalance = async () => {
    if (!collectBalanceInspection) return;
    
    setCollectingBalance(true);
    try {
      const response = await inspectionsApi.collectBalance(collectBalanceInspection.id, {
        send_whatsapp: true,
        notes: `Balance collection initiated for inspection ${collectBalanceInspection.id}`
      });
      
      if (response.data?.whatsapp_sent) {
        toast.success(`Payment link (₹${collectBalanceInspection.balance_due?.toLocaleString()}) sent via WhatsApp!`);
      } else {
        toast.success(`Payment link generated: ${response.data?.payment_link}`);
      }
      setIsCollectBalanceModalOpen(false);
      setCollectBalanceInspection(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to generate payment link');
    } finally {
      setCollectingBalance(false);
    }
  };

  // Handle Send Report action
  const handleSendReport = async (inspection) => {
    if (inspection.payment_status !== 'FULLY_PAID' && inspection.payment_status !== 'PAID') {
      toast.error('Cannot send report until full payment is received');
      return;
    }
    
    try {
      await inspectionsApi.sendReport(inspection.id, { send_via_whatsapp: true });
      toast.success('Report sent successfully!');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send report');
    }
  };

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (filterCity && filterCity !== 'all') params.city = filterCity;
      if (filterStatus && filterStatus !== 'all') params.inspection_status = filterStatus;
      params.is_scheduled = activeTab === 'scheduled';

      const [inspectionsRes, citiesRes] = await Promise.all([
        inspectionsApi.getAll(params), utilityApi.getCities(),
      ]);

      setInspections(inspectionsRes.data);
      setCities(citiesRes.data);
    } catch (error) {
      toast.error('Failed to load inspections');
    } finally {
      setLoading(false);
    }
  }, [search, filterCity, filterStatus, activeTab]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.customer_name || !formData.customer_mobile || !formData.city) {
      toast.error('Please fill in required fields');
      return;
    }
    setSaving(true);
    try {
      if (editingInspection) {
        await inspectionsApi.update(editingInspection.id, formData);
        toast.success('Inspection updated');
      } else {
        await inspectionsApi.create(formData);
        toast.success('Inspection created');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to save inspection');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (inspection) => {
    setEditingInspection(inspection);
    setFormData({
      customer_name: inspection.customer_name, customer_mobile: inspection.customer_mobile,
      address: inspection.address, city: inspection.city,
      payment_status: inspection.payment_status, inspection_status: inspection.inspection_status,
      mechanic_name: inspection.mechanic_name || '', car_number: inspection.car_number || '',
      car_details: inspection.car_details || '', scheduled_date: inspection.scheduled_date || '',
      scheduled_time: inspection.scheduled_time || '', notes: inspection.notes || '',
    });
    setIsModalOpen(true);
  };

  const unscheduledCount = inspections.filter(i => !i.scheduled_date).length;
  const scheduledCount = inspections.filter(i => i.scheduled_date).length;
  const completedCount = inspections.filter(i => i.inspection_status === 'COMPLETED').length;

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="inspections-page">
      {/* Page Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Inspections</h1>
          <p className="text-gray-500 mt-1">Manage and track all vehicle inspections</p>
        </div>
        <button
          onClick={() => { setEditingInspection(null); setFormData({ ...formData, customer_name: '', customer_mobile: '', city: '' }); setIsModalOpen(true); }}
          className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/25 transition-all"
        >
          <Plus className="h-4 w-4" /> New Inspection
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
        <SummaryCard title="Total Inspections" value={inspections.length} icon={ClipboardCheck} color="text-blue-700" />
        <SummaryCard title="Scheduled" value={scheduledCount} icon={Calendar} color="text-amber-600" />
        <SummaryCard title="Completed" value={completedCount} icon={CheckCircle} color="text-emerald-600" />
        <SummaryCard title="Unscheduled" value={unscheduledCount} icon={AlertCircle} color="text-purple-600" />
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[300px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by customer name or mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              data-testid="search-input"
            />
          </div>

          <Select value={filterCity || 'all'} onValueChange={setFilterCity}>
            <SelectTrigger className="w-[160px] h-10 bg-white" data-testid="filter-city">
              <MapPin className="h-4 w-4 text-gray-400 mr-2" />
              <SelectValue placeholder="All Cities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>

          <Select value={filterStatus || 'all'} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[180px] h-10 bg-white" data-testid="filter-status">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="SCHEDULED">Scheduled</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="REQUEST_NEWSLOT">Request NewSlot</SelectItem>
            </SelectContent>
          </Select>

          <button 
            onClick={fetchData}
            className="px-4 py-2.5 border rounded-lg hover:bg-gray-50 font-medium text-sm flex items-center gap-2"
          >
            <Filter className="h-4 w-4" /> Apply
          </button>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t">
          <button
            onClick={() => setActiveTab('unscheduled')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'unscheduled' 
                ? 'bg-gray-900 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            data-testid="unscheduled-tab"
          >
            Unscheduled ({unscheduledCount})
          </button>
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'scheduled' 
                ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            data-testid="scheduled-tab"
          >
            Scheduled ({scheduledCount})
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {activeTab === 'unscheduled' ? (
          /* Unscheduled Tab Table */
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Payment Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Package</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Available</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                      <span className="text-gray-500">Loading inspections...</span>
                    </div>
                  </td>
                </tr>
              ) : inspections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <ClipboardCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No unscheduled inspections</p>
                  </td>
                </tr>
              ) : (
                inspections.map((inspection) => (
                  <tr key={inspection.id} className="hover:bg-slate-50 transition-colors" data-testid={`inspection-row-${inspection.id}`}>
                    <td className="px-4 py-4">
                      <div className="text-sm font-medium">{formatDate(inspection.payment_date || inspection.created_at)}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 flex items-center justify-center text-white font-medium text-sm">
                          {inspection.customer_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{inspection.customer_name}</div>
                          <div className="text-sm text-gray-500 font-mono">{inspection.customer_mobile}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-700">{inspection.package_type || 'Standard'}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-blue-100 text-blue-700 font-semibold text-sm">
                        {inspection.inspections_available || 1}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="text-xs space-y-0.5">
                        <div className="text-gray-500">Total: <span className="font-medium text-gray-900">₹{inspection.total_amount || 0}</span></div>
                        <div className="text-gray-500">Paid: <span className="font-medium text-emerald-600">₹{inspection.amount_paid || 0}</span></div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <PaymentBadge status={inspection.payment_type} />
                    </td>
                    <td className="px-4 py-4">
                      <button 
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-xs font-medium hover:from-blue-700 hover:to-blue-800 transition-all shadow-sm"
                        onClick={() => {
                          setEditingInspection(inspection);
                          setFormData({
                            ...formData,
                            customer_name: inspection.customer_name,
                            customer_mobile: inspection.customer_mobile,
                            city: inspection.city,
                            car_number: inspection.car_number || '',
                            payment_status: inspection.payment_status,
                          });
                          setIsModalOpen(true);
                        }}
                        data-testid={`schedule-inspection-${inspection.id}`}
                      >
                        Schedule
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          /* Scheduled Tab Table */
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date/Time</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Vehicle</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Payment Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Inspection Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Location</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                      <span className="text-gray-500">Loading inspections...</span>
                    </div>
                  </td>
                </tr>
              ) : inspections.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12">
                    <ClipboardCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No scheduled inspections</p>
                  </td>
                </tr>
              ) : (
                inspections.map((inspection) => {
                  const isFullyPaid = inspection.payment_status === 'FULLY_PAID' || inspection.payment_status === 'PAID';
                  const hasBalanceDue = inspection.balance_due > 0 && inspection.payment_status === 'PARTIALLY_PAID';
                  const isCompleted = inspection.inspection_status === 'INSPECTION_COMPLETED';
                  const canSendReport = isFullyPaid && isCompleted;
                  
                  return (
                  <tr key={inspection.id} className="hover:bg-slate-50 transition-colors" data-testid={`inspection-row-${inspection.id}`}>
                    <td className="px-4 py-4">
                      <div className="font-medium text-gray-900">{formatDate(inspection.scheduled_date) || '-'}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{formatTime(inspection.scheduled_time)}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium text-sm">
                          {inspection.customer_name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{inspection.customer_name}</div>
                          <div className="text-sm text-gray-500 font-mono">{inspection.customer_mobile}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4 text-gray-400" />
                        <div>
                          <div className="text-sm font-mono text-blue-600">{inspection.car_number || '-'}</div>
                          <div className="text-xs text-gray-400">{inspection.car_make} {inspection.car_model}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <PaymentStatusBadge status={inspection.payment_status} balanceDue={inspection.balance_due} />
                      <div className="text-xs text-gray-500 mt-1">
                        Paid: ₹{(inspection.amount_paid || 0).toLocaleString()}
                        {inspection.balance_due > 0 && (
                          <span className="text-amber-600 ml-1">/ Due: ₹{inspection.balance_due.toLocaleString()}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <InspectionStatusBadge status={inspection.inspection_status} />
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 text-sm text-blue-600">
                        <MapPin className="h-3.5 w-3.5" />
                        {inspection.city}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1">
                        {/* Edit button - always visible for completed inspections */}
                        <button 
                          onClick={() => openEditModal(inspection)} 
                          className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit Inspection"
                          data-testid={`edit-inspection-${inspection.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        
                        {/* Collect Balance button - visible only for partial payments */}
                        {hasBalanceDue && (
                          <button 
                            onClick={() => {
                              setCollectBalanceInspection(inspection);
                              setIsCollectBalanceModalOpen(true);
                            }}
                            className="px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-lg text-xs font-medium hover:from-amber-600 hover:to-amber-700 transition-all shadow-sm flex items-center gap-1"
                            title={`Collect Balance: ₹${inspection.balance_due?.toLocaleString()}`}
                            data-testid={`collect-balance-${inspection.id}`}
                          >
                            <CreditCard className="h-3.5 w-3.5" />
                            Collect ₹{inspection.balance_due?.toLocaleString()}
                          </button>
                        )}
                        
                        {/* Send Report button - disabled until fully paid */}
                        <button 
                          onClick={() => handleSendReport(inspection)}
                          disabled={!canSendReport}
                          className={`p-2 rounded-lg transition-colors ${
                            canSendReport 
                              ? 'text-emerald-500 hover:text-emerald-600 hover:bg-emerald-50' 
                              : 'text-gray-300 cursor-not-allowed'
                          }`}
                          title={canSendReport ? 'Send Report' : 'Full payment required to send report'}
                          data-testid={`send-report-${inspection.id}`}
                        >
                          <Send className="h-4 w-4" />
                        </button>
                        
                        {/* Download Report - if available */}
                        {inspection.report_url && (
                          <a 
                            href={inspection.report_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="p-2 text-blue-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Download Report"
                          >
                            <Download className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                )})
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[560px]" data-testid="inspection-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2">
              <ClipboardCheck className="h-5 w-5 text-blue-600" />
              {editingInspection ? 'Edit Inspection' : 'Schedule Inspection'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Customer Name *</Label>
                <Input value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Mobile *</Label>
                <Input value={formData.customer_mobile} onChange={(e) => setFormData({ ...formData, customer_mobile: e.target.value })} className="h-10 font-mono" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">City *</Label>
                <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                  <SelectTrigger className="h-10"><SelectValue placeholder="Select city" /></SelectTrigger>
                  <SelectContent>{cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Status</Label>
                <Select value={formData.inspection_status} onValueChange={(v) => setFormData({ ...formData, inspection_status: v })}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="REQUEST_NEWSLOT">Request NewSlot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Car Number</Label>
                <Input value={formData.car_number} onChange={(e) => setFormData({ ...formData, car_number: e.target.value })} className="h-10 font-mono" placeholder="KA-01-AB-1234" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Mechanic</Label>
                <Input value={formData.mechanic_name} onChange={(e) => setFormData({ ...formData, mechanic_name: e.target.value })} className="h-10" placeholder="Assign mechanic" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Scheduled Date</Label>
                <Input type="date" value={formData.scheduled_date} onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })} className="h-10" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Scheduled Time</Label>
                <Input type="time" value={formData.scheduled_time} onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })} className="h-10" />
              </div>
            </div>
            <div className="flex gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={saving}
                className="flex-1 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingInspection ? 'Update' : 'Schedule'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Collect Balance Confirmation Modal */}
      <Dialog open={isCollectBalanceModalOpen} onOpenChange={setIsCollectBalanceModalOpen}>
        <DialogContent className="sm:max-w-[440px]" data-testid="collect-balance-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-amber-600" />
              Collect Balance Payment
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-500 mt-2">
              Send a payment link to the customer via WhatsApp to collect the remaining balance.
            </DialogDescription>
          </DialogHeader>
          
          {collectBalanceInspection && (
            <div className="space-y-4 pt-4">
              {/* Customer Info */}
              <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium">
                    {collectBalanceInspection.customer_name?.charAt(0)?.toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-gray-900">{collectBalanceInspection.customer_name}</div>
                    <div className="text-sm text-gray-500 font-mono">{collectBalanceInspection.customer_mobile}</div>
                  </div>
                </div>
                
                <div className="border-t pt-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Package:</span>
                    <span className="font-medium">{collectBalanceInspection.package_type}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Vehicle:</span>
                    <span className="font-medium font-mono">{collectBalanceInspection.car_number || '-'}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total Amount:</span>
                    <span className="font-medium">₹{(collectBalanceInspection.total_amount || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Already Paid:</span>
                    <span className="font-medium text-emerald-600">₹{(collectBalanceInspection.amount_paid || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-sm border-t pt-2 mt-2">
                    <span className="text-gray-700 font-medium">Balance Due:</span>
                    <span className="font-bold text-amber-600 text-lg">₹{(collectBalanceInspection.balance_due || 0).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              
              {/* Info Message */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                <p>A payment link for <strong>₹{(collectBalanceInspection.balance_due || 0).toLocaleString()}</strong> will be generated and sent to the customer via WhatsApp.</p>
              </div>
            </div>
          )}
          
          <DialogFooter className="border-t pt-4 mt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => {
                setIsCollectBalanceModalOpen(false);
                setCollectBalanceInspection(null);
              }}
              disabled={collectingBalance}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleCollectBalance}
              disabled={collectingBalance}
              className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
              data-testid="confirm-collect-balance"
            >
              {collectingBalance && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <Send className="h-4 w-4 mr-2" />
              Send Payment Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
