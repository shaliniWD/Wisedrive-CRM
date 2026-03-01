// Loan Processing Modal - Vehicle-wise eligibility and bank offers
import React, { useState } from 'react';
import { loansApi } from '@/services/api';
import { toast } from 'sonner';
import {
  Car, CreditCard, CheckCircle, XCircle, Building2, Plus,
  IndianRupee, RefreshCw, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { formatCurrency } from './utils';
import { AppStatusBadge } from './StatusBadges';
import BankOffersModal from './BankOffersModal';

const LoanProcessingModal = ({ isOpen, onClose, lead, onUpdate }) => {
  const [checking, setChecking] = useState(null);
  const [vehicleEligibility, setVehicleEligibility] = useState({});
  const [applying, setApplying] = useState(null);
  const [bankOffersModal, setBankOffersModal] = useState({ open: false, vehicle: null, application: null });
  
  const vehicles = lead?.vehicles || [];
  const applications = lead?.applications || [];
  const loanOffers = lead?.loan_offers || [];
  
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
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto" data-testid="loan-processing-modal">
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
                        {vehicleApps.map((app) => {
                          const appOffers = loanOffers.filter(o => o.application_id === app.id);
                          const hasOffer = appOffers.length > 0;
                          const acceptedOffer = appOffers.find(o => o.offer_status === 'ACCEPTED');
                          
                          return (
                            <div key={app.id} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white border">
                              <Building2 className="h-4 w-4 text-gray-400" />
                              <span className="text-sm font-medium">{app.bank_name}</span>
                              <AppStatusBadge status={app.status} />
                              {app.approved_amount && (
                                <span className="text-xs text-green-600">{formatCurrency(app.approved_amount)}</span>
                              )}
                              {/* Add Offer Button */}
                              {(app.status === 'OFFER_RECEIVED' || app.status === 'APPROVED_BY_BANK' || app.status === 'IN_PROCESS') && (
                                <Button
                                  size="sm"
                                  variant={hasOffer ? "outline" : "default"}
                                  className="h-6 text-xs ml-2"
                                  onClick={() => setBankOffersModal({ open: true, vehicle, application: app })}
                                >
                                  {acceptedOffer ? (
                                    <>
                                      <CheckCircle className="h-3 w-3 mr-1 text-green-600" />
                                      Accepted
                                    </>
                                  ) : hasOffer ? (
                                    <>View Offers ({appOffers.length})</>
                                  ) : (
                                    <>
                                      <Plus className="h-3 w-3 mr-1" />
                                      Add Offer
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                  {/* Bank Offers Section for this vehicle */}
                  {(() => {
                    const vehicleOffers = loanOffers.filter(o => o.vehicle_loan_id === vehicle.vehicle_id);
                    if (vehicleOffers.length === 0) return null;
                    
                    const acceptedOffer = vehicleOffers.find(o => o.offer_status === 'ACCEPTED');
                    
                    return (
                      <div className="p-4 border-b bg-gradient-to-r from-green-50/50 to-emerald-50/50">
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <IndianRupee className="h-4 w-4 text-green-600" />
                            Bank Offers ({vehicleOffers.length})
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setBankOffersModal({ open: true, vehicle, application: null })}
                          >
                            View All Offers
                          </Button>
                        </div>
                        
                        {/* Quick summary of offers */}
                        <div className="grid grid-cols-3 gap-3">
                          {vehicleOffers.slice(0, 3).map((offer) => (
                            <div 
                              key={offer.id} 
                              className={`p-3 rounded-lg border cursor-pointer transition-all hover:shadow-sm ${
                                offer.offer_status === 'ACCEPTED' 
                                  ? 'bg-green-100 border-green-300' 
                                  : 'bg-white'
                              }`}
                              onClick={() => setBankOffersModal({ 
                                open: true, 
                                vehicle, 
                                application: applications.find(a => a.id === offer.application_id) 
                              })}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">{offer.bank_name}</span>
                                {offer.offer_status === 'ACCEPTED' && (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                )}
                              </div>
                              <div className="text-xs text-gray-600 space-y-1">
                                <div className="flex justify-between">
                                  <span>Loan:</span>
                                  <span className="font-medium">{formatCurrency(offer.loan_amount_approved)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Net Disbursal:</span>
                                  <span className="font-semibold text-green-600">{formatCurrency(offer.net_disbursal_amount)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>EMI:</span>
                                  <span className="font-medium">{formatCurrency(offer.emi_amount)}/mo</span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Accepted offer highlight */}
                        {acceptedOffer && (
                          <div className="mt-3 p-3 rounded-lg bg-green-100 border border-green-300">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CheckCircle className="h-5 w-5 text-green-600" />
                                <span className="font-medium text-green-800">Accepted: {acceptedOffer.bank_name}</span>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-green-700">Net Disbursal</p>
                                <p className="font-bold text-green-800">{formatCurrency(acceptedOffer.final_net_disbursal || acceptedOffer.net_disbursal_amount)}</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  
                  {/* Add Manual Bank Offer Button */}
                  <div className="p-4 border-b bg-gray-50">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setBankOffersModal({ open: true, vehicle, application: null })}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Manual Bank Offer
                    </Button>
                    <p className="text-xs text-gray-500 mt-1">
                      Add offer even if eligibility check failed (banker approved outside normal criteria)
                    </p>
                  </div>
                  
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
      
      {/* Bank Offers Modal */}
      <BankOffersModal
        isOpen={bankOffersModal.open}
        onClose={() => setBankOffersModal({ open: false, vehicle: null, application: null })}
        lead={lead}
        vehicle={bankOffersModal.vehicle}
        application={bankOffersModal.application}
        onUpdate={() => {
          setBankOffersModal({ open: false, vehicle: null, application: null });
          onUpdate();
        }}
      />
    </Dialog>
  );
};

export default LoanProcessingModal;
