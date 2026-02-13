import { format, parseISO, isValid } from 'date-fns';

/**
 * Format date to "3 Jan '26" style
 * @param {string|Date} dateString 
 * @returns {string}
 */
export const formatDate = (dateString) => {
  if (!dateString) return '-';
  
  try {
    let date;
    if (typeof dateString === 'string') {
      // Handle ISO strings
      date = parseISO(dateString.replace('Z', '+00:00'));
    } else {
      date = dateString;
    }
    
    if (!isValid(date)) return '-';
    
    // Format: "3 Jan '26"
    return format(date, "d MMM ''yy");
  } catch {
    return '-';
  }
};

/**
 * Format date with time to "3 Jan '26, 2:30 PM" style
 * @param {string|Date} dateString 
 * @returns {string}
 */
export const formatDateTime = (dateString) => {
  if (!dateString) return '-';
  
  try {
    let date;
    if (typeof dateString === 'string') {
      date = parseISO(dateString.replace('Z', '+00:00'));
    } else {
      date = dateString;
    }
    
    if (!isValid(date)) return '-';
    
    // Format: "3 Jan '26, 2:30 PM"
    return format(date, "d MMM ''yy, h:mm a");
  } catch {
    return '-';
  }
};

/**
 * Format time only "2:30 PM"
 * @param {string} timeString 
 * @returns {string}
 */
export const formatTime = (timeString) => {
  if (!timeString) return '-';
  
  try {
    // If it's just a time string like "14:30" or "14:30:00"
    const [hours, minutes] = timeString.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10));
    return format(date, 'h:mm a');
  } catch {
    return timeString;
  }
};
