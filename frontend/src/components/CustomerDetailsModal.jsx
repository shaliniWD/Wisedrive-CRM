import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { customersApi } from '@/services/api';
import { formatDateTime } from '@/utils/dateFormat';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Loader2, X, User, Phone, MapPin, CreditCard, Package, 
  FileText, Clock, CheckCircle, ChevronDown, ChevronUp,
  Send, Edit2, Save, MessageSquare, Activity, Mail, Home,
  ExternalLink, AlertCircle, Megaphone, Trash2, Eye, Car,
  Calendar, Wrench, Plus
} from 'lucide-react';

// Status Badge Component
const StatusBadge = ({ status, type = 'payment' }) => {
  const paymentConfig = {
    'FULLY_PAID': { color: 'bg-emerald-100 text-emerald-700', label: 'Fully Paid' },
    'Completed': { color: 'bg-emerald-100 text-emerald-700', label: 'Paid' },
    'PARTIAL_PAID': { color: 'bg-amber-100 text-amber-700', label: 'Partial' },
    'PENDING': { color: 'bg-red-100 text-red-700', label: 'Pending' },
    'completed': { color: 'bg-emerald-100 text-emerald-700', label: 'Paid' },
    'pending': { color: 'bg-amber-100 text-amber-700', label: 'Pending' },
  };
  
  const inspectionConfig = {
    'INSPECTION_COMPLETED': { color: 'bg-emerald-100 text-emerald-700', label: 'Completed' },
    'INSPECTION_IN_PROGRESS': { color: 'bg-blue-100 text-blue-700', label: 'In Progress' },
    'SCHEDULED': { color: 'bg-purple-100 text-purple-700', label: 'Scheduled' },
    'ASSIGNED_TO_MECHANIC': { color: 'bg-indigo-100 text-indigo-700', label: 'Assigned' },
    'NEW_INSPECTION': { color: 'bg-gray-100 text-gray-700', label: 'New' },
  };
  
  const config = type === 'inspection' ? inspectionConfig : paymentConfig;
  const cfg = config[status] || { color: 'bg-gray-100 text-gray-700', label: status?.replace(/_/g, ' ') || 'Unknown' };
  
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  );
};

// Package Card Component with enhanced details
const PackageCard = ({ pkg, isExpanded, onToggle, onViewReport }) => {
  return (
    <div className="border rounded-lg overflow-hidden bg-white" data-testid={`package-card-${pkg.inspection_id}`}>
      <div className="p-4 cursor-pointer hover:bg-gray-50 transition-colors" onClick={onToggle}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <Package className="h-4 w-4 text-blue-600" />
              <span className="font-semibold text-gray-900">{pkg.package_name}</span>
              <StatusBadge status={pkg.payment_status} />
              <StatusBadge status={pkg.inspection_status} type="inspection" />
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <Car className="h-3.5 w-3.5" />
                {pkg.car_info}
              </span>
              {pkg.car_number !== 'N/A' && (
                <span className="font-mono text-xs bg-gray-100 px-1.5 py-0.5 rounded">{pkg.car_number}</span>
              )}
            </div>
          </div>
          <div className="text-right flex items-center gap-3">
            {/* Payment info - Single Row */}
            <div className="flex items-center gap-2">
              <span className="text-emerald-600 font-bold">₹{pkg.amount_paid?.toLocaleString()}</span>
              {pkg.balance_due > 0 && (
                <span className="text-red-500 text-sm">+ ₹{pkg.balance_due?.toLocaleString()} due</span>
              )}
            </div>
            {/* View Report Button */}
            {pkg.has_report && (
              <Button
                size="sm"
                variant="outline"
                onClick={(e) => { e.stopPropagation(); onViewReport(pkg.inspection_id); }}
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <Eye className="h-3.5 w-3.5 mr-1" /> Report
              </Button>
            )}
            <button className="p-1 hover:bg-gray-100 rounded">
              {isExpanded ? <ChevronUp className="h-5 w-5 text-gray-400" /> : <ChevronDown className="h-5 w-5 text-gray-400" />}
            </button>
          </div>
        </div>
        
        {/* Quick Info Row */}
        <div className="flex items-center gap-4 mt-3 pt-3 border-t text-xs text-gray-500 flex-wrap">
          <div className="flex items-center gap-1">
            <User className="h-3.5 w-3.5" />
            <span>Rep: {pkg.sales_rep_name}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{formatDateTime(pkg.created_at)}</span>
          </div>
          {pkg.scheduled_date && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              <span>Scheduled: {pkg.scheduled_date} {pkg.scheduled_time}</span>
            </div>
          )}
          {pkg.mechanic_name && (
            <div className="flex items-center gap-1">
              <Wrench className="h-3.5 w-3.5" />
              <span>{pkg.mechanic_name}</span>
            </div>
          )}
          <div className="flex items-center gap-1">
            <CheckCircle className="h-3.5 w-3.5" />
            <span>Used: {pkg.inspections_used}/{pkg.inspections_total}</span>
          </div>
        </div>
      </div>
      
      {/* Expanded Details */}
      {isExpanded && (
        <div className="border-t bg-slate-50 p-4">
          <h4 className="text-xs font-semibold text-gray-600 uppercase mb-3">Payment Transactions</h4>
          {pkg.payments && pkg.payments.length > 0 ? (
            <div className="space-y-2">
              {pkg.payments.map((payment, idx) => (
                <div key={payment.id || idx} className="flex items-center justify-between p-3 bg-white rounded-lg border text-sm">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-gray-400" />
                      <span className="font-medium">₹{payment.amount?.toLocaleString()}</span>
                      <StatusBadge status={payment.status} />
                      <span className="text-xs text-gray-400 capitalize">{payment.type}</span>
                    </div>
                    <div className="mt-1 text-xs text-gray-500 flex items-center gap-3 flex-wrap">
                      <span>{formatDateTime(payment.date)}</span>
                      <span>•</span>
                      <span>{payment.mode}</span>
                      {payment.payment_reference && payment.payment_reference !== '-' && (
                        <>
                          <span>•</span>
                          <span className="font-mono">{payment.payment_reference.slice(0, 16)}...</span>
                        </>
                      )}
                    </div>
                  </div>
                  {payment.payment_link && (
                    <a href={payment.payment_link} target="_blank" rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-700 text-xs flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 text-sm">No payment transactions recorded</div>
          )}
          
          {/* Usage Progress */}
          <div className="mt-4 pt-4 border-t">
            <div className="flex justify-between text-xs text-gray-600 mb-1">
              <span>Inspection Usage</span>
              <span>{pkg.inspections_used} of {pkg.inspections_total} used</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all ${pkg.inspections_used >= pkg.inspections_total ? 'bg-emerald-500' : 'bg-blue-500'}`}
                style={{ width: `${(pkg.inspections_used / pkg.inspections_total) * 100}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Note Card Component with edit/delete
const NoteCard = ({ note, onEdit, onDelete, isEditing, editValue, setEditValue, onSaveEdit, onCancelEdit, saving }) => {
  if (isEditing) {
    return (
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
        <Textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="min-h-[80px] bg-white"
          autoFocus
        />
        <div className="mt-2 flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onCancelEdit}>Cancel</Button>
          <Button size="sm" onClick={onSaveEdit} disabled={saving}>
            {saving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
            Save
          </Button>
        </div>
      </div>
    );
  }
  
  return (
    <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg group" data-testid={`note-${note.id}`}>
      <div className="flex justify-between items-start">
        <p className="text-sm text-gray-800 whitespace-pre-wrap flex-1">{note.note}</p>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEdit(note)} className="p-1 hover:bg-yellow-100 rounded text-gray-500 hover:text-blue-600">
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => onDelete(note.id)} className="p-1 hover:bg-yellow-100 rounded text-gray-500 hover:text-red-600">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
        <span className="font-medium">{note.user_name}</span>
        <span>•</span>
        <span>{formatDateTime(note.created_at)}</span>
        {note.updated_at && <span className="italic">(edited)</span>}
      </div>
    </div>
  );
};

export function CustomerDetailsModal({ isOpen, onClose, customerId, onCustomerUpdated }) {
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [paymentData, setPaymentData] = useState(null);
  const [notes, setNotes] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  
  // Edit customer state
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [saving, setSaving] = useState(false);
  
  // Notes state
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editNoteValue, setEditNoteValue] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  
  // Package expansion state
  const [expandedPackages, setExpandedPackages] = useState({});
  
  // Repair state
  const [repairing, setRepairing] = useState(false);

  const fetchCustomerDetails = useCallback(async () => {
    if (!customerId) return;
    
    setLoading(true);
    try {
      const [customerRes, paymentsRes, notesRes, activitiesRes] = await Promise.all([
        customersApi.getById(customerId),
        customersApi.getDetailedPayments(customerId),
        customersApi.getNotes(customerId),
        customersApi.getActivities(customerId),
      ]);
      
      setCustomer(customerRes.data);
      
      // Transform payment data to expected format
      const rawPaymentData = paymentsRes.data;
      const transformedPaymentData = {
        ...rawPaymentData,
        // Flatten summary fields to root level for easier access
        total_paid: rawPaymentData?.summary?.total_paid || 0,
        total_pending: rawPaymentData?.summary?.total_pending || 0,
        total_amount: rawPaymentData?.summary?.total_amount || 0,
        total_inspections: rawPaymentData?.summary?.total_inspections || 0,
        // Map inspections to packages for backward compatibility
        packages: rawPaymentData?.inspections || [],
      };
      setPaymentData(transformedPaymentData);
      
      setNotes(notesRes.data || []);
      setActivities(activitiesRes.data || []);
      setEditForm({
        name: customerRes.data.name || '',
        mobile: customerRes.data.mobile || '',
        city: customerRes.data.city || '',
        email: customerRes.data.email || '',
        address: customerRes.data.address || '',
      });
    } catch (error) {
      console.error('Failed to fetch customer details:', error);
      toast.error('Failed to load customer details');
    } finally {
      setLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    if (isOpen && customerId) {
      fetchCustomerDetails();
      setActiveTab('overview');
      setIsEditing(false);
      setExpandedPackages({});
      setEditingNoteId(null);
    }
  }, [isOpen, customerId, fetchCustomerDetails]);

  const handleSaveCustomer = async () => {
    setSaving(true);
    try {
      await customersApi.update(customerId, editForm);
      setCustomer(prev => ({ ...prev, ...editForm }));
      setIsEditing(false);
      toast.success('Customer updated');
      if (onCustomerUpdated) onCustomerUpdated();
    } catch (error) {
      toast.error('Failed to update customer');
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    
    setAddingNote(true);
    try {
      const res = await customersApi.addNote(customerId, newNote.trim());
      setNotes(prev => [res.data, ...prev]);
      setNewNote('');
      toast.success('Note added');
      const activitiesRes = await customersApi.getActivities(customerId);
      setActivities(activitiesRes.data || []);
    } catch (error) {
      toast.error('Failed to add note');
    } finally {
      setAddingNote(false);
    }
  };

  const handleEditNote = (note) => {
    setEditingNoteId(note.id);
    setEditNoteValue(note.note);
  };

  const handleSaveNoteEdit = async () => {
    if (!editNoteValue.trim()) return;
    
    setSavingNote(true);
    try {
      const res = await customersApi.updateNote(customerId, editingNoteId, editNoteValue.trim());
      setNotes(prev => prev.map(n => n.id === editingNoteId ? res.data : n));
      setEditingNoteId(null);
      setEditNoteValue('');
      toast.success('Note updated');
      const activitiesRes = await customersApi.getActivities(customerId);
      setActivities(activitiesRes.data || []);
    } catch (error) {
      toast.error('Failed to update note');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId) => {
    if (!confirm('Delete this note?')) return;
    
    try {
      await customersApi.deleteNote(customerId, noteId);
      setNotes(prev => prev.filter(n => n.id !== noteId));
      toast.success('Note deleted');
      const activitiesRes = await customersApi.getActivities(customerId);
      setActivities(activitiesRes.data || []);
    } catch (error) {
      toast.error('Failed to delete note');
    }
  };

  const handleViewReport = (inspectionId) => {
    navigate(`/inspection-report/${inspectionId}`);
    onClose();
  };

  const handleRepairData = async () => {
    if (!customer?.id) return;
    
    setRepairing(true);
    try {
      const response = await customersApi.repair(customer.id);
      const result = response.data;
      
      if (result.inspections_linked > 0 || result.inspections_created > 0) {
        toast.success(`Repaired: ${result.inspections_linked} linked, ${result.inspections_created} created`);
        // Refresh customer data
        fetchCustomerDetails();
        if (onCustomerUpdated) onCustomerUpdated();
      } else {
        toast.info('No issues found to repair');
      }
    } catch (error) {
      console.error('Failed to repair customer data:', error);
      toast.error(error.response?.data?.detail || 'Failed to repair customer data');
    } finally {
      setRepairing(false);
    }
  };

  const togglePackageExpand = (inspectionId) => {
    setExpandedPackages(prev => ({ ...prev, [inspectionId]: !prev[inspectionId] }));
  };

  const getActivityIcon = (action) => {
    switch(action) {
      case 'note_added': return <FileText className="h-4 w-4 text-blue-500" />;
      case 'note_updated': return <Edit2 className="h-4 w-4 text-purple-500" />;
      case 'note_deleted': return <Trash2 className="h-4 w-4 text-red-500" />;
      case 'payment_received': return <CreditCard className="h-4 w-4 text-emerald-500" />;
      case 'customer_updated': return <Edit2 className="h-4 w-4 text-purple-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  // Editable field component
  const EditableField = ({ label, icon: Icon, value, field, type = 'text' }) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-gray-500 uppercase flex items-center gap-1">
        {Icon && <Icon className="h-3.5 w-3.5" />} {label}
      </Label>
      {isEditing ? (
        <Input 
          type={type}
          value={editForm[field] || ''} 
          onChange={(e) => setEditForm({...editForm, [field]: e.target.value})}
          className="h-9"
          data-testid={`edit-${field}-input`}
        />
      ) : (
        <div className="px-3 py-2 bg-gray-50 rounded border text-sm min-h-[36px]">
          {value || '-'}
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[850px] max-h-[90vh] p-0 overflow-hidden flex flex-col" data-testid="customer-details-modal">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#2E3192] to-[#1BBBCE] text-white px-6 py-4 flex justify-between items-center shrink-0">
          <DialogTitle className="text-lg font-semibold text-white m-0 flex items-center gap-2">
            <User className="h-5 w-5" />
            Customer Details
          </DialogTitle>
          <div className="flex items-center gap-3">
            {!isEditing ? (
              <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}
                className="text-white/90 hover:text-white hover:bg-white/20" data-testid="edit-customer-btn">
                <Edit2 className="h-4 w-4 mr-1.5" /> Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}
                  className="text-white/90 hover:text-white hover:bg-white/20">Cancel</Button>
                <Button size="sm" onClick={handleSaveCustomer} disabled={saving}
                  className="bg-white text-blue-600 hover:bg-white/90" data-testid="save-customer-btn">
                  {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                  <Save className="h-4 w-4 mr-1.5" /> Save
                </Button>
              </div>
            )}
            <button onClick={onClose} className="text-white/80 hover:text-white transition-colors" data-testid="close-modal-btn">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#2E3192]" />
          </div>
        ) : customer ? (
          <div className="flex-1 overflow-hidden flex flex-col">
            {/* Customer Quick Info Bar */}
            <div className="px-6 py-3 bg-slate-50 border-b flex items-center justify-between shrink-0">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-blue-600 flex items-center justify-center text-white font-medium">
                  {(isEditing ? editForm.name : customer.name)?.charAt(0)?.toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-gray-900">{isEditing ? editForm.name : customer.name}</div>
                  <div className="text-sm text-gray-500 font-mono">{isEditing ? editForm.mobile : customer.mobile}</div>
                  <div className="text-xs text-gray-400 font-mono mt-0.5">ID: {customer.id?.slice(0, 8)}...</div>
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm">
                <div className="text-right">
                  <div className="text-gray-500">Total Paid</div>
                  <div className="font-bold text-emerald-600">₹{paymentData?.total_paid?.toLocaleString() || 0}</div>
                </div>
                {(paymentData?.total_pending || 0) > 0 && (
                  <div className="text-right">
                    <div className="text-gray-500">Pending</div>
                    <div className="font-bold text-red-600">₹{paymentData?.total_pending?.toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>
            
            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="px-6 pt-2 pb-0 bg-white border-b shrink-0 justify-start rounded-none h-auto">
                <TabsTrigger value="overview" className="rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent" data-testid="tab-overview">
                  <User className="h-4 w-4 mr-1.5" /> Overview
                </TabsTrigger>
                <TabsTrigger value="packages" className="rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent" data-testid="tab-packages">
                  <Package className="h-4 w-4 mr-1.5" /> Packages ({paymentData?.packages?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="notes" className="rounded-t-lg rounded-b-none border-b-2 border-transparent data-[state=active]:border-blue-600 data-[state=active]:bg-transparent" data-testid="tab-notes">
                  <MessageSquare className="h-4 w-4 mr-1.5" /> Notes ({notes.length})
                </TabsTrigger>
              </TabsList>
              
              {/* Overview Tab */}
              <TabsContent value="overview" className="flex-1 overflow-y-auto p-6 mt-0">
                {/* Meta/Ad Source Info */}
                {paymentData?.meta_info && paymentData.meta_info.source && (
                  <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-100">
                    <h4 className="text-sm font-semibold text-purple-800 mb-2 flex items-center gap-2">
                      <Megaphone className="h-4 w-4" /> Lead Source
                    </h4>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-gray-500">Source:</span>
                        <span className="ml-2 font-medium">{paymentData.meta_info.source}</span>
                      </div>
                      {paymentData.meta_info.ad_id && (
                        <div>
                          <span className="text-gray-500">Ad ID:</span>
                          <span className="ml-2 font-mono text-xs bg-white px-1.5 py-0.5 rounded">{paymentData.meta_info.ad_id}</span>
                        </div>
                      )}
                      {paymentData.meta_info.ad_name && (
                        <div>
                          <span className="text-gray-500">Ad Name:</span>
                          <span className="ml-2 font-medium">{paymentData.meta_info.ad_name}</span>
                        </div>
                      )}
                      {paymentData.meta_info.campaign_name && (
                        <div>
                          <span className="text-gray-500">Campaign:</span>
                          <span className="ml-2 font-medium">{paymentData.meta_info.campaign_name}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
                
                <h3 className="font-semibold text-gray-700 mb-4">Customer Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <EditableField label="Full Name" icon={User} value={customer.name} field="name" />
                  <EditableField label="Mobile Number" icon={Phone} value={customer.mobile} field="mobile" />
                  <EditableField label="City" icon={MapPin} value={customer.city} field="city" />
                  <EditableField label="Email" icon={Mail} value={customer.email} field="email" type="email" />
                  <div className="col-span-2">
                    <EditableField label="Address" icon={Home} value={customer.address} field="address" />
                  </div>
                </div>
                
                {/* Sales Rep Info */}
                {paymentData?.original_sales_rep && (
                  <div className="mt-6 pt-4 border-t">
                    <h4 className="text-sm font-semibold text-gray-600 mb-2">Sales Representative</h4>
                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                      <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                        {paymentData.original_sales_rep.name?.charAt(0)?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{paymentData.original_sales_rep.name}</div>
                        <div className="text-xs text-gray-500">Converted this lead</div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Quick Stats */}
                <div className="mt-6 pt-4 border-t">
                  <h4 className="text-sm font-semibold text-gray-600 mb-3">Summary</h4>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg text-center">
                      <div className="text-2xl font-bold text-blue-700">{paymentData?.packages?.length || 0}</div>
                      <div className="text-xs text-gray-600">Packages</div>
                    </div>
                    <div className="p-3 bg-emerald-50 rounded-lg text-center">
                      <div className="text-2xl font-bold text-emerald-700">₹{paymentData?.total_paid?.toLocaleString() || 0}</div>
                      <div className="text-xs text-gray-600">Total Paid</div>
                    </div>
                    <div className="p-3 bg-amber-50 rounded-lg text-center">
                      <div className="text-2xl font-bold text-amber-700">{notes.length}</div>
                      <div className="text-xs text-gray-600">Notes</div>
                    </div>
                  </div>
                </div>
                
                {/* Quick Add Note */}
                <div className="mt-6 pt-4 border-t">
                  <h4 className="text-sm font-semibold text-gray-600 mb-2 flex items-center gap-2">
                    <Plus className="h-4 w-4" /> Add Quick Note
                  </h4>
                  <div className="flex gap-2">
                    <Input
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Type a note and press Enter..."
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddNote()}
                      data-testid="quick-add-note-input"
                    />
                    <Button onClick={handleAddNote} disabled={addingNote || !newNote.trim()} className="bg-blue-600 hover:bg-blue-700">
                      {addingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
              </TabsContent>
              
              {/* Packages Tab (renamed from Payments) */}
              <TabsContent value="packages" className="flex-1 overflow-y-auto p-6 mt-0">
                {paymentData?.packages && paymentData.packages.length > 0 ? (
                  <div className="space-y-4">
                    {paymentData.packages.map((pkg) => (
                      <PackageCard 
                        key={pkg.inspection_id}
                        pkg={pkg}
                        isExpanded={expandedPackages[pkg.inspection_id]}
                        onToggle={() => togglePackageExpand(pkg.inspection_id)}
                        onViewReport={handleViewReport}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Package className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No packages found</p>
                    <p className="text-sm text-gray-400 mt-1">Packages will appear here after payment</p>
                    {/* Repair button for admins */}
                    <Button 
                      variant="outline" 
                      className="mt-4 text-orange-600 border-orange-300 hover:bg-orange-50"
                      onClick={handleRepairData}
                      disabled={repairing}
                      data-testid="repair-customer-btn"
                    >
                      {repairing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wrench className="h-4 w-4 mr-2" />}
                      Repair Missing Data
                    </Button>
                    <p className="text-xs text-gray-400 mt-2">Links orphaned inspections & creates missing ones</p>
                  </div>
                )}
              </TabsContent>
              
              {/* Notes Tab */}
              <TabsContent value="notes" className="flex-1 overflow-hidden flex flex-col p-6 mt-0">
                {/* Add Note */}
                <div className="mb-4 shrink-0">
                  <div className="flex gap-2">
                    <Input
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note..."
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddNote()}
                      data-testid="add-note-input"
                    />
                    <Button onClick={handleAddNote} disabled={addingNote || !newNote.trim()}
                      className="bg-blue-600 hover:bg-blue-700" data-testid="add-note-btn">
                      {addingNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                
                {/* Notes & Activities */}
                <div className="flex-1 overflow-y-auto">
                  <Tabs defaultValue="notes" className="h-full">
                    <TabsList className="mb-3">
                      <TabsTrigger value="notes" className="text-sm">
                        <MessageSquare className="h-4 w-4 mr-1.5" /> Notes ({notes.length})
                      </TabsTrigger>
                      <TabsTrigger value="activities" className="text-sm">
                        <Activity className="h-4 w-4 mr-1.5" /> Activity ({activities.length})
                      </TabsTrigger>
                    </TabsList>
                    
                    <TabsContent value="notes" className="mt-0">
                      {notes.length > 0 ? (
                        <div className="space-y-3">
                          {notes.map((note) => (
                            <NoteCard
                              key={note.id}
                              note={note}
                              onEdit={handleEditNote}
                              onDelete={handleDeleteNote}
                              isEditing={editingNoteId === note.id}
                              editValue={editNoteValue}
                              setEditValue={setEditNoteValue}
                              onSaveEdit={handleSaveNoteEdit}
                              onCancelEdit={() => { setEditingNoteId(null); setEditNoteValue(''); }}
                              saving={savingNote}
                            />
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500 text-sm">
                          <FileText className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                          No notes yet. Add the first note above!
                        </div>
                      )}
                    </TabsContent>
                    
                    <TabsContent value="activities" className="mt-0">
                      {activities.length > 0 ? (
                        <div className="space-y-2">
                          {activities.map((activity) => (
                            <div key={activity.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border" data-testid={`activity-${activity.id}`}>
                              <div className="mt-0.5">{getActivityIcon(activity.action)}</div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-gray-800">
                                  <span className="font-medium">{activity.user_name}</span>
                                  <span className="text-gray-600"> {activity.details || activity.action.replace(/_/g, ' ')}</span>
                                </div>
                                {activity.new_value && (
                                  <div className="mt-1 text-xs text-gray-600 bg-white p-2 rounded border truncate">
                                    {activity.new_value}
                                  </div>
                                )}
                                <div className="mt-1 text-xs text-gray-400">{formatDateTime(activity.created_at)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500 text-sm">
                          <Activity className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                          No activity recorded yet
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">Customer not found</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
