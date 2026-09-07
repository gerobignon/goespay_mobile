import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearPinAttempts,
  formatPinLockDelay,
  getPinAttemptState,
  registerPinFailure,
} from '../services/pinAttemptGuard';

/**
 * Verrou d'essais du PIN, côté écran.
 *
 * Lit le compteur persistant au montage, décompte la temporisation en cours
 * seconde par seconde, et expose l'enregistrement d'un échec. Deux écrans s'en
 * servent : le déverrouillage de l'application et la fenêtre de confirmation
 * d'un geste sensible. Ils partagent le même compteur.
 */
export function usePinLock(active: boolean = true) {
  const [attempts, setAttempts] = useState(0);
  const [remainingMs, setRemainingMs] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const sync = useCallback(async () => {
    const state = await getPinAttemptState();
    setAttempts(state.attempts);
    setRemainingMs(Math.max(0, state.lockedUntil - Date.now()));
  }, []);

  useEffect(() => {
    if (active) sync();
  }, [active, sync]);

  // Un seul intervalle, armé tant qu'il reste du temps à écouler.
  useEffect(() => {
    if (!active || remainingMs <= 0) {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
      return;
    }
    if (timer.current) return;
    timer.current = setInterval(() => {
      setRemainingMs((ms) => {
        const next = ms - 1000;
        if (next > 0) return next;
        if (timer.current) {
          clearInterval(timer.current);
          timer.current = null;
        }
        return 0;
      });
    }, 1000);
    return () => {
      if (timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    };
  }, [active, remainingMs > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Enregistre un échec et renvoie le nombre total d'échecs consécutifs. */
  const noteFailure = useCallback(async () => {
    const state = await registerPinFailure();
    setAttempts(state.attempts);
    setRemainingMs(Math.max(0, state.lockedUntil - Date.now()));
    return state;
  }, []);

  const reset = useCallback(async () => {
    await clearPinAttempts();
    setAttempts(0);
    setRemainingMs(0);
  }, []);

  return {
    attempts,
    remainingMs,
    locked: remainingMs > 0,
    delayLabel: formatPinLockDelay(remainingMs),
    noteFailure,
    reset,
    sync,
  };
}
