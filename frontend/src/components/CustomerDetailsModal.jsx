import React, { useState, useEffect } from 'react';
import { customersApi, transactionsApi } from '@/services/api';
import { formatDateTime } from '@/utils/dateFormat';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, X } from 'lucide-react';

export function CustomerDetailsModal({ isOpen, onClose, customerId }) {
  const [customer, setCustomer] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && customerId) {
      fetchCustomerDetails();
    }
  }, [isOpen, customerId]);

  const fetchCustomerDetails = async () => {
    setLoading(true);
    try {
      const [customerRes, transactionsRes] = await Promise.all([
        customersApi.getById(customerId),
        transactionsApi.getByCustomer(customerId),
      ]);
      setCustomer(customerRes.data);
      setTransactions(transactionsRes.data);
    } catch (error) {
      console.error('Failed to fetch customer details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status) => {
    if (status === 'Completed') return 'bg-green-100 text-green-700';
    if (status === 'PENDING') return 'bg-yellow-100 text-yellow-700';
    if (status === 'Failed') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden" data-testid="customer-details-modal">
        {/* Header */}
        <div className="bg-[#2E3192] text-white px-6 py-4 flex justify-between items-center">
          <DialogTitle className="text-lg font-semibold text-white m-0">
            Customer Details
          </DialogTitle>
          <button onClick={onClose} className="text-white hover:text-gray-200" data-testid="close-modal-btn">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#2E3192]" />
          </div>
        ) : customer ? (
          <div className="p-6 space-y-6">
            {/* Customer Info Section */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-gray-500 uppercase">Customer Name</label>
                <input
                  type="text"
                  value={customer.name}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-sm"
                  data-testid="customer-name"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500 uppercase">Payment Status</label>
                <input
                  type="text"
                  value={customer.payment_status}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-sm"
                  data-testid="customer-payment-status"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500 uppercase">Mobile Number</label>
                <input
                  type="text"
                  value={customer.mobile}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-sm"
                  data-testid="customer-mobile"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-gray-500 uppercase">City</label>
                <input
                  type="text"
                  value={customer.city}
                  readOnly
                  className="w-full px-3 py-2 border border-gray-300 rounded bg-gray-50 text-sm"
                  data-testid="customer-city"
                />
              </div>
            </div>

            {/* Transaction History Section */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700 uppercase border-b pb-2">
                Transaction History
              </h3>
              
              {transactions.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">
                  No transactions found for this customer
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[250px] overflow-y-auto border rounded">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-100 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-600">Order ID</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-600">Type</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-600">Car Details</th>
                        <th className="text-left px-3 py-2 text-xs font-medium text-gray-600">Payment Date</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-gray-600">Amount</th>
                        <th className="text-center px-3 py-2 text-xs font-medium text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((txn) => (
                        <tr key={txn.id} className="border-t hover:bg-gray-50" data-testid={`transaction-row-${txn.id}`}>
                          <td className="px-3 py-2 font-mono text-xs">{txn.order_id}</td>
                          <td className="px-3 py-2">{txn.transaction_type}</td>
                          <td className="px-3 py-2">
                            <div className="text-xs">
                              {txn.car_make} {txn.car_model} ({txn.car_year})
                            </div>
                            <div className="text-xs text-gray-500">{txn.car_number}</div>
                          </td>
                          <td className="px-3 py-2 text-xs">{txn.payment_date || '-'}</td>
                          <td className="px-3 py-2 text-right font-medium">₹{txn.amount?.toLocaleString()}</td>
                          <td className="px-3 py-2 text-center">
                            <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${getStatusBadgeClass(txn.payment_status)}`}>
                              {txn.payment_status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <button
                onClick={onClose}
                className="px-6 py-2 bg-[#6366F1] text-white rounded hover:bg-[#5558E3] text-sm font-medium"
                data-testid="close-details-btn"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            Customer not found
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
