import React, { useState, useEffect, useCallback } from 'react';
import { leadsApi, employeesApi, utilityApi } from '@/services/api';
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
import { toast } from 'sonner';
import { Search, Plus, X, Pencil, Calendar, Phone, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const statusColors = {
  NEW: 'bg-blue-100 text-blue-800',
  CONTACTED: 'bg-purple-100 text-purple-800',
  INTERESTED: 'bg-green-100 text-green-800',
  NOT_INTERESTED: 'bg-gray-100 text-gray-800',
  CONVERTED: 'bg-emerald-100 text-emerald-800',
  RNR: 'bg-red-100 text-red-800',
  OUT_OF_SERVICE_AREA: 'bg-orange-100 text-orange-800',
};

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [cities, setCities] = useState([]);
  const [sources, setSources] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [saving, setSaving] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterSource, setFilterSource] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    city: '',
    source: 'WEBSITE',
    status: 'NEW',
    assigned_to: '',
    reminder_date: '',
    reminder_time: '',
    notes: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (filterEmployee && filterEmployee !== 'all') params.assigned_to = filterEmployee;
      if (filterStatus && filterStatus !== 'all') params.status = filterStatus;
      if (filterCity && filterCity !== 'all') params.city = filterCity;
      if (filterSource && filterSource !== 'all') params.source = filterSource;

      const [leadsRes, employeesRes, citiesRes, sourcesRes, statusesRes] = await Promise.all([
        leadsApi.getAll(params),
        employeesApi.getAll(),
        utilityApi.getCities(),
        utilityApi.getLeadSources(),
        utilityApi.getLeadStatuses(),
      ]);

      setLeads(leadsRes.data);
      setEmployees(employeesRes.data);
      setCities(citiesRes.data);
      setSources(sourcesRes.data);
      setStatuses(statusesRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [search, filterEmployee, filterStatus, filterCity, filterSource]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.mobile || !formData.city) {
      toast.error('Please fill in required fields');
      return;
    }

    setSaving(true);
    try {
      if (editingLead) {
        await leadsApi.update(editingLead.id, formData);
        toast.success('Lead updated successfully');
      } else {
        await leadsApi.create(formData);
        toast.success('Lead created successfully');
      }
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Failed to save lead:', error);
      toast.error('Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      mobile: '',
      city: '',
      source: 'WEBSITE',
      status: 'NEW',
      assigned_to: '',
      reminder_date: '',
      reminder_time: '',
      notes: '',
    });
    setEditingLead(null);
  };

  const openEditModal = (lead) => {
    setEditingLead(lead);
    setFormData({
      name: lead.name,
      mobile: lead.mobile,
      city: lead.city,
      source: lead.source,
      status: lead.status,
      assigned_to: lead.assigned_to || '',
      reminder_date: lead.reminder_date || '',
      reminder_time: lead.reminder_time || '',
      notes: lead.notes || '',
    });
    setIsModalOpen(true);
  };

  const clearFilters = () => {
    setSearch('');
    setFilterEmployee('');
    setFilterStatus('');
    setFilterCity('');
    setFilterSource('');
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy hh:mm a');
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6" data-testid="leads-page">
      {/* Filters */}
      <div className="bg-white rounded-xl p-6 shadow-sm border-0">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Customer Name / Mobile Number"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 h-10"
                data-testid="search-input"
              />
            </div>
          </div>

          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="w-[180px] h-10" data-testid="filter-employee">
              <SelectValue placeholder="-- Select Employee --" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.name}>{emp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[160px] h-10" data-testid="filter-status">
              <SelectValue placeholder="-- Select Status --" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statuses.map((status) => (
                <SelectItem key={status} value={status}>{status.replace(/_/g, ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterCity} onValueChange={setFilterCity}>
            <SelectTrigger className="w-[150px] h-10" data-testid="filter-city">
              <SelectValue placeholder="-- Select City --" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-[160px] h-10" data-testid="filter-source">
              <SelectValue placeholder="-- Select Source --" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sources</SelectItem>
              {sources.map((source) => (
                <SelectItem key={source} value={source}>{source}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={clearFilters} className="h-10" data-testid="clear-filters">
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>

          <Button className="h-10 bg-[#4F46E5] hover:bg-[#4338CA]" data-testid="submit-filters">
            Submit
          </Button>

          <Button 
            onClick={() => { resetForm(); setIsModalOpen(true); }} 
            className="h-10 bg-[#22C55E] hover:bg-[#16A34A]"
            data-testid="add-lead-button"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add New
          </Button>
        </div>

        {/* Stats and Quick Filters */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-lg font-semibold text-foreground font-['Outfit']">
            Leads Count: <span className="text-[#4F46E5]">{leads.length}</span>
          </div>
          <div className="flex gap-2 text-sm">
            {['Today', 'This Week', 'This Month', 'This Quarter', 'This Year'].map((period) => (
              <button 
                key={period}
                className="text-[#4F46E5] hover:underline"
              >
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
              <TableHead className="font-semibold">Date</TableHead>
              <TableHead className="font-semibold">Lead Details</TableHead>
              <TableHead className="font-semibold">City</TableHead>
              <TableHead className="font-semibold">Assigned To</TableHead>
              <TableHead className="font-semibold">Reminder</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Source</TableHead>
              <TableHead className="font-semibold">Payment Link</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : leads.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                  No leads found
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => (
                <TableRow key={lead.id} className="table-row-hover" data-testid={`lead-row-${lead.id}`}>
                  <TableCell className="text-sm">
                    {formatDate(lead.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div>
                        <div className="flex items-center gap-1">
                          <span className="font-medium">{lead.mobile}</span>
                          <button 
                            onClick={() => openEditModal(lead)}
                            className="text-muted-foreground hover:text-primary"
                            data-testid={`edit-lead-${lead.id}`}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                        <div className="text-sm text-muted-foreground">{lead.name}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{lead.city}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {lead.assigned_to || '-'}
                      {lead.assigned_to && <Pencil className="h-3 w-3 text-muted-foreground" />}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">
                    {lead.reminder_date ? (
                      <div>
                        <div>Reminder Set on</div>
                        <div>{lead.reminder_date} at {lead.reminder_time}</div>
                        <div className="text-muted-foreground">RNR</div>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          rnr <Pencil className="h-3 w-3" />
                        </div>
                      </div>
                    ) : '-'}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge className={statusColors[lead.status] || 'bg-gray-100 text-gray-800'}>
                        {lead.status?.replace(/_/g, ' ')}
                      </Badge>
                      {lead.status !== 'NEW' && (
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(), 'dd/MM/yyyy')}
                          <br />
                          {format(new Date(), 'hh:mm a')}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{lead.source}</div>
                      {lead.payment_link && (
                        <div className="text-muted-foreground">{lead.payment_link}</div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {lead.payment_link && (
                      <Button size="sm" className="bg-[#FFD700] hover:bg-[#F59E0B] text-black font-medium">
                        Send Pay Link
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="lead-modal">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">
              {editingLead ? 'Edit Lead' : 'Add Lead'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-3 gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Lead Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  data-testid="lead-name-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mobile">Mobile Number</Label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 bg-muted border border-r-0 rounded-l-md text-sm">
                    +91
                  </span>
                  <Input
                    id="mobile"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="rounded-l-none"
                    data-testid="lead-mobile-input"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                  <SelectTrigger data-testid="lead-city-select">
                    <SelectValue placeholder="-- Select --" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((city) => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#4F46E5] hover:bg-[#4338CA]" disabled={saving} data-testid="save-lead-button">
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
