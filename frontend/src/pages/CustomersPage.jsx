import React, { useState, useEffect, useCallback } from 'react';
import { customersApi, utilityApi } from '@/services/api';
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
import { Search, X, Pencil, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [saving, setSaving] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState('');

  // Form data
  const [formData, setFormData] = useState({
    name: '',
    mobile: '',
    city: '',
    payment_status: 'PENDING',
    notes: '',
  });

  const fetchData = useCallback(async () => {
    try {
      const params = {};
      if (search) params.search = search;
      if (filterCity && filterCity !== 'all') params.city = filterCity;

      const [customersRes, citiesRes] = await Promise.all([
        customersApi.getAll(params),
        utilityApi.getCities(),
      ]);

      setCustomers(customersRes.data);
      setCities(citiesRes.data);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [search, filterCity]);

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
      if (editingCustomer) {
        await customersApi.update(editingCustomer.id, formData);
        toast.success('Customer updated successfully');
      } else {
        await customersApi.create(formData);
        toast.success('Customer created successfully');
      }
      setIsModalOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Failed to save customer:', error);
      toast.error('Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      mobile: '',
      city: '',
      payment_status: 'PENDING',
      notes: '',
    });
    setEditingCustomer(null);
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name,
      mobile: customer.mobile,
      city: customer.city,
      payment_status: customer.payment_status,
      notes: customer.notes || '',
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

  return (
    <div className="space-y-6" data-testid="customers-page">
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

          <Select value={filterCity} onValueChange={setFilterCity}>
            <SelectTrigger className="w-[200px] h-10" data-testid="filter-city">
              <SelectValue placeholder="-- Select City --" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map((city) => (
                <SelectItem key={city} value={city}>{city}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Date range:</Label>
            <Input type="date" className="w-[140px] h-10" />
          </div>

          <Button variant="outline" onClick={() => { setSearch(''); setFilterCity(''); }} className="h-10">
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>

          <Button className="h-10 bg-[#4F46E5] hover:bg-[#4338CA]" data-testid="find-button">
            Find
          </Button>
        </div>

        {/* Stats and Quick Filters */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-lg font-semibold text-foreground font-['Outfit']">
            Customers Count: <span className="text-[#4F46E5]">{customers.length}</span>
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
              <TableHead className="font-semibold">Customer Id</TableHead>
              <TableHead className="font-semibold">Customer</TableHead>
              <TableHead className="font-semibold">City</TableHead>
              <TableHead className="font-semibold">Payment Status</TableHead>
              <TableHead className="font-semibold">Notes</TableHead>
              <TableHead className="font-semibold">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
                </TableCell>
              </TableRow>
            ) : customers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  No customers found
                </TableCell>
              </TableRow>
            ) : (
              customers.map((customer, index) => (
                <TableRow key={customer.id} className="table-row-hover" data-testid={`customer-row-${customer.id}`}>
                  <TableCell>
                    <div className="text-sm">
                      <div className="font-medium">{3100 + index}</div>
                      <div className="text-muted-foreground">{formatDate(customer.created_at)}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">{customer.name}</div>
                      <div className="text-sm text-muted-foreground">{customer.mobile}</div>
                    </div>
                  </TableCell>
                  <TableCell>{customer.city}</TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <Badge className={customer.payment_status === 'Completed' ? 'bg-[#10B981] text-white' : 'bg-[#F59E0B] text-white'}>
                        {customer.payment_status}
                      </Badge>
                      <div className="text-xs text-[#4F46E5] cursor-pointer hover:underline">
                        Details
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button size="sm" variant="outline" className="text-[#F97316] border-[#F97316] hover:bg-[#F97316]/10">
                      Add Remarks
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Button 
                      size="sm" 
                      className="bg-[#6366F1] hover:bg-[#4F46E5]"
                      onClick={() => openEditModal(customer)}
                      data-testid={`edit-customer-${customer.id}`}
                    >
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="customer-modal">
          <DialogHeader>
            <DialogTitle className="font-['Outfit']">
              {editingCustomer ? 'Edit Customer' : 'Add Customer'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    data-testid="customer-name-input"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile</Label>
                  <Input
                    id="mobile"
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    data-testid="customer-mobile-input"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                    <SelectTrigger data-testid="customer-city-select">
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
                  <Label htmlFor="payment_status">Payment Status</Label>
                  <Select value={formData.payment_status} onValueChange={(v) => setFormData({ ...formData, payment_status: v })}>
                    <SelectTrigger data-testid="customer-payment-select">
                      <SelectValue placeholder="Select Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Completed">Completed</SelectItem>
                      <SelectItem value="PENDING">Pending</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  data-testid="customer-notes-input"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-[#4F46E5] hover:bg-[#4338CA]" disabled={saving} data-testid="save-customer-button">
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
