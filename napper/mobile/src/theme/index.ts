/**
 * Napper design tokens — minimal, calm, warm palette inspired by sleep apps.
 */

export const colors = {
  // Background
  background: '#F7F5F2',
  surface: '#FFFFFF',
  surfaceAlt: '#F0EDE8',

  // Accent
  sleep: '#6B8CAE',       // soft blue — sleep
  sleepLight: '#B8CCE0',
  feeding: '#C4956A',     // warm amber — feeding
  feedingLight: '#EDD9C2',
  prediction: '#7C9E8F',  // sage green — predictions
  predictionLight: '#C2D9D2',

  // Text
  textPrimary: '#1A1A2E',
  textSecondary: '#5E5E7A',
  textMuted: '#9B9BB0',
  textOnDark: '#FFFFFF',

  // Status
  success: '#4CAF79',
  warning: '#F0A500',
  error: '#E05252',

  // UI
  border: '#E8E5E0',
  divider: '#F0EDE8',
  shadow: 'rgba(0, 0, 0, 0.06)',
  overlay: 'rgba(0, 0, 0, 0.4)',

  // Active timer
  timerActive: '#4CAF79',
  timerActiveBg: '#E8F5EE',
};

export const typography = {
  fontSizeXS: 11,
  fontSizeSM: 13,
  fontSizeMD: 15,
  fontSizeLG: 17,
  fontSizeXL: 22,
  fontSizeXXL: 28,
  fontSizeDisplay: 36,

  fontWeightRegular: '400' as const,
  fontWeightMedium: '500' as const,
  fontWeightSemiBold: '600' as const,
  fontWeightBold: '700' as const,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 6,
  },
};
