import { SafeStorage } from './storage';
import * as LocalAuthentication from 'expo-local-authentication';

const KEYS = {
  EMAIL: 'pin_email',
  PASSWORD: 'pin_password',
  PIN: 'pin_code',
  METHOD: 'pin_method', // 'pin' | 'biometric'
  PIN_SET: 'pin_is_set',
};

// ─── Credentials ──────────────────────────────────────────────────────────────

export async function saveCredentials(email: string, password: string) {
  await SafeStorage.setItem(KEYS.EMAIL, email);
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

export async function savePin(pin: string) {
  await SafeStorage.setItem(KEYS.PIN, pin);
  await SafeStorage.setItem(KEYS.PIN_SET, '1');
}

export async function verifyPin(input: string): Promise<boolean> {
  const stored = await SafeStorage.getItem(KEYS.PIN);
  return stored === input;
}

export async function clearPin() {
  await SafeStorage.removeItem(KEYS.PIN);
  await SafeStorage.removeItem(KEYS.PIN_SET);
}

export async function isPinSet(): Promise<boolean> {
  const val = await SafeStorage.getItem(KEYS.PIN_SET);
  return val === '1';
}

// ─── Méthode (pin | biometric) ────────────────────────────────────────────────

export type LockMethod = 'pin' | 'biometric' | null;

export async function getLockMethod(): Promise<LockMethod> {
  const val = await SafeStorage.getItem(KEYS.METHOD);
  if (val === 'pin' || val === 'biometric') return val;
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
  const compatible = await LocalAuthentication.hasHardwareAsync();
  if (!compatible) return false;
  const enrolled = await LocalAuthentication.isEnrolledAsync();
  return enrolled;
}

export async function authenticateWithBiometric(): Promise<boolean> {
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: 'Déverrouillez GoesPay',
    fallbackLabel: 'Utiliser le PIN',
    disableDeviceFallback: false,
  });
  return result.success;
}

// ─── Réinitialisation complète ───────────────────────────────────────────────

export async function clearAllSecureData() {
  await Promise.all([
    SafeStorage.removeItem(KEYS.EMAIL),
    SafeStorage.removeItem(KEYS.PASSWORD),
    SafeStorage.removeItem(KEYS.PIN),
    SafeStorage.removeItem(KEYS.METHOD),
    SafeStorage.removeItem(KEYS.PIN_SET),
  ]);
}
