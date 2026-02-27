import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet } from 'react-native';

import { HomeScreen } from '../screens/HomeScreen';
import { SleepScreen } from '../screens/SleepScreen';
import { FeedingScreen } from '../screens/FeedingScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { AddBabyScreen } from '../screens/AddBabyScreen';

import { colors, typography, spacing } from '../theme';
import { RootStackParamList, TabParamList } from '../types';

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootStackParamList>();

function TabIcon({ icon, label, focused }: { icon: string; label: string; focused: boolean }) {
  return (
    <View style={tabStyles.icon}>
      <Text style={{ fontSize: 20 }}>{icon}</Text>
      <Text style={[tabStyles.label, focused && tabStyles.labelFocused]}>{label}</Text>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  icon: { alignItems: 'center', gap: 2 },
  label: {
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: typography.fontWeightMedium,
  },
  labelFocused: {
    color: colors.sleep,
    fontWeight: typography.fontWeightSemiBold,
  },
});

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: {
          fontSize: typography.fontSizeLG,
          fontWeight: typography.fontWeightSemiBold,
          color: colors.textPrimary,
        },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingTop: spacing.xs,
          paddingBottom: spacing.sm,
          height: 64,
        },
        tabBarShowLabel: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Napper',
          tabBarIcon: ({ focused }) => <TabIcon icon="🏠" label="Home" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Sleep"
        component={SleepScreen}
        options={{
          title: 'Sleep',
          tabBarIcon: ({ focused }) => <TabIcon icon="😴" label="Sleep" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="Feeding"
        component={FeedingScreen}
        options={{
          title: 'Feeding',
          tabBarIcon: ({ focused }) => <TabIcon icon="🍼" label="Feed" focused={focused} />,
        }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{
          title: 'History',
          tabBarIcon: ({ focused }) => <TabIcon icon="📋" label="History" focused={focused} />,
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: {
            fontSize: typography.fontSizeLG,
            fontWeight: typography.fontWeightSemiBold,
            color: colors.textPrimary,
          },
          headerTintColor: colors.sleep,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen
          name="Main"
          component={MainTabs}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="AddBaby"
          component={AddBabyScreen as any}
          options={{ title: 'New Baby', presentation: 'modal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
