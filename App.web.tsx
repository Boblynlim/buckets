/**
 * Buckets - Web Version
 */

import React, { useState, useEffect } from 'react';
import { register as registerServiceWorker } from './src/serviceWorkerRegistration';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { ConvexProvider } from 'convex/react';
import {
  PaintBucket,
  MessageCircle,
  Settings as SettingsIcon,
  PackagePlus,
  Plus,
} from 'lucide-react';
import { convexClient } from './src/lib/convex';
import { BucketsOverview } from './src/screens/BucketsOverview.web';
import { AddBucket } from './src/screens/AddBucket';
import { AddExpense } from './src/screens/AddExpense';
import { ChatScreen } from './src/screens/ChatScreen';
import { Settings } from './src/screens/Settings';
import { Reports } from './src/screens/Reports';
import { IncomeManagement } from './src/screens/IncomeManagement';
import { EditBucket } from './src/screens/EditBucket';
import { EditExpense } from './src/screens/EditExpense';
import { Drawer } from './src/components/Drawer';
import { theme } from './src/theme';
import type { Bucket, Expense } from './src/types';

type Screen = 'buckets' | 'settings' | 'reports';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('buckets');
  const [showAddBucket, setShowAddBucket] = useState(false);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showIncomeManagement, setShowIncomeManagement] = useState(false);
  const [showEditBucket, setShowEditBucket] = useState(false);
  const [selectedBucket, setSelectedBucket] = useState<Bucket | null>(null);
  const [showEditExpense, setShowEditExpense] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState<{expense: Expense; bucket: Bucket} | null>(null);
  const [isReportSelected, setIsReportSelected] = useState(false);
  const [showShrimpyDrawer, setShowShrimpyDrawer] = useState(false);

  // Register service worker for PWA functionality
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') {
      registerServiceWorker();
    }
  }, []);

  const handleSaveBucket = (bucketData: any) => {
    console.log('New bucket:', bucketData);
    // Bucket is now saved to Convex automatically in AddBucket component
    setShowAddBucket(false);
  };

  const handleEditBucket = (bucket: Bucket) => {
    setSelectedBucket(bucket);
    setShowEditBucket(true);
  };

  const handleEditExpense = (expense: Expense, bucket: Bucket) => {
    setSelectedExpense({ expense, bucket });
    setShowEditExpense(true);
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'buckets':
        return (
          <BucketsOverview
            onEditBucket={handleEditBucket}
            onEditExpense={handleEditExpense}
          />
        );
      case 'settings':
        return (
          <Settings
            onAddBucket={() => setShowAddBucket(true)}
            onEditBucket={handleEditBucket}
            onSetIncome={() => setShowIncomeManagement(true)}
            onNavigateToReports={() => setCurrentScreen('reports')}
          />
        );
      case 'reports':
        return <Reports onReportSelected={setIsReportSelected} />;
      default:
        return (
          <BucketsOverview
            onEditBucket={handleEditBucket}
            onEditExpense={handleEditExpense}
          />
        );
    }
  };

  return (
    <ConvexProvider client={convexClient}>
      <View style={styles.container}>
        <View style={styles.content}>{renderScreen()}</View>

        {/* Bottom Navigation - Left pill with icons only */}
        {!isReportSelected && (
          <View style={styles.navContainer}>
          <View style={styles.tabBar}>
            <TouchableOpacity
              style={styles.tab}
              onPress={() => setCurrentScreen('buckets')}
            >
              <View
                style={[
                  styles.iconWrapper,
                  currentScreen === 'buckets' && styles.tabActive,
                ]}
              >
                <PaintBucket
                  size={22}
                  color="#FFFFFF"
                  strokeWidth={1.5}
                  style={{ opacity: currentScreen === 'buckets' ? 1 : 0.7 }}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tab}
              onPress={() => setShowShrimpyDrawer(true)}
            >
              <View
                style={[
                  styles.iconWrapper,
                  showShrimpyDrawer && styles.tabActive,
                ]}
              >
                <MessageCircle
                  size={22}
                  color="#FFFFFF"
                  strokeWidth={1.5}
                  style={{ opacity: 0.7 }}
                />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tab}
              onPress={() => setCurrentScreen('settings')}
            >
              <View
                style={[
                  styles.iconWrapper,
                  currentScreen === 'settings' && styles.tabActive,
                ]}
              >
                <SettingsIcon
                  size={22}
                  color="#FFFFFF"
                  strokeWidth={1.5}
                  style={{ opacity: currentScreen === 'settings' ? 1 : 0.7 }}
                />
              </View>
            </TouchableOpacity>
          </View>

          {/* Two Circular Action Buttons on the right */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => setShowAddExpense(true)}
            >
              <View style={styles.buttonIconWrapper}>
                <Plus size={24} color="#FFFFFF" strokeWidth={1.5} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.addButton}
              onPress={() => {
                try {
                  setShowAddBucket(true);
                } catch (error) {
                  console.error('Error opening add bucket modal:', error);
                }
              }}
            >
              <View style={styles.buttonIconWrapper}>
                <PackagePlus size={24} color="#FFFFFF" strokeWidth={1.5} />
              </View>
            </TouchableOpacity>
          </View>
        </View>
        )}

        {/* Add Bucket Modal */}
        {showAddBucket && (
          <AddBucket
            visible={showAddBucket}
            onClose={() => setShowAddBucket(false)}
            onSave={handleSaveBucket}
          />
        )}

        {/* Add Expense Modal */}
        {showAddExpense && (
          <AddExpense
            visible={showAddExpense}
            onClose={() => setShowAddExpense(false)}
          />
        )}

        {/* Income Management Modal */}
        {showIncomeManagement && (
          <IncomeManagement
            visible={showIncomeManagement}
            onClose={() => setShowIncomeManagement(false)}
          />
        )}

        {/* Edit Bucket Modal */}
        {selectedBucket && (
          <EditBucket
            visible={showEditBucket}
            bucket={selectedBucket}
            onClose={() => {
              setShowEditBucket(false);
              setSelectedBucket(null);
            }}
          />
        )}

        {/* Edit Expense Modal */}
        {selectedExpense && (
          <EditExpense
            visible={showEditExpense}
            expense={selectedExpense.expense}
            bucket={selectedExpense.bucket}
            onClose={() => {
              setShowEditExpense(false);
              setSelectedExpense(null);
            }}
          />
        )}

        {/* Shrimpy Drawer */}
        <Drawer
          visible={showShrimpyDrawer}
          onClose={() => setShowShrimpyDrawer(false)}
          fullScreen
        >
          <ChatScreen />
        </Drawer>
      </View>
    </ConvexProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    flex: 1,
    position: 'relative' as any,
  },
  navContainer: {
    position: 'fixed' as any,
    bottom: 32,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 1000,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: theme.colors.primary,
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 8,
    height: 56,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    alignItems: 'center',
    gap: 4,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  iconWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    display: 'flex',
  },
  tabActive: {
    opacity: 1,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  buttonIconWrapper: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    display: 'flex',
  },
});

export default App;
