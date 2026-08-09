import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import { usePinStore } from '../stores/pinStore';

/**
 * Re-verrouillage du web/PWA après une absence prolongée.
 *
 * Sur natif, l'app est verrouillée au démarrage par `pinStore.initialize()` et
 * le process est tué par l'OS en arrière-plan. Sur web, l'onglet survit
 * indéfiniment : sans ce hook, le PIN ne serait demandé qu'au tout premier
 * chargement. `AppState` ne remonte rien d'exploitable sur web, on écoute donc
 * `visibilitychange` et on mesure le temps passé masqué.
 *
 * Le délai évite de verrouiller sur les allers-retours normaux (validation
 * d'un paiement Mobile Money dans une autre app, lecture d'un SMS…).
 */
const BACKGROUND_LOCK_DELAY_MS = 5 * 60 * 1000;

export function useWebAutoLock(enabled: boolean) {
  const hiddenSinceRef = useRef<number | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    if (!enabled) {
      hiddenSinceRef.current = null;
      return;
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        hiddenSinceRef.current = Date.now();
        return;
      }
      const hiddenSince = hiddenSinceRef.current;
      hiddenSinceRef.current = null;
      if (hiddenSince === null) return;
      if (Date.now() - hiddenSince < BACKGROUND_LOCK_DELAY_MS) return;

      const { isSetupDone, lock } = usePinStore.getState();
      if (isSetupDone) lock();
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [enabled]);
}
