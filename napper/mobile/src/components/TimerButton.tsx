import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, View } from 'react-native';
import { colors, typography, spacing, radius, shadows } from '../theme';
import { useElapsedTime } from '../hooks/useElapsedTime';

interface TimerButtonProps {
  isActive: boolean;
  startTime: string | null;
  onStart: () => void;
  onStop: () => void;
  loading?: boolean;
  label: string;       // e.g. "Sleep"
  activeColor?: string;
  inactiveColor?: string;
}

export function TimerButton({
  isActive,
  startTime,
  onStart,
  onStop,
  loading = false,
  label,
  activeColor = colors.sleep,
  inactiveColor = colors.textPrimary,
}: TimerButtonProps) {
  const elapsed = useElapsedTime(isActive ? startTime : null);

  const handlePress = () => {
    if (loading) return;
    if (isActive) {
      onStop();
    } else {
      onStart();
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        isActive
          ? { backgroundColor: activeColor, ...shadows.lg }
          : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1.5 },
      ]}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={isActive ? colors.textOnDark : activeColor} size="small" />
      ) : (
        <>
          <View style={styles.labelRow}>
            {isActive && <View style={styles.pulseDot} />}
            <Text
              style={[
                styles.buttonLabel,
                { color: isActive ? colors.textOnDark : inactiveColor },
              ]}
            >
              {isActive ? `Stop ${label}` : `Start ${label}`}
            </Text>
          </View>
          {isActive && (
            <Text style={styles.elapsed}>{elapsed}</Text>
          )}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radius.xl,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 72,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  pulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.7)',
  },
  buttonLabel: {
    fontSize: typography.fontSizeLG,
    fontWeight: typography.fontWeightSemiBold,
  },
  elapsed: {
    fontSize: typography.fontSizeXXL,
    fontWeight: typography.fontWeightBold,
    color: colors.textOnDark,
    marginTop: spacing.xs,
    letterSpacing: 2,
  },
});
