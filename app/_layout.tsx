import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, usePathname, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Image, ActivityIndicator, StyleSheet, TouchableOpacity, Platform, Animated } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useFonts } from 'expo-font';import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../src/stores/authStore';
import { usePinStore } from '../src/stores/pinStore';
import { useMessagingLockStore } from '../src/stores/messagingLockStore';
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
import { useWebAutoLock } from '../src/hooks/useWebAutoLock';
import { API_BASE_URL } from '../src/constants/config';
import { CustomAlert } from '../src/components/CustomAlert';
import { PwaInstallBanner } from '../src/components/PwaInstallBanner';
import { NotifOptInBanner } from '../src/components/NotifOptInBanner';
import { walletService } from '../src/services/walletService';
import { showAlert } from '../src/stores/alertStore';
import { useWalletStore } from '../src/stores/walletStore';
import { ThemeProvider, useTheme } from '../src/components/ThemeProvider';
import '../src/i18n';  // initialize i18next
import { initLanguage } from '../src/i18n';
import { useTranslation } from 'react-i18next';
import {
  isWorthRemembering,
  setPendingRoute,
  takePendingRoute,
  type PendingRoute,
} from '../src/utils/pendingRoute';

/** Charge utile d'une notification push, telle qu'envoyée par le backend. */
type NotificationData = Record<string, string | undefined>;

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
  const pathname = usePathname();
  const router = useRouter();
  const [apiStatus, setApiStatus] = useState<'checking' | 'ok' | 'error' | 'maintenance'>('checking');
  const [isMounted, setIsMounted] = useState(false);
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);
  const notifListenerRef = useRef<Notifications.Subscription | null>(null);
  const responseListenerRef = useRef<Notifications.Subscription | null>(null);
  const coldStartHandledRef = useRef(false);
  // L'app est-elle en état d'AFFICHER une destination (authentifiée, verrou
  // passé, routeur monté) ? Lu depuis les écouteurs de notifications, qui sont
  // montés une fois pour toutes et ne verraient pas un état capturé.
  const canNavigateRef = useRef(false);

  // Web/PWA : re-verrouiller après un passage prolongé en arrière-plan.
  useWebAutoLock(isAuthenticated && isSetupDone);

  /**
   * Destination d'une notification, sans naviguer : fonction pure, pour que le
   * même calcul serve au tap immédiat comme à la reprise après déverrouillage.
   */
  const notificationTarget = useCallback((data?: NotificationData): PendingRoute | null => {
    if (!data) return null;

    if (data.transactionId && data.type) {
      return {
        pathname: `/transaction/${data.type}/[id]`,
        params: { id: String(data.transactionId) },
      };
    }
    if (data.screen === 'messages') {
      // Message reçu → le fil concerné, à défaut la liste.
      return { pathname: data.conversationId ? `/messages/${data.conversationId}` : '/(tabs)/support' };
    }
    if (data.screen === 'messages_requests') {
      // Invitation reçue → la file des invitations, pas la liste des fils.
      return { pathname: '/messages/requests' };
    }
    if (data.screen === 'admin_dev') {
      // Board Dev : la tâche commentée, pas seulement le board.
      return data.taskId
        ? { pathname: '/admin/kanban', params: { task: String(data.taskId) } }
        : { pathname: '/admin/kanban' };
    }
    // Carte : l'émetteur notifie l'émission et les mouvements. Sans cette
    // entrée, ces notifications retombaient sur l'accueil.
    if (data.screen === 'cards') {
      return { pathname: '/cards' };
    }
    if (data.screen === 'history') {
      return { pathname: '/(tabs)/history' };
    }
    if (data.screen === 'home' || data.screen === 'kyc') {
      return { pathname: '/(tabs)' };
    }
    return null;
  }, []);

  /** Rejoue la destination mise en attente, s'il y en a une. */
  const flushPendingRoute = useCallback(() => {
    const target = takePendingRoute();
    if (!target) return;
    router.push({ pathname: target.pathname as any, params: target.params });
  }, [router]);

  /**
   * Destination d'une notification. Partagée par les trois chemins d'arrivée :
   * tap application ouverte, tap application fermée (cold start), et clic sur
   * une notification web relayé par le service worker.
   *
   * On RANGE toujours la destination avant de tenter de l'ouvrir : si le verrou
   * PIN est en travers, la garde de navigation renverrait sur l'écran de
   * déverrouillage et le fil visé serait perdu. Elle est rejouée dès que l'app
   * est prête.
   */
  const navigateFromNotification = useCallback(
    (data?: NotificationData) => {
      const target = notificationTarget(data);
      if (!target) return;

      setPendingRoute(target);
      if (canNavigateRef.current) {
        flushPendingRoute();
      }
    },
    [notificationTarget, flushPendingRoute],
  );

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

  // RN ne propage pas fontFamily comme CSS → on force Quicksand globalement sur
  // <Text>. On patche `render` (Text est un forwardRef) et NON `defaultProps` :
  // React 19 ignore defaultProps sur les composants fonction, l'ancien patch
  // était donc sans effet et tout Text sans fontFamily explicite retombait sur
  // la police système.
  // Le style injecté passe EN PREMIER : un style local (icônes @expo/vector-icons,
  // Fonts.bold…) le surcharge toujours.
  if (fontsLoaded) {
    const RNText = Text as any;
    if (!RNText.__quicksandPatched && typeof RNText.render === 'function') {
      const original = RNText.render;
      RNText.render = function (props: any, ref: any) {
        return original.call(this, { ...props, style: [{ fontFamily: 'Quicksand_400Regular' }, props?.style] }, ref);
      };
      RNText.__quicksandPatched = true;
    }
  }

  useEffect(() => {
    setIsMounted(true);
    loadToken();
    initialize();
    // Réglage local du verrou messagerie : lu au démarrage pour que l'onglet
    // Messages s'ouvre sans temps mort, verrou armé ou non.
    useMessagingLockStore.getState().load();
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
      // Hauteur plein écran :
      // • Navigateur : 100dvh suit la barre d'URL mobile.
      // • PWA standalone iOS : la webview de layout (window.innerHeight) est plus
      //   COURTE que l'écran physique (window.screen.height) — la zone du home
      //   indicator en bas n'est pas couverte et iOS la peint avec le fond de
      //   page, d'où une bande sombre sous la tabbar. En calant la hauteur du
      //   document sur screen.height, le contenu (dégradé, tabbar…) remplit
      //   jusqu'au bas physique et la bande disparaît. (Vérifié en live sur le
      //   simulateur : innerHeight=812 vs screen=874 → 62pt non couverts.)
      //   Marche avec overflow:hidden (pas d'effet de bord clavier).
      // • PWA standalone Android : SURTOUT PAS. Là `screen.height` est PLUS GRAND
      //   que la viewport (il compte la barre de statut et la barre de navigation
      //   système). Caler le document dessus le rend plus haut que l'écran visible
      //   et, sans scroll, la tabbar du bas sort du cadre → menu invisible.
      //   → hack réservé à iOS, 100dvh partout ailleurs.
      const isStandalone =
        window.matchMedia?.('(display-mode: standalone)').matches ||
        (window.navigator as any).standalone === true;
      const ua = window.navigator.userAgent || '';
      const isIOS =
        /iPad|iPhone|iPod/.test(ua) ||
        // iPadOS 13+ se présente comme un Mac : on le distingue au tactile.
        (/Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1);
      if (isStandalone && isIOS) {
        // On cale le document sur l'écran physique : le contenu remplit alors
        // jusqu'en bas et la zone home indicator n'est plus une bande de fond.
        const root = document.getElementById('root');
        const applyHeight = () => {
          const h = window.screen.height + 'px';
          document.documentElement.style.height = h;
          document.body.style.height = h;
          if (root) root.style.height = h;
        };
        applyHeight();
        window.addEventListener('orientationchange', applyHeight);
      } else {
        const styleEl = document.createElement('style');
        styleEl.innerHTML = 'html, body, #root { height: 100dvh !important; }';
        document.head.appendChild(styleEl);
      }

      // Halo de focus du navigateur : l'anneau bleu (ou violet selon le moteur)
      // qui cerne un champ actif est dessiné par-dessus nos propres bordures et
      // jure avec le reste. Les champs de l'app ont déjà leur état focus.
      // `:focus-visible` reste intact : la navigation au clavier garde un repère.
      const focusStyle = document.createElement('style');
      focusStyle.innerHTML = [
        'input:focus, textarea:focus, select:focus, [contenteditable]:focus,',
        'input:focus-within, textarea:focus-within, div:focus, div:focus-within {',
        '  outline: none !important;',
        '  box-shadow: none !important;',
        '  -webkit-tap-highlight-color: transparent;',
        '}',
      ].join('\n');
      document.head.appendChild(focusStyle);
      // Service worker Web Push (public/sw.js) : sert UNIQUEMENT à recevoir les
      // notifications push + gérer le clic. Pas de handler fetch → n'interfère
      // pas avec l'app. La souscription elle-même se fait via l'opt-in Réglages.
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
        // Push reçu pendant que l'onglet est ouvert : le SW prévient la page →
        // on rafraîchit le board Dev (badge d'onglet + pastille d'icône).
        navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
          const payload = event.data as { type?: string; url?: string; data?: Record<string, string> } | undefined;

          // Clic sur une notification alors que la PWA est ouverte : le service
          // worker demande la navigation plutôt que de recharger l'application.
          if (payload?.type === 'navigate' && payload.url) {
            router.push(payload.url as any);
            return;
          }

          if (payload?.type !== 'push') return;
          if (payload.data?.screen === 'admin_dev') {
            import('../src/stores/devBoardStore')
              .then((m) => m.useDevBoardStore.getState().fetchBoard(true))
              .catch(() => {});
          } else if (payload.data?.screen === 'messages') {
            import('../src/stores/messagingStore')
              .then((m) => m.useMessagingStore.getState().fetchConversations(true))
              .catch(() => {});
          }
        });
      }
    }
  }, []);

  // Web : suit le thème pour la barre système mobile (chrome navigateur / PWA).
  // theme-color colore la barre d'outils + la zone de navigation/gestes.
  // Le fond html/body est aligné sur la couleur de la TABBAR (colors.background :
  // #171e2b sombre / #f0f2f5 clair), pas sur le fond chrome plus sombre : en PWA
  // standalone iOS la webview ne couvre pas la zone home indicator, et c'est ce
  // fond html/body qu'iOS y peint. En le calant sur la tabbar, la bande fusionne
  // avec elle → plus de liseré sombre sous le menu.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const bg = isDark ? '#171e2b' : '#f0f2f5';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', isDark ? '#0b0d1a' : '#3176FE');
    document.documentElement.style.backgroundColor = bg;
    document.body.style.backgroundColor = bg;
  }, [isDark]);

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
        // Sur web, on délègue la détection de connexion internet au navigateur :
        // pas d'écran d'erreur custom, on laisse les requêtes échouer naturellement.
        if (Platform.OS === 'web') {
          setApiStatus((prev) => (prev === 'checking' || prev === 'error' || prev === 'maintenance' ? 'ok' : prev));
        } else {
          setApiStatus('error');
        }
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

  // Plan C checkout hébergé : détecter ?reference=FCD-xxx (Fincra) ou KLD-xxx (Klasha
  // « Open Banking » / Payment Link) dans l'URL après redirect du checkout hébergé.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('reference');
    const isFincra = !!ref && ref.startsWith('FCD-');
    const isKlasha = !!ref && ref.startsWith('KLD-');
    if (!ref || (!isFincra && !isKlasha)) return;

    // Si on revient dans le POPUP de paiement (ouvert par l'app via window.open),
    // on ferme la fenêtre : l'onglet d'origine suit déjà le statut (polling).
    // Préférence user : fenêtre fermée plutôt que rechargement de l'app.
    if (window.opener && window.opener !== window) {
      try { window.close(); return; } catch { /* fallback : on affiche le statut */ }
    }

    // Nettoyer l'URL
    window.history.replaceState({}, '', window.location.pathname);

    // Vérifier le statut auprès du provider via le backend (Fincra ou Klasha).
    const check = isKlasha
      ? walletService.getKlashaDepositStatus(ref)
      : walletService.getFincraDepositStatus(ref);
    check
      .then((res: { status: string }) => {
        if (res.status === 'success') {
          showAlert('✅', 'Recharge créditée avec succès.');
          useWalletStore.getState().fetchBalance();
        } else if (res.status === 'fail') {
          showAlert('❌', 'La recharge a échoué.');
        } else {
          showAlert('⏳', 'Recharge en cours de vérification...');
        }
      })
      .catch(() => {});
  }, []);

  // Enregistrement des notifications push quand l'utilisateur est authentifié
  useEffect(() => {
    if (!isAuthenticated) return;

    // Natif (iOS/Android) : enregistrement automatique à la connexion.
    // Web (PWA) : la souscription exige un geste utilisateur (Safari/iOS) et se
    // fait donc via l'opt-in dans Réglages, pas ici. On tente toutefois de
    // rafraîchir une souscription DÉJÀ accordée (sans redemander la permission).
    if (Platform.OS !== 'web') {
      registerForPushNotifications()
        .then((token) => {
          if (token) sendPushTokenToServer(token);
        })
        .catch((e) => {});
    } else if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      registerForPushNotifications()
        .then((token) => {
          if (token) sendPushTokenToServer(token);
        })
        .catch(() => {});
    }

    // Listener : notif reçue en foreground (affichage auto via setNotificationHandler).
    // Notif du board Dev → on rafraîchit le board pour mettre à jour le badge de l'onglet.
    notifListenerRef.current = addNotificationReceivedListener((notification) => {
      const data = notification.request.content.data as Record<string, string> | undefined;
      if (data?.screen === 'admin_dev') {
        import('../src/stores/devBoardStore')
          .then((m) => m.useDevBoardStore.getState().fetchBoard(true))
          .catch(() => {});
      } else if (data?.screen === 'messages') {
        // Nouveau message reçu app ouverte : liste et badge se remettent à jour
        // sans attendre le prochain battement du sondage.
        import('../src/stores/messagingStore')
          .then((m) => m.useMessagingStore.getState().fetchConversations(true))
          .catch(() => {});
      }
    });

    // Listener : tap sur une notification, application déjà lancée.
    responseListenerRef.current = addNotificationResponseListener((response) => {
      navigateFromNotification(response.notification.request.content.data as NotificationData);
    });

    // Tap sur une notification alors que l'app était FERMÉE : le listener
    // ci-dessus n'est monté qu'après le démarrage, donc il ne voit jamais la
    // notification qui a lancé l'app — celle-ci s'ouvrait sur l'accueil. On
    // rejoue la dernière réponse une fois le routeur prêt.
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (!response || coldStartHandledRef.current) return;
        coldStartHandledRef.current = true;
        const data = response.notification.request.content.data as NotificationData;
        // Laisse le routeur monter ses écrans avant de pousser une destination.
        setTimeout(() => navigateFromNotification(data), 350);
      })
      .catch(() => {});

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
      // Sur web : laisser le navigateur gérer l'absence de connexion
      if (Platform.OS === 'web') {
        setShowOfflineBanner(false);
        setApiStatus('ok');
        loadToken();
      } else {
        setApiStatus('error');
      }
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
    if (!isMounted || isLoading || apiStatus !== 'ok' || !isInitialized) {
      canNavigateRef.current = false;
      return;
    }

    const inAuth = segments[0] === '(auth)';
    const currentRoute = segments[segments.length - 1];

    const isWeb = Platform.OS === 'web';
    // Le verrou est obligatoire sur natif : tant qu'il n'est pas configuré, on
    // pousse vers setup-pin. Sur web il reste OPTIONNEL (activé depuis Réglages
    // › Sécurité) — on ne force personne, mais s'il est configuré il est
    // demandé comme sur mobile.
    const needsSetup = !isWeb && !isSetupDone;
    const needsUnlock = isSetupDone && isLocked;

    canNavigateRef.current = isAuthenticated && !needsSetup && !needsUnlock;

    if (!isAuthenticated && !inAuth) {
      // Déconnexion : une destination en attente appartenait à la session
      // précédente, elle n'a plus rien à ouvrir.
      setPendingRoute(null);
      router.replace('/(auth)/login');
    } else if (isAuthenticated && inAuth && currentRoute !== 'setup-pin' && currentRoute !== 'unlock') {
      if (needsSetup) {
        router.replace('/(auth)/setup-pin');
      } else if (needsUnlock) {
        router.replace('/(auth)/unlock');
      } else {
        router.replace('/(tabs)');
      }
    } else if (isAuthenticated && !inAuth) {
      // Dans l'app : vérifier si locked
      if (needsSetup || needsUnlock) {
        // L'écran demandé est perdu par le `replace` qui suit : on le range pour
        // le rejouer après déverrouillage. C'est ce qui manquait quand une
        // notification, ou un lien ouvert dans la PWA, tombait sur un compte
        // verrouillé : le client arrivait sur l'accueil, jamais sur son fil.
        if (isWorthRemembering(pathname)) {
          setPendingRoute({ pathname });
        }
        router.replace(needsSetup ? '/(auth)/setup-pin' : '/(auth)/unlock');
      } else {
        // Verrou passé : la destination mise de côté peut enfin s'ouvrir.
        flushPendingRoute();
      }
    } else if (canNavigateRef.current) {
      flushPendingRoute();
    }
  }, [isMounted, isAuthenticated, isLoading, segments, pathname, apiStatus, isInitialized, isLocked, isSetupDone, flushPendingRoute]);

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
          Impossible de joindre GoesPay pour le moment.{'\n'}
          Vérifiez votre connexion ou réessayez dans un instant.
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
      <NotifOptInBanner />
      <PwaInstallBanner />
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
