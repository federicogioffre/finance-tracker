import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format, parseISO } from 'date-fns';
import { SleepSession } from '../types';
import { colors, typography, spacing, radius, shadows } from '../theme';

interface Props {
  session: SleepSession;
  onPress?: () => void;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function SleepCard({ session, onPress }: Props) {
  const startTime = parseISO(session.start_time);
  const isActive = session.end_time === null;
  const isNight = session.sleep_type === 'night';

  return (
    <TouchableOpacity
      style={[styles.card, isActive && styles.activeCard]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.leftAccent} />

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.badge, isNight ? styles.nightBadge : styles.napBadge]}>
            <Text style={[styles.badgeText, isNight ? styles.nightBadgeText : styles.napBadgeText]}>
              {isNight ? 'Night' : 'Nap'}
            </Text>
          </View>
          {isActive && (
            <View style={styles.activeDot}>
              <Text style={styles.activeDotText}>● Live</Text>
            </View>
          )}
        </View>

        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{format(startTime, 'h:mm a')}</Text>
          {session.end_time && (
            <>
              <Text style={styles.timeSeparator}>→</Text>
              <Text style={styles.timeText}>{format(parseISO(session.end_time), 'h:mm a')}</Text>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.dateText}>{format(startTime, 'EEE, MMM d')}</Text>
          {session.duration_minutes !== null && (
            <Text style={styles.durationText}>{formatDuration(session.duration_minutes)}</Text>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    overflow: 'hidden',
    ...shadows.sm,
  },
  activeCard: {
    backgroundColor: '#EEF4FF',
    borderWidth: 1,
    borderColor: colors.sleepLight,
  },
  leftAccent: {
    width: 4,
    backgroundColor: colors.sleep,
  },
  content: {
    flex: 1,
    padding: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
    gap: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  napBadge: {
    backgroundColor: colors.sleepLight,
  },
  nightBadge: {
    backgroundColor: '#2C3E7A',
  },
  badgeText: {
    fontSize: typography.fontSizeXS,
    fontWeight: typography.fontWeightSemiBold,
  },
  napBadgeText: {
    color: colors.sleep,
  },
  nightBadgeText: {
    color: '#FFFFFF',
  },
  activeDot: {
    marginLeft: 'auto' as any,
  },
  activeDotText: {
    fontSize: typography.fontSizeXS,
    color: colors.timerActive,
    fontWeight: typography.fontWeightSemiBold,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: 4,
  },
  timeText: {
    fontSize: typography.fontSizeLG,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.textPrimary,
  },
  timeSeparator: {
    color: colors.textMuted,
    fontSize: typography.fontSizeMD,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: typography.fontSizeSM,
    color: colors.textSecondary,
  },
  durationText: {
    fontSize: typography.fontSizeSM,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.sleep,
  },
});
