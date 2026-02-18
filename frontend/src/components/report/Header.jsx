import React from 'react';
import { useEditMode } from '@/contexts/EditModeContext';
import { Button } from '@/components/ui/button';
import { 
  Menu, 
  Share2, 
  Printer, 
  Edit3, 
  Save, 
  Send,
  X,
  MapPin,
  Calendar,
  FileText
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

const WISEDRIVE_LOGO = "https://customer-assets.emergentagent.com/job_report-redesign-1/artifacts/umwakcgf_Wisedrive%20New%20Logo%20Horizontal%20Black.png";

export function Header({ data }) {
  const { isEditMode, toggleEditMode, hasUnsavedChanges, saveChanges, publishReport, shareReport } = useEditMode();

  const handlePrint = () => window.print();

  return (
    <>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b border-border safe-top">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between px-4 h-14 md:h-16">
            {/* Logo */}
            <img 
              src={WISEDRIVE_LOGO} 
              alt="WiseDrive" 
              className="h-7 md:h-8 w-auto"
            />
            
            {/* Desktop Nav Items */}
            <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>{data.inspectionType}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                <span>{data.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{data.inspectedOn}</span>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex items-center gap-1 md:gap-2">
              {/* Desktop Edit/Save/Publish */}
              <div className="hidden md:flex items-center gap-2">
                <Button
                  variant={isEditMode ? "default" : "outline"}
                  size="sm"
                  onClick={toggleEditMode}
                  className="gap-2"
                >
                  {isEditMode ? <X className="h-4 w-4" /> : <Edit3 className="h-4 w-4" />}
                  {isEditMode ? 'Exit Edit' : 'Edit'}
                </Button>
                
                {isEditMode && (
                  <>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={saveChanges} 
                      disabled={!hasUnsavedChanges}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      Save
                    </Button>
                    <Button 
                      size="sm" 
                      className="bg-success hover:bg-success/90"
                      onClick={publishReport}
                    >
                      <Send className="h-4 w-4 mr-2" />
                      Publish
                    </Button>
                  </>
                )}
              </div>
              
              {/* Share & Print - Desktop */}
              <div className="hidden md:flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={shareReport}>
                  <Share2 className="h-5 w-5" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handlePrint}>
                  <Printer className="h-5 w-5" />
                </Button>
              </div>
              
              {/* Mobile Share */}
              <Button variant="ghost" size="icon" onClick={shareReport} className="md:hidden touch-btn">
                <Share2 className="h-5 w-5" />
              </Button>
              
              {/* Mobile Menu */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="icon" className="md:hidden touch-btn">
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[280px]">
                  <SheetHeader>
                    <SheetTitle>Report Options</SheetTitle>
                  </SheetHeader>
                  <div className="mt-6 space-y-2">
                    <Button 
                      variant="outline" 
                      className="w-full justify-start" 
                      onClick={toggleEditMode}
                    >
                      <Edit3 className="h-4 w-4 mr-3" />
                      {isEditMode ? 'Exit Edit Mode' : 'Edit Report'}
                    </Button>
                    
                    {isEditMode && (
                      <>
                        <Button 
                          variant="outline" 
                          className="w-full justify-start"
                          onClick={saveChanges}
                          disabled={!hasUnsavedChanges}
                        >
                          <Save className="h-4 w-4 mr-3" />
                          Save Changes
                        </Button>
                        <Button 
                          className="w-full justify-start bg-success hover:bg-success/90"
                          onClick={publishReport}
                        >
                          <Send className="h-4 w-4 mr-3" />
                          Publish & Send
                        </Button>
                      </>
                    )}
                    
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={shareReport}
                    >
                      <Share2 className="h-4 w-4 mr-3" />
                      Share via WhatsApp
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="w-full justify-start"
                      onClick={handlePrint}
                    >
                      <Printer className="h-4 w-4 mr-3" />
                      Print Report
                    </Button>
                  </div>
                  
                  {/* Report Meta */}
                  <div className="mt-8 pt-6 border-t space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      <span>{data.inspectionType} Report</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      <span>{data.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      <span>{data.inspectedOn}</span>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
        
        {/* Edit Mode Banner */}
        {isEditMode && (
          <div className="bg-warning/10 border-t border-warning/20 px-4 py-2">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <span className="text-sm font-medium text-warning">Edit Mode Active - Click on dashed fields to edit</span>
              <div className="flex gap-2 md:hidden">
                <Button size="sm" variant="outline" onClick={saveChanges} disabled={!hasUnsavedChanges}>
                  Save
                </Button>
                <Button size="sm" className="bg-success hover:bg-success/90" onClick={publishReport}>
                  Publish
                </Button>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}

export default Header;
