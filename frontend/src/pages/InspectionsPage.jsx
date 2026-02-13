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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Search, X, MoreHorizontal, Pencil, Download, Loader2, FileText, ExternalLink } from 'lucide-react';

const statusConfig = {
  COMPLETED: { label: 'Completed', class: 'badge-success' },
  SCHEDULED: { label: 'Scheduled', class: 'badge-info' },
  IN_PROGRESS: { label: 'In Progress', class: 'badge-warning' },
  REQUEST_NEWSLOT: { label: 'Request Slot', class: 'badge-purple' },
  CANCELLED: { label: 'Cancelled', class: 'badge-danger' },
};

export default function InspectionsPage() {
  const [inspections, setInspections] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInspection, setEditingInspection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('scheduled');

  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const [formData, setFormData] = useState({
    customer_name: '', customer_mobile: '', address: '', city: '',
    payment_status: 'PENDING', inspection_status: 'SCHEDULED',
    mechanic_name: '', car_number: '', car_details: '',
    scheduled_date: '', scheduled_time: '', notes: '',
  });

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
      resetForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to save inspection');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      customer_name: '', customer_mobile: '', address: '', city: '',
      payment_status: 'PENDING', inspection_status: 'SCHEDULED',
      mechanic_name: '', car_number: '', car_details: '',
      scheduled_date: '', scheduled_time: '', notes: '',
    });
    setEditingInspection(null);
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

  return (
    <div className="space-y-5" data-testid="inspections-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Inspections</h1>
          <p className="text-slate-500 mt-1">{inspections.length.toLocaleString()} total inspections</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('unscheduled')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'unscheduled' ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            data-testid="unscheduled-tab"
          >
            Unscheduled ({unscheduledCount})
          </button>
          <button
            onClick={() => setActiveTab('scheduled')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === 'scheduled' ? 'bg-amber-500 text-white' : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
            data-testid="scheduled-tab"
          >
            Scheduled ({scheduledCount})
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-slate-50 border-slate-200" data-testid="search-input" />
        </div>
        <Select value={filterCity} onValueChange={setFilterCity}>
          <SelectTrigger className="w-[150px] h-9 bg-slate-50" data-testid="filter-city">
            <SelectValue placeholder="City" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px] h-9 bg-slate-50" data-testid="filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="REQUEST_NEWSLOT">Request Slot</SelectItem>
          </SelectContent>
        </Select>
        {(search || filterCity || filterStatus) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterCity(''); setFilterStatus(''); }} className="text-slate-500">
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Customer</th>
              <th>Payment</th>
              <th>Location</th>
              <th>Status</th>
              <th>Mechanic</th>
              <th>Car Details</th>
              <th className="w-[140px]">Report</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600" /></td></tr>
            ) : inspections.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-slate-500">No inspections found</td></tr>
            ) : (
              inspections.map((inspection) => (
                <tr key={inspection.id} data-testid={`inspection-row-${inspection.id}`}>
                  <td>
                    <div className="text-slate-900">{formatDate(inspection.scheduled_date) || '—'}</div>
                    <div className="text-slate-400 text-xs">{formatTime(inspection.scheduled_time)}</div>
                  </td>
                  <td>
                    <div className="font-medium text-slate-900">{inspection.customer_name}</div>
                    <div className="font-mono text-sm text-slate-500">{inspection.customer_mobile}</div>
                  </td>
                  <td>
                    <span className={`badge ${inspection.payment_status === 'Completed' ? 'badge-success' : 'badge-warning'}`}>
                      {inspection.payment_status}
                    </span>
                  </td>
                  <td>
                    <button className="text-indigo-600 hover:underline text-sm">
                      {inspection.city}
                      <ExternalLink className="h-3 w-3 inline ml-1" />
                    </button>
                  </td>
                  <td>
                    <div className="space-y-1">
                      <span className={`badge ${statusConfig[inspection.inspection_status]?.class || 'badge-slate'}`}>
                        {statusConfig[inspection.inspection_status]?.label || inspection.inspection_status}
                      </span>
                      <div className="text-xs text-slate-400">{formatDateTime(inspection.created_at)}</div>
                    </div>
                  </td>
                  <td className="text-slate-600">{inspection.mechanic_name || <span className="text-slate-400">—</span>}</td>
                  <td>
                    <div className="font-mono text-sm text-indigo-600">{inspection.car_number}</div>
                    <div className="text-xs text-slate-400 truncate max-w-[120px]">{inspection.car_details}</div>
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      {inspection.report_url ? (
                        <>
                          <Button size="sm" className="h-7 px-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs">
                            <FileText className="h-3 w-3 mr-1" /> View
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 w-7 p-0 border-emerald-300">
                            <Download className="h-3 w-3 text-emerald-600" />
                          </Button>
                        </>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEditModal(inspection)}>
                          <Pencil className="h-3 w-3 mr-1" /> Edit
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

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[560px]" data-testid="inspection-modal">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit, sans-serif' }}>{editingInspection ? 'Edit Inspection' : 'New Inspection'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Customer Name *</Label>
                  <Input value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    className="h-9" data-testid="inspection-name-input" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Mobile *</Label>
                  <Input value={formData.customer_mobile} onChange={(e) => setFormData({ ...formData, customer_mobile: e.target.value })}
                    className="h-9" data-testid="inspection-mobile-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">City *</Label>
                  <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                    <SelectTrigger className="h-9" data-testid="inspection-city-select"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Status</Label>
                  <Select value={formData.inspection_status} onValueChange={(v) => setFormData({ ...formData, inspection_status: v })}>
                    <SelectTrigger className="h-9" data-testid="inspection-status-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="REQUEST_NEWSLOT">Request Slot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Car Number</Label>
                  <Input value={formData.car_number} onChange={(e) => setFormData({ ...formData, car_number: e.target.value })}
                    className="h-9 font-mono" data-testid="inspection-car-input" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Mechanic</Label>
                  <Input value={formData.mechanic_name} onChange={(e) => setFormData({ ...formData, mechanic_name: e.target.value })}
                    className="h-9" data-testid="inspection-mechanic-input" />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={saving} data-testid="save-inspection-button">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
