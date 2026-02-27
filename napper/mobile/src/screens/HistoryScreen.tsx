import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { format, subDays, parseISO } from 'date-fns';
import { useStore } from '../store/useStore';
import { SleepCard } from '../components/SleepCard';
import { FeedingCard } from '../components/FeedingCard';
import { colors, typography, spacing, radius } from '../theme';

type TabType = 'sleep' | 'feeding';

export function HistoryScreen() {
  const { activeBaby, sleepSessions, feedingSessions, loading, loadSleepSessions, loadFeedingSessions } =
    useStore();

  const [activeTab, setActiveTab] = useState<TabType>('sleep');
  const [daysBack, setDaysBack] = useState(0);

  const selectedDate = subDays(new Date(), daysBack);
  const dateStr = format(selectedDate, 'yyyy-MM-dd');

  useEffect(() => {
    if (!activeBaby) return;
    loadSleepSessions(dateStr);
    loadFeedingSessions(dateStr);
  }, [activeBaby?.id, dateStr]);

  const currentSessions = activeTab === 'sleep' ? sleepSessions : feedingSessions;

  return (
    <View style={styles.container}>
      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'sleep' && styles.activeTab]}
          onPress={() => setActiveTab('sleep')}
        >
          <Text style={[styles.tabText, activeTab === 'sleep' && styles.activeTabText]}>
            😴 Sleep
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'feeding' && styles.activeTab]}
          onPress={() => setActiveTab('feeding')}
        >
          <Text style={[styles.tabText, activeTab === 'feeding' && styles.activeTabText]}>
            🍼 Feeding
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date Navigator */}
      <View style={styles.dateNav}>
        <TouchableOpacity
          style={styles.dateArrow}
          onPress={() => setDaysBack((d) => d + 1)}
        >
          <Text style={styles.dateArrowText}>‹</Text>
        </TouchableOpacity>

        <View style={styles.dateCenter}>
          <Text style={styles.dateLarge}>
            {daysBack === 0 ? 'Today' : daysBack === 1 ? 'Yesterday' : format(selectedDate, 'EEE, MMM d')}
          </Text>
          <Text style={styles.dateSmall}>{format(selectedDate, 'MMMM d, yyyy')}</Text>
        </View>

        <TouchableOpacity
          style={[styles.dateArrow, daysBack === 0 && styles.dateArrowDisabled]}
          onPress={() => daysBack > 0 && setDaysBack((d) => d - 1)}
          disabled={daysBack === 0}
        >
          <Text style={[styles.dateArrowText, daysBack === 0 && styles.disabledText]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Sessions */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              loadSleepSessions(dateStr);
              loadFeedingSessions(dateStr);
            }}
            tintColor={activeTab === 'sleep' ? colors.sleep : colors.feeding}
          />
        }
      >
        {currentSessions.length === 0 && !loading ? (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>
              No {activeTab} sessions on {format(selectedDate, 'MMM d')}
            </Text>
          </View>
        ) : (
          currentSessions.map((s) =>
            activeTab === 'sleep' ? (
              <SleepCard key={s.id} session={s as any} />
            ) : (
              <FeedingCard key={s.id} session={s as any} />
            )
          )
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
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: colors.surfaceAlt,
  },
  tabText: {
    fontSize: typography.fontSizeSM,
    color: colors.textMuted,
    fontWeight: typography.fontWeightMedium,
  },
  activeTabText: {
    color: colors.textPrimary,
    fontWeight: typography.fontWeightSemiBold,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dateArrow: {
    padding: spacing.sm,
    width: 44,
    alignItems: 'center',
  },
  dateArrowDisabled: {
    opacity: 0.3,
  },
  dateArrowText: {
    fontSize: 24,
    color: colors.textPrimary,
    lineHeight: 28,
  },
  disabledText: {
    color: colors.textMuted,
  },
  dateCenter: {
    flex: 1,
    alignItems: 'center',
  },
  dateLarge: {
    fontSize: typography.fontSizeLG,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.textPrimary,
  },
  dateSmall: {
    fontSize: typography.fontSizeXS,
    color: colors.textMuted,
    marginTop: 2,
  },
  list: {
    flex: 1,
  },
  listContent: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
  },
  empty: {
    paddingVertical: spacing.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.fontSizeMD,
    color: colors.textSecondary,
  },
});
