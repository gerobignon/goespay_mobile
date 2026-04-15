import * as SecureStore from 'expo-secure-store';
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
  await SecureStore.setItemAsync(KEYS.EMAIL, email);
  await SecureStore.setItemAsync(KEYS.PASSWORD, password);
}

export async function getCredentials(): Promise<{ email: string; password: string } | null> {
  const email = await SecureStore.getItemAsync(KEYS.EMAIL);
  const password = await SecureStore.getItemAsync(KEYS.PASSWORD);
  if (!email || !password) return null;
  return { email, password };
}

export async function clearCredentials() {
  await SecureStore.deleteItemAsync(KEYS.EMAIL);
  await SecureStore.deleteItemAsync(KEYS.PASSWORD);
}

// ─── PIN ──────────────────────────────────────────────────────────────────────

export async function savePin(pin: string) {
  await SecureStore.setItemAsync(KEYS.PIN, pin);
  await SecureStore.setItemAsync(KEYS.PIN_SET, '1');
}

export async function verifyPin(input: string): Promise<boolean> {
  const stored = await SecureStore.getItemAsync(KEYS.PIN);
  return stored === input;
}

export async function clearPin() {
  await SecureStore.deleteItemAsync(KEYS.PIN);
  await SecureStore.deleteItemAsync(KEYS.PIN_SET);
}

export async function isPinSet(): Promise<boolean> {
  const val = await SecureStore.getItemAsync(KEYS.PIN_SET);
  return val === '1';
}

// ─── Méthode (pin | biometric) ────────────────────────────────────────────────

export type LockMethod = 'pin' | 'biometric' | null;

export async function getLockMethod(): Promise<LockMethod> {
  const val = await SecureStore.getItemAsync(KEYS.METHOD);
  if (val === 'pin' || val === 'biometric') return val;
  return null;
}

export async function setLockMethod(method: LockMethod) {
  if (method === null) {
    await SecureStore.deleteItemAsync(KEYS.METHOD);
  } else {
    await SecureStore.setItemAsync(KEYS.METHOD, method);
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
    SecureStore.deleteItemAsync(KEYS.EMAIL),
    SecureStore.deleteItemAsync(KEYS.PASSWORD),
    SecureStore.deleteItemAsync(KEYS.PIN),
    SecureStore.deleteItemAsync(KEYS.METHOD),
    SecureStore.deleteItemAsync(KEYS.PIN_SET),
  ]);
}
