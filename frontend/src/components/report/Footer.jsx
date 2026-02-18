import React from 'react';
import { 
  MapPin,
  Calendar,
  ExternalLink,
  FileText,
  BarChart3,
  ClipboardCheck,
  Search,
  Bot,
  Cpu
} from 'lucide-react';

const WISEDRIVE_LOGO = "https://customer-assets.emergentagent.com/job_report-redesign-1/artifacts/umwakcgf_Wisedrive%20New%20Logo%20Horizontal%20Black.png";

export function Footer({ data }) {
  return (
    <footer className="bg-primary text-primary-foreground mt-8 md:mt-12">
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 md:py-12">
        {/* Desktop: Grid | Mobile: Stack */}
        <div className="md:flex md:justify-between md:items-start gap-8">
          {/* Logo & Tagline */}
          <div className="mb-6 md:mb-0">
            <img 
              src={WISEDRIVE_LOGO} 
              alt="WiseDrive" 
              className="h-8 md:h-10 w-auto brightness-0 invert mb-4"
            />
            <p className="text-primary-foreground/70 text-sm max-w-xs">
              Inspect Wise, Drive Smart - Professional vehicle inspection services with comprehensive reports.
            </p>
          </div>
          
          {/* Features & Methods - Desktop */}
          <div className="hidden md:flex gap-12">
            <div>
              <h4 className="text-sm font-semibold mb-4">Report Features</h4>
              <ul className="space-y-2 text-sm text-primary-foreground/70">
                <li className="flex items-center gap-2"><FileText className="h-4 w-4" /> Easy to Read</li>
                <li className="flex items-center gap-2"><BarChart3 className="h-4 w-4" /> Easy to Track</li>
                <li className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4" /> Comprehensive</li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-semibold mb-4">Methods Used</h4>
              <ul className="space-y-2 text-sm text-primary-foreground/70">
                <li className="flex items-center gap-2"><Search className="h-4 w-4" /> Physical Inspection</li>
                <li className="flex items-center gap-2"><Bot className="h-4 w-4" /> AI Analysis</li>
                <li className="flex items-center gap-2"><Cpu className="h-4 w-4" /> OBD2 Scanning</li>
              </ul>
            </div>
          </div>
          
          {/* Features Grid - Mobile */}
          <div className="grid grid-cols-2 gap-3 md:hidden mb-6">
            <div className="bg-white/10 rounded-xl p-3">
              <h4 className="text-xs font-semibold mb-2">Features</h4>
              <ul className="space-y-1 text-xs text-primary-foreground/70">
                <li className="flex items-center gap-1"><FileText className="h-3 w-3" /> Easy to Read</li>
                <li className="flex items-center gap-1"><BarChart3 className="h-3 w-3" /> Easy to Track</li>
              </ul>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <h4 className="text-xs font-semibold mb-2">Methods</h4>
              <ul className="space-y-1 text-xs text-primary-foreground/70">
                <li className="flex items-center gap-1"><Search className="h-3 w-3" /> Physical</li>
                <li className="flex items-center gap-1"><Bot className="h-3 w-3" /> AI + OBD2</li>
              </ul>
            </div>
          </div>
        </div>
        
        {/* Divider */}
        <div className="h-px bg-white/10 my-6 md:my-8" />
        
        {/* Bottom Section */}
        <div className="md:flex md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-2 text-xs md:text-sm text-primary-foreground/60 mb-4 md:mb-0">
            <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span className="max-w-md">{data.address}</span>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm text-primary-foreground/60">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              <span>Published: {data.lastPublished}</span>
            </div>
            <a 
              href={data.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 hover:text-primary-foreground transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              <span>wisedrive.com</span>
            </a>
          </div>
        </div>
        
        {/* Copyright */}
        <div className="text-center mt-6 md:mt-8 pt-6 border-t border-white/10">
          <p className="text-[10px] md:text-xs text-primary-foreground/50">
            © {new Date().getFullYear()} WiseDrive Technologies Pvt. Ltd. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
