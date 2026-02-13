import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { TopNavbar } from './TopNavbar';
import { Loader2 } from 'lucide-react';

export const MainLayout = () => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
          <p className="text-sm text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50" data-testid="main-layout">
      <TopNavbar />
      <main className="px-6 py-6 max-w-[1920px] mx-auto">
        <div className="fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
};
