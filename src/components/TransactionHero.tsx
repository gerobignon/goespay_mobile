import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import StatusBadge from './StatusBadge';

interface Props {
  statut: string | number;
  /** Transaction type — crypto uses a numeric state (1/0/3). */
  type?: string;
  /** Pre-formatted amount, without currency code. */
  amount: string;
  sign?: '+' | '-' | '';
  /** Amount color — defaults to the secondary accent. */
  amountColor?: string;
  currencyCode: string;
}

/** Transaction detail header: centered status pill + large signed amount + currency code. */
export default function TransactionHero({ statut, type, amount, sign = '', amountColor, currencyCode }: Props) {
  const styles = useThemedStyles(createStyles);
  return (
    <>
      <View style={styles.statusRow}>
        <StatusBadge statut={statut} type={type} />
      </View>
      <Text style={[styles.amount, amountColor ? { color: amountColor } : null]}>
        {sign}{amount}
      </Text>
      <Text style={styles.currency}>{currencyCode}</Text>
    </>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    statusRow: {
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    amount: {
      fontSize: FontSize.hero,
      fontFamily: Fonts.bold,
      color: Colors.secondary,
      textAlign: 'center',
    },
    currency: {
      fontSize: FontSize.sm,
      fontFamily: Fonts.semiBold,
      color: Colors.textMuted,
      textAlign: 'center',
      letterSpacing: 2,
      marginBottom: Spacing.lg,
    },
  });
