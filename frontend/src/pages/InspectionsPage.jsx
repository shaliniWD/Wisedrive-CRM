import React, { useState, useEffect, useCallback } from 'react';
import { inspectionsApi, utilityApi } from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Search, X, Pencil, Download, Loader2, FileText } from 'lucide-react';
import { format } from 'date-fns';

const inspectionStatusColors = {
  COMPLETED: 'bg-[#10B981] text-white',
  SCHEDULED: 'bg-[#3B82F6] text-white',
  IN_PROGRESS: 'bg-[#F59E0B] text-white',
  REQUEST_NEWSLOT: 'bg-[#8B5CF6] text-white',
  CANCELLED: 'bg-[#EF4444] text-white',
};

export default function InspectionsPage() {
  const [inspections, setInspections] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInspection, setEditingInspection] = useState(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('scheduled');

  // Filters
  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_mobile: '',
    address: '',
    city: '',
    payment_status: 'PENDING',
    inspection_status: 'SCHEDULED',
    mechanic_name: '',
    car_number: '',
    car_details: '',
    scheduled_date: '',
    scheduled_time: '',
    notes: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (filterCity && filterCity !== 'all') params.city = filterCity;
      if (filterStatus && filterStatus !== 'all') params.inspection_status = filterStatus;
      params.is_scheduled = activeTab === 'scheduled';

      const [inspectionsRes, citiesRes] = await Promise.all([
        inspectionsApi.getAll(params),
        utilityApi.getCities(),
      ]);

      setInspections(inspectionsRes.data);
      setCities(citiesRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load inspections');
    } finally {
      setLoading(false);
    }
  }, [search, filterCity, filterStatus, activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        toast.success('Inspection updated successfully');
      } else {
        await inspectionsApi.create(formData);
        toast.success('Inspection created successfully');
      }
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Failed to save inspection:', error);
      toast.error('Failed to save inspection');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      customer_name: '',
      customer_mobile: '',
      address: '',
      city: '',
      payment_status: 'PENDING',
      inspection_status: 'SCHEDULED',
      mechanic_name: '',
      car_number: '',
      car_details: '',
      scheduled_date: '',
      scheduled_time: '',
      notes: '',
    });
    setEditingInspection(null);
  };

  const openEditModal = (inspection) => {
    setEditingInspection(inspection);
    setFormData({
      customer_name: inspection.customer_name,
      customer_mobile: inspection.customer_mobile,
      address: inspection.address,
      city: inspection.city,
      payment_status: inspection.payment_status,
      inspection_status: inspection.inspection_status,
      mechanic_name: inspection.mechanic_name || '',
      car_number: inspection.car_number || '',
      car_details: inspection.car_details || '',
      scheduled_date: inspection.scheduled_date || '',
      scheduled_time: inspection.scheduled_time || '',
      notes: inspection.notes || '',
    });
    setIsModalOpen(true);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy hh:mm a');
    } catch {
      return dateString;
    }
  };

  const unscheduledCount = inspections.filter(i => !i.scheduled_date).length;

  return (
    <div className="space-y-6" data-testid="inspections-page">
      {/* Filters */}
      <div className="bg-white rounded-xl p-6 shadow-sm border-0">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Name / Mobile Number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10"
                data-testid="search-input"
              />
            </div>
          </div>

          <Select value={filterCity} onValueChange={setFilterCity}>
            <SelectTrigger className="w-[180px] h-10" data-testid="filter-city">
              <SelectValue placeholder="-- Select City --" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[200px] h-10" data-testid="filter-status">
              <SelectValue placeholder="-- Select Inspection Status --" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="SCHEDULED">Scheduled</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
              <SelectItem value="REQUEST_NEWSLOT">Request New Slot</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Date range:</Label>
            <Input type="date" className="w-[140px] h-10" />
          </div>

          <Button variant="outline" onClick={() => { setSearch(''); setFilterCity(''); setFilterStatus(''); }} className="h-10">
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>

          <Button className="h-10 bg-[#4F46E5] hover:bg-[#4338CA]" data-testid="find-button">
            Find
          </Button>
        </div>

        {/* Stats and Tabs */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-lg font-semibold text-foreground font-['Outfit']">
              Inspections Count: <span className="text-[#4F46E5]">{inspections.length}</span>
            </div>
            <div className="flex gap-2">
              <Button 
                variant={activeTab === 'unscheduled' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('unscheduled')}
                className={activeTab === 'unscheduled' ? 'bg-[#1F2937]' : ''}
                data-testid="unscheduled-tab"
              >
                Unscheduled ({unscheduledCount})
              </Button>
              <Button 
                variant={activeTab === 'scheduled' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('scheduled')}
                className={activeTab === 'scheduled' ? 'bg-[#F97316]' : ''}
                data-testid="scheduled-tab"
              >
                Scheduled
              </Button>
            </div>
          </div>
          <div className="flex gap-2 text-sm">
            {['Today', 'This Week', 'This Month', 'This Quarter', 'This Year'].map((period) => (
              <button key={period} className="text-[#4F46E5] hover:underline">
                {period}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border-0 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Inspection Date</TableHead>
              <TableHead className="font-semibold">Customer Details</TableHead>
              <TableHead className="font-semibold">Payment Status</TableHead>
              <TableHead className="font-semibold">Address</TableHead>
              <TableHead className="font-semibold">Inspection Status</TableHead>
              <TableHead className="font-semibold">Mechanic Name</TableHead>
              <TableHead className="font-semibold">Car Details</TableHead>
              <TableHead className="font-semibold">Action</TableHead>
              <TableHead className="font-semibold">Report Edit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : inspections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                  No inspections found
                </TableCell>
              </TableRow>
            ) : (
              inspections.map((inspection) => (
                <TableRow key={inspection.id} className="table-row-hover" data-testid={`inspection-row-${inspection.id}`}>
                  <TableCell className="text-sm">
                    <div>
                      <div>{inspection.scheduled_date || '-'}</div>
                      <div className="text-muted-foreground">{inspection.scheduled_time || '-'}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{inspection.customer_name}</div>
                      <div className="text-sm text-muted-foreground">{inspection.customer_mobile}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={inspection.payment_status === 'Completed' ? 'bg-[#10B981] text-white' : 'bg-[#F59E0B] text-white'}>
                      {inspection.payment_status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-[#4F46E5] cursor-pointer hover:underline">
                      {inspection.city}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge className={inspectionStatusColors[inspection.inspection_status] || 'bg-gray-100 text-gray-800'}>
                        {inspection.inspection_status?.replace(/_/g, ' ')}
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(inspection.created_at)}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{inspection.mechanic_name || '-'}</TableCell>
                  <TableCell>
                    <div>
                      <div className="text-[#4F46E5] cursor-pointer hover:underline">{inspection.car_number}</div>
                      <div className="text-sm text-muted-foreground">{inspection.car_details}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      className="bg-[#6366F1] hover:bg-[#4F46E5]"
                      onClick={() => openEditModal(inspection)}
                      data-testid={`edit-inspection-${inspection.id}`}
                    >
                      Edit
                    </Button>
                  </TableCell>
                  <TableCell>
                    {inspection.report_url ? (
                      <div className="flex flex-col gap-1">
                        <Button size="sm" className="bg-[#10B981] hover:bg-[#059669]">
                          Show Report
                        </Button>
                        <Button size="sm" variant="outline" className="border-[#10B981] text-[#10B981]">
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" className="bg-[#6366F1] hover:bg-[#4F46E5]">
                        Edit Report
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[600px]" data-testid="inspection-modal">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">
              {editingInspection ? 'Edit Inspection' : 'Add Inspection'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="customer_name">Customer Name</Label>
                  <Input
                    id="customer_name"
                    value={formData.customer_name}
                    onChange={(e) => setFormData({ ...formData, customer_name: e.target.value })}
                    data-testid="inspection-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="customer_mobile">Mobile</Label>
                  <Input
                    id="customer_mobile"
                    value={formData.customer_mobile}
                    onChange={(e) => setFormData({ ...formData, customer_mobile: e.target.value })}
                    data-testid="inspection-mobile-input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                    <SelectTrigger data-testid="inspection-city-select">
                      <SelectValue placeholder="Select City" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((city) => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inspection_status">Status</Label>
                  <Select value={formData.inspection_status} onValueChange={(v) => setFormData({ ...formData, inspection_status: v })}>
                    <SelectTrigger data-testid="inspection-status-select">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                      <SelectItem value="COMPLETED">Completed</SelectItem>
                      <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                      <SelectItem value="REQUEST_NEWSLOT">Request New Slot</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="car_number">Car Number</Label>
                  <Input
                    id="car_number"
                    value={formData.car_number}
                    onChange={(e) => setFormData({ ...formData, car_number: e.target.value })}
                    data-testid="inspection-car-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mechanic_name">Mechanic Name</Label>
                  <Input
                    id="mechanic_name"
                    value={formData.mechanic_name}
                    onChange={(e) => setFormData({ ...formData, mechanic_name: e.target.value })}
                    data-testid="inspection-mechanic-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  data-testid="inspection-address-input"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#4F46E5] hover:bg-[#4338CA]" disabled={saving} data-testid="save-inspection-button">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
