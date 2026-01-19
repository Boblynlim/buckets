// Theme configuration inspired by One Year: Daily Journal aesthetic
// Minimalist palette with vibrant blue-violet and warm beige backgrounds
// Space Mono font with garden-inspired blue theme

export const theme = {
  colors: {
    // Primary blue-violet - main brand color (matching One Year app)
    primary: '#4747FF',
    primaryLight: '#6B6BFF',
    primaryDark: '#2E2EE8',

    // Background colors - light beige/cream tones (matching One Year)
    background: '#F5F3F0',
    backgroundLight: '#FDFCFB',
    cardBackground: '#FFFFFF',

    // Text colors - softer tones
    text: '#2D2D2D',
    textSecondary: '#8A8478',
    textTertiary: '#C4BCAE',
    textOnPrimary: '#FFFFFF',

    // Accent colors - muted palette with blue as primary
    success: '#87B48E',
    warning: '#E5A861',
    danger: '#DA0F0F',
    info: '#6B9BD1',

    // Blue/purple tints for various uses (matching One Year theme)
    purple50: '#F7F7FF',
    purple100: '#EDEDFF',
    purple200: '#DBDBFF',
    purple300: '#C9C9FF',
    purple400: '#9494FF',
    purple500: '#4747FF', // Primary blue-violet
    purple600: '#2E2EE8',
    purple700: '#1F1FD1',
    purple800: '#1515BA',
    purple900: '#0E0EA3',

    // Warm grays - softer, more beige-tinted
    gray50: '#FAFAF9',
    gray100: '#F5F4F2',
    gray200: '#EBEAE7',
    gray300: '#D9D7D3',
    gray400: '#ABA89F',
    gray500: '#7C7870',
    gray600: '#5D5B52',
    gray700: '#45433C',
    gray800: '#2D2C27',
    gray900: '#1A1916',

    // Semantic colors - softer tones with blue shadows
    border: '#EBEAE7',
    separator: '#D9D7D3',
    overlay: 'rgba(45, 45, 45, 0.3)',
    shadow: 'rgba(71, 71, 255, 0.15)',
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
      shadowColor: '#4747FF',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 1,
    },
    md: {
      shadowColor: '#4747FF',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 6,
      elevation: 2,
    },
    lg: {
      shadowColor: '#4747FF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
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
