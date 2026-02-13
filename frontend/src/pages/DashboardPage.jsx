import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '@/services/api';
import { Users, UserCheck, ClipboardCheck, UserCog, TrendingUp, Calendar, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const StatCard = ({ title, value, icon: Icon, color, bgColor }) => (
  <div 
    className="bg-white border border-slate-200 rounded-xl p-5 card-interactive"
    data-testid={`stat-card-${title.toLowerCase().replace(/\s/g, '-')}`}
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="label-sm mb-1">{title}</p>
        <p className="stat-value">{value.toLocaleString()}</p>
      </div>
      <div className={`p-2.5 rounded-lg ${bgColor}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
    </div>
  </div>
);

const QuickActionCard = ({ title, description, icon: Icon, color, bgColor, onClick }) => (
  <button 
    onClick={onClick}
    className="bg-white border border-slate-200 rounded-xl p-5 text-left w-full card-interactive group"
  >
    <div className="flex items-center gap-4">
      <div className={`p-3 rounded-lg ${bgColor}`}>
        <Icon className={`h-5 w-5 ${color}`} />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-slate-900">{title}</p>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-1 transition-all" />
    </div>
  </button>
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
      console.error('Failed to fetch stats:', error);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6" data-testid="dashboard-loading">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="animate-pulse space-y-3">
                <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                <div className="h-8 bg-slate-200 rounded w-1/3"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const mainStats = [
    { title: 'Total Leads', value: stats?.total_leads || 0, icon: Users, color: 'text-indigo-600', bgColor: 'bg-indigo-50' },
    { title: 'Total Customers', value: stats?.total_customers || 0, icon: UserCheck, color: 'text-emerald-600', bgColor: 'bg-emerald-50' },
    { title: 'Total Inspections', value: stats?.total_inspections || 0, icon: ClipboardCheck, color: 'text-amber-600', bgColor: 'bg-amber-50' },
    { title: 'Team Members', value: stats?.total_employees || 0, icon: UserCog, color: 'text-purple-600', bgColor: 'bg-purple-50' },
  ];

  const activityStats = [
    { title: 'New Leads Today', value: stats?.leads_today || 0, icon: TrendingUp, color: 'text-blue-600', bgColor: 'bg-blue-50' },
    { title: "Today's Inspections", value: stats?.inspections_today || 0, icon: Calendar, color: 'text-pink-600', bgColor: 'bg-pink-50' },
    { title: 'Pending Payments', value: stats?.pending_payments || 0, icon: AlertCircle, color: 'text-rose-600', bgColor: 'bg-rose-50' },
    { title: 'Completed', value: stats?.completed_inspections || 0, icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-50' },
  ];

  return (
    <div className="space-y-6" data-testid="dashboard-page">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900" style={{ fontFamily: 'Outfit, sans-serif' }}>
            Dashboard
          </h1>
          <p className="text-slate-500 mt-1">Welcome back! Here's your business overview.</p>
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {mainStats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Activity Stats */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>
          Today's Activity
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {activityStats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4" style={{ fontFamily: 'Outfit, sans-serif' }}>
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <QuickActionCard 
            title="Add New Lead"
            description="Create a new lead entry"
            icon={Users}
            color="text-indigo-600"
            bgColor="bg-indigo-50"
            onClick={() => navigate('/leads')}
          />
          <QuickActionCard 
            title="Schedule Inspection"
            description="Book a new inspection"
            icon={ClipboardCheck}
            color="text-amber-600"
            bgColor="bg-amber-50"
            onClick={() => navigate('/inspections')}
          />
          <QuickActionCard 
            title="View Customers"
            description="Manage customer records"
            icon={UserCheck}
            color="text-emerald-600"
            bgColor="bg-emerald-50"
            onClick={() => navigate('/customers')}
          />
        </div>
      </div>
    </div>
  );
}
