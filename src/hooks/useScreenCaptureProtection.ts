import { useEffect } from 'react';
import { Platform } from 'react-native';

/**
 * Interdit la capture d'écran tant que l'écran est monté.
 *
 * Deux écrans montrent ce qu'on ne veut pas voir sortir : les cartes (numéro,
 * cryptogramme, expiration) et le déverrouillage (le pavé du PIN). Sur Android,
 * `preventScreenCaptureAsync` pose FLAG_SECURE : la capture est refusée et
 * l'aperçu du multitâche est noirci. Sur iOS, la capture ne peut pas être
 * bloquée, mais l'enregistrement d'écran l'est.
 *
 * `expo-screen-capture` est chargé paresseusement : le module est natif, il
 * n'existe ni sur le web ni tant que le paquet n'a pas été installé, et
 * l'absence ne doit jamais faire tomber l'écran.
 */
function loadScreenCapture(): any | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-screen-capture');
  } catch {
    return null;
  }
}

export function useScreenCaptureProtection(active: boolean = true) {
  useEffect(() => {
    if (!active) return;
    const mod = loadScreenCapture();
    if (!mod?.preventScreenCaptureAsync) return;

    let released = false;
    mod.preventScreenCaptureAsync().catch(() => {});

    return () => {
      if (released) return;
      released = true;
      mod.allowScreenCaptureAsync?.().catch(() => {});
    };
  }, [active]);
}
