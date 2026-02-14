import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Users, UserCheck, ClipboardCheck, UserCog, TrendingUp, Calendar, 
  ArrowRight, DollarSign, ArrowUpRight, ArrowDownRight, BarChart3,
  Activity, Clock, CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';

// Summary Card Component matching FinancePage style
const SummaryCard = ({ title, value, subtitle, icon: Icon, color, trend, trendValue }) => (
  <div className="rounded-xl border bg-white p-5 hover:shadow-lg transition-all duration-300">
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className={`text-2xl font-bold ${color || 'text-gray-900'}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        {trend && (
          <div className={`flex items-center gap-1 text-xs font-medium ${trend === 'up' ? 'text-emerald-600' : 'text-red-500'}`}>
            {trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {trendValue}
          </div>
        )}
      </div>
      <div className={`p-3 rounded-xl ${color ? 'bg-white/80' : 'bg-gray-100'}`} style={{ background: color ? `linear-gradient(135deg, ${color.includes('blue') ? '#3b82f6' : color.includes('emerald') ? '#10b981' : color.includes('amber') ? '#f59e0b' : '#8b5cf6'} 0%, ${color.includes('blue') ? '#1d4ed8' : color.includes('emerald') ? '#059669' : color.includes('amber') ? '#d97706' : '#7c3aed'} 100%)` : undefined }}>
        <Icon className={`h-5 w-5 ${color ? 'text-white' : 'text-gray-600'}`} />
      </div>
    </div>
  </div>
);

// Quick Action Card matching FinancePage button style
const QuickActionCard = ({ title, description, icon: Icon, onClick, gradient }) => (
  <div 
    className="bg-white rounded-xl border p-5 cursor-pointer hover:shadow-lg hover:border-blue-200 transition-all duration-300 group"
    onClick={onClick}
    data-testid={`quick-action-${title.toLowerCase().replace(/\s/g, '-')}`}
  >
    <div className="flex items-center gap-4">
      <div className={`p-3.5 rounded-xl ${gradient} group-hover:scale-105 transition-transform shadow-lg`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1">
        <p className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">{title}</p>
        <p className="text-sm text-gray-500 mt-0.5">{description}</p>
      </div>
      <ArrowRight className="h-5 w-5 text-gray-300 group-hover:text-blue-500 group-hover:translate-x-1 transition-all" />
    </div>
  </div>
);

// Activity Item Component
const ActivityItem = ({ action, time, color, icon: Icon }) => (
  <div className="flex items-center gap-3 py-2">
    <div className={`w-8 h-8 rounded-full ${color} flex items-center justify-center`}>
      {Icon ? <Icon className="h-4 w-4 text-white" /> : <div className="w-2 h-2 rounded-full bg-white" />}
    </div>
    <div className="flex-1">
      <p className="text-sm text-gray-700">{action}</p>
    </div>
    <span className="text-xs text-gray-400">{time}</span>
  </div>
);

// Progress Bar Component
const ProgressBar = ({ label, value, color }) => (
  <div className="space-y-1.5">
    <div className="flex justify-between text-sm">
      <span className="text-gray-600">{label}</span>
      <span className="font-medium text-gray-900">{value}%</span>
    </div>
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <div 
        className={`h-full ${color} rounded-full transition-all duration-500`} 
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
);

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { user } = useAuth();

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
      <div className="p-6 max-w-7xl mx-auto" data-testid="dashboard-loading">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white rounded-xl border p-5">
              <div className="animate-pulse flex items-center justify-between">
                <div className="space-y-3">
                  <div className="h-4 bg-gray-200 rounded w-20"></div>
                  <div className="h-8 bg-gray-200 rounded w-16"></div>
                  <div className="h-3 bg-gray-200 rounded w-24"></div>
                </div>
                <div className="h-12 w-12 bg-gray-200 rounded-xl"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const mainStats = [
    { 
      title: 'Total Leads', 
      value: stats?.total_leads || 0, 
      icon: Users, 
      color: 'text-blue-700',
      subtitle: 'Active pipeline',
      trend: 'up',
      trendValue: '+12% this month'
    },
    { 
      title: 'Customers', 
      value: stats?.total_customers || 0, 
      icon: UserCheck, 
      color: 'text-emerald-600',
      subtitle: 'Total converted',
      trend: 'up',
      trendValue: '+8% this month'
    },
    { 
      title: 'Inspections', 
      value: stats?.total_inspections || 0, 
      icon: ClipboardCheck, 
      color: 'text-amber-600',
      subtitle: 'Completed this month',
      trend: 'up',
      trendValue: '+15% vs last month'
    },
    { 
      title: 'Team Members', 
      value: stats?.total_employees || 0, 
      icon: UserCog, 
      color: 'text-purple-600',
      subtitle: 'Active employees'
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="dashboard-page">
      {/* Page Header */}
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">Welcome back, {user?.name}! Here's what's happening today.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white border rounded-xl text-sm text-gray-600">
          <Calendar className="h-4 w-4 text-gray-400" />
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        {mainStats.map((stat) => (
          <SummaryCard key={stat.title} {...stat} />
        ))}
      </div>

      {/* Quick Actions */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Quick Actions</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <QuickActionCard 
            title="Manage Leads"
            description="View and manage all your leads"
            icon={Users}
            onClick={() => navigate('/leads')}
            gradient="bg-gradient-to-r from-blue-600 to-blue-700"
          />
          <QuickActionCard 
            title="Inspections"
            description="Schedule and track inspections"
            icon={ClipboardCheck}
            onClick={() => navigate('/inspections')}
            gradient="bg-gradient-to-r from-amber-500 to-amber-600"
          />
          <QuickActionCard 
            title="Customers"
            description="Manage customer records"
            icon={UserCheck}
            onClick={() => navigate('/customers')}
            gradient="bg-gradient-to-r from-emerald-500 to-emerald-600"
          />
        </div>
      </div>

      {/* Activity & Performance Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-gray-400" />
              <h3 className="font-semibold text-gray-900">Recent Activity</h3>
            </div>
            <button className="text-sm text-blue-600 hover:text-blue-700 font-medium px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors">
              View All
            </button>
          </div>
          <div className="space-y-1">
            <ActivityItem 
              action="New lead created - Honda City Inspection" 
              time="2 mins ago" 
              color="bg-blue-500"
              icon={Users}
            />
            <ActivityItem 
              action="Inspection completed for KA-01-AB-1234" 
              time="1 hour ago" 
              color="bg-emerald-500"
              icon={CheckCircle}
            />
            <ActivityItem 
              action="Customer converted - Rahul Sharma" 
              time="3 hours ago" 
              color="bg-purple-500"
              icon={UserCheck}
            />
            <ActivityItem 
              action="Payment received - ₹2,500" 
              time="5 hours ago" 
              color="bg-amber-500"
              icon={DollarSign}
            />
            <ActivityItem 
              action="New mechanic assigned to Bangalore zone" 
              time="Yesterday" 
              color="bg-gray-400"
              icon={UserCog}
            />
          </div>
        </div>

        {/* Performance Overview */}
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-400" />
              <h3 className="font-semibold text-gray-900">Performance Overview</h3>
            </div>
            <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-600 text-sm font-medium rounded-full">
              <TrendingUp className="h-4 w-4" />
              +15%
            </div>
          </div>
          <div className="space-y-5">
            <ProgressBar label="Lead Conversion" value={68} color="bg-blue-500" />
            <ProgressBar label="Inspection Completion" value={85} color="bg-emerald-500" />
            <ProgressBar label="Customer Satisfaction" value={92} color="bg-purple-500" />
            <ProgressBar label="Payment Collection" value={78} color="bg-amber-500" />
          </div>
        </div>
      </div>

      {/* Additional Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-100 text-sm font-medium">Today's Inspections</p>
              <p className="text-3xl font-bold mt-1">{stats?.today_inspections || 5}</p>
              <p className="text-blue-200 text-xs mt-1">3 completed, 2 pending</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <Clock className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-100 text-sm font-medium">This Month Revenue</p>
              <p className="text-3xl font-bold mt-1">₹{((stats?.monthly_revenue || 125000) / 1000).toFixed(0)}K</p>
              <p className="text-emerald-200 text-xs mt-1">+18% vs last month</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <DollarSign className="h-6 w-6" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-r from-purple-500 to-purple-600 rounded-xl p-5 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-100 text-sm font-medium">Conversion Rate</p>
              <p className="text-3xl font-bold mt-1">{stats?.conversion_rate || 68}%</p>
              <p className="text-purple-200 text-xs mt-1">Above target (65%)</p>
            </div>
            <div className="p-3 bg-white/20 rounded-xl">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
