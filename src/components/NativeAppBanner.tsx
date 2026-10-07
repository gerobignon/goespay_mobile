import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets, type EdgeInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Fonts, FontSize, BorderRadius, type ColorPalette } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { hasNativeAppInstalled, mobileStore, openStore, type NativeStore } from '../utils/nativeAppPromo';

// Délai maximal laissé à getInstalledRelatedApps avant d'afficher le bandeau :
// évite de faire clignoter le bandeau chez ceux qui ont déjà l'application.
const DETECTION_TIMEOUT_MS = 700;

/**
 * Quand le bandeau est affiché, il consomme déjà l'encoche du haut : les écrans
 * rendus dessous reçoivent un inset haut à zéro (sinon double marge, bande vide
 * sous le bandeau). Ce contexte garde, pour ce qui doit se caler sur la fenêtre
 * entière (modals plein écran, visionneuse, coachmarks, hauteur du fil de
 * messages), les insets réels et la hauteur occupée par le bandeau.
 */
type TopChrome = { windowInsets: EdgeInsets; bannerHeight: number };
const TopChromeContext = createContext<TopChrome | null>(null);

/** Insets de la fenêtre entière, à utiliser dans un overlay plein écran. */
export function useWindowInsets(): EdgeInsets {
  const local = useSafeAreaInsets();
  return useContext(TopChromeContext)?.windowInsets ?? local;
}

/** Hauteur occupée en haut par le bandeau (encoche comprise), 0 sans bandeau. */
export function useTopBannerHeight(): number {
  return useContext(TopChromeContext)?.bannerHeight ?? 0;
}

/**
 * Bandeau permanent en haut du web mobile : renvoie vers l'application du
 * Play Store (Android) ou de l'App Store (iOS). Pas de bouton de fermeture.
 * Sur Android il disparaît quand l'application native est détectée ; iOS
 * n'offre aucune détection équivalente, il reste donc affiché.
 * Rendu dans le flux (au-dessus du Stack) : il pousse le contenu vers le
 * bas au lieu de le recouvrir.
 */
export const NativeAppBanner: React.FC<{ children: ReactNode }> = ({ children }) => {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [store, setStore] = useState<NativeStore | null>(null);
  const [bannerHeight, setBannerHeight] = useState(0);

  useEffect(() => {
    const target = mobileStore();
    if (!target) return;
    if (target === 'appstore') {
      setStore(target);
      return;
    }
    let alive = true;
    const timeout = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), DETECTION_TIMEOUT_MS));
    Promise.race([hasNativeAppInstalled(), timeout]).then((installed) => {
      if (alive && !installed) setStore(target);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Arbre stable avec ou sans bandeau : changer de structure à l'apparition du
  // bandeau remonterait le Stack et ferait perdre la navigation en cours.
  const shown = store !== null;
  const screenInsets = useMemo(() => (shown ? { ...insets, top: 0 } : insets), [insets, shown]);
  const chrome = useMemo(
    () => ({ windowInsets: insets, bannerHeight: shown ? bannerHeight : 0 }),
    [insets, shown, bannerHeight],
  );
  const isPlay = store === 'play';

  return (
    <>
      {store && (
        <View
          style={[styles.banner, { paddingTop: insets.top + 10 }]}
          onLayout={(e) => setBannerHeight(e.nativeEvent.layout.height)}
        >
          <Image source={require('../../assets/icon.png')} style={styles.appIcon} />
          <View style={styles.textCol}>
            <Text style={styles.title} numberOfLines={1}>{t(isPlay ? 'nativeApp.titleAndroid' : 'nativeApp.titleIos')}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{t(isPlay ? 'nativeApp.subtitlePlay' : 'nativeApp.subtitleAppStore')}</Text>
          </View>
          <TouchableOpacity style={styles.cta} onPress={() => openStore(store)} activeOpacity={0.85}>
            <FontAwesome6 name={isPlay ? 'google-play' : 'apple'} size={13} color="#fff" iconStyle="brands" />
            <Text style={styles.ctaText}>{t('nativeApp.install')}</Text>
          </TouchableOpacity>
        </View>
      )}
      <TopChromeContext.Provider value={chrome}>
        <SafeAreaInsetsContext.Provider value={screenInsets}>
          {children}
        </SafeAreaInsetsContext.Provider>
      </TopChromeContext.Provider>
    </>
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
