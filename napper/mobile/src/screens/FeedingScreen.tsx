import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  RefreshControl,
  Modal,
} from 'react-native';
import { useStore } from '../store/useStore';
import { FeedingCard } from '../components/FeedingCard';
import { colors, typography, spacing, radius, shadows } from '../theme';
import { FeedType, BreastSide, QuantityUnit } from '../types';

interface FeedConfig {
  feedType: FeedType;
  quantity?: string;
  quantityUnit?: QuantityUnit;
  breastSide?: BreastSide;
}

const FEED_TYPES: { key: FeedType; label: string; icon: string }[] = [
  { key: 'breast', label: 'Breast', icon: '🤱' },
  { key: 'bottle', label: 'Bottle', icon: '🍼' },
  { key: 'solid', label: 'Solids', icon: '🥣' },
];

const DEFAULT_UNITS: Record<FeedType, QuantityUnit> = {
  breast: 'min',
  bottle: 'ml',
  solid: 'g',
};

export function FeedingScreen() {
  const {
    activeBaby,
    feedingSessions,
    activeFeedingSession,
    loading,
    loadFeedingSessions,
    loadActiveFeeding,
    logFeeding,
    endFeeding,
  } = useStore();

  const [showModal, setShowModal] = useState(false);
  const [config, setConfig] = useState<FeedConfig>({ feedType: 'breast' });
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (activeBaby) {
      loadFeedingSessions();
      loadActiveFeeding();
    }
  }, [activeBaby?.id]);

  const handleLog = async () => {
    setActionLoading(true);
    try {
      await logFeeding({
        feed_type: config.feedType,
        quantity: config.quantity ? parseFloat(config.quantity) : undefined,
        quantity_unit: config.quantityUnit ?? DEFAULT_UNITS[config.feedType],
        breast_side: config.breastSide,
      });
      setShowModal(false);
      await loadFeedingSessions();
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

  const today = feedingSessions.filter((s) => {
    const d = new Date(s.start_time);
    return d.toDateString() === new Date().toDateString();
  });

  const earlier = feedingSessions.filter((s) => {
    const d = new Date(s.start_time);
    return d.toDateString() !== new Date().toDateString();
  });

  return (
    <View style={styles.container}>
      {/* Log Feeding Button */}
      <View style={styles.header}>
        {activeFeedingSession && (
          <View style={styles.activeBanner}>
            <Text style={styles.activeBannerText}>
              🍼 Feeding in progress since{' '}
              {new Date(activeFeedingSession.start_time).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.logButton}
          onPress={() => {
            setConfig({ feedType: 'breast' });
            setShowModal(true);
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.logButtonText}>+ Log Feeding</Text>
        </TouchableOpacity>
      </View>

      {/* List */}
      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => {
              loadFeedingSessions();
              loadActiveFeeding();
            }}
            tintColor={colors.feeding}
          />
        }
      >
        {today.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Today</Text>
            {today.map((s) => (
              <FeedingCard key={s.id} session={s} />
            ))}
          </>
        )}

        {earlier.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Earlier</Text>
            {earlier.map((s) => (
              <FeedingCard key={s.id} session={s} />
            ))}
          </>
        )}

        {feedingSessions.length === 0 && !loading && (
          <View style={styles.emptyList}>
            <Text style={styles.emptyListText}>No feedings logged yet</Text>
            <Text style={styles.emptyListSub}>Tap "+ Log Feeding" to begin</Text>
          </View>
        )}
      </ScrollView>

      {/* Log Feeding Modal */}
      <Modal visible={showModal} animationType="slide" transparent presentationStyle="overFullScreen">
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Log Feeding</Text>

            {/* Feed type selector */}
            <Text style={styles.fieldLabel}>Type</Text>
            <View style={styles.typeRow}>
              {FEED_TYPES.map(({ key, label, icon }) => (
                <TouchableOpacity
                  key={key}
                  style={[
                    styles.typeChip,
                    config.feedType === key && styles.typeChipActive,
                  ]}
                  onPress={() =>
                    setConfig((c) => ({
                      ...c,
                      feedType: key,
                      quantityUnit: DEFAULT_UNITS[key],
                      breastSide: key !== 'breast' ? undefined : c.breastSide,
                    }))
                  }
                >
                  <Text style={styles.typeChipIcon}>{icon}</Text>
                  <Text
                    style={[
                      styles.typeChipLabel,
                      config.feedType === key && styles.typeChipLabelActive,
                    ]}
                  >
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Breast side */}
            {config.feedType === 'breast' && (
              <>
                <Text style={styles.fieldLabel}>Side</Text>
                <View style={styles.typeRow}>
                  {(['left', 'right', 'both'] as BreastSide[]).map((side) => (
                    <TouchableOpacity
                      key={side}
                      style={[
                        styles.typeChip,
                        config.breastSide === side && styles.typeChipActive,
                      ]}
                      onPress={() => setConfig((c) => ({ ...c, breastSide: side }))}
                    >
                      <Text
                        style={[
                          styles.typeChipLabel,
                          config.breastSide === side && styles.typeChipLabelActive,
                        ]}
                      >
                        {side.charAt(0).toUpperCase() + side.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* Quantity */}
            <Text style={styles.fieldLabel}>
              Amount{' '}
              <Text style={styles.fieldUnit}>
                ({config.feedType === 'breast' ? 'min' : config.feedType === 'bottle' ? 'ml' : 'g'})
              </Text>
            </Text>
            <TextInput
              style={styles.input}
              keyboardType="decimal-pad"
              placeholder="Optional"
              placeholderTextColor={colors.textMuted}
              value={config.quantity ?? ''}
              onChangeText={(v) => setConfig((c) => ({ ...c, quantity: v }))}
            />

            {/* Actions */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setShowModal(false)}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, actionLoading && styles.disabledBtn]}
                onPress={handleLog}
                disabled={actionLoading}
              >
                <Text style={styles.confirmBtnText}>
                  {actionLoading ? 'Saving…' : 'Save'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  activeBanner: {
    backgroundColor: colors.feedingLight,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.feeding + '40',
  },
  activeBannerText: {
    fontSize: typography.fontSizeSM,
    color: colors.feeding,
    fontWeight: typography.fontWeightMedium,
    textAlign: 'center',
  },
  logButton: {
    backgroundColor: colors.feeding,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    ...shadows.md,
  },
  logButtonText: {
    color: colors.textOnDark,
    fontSize: typography.fontSizeLG,
    fontWeight: typography.fontWeightSemiBold,
  },
  list: { flex: 1 },
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
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: colors.textSecondary },
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
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  modalTitle: {
    fontSize: typography.fontSizeXL,
    fontWeight: typography.fontWeightBold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  fieldLabel: {
    fontSize: typography.fontSizeSM,
    fontWeight: typography.fontWeightSemiBold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  fieldUnit: {
    fontWeight: typography.fontWeightRegular,
    textTransform: 'none',
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  typeChip: {
    flex: 1,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    gap: 4,
  },
  typeChipActive: {
    borderColor: colors.feeding,
    backgroundColor: colors.feedingLight,
  },
  typeChipIcon: { fontSize: 18 },
  typeChipLabel: {
    fontSize: typography.fontSizeSM,
    color: colors.textSecondary,
    fontWeight: typography.fontWeightMedium,
  },
  typeChipLabelActive: {
    color: colors.feeding,
    fontWeight: typography.fontWeightSemiBold,
  },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.fontSizeMD,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  cancelBtnText: {
    color: colors.textSecondary,
    fontWeight: typography.fontWeightSemiBold,
    fontSize: typography.fontSizeMD,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: radius.xl,
    alignItems: 'center',
    backgroundColor: colors.feeding,
    ...shadows.md,
  },
  disabledBtn: { opacity: 0.6 },
  confirmBtnText: {
    color: colors.textOnDark,
    fontWeight: typography.fontWeightSemiBold,
    fontSize: typography.fontSizeMD,
  },
});
