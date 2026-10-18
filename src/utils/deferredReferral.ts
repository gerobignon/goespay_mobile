import { Dimensions, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Application from 'expo-application';
import api from '../services/api';

/**
 * Parrainage différé : le lien de parrainage ouvre la PWA, qui envoie vers le
 * store ; l'application installée retrouve le code au premier lancement.
 *
 * Android : le code voyage dans l'Install Referrer de Google Play
 * (`referrer=ref%3DCODE`, cf. nativeAppPromo). iOS, et repli Android : la PWA
 * a noté le clic avec l'empreinte de l'appareil, le serveur rend le code qui
 * lui correspond (cf. ReferralClicks côté backend).
 *
 * AsyncStorage et non SecureStore : le trousseau iOS survit à la
 * désinstallation, une réinstallation doit pouvoir rechercher à nouveau.
 */

const RESOLVED_KEY = 'referral:deferred:resolved';
const CODE_KEY = 'referral:deferred:code';
const CODE_RE = /^[A-Z0-9]{4,32}$/;

let pending: Promise<string | null> | null = null;

export function normalizeReferralCode(raw: unknown): string | null {
  const code = String(raw ?? '').trim().toUpperCase();
  return CODE_RE.test(code) ? code : null;
}

/** Empreinte partagée par la PWA (au clic) et l'application (au lancement). */
export function deviceFingerprint(): { platform: string; screen: string; timezone: string | null } {
  const { width, height } = Dimensions.get('screen');
  let timezone: string | null = null;
  try {
    timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    timezone = null;
  }

  let platform: string = Platform.OS;
  if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
    const ua = navigator.userAgent || '';
    platform = /Android/.test(ua)
      ? 'android'
      : /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1)
        ? 'ios'
        : 'other';
  }

  return { platform, screen: `${Math.round(width)}x${Math.round(height)}`, timezone };
}

async function fromInstallReferrer(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const referrer = await Application.getInstallReferrerAsync();
    const match = /(?:^|&)ref=([^&]+)/.exec(referrer || '');
    return match ? normalizeReferralCode(decodeURIComponent(match[1])) : null;
  } catch {
    return null;
  }
}

async function fromServer(): Promise<string | null> {
  try {
    const { data } = await api.post('/referral/deferred', deviceFingerprint());
    return normalizeReferralCode(data?.code);
  } catch {
    return null;
  }
}

/**
 * Code de parrainage de l'installation, cherché une seule fois par
 * installation. Sans effet sur le web.
 */
export function resolveDeferredReferral(): Promise<string | null> {
  if (Platform.OS === 'web') return Promise.resolve(null);
  if (pending) return pending;

  pending = (async () => {
    try {
      if (await AsyncStorage.getItem(RESOLVED_KEY)) {
        return normalizeReferralCode(await AsyncStorage.getItem(CODE_KEY));
      }
      const code = (await fromInstallReferrer()) ?? (await fromServer());
      if (code) await AsyncStorage.setItem(CODE_KEY, code);
      await AsyncStorage.setItem(RESOLVED_KEY, '1');
      return code;
    } catch {
      return null;
    }
  })();

  return pending;
}

/** Après l'inscription : le code ne doit plus pré-remplir un autre compte. */
export async function clearDeferredReferral(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CODE_KEY);
  } catch {
    // sans conséquence
  }
}

// ── Web (PWA) ─────────────────────────────────────────────────────────────

const WEB_CODE_KEY = 'goespay:referral:code';

/** Clic sur un lien de parrainage : gardé pour le lien du store et noté côté serveur. */
export function recordWebReferralClick(raw: unknown): void {
  if (Platform.OS !== 'web') return;
  const code = normalizeReferralCode(raw);
  if (!code) return;
  try {
    localStorage.setItem(WEB_CODE_KEY, code);
  } catch {
    // stockage indisponible : le serveur garde le clic
  }
  api.post('/referral/click', { code, ...deviceFingerprint() }).catch(() => {});
}

export function webReferralCode(): string | null {
  if (Platform.OS !== 'web') return null;
  try {
    return normalizeReferralCode(localStorage.getItem(WEB_CODE_KEY));
  } catch {
    return null;
  }
}
