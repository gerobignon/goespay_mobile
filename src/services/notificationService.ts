import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from './api';
import { useConfigStore } from '../stores/configStore';

// ── Web Push (PWA) ───────────────────────────────────────────────────────────

/** true si le navigateur supporte le Web Push (SW + PushManager + Notification). */
export function isWebPushSupported(): boolean {
  return (
    Platform.OS === 'web' &&
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    typeof window !== 'undefined' &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/** État courant de la permission de notification web ('default' | 'granted' | 'denied'). */
export function getWebNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isWebPushSupported()) return 'unsupported';
  return Notification.permission;
}

/** Convertit une clé VAPID base64 URL-safe en Uint8Array pour applicationServerKey. */
function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

/** Récupère la clé VAPID publique (store /config, sinon fetch direct). */
async function getVapidPublicKey(): Promise<string | null> {
  const fromStore = useConfigStore.getState().vapid_public_key;
  if (fromStore) return fromStore;
  try {
    const { data } = await api.get<{ vapid_public_key?: string }>('/config');
    return data?.vapid_public_key || null;
  } catch {
    return null;
  }
}

/**
 * Souscrit le navigateur au Web Push et renvoie la souscription (JSON string).
 * DOIT être appelé depuis un geste utilisateur (Safari/iOS l'exige).
 * Retourne null si non supporté, permission refusée, ou clé VAPID absente.
 */
async function registerWebPush(): Promise<string | null> {
  if (!isWebPushSupported()) return null;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return null;

  const vapidKey = await getVapidPublicKey();
  if (!vapidKey) {
    console.warn('[Notifications] Clé VAPID publique absente');
    return null;
  }

  const registration = await navigator.serviceWorker.ready;

  // Réutilise la souscription existante si présente, sinon en crée une.
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
  }

  return JSON.stringify(subscription.toJSON());
}

// Configuration du comportement des notifs quand l'app est au premier plan
// (ignoré sur Expo Go Android SDK 53+ qui ne supporte plus les push)
try { Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
}); } catch (_) { /* Expo Go Android SDK 53+ : push non supporté */ }

/**
 * Demande les permissions et récupère le push token Expo.
 * Retourne null si les permissions sont refusées ou si ce n'est pas un device physique.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Web (PWA) : flux Web Push VAPID (rien à voir avec Expo).
  if (Platform.OS === 'web') {
    return registerWebPush();
  }

  // Sur mobile, les notifs push ne marchent que sur un device physique (pas émulateur)
  if (!Device.isDevice) {
    return null;
  }

  // Vérifier les permissions existantes
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Demander si pas encore accordé
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return null;
  }

  // Récupérer le projectId depuis app.json > extra > eas > projectId
  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) {
    console.warn('[Notifications] projectId manquant dans app.json');
    return null;
  }

  // Canal Android — doit être créé AVANT d'obtenir le token
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'GoesPay',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#06b6d4',
    });
  }

  let pushToken: string;
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    pushToken = tokenData.data;
  } catch (e) {
    console.warn('[Notifications] Impossible d\'obtenir le token push:', e);
    return null;
  }

  return pushToken;
}

/**
 * Envoie le push token au backend pour le stocker.
 */
export async function sendPushTokenToServer(pushToken: string): Promise<void> {
  try {
    await api.post('/notifications/register', {
      push_token: pushToken,
      platform: Platform.OS,
    });
  } catch (error) {
    console.warn('[Notifications] Erreur envoi token:', error);
  }
}

/**
 * Écoute les notifications reçues (foreground).
 */
export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(callback);
}

/**
 * Écoute les taps sur les notifications (ouvrir l'app depuis une notif).
 */
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(callback);
}
