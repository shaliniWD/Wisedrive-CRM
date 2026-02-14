import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '@/services/api';
import { Users, UserCheck, ClipboardCheck, UserCog, TrendingUp, Calendar, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

const StatCard = ({ title, value, icon: Icon, bgColor, textColor, subtitle }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-300" data-testid={`stat-card-${title.toLowerCase().replace(/\s/g, '-')}`}>
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className={`text-3xl font-bold ${textColor || 'text-gray-900'}`}>{value.toLocaleString()}</p>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
      </div>
      <div className={`p-4 rounded-xl ${bgColor}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
  </div>
);

const QuickActionCard = ({ title, description, icon: Icon, onClick, gradient }) => (
  <div 
    className="bg-white rounded-xl border border-gray-200 p-6 cursor-pointer hover:shadow-lg hover:border-blue-200 transition-all duration-300 group"
    onClick={onClick}
  >
    <div className="flex items-center gap-4">
      <div className={`p-4 rounded-xl ${gradient} group-hover:scale-105 transition-transform`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{title}</p>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
      <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
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
      <div className="p-6" data-testid="dashboard-loading">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border p-6">
              <div className="animate-pulse flex items-center justify-between">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                  <div className="h-8 bg-gray-200 rounded w-16"></div>
                </div>
                <div className="h-14 w-14 bg-gray-200 rounded-xl"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const mainStats = [
    { title: 'Total Leads', value: stats?.total_leads || 0, icon: Users, bgColor: 'bg-gradient-to-br from-blue-600 to-blue-700', textColor: 'text-blue-700', subtitle: '+12% from last month' },
    { title: 'Total Customers', value: stats?.total_customers || 0, icon: UserCheck, bgColor: 'bg-gradient-to-br from-emerald-500 to-emerald-600', textColor: 'text-emerald-600', subtitle: 'Active customers' },
    { title: 'Inspections', value: stats?.total_inspections || 0, icon: ClipboardCheck, bgColor: 'bg-gradient-to-br from-amber-500 to-amber-600', textColor: 'text-amber-600', subtitle: 'Completed this month' },
    { title: 'Team Members', value: stats?.total_employees || 0, icon: UserCog, bgColor: 'bg-gradient-to-br from-purple-500 to-purple-600', textColor: 'text-purple-600', subtitle: 'Active employees' },
  ];

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto" data-testid="dashboard-page">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back! Here's what's happening today.</p>
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <Calendar className="h-4 w-4" />
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {mainStats.map((stat) => (
          <StatCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <QuickActionCard 
            title="Manage Leads"
            description="View and manage all your leads"
            icon={Users}
            onClick={() => navigate('/leads')}
            gradient="bg-gradient-to-br from-blue-600 to-blue-700"
          />
          <QuickActionCard 
            title="Inspections"
            description="Schedule and track inspections"
            icon={ClipboardCheck}
            onClick={() => navigate('/inspections')}
            gradient="bg-gradient-to-br from-amber-500 to-amber-600"
          />
          <QuickActionCard 
            title="Customers"
            description="Manage customer records"
            icon={UserCheck}
            onClick={() => navigate('/customers')}
            gradient="bg-gradient-to-br from-emerald-500 to-emerald-600"
          />
        </div>
      </div>

      {/* Activity Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Recent Activity</h3>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">View All</button>
          </div>
          <div className="space-y-4">
            {[
              { action: 'New lead created', time: '2 minutes ago', color: 'bg-blue-500' },
              { action: 'Inspection completed', time: '1 hour ago', color: 'bg-emerald-500' },
              { action: 'Customer converted', time: '3 hours ago', color: 'bg-purple-500' },
              { action: 'Payment received', time: '5 hours ago', color: 'bg-amber-500' },
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${item.color}`}></div>
                <p className="flex-1 text-sm text-gray-700">{item.action}</p>
                <span className="text-xs text-gray-400">{item.time}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Performance Overview</h3>
            <div className="flex items-center gap-1 text-emerald-600 text-sm font-medium">
              <TrendingUp className="h-4 w-4" />
              +15%
            </div>
          </div>
          <div className="space-y-4">
            {[
              { label: 'Lead Conversion', value: 68, color: 'bg-blue-500' },
              { label: 'Inspection Completion', value: 85, color: 'bg-emerald-500' },
              { label: 'Customer Satisfaction', value: 92, color: 'bg-purple-500' },
              { label: 'Payment Collection', value: 78, color: 'bg-amber-500' },
            ].map((item, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.label}</span>
                  <span className="font-medium text-gray-900">{item.value}%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all duration-500`} style={{ width: `${item.value}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
