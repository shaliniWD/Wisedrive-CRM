import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { EditModeProvider } from '@/contexts/EditModeContext';
import { Header } from '@/components/report/Header';
import { HeroSection } from '@/components/report/HeroSection';
import { AssessmentSummary } from '@/components/report/AssessmentSummary';
import { KeyInfoSection } from '@/components/report/KeyInfoSection';
import { RTOVerificationSection } from '@/components/report/RTOVerificationSection';
import { OBDReportMobile } from '@/components/report/OBDReportMobile';
import { InspectionDetailsSection } from '@/components/report/InspectionDetailsSection';
import { VehicleDetailsSection } from '@/components/report/VehicleDetailsSection';
import { Footer } from '@/components/report/Footer';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { AlertTriangle, ArrowLeft, Lock, Loader2 } from 'lucide-react';
import '@/styles/inspection-report.css';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

// Loading skeleton component
function ReportSkeleton() {
  return (
    <div className="inspection-report min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Authentication required component
function AuthRequired() {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Lock className="h-8 w-8 text-amber-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">Authentication Required</h2>
        <p className="text-gray-600 mb-6">
          This is an internal preview. Please log in to the CRM to access the report preview.
        </p>
        <Button onClick={() => navigate('/login')} className="w-full">
          Go to Login
        </Button>
      </div>
    </div>
  );
}

// Error component
function ReportError({ error, onRetry, onBack }) {
  return (
    <div className="inspection-report min-h-screen flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-8 w-8 text-red-600" />
        </div>
        <h2 className="text-xl font-semibold text-red-600 mb-2">Failed to load report</h2>
        <p className="text-gray-500 mb-4">{error}</p>
        <div className="flex gap-2 justify-center">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
          <Button onClick={onRetry}>
            Try Again
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Transform CRM inspection data to report format
 * Maps all fields from LiveProgressModal to InspectionReport structure
 */
function transformInspectionToReport(inspection, lead, customer) {
  // Extract AI insights if available
  const aiInsights = inspection.ai_insights || {};
  const conditionRatings = aiInsights.condition_ratings || {};
  const vaahanData = inspection.vaahan_data || {};
  
  // Build comprehensive report data structure
  const reportData = {
    header: {
      reportFor: inspection.package_name || "Vehicle Inspection Report",
      customerName: inspection.customer_name || customer?.name || lead?.customer_name || "Customer",
      customerPhone: inspection.customer_mobile || customer?.phone || lead?.phone_number || "",
      vehicleNumber: inspection.car_number || lead?.vehicle_number || "",
      inspectionRequestedDate: lead?.created_at 
        ? new Date(lead.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) 
        : inspection.created_at 
          ? new Date(inspection.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
          : "-",
      inspectedOn: inspection.inspection_date 
        ? new Date(inspection.inspection_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) 
        : "-",
      inspectedBy: inspection.mechanic_name || "WiseDrive Mechanic",
      inspectionType: inspection.package_name || "Standard Inspection",
      location: inspection.city || lead?.city || "",
      marketValue: {
        min: inspection.market_value_min || aiInsights.market_value?.min || 0,
        max: inspection.market_value_max || aiInsights.market_value?.max || 0,
        currency: "₹",
        confidence: aiInsights.market_value?.confidence || "medium"
      },
      recommendedToBuy: inspection.recommended_to_buy ?? aiInsights.recommended_to_buy ?? false,
      overallRating: inspection.overall_rating || aiInsights.overall_rating || 0,
      checkpointsInspected: inspection.checkpoints_inspected || 0,
      isPublished: inspection.report_published || false,
      lastSaved: inspection.updated_at ? new Date(inspection.updated_at).toLocaleString('en-IN') : "-",
      aiGenerated: aiInsights.ai_generated || !!inspection.ai_report_generated_at,
      aiGeneratedAt: aiInsights.generated_at || inspection.ai_report_generated_at || null
    },

    vehicleInfo: {
      make: inspection.vehicle_make || vaahanData.manufacturer || lead?.vehicle_make || "",
      model: inspection.vehicle_model || vaahanData.model || lead?.vehicle_model || "",
      year: inspection.vehicle_year || vaahanData.mfg_year || lead?.vehicle_year || 0,
      mfgDate: vaahanData.mfg_date || inspection.mfg_date || "",
      fuel: inspection.fuel_type || vaahanData.fuel_type || lead?.fuel_type || "",
      transmission: inspection.transmission || "",
      owners: inspection.owners || parseInt(vaahanData.owner_count) || 0,
      regNo: inspection.car_number || lead?.vehicle_number || "",
      colour: inspection.vehicle_colour || vaahanData.color || "",
      regDate: vaahanData.reg_date || inspection.reg_date || "",
      engineCC: inspection.engine_cc || parseInt(vaahanData.cubic_capacity) || 0,
      engineNo: vaahanData.engine_no || inspection.engine_no || "",
      chassisNo: vaahanData.chassis_no || inspection.chassis_no || ""
    },

    assessmentSummary: {
      paragraph: inspection.assessment_summary || aiInsights.assessment_summary || 
        "This vehicle has been professionally inspected. Detailed assessment available below.",
      keyHighlights: inspection.key_highlights || aiInsights.key_highlights || [],
      riskFactors: aiInsights.risk_factors || [],
      recommendations: aiInsights.recommendations || []
    },

    keyInfo: {
      kmsDriven: inspection.kms_driven || lead?.kms_driven || 0,
      engineCondition: inspection.engine_condition || conditionRatings.engine || "PENDING",
      interiorCondition: inspection.interior_condition || conditionRatings.interior || "PENDING",
      transmission: inspection.transmission_condition || conditionRatings.transmission || "PENDING",
      exteriorCondition: inspection.exterior_condition || conditionRatings.exterior || "PENDING",
      accident: inspection.accident_history || false,
      floodDamage: inspection.flood_damage || false,
      dentsScratches: inspection.dents_scratches || false,
      
      insurance: {
        status: inspection.insurance_status || "Unknown",
        insurerName: inspection.insurer_name || "",
        policyNumber: inspection.policy_number || "",
        expiryDate: inspection.insurance_expiry || "",
        policyType: inspection.policy_type || "",
        idvValue: inspection.idv_value || 0
      },
      
      tyreDetails: {
        avgLife: inspection.tyre_avg_life || 0,
        tyres: inspection.tyre_details || []
      },
      
      repairs: inspection.repairs || [],
      totalRepairCostMin: inspection.total_repair_cost_min || 0,
      totalRepairCostMax: inspection.total_repair_cost_max || 0
    },

    rtoVerification: {
      status: inspection.rto_verification_status || (vaahanData.rc_status ? "VERIFIED" : "PENDING"),
      challans: vaahanData.challans || inspection.challans || [],
      hypothecation: inspection.hypothecation || vaahanData.hypothecation || null,
      blacklist: inspection.blacklist_status || vaahanData.blacklisted || false,
      // Additional Vaahan fields for RTO section
      registrationAuthority: vaahanData.rta_name || "",
      registrationValidity: vaahanData.reg_upto || "",
      fitnessValidity: vaahanData.fitness_upto || "",
      taxValidity: vaahanData.tax_upto || "",
      insuranceValidity: vaahanData.insurance_upto || "",
      puccValidity: vaahanData.pucc_upto || "",
      noc: vaahanData.noc_status || ""
    },

    obdReport: {
      connected: inspection.obd_connected || false,
      dtcCodes: inspection.dtc_codes || [],
      liveData: inspection.obd_live_data || inspection.obd_data || {}
    },

    inspectionCategories: inspection.inspection_categories || [],
    categoryRatings: inspection.category_ratings || aiInsights.category_ratings || {},

    footer: {
      companyName: "WiseDrive",
      supportPhone: "+91 88848 54885",
      supportEmail: "support@wisedrive.in",
      website: "www.wisedrive.in"
    },
    
    // Include raw data for advanced components
    aiInsights: aiInsights,
    vaahanData: vaahanData
  };

  return reportData;
}

/**
 * Preview Report Page - CRM Internal Only
 * This page requires authentication and is used for previewing reports before publishing
 */
function PreviewReportContent({ inspectionId }) {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchReport = async () => {
    if (!user) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Get auth token
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Authentication token not found. Please log in again.');
        setLoading(false);
        return;
      }

      // Fetch inspection data from authenticated CRM API
      const response = await axios.get(
        `${API_URL}/api/inspections/${inspectionId}/report`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      const { inspection, lead, customer } = response.data;
      
      // Transform to report format
      const reportData = transformInspectionToReport(inspection, lead, customer);
      setData(reportData);
    } catch (err) {
      console.error('Error fetching report:', err);
      if (err.response?.status === 401) {
        setError('Session expired. Please log in again.');
      } else if (err.response?.status === 404) {
        setError('Inspection not found');
      } else {
        setError(err.response?.data?.detail || 'Failed to load report');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (inspectionId && user) {
      fetchReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId, user]);

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Require authentication
  if (!user) {
    return <AuthRequired />;
  }

  if (loading) return <ReportSkeleton />;
  if (error) return <ReportError error={error} onRetry={fetchReport} onBack={() => navigate(-1)} />;
  if (!data) return null;

  return (
    <div className="inspection-report min-h-screen">
      {/* Preview Banner */}
      <div className="bg-amber-500 text-white py-2 px-4 text-center text-sm font-medium sticky top-0 z-50">
        <span className="mr-2">🔒</span>
        INTERNAL PREVIEW - This is how the report will appear to customers
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => navigate(-1)}
          className="ml-4 text-white hover:bg-amber-600"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to CRM
        </Button>
      </div>
      
      {/* Header */}
      <Header data={data.header} />
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto pb-8">
        {/* Hero Section */}
        <HeroSection 
          header={data.header} 
          vehicleInfo={data.vehicleInfo} 
        />
        
        {/* AI Assessment Summary */}
        <AssessmentSummary data={data.assessmentSummary} />
        
        {/* Vehicle Details (Collapsible) */}
        <VehicleDetailsSection data={data.vehicleInfo} />
        
        {/* Key Information with Modals */}
        <KeyInfoSection data={data.keyInfo} />
        
        {/* RTO Verification */}
        <RTOVerificationSection data={data.rtoVerification} />
        
        {/* OBD-2 Report */}
        <OBDReportMobile data={data.obdReport} />
        
        {/* Inspection Details with Horizontal Scroll */}
        <InspectionDetailsSection data={data.inspectionCategories} />
      </main>
      
      {/* Footer */}
      <Footer data={data.footer} />
    </div>
  );
}

export default function PreviewReportPage() {
  const { id } = useParams();

  if (!id) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold text-gray-900 mb-2">No Inspection ID</h2>
          <p className="text-gray-500">Please provide an inspection ID to preview the report.</p>
        </div>
      </div>
    );
  }

  return (
    <EditModeProvider>
      <PreviewReportContent inspectionId={id} />
    </EditModeProvider>
  );
}
