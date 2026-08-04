import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/**
 * Pastille de décompte sur l'icône de l'app.
 *  - Web/PWA : Badging API (`navigator.setAppBadge`) — visible sur l'icône de la
 *    PWA installée (iOS 16.4+, Android/Chrome, macOS). Ignoré si non supportée.
 *  - Natif : badge d'icône iOS/Android via expo-notifications.
 */
export async function setAppBadgeCount(count: number): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      const nav: any = typeof navigator !== 'undefined' ? navigator : null;
      if (!nav?.setAppBadge) return;
      if (count > 0) await nav.setAppBadge(count);
      else await nav.clearAppBadge?.();
      return;
    }
    await Notifications.setBadgeCountAsync(count);
  } catch {
    // Badging non supportée / permission absente : sans effet, jamais bloquant.
  }
}

/** Ferme les notifications web encore affichées (le décompte repart de zéro). */
export async function clearWebNotifications(): Promise<void> {
  if (Platform.OS !== 'web') return;
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    const list = (await reg?.getNotifications()) || [];
    list.forEach((n) => n.close());
  } catch {
    // ignore
  }
}
