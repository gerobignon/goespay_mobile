import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Fonts, FontSize, BorderRadius, type ColorPalette } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { hasNativeAppInstalled, isAndroidWeb, openAndroidStore } from '../utils/nativeAppPromo';

// Délai maximal laissé à getInstalledRelatedApps avant d'afficher le bandeau :
// évite de faire clignoter le bandeau chez ceux qui ont déjà l'application.
const DETECTION_TIMEOUT_MS = 700;

/**
 * Bandeau permanent en haut du web Android : renvoie vers l'application
 * du Play Store. Pas de bouton de fermeture, il reste tant que
 * l'application native n'est pas installée sur l'appareil.
 * Rendu dans le flux (au-dessus du Stack) : il pousse le contenu vers le
 * bas au lieu de le recouvrir.
 */
export const AndroidAppBanner: React.FC = () => {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isAndroidWeb()) return;
    let alive = true;
    const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), DETECTION_TIMEOUT_MS));
    Promise.race([hasNativeAppInstalled(), timeout]).then((installed) => {
      if (alive) setVisible(!installed);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!visible) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + 10 }]}>
      <Image source={require('../../assets/icon.png')} style={styles.appIcon} />
      <View style={styles.textCol}>
        <Text style={styles.title} numberOfLines={1}>{t('androidApp.title')}</Text>
        <Text style={styles.subtitle} numberOfLines={1}>{t('androidApp.subtitle')}</Text>
      </View>
      <TouchableOpacity style={styles.cta} onPress={openAndroidStore} activeOpacity={0.85}>
        <FontAwesome6 name="google-play" size={13} color="#fff" iconStyle="brands" />
        <Text style={styles.ctaText}>{t('androidApp.install')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (C: ColorPalette) => StyleSheet.create({
  banner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: C.cardSolid,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    zIndex: 9999,
  },
  appIcon: { width: 36, height: 36, borderRadius: 8 },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontFamily: Fonts.semiBold, fontSize: FontSize.sm, color: C.text },
  subtitle: { fontFamily: Fonts.regular, fontSize: FontSize.xs, color: C.textMuted, marginTop: 1 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  ctaText: { fontFamily: Fonts.semiBold, fontSize: FontSize.xs, color: '#fff' },
});
