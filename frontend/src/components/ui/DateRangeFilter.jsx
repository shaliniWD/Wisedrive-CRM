/**
 * Unified Date Range Filter Component
 * Based on CustomersPage design - pill buttons with custom date option
 */
import React from 'react';
import { Calendar } from 'lucide-react';
import { Input } from '@/components/ui/input';

// Date range preset options
export const DATE_PRESETS = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'last_7_days', label: 'Last 7 Days' },
  { key: 'last_14_days', label: 'Last 14 Days' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'year', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
];

// Shorter presets for compact mode
export const DATE_PRESETS_SHORT = [
  { key: 'today', label: 'Today' },
  { key: 'last_7_days', label: 'Last 7 Days' },
  { key: 'last_14_days', label: 'Last 14 Days' },
  { key: 'week', label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom' },
];

// Get date range based on preset
export const getDateRange = (preset) => {
  const today = new Date();
  let from, to;
  
  switch(preset) {
    case 'today':
      from = to = today.toISOString().split('T')[0];
      break;
    case 'yesterday':
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      from = to = yesterday.toISOString().split('T')[0];
      break;
    case 'week':
    case 'this_week':
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay());
      from = weekStart.toISOString().split('T')[0];
      to = today.toISOString().split('T')[0];
      break;
    case 'last_week':
      const lastWeekEnd = new Date(today);
      lastWeekEnd.setDate(today.getDate() - today.getDay() - 1);
      const lastWeekStart = new Date(lastWeekEnd);
      lastWeekStart.setDate(lastWeekEnd.getDate() - 6);
      from = lastWeekStart.toISOString().split('T')[0];
      to = lastWeekEnd.toISOString().split('T')[0];
      break;
    case 'month':
    case 'this_month':
      from = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
      to = today.toISOString().split('T')[0];
      break;
    case 'last_month':
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      from = lastMonthStart.toISOString().split('T')[0];
      to = lastMonthEnd.toISOString().split('T')[0];
      break;
    case 'year':
    case 'this_year':
      from = new Date(today.getFullYear(), 0, 1).toISOString().split('T')[0];
      to = today.toISOString().split('T')[0];
      break;
    default:
      from = to = '';
  }
  
  return { from, to };
};

export const DateRangeFilter = ({
  dateRangeType,
  setDateRangeType,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  onReset,
  presets = DATE_PRESETS_SHORT,
  showAllTime = true,
  className = '',
}) => {
  const handlePresetChange = (preset) => {
    setDateRangeType(preset);
    if (preset === 'custom') {
      // Keep current dates for custom
      return;
    }
    if (preset === '' || preset === 'all') {
      setDateFrom('');
      setDateTo('');
      return;
    }
    const { from, to } = getDateRange(preset);
    setDateFrom(from);
    setDateTo(to);
  };

  return (
    <div className={`bg-white rounded-xl border p-4 ${className}`}>
      <div className="flex flex-wrap items-center gap-3">
        <Calendar className="h-4 w-4 text-gray-400" />
        <span className="text-sm font-medium text-gray-600">Date Range:</span>
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((preset) => (
            <button
              key={preset.key}
              onClick={() => handlePresetChange(preset.key)}
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
          {showAllTime && (
            <button
              onClick={() => handlePresetChange('')}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                dateRangeType === '' || dateRangeType === 'all'
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
              data-testid="date-preset-all"
            >
              All Time
            </button>
          )}
        </div>
        {dateRangeType === 'custom' && (
          <div className="flex items-center gap-2 ml-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9 w-36"
              data-testid="date-from-input"
            />
            <span className="text-gray-400">to</span>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9 w-36"
              data-testid="date-to-input"
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default DateRangeFilter;
