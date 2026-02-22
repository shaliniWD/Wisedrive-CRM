import React, { useState, useEffect, useMemo } from 'react';
import { metaAdsApi, adCityMappingsApi, partnersApi } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { 
  TrendingUp, TrendingDown, Users, IndianRupee, Target, 
  BarChart3, Loader2, RefreshCw, Calendar, Filter,
  ArrowUpRight, ArrowDownRight, Eye, MousePointer,
  AlertCircle, CheckCircle, Key, Clock, Shield,
  Plus, Pencil, Trash2, Search, Settings, X, MapPin,
  MessageSquare, XCircle, ExternalLink, Info, Building2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('performance');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [performanceData, setPerformanceData] = useState(null);
  const [metaStatus, setMetaStatus] = useState({ configured: false });
  const [tokenInfo, setTokenInfo] = useState(null);
  const [dateRange, setDateRange] = useState('30');
  const [dateRangeType, setDateRangeType] = useState('month'); // Unified date filter
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('total_leads');
  const [sortOrder, setSortOrder] = useState('desc');
  // New filters for Ad Performance
  const [filterCity, setFilterCity] = useState('all');
  const [filterAdStatus, setFilterAdStatus] = useState('all'); // 'all', 'active', 'inactive'
  
  // Token management state
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [newToken, setNewToken] = useState('');
  const [tokenLoading, setTokenLoading] = useState(false);
  
  // Ad Mapping state
  const [adMappings, setAdMappings] = useState([]);
  const [mappingLoading, setMappingLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAd, setEditingAd] = useState(null);
  const [saving, setSaving] = useState(false);
  const [mappingSearchQuery, setMappingSearchQuery] = useState('');
  const [partners, setPartners] = useState([]);
  const [formData, setFormData] = useState({
    ad_id: '', ad_name: '', ad_amount: '', city: '', language: '', campaign: '', source: '', partner_id: '',
  });
  
  // Sync and unmapped ads state
  const [syncing, setSyncing] = useState(false);
  const [syncingAllMappings, setSyncingAllMappings] = useState(false);
  const [unmappedAds, setUnmappedAds] = useState([]);
  const [unmappedAdsFromLeads, setUnmappedAdsFromLeads] = useState([]);
  const [loadingUnmapped, setLoadingUnmapped] = useState(false);
  const [autoMapping, setAutoMapping] = useState(false);
  const [unmappedWithTargeting, setUnmappedWithTargeting] = useState(0);
  const [unmappedNoTargeting, setUnmappedNoTargeting] = useState(0);
  
  // Debug logs state
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  
  const addDebugLog = (action, status, details) => {
    const timestamp = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev, { timestamp, action, status, details }].slice(-20)); // Keep last 20 logs
  };
  
  const cities = ['Bangalore', 'Chennai', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune', 'Kolkata', 'Ahmedabad', 'Vizag'];
  const languages = ['Hindi', 'English', 'Kannada', 'Tamil', 'Telugu', 'Malayalam', 'Marathi', 'Bengali'];
  const sources = ['Instagram', 'Facebook', 'Google', 'YouTube', 'Website', 'Referral'];
  
  // Check if user can manage tokens (CEO/CTO only)
  const canManageToken = user?.role_code === 'CEO' || user?.role_code === 'CTO';

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

  const fetchPerformanceData = async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const statusRes = await metaAdsApi.getStatus();
      setMetaStatus(statusRes.data);
      
      if (canManageToken) {
        try {
          const tokenRes = await metaAdsApi.getTokenInfo();
          setTokenInfo(tokenRes.data);
        } catch (err) {
          console.log('Token info not available');
        }
      }

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
  
  const fetchAdMappings = async () => {
    setMappingLoading(true);
    try {
      const [mappingsRes, partnersRes] = await Promise.all([
        adCityMappingsApi.getAll(),
        partnersApi.getPartners()
      ]);
      setAdMappings(mappingsRes.data || []);
      setPartners(partnersRes.data || []);
    } catch (error) {
      console.error('Failed to load ad mappings:', error);
      toast.error('Failed to load ad mappings');
    } finally {
      setMappingLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'performance') {
      fetchPerformanceData();
    } else if (activeTab === 'mapping') {
      fetchAdMappings();
      if (canManageToken) {
        fetchAndAutoMapAds();
      }
    }
  }, [activeTab, dateRange]);

  // Token management functions
  const handleRefreshToken = async () => {
    setTokenLoading(true);
    try {
      const result = await metaAdsApi.refreshToken();
      if (result.data.success) {
        toast.success(`Token refreshed! Valid for ${result.data.expires_in_days} days`);
        fetchPerformanceData(true);
      } else {
        toast.error(result.data.error || 'Failed to refresh token');
        if (result.data.needs_manual_refresh) setShowTokenModal(true);
      }
    } catch (error) {
      toast.error('Failed to refresh token');
    } finally {
      setTokenLoading(false);
    }
  };
  
  const handleAutoRefresh = async () => {
    setTokenLoading(true);
    try {
      const result = await metaAdsApi.autoRefresh(7);
      if (result.data.action === 'refreshed') {
        toast.success(`Token auto-refreshed! Valid for ${result.data.new_expires_in_days} days`);
        return true;
      } else if (result.data.action === 'none') {
        // Token is fine, continue
        return true;
      } else if (result.data.needs_manual_refresh) {
        return false;
      }
      return true;
    } catch (error) {
      return false;
    } finally {
      setTokenLoading(false);
    }
  };
  
  // OAuth popup handler
  const handleMetaOAuth = async () => {
    addDebugLog('OAuth', 'INFO', 'Initiating Meta OAuth...');
    
    try {
      // Get OAuth URL from backend
      const oauthResult = await metaAdsApi.initOAuth();
      const oauthUrl = oauthResult.data.oauth_url;
      
      // Open popup for Meta login
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        oauthUrl,
        'meta-oauth',
        `width=${width},height=${height},left=${left},top=${top}`
      );
      
      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.');
      }
      
      addDebugLog('OAuth', 'INFO', 'Waiting for Meta authorization...');
      toast.info('Please complete the Meta login in the popup window...');
      
      // Listen for OAuth callback
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          try {
            if (popup.closed) {
              clearInterval(checkInterval);
              reject(new Error('OAuth cancelled - popup was closed'));
            }
            
            // Check if popup redirected to callback URL
            if (popup.location.href.includes('meta-oauth-callback')) {
              const url = new URL(popup.location.href);
              const code = url.searchParams.get('code');
              const error = url.searchParams.get('error');
              
              popup.close();
              clearInterval(checkInterval);
              
              if (error) {
                reject(new Error(`OAuth failed: ${error}`));
              } else if (code) {
                resolve(code);
              } else {
                reject(new Error('No authorization code received'));
              }
            }
          } catch (e) {
            // Cross-origin error - popup still on Meta's domain
          }
        }, 500);
        
        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(checkInterval);
          if (!popup.closed) popup.close();
          reject(new Error('OAuth timeout - please try again'));
        }, 300000);
      });
      
    } catch (error) {
      addDebugLog('OAuth', 'ERROR', error.message);
      throw error;
    }
  };

  // Exchange OAuth code for token
  const exchangeOAuthCode = async (code) => {
    addDebugLog('OAuth', 'INFO', 'Exchanging authorization code for token...');
    
    try {
      const result = await metaAdsApi.handleOAuthCallback(code);
      
      if (result.data.success) {
        addDebugLog('OAuth', 'SUCCESS', result.data.message);
        toast.success(result.data.message);
        
        // Refresh token info
        const tokenResult = await metaAdsApi.getTokenInfo();
        setTokenInfo(tokenResult.data);
        
        return true;
      } else {
        throw new Error(result.data.error || 'Token exchange failed');
      }
    } catch (error) {
      addDebugLog('OAuth', 'ERROR', error.message);
      throw error;
    }
  };

  // UNIFIED REFRESH FUNCTION - Does everything in one click with auto OAuth
  const handleUnifiedRefresh = async () => {
    setRefreshing(true);
    
    try {
      // Step 1: Check token and try to auto-refresh if needed
      addDebugLog('Refresh', 'INFO', 'Starting unified refresh...');
      
      // Get current token status
      const tokenResult = await metaAdsApi.getTokenInfo();
      const currentTokenInfo = tokenResult.data;
      setTokenInfo(currentTokenInfo);
      
      // If token is invalid or about to expire, try to refresh automatically
      if (!currentTokenInfo.is_valid) {
        addDebugLog('Token', 'WARNING', `Token invalid: ${currentTokenInfo.error || 'Unknown reason'}`);
        
        // Show the easy token refresh modal
        toast.info('Token expired - please reconnect to Facebook');
        setShowTokenModal(true);
        setRefreshing(false);
        return;
      } else {
        addDebugLog('Token', 'SUCCESS', `Token valid (${currentTokenInfo.expires_in_days} days left)`);
      }
      
      // Step 2: Sync data from Meta
      addDebugLog('Sync', 'INFO', 'Syncing ad data from Meta...');
      try {
        const syncResult = await metaAdsApi.forceSync();
        if (syncResult.data.success) {
          addDebugLog('Sync', 'SUCCESS', `Meta data synced successfully`);
          toast.success('Ad data synced from Meta!');
        } else {
          addDebugLog('Sync', 'WARNING', syncResult.data.error || 'Sync returned no data');
        }
      } catch (syncError) {
        addDebugLog('Sync', 'WARNING', 'Could not sync from Meta API - using cached data');
      }
      
      // Step 3: Refresh performance data
      addDebugLog('Data', 'INFO', 'Fetching performance data...');
      await fetchPerformanceData(false);
      addDebugLog('Data', 'SUCCESS', 'Performance data refreshed');
      
      // Step 4: If on mapping tab, also refresh mappings
      if (activeTab === 'mapping') {
        addDebugLog('Mappings', 'INFO', 'Refreshing ad mappings...');
        await fetchAdMappings();
        await fetchAndAutoMapAds();
        addDebugLog('Mappings', 'SUCCESS', 'Mappings refreshed');
      }
      
      addDebugLog('Refresh', 'DONE', 'Unified refresh complete!');
      toast.success('Data refreshed successfully!');
      
    } catch (error) {
      addDebugLog('Refresh', 'ERROR', error.message);
      toast.error('Refresh failed: ' + error.message);
    } finally {
      setRefreshing(false);
    }
  };
  
  const handleUpdateToken = async () => {
    if (!newToken.trim()) {
      toast.error('Please enter a valid token');
      return;
    }
    
    setTokenLoading(true);
    try {
      const result = await metaAdsApi.updateToken(newToken.trim());
      if (result.data.success) {
        toast.success('✅ Token updated successfully!');
        setShowTokenModal(false);
        setNewToken('');
        
        // IMPORTANT: Refresh token info to update the status badge
        try {
          const tokenResult = await metaAdsApi.getTokenInfo();
          setTokenInfo(tokenResult.data);
        } catch (e) {
          console.error('Failed to refresh token info:', e);
        }
        
        // Refresh performance data
        fetchPerformanceData(true);
      } else {
        toast.error(result.data.error || 'Invalid token');
      }
    } catch (error) {
      toast.error('Failed to update token');
    } finally {
      setTokenLoading(false);
    }
  };
  
  // Sync data from Meta
  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const result = await metaAdsApi.syncStatus();
      if (result.data.success) {
        toast.success(`Synced ${result.data.updated_count} ads from Meta`);
        // Refresh data after sync
        fetchPerformanceData(true);
        if (activeTab === 'mapping') {
          fetchAdMappings();
          fetchAndAutoMapAds();
        }
      } else {
        toast.error(result.data.error || 'Sync failed');
      }
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Failed to sync with Meta');
    } finally {
      setSyncing(false);
    }
  };
  
  // Fetch unmapped ads from Meta AND auto-map those with targeting
  const fetchAndAutoMapAds = async () => {
    setLoadingUnmapped(true);
    setAutoMapping(true);
    addDebugLog('Refresh Started', 'INFO', 'Starting refresh and auto-map process...');
    
    try {
      // Step 1: Scan existing leads for unmapped ads (works without Meta token)
      addDebugLog('Scan Leads', 'CALLING', 'POST /api/meta-ads/scan-leads-for-unmapped-ads');
      try {
        const scanResult = await metaAdsApi.scanLeadsForUnmappedAds();
        addDebugLog('Scan Leads', scanResult.data.success ? 'SUCCESS' : 'FAILED', 
          `scanned=${scanResult.data.total_leads_scanned || 0}, new_unmapped=${scanResult.data.new_unmapped_count || 0}, already_mapped=${scanResult.data.already_mapped_count || 0}`);
        if (scanResult.data.success && scanResult.data.new_unmapped_count > 0) {
          toast.success(`📊 Found ${scanResult.data.new_unmapped_count} unmapped ads from ${scanResult.data.total_leads_scanned} leads!`);
        }
      } catch (scanError) {
        const errorMsg = scanError.response?.data?.error || scanError.response?.data?.detail || scanError.message;
        addDebugLog('Scan Leads', 'ERROR', errorMsg);
      }
      
      // Step 2: Try auto-map ads with geo-targeting (requires Meta token)
      let autoMappedCount = 0;
      addDebugLog('Auto-Map from Targeting', 'CALLING', 'POST /api/meta-ads/auto-map-from-targeting');
      try {
        const autoMapResult = await metaAdsApi.autoMapFromTargeting();
        addDebugLog('Auto-Map from Targeting', autoMapResult.data.success ? 'SUCCESS' : 'FAILED', JSON.stringify(autoMapResult.data));
        if (autoMapResult.data.success && autoMapResult.data.auto_mapped_count > 0) {
          autoMappedCount += autoMapResult.data.auto_mapped_count;
          toast.success(`✅ Auto-mapped ${autoMapResult.data.auto_mapped_count} ads based on geo-targeting!`);
        }
      } catch (autoMapError) {
        // Auto-map failed (maybe token expired), continue
        const errorMsg = autoMapError.response?.data?.error || autoMapError.response?.data?.detail || autoMapError.message;
        addDebugLog('Auto-Map from Targeting', 'ERROR', errorMsg);
      }
      
      // Step 3: Auto-map ads based on current_cities (works without Meta token)
      addDebugLog('Auto-Map from Current Cities', 'CALLING', 'POST /api/meta-ads/auto-map-from-current-cities');
      try {
        const currentCityResult = await metaAdsApi.autoMapFromCurrentCities();
        addDebugLog('Auto-Map from Current Cities', currentCityResult.data.success ? 'SUCCESS' : 'FAILED', 
          `mapped=${currentCityResult.data.auto_mapped_count || 0}, skipped=${currentCityResult.data.skipped_count || 0}`);
        if (currentCityResult.data.success && currentCityResult.data.auto_mapped_count > 0) {
          autoMappedCount += currentCityResult.data.auto_mapped_count;
          toast.success(`🗺️ Auto-mapped ${currentCityResult.data.auto_mapped_count} ads based on lead cities!`);
        }
      } catch (cityMapError) {
        const errorMsg = cityMapError.response?.data?.error || cityMapError.response?.data?.detail || cityMapError.message;
        addDebugLog('Auto-Map from Current Cities', 'ERROR', errorMsg);
      }
      
      // Refresh mappings if any were created
      if (autoMappedCount > 0) {
        fetchMappings();
      }
      
      // Step 4: Fetch remaining unmapped ads from Meta (requires token)
      addDebugLog('Fetch Unmapped from Meta', 'CALLING', 'GET /api/meta-ads/unmapped-ads');
      let metaResult;
      try {
        metaResult = await metaAdsApi.getUnmappedAds();
        addDebugLog('Fetch Unmapped from Meta', metaResult.data.success ? 'SUCCESS' : 'FAILED', 
          `count=${metaResult.data.count || 0}, with_targeting=${metaResult.data.with_targeting_count || 0}, no_targeting=${metaResult.data.no_targeting_count || 0}, error=${metaResult.data.error || 'none'}`);
      } catch (e) {
        metaResult = { data: { success: false, data: [], error: e.response?.data?.detail || e.message } };
        addDebugLog('Fetch Unmapped from Meta', 'ERROR', metaResult.data.error);
      }
      
      // Step 5: Fetch unmapped ads from WhatsApp leads
      addDebugLog('Fetch Unmapped from WhatsApp', 'CALLING', 'GET /api/meta-ads/unmapped-ads-from-leads');
      let leadsResult;
      try {
        leadsResult = await metaAdsApi.getUnmappedAdsFromLeads();
        addDebugLog('Fetch Unmapped from WhatsApp', leadsResult.data.success ? 'SUCCESS' : 'FAILED', 
          `count=${leadsResult.data.count || 0}, error=${leadsResult.data.error || 'none'}`);
      } catch (e) {
        leadsResult = { data: { success: false, data: [], error: e.response?.data?.detail || e.message } };
        addDebugLog('Fetch Unmapped from WhatsApp', 'ERROR', leadsResult.data.error);
      }
      
      if (metaResult.data.success) {
        setUnmappedAds(metaResult.data.data || []);
        setUnmappedWithTargeting(metaResult.data.with_targeting_count || 0);
        setUnmappedNoTargeting(metaResult.data.no_targeting_count || 0);
        
        // Show summary if we auto-mapped some
        if (autoMappedCount > 0) {
          const remaining = metaResult.data.count || 0;
          if (remaining > 0) {
            toast.info(`${remaining} ads still need manual mapping`);
          }
        }
      } else {
        console.error('Failed to fetch unmapped ads from Meta:', metaResult.data.error);
        setUnmappedAds([]);
        setUnmappedWithTargeting(0);
        setUnmappedNoTargeting(0);
      }
      
      if (leadsResult.data.success) {
        setUnmappedAdsFromLeads(leadsResult.data.data || []);
      } else {
        setUnmappedAdsFromLeads([]);
      }
      
      addDebugLog('Refresh Complete', 'DONE', `Meta: ${metaResult.data.count || 0} unmapped, WhatsApp: ${leadsResult.data.count || 0} unmapped`);
    } catch (error) {
      addDebugLog('Refresh', 'FATAL ERROR', error.message);
      console.error('Error in fetch and auto-map:', error);
    } finally {
      setLoadingUnmapped(false);
      setAutoMapping(false);
    }
  };

  // Map an unmapped ad from WhatsApp leads
  const handleMapFromLeads = async (unmapped, selectedCity) => {
    addDebugLog('Map from Leads', 'CALLING', `Mapping ${unmapped.ad_name || unmapped.ad_id} to ${selectedCity}`);
    try {
      const result = await metaAdsApi.mapAdFromLeads(unmapped.id, selectedCity);
      if (result.data.success) {
        addDebugLog('Map from Leads', 'SUCCESS', `Leads updated: ${result.data.leads_updated}`);
        toast.success(`Mapped! ${result.data.leads_updated} leads updated to ${selectedCity}`);
        fetchAndAutoMapAds();
        fetchMappings();
      }
    } catch (error) {
      addDebugLog('Map from Leads', 'ERROR', error.response?.data?.detail || error.message);
      toast.error(error.response?.data?.detail || 'Failed to map ad');
    }
  };
  
  // Quick map an unmapped ad
  const handleQuickMap = (ad) => {
    setFormData({
      ad_id: ad.ad_id || '',
      ad_name: ad.ad_name || '',
      ad_amount: '',
      city: ad.suggested_city || '',
      language: '',
      campaign: ad.adset_name || '',
      source: 'Facebook',
    });
    setEditingAd(null);
    setIsModalOpen(true);
  };

  // ONE-CLICK SYNC: Sync all Meta ads and create comprehensive mappings
  const handleSyncAllAdMappings = async () => {
    setSyncingAllMappings(true);
    addDebugLog('Sync All Mappings', 'CALLING', 'POST /api/meta-ads/sync-all-ad-mappings');
    
    try {
      const result = await metaAdsApi.syncAllAdMappings();
      
      if (result.data.success) {
        addDebugLog('Sync All Mappings', 'SUCCESS', 
          `Total: ${result.data.total_ads}, Created: ${result.data.created_count}, Updated: ${result.data.updated_count}, Skipped: ${result.data.skipped_count}`);
        
        toast.success(
          `✅ Synced ${result.data.total_ads} ads from Meta!\n` +
          `Created: ${result.data.created_count} | Updated: ${result.data.updated_count}`,
          { duration: 5000 }
        );
        
        // Refresh mappings list
        fetchAdMappings();
        fetchAndAutoMapAds();
      } else {
        addDebugLog('Sync All Mappings', 'FAILED', result.data.error || 'Unknown error');
        toast.error(result.data.error || 'Failed to sync ad mappings');
      }
    } catch (error) {
      addDebugLog('Sync All Mappings', 'ERROR', error.response?.data?.detail || error.message);
      toast.error(error.response?.data?.detail || 'Failed to sync ad mappings');
    } finally {
      setSyncingAllMappings(false);
    }
  };


  // Ad Mapping functions
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.ad_id || !formData.city) {
      toast.error('Please fill in required fields (Ad ID and City)');
      return;
    }
    setSaving(true);
    try {
      // Get partner name if partner_id is set
      const selectedPartner = formData.partner_id ? partners.find(p => p.id === formData.partner_id) : null;
      
      const submitData = {
        ad_id: formData.ad_id,
        city: formData.city,
        ad_name: formData.ad_name || null,
        ad_amount: formData.ad_amount ? parseFloat(formData.ad_amount) : null,
        language: formData.language || null,
        campaign: formData.campaign || null,
        source: formData.source || null,
        partner_id: formData.partner_id || null,
        partner_name: selectedPartner ? selectedPartner.name : null,
        is_active: true
      };

      if (editingAd) {
        await adCityMappingsApi.update(editingAd.id, submitData);
        toast.success('Ad mapping updated');
      } else {
        await adCityMappingsApi.create(submitData);
        toast.success('Ad mapping created');
      }
      setIsModalOpen(false);
      resetForm();
      fetchAdMappings();
    } catch (error) {
      console.error('Failed to save ad mapping:', error);
      toast.error(error.response?.data?.detail || 'Failed to save ad mapping');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormData({ ad_id: '', ad_name: '', ad_amount: '', city: '', language: '', campaign: '', source: '', partner_id: '' });
    setEditingAd(null);
  };

  const openEditModal = (ad) => {
    setEditingAd(ad);
    setFormData({
      ad_id: ad.ad_id || '',
      ad_name: ad.ad_name || '',
      ad_amount: ad.ad_amount || '',
      city: ad.city || '',
      language: ad.language || '',
      campaign: ad.campaign || '',
      source: ad.source || '',
      partner_id: ad.partner_id || '',
    });
    setIsModalOpen(true);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleToggleActive = async (ad) => {
    try {
      await adCityMappingsApi.toggleStatus(ad.id);
      toast.success(ad.is_active ? 'Ad mapping deactivated' : 'Ad mapping activated');
      fetchAdMappings();
    } catch (error) {
      console.error('Failed to toggle status:', error);
      toast.error('Failed to update status');
    }
  };

  const handleDelete = async (ad) => {
    if (!window.confirm(`Delete ad mapping "${ad.ad_name || ad.ad_id}"?`)) return;
    try {
      await adCityMappingsApi.delete(ad.id);
      toast.success('Ad mapping deleted');
      fetchAdMappings();
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Failed to delete');
    }
  };

  // Filter and sort performance data
  const filteredPerformanceData = useMemo(() => {
    if (!performanceData?.data) return [];

    let data = [...performanceData.data];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      data = data.filter(item =>
        item.ad_id?.toLowerCase().includes(query) ||
        item.ad_name?.toLowerCase().includes(query) ||
        item.city?.toLowerCase().includes(query) ||
        item.source?.toLowerCase().includes(query)
      );
    }

    // City filter
    if (filterCity && filterCity !== 'all') {
      data = data.filter(item => item.city === filterCity);
    }

    // Ad Status filter
    if (filterAdStatus && filterAdStatus !== 'all') {
      data = data.filter(item => {
        const isActive = item.status === 'ACTIVE' || item.is_active === true;
        return filterAdStatus === 'active' ? isActive : !isActive;
      });
    }

    data.sort((a, b) => {
      const aVal = a[sortBy] || 0;
      const bVal = b[sortBy] || 0;
      return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });

    return data;
  }, [performanceData, searchQuery, filterCity, filterAdStatus, sortBy, sortOrder]);

  // Filter ad mappings
  const filteredMappings = useMemo(() => {
    if (!mappingSearchQuery) return adMappings;
    const query = mappingSearchQuery.toLowerCase();
    return adMappings.filter(m =>
      m.ad_id?.toLowerCase().includes(query) ||
      m.ad_name?.toLowerCase().includes(query) ||
      m.city?.toLowerCase().includes(query)
    );
  }, [adMappings, mappingSearchQuery]);

  const totals = performanceData?.totals || {};
  const lastUpdated = performanceData?.last_updated;

  // Format last updated time
  const formatLastUpdated = (isoString) => {
    if (!isoString) return null;
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  if (loading && activeTab === 'performance') {
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
          <h1 className="text-2xl font-bold text-gray-900">Ads Management</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-gray-500">Manage ad mappings and track performance</p>
            {lastUpdated && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Updated {formatLastUpdated(lastUpdated)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Token Status for CEO/CTO */}
          {canManageToken && tokenInfo && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm cursor-pointer ${
              tokenInfo.is_valid && tokenInfo.expires_in_days > 7
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : tokenInfo.is_valid && tokenInfo.expires_in_days > 0
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-red-50 text-red-700 border border-red-200'
            }`} onClick={() => setShowTokenModal(true)} title="Click to manage token">
              <Key className="h-4 w-4" />
              {tokenInfo.is_valid ? (
                <span>
                  {tokenInfo.expires_in_days === -1 
                    ? 'Token Never Expires' 
                    : tokenInfo.expires_in_days > 0 
                    ? `Token: ${tokenInfo.expires_in_days}d left`
                    : 'Token Expired'}
                </span>
              ) : (
                <span>Token Invalid</span>
              )}
            </div>
          )}
          
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
          
          {/* SINGLE UNIFIED REFRESH BUTTON */}
          <Button
            variant="default"
            size="sm"
            onClick={handleUnifiedRefresh}
            disabled={refreshing || syncing || mappingLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
            data-testid="unified-refresh-btn"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${(refreshing || syncing || mappingLoading) ? 'animate-spin' : ''}`} />
            {refreshing || syncing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border mb-6">
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab('performance')}
            className={`px-6 py-4 text-sm font-medium flex items-center gap-2 transition-all border-b-2 -mb-px ${
              activeTab === 'performance'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            data-testid="performance-tab"
          >
            <BarChart3 className="h-4 w-4" /> Ad Performance
          </button>
          <button
            onClick={() => setActiveTab('mapping')}
            className={`px-6 py-4 text-sm font-medium flex items-center gap-2 transition-all border-b-2 -mb-px ${
              activeTab === 'mapping'
                ? 'border-blue-600 text-blue-600 bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
            data-testid="mapping-tab"
          >
            <MapPin className="h-4 w-4" /> Ad ID Mapping
          </button>
        </div>

        {/* Performance Tab */}
        {activeTab === 'performance' && (
          <div className="p-4">
            {/* Date Range Filter - Unified Pill Button Style */}
            <div className="bg-white rounded-xl border p-4 mb-4">
              <div className="flex flex-wrap items-center gap-3">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-sm font-medium text-gray-600">Date Range:</span>
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { key: 'today', label: 'Today', days: '0' },
                    { key: 'week', label: 'This Week', days: '7' },
                    { key: 'month', label: 'This Month', days: '30' },
                    { key: '60days', label: 'Last 60 Days', days: '60' },
                    { key: '90days', label: 'Last 90 Days', days: '90' },
                  ].map((preset) => (
                    <button 
                      key={preset.key} 
                      onClick={() => { setDateRangeType(preset.key); setDateRange(preset.days); }}
                      className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                        dateRangeType === preset.key 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                      data-testid={`date-preset-${preset.key}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Filters Row */}
            <div className="flex flex-wrap items-center gap-4 mb-6">
              {/* Search */}
              <div className="flex-1 max-w-md">
                <Input
                  placeholder="Search by Ad ID, name, city..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-10"
                  data-testid="search-input"
                />
              </div>

              {/* City Filter */}
              <Select value={filterCity} onValueChange={setFilterCity}>
                <SelectTrigger className="w-40" data-testid="city-filter-select">
                  <SelectValue placeholder="All Cities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Cities</SelectItem>
                  {[...new Set(performanceData?.ads?.map(ad => ad.city).filter(Boolean) || [])].sort().map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Ad Status Filter */}
              <Select value={filterAdStatus} onValueChange={setFilterAdStatus}>
                <SelectTrigger className="w-36" data-testid="ad-status-filter-select">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort By */}
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
                    <SelectItem value="cost_per_result">CPR</SelectItem>
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

            {/* Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <SummaryCard
                title="Total Ad Spend"
                value={formatCurrency(totals.total_ad_spend || 0)}
                subtext={`${filteredPerformanceData.length} active ads`}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <SummaryCard
                title="Cost Per Result (CPR)"
                value={formatCurrency(totals.overall_cpr || 0)}
                subtext="Avg. cost per sale"
                icon={Target}
                color="amber"
              />
              <SummaryCard
                title="Cost Per Lead"
                value={formatCurrency(totals.overall_cpl || 0)}
                subtext="Avg. cost per lead"
                icon={Users}
                color="purple"
              />
              <SummaryCard
                title="Total Impressions"
                value={formatNumber(totals.total_impressions || 0)}
                icon={Eye}
                color="blue"
              />
              <SummaryCard
                title="Total Clicks"
                value={formatNumber(totals.total_clicks || 0)}
                icon={MousePointer}
                color="green"
              />
            </div>

            {/* Performance Table */}
            <div className="border rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Ad Info</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">City</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Spend</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Leads</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Converted</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Revenue</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">CPR</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">ROI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPerformanceData.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-12">
                          <BarChart3 className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                          <p className="text-gray-500">No ad performance data available</p>
                          <p className="text-sm text-gray-400 mt-1">
                            Create ad mappings and start running ads
                          </p>
                        </td>
                      </tr>
                    ) : (
                      filteredPerformanceData.map((item, index) => (
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
                                {item.meta_status && (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    item.meta_status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {item.meta_status}
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
                            <span className={`text-sm font-medium ${item.cost_per_result > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                              {item.cost_per_result > 0 ? formatCurrency(item.cost_per_result) : '-'}
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
            {filteredPerformanceData.length > 0 && (
              <div className="mt-6 bg-slate-50 rounded-xl p-4">
                <h3 className="font-semibold text-gray-900 mb-4">Cost Analysis</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Avg Cost/Lead</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">
                      {formatCurrency(totals.total_leads > 0 ? totals.total_ad_spend / totals.total_leads : 0)}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Avg Cost/Conversion</p>
                    <p className="text-lg font-bold text-gray-900 mt-1">
                      {formatCurrency(totals.total_converted > 0 ? totals.total_ad_spend / totals.total_converted : 0)}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border">
                    <p className="text-xs text-gray-500 uppercase tracking-wider">Revenue/Lead</p>
                    <p className="text-lg font-bold text-emerald-600 mt-1">
                      {formatCurrency(totals.total_leads > 0 ? totals.total_revenue / totals.total_leads : 0)}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border">
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
          </div>
        )}

        {/* Ad Mapping Tab */}
        {activeTab === 'mapping' && (
          <div className="p-4">
            {/* Filters and Actions */}
            <div className="flex items-center justify-between mb-4 gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by Ad ID, name, city..."
                  value={mappingSearchQuery}
                  onChange={(e) => setMappingSearchQuery(e.target.value)}
                  className="pl-10 h-10"
                  data-testid="search-ad-mapping"
                />
              </div>
              <div className="flex items-center gap-2">
                {/* Sync All Ad Mappings - fetches from Meta and creates ad_name mappings */}
                <button 
                  className="px-4 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl hover:from-green-700 hover:to-green-800 flex items-center gap-2 font-medium shadow-lg shadow-green-500/25 transition-all disabled:opacity-50"
                  onClick={handleSyncAllAdMappings}
                  disabled={syncingAllMappings}
                  data-testid="sync-all-mappings-btn"
                  title="Fetch all ads from Meta and create city mappings based on geo-targeting"
                >
                  {syncingAllMappings ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  {syncingAllMappings ? 'Syncing...' : 'Sync from Meta'}
                </button>
                <button 
                  className="px-5 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 flex items-center gap-2 font-medium shadow-lg shadow-blue-500/25 transition-all"
                  onClick={openCreateModal}
                  data-testid="create-ad-btn"
                >
                  <Plus className="h-4 w-4" /> Create Ad
                </button>
              </div>
            </div>

            {/* AD Mappings Table */}
            <div className="border rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Ad ID</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Ad Name</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">City</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Partner</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Language</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Source</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Active</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {mappingLoading ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12">
                        <div className="flex items-center justify-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                          <span className="text-gray-500">Loading ad mappings...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredMappings.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-12">
                        <MapPin className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                        <p className="text-gray-500">No ad mappings found</p>
                        <button 
                          onClick={openCreateModal}
                          className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
                        >
                          Create your first ad mapping
                        </button>
                      </td>
                    </tr>
                  ) : (
                    filteredMappings.map((ad) => (
                      <tr key={ad.id} className="hover:bg-slate-50 transition-colors" data-testid={`ad-mapping-row-${ad.id}`}>
                        <td className="px-4 py-4">
                          <span className="font-mono text-sm text-gray-900">{ad.ad_id}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="font-medium text-gray-900">{ad.ad_name || '-'}</span>
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-700">{ad.city}</span>
                        </td>
                        <td className="px-4 py-4">
                          {ad.partner_name ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-violet-100 text-violet-800 border border-violet-200">
                              <Building2 className="h-3 w-3 mr-1" />
                              {ad.partner_name}
                            </span>
                          ) : (
                            <span className="text-xs text-gray-400">B2C Default</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className="text-sm text-gray-700">{ad.language || '-'}</span>
                        </td>
                        <td className="px-4 py-4">
                          {ad.source && (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 border border-blue-200">
                              {ad.source}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleActive(ad)}
                              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                                ad.is_active ? 'bg-emerald-500' : 'bg-gray-300'
                              }`}
                              data-testid={`toggle-active-${ad.id}`}
                            >
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                ad.is_active ? 'translate-x-6' : 'translate-x-1'
                              }`} />
                            </button>
                            <span className={`text-sm font-medium ${ad.is_active ? 'text-emerald-600' : 'text-gray-500'}`}>
                              {ad.is_active ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => openEditModal(ad)}
                              className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                              data-testid={`edit-ad-${ad.id}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button 
                              onClick={() => handleDelete(ad)}
                              className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                              data-testid={`delete-ad-${ad.id}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Debug Panel Toggle */}
            {canManageToken && (
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDebugPanel(!showDebugPanel)}
                  className="text-xs"
                >
                  {showDebugPanel ? '🔽 Hide Debug Logs' : '🔧 Show Debug Logs'}
                </Button>
              </div>
            )}
            
            {/* Debug Logs Panel */}
            {showDebugPanel && (
              <div className="mt-4 bg-gray-900 rounded-xl p-4 max-h-64 overflow-y-auto">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium text-green-400">🔧 Debug Logs</h4>
                  <button 
                    onClick={() => setDebugLogs([])}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Clear Logs
                  </button>
                </div>
                {debugLogs.length === 0 ? (
                  <p className="text-gray-500 text-xs">No logs yet. Click "Refresh & Auto-Map" to see activity.</p>
                ) : (
                  <div className="space-y-1 font-mono text-xs">
                    {debugLogs.map((log, idx) => (
                      <div key={idx} className="flex gap-2">
                        <span className="text-gray-500">[{log.timestamp}]</span>
                        <span className={`font-medium ${
                          log.status === 'SUCCESS' || log.status === 'DONE' ? 'text-green-400' :
                          log.status === 'ERROR' || log.status === 'FAILED' || log.status === 'FATAL ERROR' ? 'text-red-400' :
                          log.status === 'CALLING' ? 'text-yellow-400' :
                          'text-blue-400'
                        }`}>
                          [{log.status}]
                        </span>
                        <span className="text-white">{log.action}:</span>
                        <span className="text-gray-300 break-all">{log.details}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            
            {/* Unmapped Ads Section (CEO/CTO only) */}
            {canManageToken && (
              <div className="mt-6 space-y-6">
                {/* Unmapped Ads from WhatsApp Leads - Always available */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                        <MessageSquare className="h-4 w-4 text-green-500" />
                        Unmapped Ads from WhatsApp Leads
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Ads detected from WhatsApp messages that need city mapping (works even if Meta token expired)
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={fetchAndAutoMapAds}
                      disabled={loadingUnmapped || autoMapping}
                      className="text-xs bg-green-50 border-green-300 text-green-700 hover:bg-green-100"
                    >
                      <RefreshCw className={`h-3 w-3 mr-1 ${(loadingUnmapped || autoMapping) ? 'animate-spin' : ''}`} />
                      {autoMapping ? 'Auto-Mapping...' : 'Refresh & Auto-Map'}
                    </Button>
                  </div>
                  
                  {(loadingUnmapped || autoMapping) ? (
                    <div className="text-center py-8 border rounded-xl bg-slate-50">
                      <Loader2 className="h-5 w-5 animate-spin text-green-600 mx-auto" />
                      <p className="text-sm text-gray-500 mt-2">
                        {autoMapping ? 'Auto-mapping ads with targeting...' : 'Loading unmapped ads...'}
                      </p>
                    </div>
                  ) : unmappedAdsFromLeads.length === 0 ? (
                    <div className="text-center py-8 border rounded-xl bg-emerald-50 border-emerald-200">
                      <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                      <p className="text-sm text-emerald-700 font-medium">All WhatsApp ads are mapped!</p>
                      <p className="text-xs text-emerald-600 mt-1">No unmapped ads from WhatsApp leads</p>
                    </div>
                  ) : (
                    <div className="border rounded-xl overflow-hidden">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-green-50 border-b border-green-200">
                            <th className="px-4 py-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider">Ad Name / ID</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider">Source</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider">Current City</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider">Lead Count</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider">First Seen</th>
                            <th className="px-4 py-3 text-left text-xs font-semibold text-green-700 uppercase tracking-wider">Map to City</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-green-100 bg-white">
                          {unmappedAdsFromLeads.map((ad) => (
                            <tr key={ad.id} className="hover:bg-green-50/50 transition-colors">
                              <td className="px-4 py-3">
                                <span className="text-sm font-medium text-gray-900">{ad.ad_name || ad.ad_id || 'Unknown'}</span>
                                {ad.referral_headline && ad.referral_headline !== ad.ad_name && (
                                  <p className="text-xs text-gray-500 mt-0.5">Headline: {ad.referral_headline}</p>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                                  {ad.source === 'lead_scan' ? 'Lead Scan' : 'WhatsApp'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                {ad.current_cities && ad.current_cities.length > 0 ? (
                                  <div className="flex flex-wrap gap-1">
                                    {ad.current_cities.map((city, idx) => (
                                      <span key={idx} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                                        <MapPin className="h-3 w-3 mr-1" />
                                        {city}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">No city data</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-purple-100 text-purple-700 text-xs font-medium">
                                  {ad.lead_count} leads
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <span className="text-xs text-gray-500">
                                  {ad.first_seen_at ? new Date(ad.first_seen_at).toLocaleDateString() : 'N/A'}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <select 
                                    className="text-xs border rounded px-2 py-1 w-32"
                                    defaultValue={ad.current_cities?.[0] || ''}
                                    onChange={(e) => {
                                      if (e.target.value) {
                                        handleMapFromLeads(ad, e.target.value);
                                      }
                                    }}
                                  >
                                    <option value="">Select city...</option>
                                    {cities.map(city => (
                                      <option key={city} value={city}>{city}</option>
                                    ))}
                                  </select>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Unmapped Ads from Meta - Only when configured */}
                {metaStatus.configured && (
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-500" />
                          Unmapped Ads from Meta
                        </h3>
                        <p className="text-sm text-gray-500 mt-1">
                          These ads are running on Meta but don't have city mappings in the CRM
                        </p>
                        {unmappedAds.length > 0 && (
                          <div className="flex gap-3 mt-2">
                            <span className="inline-flex items-center text-xs px-2 py-1 rounded bg-green-100 text-green-700">
                              {unmappedWithTargeting} with targeting (auto-mapped on refresh)
                            </span>
                            <span className="inline-flex items-center text-xs px-2 py-1 rounded bg-red-100 text-red-700">
                              {unmappedNoTargeting} need manual mapping
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {tokenInfo && !tokenInfo.is_valid ? (
                      <div className="text-center py-8 border rounded-xl bg-red-50 border-red-200">
                        <XCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                        <p className="text-sm text-red-700 font-medium">Meta Token Expired</p>
                        <p className="text-xs text-red-600 mt-1">Please refresh the token to fetch ads from Meta</p>
                      </div>
                    ) : unmappedAds.length === 0 ? (
                      <div className="text-center py-8 border rounded-xl bg-emerald-50 border-emerald-200">
                        <CheckCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
                        <p className="text-sm text-emerald-700 font-medium">All Meta ads are mapped!</p>
                        <p className="text-xs text-emerald-600 mt-1">No unmapped ads found</p>
                      </div>
                    ) : (
                      <div className="border rounded-xl overflow-hidden">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-amber-50 border-b border-amber-200">
                              <th className="px-4 py-3 text-left text-xs font-semibold text-amber-700 uppercase tracking-wider">Ad ID</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-amber-700 uppercase tracking-wider">Ad Name</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-amber-700 uppercase tracking-wider">Status</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-amber-700 uppercase tracking-wider">Suggested City</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-amber-700 uppercase tracking-wider">Targeting</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-amber-700 uppercase tracking-wider">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-amber-100">
                            {unmappedAds.slice(0, 10).map((ad) => (
                              <tr 
                                key={ad.ad_id} 
                                className={`transition-colors ${
                                  ad.has_targeting 
                                    ? 'bg-green-50 hover:bg-green-100'  // Green for auto-mappable
                                    : 'bg-red-50 hover:bg-red-100'      // Red for needs manual
                                }`}
                                data-testid={`unmapped-ad-${ad.ad_id}`}
                              >
                                <td className="px-4 py-3">
                                  <span className="font-mono text-xs text-gray-700">{ad.ad_id}</span>
                                </td>
                                <td className="px-4 py-3">
                                  <span className="text-sm font-medium text-gray-900">{ad.ad_name || 'Unnamed'}</span>
                                  {ad.adset_name && (
                                    <p className="text-xs text-gray-500 mt-0.5">{ad.adset_name}</p>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                    ad.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
                                  }`}>
                                    {ad.status || 'Unknown'}
                                  </span>
                                </td>
                                <td className="px-4 py-3">
                                  {ad.suggested_city ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-700 text-xs font-medium">
                                      <MapPin className="h-3 w-3" />
                                      {ad.suggested_city}
                                    </span>
                                  ) : (
                                    <span className="text-xs text-gray-400">No suggestion</span>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <div className="text-xs text-gray-500">
                                    {ad.targeting_cities?.length > 0 && (
                                      <span className="block">Cities: {ad.targeting_cities.join(', ')}</span>
                                    )}
                                    {ad.targeting_regions?.length > 0 && (
                                      <span className="block">Regions: {ad.targeting_regions.join(', ')}</span>
                                    )}
                                    {!ad.targeting_cities?.length && !ad.targeting_regions?.length && (
                                      <span className="text-gray-400">No geo targeting</span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-4 py-3">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleQuickMap(ad)}
                                    className="text-xs h-7 px-2 border-amber-300 text-amber-700 hover:bg-amber-100"
                                    data-testid={`quick-map-${ad.ad_id}`}
                                  >
                                    <Plus className="h-3 w-3 mr-1" />
                                    Quick Map
                                  </Button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {unmappedAds.length > 10 && (
                          <div className="px-4 py-2 bg-amber-50 border-t border-amber-200 text-xs text-amber-700 text-center">
                            Showing 10 of {unmappedAds.length} unmapped ads
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info Banner */}
      {!metaStatus.configured && activeTab === 'performance' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
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
      
      {/* Token Management Modal */}
      <Dialog open={showTokenModal} onOpenChange={setShowTokenModal}>
        <DialogContent className="sm:max-w-[550px]" data-testid="token-modal">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5 text-blue-600" />
              Connect to Facebook Ads
            </DialogTitle>
            <DialogDescription>
              Get a new access token in 3 simple steps
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 pt-4">
            {/* Current Token Status */}
            {tokenInfo && (
              <div className={`p-3 rounded-lg border ${
                tokenInfo.is_valid 
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-red-50 border-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  <Shield className={`h-4 w-4 ${
                    tokenInfo.is_valid ? 'text-emerald-600' : 'text-red-600'
                  }`} />
                  <span className="font-medium text-sm">
                    {tokenInfo.is_valid 
                      ? `✅ Connected (${tokenInfo.expires_in_days} days left)` 
                      : '❌ Token Expired - Follow steps below'}
                  </span>
                </div>
              </div>
            )}
            
            {/* Step-by-Step Instructions with Direct Link */}
            <div className="space-y-3">
              {/* Step 1 */}
              <div className="flex gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex-shrink-0 w-6 h-6 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold">1</div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-800">Click the button below to open Facebook</p>
                  <a 
                    href={`https://developers.facebook.com/tools/explorer/?app_id=759383146339304&method=GET&path=me&version=v21.0`}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Graph API Explorer
                  </a>
                </div>
              </div>

              {/* Step 2 */}
              <div className="flex gap-3 p-3 bg-amber-50 rounded-lg border border-amber-100">
                <div className="flex-shrink-0 w-6 h-6 bg-amber-600 text-white rounded-full flex items-center justify-center text-sm font-bold">2</div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-800">Add these permissions & click "Generate Access Token"</p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="px-2 py-0.5 bg-amber-200 text-amber-800 rounded text-xs font-mono">ads_read</span>
                    <span className="px-2 py-0.5 bg-amber-200 text-amber-800 rounded text-xs font-mono">ads_management</span>
                    <span className="px-2 py-0.5 bg-amber-200 text-amber-800 rounded text-xs font-mono">business_management</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Click "Permissions" dropdown → search & add each one → click "Generate"</p>
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex gap-3 p-3 bg-green-50 rounded-lg border border-green-100">
                <div className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">3</div>
                <div className="flex-1">
                  <p className="font-medium text-sm text-gray-800">Copy the token & paste below</p>
                  <div className="flex gap-2 mt-2">
                    <Input
                      placeholder="Paste your access token here..."
                      value={newToken}
                      onChange={(e) => setNewToken(e.target.value)}
                      className="flex-1 text-xs font-mono h-9"
                      data-testid="new-token-input"
                    />
                    <Button
                      onClick={handleUpdateToken}
                      disabled={tokenLoading || !newToken.trim()}
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {tokenLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Connect'}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Tip */}
            <div className="bg-slate-100 p-3 rounded-lg text-xs text-gray-600 flex items-start gap-2">
              <Info className="h-4 w-4 text-slate-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-medium">Pro tip:</span> The token lasts ~60 days. After connecting, you won't need to do this again for 2 months!
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Ad Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]" data-testid="ad-modal">
          <DialogHeader className="border-b pb-4">
            <DialogTitle className="flex items-center justify-between">
              <span>{editingAd ? 'Edit Ad' : 'Create Ad'}</span>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
              >
                <X className="h-5 w-5" />
              </button>
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 pt-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Ad Id:</Label>
                <Input 
                  value={formData.ad_id} 
                  onChange={(e) => setFormData({ ...formData, ad_id: e.target.value })}
                  className="h-10"
                  placeholder="Enter Ad ID"
                  data-testid="ad-id-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Ad Amount:</Label>
                <Input 
                  value={formData.ad_amount} 
                  onChange={(e) => setFormData({ ...formData, ad_amount: e.target.value })}
                  className="h-10"
                  placeholder="Amount"
                  type="number"
                  data-testid="ad-amount-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">City</Label>
                <Select value={formData.city || 'select'} onValueChange={(v) => setFormData({ ...formData, city: v === 'select' ? '' : v })}>
                  <SelectTrigger className="h-10" data-testid="ad-city-select">
                    <SelectValue placeholder="-- Select --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="select">-- Select --</SelectItem>
                    {cities.map((c) => (<SelectItem key={c} value={c}>{c}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Language:</Label>
                <Select value={formData.language || 'select'} onValueChange={(v) => setFormData({ ...formData, language: v === 'select' ? '' : v })}>
                  <SelectTrigger className="h-10" data-testid="ad-language-select">
                    <SelectValue placeholder="-- Select --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="select">-- Select --</SelectItem>
                    {languages.map((l) => (<SelectItem key={l} value={l}>{l}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Campaign:</Label>
                <Input 
                  value={formData.campaign} 
                  onChange={(e) => setFormData({ ...formData, campaign: e.target.value })}
                  className="h-10"
                  placeholder="Campaign name"
                  data-testid="ad-campaign-input"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Source</Label>
                <Select value={formData.source || 'select'} onValueChange={(v) => setFormData({ ...formData, source: v === 'select' ? '' : v })}>
                  <SelectTrigger className="h-10" data-testid="ad-source-select">
                    <SelectValue placeholder="-- Select --" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="select">-- Select --</SelectItem>
                    {sources.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Partner Assignment - Option C */}
              <div className="space-y-2 col-span-2">
                <Label className="text-sm font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-violet-500" />
                  Assign to Partner (Optional)
                </Label>
                <Select value={formData.partner_id || 'none'} onValueChange={(v) => setFormData({ ...formData, partner_id: v === 'none' ? '' : v })}>
                  <SelectTrigger className="h-10" data-testid="ad-partner-select">
                    <SelectValue placeholder="B2C Default (No specific partner)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">B2C Default (No specific partner)</SelectItem>
                    {partners.filter(p => p.is_active).map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${p.type === 'b2c' ? 'bg-blue-500' : p.type === 'bank' ? 'bg-emerald-500' : p.type === 'insurance' ? 'bg-amber-500' : 'bg-purple-500'}`} />
                          {p.name}
                          <span className="text-xs text-gray-400">({p.type.toUpperCase()})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">Leads from this ad will be assigned to the selected partner</p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsModalOpen(false)}
                className="px-6"
              >
                Cancel
              </Button>
              <Button 
                type="submit" 
                disabled={saving}
                className="px-6 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700"
                data-testid="save-ad-btn"
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingAd ? 'Update' : 'Add'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
