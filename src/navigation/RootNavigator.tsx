import React from 'react';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {Wallet, Plus, TrendingUp, MessageCircle, Settings as SettingsIcon} from 'lucide-react-native';
import {BucketsOverview} from '../screens/BucketsOverview';
import {BucketDetail} from '../screens/BucketDetail';
import {AddExpense} from '../screens/AddExpense';
import {Insights} from '../screens/Insights';
import {Reports} from '../screens/Reports';
import {ChatScreen} from '../screens/ChatScreen';
import {Settings} from '../screens/Settings';
import {IncomeManagement} from '../screens/IncomeManagement';
import {EditBucket} from '../screens/EditBucket';
import {EditExpense} from '../screens/EditExpense';
import {theme} from '../theme';

const Tab = createBottomTabNavigator();
const BucketsStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();

// Stack navigator for Buckets tab
const BucketsStackNavigator = () => {
  return (
    <BucketsStack.Navigator screenOptions={{headerShown: false}}>
      <BucketsStack.Screen name="BucketsOverview" component={BucketsOverview} />
      <BucketsStack.Screen name="BucketDetail" component={BucketDetail} />
      <BucketsStack.Screen name="EditBucket" component={EditBucket} />
      <BucketsStack.Screen name="EditExpense" component={EditExpense} />
    </BucketsStack.Navigator>
  );
};

// Stack navigator for Settings tab
const SettingsStackNavigator = () => {
  return (
    <SettingsStack.Navigator screenOptions={{headerShown: false}}>
      <SettingsStack.Screen name="SettingsMain" component={Settings} />
      <SettingsStack.Screen name="IncomeManagement" component={IncomeManagement} />
      <SettingsStack.Screen name="Reports" component={Reports} />
      <SettingsStack.Screen name="EditBucket" component={EditBucket} />
    </SettingsStack.Navigator>
  );
};

export const RootNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarShowLabel: false,
        tabBarStyle: {
          borderTopWidth: 0,
          elevation: 0,
          shadowOpacity: 0,
          paddingBottom: 8,
          paddingTop: 8,
          height: 60,
          backgroundColor: theme.colors.backgroundLight,
        },
      }}>
      <Tab.Screen
        name="Buckets"
        component={BucketsStackNavigator}
        options={{
          tabBarIcon: ({color}) => <Wallet size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="Add"
        component={AddExpense}
        options={{
          tabBarIcon: ({color}) => <Plus size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="Insights"
        component={Insights}
        options={{
          tabBarIcon: ({color}) => <TrendingUp size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          tabBarIcon: ({color}) => <MessageCircle size={24} color={color} strokeWidth={2} />,
        }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsStackNavigator}
        options={{
          tabBarIcon: ({color}) => <SettingsIcon size={24} color={color} strokeWidth={2} />,
        }}
      />
    </Tab.Navigator>
  );
};
