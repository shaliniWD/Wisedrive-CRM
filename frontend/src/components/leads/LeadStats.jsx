/**
 * Lead Statistics Cards Component
 * Displays key metrics with click-to-filter functionality
 * 
 * Stats shown: All Leads, New Leads, Hot Leads, RCB WhatsApp, Follow Up, Payment Link Sent
 */
import React from 'react';
import { Users, TrendingUp, Flame, MessageCircle, Bell, Link2 } from 'lucide-react';

// Summary Card Component - Compact version for sales dashboard
const SummaryCard = ({ title, value, icon: Icon, color, onClick, active }) => (
  <div 
    className={`rounded-xl border bg-white p-4 hover:shadow-lg transition-all duration-300 cursor-pointer ${active ? 'ring-2 ring-blue-500 border-blue-500' : ''}`}
    onClick={onClick}
    data-testid={`stat-card-${title.toLowerCase().replace(/\s+/g, '-')}`}
  >
    <div className="flex items-center gap-3">
      <div className={`p-2.5 rounded-xl bg-gradient-to-r ${
        color?.includes('blue') ? 'from-blue-500 to-blue-600' : 
        color?.includes('emerald') ? 'from-emerald-500 to-emerald-600' : 
        color?.includes('amber') ? 'from-amber-500 to-amber-600' :
        color?.includes('green') ? 'from-green-500 to-green-600' :
        color?.includes('orange') ? 'from-orange-500 to-orange-600' :
        color?.includes('red') ? 'from-red-500 to-red-600' :
        color?.includes('purple') ? 'from-purple-500 to-purple-600' :
        'from-gray-500 to-gray-600'
      }`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
      <div>
        <p className={`text-2xl font-bold ${color || 'text-gray-900'}`}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="text-xs font-medium text-gray-500">{title}</p>
      </div>
    </div>
  </div>
);

/**
 * LeadStats Component
 * 
 * @param {Object} props
 * @param {Array} props.leads - Array of lead objects (BASE leads, already date/employee filtered from API)
 * @param {string} props.activeFilter - Current active filter key
 * @param {function} props.onFilterChange - Callback when a stat card is clicked
 */
export const LeadStats = ({ 
  leads = [], 
  activeFilter = 'all', 
  onFilterChange,
  today = new Date().toISOString().split('T')[0]
}) => {
  // Calculate stats based on the BASE leads (not stat-filtered)
  const stats = React.useMemo(() => {
    return {
      totalLeads: leads.length,
      totalNewLeads: leads.filter(l => l.status === 'NEW LEAD').length,
      hotLeads: leads.filter(l => l.status === 'HOT LEADS').length,
      rcbWhatsappLeads: leads.filter(l => 
        l.status === 'RCB WHATSAPP' || l.reminder_reason === 'RCB_WHATSAPP'
      ).length,
      followupLeads: leads.filter(l => 
        l.status === 'FOLLOW UP' || 
        l.status === 'WHATSAPP FOLLOW UP' || 
        l.status === 'Repeat follow up' ||
        l.reminder_date
      ).length,
      paymentLinkSentLeads: leads.filter(l => 
        l.status === 'PAYMENT LINK SENT' || l.payment_link
      ).length,
    };
  }, [leads]);

  const handleFilterClick = (filterKey) => {
    if (onFilterChange) {
      // Toggle filter: if already active, set to 'all', otherwise set to filterKey
      onFilterChange(activeFilter === filterKey ? 'all' : filterKey);
    }
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-5">
      <SummaryCard 
        title="All Leads" 
        value={stats.totalLeads} 
        icon={Users} 
        color="text-purple-700" 
        onClick={() => handleFilterClick('all')}
        active={activeFilter === 'all'}
      />
      <SummaryCard 
        title="New Leads" 
        value={stats.totalNewLeads} 
        icon={TrendingUp} 
        color="text-blue-700" 
        onClick={() => handleFilterClick('new_leads')}
        active={activeFilter === 'new_leads'}
      />
      <SummaryCard 
        title="Hot Leads" 
        value={stats.hotLeads} 
        icon={Flame} 
        color="text-red-600" 
        onClick={() => handleFilterClick('hot')}
        active={activeFilter === 'hot'}
      />
      <SummaryCard 
        title="RCB WhatsApp" 
        value={stats.rcbWhatsappLeads} 
        icon={MessageCircle} 
        color="text-green-600" 
        onClick={() => handleFilterClick('rcb_whatsapp')}
        active={activeFilter === 'rcb_whatsapp'}
      />
      <SummaryCard 
        title="Follow Up" 
        value={stats.followupLeads} 
        icon={Bell} 
        color="text-orange-600" 
        onClick={() => handleFilterClick('followup')}
        active={activeFilter === 'followup'}
      />
      <SummaryCard 
        title="Payment Link Sent" 
        value={stats.paymentLinkSentLeads} 
        icon={Link2} 
        color="text-emerald-600" 
        onClick={() => handleFilterClick('payment_sent')}
        active={activeFilter === 'payment_sent'}
      />
    </div>
  );
};

// Also export SummaryCard for reuse
export { SummaryCard };
export default LeadStats;
