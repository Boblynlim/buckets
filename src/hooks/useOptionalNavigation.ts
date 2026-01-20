// Hook to safely use React Navigation on both native and web
// On web (where navigation context doesn't exist), returns null
// On native, returns the navigation object

export function useOptionalNavigation() {
  try {
    // Only import navigation if it's available
    const { useNavigation } = require('@react-navigation/native');
    return useNavigation();
  } catch (error) {
    // Not in a navigation context (web)
    return null;
  }
}

export function useOptionalRoute() {
  try {
    const { useRoute } = require('@react-navigation/native');
    return useRoute();
  } catch (error) {
    // Not in a navigation context (web)
    return null;
  }
}
