import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '@/services/api';
import { Users, UserCheck, ClipboardCheck, UserCog } from 'lucide-react';
import { toast } from 'sonner';

const StatCard = ({ title, value, icon: Icon, bgColor }) => (
  <div className="card p-6" data-testid={`stat-card-${title.toLowerCase().replace(/\s/g, '-')}`}>
    <div className="flex items-center gap-4">
      <div className={`p-3 rounded-lg ${bgColor}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div>
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
      </div>
    </div>
  </div>
);

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await dashboardApi.getStats();
      setStats(response.data);
    } catch (error) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4" data-testid="dashboard-loading">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card p-6">
              <div className="animate-pulse flex items-center gap-4">
                <div className="h-12 w-12 bg-gray-200 rounded-lg"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                  <div className="h-6 bg-gray-200 rounded w-16"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const mainStats = [
    { title: 'Total Leads', value: stats?.total_leads || 0, icon: Users, bgColor: 'bg-[#2E3192]' },
    { title: 'Total Customers', value: stats?.total_customers || 0, icon: UserCheck, bgColor: 'bg-[#10B981]' },
    { title: 'Total Inspections', value: stats?.total_inspections || 0, icon: ClipboardCheck, bgColor: 'bg-[#F59E0B]' },
    { title: 'Team Members', value: stats?.total_employees || 0, icon: UserCog, bgColor: 'bg-[#8B5CF6]' },
  ];

  return (
    <div className="p-4 space-y-6" data-testid="dashboard-page">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mainStats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div 
          className="card p-6 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/leads')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-[#2E3192]/10">
              <Users className="h-6 w-6 text-[#2E3192]" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Manage Leads</p>
              <p className="text-sm text-gray-500">View and manage all leads</p>
            </div>
          </div>
        </div>
        
        <div 
          className="card p-6 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/inspections')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-[#F59E0B]/10">
              <ClipboardCheck className="h-6 w-6 text-[#F59E0B]" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Inspections</p>
              <p className="text-sm text-gray-500">Schedule and track inspections</p>
            </div>
          </div>
        </div>
        
        <div 
          className="card p-6 cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/customers')}
        >
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-lg bg-[#10B981]/10">
              <UserCheck className="h-6 w-6 text-[#10B981]" />
            </div>
            <div>
              <p className="font-medium text-gray-900">Customers</p>
              <p className="text-sm text-gray-500">Manage customer records</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
