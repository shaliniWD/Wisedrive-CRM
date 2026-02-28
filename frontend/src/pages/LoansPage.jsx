import React, { useState, useEffect, useMemo, useRef } from 'react';
import { loansApi, inspectionsApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Users, Phone, MapPin, Calendar, RefreshCw, Search, Filter,
  FileText, Car, CreditCard, Building2, ChevronRight, Plus,
  CheckCircle, XCircle, Clock, AlertCircle, Upload, Eye,
  Trash2, ExternalLink, IndianRupee, Percent, X, Loader2,
  PhoneCall, PhoneOff, ArrowUpRight, ChevronDown, Info
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
import {
  Popover, PopoverContent, PopoverTrigger,
} from '@/components/ui/popover';
import { formatDate, formatDateTime } from '@/utils/dateFormat';

// Status badge component
const StatusBadge = ({ status }) => {
  const config = {
    NEW: { color: 'bg-gray-100 text-gray-700', icon: Clock },
    INTERESTED: { color: 'bg-green-100 text-green-700', icon: CheckCircle },
    NOT_INTERESTED: { color: 'bg-red-100 text-red-700', icon: XCircle },
    RNR: { color: 'bg-yellow-100 text-yellow-700', icon: PhoneOff },
    CALL_BACK: { color: 'bg-blue-100 text-blue-700', icon: PhoneCall },
    FOLLOW_UP: { color: 'bg-purple-100 text-purple-700', icon: Calendar },
  };
  
  const { color, icon: Icon } = config[status] || config.NEW;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" />
      {status?.replace(/_/g, ' ')}
    </span>
  );
};

// Application Status Badge
const AppStatusBadge = ({ status }) => {
  const config = {
    DRAFT: { color: 'bg-gray-100 text-gray-600' },
    APPLIED: { color: 'bg-blue-100 text-blue-700' },
    ACCEPTED_BY_BANK: { color: 'bg-cyan-100 text-cyan-700' },
    IN_PROCESS: { color: 'bg-yellow-100 text-yellow-700' },
    REJECTED_BY_BANK: { color: 'bg-red-100 text-red-700' },
    APPROVED_BY_BANK: { color: 'bg-green-100 text-green-700' },
    LOAN_DISBURSED: { color: 'bg-emerald-100 text-emerald-800' },
  };
  
  const { color } = config[status] || config.DRAFT;
  
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>
      {status?.replace(/_/g, ' ')}
    </span>
  );
};

// Format currency
const formatCurrency = (amount) => {
  if (!amount) return '₹ 0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

// Vehicle Dropdown Component for table column
const VehicleDropdown = ({ vehicles, onManageClick }) => {
  if (!vehicles || vehicles.length === 0) {
    return (
      <Button size="sm" variant="outline" onClick={onManageClick}>
        <Car className="h-3 w-3 mr-1" />
        Add
      </Button>
    );
  }

  if (vehicles.length === 1) {
    const v = vehicles[0];
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button size="sm" variant="outline" className="max-w-[200px]">
            <Car className="h-3 w-3 mr-1" />
            <span className="truncate">{v.car_number}</span>
            <ChevronDown className="h-3 w-3 ml-1" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="p-3 border-b bg-gray-50">
            <p className="font-semibold">{v.car_number}</p>
            <p className="text-sm text-gray-600">{v.car_make} {v.car_model} {v.car_year}</p>
          </div>
          <div className="p-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Valuation:</span>
              <span className="font-medium">{formatCurrency(v.vehicle_valuation)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Required Amount:</span>
              <span className="font-medium">{formatCurrency(v.required_loan_amount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Expected EMI:</span>
              <span className="font-medium">{formatCurrency(v.expected_emi)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Interest Rate:</span>
              <span className="font-medium">{v.expected_interest_rate ? `${v.expected_interest_rate}%` : '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Tenure:</span>
              <span className="font-medium">{v.expected_tenure_months ? `${v.expected_tenure_months} months` : '-'}</span>
            </div>
          </div>
          <div className="p-2 border-t">
            <Button size="sm" variant="outline" className="w-full" onClick={onManageClick}>
              Manage Vehicles
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    );
  }

  // Multiple vehicles - show dropdown
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Car className="h-3 w-3 mr-1" />
          {vehicles.length} Cars
          <ChevronDown className="h-3 w-3 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-96 p-0" align="start">
        <div className="p-2 border-b bg-gray-50">
          <p className="text-sm font-medium text-gray-700">{vehicles.length} Vehicles</p>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {vehicles.map((v, idx) => (
            <div key={v.vehicle_id} className={`p-3 ${idx > 0 ? 'border-t' : ''}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-semibold text-sm">{v.car_number}</p>
                  <p className="text-xs text-gray-500">{v.car_make} {v.car_model} {v.car_year}</p>
                </div>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                  #{idx + 1}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Valuation:</span>
                  <span className="font-medium">{formatCurrency(v.vehicle_valuation)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Loan Amt:</span>
                  <span className="font-medium">{formatCurrency(v.required_loan_amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">EMI:</span>
                  <span className="font-medium">{formatCurrency(v.expected_emi)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Tenure:</span>
                  <span className="font-medium">{v.expected_tenure_months ? `${v.expected_tenure_months}m` : '-'}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="p-2 border-t">
          <Button size="sm" variant="outline" className="w-full" onClick={onManageClick}>
            Manage Vehicles
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// Enhanced Documents Modal Component with Upload/Download
const DocumentsModal = ({ isOpen, onClose, lead, onUpdate }) => {
  const [customerType, setCustomerType] = useState(lead?.customer_type || '');
  const [requirements, setRequirements] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [downloadingDoc, setDownloadingDoc] = useState(null);
  const [deletingDoc, setDeletingDoc] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const fileInputRef = useRef(null);
  const [selectedDocType, setSelectedDocType] = useState(null);
  
  useEffect(() => {
    if (isOpen && lead?.id) {
      setCustomerType(lead?.customer_type || '');
      fetchRequirements();
    }
  }, [isOpen, lead?.id]);
  
  useEffect(() => {
    if (customerType) {
      fetchRequirements();
    }
  }, [customerType]);
  
  const fetchRequirements = async () => {
    try {
      const res = await loansApi.getDocumentRequirements(lead.id);
      setRequirements(res.data);
    } catch (err) {
      console.error('Error fetching requirements:', err);
    }
  };
  
  const handleCustomerTypeChange = async (type) => {
    setCustomerType(type);
    try {
      await loansApi.update(lead.id, { customer_type: type });
      toast.success('Customer type updated');
      onUpdate();
    } catch (err) {
      toast.error('Failed to update customer type');
    }
  };
  
  const getDocList = () => {
    if (!requirements) return [];
    if (customerType === 'SALARIED') {
      return requirements.requirements?.SALARIED || requirements.requirements || [];
    } else if (customerType === 'SELF_EMPLOYED') {
      return requirements.requirements?.SELF_EMPLOYED || requirements.requirements || [];
    }
    return [];
  };
  
  const uploadedDocs = lead?.documents || [];
  const getUploadedDoc = (docType) => uploadedDocs.find(d => d.document_type === docType);
  const isDocUploaded = (docType) => uploadedDocs.some(d => d.document_type === docType);
  
  // Handle file selection
  const handleFileSelect = async (docType, file) => {
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload PDF, JPG, or PNG files only');
      return;
    }
    
    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }
    
    setUploadingDoc(docType);
    setUploadProgress(0);
    
    try {
      // Step 1: Get signed upload URL
      setUploadProgress(10);
      const urlRes = await loansApi.generateUploadUrl(lead.id, {
        document_type: docType,
        filename: file.name,
        content_type: file.type
      });
      
      const { signed_url, firebase_path } = urlRes.data;
      
      // Step 2: Upload file directly to Firebase
      setUploadProgress(30);
      await fetch(signed_url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type },
        body: file
      });
      
      setUploadProgress(70);
      
      // Step 3: Save document record to database
      await loansApi.uploadDocument(lead.id, {
        document_type: docType,
        file_url: firebase_path,
        file_name: file.name
      });
      
      setUploadProgress(100);
      toast.success('Document uploaded successfully');
      onUpdate();
      
    } catch (err) {
      console.error('Upload error:', err);
      toast.error('Failed to upload document');
    } finally {
      setTimeout(() => {
        setUploadingDoc(null);
        setUploadProgress(0);
      }, 500);
    }
  };
  
  // Handle drag and drop
  const handleDragOver = (e, docType) => {
    e.preventDefault();
    setDragOver(docType);
  };
  
  const handleDragLeave = () => {
    setDragOver(null);
  };
  
  const handleDrop = (e, docType) => {
    e.preventDefault();
    setDragOver(null);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(docType, file);
    }
  };
  
  // Handle download
  const handleDownload = async (doc) => {
    setDownloadingDoc(doc.id);
    try {
      const res = await loansApi.getDocumentDownloadUrl(lead.id, doc.id);
      const { download_url, file_name } = res.data;
      
      // Open in new tab or trigger download
      window.open(download_url, '_blank');
      toast.success('Opening document...');
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to get download link');
    } finally {
      setDownloadingDoc(null);
    }
  };
  
  // Handle delete
  const handleDelete = async (doc) => {
    if (!confirm(`Delete "${doc.file_name}"?`)) return;
    
    setDeletingDoc(doc.id);
    try {
      await loansApi.deleteDocument(lead.id, doc.id);
      toast.success('Document deleted');
      onUpdate();
    } catch (err) {
      toast.error('Failed to delete document');
    } finally {
      setDeletingDoc(null);
    }
  };
  
  // Trigger file input click
  const triggerFileInput = (docType) => {
    setSelectedDocType(docType);
    fileInputRef.current?.click();
  };
  
  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file && selectedDocType) {
      handleFileSelect(selectedDocType, file);
    }
    e.target.value = ''; // Reset input
  };
  
  // Calculate completion percentage
  const docList = getDocList();
  const requiredDocs = docList.filter(d => d.required);
  const uploadedRequired = requiredDocs.filter(d => isDocUploaded(d.document_type));
  const completionPercent = requiredDocs.length > 0 
    ? Math.round((uploadedRequired.length / requiredDocs.length) * 100) 
    : 0;
  
  // Get file icon based on type
  const getFileIcon = (fileName) => {
    const ext = fileName?.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return FileText;
    if (['jpg', 'jpeg', 'png'].includes(ext)) return Eye;
    return FileText;
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            Customer Documents
          </DialogTitle>
          <DialogDescription>
            {lead?.customer_name} • {lead?.customer_phone}
          </DialogDescription>
        </DialogHeader>
        
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleFileInputChange}
        />
        
        <div className="flex-1 overflow-y-auto space-y-6 py-4 pr-2">
          {/* Customer Type Selection */}
          <div>
            <Label className="text-sm font-medium mb-3 block">Employment Type</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleCustomerTypeChange('SALARIED')}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  customerType === 'SALARIED' 
                    ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-sm' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    customerType === 'SALARIED' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Building2 className={`h-5 w-5 ${customerType === 'SALARIED' ? 'text-blue-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <p className={`font-medium ${customerType === 'SALARIED' ? 'text-blue-900' : 'text-gray-700'}`}>Salaried</p>
                    <p className="text-xs text-gray-500 mt-0.5">Working professional with regular income</p>
                  </div>
                </div>
              </button>
              <button
                onClick={() => handleCustomerTypeChange('SELF_EMPLOYED')}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  customerType === 'SELF_EMPLOYED' 
                    ? 'border-blue-500 bg-gradient-to-br from-blue-50 to-indigo-50 shadow-sm' 
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    customerType === 'SELF_EMPLOYED' ? 'bg-blue-100' : 'bg-gray-100'
                  }`}>
                    <Users className={`h-5 w-5 ${customerType === 'SELF_EMPLOYED' ? 'text-blue-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <p className={`font-medium ${customerType === 'SELF_EMPLOYED' ? 'text-blue-900' : 'text-gray-700'}`}>Self Employed</p>
                    <p className="text-xs text-gray-500 mt-0.5">Business owner or freelancer</p>
                  </div>
                </div>
              </button>
            </div>
          </div>
          
          {/* Document Checklist */}
          {customerType && docList.length > 0 && (
            <div>
              {/* Progress Header */}
              <div className="flex items-center justify-between mb-4">
                <Label className="text-sm font-medium">Required Documents</Label>
                <div className="flex items-center gap-2">
                  <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-500"
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                  <span className={`text-xs font-medium ${completionPercent === 100 ? 'text-green-600' : 'text-gray-500'}`}>
                    {completionPercent}%
                  </span>
                </div>
              </div>
              
              <div className="space-y-3">
                {docList.map((doc, idx) => {
                  const uploadedDoc = getUploadedDoc(doc.document_type);
                  const isUploading = uploadingDoc === doc.document_type;
                  const isDraggedOver = dragOver === doc.document_type;
                  const FileIcon = uploadedDoc ? getFileIcon(uploadedDoc.file_name) : Upload;
                  
                  return (
                    <div
                      key={idx}
                      className={`relative rounded-xl border-2 transition-all ${
                        isDraggedOver 
                          ? 'border-blue-400 bg-blue-50 scale-[1.01]' 
                          : uploadedDoc 
                            ? 'border-green-200 bg-gradient-to-r from-green-50 to-emerald-50' 
                            : 'border-dashed border-gray-300 bg-gray-50 hover:border-gray-400'
                      }`}
                      onDragOver={(e) => handleDragOver(e, doc.document_type)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, doc.document_type)}
                    >
                      {/* Upload Progress Overlay */}
                      {isUploading && (
                        <div className="absolute inset-0 bg-white/90 rounded-xl flex flex-col items-center justify-center z-10">
                          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-2" />
                          <div className="w-32 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-600 transition-all duration-300"
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Uploading... {uploadProgress}%</p>
                        </div>
                      )}
                      
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          {/* Document Info */}
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                              uploadedDoc ? 'bg-green-100' : 'bg-gray-100'
                            }`}>
                              {uploadedDoc ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <FileIcon className="h-5 w-5 text-gray-400" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-gray-900 truncate">{doc.display_name}</p>
                                {doc.required && (
                                  <span className="flex-shrink-0 text-[10px] font-semibold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">
                                    REQUIRED
                                  </span>
                                )}
                              </div>
                              {doc.description && (
                                <p className="text-xs text-gray-500 mt-0.5">{doc.description}</p>
                              )}
                              {uploadedDoc && (
                                <div className="flex items-center gap-2 mt-2">
                                  <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-full truncate max-w-[200px]">
                                    {uploadedDoc.file_name}
                                  </span>
                                  <span className="text-xs text-gray-400">
                                    {new Date(uploadedDoc.uploaded_at).toLocaleDateString()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                          
                          {/* Actions */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {uploadedDoc ? (
                              <>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  onClick={() => handleDownload(uploadedDoc)}
                                  disabled={downloadingDoc === uploadedDoc.id}
                                >
                                  {downloadingDoc === uploadedDoc.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <>
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      View
                                    </>
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  onClick={() => triggerFileInput(doc.document_type)}
                                >
                                  <RefreshCw className="h-3 w-3 mr-1" />
                                  Replace
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => handleDelete(uploadedDoc)}
                                  disabled={deletingDoc === uploadedDoc.id}
                                >
                                  {deletingDoc === uploadedDoc.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3 w-3" />
                                  )}
                                </Button>
                              </>
                            ) : (
                              <Button
                                size="sm"
                                className="h-9"
                                onClick={() => triggerFileInput(doc.document_type)}
                              >
                                <Upload className="h-3 w-3 mr-1.5" />
                                Upload
                              </Button>
                            )}
                          </div>
                        </div>
                        
                        {/* Drop Zone Hint */}
                        {!uploadedDoc && !isUploading && (
                          <p className="text-xs text-gray-400 mt-3 text-center">
                            Drag & drop file here or click Upload • PDF, JPG, PNG up to 10MB
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* No Customer Type Selected */}
          {!customerType && (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-3 text-amber-500" />
              <p className="text-gray-600 font-medium">Select Employment Type</p>
              <p className="text-sm text-gray-400 mt-1">
                Choose whether the customer is salaried or self-employed to see required documents
              </p>
            </div>
          )}
          
          {/* All Uploaded Documents Section */}
          {uploadedDocs.length > 0 && (
            <div className="pt-4 border-t">
              <Label className="text-sm font-medium mb-3 block flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                All Uploaded Documents ({uploadedDocs.length})
              </Label>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2 max-h-[200px] overflow-y-auto">
                {uploadedDocs.map((doc) => (
                  <div key={doc.id} className="flex items-center justify-between p-2 bg-white rounded-lg border">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{doc.file_name}</p>
                        <p className="text-xs text-gray-400">
                          {doc.document_type.replace(/_/g, ' ')} • {new Date(doc.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0"
                        onClick={() => handleDownload(doc)}
                        disabled={downloadingDoc === doc.id}
                      >
                        {downloadingDoc === doc.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <ExternalLink className="h-3 w-3" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-red-500 hover:text-red-700"
                        onClick={() => handleDelete(doc)}
                        disabled={deletingDoc === doc.id}
                      >
                        {deletingDoc === doc.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        {/* Footer with completion status */}
        {customerType && (
          <div className="flex-shrink-0 pt-4 border-t mt-4">
            <div className="flex items-center justify-between">
              <div className="text-sm">
                {completionPercent === 100 ? (
                  <span className="text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle className="h-4 w-4" />
                    All required documents uploaded
                  </span>
                ) : (
                  <span className="text-amber-600">
                    {requiredDocs.length - uploadedRequired.length} required document(s) pending
                  </span>
                )}
              </div>
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Credit Score Modal with OTP verification
const CreditScoreModal = ({ isOpen, onClose, lead, onUpdate }) => {
  const [step, setStep] = useState(1); // 1: Form, 2: OTP, 3: Result
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');
  const [creditResult, setCreditResult] = useState(null);
  
  // Form fields
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    pan_number: '',
    dob: '',
    mobile_number: '',
    email: '',
    gender: 'male',
    pin_code: ''
  });
  const [otp, setOtp] = useState('');
  
  // Pre-fill form with available data
  useEffect(() => {
    if (isOpen && lead) {
      const nameParts = (lead.customer_name || '').split(' ');
      setFormData({
        first_name: nameParts[0] || '',
        last_name: nameParts.slice(1).join(' ') || '',
        pan_number: '',
        dob: '',
        mobile_number: (lead.customer_phone || '').replace('+91', '').replace(/\D/g, ''),
        email: lead.customer_email || '',
        gender: 'male',
        pin_code: ''
      });
      
      // Check if we already have a credit score
      if (lead.credit_score) {
        setCreditResult({
          credit_score: lead.credit_score,
          summary: lead.credit_score_summary
        });
        setStep(3);
      } else {
        setStep(1);
        setCreditResult(null);
      }
    }
  }, [isOpen, lead]);
  
  const handleRequestOTP = async () => {
    // Validation
    if (!formData.first_name || !formData.last_name) {
      toast.error('Please enter full name');
      return;
    }
    if (!formData.pan_number || formData.pan_number.length !== 10) {
      toast.error('Please enter valid 10-digit PAN number');
      return;
    }
    if (!formData.dob || formData.dob.length !== 8) {
      toast.error('Please enter DOB in YYYYMMDD format (e.g., 19901231)');
      return;
    }
    if (!formData.mobile_number || formData.mobile_number.length !== 10) {
      toast.error('Please enter valid 10-digit mobile number');
      return;
    }
    if (!formData.email) {
      toast.error('Please enter email address');
      return;
    }
    if (!formData.pin_code || formData.pin_code.length !== 6) {
      toast.error('Please enter valid 6-digit PIN code');
      return;
    }
    
    setLoading(true);
    try {
      const res = await loansApi.requestCreditScoreOTP(lead.id, formData);
      if (res.data.success) {
        setToken(res.data.token);
        toast.success('OTP sent to customer\'s mobile number');
        setStep(2);
      } else {
        toast.error(res.data.message || 'Failed to send OTP');
      }
    } catch (err) {
      console.error('OTP request error:', err);
      toast.error(err.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };
  
  const handleVerifyOTP = async () => {
    if (!otp || otp.length < 4) {
      toast.error('Please enter the OTP received by customer');
      return;
    }
    
    setLoading(true);
    try {
      const res = await loansApi.verifyCreditScoreOTP(lead.id, { token, otp });
      if (res.data.success) {
        setCreditResult(res.data);
        toast.success('Credit report fetched successfully');
        setStep(3);
        onUpdate(); // Refresh parent data
      } else {
        toast.error(res.data.message || 'Failed to verify OTP');
      }
    } catch (err) {
      console.error('OTP verify error:', err);
      toast.error(err.response?.data?.detail || 'Failed to verify OTP. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const getScoreColor = (score) => {
    if (score >= 750) return 'text-green-600 bg-green-100';
    if (score >= 650) return 'text-yellow-600 bg-yellow-100';
    if (score >= 550) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };
  
  const getScoreLabel = (score) => {
    if (score >= 750) return 'Excellent';
    if (score >= 700) return 'Good';
    if (score >= 650) return 'Fair';
    if (score >= 550) return 'Poor';
    return 'Very Poor';
  };
  
  const handleClose = () => {
    setStep(1);
    setOtp('');
    setToken('');
    onClose();
  };
  
  const resetAndRetry = () => {
    setStep(1);
    setOtp('');
    setToken('');
    setCreditResult(null);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Credit Score Check
          </DialogTitle>
          <DialogDescription>
            {lead?.customer_name} • {lead?.customer_phone}
          </DialogDescription>
        </DialogHeader>
        
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-2 py-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === s 
                  ? 'bg-blue-600 text-white' 
                  : step > s 
                    ? 'bg-green-100 text-green-700' 
                    : 'bg-gray-100 text-gray-400'
              }`}>
                {step > s ? <CheckCircle className="h-4 w-4" /> : s}
              </div>
              {s < 3 && <div className={`w-12 h-0.5 ${step > s ? 'bg-green-400' : 'bg-gray-200'}`} />}
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-8 text-xs text-gray-500 -mt-2 mb-4">
          <span>Customer Info</span>
          <span>Verify OTP</span>
          <span>Credit Report</span>
        </div>
        
        {/* Step 1: Customer Information Form */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex gap-2">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div className="text-sm text-amber-800">
                  <p className="font-medium">OTP will be sent to customer</p>
                  <p className="text-amber-600">The customer will receive an OTP on their mobile. Please ask them to share it with you.</p>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">First Name *</Label>
                <Input
                  value={formData.first_name}
                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                  placeholder="First name"
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">Last Name *</Label>
                <Input
                  value={formData.last_name}
                  onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                  placeholder="Last name"
                  className="mt-1"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">PAN Number *</Label>
                <Input
                  value={formData.pan_number}
                  onChange={(e) => setFormData({...formData, pan_number: e.target.value.toUpperCase()})}
                  placeholder="ABCDE1234F"
                  maxLength={10}
                  className="mt-1 uppercase"
                />
              </div>
              <div>
                <Label className="text-sm">Date of Birth *</Label>
                <Input
                  value={formData.dob}
                  onChange={(e) => setFormData({...formData, dob: e.target.value.replace(/\D/g, '')})}
                  placeholder="YYYYMMDD (e.g., 19901231)"
                  maxLength={8}
                  className="mt-1"
                />
                <p className="text-xs text-gray-400 mt-1">Format: YYYYMMDD</p>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Mobile Number *</Label>
                <div className="flex mt-1">
                  <span className="inline-flex items-center px-3 bg-gray-100 border border-r-0 border-gray-300 rounded-l-md text-gray-500 text-sm">
                    +91
                  </span>
                  <Input
                    value={formData.mobile_number}
                    onChange={(e) => setFormData({...formData, mobile_number: e.target.value.replace(/\D/g, '')})}
                    placeholder="9876543210"
                    maxLength={10}
                    className="rounded-l-none"
                  />
                </div>
              </div>
              <div>
                <Label className="text-sm">Email *</Label>
                <Input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="email@example.com"
                  className="mt-1"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-sm">Gender *</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(val) => setFormData({...formData, gender: val})}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-sm">PIN Code *</Label>
                <Input
                  value={formData.pin_code}
                  onChange={(e) => setFormData({...formData, pin_code: e.target.value.replace(/\D/g, '')})}
                  placeholder="560001"
                  maxLength={6}
                  className="mt-1"
                />
              </div>
            </div>
            
            <Button 
              className="w-full mt-4" 
              onClick={handleRequestOTP}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Sending OTP...
                </>
              ) : (
                <>
                  Send OTP to Customer
                  <ArrowUpRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        )}
        
        {/* Step 2: OTP Verification */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center py-4">
              <div className="w-16 h-16 mx-auto bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <Phone className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">OTP Sent Successfully</h3>
              <p className="text-gray-500 mt-1">
                An OTP has been sent to <span className="font-medium">+91 {formData.mobile_number}</span>
              </p>
              <p className="text-sm text-gray-400 mt-1">
                Please ask the customer to share the OTP with you
              </p>
            </div>
            
            <div className="max-w-xs mx-auto">
              <Label className="text-sm text-center block mb-2">Enter OTP</Label>
              <Input
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                placeholder="Enter 6-digit OTP"
                maxLength={6}
                className="text-center text-2xl tracking-widest h-14"
                autoFocus
              />
            </div>
            
            <div className="flex gap-3 max-w-xs mx-auto">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={resetAndRetry}
              >
                Back
              </Button>
              <Button 
                className="flex-1"
                onClick={handleVerifyOTP}
                disabled={loading || otp.length < 4}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify & Fetch'
                )}
              </Button>
            </div>
            
            <p className="text-center text-sm text-gray-400">
              Didn't receive OTP? <button onClick={resetAndRetry} className="text-blue-600 hover:underline">Request again</button>
            </p>
          </div>
        )}
        
        {/* Step 3: Credit Report Result */}
        {step === 3 && creditResult && (
          <div className="space-y-6">
            {/* Credit Score Display */}
            <div className="text-center py-6">
              <div className={`w-32 h-32 mx-auto rounded-full flex flex-col items-center justify-center ${getScoreColor(creditResult.credit_score)}`}>
                <span className="text-4xl font-bold">{creditResult.credit_score}</span>
                <span className="text-sm font-medium">{getScoreLabel(creditResult.credit_score)}</span>
              </div>
              <p className="text-gray-500 mt-3">Experian Credit Score</p>
              {creditResult.summary?.report_date && (
                <p className="text-xs text-gray-400 mt-1">
                  Report Date: {String(creditResult.summary.report_date).replace(/(\d{4})(\d{2})(\d{2})/, '$3/$2/$1')}
                </p>
              )}
            </div>
            
            {/* Score Gauge Visual */}
            <div className="relative h-3 bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 rounded-full overflow-hidden">
              <div 
                className="absolute top-0 w-3 h-3 bg-white border-2 border-gray-800 rounded-full transform -translate-x-1/2"
                style={{ left: `${Math.min(100, Math.max(0, ((creditResult.credit_score - 300) / 600) * 100))}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400">
              <span>300</span>
              <span>500</span>
              <span>700</span>
              <span>900</span>
            </div>
            
            {/* Account Summary */}
            {creditResult.summary && (
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Credit Accounts</p>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total</span>
                      <span className="font-semibold">{creditResult.summary.accounts?.total || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Active</span>
                      <span className="font-medium text-green-600">{creditResult.summary.accounts?.active || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Closed</span>
                      <span className="text-gray-500">{creditResult.summary.accounts?.closed || 0}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Defaulted</span>
                      <span className={creditResult.summary.accounts?.default > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                        {creditResult.summary.accounts?.default || 0}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Outstanding Balance</p>
                  <div className="mt-2 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Total</span>
                      <span className="font-semibold">₹{(creditResult.summary.outstanding_balance?.total || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Secured</span>
                      <span className="text-gray-500">₹{(creditResult.summary.outstanding_balance?.secured || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Unsecured</span>
                      <span className="text-gray-500">₹{(creditResult.summary.outstanding_balance?.unsecured || 0).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Credit Enquiries */}
            {creditResult.summary?.enquiries && (
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-xs text-blue-600 uppercase tracking-wide mb-2">Credit Enquiries</p>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <p className="text-lg font-semibold text-blue-800">{creditResult.summary.enquiries.last_7_days}</p>
                    <p className="text-xs text-blue-600">7 Days</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-blue-800">{creditResult.summary.enquiries.last_30_days}</p>
                    <p className="text-xs text-blue-600">30 Days</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-blue-800">{creditResult.summary.enquiries.last_90_days}</p>
                    <p className="text-xs text-blue-600">90 Days</p>
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-blue-800">{creditResult.summary.enquiries.last_180_days}</p>
                    <p className="text-xs text-blue-600">180 Days</p>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={resetAndRetry}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Re-check Score
              </Button>
              <Button className="flex-1" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Enhanced Vehicle Details Modal with Vaahan data display
const VehicleDetailsModal = ({ isOpen, onClose, lead, onUpdate }) => {
  const [vehicles, setVehicles] = useState(lead?.vehicles || []);
  const [newCarNumber, setNewCarNumber] = useState('');
  const [adding, setAdding] = useState(false);
  const [fetchingVaahan, setFetchingVaahan] = useState(null);
  const [newVehicleVaahanData, setNewVehicleVaahanData] = useState(null);
  const [addingWithVaahan, setAddingWithVaahan] = useState(false);
  
  useEffect(() => {
    if (lead) {
      setVehicles(lead.vehicles || []);
    }
  }, [lead]);
  
  // Fetch Vaahan data when car number is entered (with debounce effect)
  const handleCarNumberChange = (value) => {
    setNewCarNumber(value.toUpperCase());
    setNewVehicleVaahanData(null);
  };
  
  const handleFetchVaahanForNew = async () => {
    if (!newCarNumber || newCarNumber.length < 8) {
      toast.error('Please enter a valid vehicle number');
      return;
    }
    
    setAddingWithVaahan(true);
    try {
      // First add the vehicle
      const res = await loansApi.addVehicle(lead.id, { car_number: newCarNumber });
      if (res.data?.vehicle) {
        // The backend already fetches Vaahan data when adding
        setNewVehicleVaahanData(res.data.vehicle.vaahan_data);
        toast.success('Vehicle added with Vaahan data');
        setNewCarNumber('');
        onUpdate();
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add vehicle');
    } finally {
      setAddingWithVaahan(false);
    }
  };
  
  const handleAddVehicle = async () => {
    if (!newCarNumber.trim()) {
      toast.error('Please enter a vehicle number');
      return;
    }
    
    setAdding(true);
    try {
      await loansApi.addVehicle(lead.id, { car_number: newCarNumber });
      toast.success('Vehicle added');
      setNewCarNumber('');
      setNewVehicleVaahanData(null);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to add vehicle');
    } finally {
      setAdding(false);
    }
  };
  
  const handleFetchVaahan = async (vehicleId) => {
    setFetchingVaahan(vehicleId);
    try {
      const res = await loansApi.fetchVaahanForVehicle(lead.id, vehicleId);
      if (res.data.success) {
        toast.success('Vehicle data fetched from Vaahan');
        onUpdate();
      } else {
        toast.error(res.data.error || 'Vaahan API error');
      }
    } catch (err) {
      toast.error('Failed to fetch Vaahan data');
    } finally {
      setFetchingVaahan(null);
    }
  };
  
  const handleUpdateVehicle = async (vehicleId, data) => {
    try {
      await loansApi.updateVehicle(lead.id, vehicleId, data);
      onUpdate();
    } catch (err) {
      toast.error('Failed to update vehicle');
    }
  };
  
  const handleRemoveVehicle = async (vehicleId) => {
    if (!confirm('Remove this vehicle?')) return;
    try {
      await loansApi.removeVehicle(lead.id, vehicleId);
      toast.success('Vehicle removed');
      onUpdate();
    } catch (err) {
      toast.error('Failed to remove vehicle');
    }
  };
  
  const customerInspections = lead?.customer_inspections || [];
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-blue-600" />
            Vehicle Details for Loan
          </DialogTitle>
          <DialogDescription>
            {lead?.customer_name} - Manage vehicles for loan consideration
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Add from Inspections */}
          {customerInspections.length > 0 && (
            <div>
              <Label className="text-sm font-medium mb-2 block">Vehicles from Inspections</Label>
              <div className="grid gap-2">
                {customerInspections.map((insp) => {
                  const alreadyAdded = vehicles.some(v => v.car_number === insp.car_number);
                  return (
                    <div
                      key={insp.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        alreadyAdded ? 'bg-green-50 border-green-200' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Car className={`h-5 w-5 ${alreadyAdded ? 'text-green-600' : 'text-gray-400'}`} />
                        <div>
                          <p className="font-medium">{insp.car_number || 'No number'}</p>
                          <p className="text-xs text-gray-500">
                            {insp.vehicle_make} {insp.vehicle_model} {insp.vehicle_year}
                          </p>
                        </div>
                      </div>
                      {alreadyAdded ? (
                        <span className="text-xs text-green-600 font-medium">Added</span>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => loansApi.addVehicle(lead.id, {
                            car_number: insp.car_number,
                            car_make: insp.vehicle_make,
                            car_model: insp.vehicle_model,
                            car_year: insp.vehicle_year,
                            vehicle_valuation: insp.market_price_research?.market_average,
                            inspection_id: insp.id
                          }).then(() => { toast.success('Vehicle added'); onUpdate(); })}
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          
          {/* Add New Vehicle with Vaahan Integration */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <Label className="text-sm font-medium mb-2 block">Add New Vehicle</Label>
            <div className="flex gap-2">
              <Input
                placeholder="Enter vehicle number (e.g., KA01AB1234)"
                value={newCarNumber}
                onChange={(e) => handleCarNumberChange(e.target.value)}
                className="flex-1 bg-white"
              />
              <Button onClick={handleAddVehicle} disabled={adding || addingWithVaahan}>
                {adding || addingWithVaahan ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    Add & Fetch Vaahan
                  </>
                )}
              </Button>
            </div>
            <p className="text-xs text-blue-600 mt-2">
              <Info className="h-3 w-3 inline mr-1" />
              Vehicle details will be automatically fetched from Vaahan API
            </p>
          </div>
          
          {/* Vehicles List with Details */}
          <div>
            <Label className="text-sm font-medium mb-3 block">
              Vehicles for Loan ({vehicles.length})
            </Label>
            <div className="space-y-4">
              {vehicles.map((vehicle, idx) => (
                <div key={vehicle.vehicle_id} className="p-4 rounded-xl border bg-white shadow-sm">
                  {/* Vehicle Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                        <Car className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-lg">{vehicle.car_number}</p>
                          <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">#{idx + 1}</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {vehicle.car_make} {vehicle.car_model} {vehicle.car_year}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleFetchVaahan(vehicle.vehicle_id)}
                        disabled={fetchingVaahan === vehicle.vehicle_id}
                      >
                        {fetchingVaahan === vehicle.vehicle_id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <RefreshCw className="h-3 w-3 mr-1" />
                            Refresh Vaahan
                          </>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-red-600"
                        onClick={() => handleRemoveVehicle(vehicle.vehicle_id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* Vaahan Data Display */}
                  {vehicle.vaahan_data && (
                    <div className="mb-4 p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-xs font-medium text-green-700 mb-2 flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Vaahan API Data
                      </p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {vehicle.vaahan_data.manufacturer && (
                          <div>
                            <span className="text-gray-500">Manufacturer:</span>
                            <span className="ml-1 font-medium">{vehicle.vaahan_data.manufacturer}</span>
                          </div>
                        )}
                        {vehicle.vaahan_data.model && (
                          <div>
                            <span className="text-gray-500">Model:</span>
                            <span className="ml-1 font-medium">{vehicle.vaahan_data.model}</span>
                          </div>
                        )}
                        {vehicle.vaahan_data.fuel_type && (
                          <div>
                            <span className="text-gray-500">Fuel:</span>
                            <span className="ml-1 font-medium">{vehicle.vaahan_data.fuel_type}</span>
                          </div>
                        )}
                        {vehicle.vaahan_data.owner_count && (
                          <div>
                            <span className="text-gray-500">Owners:</span>
                            <span className="ml-1 font-medium">{vehicle.vaahan_data.owner_count}</span>
                          </div>
                        )}
                        {vehicle.vaahan_data.registration_date && (
                          <div>
                            <span className="text-gray-500">Reg Date:</span>
                            <span className="ml-1 font-medium">{vehicle.vaahan_data.registration_date}</span>
                          </div>
                        )}
                        {vehicle.vaahan_data.insurance_valid_upto && (
                          <div>
                            <span className="text-gray-500">Insurance:</span>
                            <span className="ml-1 font-medium">{vehicle.vaahan_data.insurance_valid_upto}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  {/* Loan Details Form */}
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs text-gray-500">Vehicle Valuation</Label>
                      <Input
                        type="number"
                        placeholder="₹ 0"
                        value={vehicle.vehicle_valuation || ''}
                        onChange={(e) => handleUpdateVehicle(vehicle.vehicle_id, { vehicle_valuation: parseFloat(e.target.value) || 0 })}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Required Loan Amount</Label>
                      <Input
                        type="number"
                        placeholder="₹ 0"
                        value={vehicle.required_loan_amount || ''}
                        onChange={(e) => handleUpdateVehicle(vehicle.vehicle_id, { required_loan_amount: parseFloat(e.target.value) || 0 })}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Expected EMI</Label>
                      <Input
                        type="number"
                        placeholder="₹ 0"
                        value={vehicle.expected_emi || ''}
                        onChange={(e) => handleUpdateVehicle(vehicle.vehicle_id, { expected_emi: parseFloat(e.target.value) || 0 })}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Interest Rate (%)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        placeholder="0%"
                        value={vehicle.expected_interest_rate || ''}
                        onChange={(e) => handleUpdateVehicle(vehicle.vehicle_id, { expected_interest_rate: parseFloat(e.target.value) || 0 })}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Tenure (months)</Label>
                      <Input
                        type="number"
                        placeholder="60"
                        value={vehicle.expected_tenure_months || ''}
                        onChange={(e) => handleUpdateVehicle(vehicle.vehicle_id, { expected_tenure_months: parseInt(e.target.value) || 0 })}
                        className="h-9"
                      />
                    </div>
                  </div>
                  
                  {/* Document Uploads */}
                  <div className="mt-4 pt-4 border-t flex gap-2">
                    <Button size="sm" variant="outline" className="h-8">
                      <Upload className="h-3 w-3 mr-1" />
                      RC Card {vehicle.rc_card_url && <CheckCircle className="h-3 w-3 ml-1 text-green-600" />}
                    </Button>
                    <Button size="sm" variant="outline" className="h-8">
                      <Upload className="h-3 w-3 mr-1" />
                      Insurance {vehicle.insurance_doc_url && <CheckCircle className="h-3 w-3 ml-1 text-green-600" />}
                    </Button>
                  </div>
                </div>
              ))}
              
              {vehicles.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Car className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>No vehicles added yet</p>
                  <p className="text-sm">Add vehicles from inspections or enter a new vehicle number</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Enhanced Loan Processing Modal - Vehicle-wise eligibility
const LoanProcessingModal = ({ isOpen, onClose, lead, onUpdate }) => {
  const [checking, setChecking] = useState(null);
  const [vehicleEligibility, setVehicleEligibility] = useState({});
  const [applying, setApplying] = useState(null);
  
  const vehicles = lead?.vehicles || [];
  const applications = lead?.applications || [];
  
  const handleCheckEligibility = async (vehicleId) => {
    const vehicle = vehicles.find(v => v.vehicle_id === vehicleId);
    if (!vehicle?.vehicle_valuation) {
      toast.error('Please set vehicle valuation first');
      return;
    }
    
    setChecking(vehicleId);
    try {
      const res = await loansApi.checkEligibility(lead.id, vehicleId);
      setVehicleEligibility(prev => ({
        ...prev,
        [vehicleId]: res.data.results || []
      }));
      toast.success(`Checked ${res.data.eligible_banks} eligible banks`);
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to check eligibility');
    } finally {
      setChecking(null);
    }
  };
  
  const handleApplyLoan = async (vehicleId, bankId) => {
    setApplying(`${vehicleId}-${bankId}`);
    try {
      await loansApi.createApplication(lead.id, {
        vehicle_loan_id: vehicleId,
        bank_id: bankId
      });
      toast.success('Loan application submitted');
      onUpdate();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit application');
    } finally {
      setApplying(null);
    }
  };
  
  const getVehicleApplications = (vehicleId) => {
    return applications.filter(a => a.vehicle_loan_id === vehicleId);
  };
  
  const hasAppliedToBank = (vehicleId, bankId) => {
    return applications.some(a => a.vehicle_loan_id === vehicleId && a.bank_id === bankId);
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-blue-600" />
            Loan Processing - Vehicle Wise Eligibility
          </DialogTitle>
          <DialogDescription>
            {lead?.customer_name} - Check bank eligibility and apply for loans per vehicle
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {vehicles.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Car className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">No vehicles added</p>
              <p className="text-sm">Please add vehicles first to check loan eligibility</p>
            </div>
          ) : (
            vehicles.map((vehicle, idx) => {
              const eligibilityResults = vehicleEligibility[vehicle.vehicle_id] || [];
              const vehicleApps = getVehicleApplications(vehicle.vehicle_id);
              
              return (
                <div key={vehicle.vehicle_id} className="border rounded-xl overflow-hidden">
                  {/* Vehicle Header */}
                  <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 border-b">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-white border flex items-center justify-center">
                          <Car className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-semibold text-lg">{vehicle.car_number}</h3>
                            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                              Vehicle #{idx + 1}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600">
                            {vehicle.car_make} {vehicle.car_model} {vehicle.car_year}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">Valuation</p>
                        <p className="text-xl font-bold text-gray-900">
                          {formatCurrency(vehicle.vehicle_valuation)}
                        </p>
                      </div>
                    </div>
                    
                    {/* Vehicle Loan Summary */}
                    <div className="mt-4 grid grid-cols-4 gap-4 text-sm">
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-gray-500 text-xs">Loan Amount</p>
                        <p className="font-semibold">{formatCurrency(vehicle.required_loan_amount)}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-gray-500 text-xs">Expected EMI</p>
                        <p className="font-semibold">{formatCurrency(vehicle.expected_emi)}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-gray-500 text-xs">Interest Rate</p>
                        <p className="font-semibold">{vehicle.expected_interest_rate ? `${vehicle.expected_interest_rate}%` : '-'}</p>
                      </div>
                      <div className="bg-white rounded-lg p-2 text-center">
                        <p className="text-gray-500 text-xs">Tenure</p>
                        <p className="font-semibold">{vehicle.expected_tenure_months ? `${vehicle.expected_tenure_months} months` : '-'}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Check Eligibility Button */}
                  <div className="p-4 bg-gray-50 border-b">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Bank Eligibility Check</p>
                        <p className="text-sm text-gray-500">
                          {eligibilityResults.length > 0 
                            ? `${eligibilityResults.filter(r => r.is_eligible).length} of ${eligibilityResults.length} banks eligible`
                            : 'Check eligibility with all partner banks'
                          }
                        </p>
                      </div>
                      <Button
                        onClick={() => handleCheckEligibility(vehicle.vehicle_id)}
                        disabled={checking === vehicle.vehicle_id || !vehicle.vehicle_valuation}
                      >
                        {checking === vehicle.vehicle_id ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        {eligibilityResults.length > 0 ? 'Re-check Eligibility' : 'Check Eligibility'}
                      </Button>
                    </div>
                  </div>
                  
                  {/* Existing Applications for this vehicle */}
                  {vehicleApps.length > 0 && (
                    <div className="p-4 border-b">
                      <p className="text-sm font-medium text-gray-700 mb-2">Active Applications</p>
                      <div className="flex flex-wrap gap-2">
                        {vehicleApps.map((app) => (
                          <div key={app.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            <span className="text-sm font-medium">{app.bank_name}</span>
                            <AppStatusBadge status={app.status} />
                            {app.approved_amount && (
                              <span className="text-xs text-green-600">{formatCurrency(app.approved_amount)}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Eligibility Results Table */}
                  {eligibilityResults.length > 0 && (
                    <div className="p-4">
                      <p className="text-sm font-medium text-gray-700 mb-3">Bank Eligibility Results</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="text-left p-3 font-medium">Bank</th>
                              <th className="text-center p-3 font-medium">Status</th>
                              <th className="text-right p-3 font-medium">Interest</th>
                              <th className="text-right p-3 font-medium">Max Amount (80% LTV)</th>
                              <th className="text-right p-3 font-medium">EMI</th>
                              <th className="text-right p-3 font-medium">Tenure</th>
                              <th className="text-right p-3 font-medium">Processing Fee</th>
                              <th className="text-center p-3 font-medium">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {eligibilityResults.map((result) => (
                              <tr key={result.bank_id} className={result.is_eligible ? 'bg-green-50/50' : 'bg-red-50/30'}>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    <Building2 className="h-4 w-4 text-gray-400" />
                                    <div>
                                      <p className="font-medium">{result.bank_name}</p>
                                      <p className="text-xs text-gray-500">{result.bank_code}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3 text-center">
                                  {result.is_eligible ? (
                                    <span className="inline-flex items-center gap-1 text-green-600">
                                      <CheckCircle className="h-4 w-4" /> Eligible
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-red-600" title={result.rejection_reason}>
                                      <XCircle className="h-4 w-4" /> Not Eligible
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-right font-medium">
                                  {result.interest_rate ? `${result.interest_rate}%` : '-'}
                                </td>
                                <td className="p-3 text-right font-medium text-blue-600">
                                  {result.max_loan_amount ? formatCurrency(result.max_loan_amount) : '-'}
                                </td>
                                <td className="p-3 text-right font-medium">
                                  {result.emi_amount ? formatCurrency(result.emi_amount) : '-'}
                                </td>
                                <td className="p-3 text-right">
                                  {result.tenure_months ? `${result.tenure_months} mo` : '-'}
                                </td>
                                <td className="p-3 text-right">
                                  {result.processing_fee ? formatCurrency(result.processing_fee) : '-'}
                                </td>
                                <td className="p-3 text-center">
                                  {result.is_eligible && !hasAppliedToBank(vehicle.vehicle_id, result.bank_id) ? (
                                    <Button
                                      size="sm"
                                      onClick={() => handleApplyLoan(vehicle.vehicle_id, result.bank_id)}
                                      disabled={applying === `${vehicle.vehicle_id}-${result.bank_id}`}
                                    >
                                      {applying === `${vehicle.vehicle_id}-${result.bank_id}` ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        'Apply'
                                      )}
                                    </Button>
                                  ) : hasAppliedToBank(vehicle.vehicle_id, result.bank_id) ? (
                                    <span className="text-xs text-blue-600 font-medium">Applied</span>
                                  ) : (
                                    <span className="text-xs text-gray-400">-</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
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
  const [page, setPage] = useState(0);
  const pageSize = 20;
  
  // Modals
  const [selectedLead, setSelectedLead] = useState(null);
  const [documentsModalOpen, setDocumentsModalOpen] = useState(false);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [processingModalOpen, setProcessingModalOpen] = useState(false);
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
      setLeads(res.data.items || []);
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
            <p className="text-2xl font-bold text-gray-900">{stats.total_leads}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase">Interested</p>
            <p className="text-2xl font-bold text-green-600">{stats.leads_by_status?.INTERESTED || 0}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase">Follow Up</p>
            <p className="text-2xl font-bold text-purple-600">{stats.leads_by_status?.FOLLOW_UP || 0}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase">Call Back</p>
            <p className="text-2xl font-bold text-blue-600">{stats.leads_by_status?.CALL_BACK || 0}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase">Not Interested</p>
            <p className="text-2xl font-bold text-red-600">{stats.leads_by_status?.NOT_INTERESTED || 0}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 uppercase">Active Banks</p>
            <p className="text-2xl font-bold text-gray-700">{stats.active_banks}</p>
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
    </div>
  );
}
