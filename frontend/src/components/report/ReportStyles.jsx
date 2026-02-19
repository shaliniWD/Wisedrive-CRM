import React from 'react';
import { 
  Calendar, User, Gauge, Fuel, CheckCircle2, XCircle, IndianRupee, MapPin,
  Shield, AlertTriangle, Camera, FileText, Car, Wrench, ThumbsUp, ThumbsDown,
  Star, Award, TrendingUp, Activity, Eye
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/data/inspectionData';

// ===== STANDARD REPORT STYLE =====
// Clean, simple layout with essential information
export function StandardReportStyle({ data }) {
  const { header, vehicleInfo, assessmentSummary, inspectionCategories } = data;
  
  return (
    <div className="bg-gray-50 min-h-screen">
      {/* Simple Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Car className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900">Vehicle Inspection Report</h1>
              <p className="text-sm text-gray-500">{header.vehicleNumber}</p>
            </div>
          </div>
          <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
            Standard Report
          </span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Vehicle Summary Card */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{vehicleInfo.make} {vehicleInfo.model}</h2>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-gray-600">
                <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {vehicleInfo.year}</span>
                <span className="flex items-center gap-1"><Fuel className="h-4 w-4" /> {vehicleInfo.fuel}</span>
                <span className="flex items-center gap-1"><User className="h-4 w-4" /> {vehicleInfo.owners} owners</span>
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className={`h-20 w-20 rounded-full flex items-center justify-center ${header.overallRating >= 7 ? 'bg-green-100' : header.overallRating >= 5 ? 'bg-yellow-100' : 'bg-red-100'}`}>
                <span className={`text-3xl font-bold ${header.overallRating >= 7 ? 'text-green-600' : header.overallRating >= 5 ? 'text-yellow-600' : 'text-red-600'}`}>
                  {header.overallRating}
                </span>
              </div>
              <span className="text-sm text-gray-500 mt-1">out of 10</span>
            </div>
          </div>
          
          {/* Pass/Fail Badge */}
          <div className={`mt-6 p-4 rounded-lg flex items-center gap-3 ${header.recommendedToBuy ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {header.recommendedToBuy ? (
              <>
                <ThumbsUp className="h-6 w-6 text-green-600" />
                <div>
                  <p className="font-semibold text-green-800">Recommended to Buy</p>
                  <p className="text-sm text-green-600">This vehicle passed our inspection</p>
                </div>
              </>
            ) : (
              <>
                <ThumbsDown className="h-6 w-6 text-red-600" />
                <div>
                  <p className="font-semibold text-red-800">Not Recommended</p>
                  <p className="text-sm text-red-600">Issues found during inspection</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Key Findings */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <h3 className="font-bold text-lg text-gray-900 mb-4">Key Findings</h3>
          <p className="text-gray-600">{assessmentSummary?.paragraph || "Vehicle inspection completed. Details below."}</p>
          
          {assessmentSummary?.keyHighlights?.length > 0 && (
            <ul className="mt-4 space-y-2">
              {assessmentSummary.keyHighlights.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className={`h-5 w-5 mt-0.5 ${item.type === 'positive' ? 'text-green-500' : 'text-amber-500'}`} />
                  <span className="text-gray-700">{item.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Inspection Categories - Simple List */}
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h3 className="font-bold text-lg text-gray-900 mb-4">Inspection Results</h3>
          <div className="space-y-4">
            {inspectionCategories?.map((category, idx) => (
              <div key={idx} className="border-b last:border-0 pb-4 last:pb-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                      category.rating >= 8 ? 'bg-green-100' : category.rating >= 5 ? 'bg-yellow-100' : 'bg-red-100'
                    }`}>
                      <Wrench className={`h-5 w-5 ${
                        category.rating >= 8 ? 'text-green-600' : category.rating >= 5 ? 'text-yellow-600' : 'text-red-600'
                      }`} />
                    </div>
                    <span className="font-medium text-gray-900">{category.title}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold ${
                      category.rating >= 8 ? 'text-green-600' : category.rating >= 5 ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {category.rating}/10
                    </span>
                    {category.rating >= 8 ? (
                      <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Good</span>
                    ) : category.rating >= 5 ? (
                      <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">Fair</span>
                    ) : (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Poor</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>Report generated by WiseDrive • {header.inspectedOn}</p>
        </div>
      </main>
    </div>
  );
}


// ===== PREMIUM REPORT STYLE =====
// Detailed layout with photos and comprehensive analysis
export function PremiumReportStyle({ data }) {
  const { header, vehicleInfo, assessmentSummary, inspectionCategories, keyInfo } = data;
  
  return (
    <div className="bg-gradient-to-b from-purple-50 to-white min-h-screen">
      {/* Premium Header with Gradient */}
      <header className="bg-gradient-to-r from-purple-700 to-purple-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur">
                <Award className="h-7 w-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-xl">Premium Inspection Report</h1>
                  <span className="px-2 py-0.5 bg-yellow-400 text-purple-900 text-xs font-bold rounded-full">PRO</span>
                </div>
                <p className="text-purple-200 text-sm">Comprehensive Vehicle Analysis</p>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-6 text-sm text-purple-200">
              <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {header.location}</span>
              <span className="flex items-center gap-1"><Calendar className="h-4 w-4" /> {header.inspectedOn}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero Vehicle Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden mb-8 -mt-12 relative z-10">
          <div className="md:flex">
            {/* Left - Vehicle Image Placeholder */}
            <div className="md:w-1/3 bg-gradient-to-br from-purple-100 to-purple-50 p-8 flex items-center justify-center">
              <div className="text-center">
                <div className="h-32 w-32 bg-purple-200 rounded-full mx-auto flex items-center justify-center mb-4">
                  <Car className="h-16 w-16 text-purple-600" />
                </div>
                <p className="text-purple-600 font-medium">{header.vehicleNumber}</p>
              </div>
            </div>
            
            {/* Right - Vehicle Details */}
            <div className="md:w-2/3 p-8">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-3xl font-bold text-gray-900">{vehicleInfo.make} {vehicleInfo.model}</h2>
                  <p className="text-purple-600 font-medium mt-1">{vehicleInfo.year} • {vehicleInfo.fuel} • {vehicleInfo.transmission}</p>
                </div>
                <div className="text-right">
                  <div className="h-24 w-24 relative">
                    <svg className="h-24 w-24 transform -rotate-90">
                      <circle cx="48" cy="48" r="44" stroke="#e9d5ff" strokeWidth="8" fill="none" />
                      <circle cx="48" cy="48" r="44" stroke="#9333ea" strokeWidth="8" fill="none"
                        strokeDasharray={`${(header.overallRating / 10) * 276.5} 276.5`}
                        strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-3xl font-bold text-purple-700">{header.overallRating}</span>
                    </div>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">Overall Score</p>
                </div>
              </div>
              
              {/* Vehicle Stats Grid */}
              <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t">
                <div className="text-center p-3 bg-purple-50 rounded-xl">
                  <Gauge className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{formatNumber(285859)}</p>
                  <p className="text-xs text-gray-500">Kilometers</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-xl">
                  <User className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{vehicleInfo.owners}</p>
                  <p className="text-xs text-gray-500">Owners</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-xl">
                  <Shield className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">{header.checkpointsInspected}+</p>
                  <p className="text-xs text-gray-500">Checkpoints</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-xl">
                  <Camera className="h-5 w-5 text-purple-600 mx-auto mb-1" />
                  <p className="text-lg font-bold text-gray-900">50+</p>
                  <p className="text-xs text-gray-500">Photos</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Recommendation Banner */}
          <div className={`px-8 py-4 ${header.recommendedToBuy ? 'bg-gradient-to-r from-green-500 to-emerald-600' : 'bg-gradient-to-r from-red-500 to-rose-600'} text-white`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {header.recommendedToBuy ? <ThumbsUp className="h-6 w-6" /> : <ThumbsDown className="h-6 w-6" />}
                <div>
                  <p className="font-bold">{header.recommendedToBuy ? 'Recommended to Buy' : 'Not Recommended'}</p>
                  <p className="text-sm opacity-90">{header.recommendedToBuy ? 'This vehicle meets our quality standards' : 'Significant issues detected'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm opacity-90">Market Value</p>
                <p className="font-bold text-lg">₹{formatNumber(header.marketValue?.min || 0)} - ₹{formatNumber(header.marketValue?.max || 0)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* AI Assessment with Photo Gallery */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-2 bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Activity className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="font-bold text-lg text-gray-900">AI Assessment Summary</h3>
            </div>
            <p className="text-gray-600 leading-relaxed">{assessmentSummary?.paragraph}</p>
            
            {assessmentSummary?.keyHighlights?.length > 0 && (
              <div className="mt-6 grid grid-cols-2 gap-3">
                {assessmentSummary.keyHighlights.slice(0, 4).map((item, idx) => (
                  <div key={idx} className={`p-3 rounded-lg ${item.type === 'positive' ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                    <div className="flex items-start gap-2">
                      {item.type === 'positive' ? 
                        <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" /> : 
                        <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0" />
                      }
                      <span className="text-sm text-gray-700">{item.text}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Photo Gallery Placeholder */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center">
                <Camera className="h-5 w-5 text-purple-600" />
              </div>
              <h3 className="font-bold text-lg text-gray-900">Photo Gallery</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[1,2,3,4].map((i) => (
                <div key={i} className="aspect-square bg-purple-100 rounded-lg flex items-center justify-center">
                  <Camera className="h-8 w-8 text-purple-300" />
                </div>
              ))}
            </div>
            <button className="w-full mt-3 py-2 text-purple-600 font-medium text-sm hover:bg-purple-50 rounded-lg transition">
              View All 50+ Photos
            </button>
          </div>
        </div>

        {/* Detailed Inspection Categories */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
          <div className="flex items-center gap-2 mb-6">
            <div className="h-8 w-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <Wrench className="h-5 w-5 text-purple-600" />
            </div>
            <h3 className="font-bold text-lg text-gray-900">Detailed Inspection Analysis</h3>
          </div>
          
          <div className="grid md:grid-cols-2 gap-4">
            {inspectionCategories?.map((category, idx) => (
              <div key={idx} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">{category.title}</h4>
                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${
                    category.rating >= 8 ? 'bg-green-100 text-green-700' : 
                    category.rating >= 5 ? 'bg-yellow-100 text-yellow-700' : 
                    'bg-red-100 text-red-700'
                  }`}>
                    {category.rating}/10
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      category.rating >= 8 ? 'bg-green-500' : 
                      category.rating >= 5 ? 'bg-yellow-500' : 
                      'bg-red-500'
                    }`}
                    style={{ width: `${category.rating * 10}%` }}
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">{category.items?.length || 0} items inspected</p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 rounded-full">
            <Award className="h-5 w-5 text-purple-600" />
            <span className="text-purple-700 font-medium">Premium Report by WiseDrive</span>
          </div>
          <p className="text-sm text-gray-500 mt-2">{header.inspectedOn} • {header.location}</p>
        </div>
      </main>
    </div>
  );
}


// ===== DETAILED TECHNICAL REPORT STYLE =====
// Technical report with all inspection data and metrics
export function DetailedTechnicalReportStyle({ data }) {
  const { header, vehicleInfo, assessmentSummary, inspectionCategories, obdReport, rtoVerification } = data;
  
  return (
    <div className="bg-slate-900 min-h-screen text-white">
      {/* Technical Header */}
      <header className="bg-slate-800 border-b border-slate-700">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-emerald-500 rounded-lg flex items-center justify-center">
                <Activity className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg">Technical Inspection Report</h1>
                <p className="text-slate-400 text-sm font-mono">{header.vehicleNumber}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded text-sm font-mono">
                DETAILED ANALYSIS
              </span>
              <span className="text-slate-400 text-sm">{header.inspectedOn}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Technical Overview Grid */}
        <div className="grid md:grid-cols-4 gap-4 mb-8">
          {/* Overall Score */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-400 text-sm mb-2">OVERALL SCORE</p>
            <div className="flex items-end gap-2">
              <span className={`text-5xl font-bold font-mono ${
                header.overallRating >= 7 ? 'text-emerald-400' : 
                header.overallRating >= 5 ? 'text-yellow-400' : 
                'text-red-400'
              }`}>{header.overallRating}</span>
              <span className="text-slate-500 text-xl mb-1">/10</span>
            </div>
            <div className="mt-3 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div 
                className={`h-full ${header.overallRating >= 7 ? 'bg-emerald-500' : header.overallRating >= 5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${header.overallRating * 10}%` }}
              />
            </div>
          </div>
          
          {/* Checkpoints */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-400 text-sm mb-2">CHECKPOINTS</p>
            <span className="text-4xl font-bold font-mono text-white">{header.checkpointsInspected}</span>
            <span className="text-slate-400 text-lg">+ inspected</span>
            <div className="mt-2 flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-400" />
              <span className="text-emerald-400 text-sm">Comprehensive</span>
            </div>
          </div>
          
          {/* Status */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-400 text-sm mb-2">STATUS</p>
            <div className={`flex items-center gap-2 ${header.recommendedToBuy ? 'text-emerald-400' : 'text-red-400'}`}>
              {header.recommendedToBuy ? <CheckCircle2 className="h-8 w-8" /> : <XCircle className="h-8 w-8" />}
              <span className="text-xl font-bold">{header.recommendedToBuy ? 'PASS' : 'FAIL'}</span>
            </div>
            <p className="text-slate-500 text-sm mt-2">
              {header.recommendedToBuy ? 'Recommended for purchase' : 'Issues detected'}
            </p>
          </div>
          
          {/* Market Value */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <p className="text-slate-400 text-sm mb-2">MARKET VALUE</p>
            <div className="flex items-center gap-1">
              <IndianRupee className="h-5 w-5 text-emerald-400" />
              <span className="text-2xl font-bold font-mono text-white">{formatNumber(header.marketValue?.min || 0)}</span>
            </div>
            <p className="text-slate-500 text-sm">to ₹{formatNumber(header.marketValue?.max || 0)}</p>
          </div>
        </div>

        {/* Vehicle Specifications */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 mb-8">
          <div className="px-6 py-4 border-b border-slate-700">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Car className="h-5 w-5 text-emerald-400" />
              Vehicle Specifications
            </h3>
          </div>
          <div className="p-6">
            <div className="grid md:grid-cols-4 gap-6">
              <div>
                <p className="text-slate-400 text-xs mb-1">MAKE / MODEL</p>
                <p className="font-mono text-lg">{vehicleInfo.make} {vehicleInfo.model}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">YEAR</p>
                <p className="font-mono text-lg">{vehicleInfo.year}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">FUEL TYPE</p>
                <p className="font-mono text-lg">{vehicleInfo.fuel}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">TRANSMISSION</p>
                <p className="font-mono text-lg">{vehicleInfo.transmission || 'Manual'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">ENGINE CC</p>
                <p className="font-mono text-lg">{vehicleInfo.engineCC || '-'}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">REGISTRATION</p>
                <p className="font-mono text-lg">{vehicleInfo.regNo}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">OWNERS</p>
                <p className="font-mono text-lg">{vehicleInfo.owners}</p>
              </div>
              <div>
                <p className="text-slate-400 text-xs mb-1">ODOMETER</p>
                <p className="font-mono text-lg">{formatNumber(285859)} km</p>
              </div>
            </div>
          </div>
        </div>

        {/* Component-wise Breakdown */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 mb-8">
          <div className="px-6 py-4 border-b border-slate-700">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <Wrench className="h-5 w-5 text-emerald-400" />
              Component-wise Breakdown
            </h3>
          </div>
          <div className="p-6">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-slate-400 text-sm border-b border-slate-700">
                    <th className="pb-3 font-medium">COMPONENT</th>
                    <th className="pb-3 font-medium text-center">SCORE</th>
                    <th className="pb-3 font-medium text-center">STATUS</th>
                    <th className="pb-3 font-medium">HEALTH</th>
                    <th className="pb-3 font-medium text-right">ITEMS</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectionCategories?.map((category, idx) => (
                    <tr key={idx} className="border-b border-slate-700/50">
                      <td className="py-4 font-mono">{category.title}</td>
                      <td className="py-4 text-center">
                        <span className={`font-bold font-mono ${
                          category.rating >= 8 ? 'text-emerald-400' : 
                          category.rating >= 5 ? 'text-yellow-400' : 
                          'text-red-400'
                        }`}>
                          {category.rating}/10
                        </span>
                      </td>
                      <td className="py-4 text-center">
                        {category.rating >= 8 ? (
                          <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs font-mono">GOOD</span>
                        ) : category.rating >= 5 ? (
                          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-mono">FAIR</span>
                        ) : (
                          <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-mono">POOR</span>
                        )}
                      </td>
                      <td className="py-4">
                        <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${
                              category.rating >= 8 ? 'bg-emerald-500' : 
                              category.rating >= 5 ? 'bg-yellow-500' : 
                              'bg-red-500'
                            }`}
                            style={{ width: `${category.rating * 10}%` }}
                          />
                        </div>
                      </td>
                      <td className="py-4 text-right text-slate-400 font-mono">{category.items?.length || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* OBD Data (if available) */}
        {obdReport && (
          <div className="bg-slate-800 rounded-xl border border-slate-700 mb-8">
            <div className="px-6 py-4 border-b border-slate-700">
              <h3 className="font-bold text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-400" />
                OBD-II Diagnostic Data
              </h3>
            </div>
            <div className="p-6">
              <div className="grid md:grid-cols-3 gap-4">
                <div className="bg-slate-900 rounded-lg p-4">
                  <p className="text-slate-400 text-xs mb-1">ENGINE RPM</p>
                  <p className="font-mono text-2xl text-emerald-400">{obdReport.engineRPM || '850'} <span className="text-sm text-slate-500">RPM</span></p>
                </div>
                <div className="bg-slate-900 rounded-lg p-4">
                  <p className="text-slate-400 text-xs mb-1">COOLANT TEMP</p>
                  <p className="font-mono text-2xl text-emerald-400">{obdReport.coolantTemp || '92'}°C</p>
                </div>
                <div className="bg-slate-900 rounded-lg p-4">
                  <p className="text-slate-400 text-xs mb-1">BATTERY VOLTAGE</p>
                  <p className="font-mono text-2xl text-emerald-400">{obdReport.batteryVoltage || '12.6'}V</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center py-8 border-t border-slate-700">
          <div className="inline-flex items-center gap-2 text-slate-400">
            <Activity className="h-5 w-5 text-emerald-400" />
            <span className="font-mono">Technical Report Generated by WiseDrive</span>
          </div>
          <p className="text-slate-500 text-sm mt-2 font-mono">{header.inspectedOn} | {header.location} | REF: {header.vehicleNumber}</p>
        </div>
      </main>
    </div>
  );
}

export default { StandardReportStyle, PremiumReportStyle, DetailedTechnicalReportStyle };
