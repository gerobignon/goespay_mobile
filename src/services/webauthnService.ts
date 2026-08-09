import { Platform } from 'react-native';
import { SafeStorage } from './storage';

/**
 * Déverrouillage web/PWA par Face ID, Touch ID, Windows Hello ou clé de
 * sécurité, via WebAuthn — l'équivalent web de la biométrie native
 * (expo-local-authentication) déjà proposée sur mobile.
 *
 * PÉRIMÈTRE : comme la biométrie native, c'est un VERROU LOCAL, pas une
 * authentification du compte auprès du serveur. Le challenge est tiré côté
 * client et l'assertion n'est pas vérifiée par le backend : ce que ça prouve,
 * c'est que l'authentificateur de cet appareil a validé l'utilisateur — assez
 * pour rouvrir une session déjà établie, pas pour en ouvrir une nouvelle. Une
 * vraie connexion par passkey (sans mot de passe) demande des endpoints
 * d'enregistrement/vérification côté OctoberCMS.
 */

const KEYS = {
  CREDENTIAL: 'pin_webauthn_id', // identifiant de la clé, en base64url
};

const isWeb = Platform.OS === 'web';

// ─── Encodage ────────────────────────────────────────────────────────────────

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// `Uint8Array<ArrayBuffer>` (et non `ArrayBufferLike`) : c'est ce qu'attend
// `BufferSource` dans les types WebAuthn depuis TS 5.7.
function fromBase64Url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded + '='.repeat((4 - (padded.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(length));
  (globalThis as any).crypto.getRandomValues(bytes);
  return bytes;
}

function encodeUserId(userId: string | number): Uint8Array<ArrayBuffer> {
  const raw = new TextEncoder().encode(String(userId));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  bytes.set(raw);
  return bytes;
}

// ─── Disponibilité ───────────────────────────────────────────────────────────

/** WebAuthn utilisable ET l'appareil possède un authentificateur intégré. */
export async function isWebauthnAvailable(): Promise<boolean> {
  if (!isWeb || typeof window === 'undefined') return false;
  const PublicKeyCredential = (window as any).PublicKeyCredential;
  if (!PublicKeyCredential || !navigator.credentials?.create) return false;
  try {
    // Face ID / Touch ID / Hello. Une clé USB seule ne remonte pas ici, mais
    // reste utilisable : on ne restreint pas l'enregistrement à `platform`.
    if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return true;
  } catch {
    return false;
  }
}

export async function isWebauthnSet(): Promise<boolean> {
  return !!(await SafeStorage.getItem(KEYS.CREDENTIAL));
}

// ─── Enregistrement / vérification ───────────────────────────────────────────

/**
 * Enregistre une clé sur cet appareil. Doit être appelé depuis un geste
 * utilisateur (contrainte Safari/iOS). Retourne false si l'utilisateur annule.
 */
export async function registerWebauthn(userId: string | number, userLabel: string): Promise<boolean> {
  if (!(await isWebauthnAvailable())) return false;
  try {
    const credential = (await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: { id: window.location.hostname, name: 'GoesPay' },
        user: {
          id: encodeUserId(userId),
          name: userLabel,
          displayName: userLabel,
        },
        // ES256 puis RS256 : couvre les authentificateurs courants.
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    })) as PublicKeyCredential | null;

    if (!credential) return false;
    await SafeStorage.setItem(KEYS.CREDENTIAL, toBase64Url(credential.rawId));
    return true;
  } catch {
    return false;
  }
}

/** Demande la validation biométrique. Retourne false si échec ou annulation. */
export async function verifyWebauthn(): Promise<boolean> {
  const stored = await SafeStorage.getItem(KEYS.CREDENTIAL);
  if (!stored || !isWeb || typeof window === 'undefined') return false;
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        rpId: window.location.hostname,
        allowCredentials: [{ type: 'public-key', id: fromBase64Url(stored) }],
        userVerification: 'required',
        timeout: 60000,
      },
    });
    return !!assertion;
  } catch {
    return false;
  }
}

export async function clearWebauthn() {
  await SafeStorage.removeItem(KEYS.CREDENTIAL);
}
