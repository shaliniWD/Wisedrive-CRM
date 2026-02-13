import React, { useState, useEffect, useCallback } from 'react';
import { customersApi, utilityApi } from '@/services/api';
import { formatDateTime } from '@/utils/dateFormat';
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
import { Search, X, MoreHorizontal, Pencil, Trash2, Loader2, MessageSquare, Eye } from 'lucide-react';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState('');

  const [formData, setFormData] = useState({
    name: '', mobile: '', city: '', payment_status: 'PENDING', notes: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (filterCity && filterCity !== 'all') params.city = filterCity;

      const [customersRes, citiesRes] = await Promise.all([
        customersApi.getAll(params), utilityApi.getCities(),
      ]);

      setCustomers(customersRes.data);
      setCities(citiesRes.data);
    } catch (error) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [search, filterCity]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.mobile || !formData.city) {
      toast.error('Please fill in required fields');
      return;
    }
    setSaving(true);
    try {
      if (editingCustomer) {
        await customersApi.update(editingCustomer.id, formData);
        toast.success('Customer updated');
      } else {
        await customersApi.create(formData);
        toast.success('Customer created');
      }
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', mobile: '', city: '', payment_status: 'PENDING', notes: '' });
    setEditingCustomer(null);
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name, mobile: customer.mobile, city: customer.city,
      payment_status: customer.payment_status, notes: customer.notes || '',
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-5" data-testid="customers-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>Customers</h1>
          <p className="text-slate-500 mt-1">{customers.length.toLocaleString()} total customers</p>
        </div>
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input placeholder="Search by name or mobile..." value={search} onChange={(e) => setSearch(e.target.value)}
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
        {(search || filterCity) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setFilterCity(''); }} className="text-slate-500">
            <X className="h-4 w-4 mr-1" /> Clear
          </Button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <table className="data-table">
          <thead>
            <tr>
              <th>ID / Date</th>
              <th>Customer</th>
              <th>City</th>
              <th>Payment Status</th>
              <th>Notes</th>
              <th className="w-[100px]">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600" /></td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-slate-500">No customers found</td></tr>
            ) : (
              customers.map((customer, idx) => (
                <tr key={customer.id} data-testid={`customer-row-${customer.id}`}>
                  <td>
                    <div className="font-mono text-sm text-slate-900">{3100 + idx}</div>
                    <div className="text-slate-400 text-xs">{formatDateTime(customer.created_at)}</div>
                  </td>
                  <td>
                    <div className="font-medium text-slate-900">{customer.name}</div>
                    <div className="font-mono text-sm text-slate-500">{customer.mobile}</div>
                  </td>
                  <td className="text-slate-700">{customer.city}</td>
                  <td>
                    <div className="space-y-1">
                      <span className={`badge ${customer.payment_status === 'Completed' ? 'badge-success' : 'badge-warning'}`}>
                        {customer.payment_status}
                      </span>
                      <button className="block text-xs text-indigo-600 hover:underline">
                        <Eye className="h-3 w-3 inline mr-1" />Details
                      </button>
                    </div>
                  </td>
                  <td>
                    <Button size="sm" variant="outline" className="h-7 text-xs border-amber-300 text-amber-600 hover:bg-amber-50">
                      <MessageSquare className="h-3 w-3 mr-1" /> Add Remark
                    </Button>
                  </td>
                  <td>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`customer-actions-${customer.id}`}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditModal(customer)}>
                          <Pencil className="h-4 w-4 mr-2" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-rose-600">
                          <Trash2 className="h-4 w-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[480px]" data-testid="customer-modal">
          <DialogHeader>
            <DialogTitle style={{ fontFamily: 'Outfit, sans-serif' }}>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">Name *</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="h-9" data-testid="customer-name-input" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Mobile *</Label>
                  <Input value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    className="h-9" data-testid="customer-mobile-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm">City *</Label>
                  <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                    <SelectTrigger className="h-9" data-testid="customer-city-select"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">Payment Status</Label>
                  <Select value={formData.payment_status} onValueChange={(v) => setFormData({ ...formData, payment_status: v })}>
                    <SelectTrigger className="h-9" data-testid="customer-payment-select"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="bg-indigo-600 hover:bg-indigo-700" disabled={saving} data-testid="save-customer-button">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
