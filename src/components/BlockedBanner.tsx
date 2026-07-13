import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

interface Props {
  // Message personnalisé saisi par l'admin (détail user). Vide → fallback.
  message?: string;
  // Message par défaut si l'admin n'a rien saisi.
  fallback: string;
}

/**
 * Bandeau affiché quand un sens (recharge / retrait+envoi) est bloqué pour CE
 * user par l'admin. Montre le message perso (ou un défaut) + invite à contacter
 * le support.
 */
export function BlockedBanner({ message, fallback }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const text = (message ?? '').trim() || fallback;
  return (
    <View style={styles.banner}>
      <FontAwesome6 name="ban" size={16} color="#fff" style={{ marginTop: 1 }} />
      <View style={styles.body}>
        <Text style={styles.text}>{text}</Text>
        <Text style={styles.support}>{t('blocked.contactSupport')}</Text>
      </View>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  body: {
    flex: 1,
  },
  text: {
    color: '#fff',
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  support: {
    color: '#fff',
    opacity: 0.9,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    marginTop: 2,
  },
});
