// Theme configuration - Earthy pottery aesthetic
// Warm neutrals, sage greens, and natural tones

export const theme = {
  colors: {
    // Oct 2026 replan: flat warm wall, ink, one quiet green. See
    // src/screens/home/homeStyles.ts for the design rules.
    primary: '#1F1B17',
    primaryLight: '#3A332C',
    primaryDark: '#000000',

    background: '#F3F0EA',
    backgroundLight: '#F3F0EA',
    cardBackground: '#FFFFFF',

    text: '#1F1B17',
    textSecondary: '#75695F',
    textTertiary: '#A89E92',
    textOnPrimary: '#F3F0EA',

    sage: '#75695F',
    sageMuted: '#D9D2C6',
    honeyed: '#B8986A',
    sunsetDust: '#D9D2C6',
    earth: '#5C361E',
    clay: '#7B4C2D',
    linen: '#F3F0EA',

    success: '#4E7D6D',
    warning: '#B8986A',
    danger: '#A0563F',
    info: '#75695F',

    gray50: '#FFFFFF',
    gray100: '#F3F0EA',
    gray200: '#E4DFD6',
    gray300: '#D9D2C6',
    gray400: '#A89E92',
    gray500: '#75695F',
    gray600: '#5E5448',
    gray700: '#4A4038',
    gray800: '#1F1B17',
    gray900: '#1F1B17',

    purple100: '#F3F0EA',

    border: '#E4DFD6',
    separator: '#E4DFD6',
    overlay: 'rgba(31, 27, 23, 0.2)',
    shadow: 'rgba(31, 27, 23, 0.08)',
  },

  fonts: {
    // Web-only app: one family everywhere; weight carries hierarchy.
    regular: "'Schibsted Grotesk', system-ui, sans-serif",
    bold: "'Schibsted Grotesk', system-ui, sans-serif",
    italic: "'Schibsted Grotesk', system-ui, sans-serif",
    boldItalic: "'Schibsted Grotesk', system-ui, sans-serif",
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
      shadowColor: '#1F1B17',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.06,
      shadowRadius: 3,
      elevation: 1,
    },
    md: {
      shadowColor: '#1F1B17',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 6,
      elevation: 2,
    },
    lg: {
      shadowColor: '#1F1B17',
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
