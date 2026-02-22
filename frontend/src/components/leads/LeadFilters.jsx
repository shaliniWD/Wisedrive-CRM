/**
 * Lead Filters Component
 * Search, status filter, employee filter, city filter, date range
 */
import React from 'react';
import { Search, Filter, X, CalendarDays } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

// Quick date filter options
const DATE_FILTERS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'thisWeek', label: 'This Week' },
  { value: 'lastWeek', label: 'Last Week' },
  { value: 'thisMonth', label: 'This Month' },
  { value: 'lastMonth', label: 'Last Month' },
  { value: 'all', label: 'All Time' },
];

export const LeadFilters = ({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  employeeFilter,
  setEmployeeFilter,
  cityFilter,
  setCityFilter,
  dateFilter,
  setDateFilter,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  statuses = [],
  employees = [],
  cities = [],
  onReset,
}) => {
  const hasActiveFilters = statusFilter !== 'all' || 
    employeeFilter !== 'all' || 
    cityFilter !== 'all' || 
    dateFilter !== 'all' ||
    startDate || 
    endDate ||
    searchQuery;

  const handleReset = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setEmployeeFilter('all');
    setCityFilter('all');
    setDateFilter('all');
    setStartDate('');
    setEndDate('');
    onReset?.();
  };

  return (
    <div className="space-y-4 mb-6">
      {/* Search and Quick Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, phone, city..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-10"
            data-testid="lead-search-input"
          />
        </div>

        {/* Quick Date Filters */}
        <div className="flex items-center gap-1 flex-wrap">
          {DATE_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              variant={dateFilter === filter.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setDateFilter(filter.value)}
              className={`h-8 text-xs ${dateFilter === filter.value ? 'bg-blue-600' : ''}`}
              data-testid={`date-filter-${filter.value}`}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Advanced Filters Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status Filter */}
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px] h-10" data-testid="status-filter">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {statuses.map((status) => (
              <SelectItem key={status.name} value={status.name}>
                {status.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Employee Filter */}
        <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
          <SelectTrigger className="w-[180px] h-10" data-testid="employee-filter">
            <SelectValue placeholder="All Employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Employees</SelectItem>
            {employees.map((emp) => (
              <SelectItem key={emp.id} value={emp.id}>
                {emp.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* City Filter */}
        <Select value={cityFilter} onValueChange={setCityFilter}>
          <SelectTrigger className="w-[150px] h-10" data-testid="city-filter">
            <SelectValue placeholder="All Cities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities.map((city) => (
              <SelectItem key={city} value={city}>
                {city}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <CalendarDays className="h-4 w-4 text-gray-400" />
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="h-10 w-[140px]"
            placeholder="Start Date"
            data-testid="start-date-input"
          />
          <span className="text-gray-400">to</span>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="h-10 w-[140px]"
            placeholder="End Date"
            data-testid="end-date-input"
          />
        </div>

        {/* Reset Button */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-10 text-gray-500 hover:text-gray-700"
            data-testid="reset-filters-btn"
          >
            <X className="h-4 w-4 mr-1" />
            Reset
          </Button>
        )}
      </div>
    </div>
  );
};

export default LeadFilters;
