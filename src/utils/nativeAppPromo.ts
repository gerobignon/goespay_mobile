import { Platform } from 'react-native';

/**
 * Promotion des applications natives (Google Play, App Store) depuis le web
 * (PWA / navigateur). Le web ne pousse plus l'installation de la PWA.
 */

export const ANDROID_PACKAGE = 'io.goespay.app';

export const ANDROID_STORE_URL =
  `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}` +
  '&referrer=utm_source%3Dweb%26utm_medium%3Dbanner%26utm_campaign%3Dapp_banner';

export const IOS_APP_ID = '6810420540';

export const IOS_STORE_URL = `https://apps.apple.com/app/goespay/id${IOS_APP_ID}`;

export type NativeStore = 'play' | 'appstore';

export function isWeb(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

export function isAndroidWeb(): boolean {
  if (!isWeb()) return false;
  return /Android/.test(navigator.userAgent || '');
}

export function isIOSWeb(): boolean {
  if (!isWeb()) return false;
  const ua = navigator.userAgent || '';
  // iPadOS se déclare « Macintosh » : on le reconnaît à l'écran tactile.
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
}

/** Store de l'appareil mobile courant, null sur ordinateur. */
export function mobileStore(): NativeStore | null {
  if (isAndroidWeb()) return 'play';
  if (isIOSWeb()) return 'appstore';
  return null;
}

export function isStandaloneWeb(): boolean {
  if (!isWeb()) return false;
  const mq = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  // @ts-ignore : propriété Safari iOS
  return !!mq || (navigator as any).standalone === true;
}

/**
 * Vrai quand l'application native est déjà installée sur l'appareil.
 * Repose sur getInstalledRelatedApps (Chrome Android), qui exige à la fois
 * `related_applications` dans le manifest et le fichier
 * /.well-known/assetlinks.json servi par le domaine. Sans ces deux pièces,
 * la réponse est vide : on considère alors l'app comme non installée.
 */
export async function hasNativeAppInstalled(): Promise<boolean> {
  if (!isWeb()) return false;
  const getInstalled = (navigator as any)?.getInstalledRelatedApps;
  if (typeof getInstalled !== 'function') return false;
  try {
    const apps = await getInstalled.call(navigator);
    return Array.isArray(apps) && apps.some((a: any) => a?.platform === 'play' && a?.id === ANDROID_PACKAGE);
  } catch {
    return false;
  }
}

/** Ouvre la fiche du store (app du store si présente, sinon navigateur). */
export function openStore(store: NativeStore): void {
  if (!isWeb()) return;
  const url = store === 'play' ? ANDROID_STORE_URL : IOS_STORE_URL;
  try {
    const win = window.open(url, '_blank', 'noopener');
    if (!win) window.location.href = url;
  } catch {
    window.location.href = url;
  }
}
