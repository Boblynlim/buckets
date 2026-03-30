/**
 * Buckets - Personal Budgeting App
 * @format
 */

import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {ConvexProvider} from 'convex/react';
import {convexClient} from './src/lib/convex';
import {RootNavigator} from './src/navigation/RootNavigator';

function App() {
  return (
    <ConvexProvider client={convexClient}>
      <SafeAreaProvider>
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </ConvexProvider>
  );
}

export default App;
