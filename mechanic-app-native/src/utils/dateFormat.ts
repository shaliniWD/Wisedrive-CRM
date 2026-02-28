/**
 * Date formatting utilities for Indian locale (dd/MM/yyyy)
 * Consistent date display across the mechanic app
 */

/**
 * Format date to "dd/MM/yyyy" (e.g., "22/12/2024")
 */
export const formatDateIndian = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  
  return `${day}/${month}/${year}`;
};

/**
 * Format date to "dd MMM" (e.g., "22 Dec")
 */
export const formatDateShort = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d.getDate();
  const month = months[d.getMonth()];
  
  return `${day} ${month}`;
};

/**
 * Format date to "dd MMM yyyy" (e.g., "22 Dec 2024")
 */
export const formatDateMedium = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const day = d.getDate();
  const month = months[d.getMonth()];
  const year = d.getFullYear();
  
  return `${day} ${month} ${year}`;
};

/**
 * Format time to "hh:mm AM/PM" (e.g., "02:30 PM")
 */
export const formatTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  
  let hours = d.getHours();
  const minutes = d.getMinutes().toString().padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  
  return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
};

/**
 * Format date and time to "dd/MM/yyyy, hh:mm AM/PM"
 */
export const formatDateTime = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  
  return `${formatDateIndian(d)}, ${formatTime(d)}`;
};

/**
 * Format to "EEE, dd MMM" (e.g., "Sun, 22 Dec")
 */
export const formatDateWithDay = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '-';
  
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  const dayName = days[d.getDay()];
  const dayNum = d.getDate();
  const month = months[d.getMonth()];
  
  return `${dayName}, ${dayNum} ${month}`;
};

/**
 * Format for API calls (YYYY-MM-DD)
 */
export const formatDateForApi = (date: Date): string => {
  return date.toISOString().split('T')[0];
};
