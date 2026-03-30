// Theme configuration - Earthy pottery aesthetic
// Warm neutrals, sage greens, and natural tones

export const theme = {
  colors: {
    // Primary — celadon glaze
    primary: '#5C8A7A',
    primaryLight: '#7DA99A',
    primaryDark: '#3D6B5C',

    // Background — warm ivory clay body
    background: '#EAE3D5',
    backgroundLight: '#F2EDE3',
    cardBackground: '#F5F0E7',

    // Text — chocolate brown decoration
    text: '#3D3229',
    textSecondary: '#7A6E62',
    textTertiary: '#A89E92',
    textOnPrimary: '#F2EDE3',

    // Earthy accent palette
    sage: '#8A8570',        // Warm sage from rim
    sageMuted: '#C2BDB0',   // Light sage
    honeyed: '#B8986A',     // Warm amber
    sunsetDust: '#C8B8A2',  // Warm beige
    earth: '#5C4438',       // Chocolate brown decoration
    clay: '#A0785C',        // Raw terracotta foot
    linen: '#E8E0D0',       // Warm ivory

    // Semantic colors
    success: '#7A9A6D',
    warning: '#B8986A',
    danger: '#B85C4A',
    info: '#8A8570',

    // Warm neutrals
    gray50: '#F5F0E7',
    gray100: '#EAE3D5',
    gray200: '#E0D8C8',
    gray300: '#D0C8B8',
    gray400: '#A89E92',
    gray500: '#7A6E62',
    gray600: '#5E5448',
    gray700: '#4A4038',
    gray800: '#3D3229',
    gray900: '#2A231C',

    // UI tones
    purple100: '#E8E0D0',

    // Semantic UI
    border: '#DDD6C8',
    separator: '#D0C8B8',
    overlay: 'rgba(61, 50, 41, 0.3)',
    shadow: 'rgba(92, 68, 56, 0.12)',
  },

  fonts: {
    regular: 'SpaceMono-Regular',
    bold: 'SpaceMono-Bold',
    italic: 'SpaceMono-Italic',
    boldItalic: 'SpaceMono-BoldItalic',
  },

  fontSizes: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
    '6xl': 60,
  },

  spacing: {
    xs: 6,
    sm: 12,
    md: 20,
    lg: 28,
    xl: 36,
    '2xl': 52,
    '3xl': 72,
  },

  borderRadius: {
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    full: 9999,
  },

  shadows: {
    sm: {
      shadowColor: '#5C8A7A',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 1,
    },
    md: {
      shadowColor: '#5C8A7A',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 2,
    },
    lg: {
      shadowColor: '#5C8A7A',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 12,
      elevation: 4,
    },
  },
};

export type Theme = typeof theme;

// Type-safe color access
export type ThemeColor = keyof typeof theme.colors;
export type ThemeFont = keyof typeof theme.fonts;
export type ThemeFontSize = keyof typeof theme.fontSizes;
export type ThemeSpacing = keyof typeof theme.spacing;
