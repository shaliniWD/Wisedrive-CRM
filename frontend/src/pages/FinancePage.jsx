import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { financeApi, countriesApi } from '../services/api';
import { toast } from 'sonner';
import { 
  DollarSign, Users, FileText, Check, X, Clock, 
  Download, Upload, Eye, Edit2, Trash2, Plus, 
  ChevronDown, Search, Filter, Calendar, Building,
  CreditCard, CheckCircle, XCircle, AlertCircle, Send
} from 'lucide-react';

// Month names
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Status badge component
const StatusBadge = ({ status }) => {
  const config = {
    pending: { color: 'bg-yellow-100 text-yellow-800', icon: Clock, label: 'Pending' },
    submitted: { color: 'bg-blue-100 text-blue-800', icon: Send, label: 'Submitted' },
    approved: { color: 'bg-green-100 text-green-800', icon: CheckCircle, label: 'Approved' },
    rejected: { color: 'bg-red-100 text-red-800', icon: XCircle, label: 'Rejected' },
    paid: { color: 'bg-emerald-100 text-emerald-800', icon: Check, label: 'Paid' }
  };
  
  const cfg = config[status] || config.pending;
  const Icon = cfg.icon;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
};

// Summary Card
const SummaryCard = ({ title, value, subtitle, icon: Icon, color }) => (
  <div className="bg-white rounded-lg border border-gray-200 p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className={`text-2xl font-bold ${color || 'text-gray-900'}`}>{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
      </div>
      <div className={`p-3 rounded-full ${color ? color.replace('text-', 'bg-').replace('900', '100').replace('800', '100') : 'bg-gray-100'}`}>
        <Icon className={`h-6 w-6 ${color || 'text-gray-600'}`} />
      </div>
    </div>
  </div>
);

// Payslip PDF Generator Component
const PayslipModal = ({ isOpen, onClose, payslipData }) => {
  if (!isOpen || !payslipData) return null;
  
  const handlePrint = () => {
    const printContent = document.getElementById('payslip-content');
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Payslip - ${payslipData.employee_name} - ${MONTHS[payslipData.month - 1]} ${payslipData.year}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .header { text-align: center; border-bottom: 2px solid #2E3192; padding-bottom: 20px; margin-bottom: 20px; }
            .company-name { font-size: 24px; font-weight: bold; color: #2E3192; }
            .section { margin: 20px 0; }
            .section-title { font-weight: bold; color: #2E3192; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-bottom: 10px; }
            .row { display: flex; justify-content: space-between; padding: 5px 0; }
            .label { color: #666; }
            .value { font-weight: 500; }
            .total-row { background: #f8f9fa; padding: 10px; margin-top: 10px; font-weight: bold; }
            .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #666; }
            table { width: 100%; border-collapse: collapse; margin: 10px 0; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f8f9fa; }
            @media print { body { padding: 0; } }
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
    }, 250);
  };
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold">Payslip Preview</h3>
          <div className="flex gap-2">
            <button 
              onClick={handlePrint}
              className="px-4 py-2 bg-[#2E3192] text-white rounded-lg hover:bg-[#252879] flex items-center gap-2"
            >
              <Download className="h-4 w-4" /> Download PDF
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        
        <div id="payslip-content" className="p-6">
          {/* Header */}
          <div className="header text-center border-b-2 border-[#2E3192] pb-4 mb-6">
            <h1 className="company-name text-2xl font-bold text-[#2E3192]">{payslipData.company_name}</h1>
            <p className="text-gray-500">{payslipData.company_address}</p>
            <h2 className="mt-4 text-lg font-semibold">
              Payslip for {MONTHS[payslipData.month - 1]} {payslipData.year}
            </h2>
          </div>
          
          {/* Employee Details */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="section">
              <h4 className="section-title font-semibold text-[#2E3192] border-b pb-1 mb-2">Employee Details</h4>
              <div className="space-y-1 text-sm">
                <div className="row flex justify-between"><span className="text-gray-500">Name:</span> <span className="font-medium">{payslipData.employee_name}</span></div>
                <div className="row flex justify-between"><span className="text-gray-500">Employee ID:</span> <span className="font-medium">{payslipData.employee_code || 'N/A'}</span></div>
                <div className="row flex justify-between"><span className="text-gray-500">Department:</span> <span className="font-medium">{payslipData.department || 'N/A'}</span></div>
                <div className="row flex justify-between"><span className="text-gray-500">Designation:</span> <span className="font-medium">{payslipData.designation || 'N/A'}</span></div>
              </div>
            </div>
            <div className="section">
              <h4 className="section-title font-semibold text-[#2E3192] border-b pb-1 mb-2">Bank Details</h4>
              <div className="space-y-1 text-sm">
                <div className="row flex justify-between"><span className="text-gray-500">Bank:</span> <span className="font-medium">{payslipData.bank_name || 'N/A'}</span></div>
                <div className="row flex justify-between"><span className="text-gray-500">Account No:</span> <span className="font-medium">{payslipData.account_number ? `****${payslipData.account_number.slice(-4)}` : 'N/A'}</span></div>
                <div className="row flex justify-between"><span className="text-gray-500">IFSC:</span> <span className="font-medium">{payslipData.ifsc_code || 'N/A'}</span></div>
                <div className="row flex justify-between"><span className="text-gray-500">PAN:</span> <span className="font-medium">{payslipData.pan_number || 'N/A'}</span></div>
              </div>
            </div>
          </div>
          
          {/* Earnings & Deductions Table */}
          {!payslipData.is_mechanic ? (
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <h4 className="font-semibold text-[#2E3192] mb-2">Earnings</h4>
                <table className="w-full text-sm">
                  <tbody>
                    <tr><td className="border px-3 py-2 text-gray-600">Basic Salary</td><td className="border px-3 py-2 text-right">{payslipData.currency_symbol}{payslipData.basic_salary?.toLocaleString()}</td></tr>
                    <tr><td className="border px-3 py-2 text-gray-600">HRA</td><td className="border px-3 py-2 text-right">{payslipData.currency_symbol}{payslipData.hra?.toLocaleString()}</td></tr>
                    <tr><td className="border px-3 py-2 text-gray-600">Conveyance</td><td className="border px-3 py-2 text-right">{payslipData.currency_symbol}{payslipData.conveyance_allowance?.toLocaleString()}</td></tr>
                    <tr><td className="border px-3 py-2 text-gray-600">Medical Allowance</td><td className="border px-3 py-2 text-right">{payslipData.currency_symbol}{payslipData.medical_allowance?.toLocaleString()}</td></tr>
                    <tr><td className="border px-3 py-2 text-gray-600">Special Allowance</td><td className="border px-3 py-2 text-right">{payslipData.currency_symbol}{payslipData.special_allowance?.toLocaleString()}</td></tr>
                    <tr className="bg-gray-50 font-semibold"><td className="border px-3 py-2">Gross Salary</td><td className="border px-3 py-2 text-right">{payslipData.currency_symbol}{payslipData.gross_salary?.toLocaleString()}</td></tr>
                  </tbody>
                </table>
              </div>
              <div>
                <h4 className="font-semibold text-red-600 mb-2">Deductions</h4>
                <table className="w-full text-sm">
                  <tbody>
                    <tr><td className="border px-3 py-2 text-gray-600">PF (Employee)</td><td className="border px-3 py-2 text-right">{payslipData.currency_symbol}{payslipData.pf_employee?.toLocaleString()}</td></tr>
                    <tr><td className="border px-3 py-2 text-gray-600">Professional Tax</td><td className="border px-3 py-2 text-right">{payslipData.currency_symbol}{payslipData.professional_tax?.toLocaleString()}</td></tr>
                    <tr><td className="border px-3 py-2 text-gray-600">Income Tax (TDS)</td><td className="border px-3 py-2 text-right">{payslipData.currency_symbol}{payslipData.income_tax?.toLocaleString()}</td></tr>
                    <tr><td className="border px-3 py-2 text-gray-600">Other Deductions</td><td className="border px-3 py-2 text-right">{payslipData.currency_symbol}{payslipData.other_deductions?.toLocaleString()}</td></tr>
                    <tr className="bg-red-50 font-semibold"><td className="border px-3 py-2">Total Deductions</td><td className="border px-3 py-2 text-right">{payslipData.currency_symbol}{payslipData.total_deductions?.toLocaleString()}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Mechanic Payout */
            <div className="mb-6">
              <h4 className="font-semibold text-[#2E3192] mb-2">Inspection Payout Details</h4>
              <table className="w-full text-sm">
                <tbody>
                  <tr><td className="border px-3 py-2 text-gray-600">Total Inspections</td><td className="border px-3 py-2 text-right">{payslipData.inspections_count}</td></tr>
                  <tr><td className="border px-3 py-2 text-gray-600">Rate per Inspection</td><td className="border px-3 py-2 text-right">{payslipData.currency_symbol}{payslipData.rate_per_inspection?.toLocaleString()}</td></tr>
                  <tr><td className="border px-3 py-2 text-gray-600">Total Inspection Pay</td><td className="border px-3 py-2 text-right">{payslipData.currency_symbol}{payslipData.total_inspection_pay?.toLocaleString()}</td></tr>
                  <tr><td className="border px-3 py-2 text-gray-600">Bonus</td><td className="border px-3 py-2 text-right">{payslipData.currency_symbol}{payslipData.bonus_amount?.toLocaleString()}</td></tr>
                </tbody>
              </table>
            </div>
          )}
          
          {/* Net Pay */}
          <div className="total-row bg-[#2E3192] text-white p-4 rounded-lg flex justify-between items-center">
            <span className="text-lg">Net Pay</span>
            <span className="text-2xl font-bold">{payslipData.currency_symbol}{payslipData.net_salary?.toLocaleString()}</span>
          </div>
          
          {/* Payment Info */}
          {payslipData.payment_date && (
            <div className="mt-4 text-sm text-gray-600">
              <p><strong>Payment Date:</strong> {payslipData.payment_date}</p>
              {payslipData.payment_mode && <p><strong>Payment Mode:</strong> {payslipData.payment_mode.replace('_', ' ').toUpperCase()}</p>}
              {payslipData.transaction_reference && <p><strong>Reference:</strong> {payslipData.transaction_reference}</p>}
            </div>
          )}
          
          {/* Footer */}
          <div className="footer text-center mt-8 pt-4 border-t text-xs text-gray-500">
            <p>This is a computer-generated payslip and does not require a signature.</p>
            <p>Generated by WiseDrive CRM Finance Module</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// Payment Form Modal
const PaymentFormModal = ({ isOpen, onClose, payment, employees, onSave, paymentModes }) => {
  const [formData, setFormData] = useState({
    employee_id: '',
    payment_type: 'salary',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    gross_amount: 0,
    deductions: 0,
    net_amount: 0,
    inspections_count: 0,
    rate_per_inspection: 0,
    bonus_amount: 0,
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  
  useEffect(() => {
    if (payment) {
      setFormData({
        employee_id: payment.employee_id || '',
        payment_type: payment.payment_type || 'salary',
        month: payment.month || new Date().getMonth() + 1,
        year: payment.year || new Date().getFullYear(),
        gross_amount: payment.gross_amount || 0,
        deductions: payment.deductions || 0,
        net_amount: payment.net_amount || 0,
        inspections_count: payment.inspections_count || 0,
        rate_per_inspection: payment.rate_per_inspection || 0,
        bonus_amount: payment.bonus_amount || 0,
        notes: payment.notes || ''
      });
    } else {
      setFormData({
        employee_id: '',
        payment_type: 'salary',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        gross_amount: 0,
        deductions: 0,
        net_amount: 0,
        inspections_count: 0,
        rate_per_inspection: 0,
        bonus_amount: 0,
        notes: ''
      });
    }
  }, [payment, isOpen]);
  
  // Auto-fill salary info when employee is selected
  useEffect(() => {
    if (formData.employee_id && !payment) {
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
            payment_type: 'salary',
            gross_amount: emp.salary_info.gross_salary || 0,
            net_amount: emp.salary_info.net_salary || 0,
            deductions: (emp.salary_info.gross_salary || 0) - (emp.salary_info.net_salary || 0)
          }));
        }
      }
    }
  }, [formData.employee_id, employees, payment]);
  
  // Calculate net for mechanic
  useEffect(() => {
    if (formData.payment_type === 'mechanic_payout') {
      const total = (formData.inspections_count * formData.rate_per_inspection) + formData.bonus_amount - formData.deductions;
      setFormData(prev => ({ ...prev, net_amount: total, gross_amount: (formData.inspections_count * formData.rate_per_inspection) + formData.bonus_amount }));
    }
  }, [formData.inspections_count, formData.rate_per_inspection, formData.bonus_amount, formData.deductions, formData.payment_type]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.employee_id) {
      toast.error('Please select an employee');
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold">{payment ? 'Edit Payment' : 'Create Payment'}</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Employee Selection */}
          <div>
            <label className="block text-sm font-medium mb-1">Employee *</label>
            <select
              value={formData.employee_id}
              onChange={(e) => setFormData({ ...formData, employee_id: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
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
          
          {/* Payment Period */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Month *</label>
              <select
                value={formData.month}
                onChange={(e) => setFormData({ ...formData, month: parseInt(e.target.value) })}
                className="w-full border rounded-lg px-3 py-2"
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
                className="w-full border rounded-lg px-3 py-2"
                disabled={!!payment}
              >
                {[2024, 2025, 2026, 2027].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Payment Type */}
          <div>
            <label className="block text-sm font-medium mb-1">Payment Type</label>
            <select
              value={formData.payment_type}
              onChange={(e) => setFormData({ ...formData, payment_type: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
            >
              <option value="salary">Salary</option>
              <option value="mechanic_payout">Mechanic / Freelancer Payout</option>
            </select>
          </div>
          
          {/* Salary Fields */}
          {formData.payment_type === 'salary' ? (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Gross Amount</label>
                <input
                  type="number"
                  value={formData.gross_amount}
                  onChange={(e) => {
                    const gross = parseFloat(e.target.value) || 0;
                    setFormData({ ...formData, gross_amount: gross, net_amount: gross - formData.deductions });
                  }}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Deductions</label>
                <input
                  type="number"
                  value={formData.deductions}
                  onChange={(e) => {
                    const ded = parseFloat(e.target.value) || 0;
                    setFormData({ ...formData, deductions: ded, net_amount: formData.gross_amount - ded });
                  }}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Net Amount</label>
                <input
                  type="number"
                  value={formData.net_amount}
                  readOnly
                  className="w-full border rounded-lg px-3 py-2 bg-gray-50"
                />
              </div>
            </div>
          ) : (
            /* Mechanic Fields */
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Inspections Count</label>
                  <input
                    type="number"
                    value={formData.inspections_count}
                    onChange={(e) => setFormData({ ...formData, inspections_count: parseInt(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rate Per Inspection</label>
                  <input
                    type="number"
                    value={formData.rate_per_inspection}
                    onChange={(e) => setFormData({ ...formData, rate_per_inspection: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Bonus</label>
                  <input
                    type="number"
                    value={formData.bonus_amount}
                    onChange={(e) => setFormData({ ...formData, bonus_amount: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Deductions</label>
                  <input
                    type="number"
                    value={formData.deductions}
                    onChange={(e) => setFormData({ ...formData, deductions: parseFloat(e.target.value) || 0 })}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Net Amount</label>
                  <input
                    type="number"
                    value={formData.net_amount}
                    readOnly
                    className="w-full border rounded-lg px-3 py-2 bg-gray-50"
                  />
                </div>
              </div>
            </div>
          )}
          
          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              rows={2}
              placeholder="Optional notes..."
            />
          </div>
          
          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-[#2E3192] text-white rounded-lg hover:bg-[#252879] disabled:opacity-50"
            >
              {loading ? 'Saving...' : (payment ? 'Update' : 'Create')}
            </button>
          </div>
        </form>
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="border-b px-6 py-4 flex justify-between items-center">
          <h3 className="text-lg font-semibold">Mark as Paid</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Payment Mode *</label>
            <select
              value={formData.payment_mode}
              onChange={(e) => setFormData({ ...formData, payment_mode: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
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
              className="w-full border rounded-lg px-3 py-2"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Transaction Reference</label>
            <input
              type="text"
              value={formData.transaction_reference}
              onChange={(e) => setFormData({ ...formData, transaction_reference: e.target.value })}
              className="w-full border rounded-lg px-3 py-2"
              placeholder="UTR / Cheque No / Reference"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
            >
              {loading ? 'Processing...' : 'Mark as Paid'}
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="border-b px-6 py-4">
          <h3 className="text-lg font-semibold">Approve/Reject Payment</h3>
          <p className="text-sm text-gray-500 mt-1">
            {payment.employee_name} - {MONTHS[payment.month - 1]} {payment.year}
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-gray-50 rounded-lg p-4 text-center">
            <p className="text-sm text-gray-500">Net Amount</p>
            <p className="text-2xl font-bold text-[#2E3192]">
              {payment.currency === 'MYR' ? 'RM' : '₹'}{payment.net_amount?.toLocaleString()}
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setAction('approve')}
              className={`flex-1 py-3 rounded-lg border-2 flex items-center justify-center gap-2 ${action === 'approve' ? 'border-green-500 bg-green-50 text-green-700' : 'border-gray-200'}`}
            >
              <CheckCircle className="h-5 w-5" /> Approve
            </button>
            <button
              type="button"
              onClick={() => setAction('reject')}
              className={`flex-1 py-3 rounded-lg border-2 flex items-center justify-center gap-2 ${action === 'reject' ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-200'}`}
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
                className="w-full border rounded-lg px-3 py-2"
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
              className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 px-4 py-2 text-white rounded-lg disabled:opacity-50 ${action === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}`}
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
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showMarkPaid, setShowMarkPaid] = useState(false);
  const [showApproval, setShowApproval] = useState(false);
  const [showPayslip, setShowPayslip] = useState(false);
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
      
      const res = await financeApi.getPayments(params);
      let filtered = res.data;
      
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        filtered = filtered.filter(p => 
          p.employee_name?.toLowerCase().includes(term) ||
          p.employee_email?.toLowerCase().includes(term) ||
          p.employee_code?.toLowerCase().includes(term)
        );
      }
      
      setPayments(filtered);
    } catch (err) {
      toast.error('Failed to load payments');
    }
  }, [selectedCountry, selectedMonth, selectedYear, selectedStatus, searchTerm]);
  
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
      setPayslipData(res.data);
      setShowPayslip(true);
    } catch (err) {
      toast.error('Failed to load payslip');
    }
  };
  
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2E3192]"></div>
      </div>
    );
  }
  
  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="finance-page">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Finance</h1>
          <p className="text-gray-500">Manage salary payments and payouts</p>
        </div>
        {canCreate && (
          <button
            onClick={() => { setSelectedPayment(null); setShowPaymentForm(true); }}
            className="px-4 py-2 bg-[#2E3192] text-white rounded-lg hover:bg-[#252879] flex items-center gap-2"
            data-testid="create-payment-btn"
          >
            <Plus className="h-4 w-4" /> Create Payment
          </button>
        )}
      </div>
      
      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => setActiveTab('payments')}
          className={`px-4 py-2 font-medium border-b-2 -mb-px ${activeTab === 'payments' ? 'border-[#2E3192] text-[#2E3192]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          data-testid="payments-tab"
        >
          <DollarSign className="h-4 w-4 inline mr-2" />
          Payments
        </button>
        {canApprove && (
          <button
            onClick={() => setActiveTab('approvals')}
            className={`px-4 py-2 font-medium border-b-2 -mb-px ${activeTab === 'approvals' ? 'border-[#2E3192] text-[#2E3192]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            data-testid="approvals-tab"
          >
            <CheckCircle className="h-4 w-4 inline mr-2" />
            Pending Approvals
            {summary?.pending_approvals > 0 && (
              <span className="ml-2 px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                {summary.pending_approvals}
              </span>
            )}
          </button>
        )}
        <button
          onClick={() => setActiveTab('summary')}
          className={`px-4 py-2 font-medium border-b-2 -mb-px ${activeTab === 'summary' ? 'border-[#2E3192] text-[#2E3192]' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          data-testid="summary-tab"
        >
          <FileText className="h-4 w-4 inline mr-2" />
          Summary
        </button>
      </div>
      
      {/* Filters */}
      <div className="bg-white rounded-lg border p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {isCEO && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Country</label>
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">All Countries</option>
                {countries.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Month</label>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              {MONTHS.map((m, i) => (
                <option key={i} value={i + 1}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Year</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            >
              {[2024, 2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
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
            <label className="block text-xs text-gray-500 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search employee..."
                className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm"
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
            />
            <SummaryCard 
              title="Total Paid" 
              value={`₹${summary.status_breakdown?.paid ? payments.filter(p => p.status === 'paid').reduce((s, p) => s + p.net_amount, 0).toLocaleString() : 0}`}
              subtitle={`${summary.paid_payments} payments`}
              icon={CheckCircle}
              color="text-emerald-600"
            />
            <SummaryCard 
              title="Pending Approval" 
              value={summary.pending_approvals} 
              subtitle="Awaiting Country Manager"
              icon={Clock}
              color="text-yellow-600"
            />
            <SummaryCard 
              title="Total This Month" 
              value={`₹${summary.total_amount_this_month?.toLocaleString()}`}
              subtitle={`${summary.total_payments_this_month} payments`}
              icon={DollarSign}
              color="text-[#2E3192]"
            />
          </div>
          
          {/* Status Breakdown */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold mb-4">Payment Status Breakdown</h3>
            <div className="grid grid-cols-5 gap-4">
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">{summary.status_breakdown?.pending || 0}</p>
                <p className="text-sm text-gray-500">Pending</p>
              </div>
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <p className="text-2xl font-bold text-blue-600">{summary.status_breakdown?.submitted || 0}</p>
                <p className="text-sm text-gray-500">Submitted</p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{summary.status_breakdown?.approved || 0}</p>
                <p className="text-sm text-gray-500">Approved</p>
              </div>
              <div className="text-center p-4 bg-emerald-50 rounded-lg">
                <p className="text-2xl font-bold text-emerald-600">{summary.status_breakdown?.paid || 0}</p>
                <p className="text-sm text-gray-500">Paid</p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-2xl font-bold text-red-600">{summary.status_breakdown?.rejected || 0}</p>
                <p className="text-sm text-gray-500">Rejected</p>
              </div>
            </div>
          </div>
          
          {/* Monthly Trend */}
          <div className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold mb-4">Monthly Trend (Last 6 Months)</h3>
            <div className="grid grid-cols-6 gap-2">
              {summary.monthly_trend?.map((item, idx) => (
                <div key={idx} className="text-center p-3 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-500">{MONTHS[item.month - 1]?.slice(0, 3)} {item.year}</p>
                  <p className="text-lg font-bold text-[#2E3192]">₹{(item.total_amount / 1000).toFixed(0)}K</p>
                  <p className="text-xs text-gray-400">{item.count} payments</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Approvals Tab - Country Manager View */}
      {activeTab === 'approvals' && canApprove && (
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full" data-testid="approvals-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Submitted By</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.filter(p => p.status === 'submitted').length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto text-green-300 mb-2" />
                    No pending approvals
                  </td>
                </tr>
              ) : (
                payments.filter(p => p.status === 'submitted').map(payment => (
                  <tr key={payment.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{payment.employee_name}</p>
                        <p className="text-xs text-gray-500">{payment.employee_role}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {MONTHS[payment.month - 1]} {payment.year}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${payment.payment_type === 'salary' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {payment.payment_type === 'salary' ? 'Salary' : 'Mechanic Payout'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      ₹{payment.net_amount?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {payment.submitted_by_name}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => { setSelectedPayment(payment); setShowApproval(true); }}
                        className="px-3 py-1 bg-[#2E3192] text-white rounded text-sm hover:bg-[#252879]"
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
        <div className="bg-white rounded-lg border overflow-hidden">
          <table className="w-full" data-testid="payments-table">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Employee</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Gross</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Net</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    <DollarSign className="h-12 w-12 mx-auto text-gray-300 mb-2" />
                    No payments found for this period
                  </td>
                </tr>
              ) : (
                payments.map(payment => (
                  <tr key={payment.id} className="hover:bg-gray-50" data-testid={`payment-row-${payment.id}`}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{payment.employee_name}</p>
                        <p className="text-xs text-gray-500">{payment.employee_role} • {payment.employee_code}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {MONTHS[payment.month - 1]} {payment.year}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs ${payment.payment_type === 'salary' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                        {payment.payment_type === 'salary' ? 'Salary' : 'Mechanic Payout'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      ₹{payment.gross_amount?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      ₹{payment.net_amount?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={payment.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {/* View Payslip - Only for approved/paid */}
                        {(payment.status === 'approved' || payment.status === 'paid') && (
                          <button
                            onClick={() => handleViewPayslip(payment)}
                            className="p-1.5 text-gray-500 hover:text-[#2E3192] hover:bg-gray-100 rounded"
                            title="View Payslip"
                            data-testid={`view-payslip-${payment.id}`}
                          >
                            <FileText className="h-4 w-4" />
                          </button>
                        )}
                        
                        {/* Edit - Only for pending */}
                        {payment.status === 'pending' && canCreate && (
                          <button
                            onClick={() => { setSelectedPayment(payment); setShowPaymentForm(true); }}
                            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-100 rounded"
                            title="Edit"
                            data-testid={`edit-payment-${payment.id}`}
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        )}
                        
                        {/* Submit for Approval - Only for pending */}
                        {payment.status === 'pending' && canCreate && (
                          <button
                            onClick={() => handleSubmitForApproval(payment.id)}
                            className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-gray-100 rounded"
                            title="Submit for Approval"
                            data-testid={`submit-payment-${payment.id}`}
                          >
                            <Send className="h-4 w-4" />
                          </button>
                        )}
                        
                        {/* Mark as Paid - Only for approved */}
                        {payment.status === 'approved' && (canCreate || canApprove) && (
                          <button
                            onClick={() => { setSelectedPayment(payment); setShowMarkPaid(true); }}
                            className="p-1.5 text-gray-500 hover:text-emerald-600 hover:bg-gray-100 rounded"
                            title="Mark as Paid"
                            data-testid={`mark-paid-${payment.id}`}
                          >
                            <CreditCard className="h-4 w-4" />
                          </button>
                        )}
                        
                        {/* Delete - Only for pending */}
                        {payment.status === 'pending' && canCreate && (
                          <button
                            onClick={() => handleDelete(payment.id)}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-gray-100 rounded"
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
    </div>
  );
};

export default FinancePage;
