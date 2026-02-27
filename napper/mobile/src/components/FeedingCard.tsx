import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { format, parseISO } from 'date-fns';
import { FeedingSession, FeedType } from '../types';
import { colors, typography, spacing, radius, shadows } from '../theme';

interface Props {
  session: FeedingSession;
  onPress?: () => void;
}

const FEED_LABELS: Record<FeedType, string> = {
  breast: 'Breast',
  bottle: 'Bottle',
  solid: 'Solids',
};

const FEED_COLORS: Record<FeedType, { bg: string; text: string; accent: string }> = {
  breast: { bg: '#FFF0F6', text: '#C4457A', accent: '#E87DAE' },
  bottle: { bg: colors.feedingLight, text: colors.feeding, accent: colors.feeding },
  solid: { bg: '#F0F9E8', text: '#5A9E3C', accent: '#7DC050' },
};

function formatQuantity(session: FeedingSession): string | null {
  if (!session.quantity) return null;
  const unit = session.quantity_unit ?? '';
  const side = session.breast_side ? ` (${session.breast_side})` : '';
  return `${session.quantity}${unit}${side}`;
}

export function FeedingCard({ session, onPress }: Props) {
  const fc = FEED_COLORS[session.feed_type];
  const startTime = parseISO(session.start_time);
  const quantityStr = formatQuantity(session);
  const isActive = session.end_time === null;

  return (
    <TouchableOpacity
      style={[styles.card, isActive && { borderColor: fc.accent, borderWidth: 1 }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[styles.leftAccent, { backgroundColor: fc.accent }]} />

      <View style={styles.content}>
        <View style={styles.header}>
          <View style={[styles.badge, { backgroundColor: fc.bg }]}>
            <Text style={[styles.badgeText, { color: fc.text }]}>
              {FEED_LABELS[session.feed_type]}
            </Text>
          </View>
          {isActive && <Text style={styles.liveText}>● Live</Text>}
        </View>

        <View style={styles.timeRow}>
          <Text style={styles.timeText}>{format(startTime, 'h:mm a')}</Text>
          {session.end_time && (
            <>
              <Text style={styles.separator}>→</Text>
              <Text style={styles.timeText}>{format(parseISO(session.end_time), 'h:mm a')}</Text>
            </>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.dateText}>{format(startTime, 'EEE, MMM d')}</Text>
          {quantityStr && (
            <Text style={[styles.quantityText, { color: fc.text }]}>{quantityStr}</Text>
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
  leftAccent: {
    width: 4,
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
  badgeText: {
    fontSize: typography.fontSizeXS,
    fontWeight: typography.fontWeightSemiBold,
  },
  liveText: {
    marginLeft: 'auto' as any,
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
  separator: {
    color: colors.textMuted,
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
  quantityText: {
    fontSize: typography.fontSizeSM,
    fontWeight: typography.fontWeightSemiBold,
  },
});
