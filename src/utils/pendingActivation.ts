import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Inscription en attente de vérification d'adresse, gardée sur disque.
 *
 * Pour lire son code ou cliquer sur le lien, le client quitte l'app vers sa
 * messagerie. Sur Android le processus est souvent tué entre-temps : au retour
 * l'app repartait sur l'écran de connexion, sans session. On garde donc
 * l'adresse et le jeton d'inscription, et l'app reprend sur l'écran
 * d'activation, qui ouvre la session dès que l'adresse est vérifiée.
 */
const KEY = 'goespay_pending_activation';

/** Durée de vie du jeton d'inscription côté serveur (48 heures). */
const TTL_MS = 48 * 60 * 60 * 1000;

export interface PendingActivation {
  email: string;
  signupToken: string;
  createdAt: number;
}

export async function savePendingActivation(email: string, signupToken: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ email, signupToken, createdAt: Date.now() }));
  } catch {
    // Sans stockage, l'activation par code reste possible.
  }
}

/** L'inscription en attente encore valable, ou null. */
export async function readPendingActivation(): Promise<PendingActivation | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as PendingActivation;
    if (!pending?.email || !pending?.signupToken || Date.now() - pending.createdAt > TTL_MS) {
      await AsyncStorage.removeItem(KEY);
      return null;
    }
    return pending;
  } catch {
    return null;
  }
}

export async function clearPendingActivation(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // rien à faire
  }
}
