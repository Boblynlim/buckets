# Space Mono Font Setup

The app now uses Space Mono as its primary font, matching the garden app aesthetic.

## For Web (Already Configured)

The web version automatically loads Space Mono from Google Fonts. No additional setup needed!

## For iOS & Android (Native)

### 1. Download Space Mono Font Files

Download the Space Mono font family from Google Fonts:
https://fonts.google.com/specimen/Space+Mono

You need these 4 files:
- `SpaceMono-Regular.ttf`
- `SpaceMono-Bold.ttf`
- `SpaceMono-Italic.ttf`
- `SpaceMono-BoldItalic.ttf`

### 2. Add Fonts to Project

Place all 4 font files in:
```
assets/fonts/
```

### 3. Link Fonts (React Native CLI)

Run the following command to link the fonts:

```bash
cd Buckets
npx react-native-asset
```

Or if you're using an older version:

```bash
npx react-native link
```

### 4. Rebuild Your App

After linking fonts, you must rebuild:

**iOS:**
```bash
cd ios && pod install && cd ..
npx react-native run-ios
```

**Android:**
```bash
npx react-native run-android
```

## Verify Installation

Once installed, the font should appear throughout the app. If you see the system default font instead, the fonts haven't been properly linked.

## Theme Colors

The new theme uses this color palette:
- Primary: `#4747FF` (blue-violet)
- Background: `#F5F3F0` (light beige)
- Text: Various shades with Merchant font

All theme values are defined in `src/theme/index.ts`.
