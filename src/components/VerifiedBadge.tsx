import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts, withAlpha } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

interface Props {
  /** 'md' for page headers (default), 'sm' for the compact sidebar/desktop variant */
  size?: 'sm' | 'md';
  style?: StyleProp<ViewStyle>;
}

/** "Account verified" pill — shown when user.validate === 1. */
export default function VerifiedBadge({ size = 'md', style }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const isSm = size === 'sm';

  return (
    <View style={[isSm ? styles.badgeSm : styles.badge, style]}>
      <FontAwesome6 name="circle-check" size={isSm ? 14 : 16} color={Colors.success} />
      <Text style={isSm ? styles.textSm : styles.text}>{t('account.verified')}</Text>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    badge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: withAlpha(Colors.success, 0.15),
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      borderWidth: 1,
      borderColor: withAlpha(Colors.success, 0.3),
    },
    badgeSm: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.xs,
      backgroundColor: withAlpha(Colors.success, 0.15),
      borderRadius: BorderRadius.sm,
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      borderWidth: 1,
      borderColor: withAlpha(Colors.success, 0.3),
    },
    text: {
      color: Colors.success,
      fontSize: FontSize.md,
      fontFamily: Fonts.semiBold,
    },
    textSm: {
      color: Colors.success,
      fontSize: FontSize.xs,
      fontFamily: Fonts.semiBold,
    },
  });
