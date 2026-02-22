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
