import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts, withAlpha } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { getTransactionStatus } from '../constants/config';
import { normalizeStatut, getStatusIcon } from '../utils/transactionStatus';

interface Props {
  statut: string | number;
  /** Transaction type — crypto uses a numeric state (1/0/3). */
  type?: string;
  style?: StyleProp<ViewStyle>;
}

/** Colored status pill (icon + label) for a transaction status. */
export default function StatusBadge({ statut, type, style }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const norm = normalizeStatut(statut, type);
  const status = getTransactionStatus(t)[norm] ?? { label: String(statut), color: Colors.textMuted };

  return (
    <View style={[styles.badge, { backgroundColor: withAlpha(status.color, 0.13) }, style]}>
      <FontAwesome6 name={getStatusIcon(norm) as any} size={14} color={status.color} style={{ marginRight: 6 }} />
      <Text style={[styles.text, { color: status.color }]}>{status.label}</Text>
    </View>
  );
}

const createStyles = (_Colors: ColorPalette) =>
  StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.xs + 2,
      borderRadius: BorderRadius.pill,
    },
    text: {
      fontFamily: Fonts.bold,
      fontSize: FontSize.md,
    },
  });
