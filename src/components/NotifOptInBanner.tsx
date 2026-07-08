import React, { useEffect, useState } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSize, Fonts, BorderRadius, Shadow, type ColorPalette } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useAuthStore } from '../stores/authStore';
import {
  isWebPushSupported,
  registerForPushNotifications,
  sendPushTokenToServer,
} from '../services/notificationService';
import { showAlert } from '../stores/alertStore';

// Snooze du « Plus tard » : on ne re-propose pas avant 7 jours.
const SNOOZE_KEY = 'goespay_notif_optin_snooze_until';
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;

function isSnoozed(): boolean {
  try {
    const until = Number(window.localStorage.getItem(SNOOZE_KEY) || '0');
    return Number.isFinite(until) && Date.now() < until;
  } catch {
    return false;
  }
}

/**
 * Prompt doux Web Push (PWA / navigateur, hors iOS non-installé).
 * S'affiche à l'ouverture quand : authentifié + Web Push supporté +
 * permission encore « default » + pas snoozé. Le bouton = geste utilisateur
 * (requis par Safari/Firefox) → fiable sur tous les navigateurs supportés.
 */
export const NotifOptInBanner: React.FC = () => {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  // Se pose AU-DESSUS de la tabbar (sans la recouvrir) : hauteur tabbar ≈
  // contenu (~62) + inset bas (home indicator). Sur un écran sans tabbar, ça
  // laisse juste un petit décalage — acceptable pour un bandeau transitoire.
  const tabBarHeight = 62 + insets.bottom;
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (!isAuthenticated) { setVisible(false); return; }
    if (!isWebPushSupported()) return;
    // On ne propose que si l'utilisateur n'a encore ni accordé ni refusé.
    if (Notification.permission !== 'default') return;
    if (isSnoozed()) return;
    setVisible(true);
  }, [isAuthenticated]);

  const snooze = () => {
    setVisible(false);
    try {
      window.localStorage.setItem(SNOOZE_KEY, String(Date.now() + SNOOZE_MS));
    } catch {}
  };

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const token = await registerForPushNotifications();
      if (token) {
        await sendPushTokenToServer(token);
        setVisible(false);
        showAlert(
          t('account.notifEnabled', 'Notifications activées'),
          t('account.notifEnabledOk', 'Vous recevrez vos confirmations de transaction.'),
          undefined,
          'success',
        );
      } else if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        setVisible(false);
        showAlert(
          t('account.notifDeniedTitle', 'Notifications bloquées'),
          t('account.notifDenied', 'Autorisez-les dans les réglages de votre navigateur.'),
          undefined,
          'warning',
        );
      }
    } catch {
      showAlert(
        t('common.error', 'Erreur'),
        t('account.notifError', "Impossible d'activer les notifications."),
        undefined,
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  if (Platform.OS !== 'web' || !visible) return null;

  return (
    <View style={[styles.wrap, { bottom: tabBarHeight }]} pointerEvents="box-none">
      <View style={styles.banner}>
        <View style={styles.iconBox}>
          <FontAwesome6 name="bell" size={18} color={Colors.primary} />
        </View>
        <View style={styles.textCol}>
          <Text style={styles.title}>{t('account.notifBannerTitle', 'Activez les notifications')}</Text>
          <Text style={styles.subtitle} numberOfLines={2}>
            {t('account.notifBannerSubtitle', 'Suivez vos transactions en temps réel')}
          </Text>
        </View>
        <View style={styles.btnCol}>
          <TouchableOpacity style={styles.enableBtn} onPress={enable} activeOpacity={0.85} disabled={busy}>
            <Text style={styles.enableBtnText}>{t('account.notifBannerEnable', 'Activer')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeBtn} onPress={snooze} activeOpacity={0.7} hitSlop={6}>
            <FontAwesome6 name="xmark" size={14} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const createStyles = (C: ColorPalette) => StyleSheet.create({
  wrap: {
    // En bas (comme le bandeau d'installation PWA) : en haut il passait sous la
    // barre d'état translucide de la PWA iOS et se retrouvait tronqué. Les deux
    // bandeaux ne coexistent pas (le push iOS exige une PWA installée, or
    // l'install ne s'affiche que hors-standalone) → pas de chevauchement.
    position: 'absolute' as any,
    left: 0,
    right: 0,
    bottom: 0,
    padding: Spacing.md,
    zIndex: 9998,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.cardSolid,
    borderRadius: BorderRadius.lg,
    padding: 12,
    paddingRight: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: C.border,
    ...Shadow.card,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
  },
  iconBox: {
    width: 44, height: 44,
    borderRadius: 12,
    backgroundColor: C.primary + '14',
    alignItems: 'center', justifyContent: 'center',
  },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontFamily: Fonts.bold, fontSize: FontSize.sm, color: C.text },
  subtitle: { fontFamily: Fonts.regular, fontSize: FontSize.xs, color: C.textMuted, marginTop: 2 },
  btnCol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  enableBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: BorderRadius.md,
  },
  enableBtnText: { fontFamily: Fonts.semiBold, fontSize: FontSize.xs, color: '#fff' },
  closeBtn: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
    borderRadius: 16,
  },
});
