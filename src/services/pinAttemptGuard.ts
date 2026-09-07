import { SafeStorage } from './storage';

/**
 * Compteur d'essais de PIN, persistant et partagé.
 *
 * Le compteur vivait dans un `useState` : il suffisait de recharger la page ou
 * de tuer l'application pour repartir de zéro, ce qui laissait essayer les
 * 10 000 combinaisons d'un PIN à 4 chiffres sans jamais rencontrer de mur. Il
 * est désormais écrit dans le stockage local (SecureStore sur natif,
 * localStorage sur web) et lu par les deux points d'entrée du verrou : l'écran
 * de déverrouillage et la fenêtre de confirmation. Un échec sur l'un compte
 * pour l'autre.
 *
 * Temporisation progressive à partir du 3e échec : 30 s, 1 min, puis 5 min.
 * Une saisie correcte remet tout à zéro.
 *
 * PORTÉE : c'est un ralentisseur côté client. Un attaquant qui contrôle déjà le
 * stockage peut l'effacer ; le PIN dérivé (PBKDF2) reste la vraie défense.
 */

const KEY = 'pin_attempts';

/** Délai imposé APRÈS le n-ième échec, en millisecondes. */
const DELAYS_MS: Record<number, number> = {
  3: 30 * 1000,
  4: 60 * 1000,
  5: 5 * 60 * 1000,
};
const MAX_DELAY_MS = 5 * 60 * 1000;

export interface PinAttemptState {
  /** Nombre d'échecs consécutifs enregistrés. */
  attempts: number;
  /** Horodatage (ms) jusqu'auquel toute saisie est refusée, 0 si libre. */
  lockedUntil: number;
}

const EMPTY: PinAttemptState = { attempts: 0, lockedUntil: 0 };

async function write(state: PinAttemptState) {
  await SafeStorage.setItem(KEY, JSON.stringify(state));
}

/** État courant du compteur. */
export async function getPinAttemptState(): Promise<PinAttemptState> {
  try {
    const raw = await SafeStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<PinAttemptState>;
    const attempts = Number(parsed?.attempts) || 0;
    const lockedUntil = Number(parsed?.lockedUntil) || 0;
    return { attempts, lockedUntil };
  } catch {
    return EMPTY;
  }
}

/** Millisecondes restantes avant de pouvoir réessayer (0 = libre). */
export async function pinLockRemainingMs(): Promise<number> {
  const { lockedUntil } = await getPinAttemptState();
  return Math.max(0, lockedUntil - Date.now());
}

/** Enregistre un échec et renvoie le nouvel état (avec sa temporisation). */
export async function registerPinFailure(): Promise<PinAttemptState> {
  const current = await getPinAttemptState();
  const attempts = current.attempts + 1;
  const delay = DELAYS_MS[attempts] ?? (attempts > 5 ? MAX_DELAY_MS : 0);
  const state: PinAttemptState = {
    attempts,
    lockedUntil: delay ? Date.now() + delay : 0,
  };
  await write(state);
  return state;
}

/** Saisie correcte (ou verrou réinitialisé) : on repart de zéro. */
export async function clearPinAttempts() {
  await SafeStorage.removeItem(KEY);
}

/** Libellé « 1 min 30 s » pour l'attente restante. */
export function formatPinLockDelay(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  if (minutes && seconds) return `${minutes} min ${seconds} s`;
  if (minutes) return `${minutes} min`;
  return `${seconds} s`;
}
