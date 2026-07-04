import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
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
  let bonusMsg = false;

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
    bonusMsg = true;
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
      {bonusMsg ? (
        <View style={styles.bonusRow}>
          <Text style={[styles.bonusText, { color }]}>{t('kyc.bonusPrompt')} </Text>
          <LinearGradient
            colors={['#FFFFFF', '#FEF3C7', '#FDE68A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.amountBadge}
          >
            <Text style={styles.amountBadgeText}>{t('kyc.bonusAmount')}</Text>
          </LinearGradient>
          <Text style={styles.sparkle}> ✨</Text>
        </View>
      ) : (
        <Text style={[styles.text, { color }]}>{message}</Text>
      )}
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
  // Bonus : la phrase se termine par un badge clair (dégradé) pour rester lisible
  // sur le fond ambré de la bannière.
  bonusRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  bonusText: {
    flexShrink: 1,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
  },
  amountBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    borderColor: 'rgba(180,83,9,0.25)',
  },
  amountBadgeText: {
    color: '#B45309',
    fontFamily: Fonts.bold,
    fontSize: FontSize.sm,
    letterSpacing: 0.3,
  },
  sparkle: {
    fontSize: FontSize.sm,
  },
});
