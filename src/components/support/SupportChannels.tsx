import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';

/**
 * Écran Support historique : les canaux hors application (Telegram, WhatsApp,
 * email, téléphone) et les réseaux sociaux.
 *
 * C'est ce que voient les clients tant que la messagerie in-app reste réservée
 * aux administrateurs — d'où sa survie en composant séparé plutôt qu'un
 * remplacement pur et simple par la boîte de réception.
 */

import { useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { ScreenBackground } from '../ScreenBackground';
import { Reveal, Bounce } from '../anim';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts, BorderRadius } from '../../constants/theme';
import { showAlert } from '../../stores/alertStore';
import { CustomAlert } from '../CustomAlert';
import { useResponsive } from '../../hooks/useResponsive';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useTheme } from '../ThemeProvider';
import { useTranslation } from 'react-i18next';

const open = (url: string) =>
  Linking.openURL(url).catch(() => {});

const CHANNELS = [
  {
    icon: 'telegram' as const,
    brand: true,
    label: 'Telegram',
    sublabel: '@goespay',
    color: '#0088cc',
    bg: 'rgba(0,136,204,0.15)',
    url: 'https://t.me/goespaay',
  },
  {
    icon: 'whatsapp' as const,
    brand: true,
    label: 'WhatsApp',
    sublabel: '+237 659 939 340',
    color: '#25D366',
    bg: 'rgba(37,211,102,0.15)',
    url: 'https://wa.me/237659939340',
  },
  {
    icon: 'envelope' as const,
    brand: false,
    label: 'Email',
    sublabel: 'support@goespay.io',
    color: Colors.secondary,
    bg: 'rgba(244,178,40,0.15)',
    url: 'mailto:claims@goespay.io',
  },
  {
    icon: 'phone' as const,
    brand: false,
    label: 'Téléphone',
    labelKey: 'support.phone',
    sublabel: '+237 659 939 340',
    color: '#ff295b',
    bg: 'rgba(255,41,91,0.15)',
    url: 'tel:+237659939340',
  },
];

export function SupportChannels() {
  const router = useRouter();
  const { isWide } = useResponsive();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const SOCIALS = [
    { icon: 'telegram' as const, brand: true, color: Colors.primary, url: 'https://t.me/goespay' },
    { icon: 'whatsapp' as const, brand: true, color: '#25D366', url: 'https://wa.me/237659939340' },
    { icon: 'whatsapp' as const, brand: true, color: '#25D366', url: 'https://whatsapp.com/channel/0029Vb7k55BI7Be5dTCpti2v' },
    { icon: 'facebook-f' as const, brand: true, color: Colors.primary, url: 'http://fb.me/goespaay' },
    { icon: 'instagram' as const, brand: true, color: '#E1306C', url: 'http://instagram.com/goespaay' },
    { icon: 'x-twitter' as const, brand: true, color: isDark ? '#fff' : '#000', url: 'http://twitter.com/goespaay' },
    { icon: 'youtube' as const, brand: true, color: '#FF0000', url: 'https://youtube.com/channel/UCxooykyhvHYo_zAI1yckRsw/?sub_confirmation=1' },
  ];
  return (
    <ScreenBackground edges={['top']}>
        <ScrollView contentContainerStyle={[
          styles.scroll,
          isWide && { alignSelf: 'center', width: '100%', maxWidth: 800 },
        ]} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>{t('support.title')}</Text>
          </View>

          {/* Canaux de contact */}
          <View style={styles.grid}>
            {CHANNELS.map((ch, i) => (
              <Reveal key={ch.label} delay={i * 70} offset={14}>
                <Bounce style={styles.card} scaleTo={0.98} onPress={() => open(ch.url)}>
                  <View style={[styles.iconBox, { backgroundColor: ch.bg }]}>
                    <FontAwesome6 name={ch.icon} size={20} color={ch.color} iconStyle={ch.brand ? 'brands' : 'solid'} />
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardLabel}>{ch.labelKey ? t(ch.labelKey) : ch.label}</Text>
                    <Text style={styles.cardSub}>{ch.sublabel}</Text>
                  </View>
                  <FontAwesome6 name="arrow-right" size={13} color={Colors.textMuted} />
                </Bounce>
              </Reveal>
            ))}
          </View>

          {/* Réseaux sociaux */}
          <View style={styles.socialSection}>
            <Text style={styles.socialTitle}>{t('support.followUs')}</Text>
            <View style={styles.socialRow}>
              {SOCIALS.map((s) => (
                <Bounce key={s.url} onPress={() => open(s.url)} style={styles.socialBtn}>
                  <FontAwesome6 name={s.icon} size={22} color={s.color} iconStyle={s.brand ? 'brands' : 'solid'} />
                </Bounce>
              ))}
            </View>
          </View>
        </ScrollView>
      <CustomAlert />
    </ScreenBackground>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  scroll: {
    padding: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  grid: {
    gap: Spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: {
    flex: 1,
  },
  cardLabel: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  cardSub: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 1,
  },
  socialSection: {
    marginTop: Spacing.xl,
    alignItems: 'center',
  },
  socialTitle: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
    color: Colors.textMuted,
    letterSpacing: 1.2,
    marginBottom: Spacing.md,
  },
  socialRow: {
    flexDirection: 'row',
    gap: Spacing.lg,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  socialBtn: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

