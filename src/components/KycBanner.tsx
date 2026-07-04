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
  /** true si la pièce a expiré (validate=0 + idexp passée) */
  expired?: boolean;
  /** true si la pièce expire dans <= 30 jours (validate=1 mais bientôt expirée) */
  expiringSoon?: boolean;
  /** Nombre de jours restants (>= 0) si expiringSoon */
  daysLeft?: number | null;
  /** Incite à finir le KYC pour débloquer le bonus de bienvenue (état non validé). */
  bonus?: boolean;
}

export function KycBanner({ onPress, status = 0, expired = false, expiringSoon = false, daysLeft = null, bonus = false }: KycBannerProps) {
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const isPending = status === 2;

  let message: string;
  let color: string;
  let icon: string;
  let interactive = true;

  if (expired) {
    message = t('kyc.expiredMessage');
    color = Colors.error ?? '#dc2626';
    icon = 'circle-exclamation';
  } else if (expiringSoon) {
    const d = typeof daysLeft === 'number' && daysLeft >= 0 ? daysLeft : null;
    message = d !== null ? t('kyc.expiringSoon', { days: d }) : t('kyc.expiringSoonGeneric');
    color = Colors.warning;
    icon = 'triangle-exclamation';
  } else if (isPending) {
    message = t('kyc.pendingReview');
    color = Colors.info ?? '#3b82f6';
    icon = 'clock';
    interactive = false;
  } else if (bonus) {
    message = t('kyc.bonusPrompt');
    color = Colors.warning;
    icon = 'gift';
  } else {
    message = t('kyc.notValidated');
    color = Colors.warning;
    icon = 'triangle-exclamation';
  }
  const bgOpacity = isDark ? '20' : '33';

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: color + bgOpacity }]}
      onPress={interactive ? onPress : undefined}
      activeOpacity={interactive ? 0.7 : 1}
    >
      <FontAwesome6 name={icon as any} size={16} color={color} />
      <Text style={[styles.text, { color }]}>{message}</Text>
      {interactive && (
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
