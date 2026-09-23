import React from 'react';
import { View, Text, StyleSheet, Share, Linking, Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useTranslation } from 'react-i18next';
import { Button } from './Button';
import { useAuthStore } from '../stores/authStore';
import { showAlert } from '../stores/alertStore';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';

const REFERRAL_BASE_URL = 'https://goespay.io';

/**
 * Invitation au parrainage, affichée sous la confirmation d'un envoi réussi.
 *
 * Même lien que la carte de parrainage de l'accueil : goespay.io/<CODE>, qui
 * mène à l'inscription code pré-rempli, avec repli ?ref= si le code n'a pas le
 * format court. Sans code de parrainage, rien à partager : le bloc disparaît.
 */
export function ReferralPrompt() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const user = useAuthStore((s) => s.user);
  const code = (user as any)?.referral_code || (user as any)?.referal_code;

  if (!code) return null;

  const link = /^[A-Z0-9]{4,32}$/.test(String(code))
    ? `${REFERRAL_BASE_URL}/${code}`
    : `${REFERRAL_BASE_URL}/register?ref=${encodeURIComponent(code)}`;
  const message = t('home.referralShareMsg', { code, link });

  // wa.me ouvre l'app WhatsApp sur mobile et WhatsApp Web ailleurs, message prérempli.
  const inviteWhatsapp = () => {
    Linking.openURL(`https://wa.me/?text=${encodeURIComponent(message)}`).catch(() => {});
  };

  // Feuille de partage du téléphone ; sur le web, le partage natif quand le
  // navigateur l'offre, sinon le message part dans le presse-papiers.
  const shareLink = async () => {
    try {
      if (Platform.OS === 'web') {
        const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
        if (nav?.share) {
          await nav.share({ text: message });
        } else {
          await Clipboard.setStringAsync(message);
          showAlert(t('common.success'), t('home.referralCopied'));
        }
      } else {
        await Share.share({ message, url: link });
      }
    } catch {}
  };

  return (
    <View style={styles.box}>
      <Text style={styles.title}>{t('transferModal.referralTitle')}</Text>
      <Text style={styles.text}>
        {t('transferModal.referralTextBefore')}
        <Text style={styles.rate}>{t('transferModal.referralRate')}</Text>
        {t('transferModal.referralTextAfter')}
      </Text>
      <Button
        title={t('transferModal.referralWhatsapp')}
        icon="whatsapp"
        iconBrand
        onPress={inviteWhatsapp}
        style={styles.action}
      />
      <Button
        title={t('transferModal.referralShare')}
        icon="link"
        variant="outline"
        onPress={shareLink}
        style={styles.action}
      />
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  box: {
    width: '100%',
    marginTop: Spacing.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.secondary + '40',
    backgroundColor: Colors.secondary + '0D',
  },
  title: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  text: {
    fontSize: FontSize.md,
    lineHeight: 22,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  rate: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.lg,
    color: Colors.primary,
  },
  action: {
    width: '100%',
  },
});
