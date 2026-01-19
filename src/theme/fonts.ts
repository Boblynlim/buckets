import { Platform } from 'react-native';

// Font family helper for cross-platform consistency
export const getFontFamily = (weight: 'regular' | 'bold' = 'regular', italic: boolean = false) => {
  if (Platform.OS === 'web') {
    // Web uses Google Fonts Space Mono
    return 'Space Mono, monospace';
  }

  // Native platforms use linked fonts
  if (weight === 'bold' && italic) {
    return 'SpaceMono-BoldItalic';
  } else if (weight === 'bold') {
    return 'SpaceMono-Bold';
  } else if (italic) {
    return 'SpaceMono-Italic';
  }
  return 'SpaceMono-Regular';
};

// Text style presets with Space Mono
export const textStyles = {
  h1: {
    fontFamily: getFontFamily('bold'),
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: -1.2,
  },
  h2: {
    fontFamily: getFontFamily('bold'),
    fontSize: 36,
    lineHeight: 44,
    letterSpacing: -0.8,
  },
  h3: {
    fontFamily: getFontFamily('bold'),
    fontSize: 30,
    lineHeight: 38,
    letterSpacing: -0.6,
  },
  h4: {
    fontFamily: getFontFamily('bold'),
    fontSize: 24,
    lineHeight: 32,
    letterSpacing: -0.4,
  },
  h5: {
    fontFamily: getFontFamily('bold'),
    fontSize: 20,
    lineHeight: 28,
    letterSpacing: -0.2,
  },
  h6: {
    fontFamily: getFontFamily('bold'),
    fontSize: 18,
    lineHeight: 26,
  },
  body: {
    fontFamily: getFontFamily('regular'),
    fontSize: 16,
    lineHeight: 24,
  },
  bodyBold: {
    fontFamily: getFontFamily('bold'),
    fontSize: 16,
    lineHeight: 24,
  },
  small: {
    fontFamily: getFontFamily('regular'),
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontFamily: getFontFamily('bold'),
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontFamily: getFontFamily('regular'),
    fontSize: 12,
    lineHeight: 16,
  },
  captionBold: {
    fontFamily: getFontFamily('bold'),
    fontSize: 12,
    lineHeight: 16,
  },
};
