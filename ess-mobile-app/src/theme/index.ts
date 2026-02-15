// Theme and Design System for WiseDrive ESS
export const colors = {
  primary: {
    default: '#2E3192',
    hover: '#1E2060',
    light: '#E8E8F5',
    foreground: '#FFFFFF',
  },
  secondary: {
    default: '#6366F1',
    light: '#EEF2FF',
    foreground: '#FFFFFF',
  },
  accent: {
    default: '#FFD700',
    light: '#FFFBEB',
    foreground: '#1A1A1A',
  },
  background: {
    app: '#F8FAFC',
    card: '#FFFFFF',
    subtle: '#F1F5F9',
  },
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    muted: '#94A3B8',
    inverse: '#FFFFFF',
  },
  status: {
    success: '#10B981',
    successLight: '#D1FAE5',
    warning: '#F59E0B',
    warningLight: '#FEF3C7',
    error: '#EF4444',
    errorLight: '#FEE2E2',
    info: '#3B82F6',
    infoLight: '#DBEAFE',
  },
  border: {
    default: '#E2E8F0',
    light: '#F1F5F9',
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
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
};

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

export const typography = {
  h1: {
    fontSize: 28,
    fontWeight: '700' as const,
    color: colors.text.primary,
    letterSpacing: -0.5,
  },
  h2: {
    fontSize: 22,
    fontWeight: '600' as const,
    color: colors.text.primary,
    letterSpacing: -0.3,
  },
  h3: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: colors.text.primary,
  },
  bodyLarge: {
    fontSize: 16,
    fontWeight: '500' as const,
    color: colors.text.secondary,
  },
  body: {
    fontSize: 14,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    color: colors.text.muted,
    fontWeight: '500' as const,
    textTransform: 'uppercase' as const,
    letterSpacing: 0.5,
  },
  small: {
    fontSize: 12,
    color: colors.text.muted,
  },
};
