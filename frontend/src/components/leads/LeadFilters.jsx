/**
 * Lead Filters Component
 * Search, status filter, employee filter, city filter
 * Matches the current LeadsPage filter design
 */
import React from 'react';
import { Search, X } from 'lucide-react';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

/**
 * LeadFilters Component
 * 
 * @param {Object} props
 * @param {string} props.search - Current search query
 * @param {function} props.setSearch - Search setter
 * @param {string} props.filterEmployee - Current employee filter
 * @param {function} props.setFilterEmployee - Employee filter setter
 * @param {string} props.filterStatus - Current status filter
 * @param {function} props.setFilterStatus - Status filter setter
 * @param {string} props.filterCity - Current city filter
 * @param {function} props.setFilterCity - City filter setter
 * @param {Array} props.employees - List of employees for dropdown
 * @param {Array} props.statuses - List of statuses for dropdown
 * @param {Array} props.cities - List of cities for dropdown
 * @param {function} props.onReset - Reset callback
 * @param {boolean} props.isSalesExec - Whether current user is Sales Executive
 * @param {string} props.userName - Current user's name (for Sales Exec display)
 */
export const LeadFilters = ({
  search = '',
  setSearch,
  filterEmployee = '',
  setFilterEmployee,
  filterStatus = '',
  setFilterStatus,
  filterCity = '',
  setFilterCity,
  employees = [],
  statuses = [],
  cities = [],
  onReset,
  isSalesExec = false,
  userName = 'My Leads',
}) => {
  const handleReset = () => {
    setSearch?.('');
    setFilterEmployee?.('');
    setFilterStatus?.('');
    setFilterCity?.('');
    onReset?.();
  };

  return (
    <div className="bg-white rounded-xl border p-4 mb-5">
      <div className="flex flex-wrap items-center gap-3">
        {/* Search Input */}
        <div className="flex-1 min-w-[250px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or mobile..."
            value={search}
            onChange={(e) => setSearch?.(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
            data-testid="search-input"
          />
        </div>

        {/* Employee filter - Sales roles only + employees with leads */}
        {isSalesExec ? (
          <div className="flex items-center px-3 h-10 bg-slate-100 rounded-md text-sm font-medium text-slate-700 border">
            {userName}
          </div>
        ) : (
          <Select 
            value={filterEmployee || 'all'} 
            onValueChange={(v) => setFilterEmployee?.(v === 'all' ? '' : v)}
          >
            <SelectTrigger className="w-[140px] h-10 bg-white text-sm" data-testid="filter-employee">
              <SelectValue placeholder="Employee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map((emp) => (
                <SelectItem key={emp.id} value={emp.name}>{emp.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {/* Status Filter */}
        <Select 
          value={filterStatus || 'all'} 
          onValueChange={(v) => setFilterStatus?.(v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-[140px] h-10 bg-white text-sm" data-testid="filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            <SelectItem value="all">All Status</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* City Filter */}
        <Select 
          value={filterCity || 'all'} 
          onValueChange={(v) => setFilterCity?.(v === 'all' ? '' : v)}
        >
          <SelectTrigger className="w-[120px] h-10 bg-white text-sm" data-testid="filter-city">
            <SelectValue placeholder="City" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Cities</SelectItem>
            {cities.map((c) => (
              <SelectItem key={c} value={c}>{c}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Reset Button */}
        <button 
          onClick={handleReset}
          className="px-3 py-2.5 border rounded-lg hover:bg-gray-50 font-medium text-sm flex items-center gap-1"
          data-testid="reset-filters-btn"
        >
          <X className="h-4 w-4" /> Reset
        </button>
      </div>
    </div>
  );
};

export default LeadFilters;
