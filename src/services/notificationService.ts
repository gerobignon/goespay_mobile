import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from './api';

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
  // Sur mobile, les notifs push ne marchent que sur un device physique (pas émulateur)
  if (Platform.OS !== 'web' && !Device.isDevice) {
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
