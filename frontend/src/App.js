import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout";
import { Toaster } from "@/components/ui/sonner";

// Pages
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import LeadsPage from "@/pages/LeadsPage";
import CustomersPage from "@/pages/CustomersPage";
import InspectionsPage from "@/pages/InspectionsPage";
import AdminPage from "@/pages/AdminPage";
import FinancePage from "@/pages/FinancePage";
import SettingsPage from "@/pages/SettingsPage";
import HRModulePage from "@/pages/HRModulePage";

// Smart redirect based on visible tabs
const SmartRedirect = () => {
  const { visibleTabs, loading } = useAuth();
  
  if (loading) return null;
  
  // Map tab names to routes
  const tabRouteMap = {
    leads: '/leads',
    customers: '/customers',
    inspections: '/inspections',
    employees: '/admin',
    finance: '/finance',
    settings: '/settings',
    hr: '/hr',
  };
  
  // Find the first visible tab and redirect there
  if (visibleTabs && visibleTabs.length > 0) {
    const firstTab = visibleTabs[0];
    const route = tabRouteMap[firstTab] || '/dashboard';
    return <Navigate to={route} replace />;
  }
  
  return <Navigate to="/dashboard" replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<LoginPage />} />
          
          {/* Protected Routes */}
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/leads" element={<LeadsPage />} />
            <Route path="/customers" element={<CustomersPage />} />
            <Route path="/inspections" element={<InspectionsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/finance" element={<FinancePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/hr" element={<HRModulePage />} />
          </Route>

          {/* Default redirect */}
          <Route path="/" element={<SmartRedirect />} />
          <Route path="*" element={<SmartRedirect />} />
        </Routes>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;
