import { Platform } from 'react-native';

/**
 * Promotion de l'application native Android depuis le web (PWA / navigateur).
 * iOS suivra quand la fiche App Store sera validée : ajouter ici l'App Store
 * et étendre `isPromotablePlatform()`.
 */

export const ANDROID_PACKAGE = 'io.goespay.app';

export const ANDROID_STORE_URL =
  `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}` +
  '&referrer=utm_source%3Dweb%26utm_medium%3Dbanner%26utm_campaign%3Dapp_banner';

export function isWeb(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined';
}

export function isAndroidWeb(): boolean {
  if (!isWeb()) return false;
  return /Android/.test(navigator.userAgent || '');
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

/** Ouvre la fiche Play Store (Play Store natif si présent, sinon navigateur). */
export function openAndroidStore(): void {
  if (!isWeb()) return;
  try {
    const win = window.open(ANDROID_STORE_URL, '_blank', 'noopener');
    if (!win) window.location.href = ANDROID_STORE_URL;
  } catch {
    window.location.href = ANDROID_STORE_URL;
  }
}

/**
 * Sur Android, le web ne pousse plus l'installation de la PWA : c'est
 * l'application du Play Store qui est mise en avant.
 */
export function nativeAppTakesOverPwaPrompt(): boolean {
  return isAndroidWeb();
}
