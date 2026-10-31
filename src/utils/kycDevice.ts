import { Platform } from 'react-native';

/**
 * Où le KYC peut se faire sur le web.
 *
 * Règle de Géraud (31/10/2026) : jamais de KYC sans caméra en direct. Sur
 * ordinateur, pas de KYC du tout : l'écran renvoie le client vers son téléphone
 * par un QR code. Une tablette compte comme un téléphone.
 *
 * Plusieurs indices plutôt qu'un seul, parce qu'aucun ne suffit :
 *  · l'agent utilisateur et `userAgentData.mobile` reconnaissent les téléphones
 *    et la plupart des tablettes ;
 *  · un iPad sous iPadOS 13+ se présente comme un Mac : seul l'écran tactile
 *    multipoint le trahit ;
 *  · une tablette en « version ordinateur » ne se déclare plus mobile, mais son
 *    pointeur principal reste le doigt (`pointer: coarse`). Un portable à écran
 *    tactile garde un pointeur principal fin (souris, pavé) : il reste un
 *    ordinateur.
 */
const HANDHELD_UA =
  /Android|iPhone|iPad|iPod|Mobile|Tablet|Silk|Kindle|KFAPWI|PlayBook|BlackBerry|BB10|Opera Mini|IEMobile|webOS/i;

/** Web sur téléphone ou tablette. Toujours faux en natif. */
export function isHandheldWeb(): boolean {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const uaData = (navigator as Navigator & { userAgentData?: { mobile?: boolean } }).userAgentData;
  if (uaData?.mobile === true) return true;
  if (HANDHELD_UA.test(ua)) return true;
  const touchPoints = navigator.maxTouchPoints || 0;
  if (/Macintosh/i.test(ua) && touchPoints > 1) return true;
  const coarse =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;
  return coarse && touchPoints > 0;
}

/** Web sur ordinateur : le KYC y est remplacé par le QR code vers le téléphone. */
export function isDesktopWeb(): boolean {
  return Platform.OS === 'web' && !isHandheldWeb();
}

/** Le navigateur sait-il ouvrir une caméra dans la page ? */
export function hasLiveCamera(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  );
}

/** Adresse du KYC ouverte par le QR code : l'app si elle est installée, sinon la PWA. */
const KYC_PHONE_URL = 'https://app.goespay.io/kyc';

/** Paramètres de l'écran KYC repris sur le téléphone : aucun identifiant, aucun jeton. */
export const KYC_ROUTE_PARAMS = ['level', 'edit', 'for', 'doc'] as const;

/** Ne garde que les paramètres de parcours du KYC, en chaînes non vides. */
export function pickKycParams(params: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of KYC_ROUTE_PARAMS) {
    const value = params[key];
    const s = Array.isArray(value) ? value[0] : value;
    if (typeof s === 'string' && s) out[key] = s;
  }
  return out;
}

/** Lien du QR code : même parcours (niveau, correction, pièce demandée), sans session. */
export function kycPhoneUrl(params: Record<string, unknown>): string {
  const query = new URLSearchParams(pickKycParams(params)).toString();
  return query ? `${KYC_PHONE_URL}?${query}` : KYC_PHONE_URL;
}
