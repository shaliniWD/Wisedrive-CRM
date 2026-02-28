/**
 * Date formatting utilities for Indian locale (dd/MM/yyyy)
 * Uses date-fns for consistent formatting across the app
 */
import { format, parseISO, isValid } from 'date-fns';

/**
 * Format date to "dd/MM/yyyy" (e.g., "22/12/2024")
 */
export const formatDateIndian = (date: Date | string): string => {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(d)) return '-';
    return format(d, 'dd/MM/yyyy');
  } catch {
    return '-';
  }
};

/**
 * Format date to "dd MMM" (e.g., "22 Dec")
 */
export const formatDateShort = (date: Date | string): string => {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(d)) return '-';
    return format(d, 'd MMM');
  } catch {
    return '-';
  }
};

/**
 * Format date to "dd MMM yyyy" (e.g., "22 Dec 2024")
 */
export const formatDateMedium = (date: Date | string): string => {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(d)) return '-';
    return format(d, 'd MMM yyyy');
  } catch {
    return '-';
  }
};

/**
 * Format date to "dd MMMM yyyy" (e.g., "22 December 2024")
 */
export const formatDateLong = (date: Date | string): string => {
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (!isValid(d)) return '-';
    return format(d, 'd MMMM yyyy');
  } catch {
    return '-';
  }
};

/**
 * Format date range "dd MMM - dd MMM yyyy" (e.g., "22 Dec - 25 Dec 2024")
 */
export const formatDateRange = (startDate: Date | string, endDate: Date | string): string => {
  try {
    const start = typeof startDate === 'string' ? parseISO(startDate) : startDate;
    const end = typeof endDate === 'string' ? parseISO(endDate) : endDate;
    if (!isValid(start) || !isValid(end)) return '-';
    return `${format(start, 'd MMM')} - ${format(end, 'd MMM yyyy')}`;
  } catch {
    return '-';
  }
};
