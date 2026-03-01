// Documents Modal Component for Loan Leads
import React, { useState, useEffect, useRef } from 'react';
import { loansApi } from '@/services/api';
import { toast } from 'sonner';
import {
  Users, FileText, Building2, CheckCircle, AlertCircle, Upload,
  Trash2, ExternalLink, RefreshCw, Loader2, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

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
      const { download_url } = res.data;
      
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
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" data-testid="documents-modal">
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
                data-testid="salaried-btn"
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
                data-testid="self-employed-btn"
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
                                data-testid={`upload-${doc.document_type}-btn`}
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

export default DocumentsModal;
