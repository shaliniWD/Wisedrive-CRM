// WiseDrive ESS - Professional Light Theme
// Clean, Modern & Professional

export const colors = {
  // Core backgrounds - Light Theme
  background: '#FFFFFF',
  surface: '#F8FAFC',
  surfaceHighlight: '#F1F5F9',
  
  // Brand colors
  primary: '#2563EB',
  primaryLight: '#DBEAFE',
  primaryForeground: '#FFFFFF',
  secondary: '#64748B',
  accent: '#0EA5E9',
  
  // Semantic colors
  success: '#10B981',
  successBg: 'rgba(16, 185, 129, 0.1)',
  warning: '#F59E0B',
  warningBg: 'rgba(245, 158, 11, 0.1)',
  error: '#EF4444',
  errorBg: 'rgba(239, 68, 68, 0.1)',
  
  // Text hierarchy - Light Theme
  text: {
    primary: '#1E293B',
    secondary: '#64748B',
    tertiary: '#94A3B8',
    inverse: '#FFFFFF',
  },
  
  // Border
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  
  // Gradients
  gradients: {
    primary: ['#2563EB', '#1D4ED8'],
    surface: ['#F8FAFC', '#FFFFFF'],
    blueGlow: ['rgba(37, 99, 235, 0.1)', 'transparent'],
  },
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  xxxxl: 48,
};

export const fontSize = {
  xs: 11,
  sm: 13,
  md: 14,
  base: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  hero: 40,
};

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
};

export const iconSize = {
  xs: 14,
  sm: 16,
  md: 18,
  lg: 20,
  xl: 24,
  xxl: 28,
};

// Component-specific styles
export const componentStyles = {
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  button: {
    height: 52,
    borderRadius: radius.md,
  },
  input: {
    height: 52,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
};

// Shadows for elevated elements
export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
};
