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

// ---------------------------------------------------------------------------
// type — the app's REAL typographic scale, built on the Merchant fonts that the
// screens actually use ('Merchant' for display/labels, 'Merchant Copy' for body
// & numbers). Use these presets instead of hardcoding fontSize so the hierarchy
// stays consistent. Stronger steps than before: titles read bigger, body has
// one baseline, the old 12px labels/buttons are gone. Spread a preset, then
// override color/margin per use:
//   <Text style={[type.rowTitle, { color: theme.colors.text }]}>…</Text>
// ---------------------------------------------------------------------------
const DISPLAY = 'Merchant';
const COPY = 'Merchant Copy';

export const type = {
  // Big page/screen titles (Buckets, Settings, Review queue, Letters…)
  screenTitle: { fontFamily: DISPLAY, fontSize: 32, lineHeight: 38, letterSpacing: -0.5 },
  // Section / card / form headings ("Transactions", "Add Expense")
  sectionTitle: { fontFamily: DISPLAY, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  // List-row titles, setting names, bucket names
  rowTitle: { fontFamily: DISPLAY, fontSize: 18, lineHeight: 24 },
  // Baseline body copy
  body: { fontFamily: COPY, fontSize: 16, lineHeight: 22 },
  // Field labels above inputs / pickers
  label: { fontFamily: DISPLAY, fontSize: 14, lineHeight: 18, letterSpacing: 0.3 },
  // Button text (was an unreadable 12px in places)
  button: { fontFamily: DISPLAY, fontSize: 15, lineHeight: 20, letterSpacing: 0.4 },
  // Secondary / supporting copy, hints, dates
  caption: { fontFamily: COPY, fontSize: 13, lineHeight: 18 },
  // Tiny ALL-CAPS eyebrows (the "SECTION HEADER" rows) — deliberately small,
  // but now one consistent size everywhere.
  eyebrow: { fontFamily: DISPLAY, fontSize: 12, lineHeight: 16, letterSpacing: 1, textTransform: 'uppercase' as const },
  // Hero numeric amounts (the big $ in the amount inputs)
  amountHero: { fontFamily: COPY, fontSize: 44, lineHeight: 50, letterSpacing: -1.5 },
};

export type TypePreset = keyof typeof type;
