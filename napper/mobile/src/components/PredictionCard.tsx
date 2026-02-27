import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { format, parseISO, differenceInMinutes } from 'date-fns';
import { SleepPrediction, FeedingPrediction } from '../types';
import { colors, typography, spacing, radius, shadows } from '../theme';

// ─── Sleep Prediction Card ────────────────────────────────────────────────────

interface SleepPredictionProps {
  prediction: SleepPrediction;
}

export function SleepPredictionCard({ prediction }: SleepPredictionProps) {
  const now = new Date();
  const predictedTime = parseISO(prediction.predictedSleepTime);
  const minutesUntil = differenceInMinutes(predictedTime, now);
  const isPast = minutesUntil < 0;

  const confidencePct = Math.round(prediction.confidence * 100);
  const confidenceColor =
    prediction.confidence >= 0.7
      ? colors.success
      : prediction.confidence >= 0.5
      ? colors.warning
      : colors.error;

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>Next Sleep</Text>
        <View style={[styles.clusterBadge, prediction.cluster === 'night' && styles.nightBadge]}>
          <Text style={[styles.clusterText, prediction.cluster === 'night' && styles.nightClusterText]}>
            {prediction.cluster === 'day' ? '☀️ Day nap' : '🌙 Night'}
          </Text>
        </View>
      </View>

      <Text style={styles.predictedTime}>{format(predictedTime, 'h:mm a')}</Text>

      <View style={styles.detailRow}>
        {isPast ? (
          <Text style={[styles.detail, { color: colors.warning }]}>
            {Math.abs(minutesUntil)}m overdue
          </Text>
        ) : (
          <Text style={styles.detail}>
            in {minutesUntil < 60 ? `${minutesUntil}m` : `${Math.floor(minutesUntil / 60)}h ${minutesUntil % 60}m`}
          </Text>
        )}
        <Text style={styles.detail}>Wake window: {prediction.wakeWindowMinutes}m</Text>
      </View>

      {prediction.predictedWakeTime && (
        <Text style={styles.wakeTime}>
          Wake ~{format(parseISO(prediction.predictedWakeTime), 'h:mm a')}
        </Text>
      )}

      <View style={styles.confidenceRow}>
        <View style={styles.confidenceBar}>
          <View
            style={[
              styles.confidenceFill,
              { width: `${confidencePct}%` as any, backgroundColor: confidenceColor },
            ]}
          />
        </View>
        <Text style={[styles.confidenceLabel, { color: confidenceColor }]}>
          {confidencePct}% confidence
        </Text>
      </View>

      <Text style={styles.basedOn}>Based on {prediction.basedOnSessions} sessions</Text>
    </View>
  );
}

// ─── Feeding Prediction Card ──────────────────────────────────────────────────

interface FeedingPredictionProps {
  prediction: FeedingPrediction;
}

const FEED_ICONS: Record<string, string> = {
  breast: '🤱',
  bottle: '🍼',
  solid: '🥣',
};

export function FeedingPredictionCard({ prediction }: FeedingPredictionProps) {
  const now = new Date();
  const predictedTime = parseISO(prediction.predictedNextFeedTime);
  const minutesUntil = differenceInMinutes(predictedTime, now);
  const isPast = minutesUntil < 0;

  const confidencePct = Math.round(prediction.confidence * 100);

  return (
    <View style={[styles.card, styles.feedingCard]}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>
          {FEED_ICONS[prediction.feedType]} Next {prediction.feedType}
        </Text>
      </View>

      <Text style={styles.predictedTime}>{format(predictedTime, 'h:mm a')}</Text>

      <View style={styles.detailRow}>
        {isPast ? (
          <Text style={[styles.detail, { color: colors.warning }]}>
            {Math.abs(minutesUntil)}m overdue
          </Text>
        ) : (
          <Text style={styles.detail}>
            in {minutesUntil < 60 ? `${minutesUntil}m` : `${Math.floor(minutesUntil / 60)}h ${minutesUntil % 60}m`}
          </Text>
        )}
        <Text style={styles.detail}>Every ~{prediction.averageIntervalMinutes}m</Text>
      </View>

      <Text style={styles.basedOn}>
        {confidencePct}% · {prediction.basedOnSessions} sessions
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.sleep,
    ...shadows.md,
  },
  feedingCard: {
    borderLeftColor: colors.feeding,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  cardTitle: {
    fontSize: typography.fontSizeSM,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clusterBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    backgroundColor: colors.sleepLight,
  },
  nightBadge: {
    backgroundColor: '#2C3E7A',
  },
  clusterText: {
    fontSize: typography.fontSizeXS,
    fontWeight: typography.fontWeightMedium,
    color: colors.sleep,
  },
  nightClusterText: {
    color: '#FFFFFF',
  },
  predictedTime: {
    fontSize: typography.fontSizeXXL,
    fontWeight: typography.fontWeightBold,
    color: colors.textPrimary,
    marginVertical: spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  detail: {
    fontSize: typography.fontSizeSM,
    color: colors.textSecondary,
  },
  wakeTime: {
    fontSize: typography.fontSizeSM,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  confidenceBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  confidenceFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  confidenceLabel: {
    fontSize: typography.fontSizeXS,
    fontWeight: typography.fontWeightSemiBold,
    minWidth: 80,
    textAlign: 'right',
  },
  basedOn: {
    fontSize: typography.fontSizeXS,
    color: colors.textMuted,
    marginTop: 2,
  },
});
