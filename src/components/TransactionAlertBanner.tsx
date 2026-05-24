import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useConfigStore, type AlertType, type AlertLevel } from '../stores/configStore';

interface Props {
  type: AlertType;
}

const ICONS: Record<AlertLevel, string> = {
  info:    'circle-info',
  warning: 'triangle-exclamation',
  danger:  'circle-exclamation',
};

export function TransactionAlertBanner({ type }: Props) {
  const alert = useConfigStore((s) => s.transaction_alerts?.[type]);
  const styles = useThemedStyles(createStyles);
  if (!alert || !alert.message) return null;
  const level: AlertLevel = (['info', 'warning', 'danger'] as AlertLevel[]).includes(alert.level)
    ? alert.level
    : 'info';
  return (
    <View style={[styles.banner, styles[level]]}>
      <FontAwesome6 name={ICONS[level]} size={14} color="#fff" style={{ marginRight: 8 }} />
      <Text style={styles.text}>{alert.message}</Text>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  info:    { backgroundColor: Colors.success },
  warning: { backgroundColor: Colors.warning },
  danger:  { backgroundColor: Colors.error },
  text: {
    flex: 1,
    color: '#fff',
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    lineHeight: 18,
  },
});
