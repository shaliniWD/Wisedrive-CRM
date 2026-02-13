import React, { useState, useEffect } from 'react';
import { dashboardApi } from '@/services/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, ClipboardCheck, UserCog, TrendingUp, Calendar, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

const StatCard = ({ title, value, icon: Icon, color, description }) => (
  <Card className="card-hover border-0 shadow-sm" data-testid={`stat-card-${title.toLowerCase().replace(/\s/g, '-')}`}>
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground font-['Outfit'] count-up">{value.toLocaleString()}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
        <div className={`p-3 rounded-xl ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-4 bg-muted rounded w-1/2"></div>
                  <div className="h-8 bg-muted rounded w-1/3"></div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const mainStats = [
    { title: 'Total Leads', value: stats?.total_leads || 0, icon: Users, color: 'bg-[#4F46E5]', description: 'All time leads' },
    { title: 'Total Customers', value: stats?.total_customers || 0, icon: UserCheck, color: 'bg-[#10B981]', description: 'Converted customers' },
    { title: 'Total Inspections', value: stats?.total_inspections || 0, icon: ClipboardCheck, color: 'bg-[#F59E0B]', description: 'All inspections' },
    { title: 'Total Employees', value: stats?.total_employees || 0, icon: UserCog, color: 'bg-[#8B5CF6]', description: 'Active team members' },
  ];

  const activityStats = [
    { title: 'Leads Today', value: stats?.leads_today || 0, icon: TrendingUp, color: 'bg-[#3B82F6]', description: 'New leads today' },
    { title: 'Inspections Today', value: stats?.inspections_today || 0, icon: Calendar, color: 'bg-[#EC4899]', description: 'Scheduled for today' },
    { title: 'Pending Payments', value: stats?.pending_payments || 0, icon: AlertCircle, color: 'bg-[#EF4444]', description: 'Awaiting payment' },
    { title: 'Completed Inspections', value: stats?.completed_inspections || 0, icon: CheckCircle2, color: 'bg-[#22C55E]', description: 'Successfully completed' },
  ];

  return (
    <div className="space-y-8" data-testid="dashboard-page">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] rounded-2xl p-8 text-white">
        <h2 className="text-2xl font-bold font-['Outfit']">Welcome back!</h2>
        <p className="mt-2 text-white/80">Here's what's happening with your CRM today.</p>
      </div>

      {/* Main Stats */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4 font-['Outfit']">Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {mainStats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>
      </div>

      {/* Activity Stats */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4 font-['Outfit']">Today's Activity</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {activityStats.map((stat) => (
            <StatCard key={stat.title} {...stat} />
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-4 font-['Outfit']">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="card-hover cursor-pointer border-0 shadow-sm" onClick={() => window.location.href = '/leads'}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-[#4F46E5]/10">
                <Users className="h-6 w-6 text-[#4F46E5]" />
              </div>
              <div>
                <p className="font-medium text-foreground">Add New Lead</p>
                <p className="text-sm text-muted-foreground">Create a new lead entry</p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover cursor-pointer border-0 shadow-sm" onClick={() => window.location.href = '/inspections'}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-[#F59E0B]/10">
                <ClipboardCheck className="h-6 w-6 text-[#F59E0B]" />
              </div>
              <div>
                <p className="font-medium text-foreground">Schedule Inspection</p>
                <p className="text-sm text-muted-foreground">Book a new inspection</p>
              </div>
            </CardContent>
          </Card>
          <Card className="card-hover cursor-pointer border-0 shadow-sm" onClick={() => window.location.href = '/customers'}>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-[#10B981]/10">
                <UserCheck className="h-6 w-6 text-[#10B981]" />
              </div>
              <div>
                <p className="font-medium text-foreground">View Customers</p>
                <p className="text-sm text-muted-foreground">Manage customer records</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
