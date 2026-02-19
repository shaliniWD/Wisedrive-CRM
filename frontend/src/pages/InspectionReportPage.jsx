import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
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
import { inspectionReportData } from '@/data/inspectionData';
import { StandardReportStyle, PremiumReportStyle, DetailedTechnicalReportStyle } from '@/components/report/ReportStyles';
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

// Error component
function ReportError({ error, onRetry }) {
  return (
    <div className="inspection-report min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-red-600 mb-2">Failed to load report</h2>
        <p className="text-gray-500 mb-4">{error}</p>
        <button 
          onClick={onRetry}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

// Transform CRM inspection data to report format
function transformInspectionToReport(inspection, lead, customer) {
  // Default structure matching the report format
  const reportData = {
    header: {
      reportFor: inspection.package_name || "Inspection Report",
      customerName: customer?.name || lead?.customer_name || "Customer",
      customerPhone: customer?.phone || lead?.phone_number || "",
      vehicleNumber: lead?.vehicle_number || inspection.vehicle_number || "",
      inspectionRequestedDate: lead?.created_at ? new Date(lead.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "-",
      inspectedOn: inspection.inspection_date ? new Date(inspection.inspection_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "-",
      inspectedBy: inspection.mechanic_name || "WiseDrive Mechanic",
      inspectionType: inspection.package_name || "Standard",
      location: inspection.city || lead?.city || "",
      marketValue: {
        min: inspection.market_value_min || 0,
        max: inspection.market_value_max || 0,
        currency: "₹"
      },
      recommendedToBuy: inspection.recommended_to_buy || false,
      overallRating: inspection.overall_rating || 0,
      checkpointsInspected: inspection.checkpoints_inspected || 0,
      isPublished: inspection.report_published || false,
      lastSaved: inspection.updated_at ? new Date(inspection.updated_at).toLocaleString('en-IN') : "-"
    },

    vehicleInfo: {
      make: lead?.vehicle_make || inspection.vehicle_make || "",
      model: lead?.vehicle_model || inspection.vehicle_model || "",
      year: lead?.vehicle_year || inspection.vehicle_year || 0,
      mfgDate: inspection.mfg_date || "",
      fuel: lead?.fuel_type || inspection.fuel_type || "",
      transmission: inspection.transmission || "",
      owners: inspection.owners || 0,
      regNo: lead?.vehicle_number || inspection.vehicle_number || "",
      colour: inspection.vehicle_colour || "",
      regDate: inspection.reg_date || "",
      engineCC: inspection.engine_cc || 0,
      engineNo: inspection.engine_no || "",
      chassisNo: inspection.chassis_no || ""
    },

    assessmentSummary: {
      paragraph: inspection.assessment_summary || "This vehicle has been inspected. Detailed assessment pending.",
      keyHighlights: inspection.key_highlights || []
    },

    keyInfo: {
      kmsDriven: inspection.kms_driven || lead?.kms_driven || 0,
      engineCondition: inspection.engine_condition || "PENDING",
      interiorCondition: inspection.interior_condition || "PENDING",
      transmission: inspection.transmission_condition || "PENDING",
      exteriorCondition: inspection.exterior_condition || "PENDING",
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
      
      repairs: inspection.repairs || []
    },

    rtoVerification: {
      status: inspection.rto_verification_status || "PENDING",
      challans: inspection.challans || [],
      hypothecation: inspection.hypothecation || null,
      blacklist: inspection.blacklist_status || false
    },

    obdReport: {
      connected: inspection.obd_connected || false,
      dtcCodes: inspection.dtc_codes || [],
      liveData: inspection.obd_live_data || {}
    },

    inspectionCategories: inspection.inspection_categories || [],

    footer: {
      companyName: "WiseDrive",
      supportPhone: "+91 88848 54885",
      supportEmail: "support@wisedrive.in",
      website: "www.wisedrive.in"
    }
  };

  return reportData;
}

function InspectionReportContent({ inspectionId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reportStyle, setReportStyle] = useState('standard');
  const [searchParams] = useSearchParams();
  
  // Check for style override in URL params
  const styleOverride = searchParams.get('style');

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    
    // For demo mode, always use sample data
    if (inspectionId === 'demo') {
      setData(inspectionReportData);
      setReportStyle(styleOverride || 'standard');
      setLoading(false);
      return;
    }
    
    // For sample reports with specific styles
    if (inspectionId === 'sample') {
      setData(inspectionReportData);
      setReportStyle(styleOverride || 'standard');
      setLoading(false);
      return;
    }
    
    try {
      // Fetch inspection data from CRM API
      const response = await axios.get(`${API_URL}/api/inspections/${inspectionId}/report`);
      const { inspection, lead, customer } = response.data;
      
      // Get the report style from inspection or fallback
      const inspectionStyle = inspection.report_style || styleOverride || 'standard';
      setReportStyle(inspectionStyle);
      
      // Check if inspection has detailed report data
      if (inspection.inspection_categories && inspection.inspection_categories.length > 0) {
        // Use CRM data if available
        const reportData = transformInspectionToReport(inspection, lead, customer);
        setData(reportData);
      } else {
        // Use sample data but merge with actual vehicle info
        const mergedData = {
          ...inspectionReportData,
          header: {
            ...inspectionReportData.header,
            customerName: customer?.name || lead?.customer_name || inspectionReportData.header.customerName,
            customerPhone: customer?.phone || lead?.phone_number || inspectionReportData.header.customerPhone,
            vehicleNumber: lead?.vehicle_number || inspection.vehicle_number || inspectionReportData.header.vehicleNumber,
            location: inspection.city || lead?.city || inspectionReportData.header.location,
            inspectedOn: inspection.inspection_date ? new Date(inspection.inspection_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : inspectionReportData.header.inspectedOn,
          },
          vehicleInfo: {
            ...inspectionReportData.vehicleInfo,
            make: lead?.vehicle_make || inspectionReportData.vehicleInfo.make,
            model: lead?.vehicle_model || inspectionReportData.vehicleInfo.model,
            year: lead?.vehicle_year || inspectionReportData.vehicleInfo.year,
            fuel: lead?.fuel_type || inspectionReportData.vehicleInfo.fuel,
            regNo: lead?.vehicle_number || inspectionReportData.vehicleInfo.regNo,
          }
        };
        setData(mergedData);
      }
    } catch (err) {
      console.error('Error fetching report:', err);
      // On any error, use sample data for demonstration
      setData(inspectionReportData);
      setReportStyle(styleOverride || 'standard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (inspectionId) {
      fetchReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId, styleOverride]);

  if (loading) return <ReportSkeleton />;
  if (error) return <ReportError error={error} onRetry={fetchReport} />;
  if (!data) return null;

  // Render based on report style
  if (reportStyle === 'premium') {
    return <PremiumReportStyle data={data} />;
  }
  
  if (reportStyle === 'detailed') {
    return <DetailedTechnicalReportStyle data={data} />;
  }

  // Default: Standard report (original design)
  return (
    <div className="inspection-report min-h-screen">
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

export default function InspectionReportPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  
  // Get inspection ID from URL params or query string
  const inspectionId = id || searchParams.get('id') || 'demo';

  return (
    <EditModeProvider>
      <InspectionReportContent inspectionId={inspectionId} />
    </EditModeProvider>
  );
}
