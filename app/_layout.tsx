import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Image, ActivityIndicator, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useFonts } from 'expo-font';import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../src/stores/authStore';
import { usePinStore } from '../src/stores/pinStore';
import { saveCredentials } from '../src/services/secureAuthService';
import { checkApiConnection } from '../src/services/api';
import {
  registerForPushNotifications,
  sendPushTokenToServer,
  addNotificationReceivedListener,
  addNotificationResponseListener,
} from '../src/services/notificationService';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts } from '../src/constants/theme';
import { useThemedStyles } from '../src/hooks/useThemedStyles';
import { API_BASE_URL } from '../src/constants/config';
import { CustomAlert } from '../src/components/CustomAlert';
import { ThemeProvider, useTheme } from '../src/components/ThemeProvider';
import '../src/i18n';  // initialize i18next
import { initLanguage } from '../src/i18n';
import { useTranslation } from 'react-i18next';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootInner />
    </ThemeProvider>
  );
}

function RootInner() {
  const { isAuthenticated, isLoading, loadToken } = useAuthStore();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const { isLocked, isSetupDone, isInitialized, initialize } = usePinStore();
  const segments = useSegments();
  const router = useRouter();
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error' | 'maintenance'>('checking');
  const [isMounted, setIsMounted] = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const notifListenerRef = useRef<Notifications.Subscription | null>(null);
  const responseListenerRef = useRef<Notifications.Subscription | null>(null);

  const [fontsLoaded] = useFonts({
    Quicksand_400Regular: require('../assets/fonts/Quicksand_400Regular.ttf'),
    Quicksand_500Medium: require('../assets/fonts/Quicksand_500Medium.ttf'),
    Quicksand_600SemiBold: require('../assets/fonts/Quicksand_600SemiBold.ttf'),
    Quicksand_700Bold: require('../assets/fonts/Quicksand_700Bold.ttf'),
    FontAwesome6Brands: require('../assets/fonts/FontAwesome6_Brands.ttf'),
    FontAwesome6Free: require('../assets/fonts/FontAwesome6_Regular.ttf'),
    'FontAwesome6Brands-Regular': require('../assets/fonts/FontAwesome6_Brands.ttf'),
    'FontAwesome6Free-Regular': require('../assets/fonts/FontAwesome6_Regular.ttf'),
    'FontAwesome6Free-Solid': require('../assets/fonts/FontAwesome6_Solid.ttf'),
  });

  // Android ne propage pas fontFamily comme CSS → on force Quicksand globalement
  // defaultProps.style doit être un tableau pour être mergé avec les styles locaux
  if (fontsLoaded) {
    const RNText = Text as any;
    if (!RNText.__quicksandPatched) {
      RNText.defaultProps = RNText.defaultProps ?? {};
      RNText.defaultProps.style = [{ fontFamily: 'Quicksand_400Regular' }];
      RNText.__quicksandPatched = true;
    }
  }

  useEffect(() => {
    setIsMounted(true);
    loadToken();
    initialize();
    initLanguage();
    // Patch viewport meta on web pour activer env(safe-area-inset-*) sur iOS notch/PWA
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const meta = document.querySelector('meta[name="viewport"]');
      if (meta) {
        meta.setAttribute(
          'content',
          'width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover'
        );
      }
      // 100dvh (dynamic viewport) pour suivre la barre d'URL mobile
      const styleEl = document.createElement('style');
      styleEl.innerHTML = 'html, body, #root { height: 100dvh !important; }';
      document.head.appendChild(styleEl);
    }
  }, []);

  // Vérification du statut API au montage et toutes les 60s sur web
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      // En dev (Metro), on saute le check offline/maintenance pour ne pas bloquer
      // le test sur device réel quand le backend prod renvoie offline=1.
      if (__DEV__) {
        if (cancelled) return;
        setShowOfflineBanner(false);
        setApiStatus((prev) => (prev === 'checking' || prev === 'error' || prev === 'maintenance' ? 'ok' : prev));
        return;
      }
      const { connected, offline: _offline, backendAdmin } = await checkApiConnection();
      if (cancelled) return;
      // MAINTENANCE CHECK : redirection si serveur en maintenance
      if (_offline) {
        // Sur web, un BackendUser (admin October CMS) avec session active passe outre
        if (Platform.OS === 'web' && backendAdmin) {
          setShowOfflineBanner(true);
          setApiStatus((prev) => (prev === 'checking' || prev === 'error' || prev === 'maintenance' ? 'ok' : prev));
          return;
        }
        if (Platform.OS === 'web') {
          window.location.href = 'https://goespay.io/maintenance';
          return;
        }
        setApiStatus('maintenance');
        return;
      }
      setShowOfflineBanner(false);
      if (!connected) {
        setApiStatus('error');
      } else {
        setApiStatus((prev) => (prev === 'checking' || prev === 'error' || prev === 'maintenance' ? 'ok' : prev));
      }
    };

    check();

    if (Platform.OS === 'web') {
      const interval = setInterval(() => check(), 60_000);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // Enregistrement des notifications push quand l'utilisateur est authentifié
  useEffect(() => {
    if (!isAuthenticated) return;

    registerForPushNotifications()
      .then((token) => {
        if (token) sendPushTokenToServer(token);
      })
      .catch((e) => {});

    // Listener : notif reçue en foreground (rien de spécial à faire, le handler global s'en charge)
    notifListenerRef.current = addNotificationReceivedListener((_notification) => {
      // Les notifications sont affichées automatiquement via setNotificationHandler
    });

    // Listener : tap sur une notification → navigation
    responseListenerRef.current = addNotificationResponseListener((response) => {
      const data = response.notification.request.content.data as Record<string, string> | undefined;
      if (!data) return;

      // Navigation basée sur les données de notification
      if (data.transactionId && data.type) {
        // Transaction (dépôt, transfert, retrait, crypto)
        router.push({
          pathname: `/transaction/${data.type}/[id]` as any,
          params: { id: data.transactionId },
        });
      } else if (data.screen === 'home') {
        // KYC validée/rejetée → accueil
        router.push('/(tabs)');
      } else if (data.screen === 'history') {
        // Fallback (historique)
        router.push('/(tabs)/history');
      } else if (data.screen === 'kyc') {
        // Fallback ancien (KYC)
        router.push('/(tabs)');
      }
    });

    return () => {
      notifListenerRef.current?.remove();
      responseListenerRef.current?.remove();
    };
  }, [isAuthenticated]);

  const retry = async () => {
    setApiStatus('checking');
    if (__DEV__) {
      setShowOfflineBanner(false);
      setApiStatus('ok');
      loadToken();
      return;
    }
    const { connected, offline, backendAdmin } = await checkApiConnection();
    if (!connected) {
      setApiStatus('error');
    } else if (offline) {
      if (Platform.OS === 'web' && backendAdmin) {
        setShowOfflineBanner(true);
        setApiStatus('ok');
      } else if (Platform.OS === 'web') {
        window.location.href = 'https://goespay.io/maintenance';
      } else {
        setApiStatus('maintenance');
      }
    } else {
      setShowOfflineBanner(false);
      setApiStatus('ok');
      loadToken();
    }
  };

  useEffect(() => {
    if (!isMounted || isLoading || apiStatus !== 'ok' || !isInitialized) return;

    const inAuth = segments[0] === '(auth)';
    const currentRoute = segments[segments.length - 1];

    const isWeb = Platform.OS === 'web';

    if (!isAuthenticated && !inAuth) {
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuth && currentRoute !== 'setup-pin' && currentRoute !== 'unlock') {
      // Authentifié mais pas encore configuré PIN → setup obligatoire (sauf web)
      if (!isWeb && !isSetupDone) {
        router.replace('/(auth)/setup-pin');
      } else if (!isWeb && isLocked) {
        router.replace('/(auth)/unlock');
      } else {
        router.replace('/(tabs)');
      }
    } else if (isAuthenticated && !inAuth) {
      // Dans l'app : vérifier si locked (sauf web)
      if (!isWeb && !isSetupDone) {
        router.replace('/(auth)/setup-pin');
      } else if (!isWeb && isLocked) {
        router.replace('/(auth)/unlock');
      }
    }
  }, [isMounted, isAuthenticated, isLoading, segments, apiStatus, isInitialized, isLocked, isSetupDone]);

  // Vérification de connexion API
  if (apiStatus === 'checking' || !fontsLoaded) {
    return (
      <View style={styles.loading}>
        <Image source={require('../assets/picto.png')} style={{ width: 80, height: 80 }} resizeMode="contain" />
        <ActivityIndicator size="large" color={Colors.secondary} style={{ marginTop: Spacing.lg }} />
        <StatusBar style="light" />
      </View>
    );
  }

  if (apiStatus === 'maintenance') {
    return <MaintenanceScreen onRetry={retry} />;
  }

  if (apiStatus === 'error') {
    return (
      <View style={styles.loading}>
        <FontAwesome6 name="wifi" size={48} color={Colors.error} style={{ marginBottom: Spacing.lg }} />
        <Text style={styles.errorTitle}>{t('layout.connectionError')}</Text>
        <Text style={styles.errorText}>
          Impossible de joindre le serveur.{'\n'}
          Vérifiez votre connexion internet.
        </Text>
        {__DEV__ && (
          <Text style={styles.debugText}>{API_BASE_URL}</Text>
        )}
        <TouchableOpacity style={styles.retryBtn} onPress={retry}>
          <FontAwesome6 name="rotate-right" size={16} color={Colors.white} />
          <Text style={styles.retryText}>{t('layout.retry')}</Text>
        </TouchableOpacity>
        <StatusBar style="light" />
      </View>
    );
  }

  // Chargement du token
  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={Colors.secondary} />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      {showOfflineBanner && Platform.OS === 'web' && <OfflineAdminBanner />}
      <Stack screenOptions={{ headerShown: false }} />
      <CustomAlert />
    </>
  );
}

function OfflineAdminBanner() {
  return (
    <View style={bannerStyles.container}>
      <FontAwesome6 name="screwdriver-wrench" size={14} color="#fff" style={{ marginRight: 8 }} />
      <Text style={bannerStyles.text}>
        Site en maintenance — accès admin actif. Les utilisateurs standards sont redirigés.
      </Text>
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#b45309',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  text: {
    color: '#fff',
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
  },
});

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  loadingText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    marginTop: Spacing.md,
  },
  errorTitle: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    marginBottom: Spacing.sm,
  },
  errorText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
  },
  debugText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: Spacing.md,
    fontFamily: 'monospace',
    opacity: 0.5,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 50,
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  retryText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
  },
});

function MaintenanceScreen({ onRetry }: { onRetry: () => void }) {
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const handleRetry = async () => {
    setRetrying(true);
    await onRetry();
    setRetrying(false);
  };

  return (
    <View style={mStyles.container}>
      <StatusBar style="light" />

      {/* Cercles décoratifs */}
      <View style={[mStyles.circle, mStyles.circleTop]} />
      <View style={[mStyles.circle, mStyles.circleBottom]} />

      <View style={mStyles.content}>
        {/* Logo */}
        <Image
          source={require('../assets/logo_min.png')}
          style={mStyles.logo}
          resizeMode="contain"
        />

        {/* Icône animée */}
        <Animated.View style={[mStyles.iconWrapper, { transform: [{ scale: pulseAnim }] }]}>
          <FontAwesome6 name="screwdriver-wrench" size={38} color="#fff" />
        </Animated.View>

        {/* Textes */}
        <Text style={mStyles.title}>Maintenance en cours</Text>
        <Text style={mStyles.subtitle}>
          Nous améliorons GoesPay pour vous offrir{'\n'}une meilleure expérience.
        </Text>
        <Text style={mStyles.hint}>
          L'application sera de nouveau disponible{'\n'}très prochainement. Merci de votre patience 🙏
        </Text>

        {/* Bouton réessayer */}
        <TouchableOpacity
          style={[mStyles.retryBtn, retrying && { opacity: 0.7 }]}
          onPress={handleRetry}
          disabled={retrying}
          activeOpacity={0.8}
        >
          {retrying
            ? <ActivityIndicator size="small" color="#fff" />
            : <FontAwesome6 name="rotate-right" size={15} color="#fff" />
          }
          <Text style={mStyles.retryText}>
            {retrying ? 'Vérification...' : 'Réessayer'}
          </Text>
        </TouchableOpacity>

        <Text style={mStyles.autoCheck}>Vérification automatique toutes les 30s</Text>
      </View>
    </View>
  );
}

const PRIMARY = Colors.primary;
const mStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PRIMARY,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  circle: {
    position: 'absolute',
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  circleTop: {
    width: 340,
    height: 340,
    top: -120,
    right: -100,
  },
  circleBottom: {
    width: 280,
    height: 280,
    bottom: -100,
    left: -80,
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  logo: {
    width: 120,
    height: 40,
    marginBottom: 36,
    tintColor: '#fff',
  },
  iconWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontFamily: Fonts.bold,
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 15,
    fontFamily: Fonts.medium,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 12,
  },
  hint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 36,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    paddingHorizontal: 28,
    paddingVertical: 13,
    borderRadius: 50,
    marginBottom: 16,
  },
  retryText: {
    color: '#fff',
    fontSize: 15,
    fontFamily: Fonts.semiBold,
  },
  autoCheck: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontFamily: Fonts.regular,
  },
});
