import React, { useState, useEffect, useCallback } from 'react';
import { loansApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Users, Phone, RefreshCw, Search, Filter, Calendar,
  FileText, CreditCard, Loader2, Eye, UserCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { formatDate, formatDateTime } from '@/utils/dateFormat';

// Import loan components
import {
  CreditScoreModal,
  DocumentsModal,
  VehicleDetailsModal,
  LoanProcessingModal,
  CustomerProfileModal,
  VehicleDropdown,
  StatusBadge,
  AppStatusBadge
} from '@/components/loans';

// Date presets for filter
const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'last_7_days', label: 'Last 7 Days' },
  { key: 'last_14_days', label: 'Last 14 Days' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

const getDateRange = (preset) => {
  const today = new Date();
  let from, to;
  
  switch(preset) {
    case 'today':
      from = to = today.toISOString().split('T')[0];
      break;
    case 'last_7_days':
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(today.getDate() - 6);
      from = sevenDaysAgo.toISOString().split('T')[0];
      to = today.toISOString().split('T')[0];
      break;
    case 'last_14_days':
      const fourteenDaysAgo = new Date(today);
      fourteenDaysAgo.setDate(today.getDate() - 13);
      from = fourteenDaysAgo.toISOString().split('T')[0];
      to = today.toISOString().split('T')[0];
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
    default:
      from = to = '';
  }
  
  return { from, to };
};

// Main Loans Page Component
export default function LoansPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [datePreset, setDatePreset] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;
  
  // Modals
  const [selectedLead, setSelectedLead] = useState(null);
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [processingModalOpen, setProcessingModalOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [creditScoreModalOpen, setCreditScoreModalOpen] = useState(false);
  
  // Status update
  const [statusNotes, setStatusNotes] = useState('');
  const [updatingStatus, setUpdatingStatus] = useState(false);
  
  useEffect(() => {
    fetchLeads();
    fetchStats();
  }, [statusFilter, page]);
  
  const fetchLeads = async () => {
    setLoading(true);
    try {
      const params = { skip: page * pageSize, limit: pageSize };
      if (statusFilter !== 'all') params.status = statusFilter;
      if (searchQuery) params.search = searchQuery;
      
      const res = await loansApi.getAll(params);
      setLeads(res.data.items || res.data.leads || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      toast.error('Failed to fetch loan leads');
    } finally {
      setLoading(false);
    }
  };
  
  const fetchStats = async () => {
    try {
      const res = await loansApi.getStats();
      setStats(res.data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  };
  
  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await loansApi.syncCustomers();
      toast.success(res.data.message);
      fetchLeads();
      fetchStats();
    } catch (err) {
      toast.error('Failed to sync customers');
    } finally {
      setSyncing(false);
    }
  };
  
  const handleSearch = () => {
    setPage(0);
    fetchLeads();
  };
  
  const handleStatusUpdate = async (newStatus) => {
    if (!selectedLead) return;
    
    setUpdatingStatus(true);
    try {
      await loansApi.update(selectedLead.id, {
        status: newStatus,
        status_notes: statusNotes || null
      });
      toast.success('Status updated');
      setStatusModalOpen(false);
      setStatusNotes('');
      fetchLeads();
      fetchStats();
    } catch (err) {
      toast.error('Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };
  
  const openLeadDetails = async (leadId) => {
    try {
      const res = await loansApi.getById(leadId);
      setSelectedLead(res.data);
      return res.data;
    } catch (err) {
      toast.error('Failed to fetch lead details');
      return null;
    }
  };
  
  const refreshSelectedLead = async () => {
    if (selectedLead) {
      await openLeadDetails(selectedLead.id);
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50/50 p-6" data-testid="loans-page">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loans</h1>
          <p className="text-sm text-gray-500 mt-1">Used car loan management for inspection customers</p>
        </div>
        <Button onClick={handleSync} disabled={syncing}>
          {syncing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
          Sync Customers
        </Button>
      </div>
      
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase">Total Leads</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total || 0}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase">Interested</p>
            <p className="text-2xl font-bold text-green-600">{stats.by_status?.INTERESTED || 0}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase">Follow Up</p>
            <p className="text-2xl font-bold text-purple-600">{stats.by_status?.FOLLOW_UP || 0}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase">Call Back</p>
            <p className="text-2xl font-bold text-blue-600">{stats.by_status?.CALL_BACK || 0}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase">Not Interested</p>
            <p className="text-2xl font-bold text-red-600">{stats.by_status?.NOT_INTERESTED || 0}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase">With Credit Score</p>
            <p className="text-2xl font-bold text-gray-700">{stats.with_credit_score || 0}</p>
          </div>
        </div>
      )}
      
      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] max-w-sm">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10"
              />
            </div>
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(0); }}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="NEW">New</SelectItem>
              <SelectItem value="INTERESTED">Interested</SelectItem>
              <SelectItem value="NOT_INTERESTED">Not Interested</SelectItem>
              <SelectItem value="RNR">RNR</SelectItem>
              <SelectItem value="CALL_BACK">Call Back</SelectItem>
              <SelectItem value="FOLLOW_UP">Follow Up</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleSearch}>
            <Filter className="h-4 w-4 mr-2" />
            Apply Filters
          </Button>
        </div>
      </div>
      
      {/* Leads Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : leads.length === 0 ? (
          <div className="text-center py-20">
            <Users className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-500 text-lg">No loan leads found</p>
            <p className="text-gray-400 text-sm mt-1">Click "Sync Customers" to import from inspections</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="text-left p-4 font-medium text-gray-600">Date/Time</th>
                  <th className="text-left p-4 font-medium text-gray-600">Customer</th>
                  <th className="text-left p-4 font-medium text-gray-600">City</th>
                  <th className="text-left p-4 font-medium text-gray-600">Status</th>
                  <th className="text-center p-4 font-medium text-gray-600">Documents</th>
                  <th className="text-center p-4 font-medium text-gray-600">Vehicles</th>
                  <th className="text-center p-4 font-medium text-gray-600">Profile</th>
                  <th className="text-center p-4 font-medium text-gray-600">Credit Score</th>
                  <th className="text-center p-4 font-medium text-gray-600">Loan Processing</th>
                  <th className="text-center p-4 font-medium text-gray-600">Loan Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <p className="text-sm font-medium">{formatDate(lead.created_at)}</p>
                      <p className="text-xs text-gray-500">{formatDateTime(lead.created_at)?.split(',')[1]}</p>
                    </td>
                    <td className="p-4">
                      <p className="font-medium text-gray-900">{lead.customer_name}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Phone className="h-3 w-3" /> {lead.customer_phone}
                      </p>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-gray-600">{lead.city_name || '-'}</span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={async () => {
                          const fullLead = await openLeadDetails(lead.id);
                          if (fullLead) setStatusModalOpen(true);
                        }}
                        className="hover:opacity-80 transition-opacity"
                      >
                        <StatusBadge status={lead.status} />
                      </button>
                      {lead.status_notes && (
                        <p className="text-xs text-gray-500 mt-1 max-w-[150px] truncate" title={lead.status_notes}>
                          {lead.status_notes}
                        </p>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const fullLead = await openLeadDetails(lead.id);
                          if (fullLead) setDocumentsModalOpen(true);
                        }}
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        {lead.documents?.length || 0}
                      </Button>
                    </td>
                    <td className="p-4 text-center">
                      <VehicleDropdown
                        vehicles={lead.vehicles}
                        onManageClick={async () => {
                          const fullLead = await openLeadDetails(lead.id);
                          if (fullLead) setVehicleModalOpen(true);
                        }}
                      />
                    </td>
                    <td className="p-4 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const fullLead = await openLeadDetails(lead.id);
                          if (fullLead) setProfileModalOpen(true);
                        }}
                        className="text-xs"
                        data-testid="profile-btn"
                      >
                        <UserCircle className="h-3 w-3 mr-1" />
                        Profile
                      </Button>
                    </td>
                    <td className="p-4 text-center">
                      {lead.credit_score ? (
                        <button
                          onClick={async () => {
                            const fullLead = await openLeadDetails(lead.id);
                            if (fullLead) setCreditScoreModalOpen(true);
                          }}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-bold ${
                            lead.credit_score >= 750 ? 'bg-green-100 text-green-700 hover:bg-green-200' :
                            lead.credit_score >= 650 ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' :
                            lead.credit_score >= 550 ? 'bg-orange-100 text-orange-700 hover:bg-orange-200' :
                            'bg-red-100 text-red-700 hover:bg-red-200'
                          }`}
                        >
                          {lead.credit_score}
                          <Eye className="h-3 w-3" />
                        </button>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const fullLead = await openLeadDetails(lead.id);
                            if (fullLead) setCreditScoreModalOpen(true);
                          }}
                          className="text-xs"
                        >
                          <CreditCard className="h-3 w-3 mr-1" />
                          Check
                        </Button>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={async () => {
                          const fullLead = await openLeadDetails(lead.id);
                          if (fullLead) setProcessingModalOpen(true);
                        }}
                        disabled={!lead.vehicles?.length}
                      >
                        <CreditCard className="h-3 w-3 mr-1" />
                        Check
                      </Button>
                    </td>
                    <td className="p-4 text-center">
                      {lead.applications?.length > 0 ? (
                        <div className="flex flex-col gap-1">
                          {lead.applications.slice(0, 2).map((app, i) => (
                            <AppStatusBadge key={i} status={app.status} />
                          ))}
                          {lead.applications.length > 2 && (
                            <span className="text-xs text-gray-500">+{lead.applications.length - 2} more</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {/* Pagination */}
        {total > pageSize && (
          <div className="flex items-center justify-between p-4 border-t">
            <p className="text-sm text-gray-500">
              Showing {page * pageSize + 1} - {Math.min((page + 1) * pageSize, total)} of {total}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                Previous
              </Button>
              <Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= total} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
      
      {/* Status Update Modal */}
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Lead Status</DialogTitle>
            <DialogDescription>
              {selectedLead?.customer_name} - {selectedLead?.customer_phone}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-2">
              {['NEW', 'INTERESTED', 'NOT_INTERESTED', 'RNR', 'CALL_BACK', 'FOLLOW_UP'].map((status) => (
                <button
                  key={status}
                  onClick={() => handleStatusUpdate(status)}
                  disabled={updatingStatus}
                  className={`p-3 rounded-lg border-2 text-sm font-medium transition-all ${
                    selectedLead?.status === status
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {status.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            
            <div>
              <Label className="text-sm font-medium">Notes</Label>
              <Input
                placeholder="Add notes about this status change..."
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Documents Modal */}
      <DocumentsModal
        isOpen={documentsModalOpen}
        onClose={() => setDocumentsModalOpen(false)}
        lead={selectedLead}
        onUpdate={refreshSelectedLead}
      />
      
      {/* Vehicle Details Modal */}
      <VehicleDetailsModal
        isOpen={vehicleModalOpen}
        onClose={() => setVehicleModalOpen(false)}
        lead={selectedLead}
        onUpdate={refreshSelectedLead}
      />
      
      {/* Loan Processing Modal */}
      <LoanProcessingModal
        isOpen={processingModalOpen}
        onClose={() => setProcessingModalOpen(false)}
        lead={selectedLead}
        onUpdate={refreshSelectedLead}
      />
      
      {/* Credit Score Modal */}
      <CreditScoreModal
        isOpen={creditScoreModalOpen}
        onClose={() => setCreditScoreModalOpen(false)}
        lead={selectedLead}
        onUpdate={refreshSelectedLead}
      />
      
      {/* Customer Profile Modal */}
      <CustomerProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        lead={selectedLead}
        onUpdate={refreshSelectedLead}
      />
    </div>
  );
}
