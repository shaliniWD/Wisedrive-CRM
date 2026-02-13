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
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { CustomerDetailsModal } from '@/components/CustomerDetailsModal';
import { toast } from 'sonner';
import { Search, Pencil, Loader2 } from 'lucide-react';

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [cities, setCities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Customer Details Modal state
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

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
      fetchData();
    } catch (error) {
      toast.error('Failed to save customer');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (customer) => {
    setEditingCustomer(customer);
    setFormData({
      name: customer.name, mobile: customer.mobile, city: customer.city,
      payment_status: customer.payment_status, notes: customer.notes || '',
    });
    setIsModalOpen(true);
  };

  const openDetailsModal = (customerId) => {
    setSelectedCustomerId(customerId);
    setIsDetailsModalOpen(true);
  };

  // Pagination calculations
  const totalPages = Math.ceil(customers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCustomers = customers.slice(startIndex, endIndex);

  return (
    <div className="p-4 space-y-4" data-testid="customers-page">
      {/* Search and Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="search-bar flex-1 min-w-[300px]">
          <Search className="h-4 w-4 text-gray-400 mr-2" />
          <input
            placeholder="Customer Name / Mobile Number"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            className="flex-1"
            data-testid="search-input"
          />
        </div>

        <Select value={filterCity} onValueChange={(v) => { setFilterCity(v); setCurrentPage(1); }}>
          <SelectTrigger className="w-[140px] h-10 bg-white" data-testid="filter-city">
            <SelectValue placeholder="-- Select City --" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Date range:</span>
          <Input type="date" className="w-[130px] h-10 bg-white" />
        </div>

        <button className="btn-purple" data-testid="submit-btn">Submit</button>
        <button className="btn-purple" onClick={fetchData} data-testid="find-btn">Find</button>
      </div>

      {/* Customers Count and Quick Filters */}
      <div className="flex items-center justify-between">
        <div className="text-lg font-semibold text-gray-800">
          Customers Count: <span className="text-[#2E3192]">{customers.length.toLocaleString()}</span>
        </div>
        <div className="flex gap-3">
          {['Today', 'This Week', 'This Month', 'This Quarter', 'This Year'].map((period) => (
            <span key={period} className="quick-filter">{period}</span>
          ))}
        </div>
      </div>

      {/* Data Table */}
      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Customer Id</th>
              <th>Customer</th>
              <th>City</th>
              <th>Payment Status</th>
              <th>Notes</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12"><Loader2 className="h-6 w-6 animate-spin mx-auto text-[#2E3192]" /></td></tr>
            ) : paginatedCustomers.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-500">No customers found</td></tr>
            ) : (
              paginatedCustomers.map((customer, idx) => (
                <tr key={customer.id} data-testid={`customer-row-${customer.id}`}>
                  <td>
                    <div className="font-medium">{3100 + startIndex + idx}</div>
                    <div className="text-gray-400 text-xs">{formatDateTime(customer.created_at)}</div>
                  </td>
                  <td>
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-gray-500 font-mono text-sm">{customer.mobile}</div>
                  </td>
                  <td>{customer.city}</td>
                  <td>
                    <div className="space-y-1">
                      <span className={`status-badge ${customer.payment_status === 'Completed' ? 'completed' : 'pending'}`}>
                        {customer.payment_status}
                      </span>
                      <div 
                        className="text-xs text-[#6366F1] cursor-pointer hover:underline"
                        onClick={() => openDetailsModal(customer.id)}
                        data-testid={`details-btn-${customer.id}`}
                      >
                        Details
                      </div>
                    </div>
                  </td>
                  <td>
                    <button className="status-badge orange cursor-pointer text-xs">Add Remarks</button>
                  </td>
                  <td>
                    <button className="btn-purple text-xs px-3 py-1" onClick={() => openEditModal(customer)} data-testid={`edit-customer-${customer.id}`}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        
        {/* Pagination */}
        {!loading && customers.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <div className="text-sm text-gray-600">
              Showing {startIndex + 1} to {Math.min(endIndex, customers.length)} of {customers.length} customers
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <div className="flex items-center gap-1">
                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 text-sm border rounded ${
                        currentPage === pageNum 
                          ? 'bg-[#2E3192] text-white border-[#2E3192]' 
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[480px]" data-testid="customer-modal">
          <DialogHeader>
            <DialogTitle>{editingCustomer ? 'Edit Customer' : 'Add Customer'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Name</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="h-9" data-testid="customer-name-input" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Mobile</Label>
                  <Input value={formData.mobile} onChange={(e) => setFormData({ ...formData, mobile: e.target.value })} className="h-9" data-testid="customer-mobile-input" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">City</Label>
                  <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                    <SelectTrigger className="h-9" data-testid="customer-city-select"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Payment Status</Label>
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
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
              <Button type="submit" className="btn-purple" disabled={saving} data-testid="save-customer-button">
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Customer Details Modal */}
      <CustomerDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        customerId={selectedCustomerId}
      />
    </div>
  );
}
