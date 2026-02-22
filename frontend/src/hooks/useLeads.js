/**
 * useLeads Hook
 * Manages lead data fetching, filtering, and pagination
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { leadsApi, employeesApi } from '@/services/api';
import { toast } from 'sonner';

// Date filter helpers
const getDateRange = (filter) => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  switch (filter) {
    case 'today':
      return { start: today, end: now };
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      return { start: yesterday, end: today };
    case 'thisWeek':
      const weekStart = new Date(today);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      return { start: weekStart, end: now };
    case 'lastWeek':
      const lastWeekEnd = new Date(today);
      lastWeekEnd.setDate(lastWeekEnd.getDate() - lastWeekEnd.getDay());
      const lastWeekStart = new Date(lastWeekEnd);
      lastWeekStart.setDate(lastWeekStart.getDate() - 7);
      return { start: lastWeekStart, end: lastWeekEnd };
    case 'thisMonth':
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: monthStart, end: now };
    case 'lastMonth':
      const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: lastMonthStart, end: lastMonthEnd };
    default:
      return null;
  }
};

export const useLeads = (countryId) => {
  // Data states
  const [leads, setLeads] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [cityFilter, setCityFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);

  // Fetch leads
  const fetchLeads = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    else setRefreshing(true);
    
    try {
      const response = await leadsApi.getLeads();
      setLeads(response.data || []);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast.error('Failed to load leads');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch employees
  const fetchEmployees = useCallback(async () => {
    try {
      const response = await employeesApi.getUsers({ country_id: countryId });
      // Filter to sales roles only
      const salesRoles = ['SALES_EXECUTIVE', 'SALES_MANAGER', 'SALES_HEAD', 'TEAM_LEAD'];
      const salesEmployees = (response.data || []).filter(emp => 
        salesRoles.includes(emp.role_code) || emp.is_sales_rep
      );
      setEmployees(salesEmployees);
    } catch (error) {
      console.error('Error fetching employees:', error);
    }
  }, [countryId]);

  // Fetch statuses
  const fetchStatuses = useCallback(async () => {
    try {
      const response = await leadsApi.getStatuses();
      setStatuses(response.data || []);
    } catch (error) {
      console.error('Error fetching statuses:', error);
    }
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchLeads();
    fetchEmployees();
    fetchStatuses();
  }, [fetchLeads, fetchEmployees, fetchStatuses]);

  // Get unique cities from leads
  const cities = useMemo(() => {
    const uniqueCities = [...new Set(leads.map(l => l.city).filter(Boolean))];
    return uniqueCities.sort();
  }, [leads]);

  // Filter leads
  const filteredLeads = useMemo(() => {
    let filtered = [...leads];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(lead =>
        (lead.name?.toLowerCase().includes(query)) ||
        (lead.mobile?.includes(query)) ||
        (lead.city?.toLowerCase().includes(query)) ||
        (lead.ad_name?.toLowerCase().includes(query))
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(lead => lead.status === statusFilter);
    }

    // Employee filter
    if (employeeFilter !== 'all') {
      filtered = filtered.filter(lead => lead.assigned_to === employeeFilter);
    }

    // City filter
    if (cityFilter !== 'all') {
      filtered = filtered.filter(lead => lead.city === cityFilter);
    }

    // Date filter (quick filters)
    if (dateFilter !== 'all') {
      const range = getDateRange(dateFilter);
      if (range) {
        filtered = filtered.filter(lead => {
          const leadDate = new Date(lead.created_at);
          return leadDate >= range.start && leadDate <= range.end;
        });
      }
    }

    // Custom date range
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(lead => new Date(lead.created_at) >= start);
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filtered = filtered.filter(lead => new Date(lead.created_at) <= end);
    }

    // Sort by created_at desc
    filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    return filtered;
  }, [leads, searchQuery, statusFilter, employeeFilter, cityFilter, dateFilter, startDate, endDate]);

  // Paginated leads
  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, currentPage, pageSize]);

  // Total pages
  const totalPages = Math.ceil(filteredLeads.length / pageSize);

  // Reset filters
  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('all');
    setEmployeeFilter('all');
    setCityFilter('all');
    setDateFilter('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  }, []);

  // Refresh data
  const refresh = useCallback(() => {
    fetchLeads(false);
  }, [fetchLeads]);

  return {
    // Data
    leads: paginatedLeads,
    allLeads: filteredLeads,
    employees,
    statuses,
    cities,
    
    // Loading states
    loading,
    refreshing,
    
    // Filter states and setters
    searchQuery, setSearchQuery,
    statusFilter, setStatusFilter,
    employeeFilter, setEmployeeFilter,
    cityFilter, setCityFilter,
    dateFilter, setDateFilter,
    startDate, setStartDate,
    endDate, setEndDate,
    
    // Pagination
    currentPage, setCurrentPage,
    totalPages,
    pageSize,
    totalCount: filteredLeads.length,
    
    // Actions
    refresh,
    resetFilters,
    fetchLeads,
  };
};

export default useLeads;
