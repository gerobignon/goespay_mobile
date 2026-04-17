import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useTheme } from './ThemeProvider';
import { useTranslation } from 'react-i18next';

interface KycBannerProps {
  onPress?: () => void;
  status?: 0 | 2;
}

export function KycBanner({ onPress, status = 0 }: KycBannerProps) {
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const isPending = status === 2;
  const message = isPending
    ? t('kyc.pendingReview')
    : t('kyc.notValidated');
  const color = isPending ? Colors.info ?? '#3b82f6' : Colors.warning;
  const bgOpacity = isDark ? '20' : '33';

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: color + bgOpacity }]}
      onPress={isPending ? undefined : onPress}
      activeOpacity={isPending ? 1 : 0.7}
    >
      <FontAwesome6
        name={isPending ? 'clock' : 'triangle-exclamation'}
        size={16}
        color={color}
      />
      <Text style={[styles.text, { color }]}>
        {message}
      </Text>
      {!isPending && (
        <FontAwesome6 name="chevron-right" size={12} color={color} />
      )}
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '20',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  text: {
    flex: 1,
    color: Colors.warning,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
  },
});
