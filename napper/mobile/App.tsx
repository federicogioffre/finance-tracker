import React, { useEffect, useState } from 'react';
import { StatusBar, View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppNavigator } from './src/navigation';
import { useStore } from './src/store/useStore';
import { AddBabyScreen } from './src/screens/AddBabyScreen';
import { colors, typography, spacing } from './src/theme';

function AppBootstrap() {
  const { babies, loadBabies, activeBaby } = useStore();
  const [bootstrapped, setBootstrapped] = useState(false);
  const [showAddBaby, setShowAddBaby] = useState(false);

  useEffect(() => {
    loadBabies().finally(() => setBootstrapped(true));
  }, []);

  if (!bootstrapped) {
    return (
      <View style={styles.splash}>
        <Text style={styles.splashTitle}>🌙</Text>
        <Text style={styles.splashText}>Napper</Text>
      </View>
    );
  }

  if (babies.length === 0 || showAddBaby) {
    return (
      <View style={styles.container}>
        {babies.length > 0 && (
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => setShowAddBaby(false)}
          >
            <Text style={styles.skipText}>← Back</Text>
          </TouchableOpacity>
        )}
        <AddBabyScreen onCreated={() => setShowAddBaby(false)} />
      </View>
    );
  }

  return <AppNavigator />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.background} />
      <AppBootstrap />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  splash: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  splashTitle: {
    fontSize: 64,
    marginBottom: spacing.sm,
  },
  splashText: {
    fontSize: typography.fontSizeXXL,
    fontWeight: typography.fontWeightBold,
    color: colors.textPrimary,
    letterSpacing: 4,
  },
  skipBtn: {
    padding: spacing.md,
    paddingTop: spacing.lg,
  },
  skipText: {
    color: colors.sleep,
    fontSize: typography.fontSizeMD,
    fontWeight: typography.fontWeightMedium,
  },
});
