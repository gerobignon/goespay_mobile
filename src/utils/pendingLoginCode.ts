import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Connexion par code email en cours, gardée sur disque.
 *
 * Pour lire son code, le client quitte l'app vers sa messagerie. Au retour,
 * l'app a souvent été relancée : Android tue le processus pour libérer de la
 * mémoire, la PWA iOS installée recharge sa page. L'écran de connexion
 * repartait alors sur la saisie de l'email, le client redemandait un code, ce
 * qui annule le précédent côté serveur, repartait le lire, et bouclait.
 *
 * On range donc l'adresse et l'heure d'envoi, et l'écran de connexion reprend
 * directement sur la saisie du code tant que celui-ci est encore valide.
 */
const KEY = 'goespay_pending_login_code';

/** Durée de vie du code côté serveur (goesSendLoginCode : 10 minutes). */
const CODE_TTL_MS = 10 * 60 * 1000;

interface PendingLoginCode {
  email: string;
  sentAt: number;
}

export async function savePendingLoginCode(email: string): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify({ email, sentAt: Date.now() }));
  } catch {
    // Sans stockage, on retombe sur le comportement d'avant : rien de bloquant.
  }
}

/** L'adresse dont le code est encore valide, ou null. */
export async function readPendingLoginCode(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const pending = JSON.parse(raw) as PendingLoginCode;
    if (!pending?.email || Date.now() - pending.sentAt > CODE_TTL_MS) {
      await AsyncStorage.removeItem(KEY);
      return null;
    }
    return pending.email;
  } catch {
    return null;
  }
}

export async function clearPendingLoginCode(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // rien à faire
  }
}
