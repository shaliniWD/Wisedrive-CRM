import React, { useState } from 'react';
import InspectionPackagesPage from './InspectionPackagesPage';
import InspectionQAPage from './InspectionQAPage';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, HelpCircle } from 'lucide-react';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('packages');
  
  return (
    <div className="min-h-screen bg-gray-50" data-testid="settings-page">
      <div className="max-w-7xl mx-auto p-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Services</h1>
          <p className="text-gray-500 mt-1">Manage inspection packages and Q&A templates</p>
        </div>
        
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-white border rounded-lg p-1 w-auto inline-flex">
            <TabsTrigger 
              value="packages" 
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-md"
              data-testid="tab-packages"
            >
              <Package className="h-4 w-4" />
              Inspection Packages
            </TabsTrigger>
            <TabsTrigger 
              value="qa" 
              className="flex items-center gap-2 px-4 py-2 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 rounded-md"
              data-testid="tab-qa"
            >
              <HelpCircle className="h-4 w-4" />
              Inspection Q&A
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="packages" className="mt-0">
            <InspectionPackagesPage />
          </TabsContent>
          
          <TabsContent value="qa" className="mt-0">
            <InspectionQAPage />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
