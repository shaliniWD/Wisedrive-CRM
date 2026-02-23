/**
 * useLeads Hook
 * Custom hook for managing lead data, filtering, and pagination
 * 
 * This hook can be used to gradually migrate lead management logic
 * out of LeadsPage.jsx. It supports both client-side and server-side filtering.
 * 
 * Usage:
 * const { leads, filteredLeads, loading, filters, pagination, actions } = useLeads({
 *   countryId: user?.country_id,
 *   isSalesExec: user?.role_code === 'SALES_EXEC',
 *   serverSideFiltering: true, // Use API-level filtering
 * });
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { leadsApi, employeesApi, utilityApi, inspectionPackagesApi, partnersApi } from '@/services/api';
import { toast } from 'sonner';

// Date filter helpers - Get date range for presets
export const getDateRange = (preset) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (preset) {
    case 'today':
      return { 
        start: today.toISOString().split('T')[0], 
        end: today.toISOString().split('T')[0] 
      };
    case 'yesterday': {
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { 
        start: yesterday.toISOString().split('T')[0], 
        end: yesterday.toISOString().split('T')[0] 
      };
    }
    case 'this_week': {
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      return { 
        start: weekStart.toISOString().split('T')[0], 
        end: today.toISOString().split('T')[0] 
      };
    }
    case 'this_month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { 
        start: monthStart.toISOString().split('T')[0], 
        end: today.toISOString().split('T')[0] 
      };
    }
    default:
      return null; // 'all' or unknown preset
  }
};

// Date preset options
export const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

export const useLeads = (options = {}) => {
  const {
    countryId = null,
    isSalesExec = false,
    serverSideFiltering = true,
    pageSize = 10,
  } = options;

  // ==================== DATA STATES ====================
  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [cities, setCities] = useState([]);
  const [sources, setSources] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [inspectionPackages, setInspectionPackages] = useState([]);
  const [partners, setPartners] = useState([]);
  const [adMappedCities, setAdMappedCities] = useState([]);
  
  // ==================== UI STATES ====================
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // ==================== FILTER STATES ====================
  const [search, setSearch] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [dateFilterPreset, setDateFilterPreset] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // For stat card filtering
  
  // ==================== PAGINATION STATES ====================
  const [currentPage, setCurrentPage] = useState(1);
  
  // ==================== COMPUTED VALUES ====================
  
  // Filtered employees - only sales roles and those with leads assigned
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp => {
      const salesRoles = ['SALES_EXEC', 'SALES_LEAD', 'SALES_HEAD', 'COUNTRY_HEAD'];
      const hasSalesRole = salesRoles.includes(emp.role_code);
      const hasLeadsAssigned = leads.some(l => l.assigned_to === emp.name || l.assigned_to === emp.id);
      return hasSalesRole || hasLeadsAssigned;
    });
  }, [employees, leads]);
  
  // Filtered cities - AD mapped + cities with leads
  const filteredCities = useMemo(() => {
    return [...new Set([
      ...adMappedCities,
      ...leads.map(l => l.city).filter(Boolean)
    ])].sort();
  }, [adMappedCities, leads]);
  
  // ==================== DATA FETCHING ====================
  
  const fetchData = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);
    
    try {
      // Build API params for server-side filtering
      const params = {};
      if (serverSideFiltering) {
        if (search) params.search = search;
        if (filterEmployee && filterEmployee !== 'all') params.assigned_to = filterEmployee;
        if (filterStatus && filterStatus !== 'all') params.lead_status = filterStatus;
        if (filterCity && filterCity !== 'all') params.city = filterCity;
        if (filterSource && filterSource !== 'all') params.source = filterSource;
        if (filterDateFrom) params.date_from = filterDateFrom;
        if (filterDateTo) params.date_to = filterDateTo;
      }
      
      const [
        leadsRes, 
        employeesRes, 
        citiesRes, 
        sourcesRes, 
        statusesRes, 
        packagesRes, 
        partnersRes,
        adMappingsRes
      ] = await Promise.all([
        leadsApi.getAll(params),
        employeesApi.getAll(),
        utilityApi.getCities(),
        utilityApi.getLeadSources(),
        utilityApi.getLeadStatuses(),
        countryId ? inspectionPackagesApi.getPackages(countryId) : Promise.resolve({ data: [] }),
        partnersApi.getPartners({ is_active: true }),
        fetch(`${process.env.REACT_APP_BACKEND_URL}/api/settings/ad-city-mappings`)
          .then(r => r.json())
          .catch(() => []),
      ]);
      
      setLeads(leadsRes.data || []);
      setEmployees(employeesRes.data || []);
      setCities(citiesRes.data || []);
      setSources(sourcesRes.data || []);
      setStatuses(statusesRes.data || []);
      
      // Filter only active packages and sort by order
      const activePackages = (packagesRes.data || [])
        .filter(p => p.is_active)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
      setInspectionPackages(activePackages);
      
      setPartners(partnersRes.data || []);
      
      // Extract unique cities from AD mappings
      const mappedCities = [...new Set((adMappingsRes || []).map(m => m.city).filter(Boolean))];
      setAdMappedCities(mappedCities);
      
    } catch (error) {
      console.error('Error fetching leads data:', error);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, filterEmployee, filterStatus, filterCity, filterSource, filterDateFrom, filterDateTo, countryId, serverSideFiltering]);
  
  // Initial fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);
  
  // ==================== CLIENT-SIDE FILTERING ====================
  
  const getFilteredLeads = useCallback(() => {
    let filtered = [...leads];
    
    // Apply stat card active filter
    switch (activeFilter) {
      case 'new_leads':
        filtered = filtered.filter(l => l.status === 'NEW LEAD');
        break;
      case 'hot':
        filtered = filtered.filter(l => l.status === 'HOT LEADS');
        break;
      case 'rcb_whatsapp':
        filtered = filtered.filter(l => l.status === 'RCB WHATSAPP' || l.reminder_reason === 'RCB_WHATSAPP');
        break;
      case 'followup':
        filtered = filtered.filter(l => 
          l.status === 'FOLLOW UP' || 
          l.status === 'WHATSAPP FOLLOW UP' || 
          l.status === 'Repeat follow up' ||
          l.reminder_date
        );
        break;
      case 'payment_sent':
        filtered = filtered.filter(l => l.status === 'PAYMENT LINK SENT' || l.payment_link);
        break;
      default:
        break;
    }
    
    // Client-side search (if not using server-side)
    if (!serverSideFiltering && search) {
      const query = search.toLowerCase();
      filtered = filtered.filter(lead =>
        (lead.name?.toLowerCase().includes(query)) ||
        (lead.mobile?.includes(query)) ||
        (lead.city?.toLowerCase().includes(query))
      );
    }
    
    return filtered;
  }, [leads, activeFilter, search, serverSideFiltering]);
  
  const filteredLeads = useMemo(() => getFilteredLeads(), [getFilteredLeads]);
  
  // ==================== PAGINATION ====================
  
  const totalPages = Math.ceil(filteredLeads.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedLeads = filteredLeads.slice(startIndex, endIndex);
  
  // ==================== DATE PRESET HANDLER ====================
  
  const applyDatePreset = useCallback((preset) => {
    setDateFilterPreset(preset);
    setCurrentPage(1);
    
    if (preset === 'all' || preset === '') {
      setFilterDateFrom('');
      setFilterDateTo('');
    } else if (preset === 'custom') {
      // Keep existing custom dates
    } else {
      const range = getDateRange(preset);
      if (range) {
        setFilterDateFrom(range.start);
        setFilterDateTo(range.end);
      }
    }
  }, []);
  
  // ==================== RESET FILTERS ====================
  
  const resetFilters = useCallback(() => {
    setSearch('');
    setFilterEmployee('');
    setFilterStatus('');
    setFilterCity('');
    setFilterSource('');
    setFilterDateFrom('');
    setFilterDateTo('');
    setDateFilterPreset('');
    setActiveFilter('all');
    setCurrentPage(1);
  }, []);
  
  // ==================== REFRESH ====================
  
  const refresh = useCallback(() => {
    fetchData(false);
  }, [fetchData]);
  
  // ==================== RETURN VALUES ====================
  
  return {
    // Data
    leads: paginatedLeads,
    allLeads: leads,
    filteredLeads,
    employees,
    filteredEmployees,
    cities,
    filteredCities,
    sources,
    statuses,
    inspectionPackages,
    partners,
    
    // Loading states
    loading,
    refreshing,
    
    // Filter states
    filters: {
      search, setSearch,
      filterEmployee, setFilterEmployee,
      filterStatus, setFilterStatus,
      filterCity, setFilterCity,
      filterSource, setFilterSource,
      filterDateFrom, setFilterDateFrom,
      filterDateTo, setFilterDateTo,
      dateFilterPreset, setDateFilterPreset,
      activeFilter, setActiveFilter,
    },
    
    // Pagination
    pagination: {
      currentPage, setCurrentPage,
      totalPages,
      pageSize,
      totalCount: filteredLeads.length,
      startIndex,
      endIndex,
    },
    
    // Actions
    actions: {
      fetchData,
      refresh,
      resetFilters,
      applyDatePreset,
      getFilteredLeads,
    },
  };
};

export default useLeads;
