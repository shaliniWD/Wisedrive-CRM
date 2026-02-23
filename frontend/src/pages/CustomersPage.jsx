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
import { 
  Search, Loader2, UserCheck, Filter, ChevronLeft, ChevronRight, 
  Plus, MapPin, Phone, User, CreditCard, Package,
  MessageSquare, IndianRupee, AlertCircle, CheckCircle, Calendar,
  Database
} from 'lucide-react';

// Status Badge Component
const PaymentStatusBadge = ({ status }) => {
  const config = {
    Completed: { color: 'bg-emerald-100 text-emerald-700 border-emerald-200', label: 'Paid' },
    PENDING: { color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Pending' },
    Pending: { color: 'bg-amber-100 text-amber-700 border-amber-200', label: 'Pending' },
    PARTIAL_PAID: { color: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Partial' },
  };
  const cfg = config[status] || config.PENDING;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {status === 'Completed' && <CheckCircle className="h-3 w-3" />}
      {status === 'PENDING' && <AlertCircle className="h-3 w-3" />}
      {cfg.label}
    </span>
  );
};

// Summary Card Component
const SummaryCard = ({ title, value, icon: Icon, color, bgColor }) => (
  <div className="rounded-xl border bg-white p-5">
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className={`text-2xl font-bold ${color || 'text-gray-900'}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </div>
      <div className={`p-3 rounded-xl ${bgColor || 'bg-gradient-to-r from-gray-500 to-gray-600'}`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
    </div>
  </div>
);

// Date range preset buttons
const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
];

const getDateRange = (preset) => {
  const today = new Date();
  let from, to;
  
  switch(preset) {
    case 'today':
      from = to = today.toISOString().split('T')[0];
      break;
    case 'week':
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      from = weekStart.toISOString().split('T')[0];
      to = today.toISOString().split('T')[0];
      break;
    case 'month':
      from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      to = today.toISOString().split('T')[0];
      break;
    case 'year':
      from = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
      to = today.toISOString().split('T')[0];
      break;
    default:
      from = to = '';
  }
  
  return { from, to };
};

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [cities, setCities] = useState([]);
  const [salesReps, setSalesReps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [saving, setSaving] = useState(false);
  const [seedingData, setSeedingData] = useState(false);
  
  // Customer Details Modal state
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);

  // Filter states
  const [search, setSearch] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterSalesRep, setFilterSalesRep] = useState('');
  
  // Date filter states
  const [dateRangeType, setDateRangeType] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const [formData, setFormData] = useState({
    name: '', mobile: '', city: '', payment_status: 'PENDING', notes: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (filterCity && filterCity !== 'all') params.city = filterCity;
      if (filterStatus && filterStatus !== 'all') params.payment_status = filterStatus;
      if (filterSalesRep && filterSalesRep !== 'all') params.sales_rep_id = filterSalesRep;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const [customersRes, citiesRes, salesRepsRes] = await Promise.all([
        customersApi.getAll(params), 
        utilityApi.getCities(),
        customersApi.getSalesRepsWithCounts(),
      ]);

      setCustomers(customersRes.data);
      setCities(citiesRes.data);
      setSalesReps(salesRepsRes.data || []);
    } catch (error) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [search, filterCity, filterStatus, filterSalesRep, dateFrom, dateTo]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDatePresetChange = (preset) => {
    setDateRangeType(preset);
    if (preset === 'custom') {
      // Keep current dates for custom
      return;
    }
    if (preset === '') {
      setDateFrom('');
      setDateTo('');
      return;
    }
    const { from, to } = getDateRange(preset);
    setDateFrom(from);
    setDateTo(to);
    setCurrentPage(1);
  };

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

  const handleSeedSampleData = async () => {
    setSeedingData(true);
    try {
      const res = await customersApi.seedSampleData();
      toast.success(`Sample customer "${res.data.customer_name}" created with ${res.data.inspections_created} packages!`);
      fetchData();
    } catch (error) {
      toast.error('Failed to create sample data');
    } finally {
      setSeedingData(false);
    }
  };

  const openEditModal = (customer, e) => {
    if (e) e.stopPropagation();
    setEditingCustomer(customer);
    setFormData({
      name: customer.name, mobile: customer.mobile, city: customer.city,
      payment_status: customer.payment_status, notes: customer.notes || '',
    });
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingCustomer(null);
    setFormData({ name: '', mobile: '', city: '', payment_status: 'PENDING', notes: '' });
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

  // Stats calculations
  const completedCount = customers.filter(c => c.payment_status === 'Completed').length;
  const pendingCount = customers.filter(c => c.payment_status !== 'Completed').length;
  const totalRevenue = customers.reduce((sum, c) => sum + (c.total_paid || 0), 0);

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="customers-page">
      {/* Full Page Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-white/80 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
            <p className="text-sm font-medium text-gray-600">Loading customers...</p>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-500 mt-1">Manage your customer database and payment records</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={handleSeedSampleData}
            disabled={seedingData}
            className="flex items-center gap-2"
            data-testid="seed-sample-btn"
          >
            {seedingData ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            Create Demo Customer
          </Button>
          <button
            onClick={openCreateModal}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/25 transition-all"
            data-testid="add-customer-btn"
          >
            <Plus className="h-4 w-4" /> Add Customer
          </button>
        </div>
      </div>

      {/* Date Range Filter - Above Filters */}
      <div className="bg-white rounded-xl border p-4 mb-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">Date Range:</span>
          <div className="flex items-center gap-2">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.key}
                onClick={() => handleDatePresetChange(preset.key)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  dateRangeType === preset.key 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
            <button
              onClick={() => handleDatePresetChange('')}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                dateRangeType === '' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All Time
            </button>
          </div>
          {dateRangeType === 'custom' && (
            <div className="flex items-center gap-2 ml-4">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                className="h-9 w-36"
              />
              <span className="text-gray-400">to</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                className="h-9 w-36"
              />
            </div>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
        <SummaryCard 
          title="Total Customers" 
          value={customers.length} 
          icon={UserCheck} 
          color="text-blue-700" 
          bgColor="bg-gradient-to-r from-blue-500 to-blue-600"
        />
        <SummaryCard 
          title="Payments Completed" 
          value={completedCount} 
          icon={CheckCircle} 
          color="text-emerald-600" 
          bgColor="bg-gradient-to-r from-emerald-500 to-emerald-600"
        />
        <SummaryCard 
          title="Payments Pending" 
          value={pendingCount} 
          icon={AlertCircle} 
          color="text-amber-600" 
          bgColor="bg-gradient-to-r from-amber-500 to-amber-600"
        />
        <SummaryCard 
          title="Total Revenue" 
          value={`₹${totalRevenue.toLocaleString()}`} 
          icon={IndianRupee} 
          color="text-purple-600" 
          bgColor="bg-gradient-to-r from-purple-500 to-purple-600"
        />
      </div>

      {/* Filters Section */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[250px] relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name or mobile..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              data-testid="search-input"
            />
          </div>

          <Select value={filterCity || 'all'} onValueChange={(v) => { setFilterCity(v === 'all' ? '' : v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[160px] h-10 bg-white" data-testid="filter-city">
              <MapPin className="h-4 w-4 text-gray-400 mr-2" />
              <SelectValue placeholder="All Cities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Cities</SelectItem>
              {cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
            </SelectContent>
          </Select>

          <Select value={filterStatus || 'all'} onValueChange={(v) => { setFilterStatus(v === 'all' ? '' : v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[160px] h-10 bg-white" data-testid="filter-status">
              <CreditCard className="h-4 w-4 text-gray-400 mr-2" />
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterSalesRep || 'all'} onValueChange={(v) => { setFilterSalesRep(v === 'all' ? '' : v); setCurrentPage(1); }}>
            <SelectTrigger className="w-[200px] h-10 bg-white" data-testid="filter-sales-rep">
              <User className="h-4 w-4 text-gray-400 mr-2" />
              <SelectValue placeholder="All Sales Reps" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sales Reps</SelectItem>
              {salesReps.map((rep) => (
                <SelectItem key={rep.id} value={rep.id}>
                  {rep.name} ({rep.customer_count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <button 
            onClick={fetchData}
            className="px-4 py-2.5 border rounded-lg hover:bg-gray-50 font-medium text-sm flex items-center gap-2"
          >
            <Filter className="h-4 w-4" /> Apply
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">City</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <div className="flex items-center gap-1">
                    <CreditCard className="h-3.5 w-3.5" /> Payment
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <div className="flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" /> Packages
                  </div>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Sales Rep</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  <div className="flex items-center gap-1">
                    <MessageSquare className="h-3.5 w-3.5" /> Notes
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                      <span className="text-gray-500">Loading customers...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12">
                    <UserCheck className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No customers found</p>
                    <button
                      onClick={handleSeedSampleData}
                      disabled={seedingData}
                      className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
                    >
                      {seedingData ? 'Creating...' : 'Create demo customer with sample data'}
                    </button>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer) => (
                  <tr 
                    key={customer.id} 
                    className="hover:bg-slate-50 transition-colors cursor-pointer" 
                    data-testid={`customer-row-${customer.id}`}
                    onClick={() => openDetailsModal(customer.id)}
                  >
                    {/* Customer Name & Number */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium text-sm shrink-0">
                          {customer.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{customer.name}</div>
                          <div className="text-sm text-gray-500 font-mono flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {customer.mobile}
                          </div>
                        </div>
                      </div>
                    </td>
                    
                    {/* City */}
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center gap-1.5 text-sm text-gray-700">
                        <MapPin className="h-3.5 w-3.5 text-gray-400" />
                        {customer.city || '-'}
                      </span>
                      {customer.partner_name && customer.partner_name !== 'B2C Default' && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-amber-100 text-amber-800 rounded-full font-medium">
                          {customer.partner_name}
                        </span>
                      )}
                    </td>
                    
                    {/* Payment Details - Single Row */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 flex-wrap">
                        <PaymentStatusBadge status={customer.payment_status} />
                        <span className="text-emerald-600 font-semibold text-sm">₹{(customer.total_paid || 0).toLocaleString()}</span>
                        {(customer.total_pending || 0) > 0 && (
                          <span className="text-red-500 text-xs">+₹{customer.total_pending?.toLocaleString()} due</span>
                        )}
                      </div>
                    </td>
                    
                    {/* Packages */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5">
                        <Package className="h-4 w-4 text-blue-500" />
                        <span className="font-medium text-gray-900">{customer.total_packages || 0}</span>
                      </div>
                    </td>
                    
                    {/* Sales Rep */}
                    <td className="px-4 py-4">
                      {customer.sales_rep_name && customer.sales_rep_name !== 'N/A' ? (
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 text-xs font-medium">
                            {customer.sales_rep_name?.charAt(0)?.toUpperCase()}
                          </div>
                          <span className="text-sm text-gray-700">{customer.sales_rep_name}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">-</span>
                      )}
                    </td>
                    
                    {/* Notes Count */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-1.5 text-sm text-gray-600">
                        <MessageSquare className="h-4 w-4" />
                        <span>{customer.notes_count || 0}</span>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {!loading && customers.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-slate-50">
            <div className="text-sm text-gray-600">
              Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, customers.length)}</span> of <span className="font-medium">{customers.length}</span> customers
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="p-2 border rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
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
                      className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                        currentPage === pageNum 
                          ? 'bg-blue-600 text-white' 
                          : 'hover:bg-white border'
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
                className="p-2 border rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Edit/Create Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="customer-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-blue-600" />
              {editingCustomer ? 'Edit Customer' : 'Add New Customer'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-5 pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  <User className="h-3.5 w-3.5 inline mr-1.5 text-gray-400" />
                  Full Name *
                </Label>
                <Input 
                  value={formData.name} 
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                  className="h-10"
                  placeholder="Enter customer name"
                  data-testid="customer-name-input" 
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  <Phone className="h-3.5 w-3.5 inline mr-1.5 text-gray-400" />
                  Mobile *
                </Label>
                <Input 
                  value={formData.mobile} 
                  onChange={(e) => setFormData({ ...formData, mobile: e.target.value })} 
                  className="h-10 font-mono"
                  placeholder="Enter mobile number"
                  data-testid="customer-mobile-input" 
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  <MapPin className="h-3.5 w-3.5 inline mr-1.5 text-gray-400" />
                  City *
                </Label>
                <Select value={formData.city} onValueChange={(v) => setFormData({ ...formData, city: v })}>
                  <SelectTrigger className="h-10" data-testid="customer-city-select">
                    <SelectValue placeholder="Select city" />
                  </SelectTrigger>
                  <SelectContent>
                    {cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Payment Status</Label>
                <Select value={formData.payment_status} onValueChange={(v) => setFormData({ ...formData, payment_status: v })}>
                  <SelectTrigger className="h-10" data-testid="customer-payment-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="PENDING">Pending</SelectItem>
                  </SelectContent>
                </Select>
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
                data-testid="save-customer-button"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingCustomer ? 'Update Customer' : 'Create Customer'}
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
        onCustomerUpdated={fetchData}
      />
    </div>
  );
}
