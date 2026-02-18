import React, { useState, useEffect, useMemo } from 'react';
import { metaAdsApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { 
  TrendingUp, TrendingDown, Users, IndianRupee, Target, 
  BarChart3, Loader2, RefreshCw, Calendar, Filter,
  ArrowUpRight, ArrowDownRight, Eye, MousePointer,
  AlertCircle, CheckCircle, Key, Clock, Settings2, Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';

// Helper to format currency
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(amount);
};

// Helper to format numbers
const formatNumber = (num) => {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
};

// Summary Card Component
const SummaryCard = ({ title, value, subtext, icon: Icon, trend, trendValue, color = 'blue' }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    red: 'bg-red-50 text-red-600 border-red-200',
  };

  return (
    <div className="bg-white rounded-xl border p-5 hover:shadow-md transition-shadow" data-testid={`summary-${title.toLowerCase().replace(/\s+/g, '-')}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtext && <p className="text-xs text-gray-500 mt-1">{subtext}</p>}
        </div>
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {trend !== undefined && (
        <div className={`flex items-center mt-3 text-sm ${trend >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
          {trend >= 0 ? <ArrowUpRight className="h-4 w-4 mr-1" /> : <ArrowDownRight className="h-4 w-4 mr-1" />}
          <span className="font-medium">{Math.abs(trend)}%</span>
          <span className="text-gray-500 ml-1">{trendValue}</span>
        </div>
      )}
    </div>
  );
};

export default function AdAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [performanceData, setPerformanceData] = useState(null);
  const [metaStatus, setMetaStatus] = useState({ configured: false });
  const [dateRange, setDateRange] = useState('30');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('total_leads');
  const [sortOrder, setSortOrder] = useState('desc');

  // Calculate date range
  const getDateRange = () => {
    const today = new Date();
    const days = parseInt(dateRange);
    const fromDate = new Date(today);
    fromDate.setDate(today.getDate() - days);
    return {
      date_from: fromDate.toISOString().split('T')[0],
      date_to: today.toISOString().split('T')[0]
    };
  };

  const fetchData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      // Fetch Meta status
      const statusRes = await metaAdsApi.getStatus();
      setMetaStatus(statusRes.data);

      // Fetch performance data
      const { date_from, date_to } = getDateRange();
      const perfRes = await metaAdsApi.getPerformance({ date_from, date_to });
      setPerformanceData(perfRes.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [dateRange]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    if (!performanceData?.data) return [];

    let data = [...performanceData.data];

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter(item =>
        item.ad_id?.toLowerCase().includes(query) ||
        item.ad_name?.toLowerCase().includes(query) ||
        item.city?.toLowerCase().includes(query) ||
        item.source?.toLowerCase().includes(query)
      );
    }

    // Apply sorting
    data.sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return data;
  }, [performanceData, searchQuery, sortBy, sortOrder]);

  const totals = performanceData?.totals || {};

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96" data-testid="loading-spinner">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto" />
          <p className="text-gray-500 mt-2">Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto" data-testid="ad-analytics-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ad Performance Analytics</h1>
          <p className="text-gray-500 mt-1">Track ROI and lead performance across Meta ads</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Meta Status Indicator */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
            metaStatus.configured 
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
              : 'bg-amber-50 text-amber-700 border border-amber-200'
          }`}>
            {metaStatus.configured ? (
              <>
                <CheckCircle className="h-4 w-4" />
                <span>Meta Connected</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4" />
                <span>Meta Not Configured</span>
              </>
            )}
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchData(true)}
            disabled={refreshing}
            data-testid="refresh-btn"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-500" />
            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-40" data-testid="date-range-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">Last 7 Days</SelectItem>
                <SelectItem value="14">Last 14 Days</SelectItem>
                <SelectItem value="30">Last 30 Days</SelectItem>
                <SelectItem value="60">Last 60 Days</SelectItem>
                <SelectItem value="90">Last 90 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 max-w-md">
            <Input
              placeholder="Search by Ad ID, name, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10"
              data-testid="search-input"
            />
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-500" />
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-36" data-testid="sort-by-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total_leads">Leads</SelectItem>
                <SelectItem value="total_revenue">Revenue</SelectItem>
                <SelectItem value="ad_spend">Ad Spend</SelectItem>
                <SelectItem value="roi">ROI</SelectItem>
                <SelectItem value="conversion_rate">Conversion</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
              className="px-2"
            >
              {sortOrder === 'desc' ? <TrendingDown className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <SummaryCard
          title="Total Ad Spend"
          value={formatCurrency(totals.total_ad_spend || 0)}
          subtext={`${filteredData.length} active ads`}
          icon={IndianRupee}
          color="red"
        />
        <SummaryCard
          title="Total Leads"
          value={formatNumber(totals.total_leads || 0)}
          subtext={`${totals.total_converted || 0} converted`}
          icon={Users}
          color="blue"
        />
        <SummaryCard
          title="Total Revenue"
          value={formatCurrency(totals.total_revenue || 0)}
          icon={TrendingUp}
          color="green"
        />
        <SummaryCard
          title="Overall ROI"
          value={`${totals.overall_roi || 0}%`}
          subtext={`${totals.overall_conversion_rate || 0}% conversion`}
          icon={Target}
          color={totals.overall_roi >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <SummaryCard
          title="Total Impressions"
          value={formatNumber(totals.total_impressions || 0)}
          icon={Eye}
          color="purple"
        />
        <SummaryCard
          title="Total Clicks"
          value={formatNumber(totals.total_clicks || 0)}
          icon={MousePointer}
          color="amber"
        />
        <SummaryCard
          title="Conversion Rate"
          value={`${totals.overall_conversion_rate || 0}%`}
          subtext="Leads to sales"
          icon={BarChart3}
          color="blue"
        />
      </div>

      {/* Performance Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-slate-50">
          <h2 className="font-semibold text-gray-900">Ad Performance by Campaign</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b">
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Ad Info</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">City</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Spend</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Impressions</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Clicks</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Leads</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Converted</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Revenue</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">ROI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredData.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12">
                    <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No ad performance data available</p>
                    <p className="text-sm text-gray-400 mt-1">
                      Create ad mappings in Settings and start running ads
                    </p>
                  </td>
                </tr>
              ) : (
                filteredData.map((item, index) => (
                  <tr 
                    key={item.ad_id || index} 
                    className="hover:bg-slate-50 transition-colors"
                    data-testid={`ad-row-${item.ad_id}`}
                  >
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-gray-900">{item.ad_name || 'Unnamed Ad'}</p>
                        <p className="text-xs text-gray-500 font-mono">{item.ad_id}</p>
                        <div className="flex items-center gap-2 mt-1">
                          {item.source && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                              {item.source}
                            </span>
                          )}
                          {item.language && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                              {item.language}
                            </span>
                          )}
                          {!item.is_active && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600">
                              Inactive
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-gray-700">{item.city || '-'}</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(item.ad_spend)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-sm text-gray-700">
                        {formatNumber(item.impressions)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-sm text-gray-700">
                        {formatNumber(item.clicks)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-sm font-semibold text-blue-600">
                        {item.total_leads}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div>
                        <span className="text-sm font-medium text-emerald-600">
                          {item.converted_leads}
                        </span>
                        <span className="text-xs text-gray-500 ml-1">
                          ({item.conversion_rate}%)
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-sm font-semibold text-gray-900">
                        {formatCurrency(item.total_revenue)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${
                        item.roi >= 100 ? 'bg-emerald-100 text-emerald-700' :
                        item.roi >= 0 ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {item.roi >= 0 ? '+' : ''}{item.roi}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cost Metrics */}
      {filteredData.length > 0 && (
        <div className="mt-6 bg-white rounded-xl border p-4">
          <h3 className="font-semibold text-gray-900 mb-4">Cost Analysis</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Avg Cost/Lead</p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {formatCurrency(totals.total_leads > 0 ? totals.total_ad_spend / totals.total_leads : 0)}
              </p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Avg Cost/Conversion</p>
              <p className="text-lg font-bold text-gray-900 mt-1">
                {formatCurrency(totals.total_converted > 0 ? totals.total_ad_spend / totals.total_converted : 0)}
              </p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Revenue/Lead</p>
              <p className="text-lg font-bold text-emerald-600 mt-1">
                {formatCurrency(totals.total_leads > 0 ? totals.total_revenue / totals.total_leads : 0)}
              </p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-lg">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Net Profit</p>
              <p className={`text-lg font-bold mt-1 ${
                (totals.total_revenue - totals.total_ad_spend) >= 0 ? 'text-emerald-600' : 'text-red-600'
              }`}>
                {formatCurrency(totals.total_revenue - totals.total_ad_spend)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Banner */}
      {!metaStatus.configured && (
        <div className="mt-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-800">Meta Ads Not Connected</h4>
              <p className="text-sm text-amber-700 mt-1">
                Ad spend data from Meta is not available. The analytics shown are based on internal lead data only.
                Contact your administrator to configure Meta Marketing API integration.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
