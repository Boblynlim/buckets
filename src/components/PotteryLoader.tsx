import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { theme } from '../theme';

interface PotteryLoaderProps {
  message?: string;
}

// Pottery wheel animation — clay being spun into a cup
// Web-only: uses CSS keyframes + SVG path animation
// Falls back to simple pulsing dot on native
export const PotteryLoader: React.FC<PotteryLoaderProps> = ({
  message = 'Shaping your buckets...',
}) => {
  if (Platform.OS !== 'web') {
    // Simple fallback for native
    return (
      <View style={styles.container}>
        <View style={styles.nativeDot} />
        <Text style={styles.text}>{message}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <div style={{ width: 100, height: 90, position: 'relative' }}>
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes formClay {
            0%   { d: path("M30 68 C30 68, 34 58, 50 56 C66 58, 70 68, 70 68 Z"); }
            25%  { d: path("M28 68 C28 58, 34 44, 50 42 C66 44, 72 58, 72 68 Z"); }
            50%  { d: path("M32 68 C32 50, 32 28, 50 26 C68 28, 68 50, 68 68 Z"); }
            75%  { d: path("M34 68 C34 48, 30 22, 50 20 C70 22, 66 48, 66 68 Z"); }
            100% { d: path("M30 68 C30 68, 34 58, 50 56 C66 58, 70 68, 70 68 Z"); }
          }
          @keyframes formRim {
            0%   { d: path("M30 56 Q50 54, 70 56"); stroke-width: 0; }
            25%  { d: path("M28 42 Q50 38, 72 42"); stroke-width: 1.5; }
            50%  { d: path("M32 26 Q50 20, 68 26"); stroke-width: 2.5; }
            75%  { d: path("M34 20 Q50 14, 66 20"); stroke-width: 3; }
            100% { d: path("M30 56 Q50 54, 70 56"); stroke-width: 0; }
          }
          @keyframes wheelSpin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}} />

        <svg viewBox="0 0 100 90" width="100" height="90">
          {/* Wheel surface */}
          <ellipse cx="50" cy="72" rx="34" ry="5" fill="#C4B09A" opacity="0.6" />
          {/* Spinning notches */}
          <g style={{ animation: 'wheelSpin 2s linear infinite', transformOrigin: '50px 72px' }}>
            <ellipse cx="50" cy="72" rx="30" ry="4" fill="none" stroke="#B0A090" strokeWidth="0.7" strokeDasharray="3 8" />
          </g>

          {/* Clay body — rich terracotta */}
          <path
            d="M30 68 C30 68, 34 58, 50 56 C66 58, 70 68, 70 68 Z"
            fill="#C07A4A"
            stroke="#A86538"
            strokeWidth="0.8"
            style={{ animation: 'formClay 3.5s ease-in-out infinite' }}
          />
          {/* Rim — darker terracotta */}
          <path
            d="M30 56 Q50 54, 70 56"
            fill="none"
            stroke="#8B5530"
            strokeLinecap="round"
            opacity="0.8"
            style={{ animation: 'formRim 3.5s ease-in-out infinite' }}
          />
        </svg>
      </div>
      <Text style={styles.text}>{message}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  text: {
    fontSize: 15,
    color: theme.colors.textSecondary,
    fontFamily: 'Merchant',
  },
  nativeDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.clay,
  },
});
