import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useStore } from '../store/useStore';
import { SleepCard } from '../components/SleepCard';
import { TimerButton } from '../components/TimerButton';
import { colors, typography, spacing, radius, shadows } from '../theme';

type SleepTypeOption = 'nap' | 'night';

export function SleepScreen() {
  const {
    activeBaby,
    sleepSessions,
    activeSleepSession,
    loading,
    loadSleepSessions,
    loadActiveSleep,
    startSleep,
    endSleep,
  } = useStore();

  const [selectedType, setSelectedType] = useState<SleepTypeOption>('nap');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (activeBaby) {
      loadSleepSessions();
      loadActiveSleep();
    }
  }, [activeBaby?.id]);

  const handleStart = async () => {
    setActionLoading(true);
    try {
      await startSleep(selectedType);
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error ?? e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStop = async () => {
    setActionLoading(true);
    try {
      await endSleep();
      await loadSleepSessions();
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error ?? e.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (!activeBaby) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Add a baby profile first</Text>
      </View>
    );
  }

  const today = sleepSessions.filter((s) => {
    const d = new Date(s.start_time);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const earlier = sleepSessions.filter((s) => {
    const d = new Date(s.start_time);
    const now = new Date();
    return d.toDateString() !== now.toDateString();
  });

  return (
    <View style={styles.container}>
      {/* Timer Section */}
      <View style={styles.timerSection}>
        {/* Type Selector — only when not sleeping */}
        {!activeSleepSession && (
          <View style={styles.typeSelector}>
            {(['nap', 'night'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.typeOption, selectedType === t && styles.typeOptionActive]}
                onPress={() => setSelectedType(t)}
              >
                <Text style={[styles.typeText, selectedType === t && styles.typeTextActive]}>
                  {t === 'nap' ? '☀️ Nap' : '🌙 Night'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <TimerButton
          isActive={!!activeSleepSession}
          startTime={activeSleepSession?.start_time ?? null}
          onStart={handleStart}
          onStop={handleStop}
          loading={actionLoading}
          label="Sleep"
          activeColor={colors.sleep}
        />

        {activeSleepSession && (
          <Text style={styles.sleepTypeLabel}>
            {activeSleepSession.sleep_type === 'night' ? '🌙 Night sleep' : '☀️ Nap'}
          </Text>
        )}
      </View>

      {/* Sessions List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              loadSleepSessions();
              loadActiveSleep();
            }}
            tintColor={colors.sleep}
          />
        }
      >
        {today.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Today</Text>
            {today.map((s) => (
              <SleepCard key={s.id} session={s} />
            ))}
          </>
        )}

        {earlier.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Earlier</Text>
            {earlier.map((s) => (
              <SleepCard key={s.id} session={s} />
            ))}
          </>
        )}

        {sleepSessions.length === 0 && !loading && (
          <View style={styles.emptyList}>
            <Text style={styles.emptyListText}>No sleep sessions yet</Text>
            <Text style={styles.emptyListSub}>Tap "Start Sleep" to begin tracking</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  timerSection: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
    ...shadows.sm,
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: 4,
    gap: 4,
  },
  typeOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  typeOptionActive: {
    backgroundColor: colors.surface,
    ...shadows.sm,
  },
  typeText: {
    fontSize: typography.fontSizeSM,
    fontWeight: typography.fontWeightMedium,
    color: colors.textMuted,
  },
  typeTextActive: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeightSemiBold,
  },
  sleepTypeLabel: {
    textAlign: 'center',
    fontSize: typography.fontSizeSM,
    color: colors.textSecondary,
    marginTop: -spacing.sm,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  sectionLabel: {
    fontSize: typography.fontSizeXS,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
  },
  emptyList: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyListText: {
    fontSize: typography.fontSizeMD,
    color: colors.textSecondary,
    fontWeight: typography.fontWeightMedium,
  },
  emptyListSub: {
    fontSize: typography.fontSizeSM,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
});
