import { format, parseISO, isValid } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';

// Indian Standard Time timezone
const IST_TIMEZONE = 'Asia/Kolkata';

/**
 * Convert a date to IST timezone
 * @param {string|Date} dateString 
 * @returns {Date}
 */
const toIST = (dateString) => {
  let date;
  if (typeof dateString === 'string') {
    // Handle ISO strings - parse as UTC
    date = parseISO(dateString);
  } else {
    date = dateString;
  }
  
  if (!isValid(date)) return null;
  
  // Convert to IST timezone
  return toZonedTime(date, IST_TIMEZONE);
};

/**
 * Format date to "22 Feb '26" style in IST
 * @param {string|Date} dateString 
 * @returns {string}
 */
export const formatDate = (dateString) => {
  if (!dateString) return '-';
  
  try {
    const istDate = toIST(dateString);
    if (!istDate) return '-';
    
    // Format: "22 Feb '26"
    return format(istDate, "d MMM ''yy");
  } catch {
    return '-';
  }
};

/**
 * Format date with time to "22 Feb '26, 2:30 PM" style in IST
 * @param {string|Date} dateString 
 * @returns {string}
 */
export const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  
  try {
    const istDate = toIST(dateString);
    if (!istDate) return '-';
    
    // Format: "22 Feb '26, 2:30 PM"
    return format(istDate, "d MMM ''yy, h:mm a");
  } catch {
    return '-';
  }
};

/**
 * Format time only "10:30 AM" in IST
 * @param {string|Date} dateString - Can be full ISO date string or just time "14:30"
 * @returns {string}
 */
export const formatTime = (dateString) => {
  if (!dateString) return '-';
  
  try {
    // Check if it's a full ISO date string
    if (dateString.includes('T') || dateString.includes('-')) {
      const istDate = toIST(dateString);
      if (!istDate) return '-';
      return format(istDate, 'h:mm a');
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
