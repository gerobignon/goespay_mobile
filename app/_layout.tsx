import React, { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Image, ActivityIndicator, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useFonts, Quicksand_400Regular, Quicksand_500Medium, Quicksand_600SemiBold, Quicksand_700Bold } from '@expo-google-fonts/quicksand';import * as Notifications from 'expo-notifications';
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
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error'>('ok');
  const [isMounted, setIsMounted] = useState(false);
  const notifListenerRef = useRef<Notifications.Subscription | null>(null);
  const responseListenerRef = useRef<Notifications.Subscription | null>(null);

  const [fontsLoaded] = useFonts({
    Quicksand_400Regular,
    Quicksand_500Medium,
    Quicksand_600SemiBold,
    Quicksand_700Bold,
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
  }, []);

  // Enregistrement des notifications push quand l'utilisateur est authentifié
  useEffect(() => {
    if (!isAuthenticated) return;

    registerForPushNotifications()
      .then((token) => {
        if (token) sendPushTokenToServer(token);
      })
      .catch((e) => console.warn('[Notifications] registerForPushNotifications error:', e));

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
    const connected = await checkApiConnection();
    if (connected) {
      setApiStatus('ok');
      loadToken();
    } else {
      setApiStatus('error');
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
      <Stack screenOptions={{ headerShown: false }} />
      <CustomAlert />
    </>
  );
}

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
