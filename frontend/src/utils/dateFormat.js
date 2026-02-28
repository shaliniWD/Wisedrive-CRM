import { format, parseISO, isValid } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// Country code to timezone mapping
const COUNTRY_TIMEZONES = {
  'IN': 'Asia/Kolkata',      // India - IST (UTC+5:30)
  'MY': 'Asia/Kuala_Lumpur', // Malaysia - MYT (UTC+8)
  'TH': 'Asia/Bangkok',      // Thailand - ICT (UTC+7)
  'PH': 'Asia/Manila',       // Philippines - PHT (UTC+8)
  // Default fallback
  'default': 'Asia/Kolkata'
};

// Get timezone from localStorage (set during login)
const getUserTimezone = () => {
  try {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      const user = JSON.parse(userStr);
      const countryCode = user.country_code || 'IN';
      return COUNTRY_TIMEZONES[countryCode] || COUNTRY_TIMEZONES['default'];
    }
  } catch (e) {
    console.error('Error getting user timezone:', e);
  }
  return COUNTRY_TIMEZONES['default'];
};

/**
 * Convert a date to user's timezone
 * @param {string|Date} dateString 
 * @returns {Date}
 */
const toUserTimezone = (dateString) => {
  let date;
  if (typeof dateString === 'string') {
    // Handle ISO strings - parse as UTC
    date = parseISO(dateString);
  } else {
    date = dateString;
  }
  
  if (!isValid(date)) return null;
  
  // Convert to user's timezone
  const timezone = getUserTimezone();
  return toZonedTime(date, timezone);
};

/**
 * Format date to "22 Feb '26" style in user's timezone
 * @param {string|Date} dateString 
 * @returns {string}
 */
export const formatDate = (dateString) => {
  if (!dateString) return '-';
  
  try {
    const zonedDate = toUserTimezone(dateString);
    if (!zonedDate) return '-';
    
    // Format: "22 Feb '26"
    return format(zonedDate, "d MMM ''yy");
  } catch {
    return '-';
  }
};

/**
 * Format date with time to "22 Feb '26, 2:30 PM" style in user's timezone
 * @param {string|Date} dateString 
 * @returns {string}
 */
export const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  
  try {
    const zonedDate = toUserTimezone(dateString);
    if (!zonedDate) return '-';
    
    // Format: "22 Feb '26, 2:30 PM"
    return format(zonedDate, "d MMM ''yy, h:mm a");
  } catch {
    return '-';
  }
};

/**
 * Format time only "10:30 AM" in user's timezone
 * @param {string|Date} dateString - Can be full ISO date string or just time "14:30"
 * @returns {string}
 */
export const formatTime = (dateString) => {
  if (!dateString) return '-';
  
  try {
    // Check if it's a full ISO date string
    if (dateString.includes('T') || dateString.includes('-')) {
      const zonedDate = toUserTimezone(dateString);
      if (!zonedDate) return '-';
      return format(zonedDate, 'h:mm a');
    }
    
    // If it's just a time string like "14:30" or "14:30:00"
    const [hours, minutes] = dateString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10));
    return format(date, 'h:mm a');
  } catch {
    return dateString;
  }
};

/**
 * Get the current user's timezone name for display
 * @returns {string}
 */
export const getUserTimezoneName = () => {
  const timezone = getUserTimezone();
  const timezoneNames = {
    'Asia/Kolkata': 'IST',
    'Asia/Kuala_Lumpur': 'MYT',
    'Asia/Bangkok': 'ICT',
    'Asia/Manila': 'PHT'
  };
  return timezoneNames[timezone] || timezone;
};

/**
 * Get today's date in user's timezone as YYYY-MM-DD string
 * This is critical for accurate date filtering
 * @returns {string} - Date in YYYY-MM-DD format
 */
export const getToday = () => {
  const timezone = getUserTimezone();
  const now = new Date();
  
  // Convert current time to user's timezone and get date
  const zonedNow = toZonedTime(now, timezone);
  return format(zonedNow, 'yyyy-MM-dd');
};

/**
 * Get start of week in user's timezone as YYYY-MM-DD string
 * @returns {string}
 */
export const getStartOfWeek = () => {
  const timezone = getUserTimezone();
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);
  
  // Get day of week (0 = Sunday)
  const dayOfWeek = zonedNow.getDay();
  const startOfWeek = new Date(zonedNow);
  startOfWeek.setDate(zonedNow.getDate() - dayOfWeek);
  
  return format(startOfWeek, 'yyyy-MM-dd');
};

/**
 * Get end of week in user's timezone as YYYY-MM-DD string
 * @returns {string}
 */
export const getEndOfWeek = () => {
  const timezone = getUserTimezone();
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);
  
  const dayOfWeek = zonedNow.getDay();
  const endOfWeek = new Date(zonedNow);
  endOfWeek.setDate(zonedNow.getDate() + (6 - dayOfWeek));
  
  return format(endOfWeek, 'yyyy-MM-dd');
};

/**
 * Get start of month in user's timezone as YYYY-MM-DD string
 * @returns {string}
 */
export const getStartOfMonth = () => {
  const timezone = getUserTimezone();
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);
  
  const startOfMonth = new Date(zonedNow.getFullYear(), zonedNow.getMonth(), 1);
  return format(startOfMonth, 'yyyy-MM-dd');
};

/**
 * Get end of month in user's timezone as YYYY-MM-DD string
 * @returns {string}
 */
export const getEndOfMonth = () => {
  const timezone = getUserTimezone();
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);
  
  const endOfMonth = new Date(zonedNow.getFullYear(), zonedNow.getMonth() + 1, 0);
  return format(endOfMonth, 'yyyy-MM-dd');
};

/**
 * Get start of year in user's timezone as YYYY-MM-DD string
 * @returns {string}
 */
export const getStartOfYear = () => {
  const timezone = getUserTimezone();
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);
  
  return format(new Date(zonedNow.getFullYear(), 0, 1), 'yyyy-MM-dd');
};

/**
 * Get end of year in user's timezone as YYYY-MM-DD string
 * @returns {string}
 */
export const getEndOfYear = () => {
  const timezone = getUserTimezone();
  const now = new Date();
  const zonedNow = toZonedTime(now, timezone);
  
  return format(new Date(zonedNow.getFullYear(), 11, 31), 'yyyy-MM-dd');
};

/**
 * Format date for display in date input (dd/mm/yyyy for India)
 * @param {string} isoDate - Date in YYYY-MM-DD format
 * @returns {string} - Date in localized format
 */
export const formatDateForDisplay = (isoDate) => {
  if (!isoDate) return '';
  
  try {
    const date = parseISO(isoDate);
    if (!isValid(date)) return '';
    
    // For India, use dd/mm/yyyy
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : {};
    const countryCode = user.country_code || 'IN';
    
    if (countryCode === 'IN') {
      return format(date, 'dd/MM/yyyy');
    }
    return format(date, 'MM/dd/yyyy');
  } catch {
    return isoDate;
  }
};

/**
 * Format date for input field (HTML date inputs require YYYY-MM-DD)
 * @param {string} isoDate - Date in YYYY-MM-DD format
 * @returns {string} - Date in YYYY-MM-DD format for HTML input
 */
export const formatDateForInput = (isoDate) => {
  // HTML date inputs always use YYYY-MM-DD
  return isoDate;
};

/**
 * Parse date from display format to YYYY-MM-DD
 * @param {string} displayDate - Date in localized format (dd/mm/yyyy for India)
 * @returns {string} - Date in YYYY-MM-DD format
 */
export const parseDateFromInput = (inputDate) => {
  // HTML date inputs always give YYYY-MM-DD
  return inputDate;
};
