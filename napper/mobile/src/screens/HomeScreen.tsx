import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { format } from 'date-fns';
import { useStore } from '../store/useStore';
import { SleepPredictionCard, FeedingPredictionCard } from '../components/PredictionCard';
import { colors, typography, spacing, radius, shadows } from '../theme';

export function HomeScreen() {
  const {
    activeBaby,
    predictions,
    loadPredictions,
    loading,
    activeSleepSession,
    activeFeedingSession,
    loadActiveSleep,
    loadActiveFeeding,
  } = useStore();

  const refreshAll = async () => {
    await Promise.all([loadPredictions(), loadActiveSleep(), loadActiveFeeding()]);
  };

  useEffect(() => {
    refreshAll();
  }, [activeBaby?.id]);

  if (!activeBaby) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No baby added yet</Text>
        <Text style={styles.emptySubtitle}>Add a baby profile to get started</Text>
      </View>
    );
  }

  const insights = predictions?.insights;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={refreshAll} tintColor={colors.sleep} />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good {getTimeOfDay()}</Text>
          <Text style={styles.babyName}>{activeBaby.name}</Text>
          {predictions && (
            <Text style={styles.ageText}>{predictions.ageWeeks} weeks old</Text>
          )}
        </View>
        <Text style={styles.dateText}>{format(new Date(), 'EEE, MMM d')}</Text>
      </View>

      {/* Active Status */}
      {(activeSleepSession || activeFeedingSession) && (
        <View style={styles.statusBanner}>
          {activeSleepSession && (
            <View style={styles.statusItem}>
              <Text style={styles.statusIcon}>😴</Text>
              <Text style={styles.statusText}>
                Sleeping since {format(new Date(activeSleepSession.start_time), 'h:mm a')}
              </Text>
            </View>
          )}
          {activeFeedingSession && (
            <View style={styles.statusItem}>
              <Text style={styles.statusIcon}>🍼</Text>
              <Text style={styles.statusText}>
                Feeding since {format(new Date(activeFeedingSession.start_time), 'h:mm a')}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Predictions */}
      {predictions && (
        <>
          <Text style={styles.sectionTitle}>Predictions</Text>

          {predictions.sleep ? (
            <SleepPredictionCard prediction={predictions.sleep} />
          ) : activeSleepSession ? (
            <View style={styles.sleepingCard}>
              <Text style={styles.sleepingText}>😴 Currently sleeping</Text>
              <Text style={styles.sleepingSubtext}>
                Predictions will update when baby wakes up
              </Text>
            </View>
          ) : (
            <View style={styles.noDataCard}>
              <Text style={styles.noDataText}>Not enough data for sleep prediction</Text>
              <Text style={styles.noDataSub}>Track a few sleep sessions to get started</Text>
            </View>
          )}

          {predictions.feeding.length > 0 && (
            <View style={styles.feedingPredictions}>
              {predictions.feeding.map((fp) => (
                <FeedingPredictionCard key={fp.feedType} prediction={fp} />
              ))}
            </View>
          )}
        </>
      )}

      {/* Today's Insights */}
      {insights && (
        <>
          <Text style={styles.sectionTitle}>Today</Text>
          <View style={styles.insightsGrid}>
            <InsightTile
              label="Total Sleep"
              value={formatMinutes(insights.totalSleepMinutes)}
              color={colors.sleep}
            />
            <InsightTile
              label="Naps"
              value={String(insights.napCount)}
              color={colors.sleep}
            />
            <InsightTile
              label="Feeds"
              value={String(insights.feedCount)}
              color={colors.feeding}
            />
            <InsightTile
              label="Avg Wake Window"
              value={insights.averageWakeWindowMinutes > 0
                ? `${insights.averageWakeWindowMinutes}m`
                : '—'}
              color={colors.prediction}
            />
            {insights.longestNapMinutes > 0 && (
              <InsightTile
                label="Longest Nap"
                value={formatMinutes(insights.longestNapMinutes)}
                color={colors.sleep}
              />
            )}
            {insights.nightSleepMinutes > 0 && (
              <InsightTile
                label="Night Sleep"
                value={formatMinutes(insights.nightSleepMinutes)}
                color='#2C3E7A'
              />
            )}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function InsightTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={[styles.tile, { borderTopColor: color }]}>
      <Text style={[styles.tileValue, { color }]}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

function getTimeOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  greeting: {
    fontSize: typography.fontSizeSM,
    color: colors.textMuted,
    textTransform: 'capitalize',
  },
  babyName: {
    fontSize: typography.fontSizeXXL,
    fontWeight: typography.fontWeightBold,
    color: colors.textPrimary,
  },
  ageText: {
    fontSize: typography.fontSizeSM,
    color: colors.textSecondary,
    marginTop: 2,
  },
  dateText: {
    fontSize: typography.fontSizeSM,
    color: colors.textMuted,
    marginTop: 6,
  },
  statusBanner: {
    backgroundColor: colors.timerActiveBg,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.timerActive + '40',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  statusIcon: {
    fontSize: 16,
  },
  statusText: {
    fontSize: typography.fontSizeSM,
    color: colors.textPrimary,
    fontWeight: typography.fontWeightMedium,
  },
  sectionTitle: {
    fontSize: typography.fontSizeSM,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
  },
  feedingPredictions: {
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  sleepingCard: {
    backgroundColor: '#EEF4FF',
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.sleepLight,
  },
  sleepingText: {
    fontSize: typography.fontSizeLG,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.sleep,
  },
  sleepingSubtext: {
    fontSize: typography.fontSizeSM,
    color: colors.textSecondary,
    marginTop: 4,
    textAlign: 'center',
  },
  noDataCard: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  noDataText: {
    fontSize: typography.fontSizeMD,
    color: colors.textSecondary,
    fontWeight: typography.fontWeightMedium,
  },
  noDataSub: {
    fontSize: typography.fontSizeSM,
    color: colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  insightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    flex: 1,
    minWidth: '45%',
    borderTopWidth: 3,
    ...shadows.sm,
  },
  tileValue: {
    fontSize: typography.fontSizeXL,
    fontWeight: typography.fontWeightBold,
    marginBottom: 2,
  },
  tileLabel: {
    fontSize: typography.fontSizeXS,
    color: colors.textMuted,
    fontWeight: typography.fontWeightMedium,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyTitle: {
    fontSize: typography.fontSizeXL,
    fontWeight: typography.fontWeightBold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  emptySubtitle: {
    fontSize: typography.fontSizeMD,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
