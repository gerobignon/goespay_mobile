import { Platform } from 'react-native';
import { SafeStorage } from './storage';
import * as LocalAuthentication from 'expo-local-authentication';
import { clearWebauthn } from './webauthnService';

const KEYS = {
  EMAIL: 'pin_email',
  PASSWORD: 'pin_password',
  PIN: 'pin_code',
  METHOD: 'pin_method', // 'pin' | 'biometric'
  PIN_SET: 'pin_is_set',
};

const isWeb = Platform.OS === 'web';

// ─── Credentials ──────────────────────────────────────────────────────────────

export async function saveCredentials(email: string, password: string) {
  await SafeStorage.setItem(KEYS.EMAIL, email);
  // Sur web, SafeStorage = localStorage : lisible par n'importe quel script de
  // la page. Le mot de passe n'y est donc jamais écrit — il ne sert de toute
  // façon qu'au repli de la biométrie, absente du web.
  if (isWeb) {
    await SafeStorage.removeItem(KEYS.PASSWORD);
    return;
  }
  await SafeStorage.setItem(KEYS.PASSWORD, password);
}

export async function getCredentials(): Promise<{ email: string; password: string } | null> {
  const email = await SafeStorage.getItem(KEYS.EMAIL);
  const password = await SafeStorage.getItem(KEYS.PASSWORD);
  if (!email || !password) return null;
  return { email, password };
}

export async function clearCredentials() {
  await SafeStorage.removeItem(KEYS.EMAIL);
  await SafeStorage.removeItem(KEYS.PASSWORD);
}

// ─── PIN ──────────────────────────────────────────────────────────────────────

// Le PIN est dérivé avant stockage dès que WebCrypto est disponible (web en
// contexte sécurisé : HTTPS et localhost). Format :
//   v2$<selHex>$<itérations>$<hashHex>   PBKDF2-SHA256
//   v1$<selHex>$<hashHex>                SHA-256 simple (lecture seule, migré)
// Sur natif, WebCrypto n'existe pas : le PIN reste en clair mais dans
// expo-secure-store, chiffré par l'OS. Tous les formats sont acceptés en
// lecture, ce qui rend la migration transparente.
//
// PORTÉE : un PIN à 4 chiffres n'a que 10 000 combinaisons. PBKDF2 rend un
// bruteforce hors-ligne coûteux, il ne le rend pas impossible — face à un
// script qui lit déjà le stockage, c'est un ralentisseur, pas une garantie.
const PIN_HASH_V1 = 'v1$';
const PIN_HASH_V2 = 'v2$';
const PBKDF2_ITERATIONS = 210000; // recommandation OWASP 2023 pour PBKDF2-SHA256

function subtleCrypto(): SubtleCrypto | null {
  const g = globalThis as any;
  return g?.crypto?.subtle && typeof g.crypto.getRandomValues === 'function' ? g.crypto.subtle : null;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** v1 — SHA-256 en un tour. Conservé pour relire les PIN déjà enregistrés. */
async function digestPinV1(pin: string, saltHex: string): Promise<string | null> {
  const subtle = subtleCrypto();
  if (!subtle) return null;
  const data = new TextEncoder().encode(`${saltHex}:${pin}`);
  const digest = await subtle.digest('SHA-256', data);
  return toHex(new Uint8Array(digest));
}

async function digestPinV2(pin: string, saltHex: string, iterations: number): Promise<string | null> {
  const subtle = subtleCrypto();
  if (!subtle) return null;
  const key = await subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const salt = new TextEncoder().encode(saltHex);
  const bits = await subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
    key,
    256,
  );
  return toHex(new Uint8Array(bits));
}

async function hashPin(pin: string): Promise<string | null> {
  const subtle = subtleCrypto();
  if (!subtle) return null;
  const salt = new Uint8Array(16);
  (globalThis as any).crypto.getRandomValues(salt);
  const saltHex = toHex(salt);
  const hash = await digestPinV2(pin, saltHex, PBKDF2_ITERATIONS);
  if (!hash) return null;
  return `${PIN_HASH_V2}${saltHex}$${PBKDF2_ITERATIONS}$${hash}`;
}

export async function savePin(pin: string) {
  const hashed = await hashPin(pin);
  await SafeStorage.setItem(KEYS.PIN, hashed ?? pin);
  await SafeStorage.setItem(KEYS.PIN_SET, '1');
}

export async function verifyPin(input: string): Promise<boolean> {
  const stored = await SafeStorage.getItem(KEYS.PIN);
  if (!stored) return false;

  if (stored.startsWith(PIN_HASH_V2)) {
    const [, saltHex, iterations, hash] = stored.split('$');
    if (!saltHex || !iterations || !hash) return false;
    const candidate = await digestPinV2(input, saltHex, Number(iterations));
    return candidate === hash;
  }

  // v1 : on revérifie avec l'ancien schéma, puis on réécrit en v2.
  if (stored.startsWith(PIN_HASH_V1)) {
    const [, saltHex, hash] = stored.split('$');
    if (!saltHex || !hash) return false;
    if ((await digestPinV1(input, saltHex)) !== hash) return false;
    const upgraded = await hashPin(input);
    if (upgraded) await SafeStorage.setItem(KEYS.PIN, upgraded);
    return true;
  }

  // PIN enregistré en clair (natif, ou web avant cette version).
  if (stored !== input) return false;
  const upgraded = await hashPin(input);
  if (upgraded) await SafeStorage.setItem(KEYS.PIN, upgraded);
  return true;
}

export async function clearPin() {
  await SafeStorage.removeItem(KEYS.PIN);
  await SafeStorage.removeItem(KEYS.PIN_SET);
}

export async function isPinSet(): Promise<boolean> {
  const val = await SafeStorage.getItem(KEYS.PIN_SET);
  return val === '1';
}

// ─── Méthode (pin | biometric | webauthn) ─────────────────────────────────────

// `biometric` = expo-local-authentication (natif) ; `webauthn` = Face ID /
// Touch ID / Hello / clé de sécurité côté web (voir webauthnService).
export type LockMethod = 'pin' | 'biometric' | 'webauthn' | null;

export async function getLockMethod(): Promise<LockMethod> {
  const val = await SafeStorage.getItem(KEYS.METHOD);
  if (val === 'pin' || val === 'biometric' || val === 'webauthn') return val;
  return null;
}

export async function setLockMethod(method: LockMethod) {
  if (method === null) {
    await SafeStorage.removeItem(KEYS.METHOD);
  } else {
    await SafeStorage.setItem(KEYS.METHOD, method);
  }
}

// ─── Biométrie ────────────────────────────────────────────────────────────────

export async function isBiometricAvailable(): Promise<boolean> {
  // Pas d'équivalent sur web : expo-local-authentication n'y est pas
  // implémenté (l'alternative serait WebAuthn, hors périmètre).
  if (isWeb) return false;
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    if (!compatible) return false;
    return await LocalAuthentication.isEnrolledAsync();
  } catch {
    return false;
  }
}

export async function authenticateWithBiometric(): Promise<boolean> {
  // Appelée depuis un effet au montage de l'écran de déverrouillage : une
  // exception non rattrapée (capteur indisponible, empreinte retirée depuis)
  // remonterait en erreur de rendu au lieu d'un simple échec.
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Déverrouillez GoesPay',
      fallbackLabel: 'Utiliser le PIN',
      disableDeviceFallback: false,
    });
    return result.success;
  } catch {
    return false;
  }
}

// ─── Réinitialisation complète ───────────────────────────────────────────────

export async function clearAllSecureData() {
  await Promise.all([
    SafeStorage.removeItem(KEYS.EMAIL),
    SafeStorage.removeItem(KEYS.PASSWORD),
    SafeStorage.removeItem(KEYS.PIN),
    SafeStorage.removeItem(KEYS.METHOD),
    SafeStorage.removeItem(KEYS.PIN_SET),
    clearWebauthn(),
  ]);
}
