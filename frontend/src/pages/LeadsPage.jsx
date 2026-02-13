import React, { useState, useEffect, useCallback } from 'react';
import { leadsApi, employeesApi, utilityApi } from '@/services/api';
import { formatDateTime, formatDate, formatTime } from '@/utils/dateFormat';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import { Search, Plus, X, MoreHorizontal, Pencil, Trash2, Loader2, Send } from 'lucide-react';

const statusConfig = {
  NEW: { label: 'New', class: 'badge-info' },
  CONTACTED: { label: 'Contacted', class: 'badge-purple' },
  INTERESTED: { label: 'Interested', class: 'badge-success' },
  NOT_INTERESTED: { label: 'Not Interested', class: 'badge-slate' },
  CONVERTED: { label: 'Converted', class: 'badge-success' },
  RNR: { label: 'RNR', class: 'badge-danger' },
  OUT_OF_SERVICE_AREA: { label: 'Out of Area', class: 'badge-warning' },
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

  const [search, setSearch] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterSource, setFilterSource] = useState('');

  const [formData, setFormData] = useState({
    name: '', mobile: '', city: '', source: 'WEBSITE', status: 'NEW',
    assigned_to: '', reminder_date: '', reminder_time: '', notes: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (filterEmployee && filterEmployee !== 'all') params.assigned_to = filterEmployee;
      if (filterStatus && filterStatus !== 'all') params.lead_status = filterStatus;
      if (filterCity && filterCity !== 'all') params.city = filterCity;
      if (filterSource && filterSource !== 'all') params.source = filterSource;

      const [leadsRes, employeesRes, citiesRes, sourcesRes, statusesRes] = await Promise.all([
        leadsApi.getAll(params), employeesApi.getAll(), utilityApi.getCities(),
        utilityApi.getLeadSources(), utilityApi.getLeadStatuses(),
      ]);

      setLeads(leadsRes.data);
      setEmployees(employeesRes.data);
      setCities(citiesRes.data);
      setSources(sourcesRes.data);
      setStatuses(statusesRes.data);
    } catch (error) {
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [search, filterEmployee, filterStatus, filterCity, filterSource]);

  useEffect(() => { fetchData(); }, [fetchData]);

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
        toast.success('Lead updated');
      } else {
        await leadsApi.create(formData);
        toast.success('Lead created');
      }
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', mobile: '', city: '', source: 'WEBSITE', status: 'NEW',
      assigned_to: '', reminder_date: '', reminder_time: '', notes: '' });
    setEditingLead(null);
  };

  const openEditModal = (lead) => {
    setEditingLead(lead);
    setFormData({ name: lead.name, mobile: lead.mobile, city: lead.city, source: lead.source,
      status: lead.status, assigned_to: lead.assigned_to || '', reminder_date: lead.reminder_date || '',
      reminder_time: lead.reminder_time || '', notes: lead.notes || '' });
    setIsModalOpen(true);
  };

  const clearFilters = () => {
    setSearch(''); setFilterEmployee(''); setFilterStatus(''); setFilterCity(''); setFilterSource('');
  };

  return (
    <div className="space-y-5" data-testid="leads-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Leads</h1>
          <p className="text-slate-500 mt-1">{leads.length.toLocaleString()} total leads</p>
        </div>
        <Button onClick={() => { resetForm(); setIsModalOpen(true); }} className="bg-indigo-600 hover:bg-indigo-700" data-testid="add-lead-button">
          <Plus className="h-4 w-4 mr-2" /> Add Lead
        </Button>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search by name or mobile..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-slate-50 border-slate-200" data-testid="search-input" />
        </div>
        <Select value={filterEmployee} onValueChange={setFilterEmployee}>
          <SelectTrigger className="w-[160px] h-9 bg-slate-50" data-testid="filter-employee">
            <SelectValue placeholder="Employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees.map((emp) => (<SelectItem key={emp.id} value={emp.name}>{emp.name}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[140px] h-9 bg-slate-50" data-testid="filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {statuses.map((s) => (<SelectItem key={s} value={s}>{s.replace(/_/g, ' ')}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={filterCity} onValueChange={setFilterCity}>
          <SelectTrigger className="w-[130px] h-9 bg-slate-50" data-testid="filter-city">
            <SelectValue placeholder="City" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
          </SelectContent>
        </Select>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="w-[130px] h-9 bg-slate-50" data-testid="filter-source">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {sources.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
          </SelectContent>
        </Select>
        {(search || filterEmployee || filterStatus || filterCity || filterSource) && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-slate-500">
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
              <th>Lead Details</th>
              <th>City</th>
              <th>Assigned To</th>
              <th>Reminder</th>
              <th>Status</th>
              <th>Source</th>
              <th className="w-[100px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600" /></td></tr>
            ) : leads.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-12 text-slate-500">No leads found</td></tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead.id} data-testid={`lead-row-${lead.id}`}>
                  <td className="text-slate-600">{formatDateTime(lead.created_at)}</td>
                  <td>
                    <div className="font-mono text-sm text-slate-900">{lead.mobile}</div>
                    <div className="text-slate-500 text-sm">{lead.name}</div>
                  </td>
                  <td className="text-slate-700">{lead.city}</td>
                  <td className="text-slate-600">{lead.assigned_to || <span className="text-slate-400">—</span>}</td>
                  <td className="text-sm">
                    {lead.reminder_date ? (
                      <div className="text-slate-600">
                        <div>{formatDate(lead.reminder_date)}</div>
                        <div className="text-slate-400">{formatTime(lead.reminder_time)}</div>
                      </div>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td>
                    <span className={`badge ${statusConfig[lead.status]?.class || 'badge-slate'}`}>
                      {statusConfig[lead.status]?.label || lead.status}
                    </span>
                  </td>
                  <td>
                    <div className="text-sm text-slate-700">{lead.source}</div>
                    {lead.payment_link && <div className="font-mono text-xs text-slate-400 mt-0.5 truncate max-w-[120px]">{lead.payment_link}</div>}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      {lead.payment_link && (
                        <Button size="sm" className="h-7 px-2 bg-amber-500 hover:bg-amber-600 text-white text-xs">
                          <Send className="h-3 w-3" />
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`lead-actions-${lead.id}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditModal(lead)}>
                            <Pencil className="h-4 w-4 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-rose-600">
                            <Trash2 className="h-4 w-4 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
        <DialogContent className="sm:max-w-[480px]" data-testid="lead-modal">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit, sans-serif' }}>{editingLead ? 'Edit Lead' : 'Add New Lead'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Name *</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Full name" className="h-9" data-testid="lead-name-input" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Mobile *</Label>
                  <div className="flex">
                    <span className="inline-flex items-center px-3 bg-slate-100 border border-r-0 border-slate-200 rounded-l-md text-sm text-slate-500">+91</span>
                    <Input value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      className="rounded-l-none h-9" placeholder="9876543210" data-testid="lead-mobile-input" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">City *</Label>
                  <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                    <SelectTrigger className="h-9" data-testid="lead-city-select"><SelectValue placeholder="Select city" /></SelectTrigger>
                    <SelectContent>{cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Source</Label>
                  <Select value={formData.source} onValueChange={(v) => setFormData({ ...formData, source: v })}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{sources.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={saving} data-testid="save-lead-button">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} {editingLead ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
