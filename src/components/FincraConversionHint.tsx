import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts, withAlpha } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

interface Props {
  loading: boolean;
  /** True when the rate failed OR the converted amount couldn't be computed. */
  error: boolean;
  /** Already-translated label (e.g. "amount to pay" / "beneficiary receives"). */
  label: string;
  /** Converted amount in the Fincra currency. */
  amount: number | null;
  currency: string;
}

/**
 * Fincra currency conversion hint shown under the amount field in the
 * deposit / transfer modals. Three states: loading, error, value.
 */
export default function FincraConversionHint({ loading, error, label, amount, currency }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  if (loading) {
    return (
      <View style={styles.box}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={[styles.label, styles.muted]}>{t('transferModal.rateLoading')}</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.box, styles.error]}>
        <FontAwesome6 name="triangle-exclamation" size={13} color={Colors.error} iconStyle="solid" />
        <Text style={[styles.label, styles.errorText]}>{t('common.rateUnavailable')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.box}>
      <FontAwesome6 name="arrow-right-arrow-left" size={13} color={Colors.primary} iconStyle="solid" />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.amount}>
        ≈ {(amount ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} {currency}
      </Text>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    box: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: withAlpha(Colors.primary, 0.08),
      borderWidth: 1,
      borderColor: withAlpha(Colors.primary, 0.18),
      borderRadius: BorderRadius.md,
      paddingVertical: 11,
      paddingHorizontal: Spacing.sm,
      marginTop: Spacing.sm,
      marginBottom: Spacing.sm,
    },
    label: {
      flex: 1,
      fontSize: FontSize.xs,
      color: Colors.textSecondary,
      fontFamily: Fonts.semiBold,
    },
    amount: {
      fontSize: FontSize.md,
      color: Colors.primary,
      fontFamily: Fonts.bold,
    },
    error: {
      backgroundColor: withAlpha(Colors.error, 0.07),
      borderColor: withAlpha(Colors.error, 0.2),
    },
    errorText: {
      color: Colors.error,
      fontFamily: Fonts.semiBold,
    },
    muted: {
      color: Colors.textMuted,
      fontFamily: Fonts.medium,
    },
  });
