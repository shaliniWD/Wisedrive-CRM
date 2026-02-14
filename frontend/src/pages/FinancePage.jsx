import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { financeApi, countriesApi } from '../services/api';
import { toast } from 'sonner';
import { 
  DollarSign, Users, FileText, Check, X, Clock, 
  Download, Upload, Eye, Edit2, Trash2, Plus, 
  ChevronDown, Search, Filter, Calendar, Building,
  CreditCard, CheckCircle, XCircle, AlertCircle, Send,
  Paperclip, Image, File
} from 'lucide-react';

// Company Logo URL
const COMPANY_LOGO = "https://customer-assets.emergentagent.com/job_crm-employee-hub/artifacts/6eac372o_Wisedrive%20New%20Logo%20Horizontal%20Blue%20Trans%20BG.png";

// Month names
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Payment Types Configuration
const PAYMENT_TYPES = [
  { code: 'salary', name: 'Salary Payout', category: 'employee', icon: '💰' },
  { code: 'mechanic_payout', name: 'Mechanic Payment', category: 'employee', icon: '🔧' },
  { code: 'incentive', name: 'Incentive Payment', category: 'employee', icon: '🎯' },
  { code: 'vendor', name: 'Vendor Payment', category: 'b2b', icon: '🏢' },
  { code: 'admin_expense', name: 'Admin Expenses', category: 'expense', icon: '📋' },
  { code: 'operational', name: 'Operational Expenses', category: 'expense', icon: '⚙️' },
  { code: 'statutory', name: 'Statutory Payments', category: 'b2b', icon: '📜' },
  { code: 'legal', name: 'Legal Payments', category: 'b2b', icon: '⚖️' },
  { code: 'other', name: 'Other Payments', category: 'other', icon: '📦' },
];

// B2B payment types that need GST/TDS fields
const B2B_PAYMENT_TYPES = ['vendor', 'statutory', 'legal'];

// Status badge component
const StatusBadge = ({ status }) => {
  const config = {
    pending: { color: 'bg-amber-100 text-amber-800 border-amber-200', icon: Clock, label: 'Pending' },
    submitted: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Send, label: 'Submitted' },
    approved: { color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle, label: 'Approved' },
    rejected: { color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle, label: 'Rejected' },
    paid: { color: 'bg-green-100 text-green-800 border-green-200', icon: Check, label: 'Paid' }
  };
  
  const cfg = config[status] || config.pending;
  const Icon = cfg.icon;
  
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
};

// Payment Type Badge
const PaymentTypeBadge = ({ type }) => {
  const typeConfig = PAYMENT_TYPES.find(t => t.code === type) || { name: type, icon: '📄' };
  const categoryColors = {
    employee: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    b2b: 'bg-purple-50 text-purple-700 border-purple-200',
    expense: 'bg-orange-50 text-orange-700 border-orange-200',
    other: 'bg-gray-50 text-gray-700 border-gray-200',
  };
  const color = categoryColors[typeConfig.category] || categoryColors.other;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium border ${color}`}>
      <span>{typeConfig.icon}</span>
      {typeConfig.name}
    </span>
  );
};

// Summary Card
const SummaryCard = ({ title, value, subtitle, icon: Icon, color, bgColor }) => (
  <div className={`rounded-xl border p-5 ${bgColor || 'bg-white'}`}>
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className={`text-2xl font-bold ${color || 'text-gray-900'}`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-xl ${color ? 'bg-white/80' : 'bg-gray-100'}`}>
        <Icon className={`h-5 w-5 ${color || 'text-gray-600'}`} />
      </div>
    </div>
  </div>
);

// Modern Payslip Modal with Company Logo
const PayslipModal = ({ isOpen, onClose, payslipData }) => {
  if (!isOpen || !payslipData) return null;
  
  const isB2B = B2B_PAYMENT_TYPES.includes(payslipData.payment_type);
  const isMechanic = payslipData.is_mechanic || payslipData.payment_type === 'mechanic_payout';
  
  const handlePrint = () => {
    const printContent = document.getElementById('payslip-content');
    const printWindow = window.open('', '', 'width=800,height=900');
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payment Voucher - ${payslipData.employee_name || payslipData.vendor_name} - ${MONTHS[payslipData.month - 1]} ${payslipData.year}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
              padding: 40px; 
              color: #1f2937;
              line-height: 1.5;
            }
            .payslip-container {
              max-width: 800px;
              margin: 0 auto;
              border: 1px solid #e5e7eb;
              border-radius: 12px;
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
              color: white;
              padding: 30px;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .logo-section img { height: 50px; }
            .voucher-info { text-align: right; }
            .voucher-info h2 { font-size: 24px; font-weight: 600; margin-bottom: 4px; }
            .voucher-info p { opacity: 0.9; font-size: 14px; }
            .content { padding: 30px; }
            .info-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              margin-bottom: 30px;
            }
            .info-box {
              background: #f8fafc;
              border-radius: 8px;
              padding: 20px;
            }
            .info-box h4 {
              color: #1e3a8a;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 12px;
              font-weight: 600;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 6px 0;
              font-size: 13px;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-row:last-child { border-bottom: none; }
            .info-row .label { color: #6b7280; }
            .info-row .value { font-weight: 500; color: #1f2937; }
            .amount-table {
              width: 100%;
              border-collapse: collapse;
              margin: 20px 0;
            }
            .amount-table th {
              background: #f1f5f9;
              padding: 12px 16px;
              text-align: left;
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              color: #475569;
              font-weight: 600;
            }
            .amount-table td {
              padding: 12px 16px;
              border-bottom: 1px solid #e5e7eb;
              font-size: 14px;
            }
            .amount-table .amount { text-align: right; font-weight: 500; }
            .amount-table .total-row {
              background: #f0fdf4;
              font-weight: 600;
            }
            .amount-table .total-row td { color: #166534; font-size: 16px; }
            .net-pay-box {
              background: linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%);
              color: white;
              padding: 24px;
              border-radius: 12px;
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin: 20px 0;
            }
            .net-pay-box .label { font-size: 16px; opacity: 0.9; }
            .net-pay-box .amount { font-size: 32px; font-weight: 700; }
            .payment-info {
              background: #fffbeb;
              border: 1px solid #fde68a;
              border-radius: 8px;
              padding: 16px;
              margin: 20px 0;
            }
            .payment-info h4 { color: #92400e; font-size: 12px; text-transform: uppercase; margin-bottom: 8px; }
            .payment-info p { font-size: 13px; color: #78350f; }
            .footer {
              text-align: center;
              padding: 20px;
              background: #f8fafc;
              border-top: 1px solid #e5e7eb;
            }
            .footer p { font-size: 11px; color: #6b7280; margin: 4px 0; }
            .footer .company { font-weight: 600; color: #1e3a8a; }
            @media print {
              body { padding: 20px; }
              .payslip-container { border: none; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 300);
  };
  
  const getPaymentTypeLabel = () => {
    const type = PAYMENT_TYPES.find(t => t.code === payslipData.payment_type);
    return type ? type.name : 'Payment Voucher';
  };
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Payment Voucher Preview</h3>
            <p className="text-sm text-gray-500">{getPaymentTypeLabel()}</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={handlePrint}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/25 transition-all"
            >
              <Download className="h-4 w-4" /> Download PDF
            </button>
            <button onClick={onClose} className="p-2.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>
        
        <div id="payslip-content" className="p-6">
          <div className="payslip-container border rounded-xl overflow-hidden">
            {/* Header */}
            <div className="header bg-gradient-to-r from-blue-900 to-blue-600 text-white p-8 flex justify-between items-center">
              <div className="logo-section">
                <img src={COMPANY_LOGO} alt="WiseDrive" className="h-12" crossOrigin="anonymous" />
              </div>
              <div className="voucher-info text-right">
                <h2 className="text-2xl font-semibold">{getPaymentTypeLabel()}</h2>
                <p className="opacity-90">{MONTHS[payslipData.month - 1]} {payslipData.year}</p>
              </div>
            </div>
            
            {/* Content */}
            <div className="content p-8">
              {/* Info Grid */}
              <div className="info-grid grid grid-cols-2 gap-6 mb-8">
                <div className="info-box bg-slate-50 rounded-lg p-5">
                  <h4 className="text-xs uppercase tracking-wide text-blue-900 font-semibold mb-3">
                    {isB2B ? 'Vendor Details' : 'Employee Details'}
                  </h4>
                  <div className="space-y-2">
                    <div className="info-row flex justify-between text-sm border-b border-gray-200 pb-2">
                      <span className="text-gray-500">Name:</span>
                      <span className="font-medium">{payslipData.employee_name || payslipData.vendor_name}</span>
                    </div>
                    {!isB2B && (
                      <>
                        <div className="info-row flex justify-between text-sm border-b border-gray-200 pb-2">
                          <span className="text-gray-500">Employee ID:</span>
                          <span className="font-medium">{payslipData.employee_code || 'N/A'}</span>
                        </div>
                        <div className="info-row flex justify-between text-sm border-b border-gray-200 pb-2">
                          <span className="text-gray-500">Department:</span>
                          <span className="font-medium">{payslipData.department || 'N/A'}</span>
                        </div>
                        <div className="info-row flex justify-between text-sm">
                          <span className="text-gray-500">Designation:</span>
                          <span className="font-medium">{payslipData.designation || 'N/A'}</span>
                        </div>
                      </>
                    )}
                    {isB2B && (
                      <>
                        <div className="info-row flex justify-between text-sm border-b border-gray-200 pb-2">
                          <span className="text-gray-500">GSTIN:</span>
                          <span className="font-medium">{payslipData.gstin || 'N/A'}</span>
                        </div>
                        <div className="info-row flex justify-between text-sm">
                          <span className="text-gray-500">PAN:</span>
                          <span className="font-medium">{payslipData.pan_number || 'N/A'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="info-box bg-slate-50 rounded-lg p-5">
                  <h4 className="text-xs uppercase tracking-wide text-blue-900 font-semibold mb-3">
                    {isB2B ? 'Payment Details' : 'Bank Details'}
                  </h4>
                  <div className="space-y-2">
                    {!isB2B && (
                      <>
                        <div className="info-row flex justify-between text-sm border-b border-gray-200 pb-2">
                          <span className="text-gray-500">Bank:</span>
                          <span className="font-medium">{payslipData.bank_name || 'N/A'}</span>
                        </div>
                        <div className="info-row flex justify-between text-sm border-b border-gray-200 pb-2">
                          <span className="text-gray-500">Account No:</span>
                          <span className="font-medium">{payslipData.account_number ? `****${payslipData.account_number.slice(-4)}` : 'N/A'}</span>
                        </div>
                        <div className="info-row flex justify-between text-sm border-b border-gray-200 pb-2">
                          <span className="text-gray-500">IFSC:</span>
                          <span className="font-medium">{payslipData.ifsc_code || 'N/A'}</span>
                        </div>
                        <div className="info-row flex justify-between text-sm">
                          <span className="text-gray-500">PAN:</span>
                          <span className="font-medium">{payslipData.pan_number || 'N/A'}</span>
                        </div>
                      </>
                    )}
                    {isB2B && (
                      <>
                        <div className="info-row flex justify-between text-sm border-b border-gray-200 pb-2">
                          <span className="text-gray-500">Invoice No:</span>
                          <span className="font-medium">{payslipData.invoice_number || 'N/A'}</span>
                        </div>
                        <div className="info-row flex justify-between text-sm border-b border-gray-200 pb-2">
                          <span className="text-gray-500">Invoice Date:</span>
                          <span className="font-medium">{payslipData.invoice_date || 'N/A'}</span>
                        </div>
                        <div className="info-row flex justify-between text-sm">
                          <span className="text-gray-500">Due Date:</span>
                          <span className="font-medium">{payslipData.due_date || 'N/A'}</span>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Amount Table */}
              <table className="amount-table w-full border-collapse mb-6">
                <thead>
                  <tr>
                    <th className="bg-slate-100 px-4 py-3 text-left text-xs uppercase tracking-wide text-slate-600 font-semibold">Description</th>
                    <th className="bg-slate-100 px-4 py-3 text-right text-xs uppercase tracking-wide text-slate-600 font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {isB2B ? (
                    <>
                      <tr>
                        <td className="px-4 py-3 border-b border-gray-100">Actual Amount</td>
                        <td className="px-4 py-3 border-b border-gray-100 text-right font-medium">{payslipData.currency_symbol}{payslipData.actual_amount?.toLocaleString() || payslipData.gross_amount?.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 border-b border-gray-100">GST ({payslipData.gst_percentage || 18}%)</td>
                        <td className="px-4 py-3 border-b border-gray-100 text-right font-medium">{payslipData.currency_symbol}{payslipData.gst_amount?.toLocaleString() || 0}</td>
                      </tr>
                      <tr className="text-red-600">
                        <td className="px-4 py-3 border-b border-gray-100">TDS Deducted ({payslipData.tds_percentage || 10}%)</td>
                        <td className="px-4 py-3 border-b border-gray-100 text-right font-medium">-{payslipData.currency_symbol}{payslipData.tds_amount?.toLocaleString() || payslipData.deductions?.toLocaleString()}</td>
                      </tr>
                    </>
                  ) : isMechanic ? (
                    <>
                      <tr>
                        <td className="px-4 py-3 border-b border-gray-100">Inspections ({payslipData.inspections_count} × {payslipData.currency_symbol}{payslipData.rate_per_inspection})</td>
                        <td className="px-4 py-3 border-b border-gray-100 text-right font-medium">{payslipData.currency_symbol}{payslipData.total_inspection_pay?.toLocaleString()}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 border-b border-gray-100">Bonus / Incentive</td>
                        <td className="px-4 py-3 border-b border-gray-100 text-right font-medium">{payslipData.currency_symbol}{payslipData.bonus_amount?.toLocaleString() || 0}</td>
                      </tr>
                      <tr className="text-red-600">
                        <td className="px-4 py-3 border-b border-gray-100">Deductions</td>
                        <td className="px-4 py-3 border-b border-gray-100 text-right font-medium">-{payslipData.currency_symbol}{payslipData.total_deductions?.toLocaleString() || 0}</td>
                      </tr>
                    </>
                  ) : (
                    <>
                      <tr>
                        <td className="px-4 py-3 border-b border-gray-100">Basic Salary</td>
                        <td className="px-4 py-3 border-b border-gray-100 text-right font-medium">{payslipData.currency_symbol}{payslipData.basic_salary?.toLocaleString() || 0}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 border-b border-gray-100">HRA</td>
                        <td className="px-4 py-3 border-b border-gray-100 text-right font-medium">{payslipData.currency_symbol}{payslipData.hra?.toLocaleString() || 0}</td>
                      </tr>
                      <tr>
                        <td className="px-4 py-3 border-b border-gray-100">Allowances</td>
                        <td className="px-4 py-3 border-b border-gray-100 text-right font-medium">{payslipData.currency_symbol}{((payslipData.conveyance_allowance || 0) + (payslipData.medical_allowance || 0) + (payslipData.special_allowance || 0)).toLocaleString()}</td>
                      </tr>
                      <tr className="bg-slate-50 font-semibold">
                        <td className="px-4 py-3 border-b border-gray-200">Gross Amount</td>
                        <td className="px-4 py-3 border-b border-gray-200 text-right">{payslipData.currency_symbol}{payslipData.gross_salary?.toLocaleString() || payslipData.gross_amount?.toLocaleString()}</td>
                      </tr>
                      <tr className="text-red-600">
                        <td className="px-4 py-3 border-b border-gray-100">PF + Tax + Other Deductions</td>
                        <td className="px-4 py-3 border-b border-gray-100 text-right font-medium">-{payslipData.currency_symbol}{payslipData.total_deductions?.toLocaleString() || 0}</td>
                      </tr>
                    </>
                  )}
                  <tr className="total-row bg-green-50 font-bold text-green-800">
                    <td className="px-4 py-4">Final Payout</td>
                    <td className="px-4 py-4 text-right text-lg">{payslipData.currency_symbol}{payslipData.net_salary?.toLocaleString()}</td>
                  </tr>
                </tbody>
              </table>
              
              {/* Net Pay Box */}
              <div className="net-pay-box bg-gradient-to-r from-blue-900 to-blue-600 text-white p-6 rounded-xl flex justify-between items-center">
                <span className="text-lg opacity-90">Final Payout Amount</span>
                <span className="text-3xl font-bold">{payslipData.currency_symbol}{payslipData.net_salary?.toLocaleString()}</span>
              </div>
              
              {/* Payment Info */}
              {payslipData.payment_date && (
                <div className="payment-info bg-amber-50 border border-amber-200 rounded-lg p-4 mt-6">
                  <h4 className="text-xs uppercase tracking-wide text-amber-800 font-semibold mb-2">Payment Information</h4>
                  <div className="grid grid-cols-3 gap-4 text-sm text-amber-900">
                    <p><strong>Date:</strong> {payslipData.payment_date}</p>
                    {payslipData.payment_mode && <p><strong>Mode:</strong> {payslipData.payment_mode.replace(/_/g, ' ').toUpperCase()}</p>}
                    {payslipData.transaction_reference && <p><strong>Ref:</strong> {payslipData.transaction_reference}</p>}
                  </div>
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="footer bg-slate-50 border-t p-6 text-center">
              <p className="text-xs text-gray-500">This is a computer-generated document and does not require a signature.</p>
              <p className="text-xs font-semibold text-blue-900 mt-1">©WiseDrive Technologies Private Limited</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Payment Form Modal - Updated with new payment types
const PaymentFormModal = ({ isOpen, onClose, payment, employees, onSave, paymentModes }) => {
  const [formData, setFormData] = useState({
    employee_id: '',
    vendor_name: '',
    payment_type: 'salary',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    // Non-B2B fields
    gross_amount: 0,
    deductions: 0,
    net_amount: 0,
    // Mechanic fields
    inspections_count: 0,
    rate_per_inspection: 0,
    bonus_amount: 0,
    // B2B fields
    actual_amount: 0,
    gst_percentage: 18,
    gst_amount: 0,
    tds_percentage: 10,
    tds_amount: 0,
    invoice_number: '',
    invoice_date: '',
    // Common
    description: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  
  const isB2B = B2B_PAYMENT_TYPES.includes(formData.payment_type);
  const isMechanic = formData.payment_type === 'mechanic_payout';
  
  useEffect(() => {
    if (payment) {
      setFormData({
        employee_id: payment.employee_id || '',
        vendor_name: payment.vendor_name || '',
        payment_type: payment.payment_type || 'salary',
        month: payment.month || new Date().getMonth() + 1,
        year: payment.year || new Date().getFullYear(),
        gross_amount: payment.gross_amount || 0,
        deductions: payment.deductions || 0,
        net_amount: payment.net_amount || 0,
        inspections_count: payment.inspections_count || 0,
        rate_per_inspection: payment.rate_per_inspection || 0,
        bonus_amount: payment.bonus_amount || 0,
        actual_amount: payment.actual_amount || 0,
        gst_percentage: payment.gst_percentage || 18,
        gst_amount: payment.gst_amount || 0,
        tds_percentage: payment.tds_percentage || 10,
        tds_amount: payment.tds_amount || 0,
        invoice_number: payment.invoice_number || '',
        invoice_date: payment.invoice_date || '',
        description: payment.description || '',
        notes: payment.notes || ''
      });
    } else {
      setFormData({
        employee_id: '',
        vendor_name: '',
        payment_type: 'salary',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        gross_amount: 0,
        deductions: 0,
        net_amount: 0,
        inspections_count: 0,
        rate_per_inspection: 0,
        bonus_amount: 0,
        actual_amount: 0,
        gst_percentage: 18,
        gst_amount: 0,
        tds_percentage: 10,
        tds_amount: 0,
        invoice_number: '',
        invoice_date: '',
        description: '',
        notes: ''
      });
    }
  }, [payment, isOpen]);
  
  // Auto-fill salary info when employee is selected
  useEffect(() => {
    if (formData.employee_id && !payment && !isB2B) {
      const emp = employees.find(e => e.id === formData.employee_id);
      if (emp?.salary_info) {
        if (emp.role_code === 'MECHANIC' || emp.salary_info.employment_type === 'freelancer') {
          setFormData(prev => ({
            ...prev,
            payment_type: 'mechanic_payout',
            rate_per_inspection: emp.salary_info.price_per_inspection || 0
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            gross_amount: emp.salary_info.gross_salary || 0,
            net_amount: emp.salary_info.net_salary || 0,
            deductions: (emp.salary_info.gross_salary || 0) - (emp.salary_info.net_salary || 0)
          }));
        }
      }
    }
  }, [formData.employee_id, employees, payment, isB2B]);
  
  // Calculate net for mechanic
  useEffect(() => {
    if (isMechanic) {
      const total = (formData.inspections_count * formData.rate_per_inspection) + formData.bonus_amount - formData.deductions;
      setFormData(prev => ({ 
        ...prev, 
        net_amount: Math.max(0, total), 
        gross_amount: (formData.inspections_count * formData.rate_per_inspection) + formData.bonus_amount 
      }));
    }
  }, [formData.inspections_count, formData.rate_per_inspection, formData.bonus_amount, formData.deductions, isMechanic]);
  
  // Calculate for B2B payments
  useEffect(() => {
    if (isB2B) {
      const gstAmt = (formData.actual_amount * formData.gst_percentage) / 100;
      const tdsAmt = (formData.actual_amount * formData.tds_percentage) / 100;
      const netAmt = formData.actual_amount + gstAmt - tdsAmt;
      setFormData(prev => ({
        ...prev,
        gst_amount: gstAmt,
        tds_amount: tdsAmt,
        net_amount: Math.max(0, netAmt),
        gross_amount: formData.actual_amount + gstAmt,
        deductions: tdsAmt
      }));
    }
  }, [formData.actual_amount, formData.gst_percentage, formData.tds_percentage, isB2B]);
  
  // Calculate for non-B2B non-mechanic
  useEffect(() => {
    if (!isB2B && !isMechanic) {
      setFormData(prev => ({
        ...prev,
        net_amount: Math.max(0, prev.gross_amount - prev.deductions)
      }));
    }
  }, [formData.gross_amount, formData.deductions, isB2B, isMechanic]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isB2B && !formData.employee_id) {
      toast.error('Please select an employee');
      return;
    }
    if (isB2B && !formData.vendor_name) {
      toast.error('Please enter vendor/payee name');
      return;
    }
    setLoading(true);
    try {
      await onSave(formData, payment?.id);
      onClose();
    } catch (err) {
      // Error handled in parent
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-auto shadow-2xl">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center z-10">
          <div>
            <h3 className="text-lg font-semibold">{payment ? 'Edit Payment' : 'Create Payment'}</h3>
            <p className="text-sm text-gray-500">Fill in the payment details</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Payment Type */}
          <div>
            <label className="block text-sm font-medium mb-2">Payment Type *</label>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_TYPES.map(type => (
                <button
                  key={type.code}
                  type="button"
                  onClick={() => setFormData({ ...formData, payment_type: type.code })}
                  className={`p-3 rounded-lg border-2 text-left transition-all ${
                    formData.payment_type === type.code 
                      ? 'border-blue-500 bg-blue-50' 
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="text-lg">{type.icon}</span>
                  <p className="text-xs font-medium mt-1">{type.name}</p>
                </button>
              ))}
            </div>
          </div>
          
          {/* Employee/Vendor Selection */}
          {!isB2B ? (
            <div>
              <label className="block text-sm font-medium mb-1">Employee *</label>
              <select
                value={formData.employee_id}
                onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={!!payment}
                required
              >
                <option value="">Select Employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} - {emp.role_name || 'Employee'} ({emp.employee_code || emp.email})
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Vendor / Payee Name *</label>
                <input
                  type="text"
                  value={formData.vendor_name}
                  onChange={(e) => setFormData({ ...formData, vendor_name: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter vendor name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Invoice Number</label>
                <input
                  type="text"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500"
                  placeholder="INV-001"
                />
              </div>
            </div>
          )}
          
          {/* Payment Period */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Month *</label>
              <select
                value={formData.month}
                onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500"
                disabled={!!payment}
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Year *</label>
              <select
                value={formData.year}
                onChange={(e) => setFormData({ ...formData, year: parseInt(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500"
                disabled={!!payment}
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Amount Fields based on Payment Type */}
          {isB2B ? (
            /* B2B Payment Fields */
            <div className="bg-purple-50 rounded-xl p-4 space-y-4">
              <h4 className="font-medium text-purple-900 flex items-center gap-2">
                <Building className="h-4 w-4" /> B2B Payment Details
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Actual Amount</label>
                  <input
                    type="number"
                    value={formData.actual_amount}
                    onChange={(e) => setFormData({ ...formData, actual_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">GST %</label>
                  <select
                    value={formData.gst_percentage}
                    onChange={(e) => setFormData({ ...formData, gst_percentage: parseFloat(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2.5"
                  >
                    <option value={0}>0%</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18%</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">GST Amount</label>
                  <input
                    type="number"
                    value={formData.gst_amount}
                    readOnly
                    className="w-full border rounded-lg px-3 py-2.5 bg-gray-50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">TDS %</label>
                  <select
                    value={formData.tds_percentage}
                    onChange={(e) => setFormData({ ...formData, tds_percentage: parseFloat(e.target.value) })}
                    className="w-full border rounded-lg px-3 py-2.5"
                  >
                    <option value={0}>0%</option>
                    <option value={1}>1%</option>
                    <option value={2}>2%</option>
                    <option value={5}>5%</option>
                    <option value={10}>10%</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">TDS Deducted</label>
                  <input
                    type="number"
                    value={formData.tds_amount}
                    readOnly
                    className="w-full border rounded-lg px-3 py-2.5 bg-gray-50"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-green-700">Final Payout</label>
                  <input
                    type="number"
                    value={formData.net_amount}
                    readOnly
                    className="w-full border-2 border-green-300 rounded-lg px-3 py-2.5 bg-green-50 font-bold text-green-700"
                  />
                </div>
              </div>
            </div>
          ) : isMechanic ? (
            /* Mechanic Payment Fields */
            <div className="bg-orange-50 rounded-xl p-4 space-y-4">
              <h4 className="font-medium text-orange-900 flex items-center gap-2">
                🔧 Mechanic Payout Details
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Inspections Count</label>
                  <input
                    type="number"
                    value={formData.inspections_count}
                    onChange={(e) => setFormData({ ...formData, inspections_count: parseInt(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rate Per Inspection</label>
                  <input
                    type="number"
                    value={formData.rate_per_inspection}
                    onChange={(e) => setFormData({ ...formData, rate_per_inspection: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2.5"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Bonus / Incentive</label>
                  <input
                    type="number"
                    value={formData.bonus_amount}
                    onChange={(e) => setFormData({ ...formData, bonus_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Deductions</label>
                  <input
                    type="number"
                    value={formData.deductions}
                    onChange={(e) => setFormData({ ...formData, deductions: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-green-700">Final Payout</label>
                  <input
                    type="number"
                    value={formData.net_amount}
                    readOnly
                    className="w-full border-2 border-green-300 rounded-lg px-3 py-2.5 bg-green-50 font-bold text-green-700"
                  />
                </div>
              </div>
            </div>
          ) : (
            /* Standard Payment Fields (Salary, Admin, Operational, etc.) */
            <div className="bg-indigo-50 rounded-xl p-4 space-y-4">
              <h4 className="font-medium text-indigo-900 flex items-center gap-2">
                💰 Payment Amount Details
              </h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Amount Payable</label>
                  <input
                    type="number"
                    value={formData.gross_amount}
                    onChange={(e) => setFormData({ ...formData, gross_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Deductions</label>
                  <input
                    type="number"
                    value={formData.deductions}
                    onChange={(e) => setFormData({ ...formData, deductions: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2.5"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1 text-green-700">Final Payout</label>
                  <input
                    type="number"
                    value={formData.net_amount}
                    readOnly
                    className="w-full border-2 border-green-300 rounded-lg px-3 py-2.5 bg-green-50 font-bold text-green-700"
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Description / Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Description / Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full border rounded-lg px-3 py-2.5 focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Optional notes or description..."
            />
          </div>
          
          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border rounded-lg hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-medium disabled:opacity-50"
            >
              {loading ? 'Saving...' : (payment ? 'Update Payment' : 'Create Payment')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Payment Proof Upload Modal
const PaymentProofModal = ({ isOpen, onClose, payment, onUpload }) => {
  const [proofs, setProofs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [transactionRef, setTransactionRef] = useState('');
  const fileInputRef = useRef(null);
  
  useEffect(() => {
    if (isOpen && payment) {
      fetchProofs();
    }
  }, [isOpen, payment]);
  
  const fetchProofs = async () => {
    if (!payment) return;
    setLoading(true);
    try {
      const res = await financeApi.getProofs(payment.id);
      setProofs(res.data);
    } catch (err) {
      console.error('Failed to fetch proofs:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Please upload an image (JPG, PNG) or PDF file');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }
    
    setUploading(true);
    try {
      // Convert to base64 for storage (in production, use a proper file storage service)
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result;
        await financeApi.addProof(payment.id, {
          file_name: file.name,
          file_url: base64,
          file_type: file.type.startsWith('image/') ? 'image' : 'pdf'
        });
        toast.success('Proof uploaded successfully');
        fetchProofs();
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error('Failed to upload proof');
    } finally {
      setUploading(false);
    }
  };
  
  const handleDeleteProof = async (proofId) => {
    if (!window.confirm('Delete this proof?')) return;
    try {
      await financeApi.deleteProof(payment.id, proofId);
      toast.success('Proof deleted');
      fetchProofs();
    } catch (err) {
      toast.error('Failed to delete proof');
    }
  };
  
  if (!isOpen || !payment) return null;
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="border-b px-6 py-4 flex justify-between items-center">
          <div>
            <h3 className="text-lg font-semibold">Payment Proofs</h3>
            <p className="text-sm text-gray-500">{payment.employee_name || payment.vendor_name} - {MONTHS[payment.month - 1]} {payment.year}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          {/* Upload Area */}
          <div 
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileSelect}
              className="hidden"
            />
            <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
            <p className="font-medium text-gray-700">
              {uploading ? 'Uploading...' : 'Click to upload payment proof'}
            </p>
            <p className="text-sm text-gray-500 mt-1">JPG, PNG, PDF up to 5MB</p>
          </div>
          
          {/* Existing Proofs */}
          {loading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            </div>
          ) : proofs.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Uploaded Proofs</h4>
              {proofs.map((proof) => (
                <div key={proof.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {proof.file_type === 'image' ? (
                      <Image className="h-5 w-5 text-blue-500" />
                    ) : (
                      <File className="h-5 w-5 text-red-500" />
                    )}
                    <div>
                      <p className="text-sm font-medium truncate max-w-[200px]">{proof.file_name}</p>
                      <p className="text-xs text-gray-500">{new Date(proof.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={proof.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                    <button
                      onClick={() => handleDeleteProof(proof.id)}
                      className="p-1.5 text-red-500 hover:bg-red-100 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-4">No proofs uploaded yet</p>
          )}
        </div>
        
        <div className="border-t px-6 py-4">
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

// Mark as Paid Modal
const MarkPaidModal = ({ isOpen, onClose, payment, paymentModes, onSave }) => {
  const [formData, setFormData] = useState({
    payment_mode: 'bank_transfer',
    transaction_reference: '',
    payment_date: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave(payment.id, formData);
      onClose();
    } catch (err) {
      // Error handled in parent
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="border-b px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold">Mark as Paid</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-green-50 rounded-xl p-4 text-center">
            <p className="text-sm text-green-600">Final Payout</p>
            <p className="text-3xl font-bold text-green-700">
              {payment?.currency === 'MYR' ? 'RM' : '₹'}{payment?.net_amount?.toLocaleString()}
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Payment Mode *</label>
            <select
              value={formData.payment_mode}
              onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
              className="w-full border rounded-lg px-3 py-2.5"
              required
            >
              {paymentModes.map(mode => (
                <option key={mode.code} value={mode.code}>{mode.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Payment Date *</label>
            <input
              type="date"
              value={formData.payment_date}
              onChange={(e) => setFormData({ ...formData, payment_date: e.target.value })}
              className="w-full border rounded-lg px-3 py-2.5"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Transaction Reference</label>
            <input
              type="text"
              value={formData.transaction_reference}
              onChange={(e) => setFormData({ ...formData, transaction_reference: e.target.value })}
              className="w-full border rounded-lg px-3 py-2.5"
              placeholder="UTR / Cheque No / Reference"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border rounded-lg hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 font-medium disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Confirm Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Approval Modal
const ApprovalModal = ({ isOpen, onClose, payment, onApprove }) => {
  const [action, setAction] = useState('approve');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (action === 'reject' && !reason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    setLoading(true);
    try {
      await onApprove(payment.id, { action, reason: reason.trim() || null });
      onClose();
    } catch (err) {
      // Error handled in parent
    } finally {
      setLoading(false);
    }
  };
  
  if (!isOpen || !payment) return null;
  
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl">
        <div className="border-b px-6 py-4">
          <h3 className="text-lg font-semibold">Approve/Reject Payment</h3>
          <p className="text-sm text-gray-500 mt-1">
            {payment.employee_name || payment.vendor_name} - {MONTHS[payment.month - 1]} {payment.year}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-xl p-4 text-center">
            <p className="text-sm text-gray-500">Final Payout</p>
            <p className="text-2xl font-bold text-blue-700">
              {payment.currency === 'MYR' ? 'RM' : '₹'}{payment.net_amount?.toLocaleString()}
            </p>
            <PaymentTypeBadge type={payment.payment_type} />
          </div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setAction('approve')}
              className={`flex-1 py-3 rounded-xl border-2 flex items-center justify-center gap-2 font-medium transition-all ${action === 'approve' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <CheckCircle className="h-5 w-5" /> Approve
            </button>
            <button
              type="button"
              onClick={() => setAction('reject')}
              className={`flex-1 py-3 rounded-xl border-2 flex items-center justify-center gap-2 font-medium transition-all ${action === 'reject' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <XCircle className="h-5 w-5" /> Reject
            </button>
          </div>
          
          {action === 'reject' && (
            <div>
              <label className="block text-sm font-medium mb-1">Rejection Reason *</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5"
                rows={3}
                placeholder="Explain why this payment is being rejected..."
                required
              />
            </div>
          )}
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border rounded-lg hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 px-4 py-2.5 text-white rounded-lg font-medium disabled:opacity-50 ${action === 'approve' ? 'bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800' : 'bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800'}`}
            >
              {loading ? 'Processing...' : (action === 'approve' ? 'Approve' : 'Reject')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Main Finance Page Component
const FinancePage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('payments');
  const [payments, setPayments] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [summary, setSummary] = useState(null);
  const [paymentModes, setPaymentModes] = useState([]);
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [showPayslip, setShowPayslip] = useState(false);
  const [showProofs, setShowProofs] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [payslipData, setPayslipData] = useState(null);
  
  const roleCode = user?.role_code || '';
  const isCountryHead = roleCode === 'COUNTRY_HEAD';
  const isFinanceManager = roleCode === 'FINANCE_MANAGER';
  const isCEO = roleCode === 'CEO';
  const canApprove = isCEO || isCountryHead;
  const canCreate = isCEO || isFinanceManager;
  
  // Fetch data
  const fetchPayments = useCallback(async () => {
    try {
      const params = { month: selectedMonth, year: selectedYear };
      if (selectedCountry) params.country_id = selectedCountry;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedType) params.payment_type = selectedType;
      
      const res = await financeApi.getPayments(params);
      let filtered = res.data;
      
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(p => 
          p.employee_name?.toLowerCase().includes(term) ||
          p.employee_email?.toLowerCase().includes(term) ||
          p.employee_code?.toLowerCase().includes(term) ||
          p.vendor_name?.toLowerCase().includes(term)
        );
      }
      
      setPayments(filtered);
    } catch (err) {
      toast.error('Failed to load payments');
    }
  }, [selectedCountry, selectedMonth, selectedYear, selectedStatus, selectedType, searchTerm]);
  
  const fetchSummary = useCallback(async () => {
    try {
      const params = { month: selectedMonth, year: selectedYear };
      if (selectedCountry) params.country_id = selectedCountry;
      const res = await financeApi.getSummary(params);
      setSummary(res.data);
    } catch (err) {
      console.error('Failed to load summary:', err);
    }
  }, [selectedCountry, selectedMonth, selectedYear]);
  
  const fetchEmployees = useCallback(async () => {
    try {
      const params = {};
      if (selectedCountry) params.country_id = selectedCountry;
      const res = await financeApi.getEmployees(params);
      setEmployees(res.data);
    } catch (err) {
      console.error('Failed to load employees:', err);
    }
  }, [selectedCountry]);
  
  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [modesRes, countriesRes] = await Promise.all([
          financeApi.getPaymentModes(),
          countriesApi.getAll()
        ]);
        setPaymentModes(modesRes.data);
        setCountries(countriesRes.data);
      } catch (err) {
        console.error('Init error:', err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);
  
  useEffect(() => {
    if (!loading) {
      fetchPayments();
      fetchSummary();
      fetchEmployees();
    }
  }, [loading, fetchPayments, fetchSummary, fetchEmployees]);
  
  // Handlers
  const handleSavePayment = async (data, paymentId) => {
    try {
      if (paymentId) {
        await financeApi.updatePayment(paymentId, data);
        toast.success('Payment updated');
      } else {
        await financeApi.createPayment(data);
        toast.success('Payment created');
      }
      fetchPayments();
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to save payment');
      throw err;
    }
  };
  
  const handleSubmitForApproval = async (paymentId) => {
    try {
      await financeApi.submitForApproval(paymentId);
      toast.success('Submitted for approval');
      fetchPayments();
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to submit');
    }
  };
  
  const handleApprove = async (paymentId, data) => {
    try {
      await financeApi.approvePayment(paymentId, data);
      toast.success(`Payment ${data.action}d`);
      fetchPayments();
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to process');
      throw err;
    }
  };
  
  const handleMarkPaid = async (paymentId, data) => {
    try {
      await financeApi.markAsPaid(paymentId, data);
      toast.success('Payment marked as paid');
      fetchPayments();
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to mark as paid');
      throw err;
    }
  };
  
  const handleDelete = async (paymentId) => {
    if (!window.confirm('Delete this payment record?')) return;
    try {
      await financeApi.deletePayment(paymentId);
      toast.success('Payment deleted');
      fetchPayments();
      fetchSummary();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Failed to delete');
    }
  };
  
  const handleViewPayslip = async (payment) => {
    try {
      const res = await financeApi.getPayslip(payment.id);
      setPayslipData({ ...res.data, payment_type: payment.payment_type });
      setShowPayslip(true);
    } catch (err) {
      toast.error('Failed to load payslip');
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }
  
  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="finance-page">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
          <p className="text-gray-500 mt-1">Manage payments, payouts and expenses</p>
        </div>
        {canCreate && (
          <button
            onClick={() => { setSelectedPayment(null); setShowPaymentForm(true); }}
            className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/25 transition-all"
            data-testid="create-payment-btn"
          >
            <Plus className="h-4 w-4" /> Create Payment
          </button>
        )}
      </div>
      
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-5 py-2.5 font-medium rounded-lg transition-all ${activeTab === 'payments' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
          data-testid="payments-tab"
        >
          <DollarSign className="h-4 w-4 inline mr-2" />
          Payments
        </button>
        {canApprove && (
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-5 py-2.5 font-medium rounded-lg transition-all flex items-center gap-2 ${activeTab === 'approvals' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
            data-testid="approvals-tab"
          >
            <CheckCircle className="h-4 w-4" />
            Pending Approvals
            {summary?.pending_approvals > 0 && (
              <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full font-bold">
                {summary.pending_approvals}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-5 py-2.5 font-medium rounded-lg transition-all ${activeTab === 'summary' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
          data-testid="summary-tab"
        >
          <FileText className="h-4 w-4 inline mr-2" />
          Summary
        </button>
      </div>
      
      {/* Filters */}
      <div className="bg-white rounded-xl border p-5 mb-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          {isCEO && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">Country</label>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Countries</option>
                {countries.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              {PAYMENT_TYPES.map(t => (
                <option key={t.code} value={t.code}>{t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search..."
                className="w-full border rounded-lg pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
        </div>
      </div>
      
      {/* Summary Tab */}
      {activeTab === 'summary' && summary && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <SummaryCard 
              title="Total Employees" 
              value={summary.total_employees} 
              icon={Users}
              color="text-blue-600"
              bgColor="bg-blue-50"
            />
            <SummaryCard 
              title="Total Paid" 
              value={`₹${(payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.net_amount, 0) / 1000).toFixed(0)}K`}
              subtitle={`${summary.paid_payments} payments`}
              icon={CheckCircle}
              color="text-emerald-600"
              bgColor="bg-emerald-50"
            />
            <SummaryCard 
              title="Pending Approval" 
              value={summary.pending_approvals} 
              subtitle="Awaiting review"
              icon={Clock}
              color="text-amber-600"
              bgColor="bg-amber-50"
            />
            <SummaryCard 
              title="Total This Month" 
              value={`₹${(summary.total_amount_this_month / 1000).toFixed(0)}K`}
              subtitle={`${summary.total_payments_this_month} payments`}
              icon={DollarSign}
              color="text-indigo-600"
              bgColor="bg-indigo-50"
            />
          </div>
          
          {/* Status Breakdown */}
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Payment Status Breakdown</h3>
            <div className="grid grid-cols-5 gap-4">
              <div className="text-center p-4 bg-amber-50 rounded-xl border border-amber-200">
                <p className="text-3xl font-bold text-amber-600">{summary.status_breakdown?.pending || 0}</p>
                <p className="text-sm text-amber-700 mt-1">Pending</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-200">
                <p className="text-3xl font-bold text-blue-600">{summary.status_breakdown?.submitted || 0}</p>
                <p className="text-sm text-blue-700 mt-1">Submitted</p>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-200">
                <p className="text-3xl font-bold text-emerald-600">{summary.status_breakdown?.approved || 0}</p>
                <p className="text-sm text-emerald-700 mt-1">Approved</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-xl border border-green-200">
                <p className="text-3xl font-bold text-green-600">{summary.status_breakdown?.paid || 0}</p>
                <p className="text-sm text-green-700 mt-1">Paid</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-xl border border-red-200">
                <p className="text-3xl font-bold text-red-600">{summary.status_breakdown?.rejected || 0}</p>
                <p className="text-sm text-red-700 mt-1">Rejected</p>
              </div>
            </div>
          </div>
          
          {/* Monthly Trend */}
          <div className="bg-white rounded-xl border p-6 shadow-sm">
            <h3 className="font-semibold mb-4">Monthly Trend (Last 6 Months)</h3>
            <div className="grid grid-cols-6 gap-3">
              {summary.monthly_trend?.map((item, idx) => (
                <div key={idx} className="text-center p-4 bg-gradient-to-b from-slate-50 to-white rounded-xl border">
                  <p className="text-xs text-gray-500 font-medium">{MONTHS[item.month - 1]?.slice(0, 3)} {item.year}</p>
                  <p className="text-xl font-bold text-blue-700 mt-1">₹{(item.total_amount / 1000).toFixed(0)}K</p>
                  <p className="text-xs text-gray-400">{item.count} payments</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Approvals Tab */}
      {activeTab === 'approvals' && canApprove && (
        <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
          <table className="w-full" data-testid="approvals-table">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payee</th>
                <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Period</th>
                <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-5 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted By</th>
                <th className="px-5 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.filter(p => p.status === 'submitted').length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-300 mb-3" />
                    <p className="text-gray-500 font-medium">No pending approvals</p>
                    <p className="text-gray-400 text-sm">All payments have been processed</p>
                  </td>
                </tr>
              ) : (
                payments.filter(p => p.status === 'submitted').map(payment => (
                  <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{payment.employee_name || payment.vendor_name}</p>
                        <p className="text-xs text-gray-500">{payment.employee_role || 'Vendor'}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">
                      {MONTHS[payment.month - 1]} {payment.year}
                    </td>
                    <td className="px-5 py-4">
                      <PaymentTypeBadge type={payment.payment_type} />
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-gray-900">
                      ₹{payment.net_amount?.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-500">
                      {payment.submitted_by_name}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <button
                        onClick={() => { setSelectedPayment(payment); setShowApproval(true); }}
                        className="px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg text-sm font-medium hover:from-blue-700 hover:to-blue-800 shadow-sm"
                        data-testid={`approve-payment-${payment.id}`}
                      >
                        Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Payments Tab */}
      {activeTab === 'payments' && (
        <div className="bg-white rounded-xl border overflow-hidden shadow-sm">
          <table className="w-full" data-testid="payments-table">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Payee</th>
                <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Period</th>
                <th className="px-5 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                <th className="px-5 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Gross</th>
                <th className="px-5 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Net</th>
                <th className="px-5 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center">
                    <DollarSign className="h-12 w-12 mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">No payments found</p>
                    <p className="text-gray-400 text-sm">Create a new payment to get started</p>
                  </td>
                </tr>
              ) : (
                payments.map(payment => (
                  <tr key={payment.id} className="hover:bg-slate-50 transition-colors" data-testid={`payment-row-${payment.id}`}>
                    <td className="px-5 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{payment.employee_name || payment.vendor_name}</p>
                        <p className="text-xs text-gray-500">{payment.employee_role || 'Vendor'} {payment.employee_code && `• ${payment.employee_code}`}</p>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-600">
                      {MONTHS[payment.month - 1]} {payment.year}
                    </td>
                    <td className="px-5 py-4">
                      <PaymentTypeBadge type={payment.payment_type} />
                    </td>
                    <td className="px-5 py-4 text-right text-sm text-gray-600">
                      ₹{payment.gross_amount?.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-gray-900">
                      ₹{payment.net_amount?.toLocaleString()}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <StatusBadge status={payment.status} />
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-center gap-1">
                        {/* View Payslip */}
                        {(payment.status === 'approved' || payment.status === 'paid') && (
                          <button
                            onClick={() => handleViewPayslip(payment)}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="View Voucher"
                            data-testid={`view-payslip-${payment.id}`}
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                        )}
                        
                        {/* Upload Proof */}
                        {(payment.status === 'approved' || payment.status === 'paid') && canCreate && (
                          <button
                            onClick={() => { setSelectedPayment(payment); setShowProofs(true); }}
                            className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors relative"
                            title="Payment Proofs"
                            data-testid={`proofs-${payment.id}`}
                          >
                            <Paperclip className="h-4 w-4" />
                            {payment.proof_count > 0 && (
                              <span className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                                {payment.proof_count}
                              </span>
                            )}
                          </button>
                        )}
                        
                        {/* Edit */}
                        {payment.status === 'pending' && canCreate && (
                          <button
                            onClick={() => { setSelectedPayment(payment); setShowPaymentForm(true); }}
                            className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                            data-testid={`edit-payment-${payment.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        
                        {/* Submit for Approval */}
                        {payment.status === 'pending' && canCreate && (
                          <button
                            onClick={() => handleSubmitForApproval(payment.id)}
                            className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Submit for Approval"
                            data-testid={`submit-payment-${payment.id}`}
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        )}
                        
                        {/* Mark as Paid */}
                        {payment.status === 'approved' && (canCreate || canApprove) && (
                          <button
                            onClick={() => { setSelectedPayment(payment); setShowMarkPaid(true); }}
                            className="p-2 text-gray-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Mark as Paid"
                            data-testid={`mark-paid-${payment.id}`}
                          >
                            <CreditCard className="h-4 w-4" />
                          </button>
                        )}
                        
                        {/* Delete */}
                        {payment.status === 'pending' && canCreate && (
                          <button
                            onClick={() => handleDelete(payment.id)}
                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete"
                            data-testid={`delete-payment-${payment.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Modals */}
      <PaymentFormModal
        isOpen={showPaymentForm}
        onClose={() => { setShowPaymentForm(false); setSelectedPayment(null); }}
        payment={selectedPayment}
        employees={employees}
        onSave={handleSavePayment}
        paymentModes={paymentModes}
      />
      
      <MarkPaidModal
        isOpen={showMarkPaid}
        onClose={() => { setShowMarkPaid(false); setSelectedPayment(null); }}
        payment={selectedPayment}
        paymentModes={paymentModes}
        onSave={handleMarkPaid}
      />
      
      <ApprovalModal
        isOpen={showApproval}
        onClose={() => { setShowApproval(false); setSelectedPayment(null); }}
        payment={selectedPayment}
        onApprove={handleApprove}
      />
      
      <PayslipModal
        isOpen={showPayslip}
        onClose={() => { setShowPayslip(false); setPayslipData(null); }}
        payslipData={payslipData}
      />
      
      <PaymentProofModal
        isOpen={showProofs}
        onClose={() => { setShowProofs(false); setSelectedPayment(null); }}
        payment={selectedPayment}
      />
    </div>
  );
};

export default FinancePage;
