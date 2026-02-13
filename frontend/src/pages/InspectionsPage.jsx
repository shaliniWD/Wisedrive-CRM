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
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Search, Pencil, Download, Loader2 } from 'lucide-react';

const statusConfig = {
  COMPLETED: { label: 'Completed', class: 'status-badge completed' },
  SCHEDULED: { label: 'Scheduled', class: 'status-badge scheduled' },
  IN_PROGRESS: { label: 'In Progress', class: 'status-badge yellow' },
  REQUEST_NEWSLOT: { label: 'Request NewSlot', class: 'status-badge request-slot' },
  CANCELLED: { label: 'Cancelled', class: 'status-badge red' },
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

  return (
    <div className="p-4 space-y-4" data-testid="inspections-page">
      {/* Search and Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="search-bar flex-1 min-w-[300px]">
          <Search className="h-4 w-4 text-gray-400 mr-2" />
          <input
            placeholder="Customer Name / Mobile Number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1"
            data-testid="search-input"
          />
        </div>

        <Select value={filterCity} onValueChange={setFilterCity}>
          <SelectTrigger className="w-[140px] h-10 bg-white" data-testid="filter-city">
            <SelectValue placeholder="-- Select City --" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[180px] h-10 bg-white" data-testid="filter-status">
            <SelectValue placeholder="-- Select Insp. Status --" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="REQUEST_NEWSLOT">Request NewSlot</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Date range:</span>
          <Input type="date" className="w-[130px] h-10 bg-white" />
        </div>

        <button className="btn-purple" data-testid="submit-btn">Submit</button>
        <button className="btn-purple" onClick={fetchData} data-testid="find-btn">Find</button>
      </div>

      {/* Inspections Count and Tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-lg font-semibold text-gray-800">
            Inspections Count: <span className="text-[#2E3192]">{inspections.length.toLocaleString()}</span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('unscheduled')}
              className={`tab-btn ${activeTab === 'unscheduled' ? 'active-dark' : ''}`}
              data-testid="unscheduled-tab"
            >
              Unscheduled ({unscheduledCount})
            </button>
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`tab-btn ${activeTab === 'scheduled' ? 'active-orange' : ''}`}
              data-testid="scheduled-tab"
            >
              Scheduled ({scheduledCount})
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          {['Today', 'This Week', 'This Month', 'This Quarter', 'This Year'].map((period) => (
            <span key={period} className="quick-filter">{period}</span>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <div className="card overflow-hidden">
        {activeTab === 'unscheduled' ? (
          /* Unscheduled Tab Table */
          <table className="data-table">
            <thead>
              <tr>
                <th>Payment Date</th>
                <th>Customer Mobile No.</th>
                <th>Customer Name</th>
                <th>Package Type</th>
                <th>Available Inspections</th>
                <th>Amount Details</th>
                <th>Payment Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#2E3192]" /></td></tr>
              ) : inspections.length === 0 ? (
                <tr><td colSpan={8} className="text-center py-12 text-gray-500">No unscheduled inspections found</td></tr>
              ) : (
                inspections.map((inspection) => (
                  <tr key={inspection.id} data-testid={`inspection-row-${inspection.id}`}>
                    <td>
                      <div className="text-sm">{formatDate(inspection.payment_date || inspection.order_date || inspection.created_at)}</div>
                    </td>
                    <td>
                      <div className="font-mono text-sm">{inspection.customer_mobile}</div>
                      <div className="text-gray-500 text-xs">{inspection.customer_name}</div>
                    </td>
                    <td>
                      <div className="font-medium">{inspection.customer_name}</div>
                    </td>
                    <td>
                      <div className="text-sm">{inspection.package_type || '-'}</div>
                    </td>
                    <td>
                      <span className="font-semibold text-[#2E3192]">{inspection.inspections_available || 1}</span>
                    </td>
                    <td>
                      <div className="text-xs space-y-0.5">
                        <div>Total Amount: <span className="font-medium">{inspection.total_amount || 0}</span></div>
                        <div>Amount Paid: <span className="font-medium text-green-600">{inspection.amount_paid || 0}</span></div>
                        <div>Pending Amount: <span className="font-medium text-red-600">{inspection.pending_amount || 0}</span></div>
                      </div>
                    </td>
                    <td>
                      <span className={`status-badge ${inspection.payment_type === 'Full' ? 'completed' : 'pending'}`}>
                        {inspection.payment_type || 'Full'}
                      </span>
                    </td>
                    <td>
                      <button 
                        className="btn-purple text-xs px-3 py-1.5"
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
                        Schedule Inspection
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        ) : (
          /* Scheduled Tab Table */
          <table className="data-table">
            <thead>
              <tr>
                <th>Inspection Date</th>
                <th>Customer Details</th>
                <th>Payment Status</th>
                <th>Address</th>
                <th>Inspection Status</th>
                <th>Mechanic Name</th>
                <th>Car Details</th>
                <th>Action</th>
                <th>Report Edit</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={9} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#2E3192]" /></td></tr>
              ) : inspections.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-12 text-gray-500">No scheduled inspections found</td></tr>
              ) : (
                inspections.map((inspection) => (
                  <tr key={inspection.id} data-testid={`inspection-row-${inspection.id}`}>
                    <td>
                      <div>{formatDate(inspection.scheduled_date) || '-'}</div>
                      <div className="text-gray-400 text-xs">{formatTime(inspection.scheduled_time)}</div>
                    </td>
                    <td>
                      <div className="font-medium">{inspection.customer_name}</div>
                      <div className="text-gray-500 font-mono text-sm">{inspection.customer_mobile}</div>
                    </td>
                    <td>
                      <span className={`status-badge ${inspection.payment_status === 'Completed' ? 'completed' : 'pending'}`}>
                        {inspection.payment_status}
                      </span>
                    </td>
                    <td>
                      <span className="text-[#6366F1] cursor-pointer hover:underline">{inspection.city}</span>
                    </td>
                    <td>
                      <span className={statusConfig[inspection.inspection_status]?.class || 'status-badge'}>
                        {statusConfig[inspection.inspection_status]?.label || inspection.inspection_status}
                      </span>
                      <div className="text-xs text-gray-400 mt-1">{formatDateTime(inspection.created_at)}</div>
                    </td>
                    <td>{inspection.mechanic_name || '-'}</td>
                    <td>
                      <div className="text-[#6366F1] font-mono text-sm">{inspection.car_number}</div>
                      <div className="text-xs text-gray-400">{inspection.car_details}</div>
                    </td>
                    <td>
                      <button className="btn-purple text-xs px-3 py-1" onClick={() => openEditModal(inspection)} data-testid={`edit-inspection-${inspection.id}`}>
                        Edit
                      </button>
                    </td>
                    <td>
                      {inspection.report_url ? (
                        <div className="flex flex-col gap-1">
                          <button className="status-badge completed text-xs cursor-pointer">Show Report</button>
                          <button className="text-[#10B981] text-xs flex items-center gap-1">
                            <Download className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button className="btn-purple text-xs px-3 py-1">Edit Report</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[560px]" data-testid="inspection-modal">
          <DialogHeader>
            <DialogTitle>{editingInspection ? 'Edit Inspection' : 'New Inspection'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Customer Name</Label>
                  <Input value={formData.customer_name} onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })} className="h-9" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mobile</Label>
                  <Input value={formData.customer_mobile} onChange={(e) => setFormData({ ...formData, customer_mobile: e.target.value })} className="h-9" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">City</Label>
                  <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Status</Label>
                  <Select value={formData.inspection_status} onValueChange={(v) => setFormData({ ...formData, inspection_status: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
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
                <div className="space-y-1">
                  <Label className="text-xs">Car Number</Label>
                  <Input value={formData.car_number} onChange={(e) => setFormData({ ...formData, car_number: e.target.value })} className="h-9 font-mono" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mechanic</Label>
                  <Input value={formData.mechanic_name} onChange={(e) => setFormData({ ...formData, mechanic_name: e.target.value })} className="h-9" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="btn-purple" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
