import React from 'react';
import { useEditMode } from '@/context/EditModeContext';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar, 
  User, 
  Gauge, 
  Fuel,
  CheckCircle2,
  XCircle,
  IndianRupee,
  MapPin
} from 'lucide-react';
import { formatCurrency, formatNumber } from '@/data/inspectionData';

function RatingCircle({ rating, size = 80 }) {
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const percentage = (rating / 10) * 100;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  const getColor = () => {
    if (rating >= 8) return 'hsl(var(--success))';
    if (rating >= 6) return 'hsl(var(--warning))';
    return 'hsl(var(--destructive))';
  };

  return (
    <div className="rating-circle">
      <svg width={size} height={size}>
        <circle
          className="rating-circle-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="rating-circle-progress"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke={getColor()}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl md:text-3xl font-bold font-display" style={{ color: getColor() }}>
          {rating}
        </span>
        <span className="text-[10px] md:text-xs text-muted-foreground">/10</span>
      </div>
    </div>
  );
}

export function HeroSection({ header, vehicleInfo }) {
  const { isEditMode } = useEditMode();
  const isRecommended = header.recommendedToBuy;

  return (
    <section className="px-4 md:px-0 pt-4 md:pt-6">
      {/* Main Hero Card */}
      <div className="mobile-card md:rounded-2xl overflow-hidden">
        {/* Desktop: Side by Side | Mobile: Stacked */}
        <div className="md:flex">
          {/* Left - Vehicle Info (Navy Background) */}
          <div className="bg-primary p-4 md:p-6 lg:p-8 text-primary-foreground md:flex-1">
            {/* Badges */}
            <div className="flex flex-wrap gap-2 mb-3 md:mb-4">
              <Badge className="bg-white/20 text-white border-0 text-xs">
                {header.inspectionType}
              </Badge>
              <Badge className="bg-white/20 text-white border-0 text-xs">
                {header.checkpointsInspected}+ Points
              </Badge>
            </div>
            
            {/* Vehicle Name */}
            <h1 className={`text-xl md:text-2xl lg:text-3xl font-bold font-display mb-1 md:mb-2 ${isEditMode ? 'border border-dashed border-yellow-400 rounded px-2 py-1 bg-white/10' : ''}`}>
              {vehicleInfo.model}
            </h1>
            <p className="text-white/70 text-sm md:text-base">{vehicleInfo.make}</p>
            
            {/* Quick Stats */}
            <div className="flex flex-wrap items-center gap-3 md:gap-4 mt-4 md:mt-6 text-sm">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 opacity-70" />
                <span>{vehicleInfo.year}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Gauge className="h-4 w-4 opacity-70" />
                <span>{formatNumber(285859)} km</span>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="h-4 w-4 opacity-70" />
                <span>{vehicleInfo.owners} Owners</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Fuel className="h-4 w-4 opacity-70" />
                <span>{vehicleInfo.fuel}</span>
              </div>
            </div>
            
            {/* Market Value - Desktop */}
            <div className="hidden md:block mt-6 p-4 bg-white/10 backdrop-blur-sm rounded-xl inline-block">
              <p className="text-xs text-white/70 flex items-center gap-1 mb-1">
                <IndianRupee className="h-3 w-3" />
                Recommended Market Value
              </p>
              <p className={`text-xl lg:text-2xl font-bold font-display ${isEditMode ? 'border border-dashed border-yellow-400 rounded px-2' : ''}`}>
                {formatCurrency(header.marketValue.min)} - {formatCurrency(header.marketValue.max)}
              </p>
            </div>
          </div>
          
          {/* Right - Rating & Recommendation */}
          <div className="p-4 md:p-6 lg:p-8 md:w-[280px] lg:w-[320px] flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-border bg-card">
            {/* Rating */}
            <div className="text-center">
              <p className="text-xs md:text-sm text-muted-foreground mb-2 md:mb-3">Overall Rating</p>
              <RatingCircle rating={header.overallRating} size={90} />
            </div>
            
            {/* Recommendation */}
            <div className={`
              w-full mt-4 md:mt-6 p-3 md:p-4 rounded-xl text-center
              ${isRecommended 
                ? 'bg-success/10 border border-success/20' 
                : 'bg-destructive/10 border border-destructive/20'
              }
            `}>
              <div className="flex items-center justify-center gap-2 mb-1">
                {isRecommended ? (
                  <CheckCircle2 className="h-5 w-5 text-success" />
                ) : (
                  <XCircle className="h-5 w-5 text-destructive" />
                )}
                <span className={`font-semibold ${isRecommended ? 'text-success' : 'text-destructive'}`}>
                  {isRecommended ? 'Recommended' : 'Not Recommended'}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {isRecommended ? 'Good condition for purchase' : 'Requires significant repairs'}
              </p>
            </div>
            
            {/* Market Value - Mobile Only */}
            <div className="md:hidden w-full mt-4 p-3 bg-secondary/50 rounded-xl">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <IndianRupee className="h-3 w-3" />
                Market Value
              </p>
              <p className={`text-lg font-bold font-display ${isEditMode ? 'border border-dashed border-yellow-500 rounded px-1' : ''}`}>
                {formatCurrency(header.marketValue.min)} - {formatCurrency(header.marketValue.max)}
              </p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Meta Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3 md:mt-4">
        <div className="mobile-card p-3 md:p-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs text-muted-foreground">Customer</p>
              <p className={`text-sm font-medium truncate ${isEditMode ? 'border border-dashed border-yellow-500 rounded px-1' : ''}`}>
                {header.customerName}
              </p>
            </div>
          </div>
        </div>
        <div className="mobile-card p-3 md:p-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs text-muted-foreground">Location</p>
              <p className="text-sm font-medium truncate">{header.location}</p>
            </div>
          </div>
        </div>
        <div className="mobile-card p-3 md:p-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs text-muted-foreground">Inspected On</p>
              <p className="text-sm font-medium truncate">{header.inspectedOn}</p>
            </div>
          </div>
        </div>
        <div className="mobile-card p-3 md:p-4">
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] md:text-xs text-muted-foreground">Inspector</p>
              <p className="text-sm font-medium truncate">{header.inspectedBy}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HeroSection;
