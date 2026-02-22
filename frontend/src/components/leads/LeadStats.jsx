/**
 * Lead Statistics Cards Component
 * Displays key metrics: New Leads, Hot Leads, Follow Ups, Conversions
 */
import React from 'react';
import { Users, Flame, Calendar, TrendingUp } from 'lucide-react';

const StatCard = ({ title, value, subtext, icon: Icon, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  };

  return (
    <div 
      className={`bg-white rounded-xl border p-4 hover:shadow-md transition-shadow`}
      data-testid={`stat-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtext && <p className="text-xs text-gray-400 mt-1">{subtext}</p>}
        </div>
        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${colorClasses[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
};

export const LeadStats = ({ leads = [], dateFilter = 'all' }) => {
  // Calculate stats based on filtered leads
  const stats = React.useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    // Total leads count (all time)
    const totalLeads = leads.length;
    
    // Hot leads
    const hotLeads = leads.filter(l => l.status === 'HOT LEADS').length;
    
    // Follow ups (all follow up statuses)
    const followUps = leads.filter(l => 
      ['FOLLOW UP', 'WHATSAPP FOLLOW UP', 'Repeat follow up'].includes(l.status)
    ).length;
    
    // Conversions (paid or finalized)
    const conversions = leads.filter(l => 
      ['PAID', 'CAR FINALIZED', 'Car purchased', 'CC GENERATED'].includes(l.status)
    ).length;
    
    // Calculate conversion rate
    const conversionRate = totalLeads > 0 ? ((conversions / totalLeads) * 100).toFixed(1) : 0;

    return {
      totalLeads,
      hotLeads,
      followUps,
      conversions,
      conversionRate
    };
  }, [leads]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <StatCard
        title="New Leads"
        value={stats.totalLeads}
        subtext="All time total"
        icon={Users}
        color="blue"
      />
      <StatCard
        title="Hot Leads"
        value={stats.hotLeads}
        subtext="Ready to convert"
        icon={Flame}
        color="red"
      />
      <StatCard
        title="Follow Ups"
        value={stats.followUps}
        subtext="Pending action"
        icon={Calendar}
        color="yellow"
      />
      <StatCard
        title="Conversions"
        value={stats.conversions}
        subtext={`${stats.conversionRate}% rate`}
        icon={TrendingUp}
        color="green"
      />
    </div>
  );
};

export default LeadStats;
