import React, { useEffect, useState } from 'react';
import { Platform, View, Text, TouchableOpacity, StyleSheet, Modal, ScrollView, Image } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, Spacing, FontSize, Fonts, BorderRadius, Shadow, type ColorPalette } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

const SESSION_KEY = 'goespay_pwa_install_dismissed';

type Browser = 'chrome-android' | 'chrome-desktop' | 'safari-ios' | 'safari-macos' | 'firefox' | 'samsung' | 'edge' | 'other';

function detectBrowser(): { browser: Browser; isMobile: boolean; isStandalone: boolean } {
  if (typeof navigator === 'undefined') return { browser: 'other', isMobile: false, isStandalone: false };
  const ua = navigator.userAgent || '';
  const isStandalone =
    (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    // @ts-ignore — iOS Safari only
    (typeof navigator !== 'undefined' && (navigator as any).standalone === true);
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  const isMacOS = /Macintosh/.test(ua) && !isIOS;
  const isAndroid = /Android/.test(ua);
  const isMobile = isIOS || isAndroid;

  let browser: Browser = 'other';
  if (isIOS) browser = 'safari-ios';
  else if (/SamsungBrowser/.test(ua)) browser = 'samsung';
  else if (/Edg\//.test(ua)) browser = 'edge';
  else if (/Firefox/.test(ua) || /FxiOS/.test(ua)) browser = 'firefox';
  else if (isAndroid && /Chrome/.test(ua)) browser = 'chrome-android';
  else if (isMacOS && /Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'safari-macos';
  else if (/Chrome/.test(ua)) browser = 'chrome-desktop';
  return { browser, isMobile, isStandalone };
}

export const PwaInstallBanner: React.FC = () => {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [info] = useState(() => detectBrowser());

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    if (typeof window === 'undefined') return;
    if (info.isStandalone) return;
    try {
      if (window.sessionStorage.getItem(SESSION_KEY) === '1') return;
    } catch {}

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handler as any);

    // Si pas de beforeinstallprompt après 1.2s (iOS, Firefox, Safari, etc.) → afficher quand même
    const timeout = setTimeout(() => {
      if (!info.isStandalone) setVisible(true);
    }, 1200);

    const installedHandler = () => {
      setVisible(false);
      setDeferredPrompt(null);
    };
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler as any);
      window.removeEventListener('appinstalled', installedHandler);
      clearTimeout(timeout);
    };
  }, [info.isStandalone]);

  const dismiss = () => {
    setVisible(false);
    try {
      window.sessionStorage.setItem(SESSION_KEY, '1');
    } catch {}
  };

  const install = async () => {
    if (deferredPrompt) {
      try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          setVisible(false);
        }
      } catch {}
      setDeferredPrompt(null);
    } else {
      setShowHelp(true);
    }
  };

  if (Platform.OS !== 'web' || !visible) return null;

  const browserName = (() => {
    switch (info.browser) {
      case 'safari-ios': return 'Safari iOS';
      case 'safari-macos': return 'Safari';
      case 'chrome-android': return 'Chrome';
      case 'chrome-desktop': return 'Chrome';
      case 'samsung': return 'Samsung Internet';
      case 'edge': return 'Edge';
      case 'firefox': return 'Firefox';
      default: return t('pwa.browser');
    }
  })();

  const canDirectInstall = !!deferredPrompt;

  return (
    <>
      <View style={styles.bannerWrap} pointerEvents="box-none">
        <View style={styles.banner}>
          <View style={styles.iconBox}>
            <Image source={require('../../assets/icon.png')} style={styles.appIcon} />
          </View>
          <View style={styles.textCol}>
            <Text style={styles.title}>{t('pwa.title')}</Text>
            <Text style={styles.subtitle} numberOfLines={2}>{t('pwa.subtitle')}</Text>
          </View>
          <View style={styles.btnCol}>
            <TouchableOpacity style={styles.installBtn} onPress={install} activeOpacity={0.85}>
              <FontAwesome6 name={canDirectInstall ? 'download' : 'circle-info'} size={13} color="#fff" />
              <Text style={styles.installBtnText}>
                {canDirectInstall ? t('pwa.install') : t('pwa.howTo')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.closeBtn} onPress={dismiss} activeOpacity={0.7}>
              <FontAwesome6 name="xmark" size={14} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <Modal visible={showHelp} transparent animationType="fade" onRequestClose={() => setShowHelp(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('pwa.helpTitle', { browser: browserName })}</Text>
              <TouchableOpacity onPress={() => setShowHelp(false)} hitSlop={8}>
                <FontAwesome6 name="xmark" size={18} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 380 }}>
              <Steps browser={info.browser} t={t} styles={styles} />
            </ScrollView>
            <TouchableOpacity style={styles.gotItBtn} onPress={() => setShowHelp(false)}>
              <Text style={styles.gotItText}>{t('pwa.gotIt')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
};

interface StepsProps {
  browser: Browser;
  t: (k: string) => string;
  styles: ReturnType<typeof createStyles>;
}

const Steps: React.FC<StepsProps> = ({ browser, t, styles }) => {
  const stepKeys: Record<Browser, string[]> = {
    'safari-ios': ['pwa.step.ios.1', 'pwa.step.ios.2', 'pwa.step.ios.3', 'pwa.step.ios.4'],
    'safari-macos': ['pwa.step.macSafari.1', 'pwa.step.macSafari.2', 'pwa.step.macSafari.3'],
    'chrome-android': ['pwa.step.androidChrome.1', 'pwa.step.androidChrome.2', 'pwa.step.androidChrome.3'],
    'chrome-desktop': ['pwa.step.desktopChrome.1', 'pwa.step.desktopChrome.2'],
    'edge': ['pwa.step.edge.1', 'pwa.step.edge.2'],
    'samsung': ['pwa.step.samsung.1', 'pwa.step.samsung.2', 'pwa.step.samsung.3'],
    'firefox': ['pwa.step.firefox.1', 'pwa.step.firefox.2'],
    'other': ['pwa.step.other.1', 'pwa.step.other.2'],
  };
  const icons: Record<Browser, string> = {
    'safari-ios': 'arrow-up-from-bracket',
    'safari-macos': 'arrow-up-from-bracket',
    'chrome-android': 'ellipsis-vertical',
    'chrome-desktop': 'download',
    'edge': 'download',
    'samsung': 'bars',
    'firefox': 'bars',
    'other': 'circle-info',
  };
  const keys = stepKeys[browser];
  const icon = icons[browser];
  return (
    <View>
      <View style={styles.iconHero}>
        <FontAwesome6 name={icon as any} size={28} color={Colors.primary} />
      </View>
      {keys.map((k, i) => (
        <View key={k} style={styles.stepRow}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>{i + 1}</Text>
          </View>
          <Text style={styles.stepText}>{t(k)}</Text>
        </View>
      ))}
    </View>
  );
};

const createStyles = (C: ColorPalette) => StyleSheet.create({
  bannerWrap: {
    position: 'absolute' as any,
    left: 0,
    right: 0,
    bottom: 0,
    padding: Spacing.md,
    zIndex: 9999,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
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
    width: 48, height: 48,
    borderRadius: 12,
    backgroundColor: C.primary + '14',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  appIcon: { width: 40, height: 40, borderRadius: 8 },
  textCol: { flex: 1, minWidth: 0 },
  title: { fontFamily: Fonts.bold, fontSize: FontSize.sm, color: C.text },
  subtitle: { fontFamily: Fonts.regular, fontSize: FontSize.xs, color: C.textMuted, marginTop: 2 },
  btnCol: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  installBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: C.primary,
    paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: BorderRadius.md,
  },
  installBtnText: { fontFamily: Fonts.semiBold, fontSize: FontSize.xs, color: '#fff' },
  closeBtn: {
    width: 32, height: 32, alignItems: 'center', justifyContent: 'center',
    borderRadius: 16,
  },
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', padding: Spacing.md,
  },
  modalCard: {
    width: '100%', maxWidth: 440,
    backgroundColor: C.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadow.card,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontFamily: Fonts.bold, fontSize: FontSize.lg, color: C.text, flex: 1, marginRight: 8 },
  iconHero: {
    width: 64, height: 64,
    borderRadius: 16, alignSelf: 'center',
    backgroundColor: C.primary + '14',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  stepBadge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: C.primary,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  stepBadgeText: { fontFamily: Fonts.bold, fontSize: FontSize.xs, color: '#fff' },
  stepText: { flex: 1, fontFamily: Fonts.regular, fontSize: FontSize.sm, color: C.text, lineHeight: 22 },
  gotItBtn: {
    marginTop: 8,
    backgroundColor: C.primary,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  gotItText: { fontFamily: Fonts.semiBold, fontSize: FontSize.md, color: '#fff' },
});
