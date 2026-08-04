import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

/** Hauteur du viewport RÉELLEMENT visible sur web (visualViewport → clavier pris en compte). */
function webViewportHeight(): number | undefined {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
  const vv = (window as any).visualViewport;
  return Math.round(vv?.height || window.innerHeight);
}

/**
 * En PWA standalone iOS, le document est calé sur `screen.height` (cf. app/_layout.tsx),
 * plus haut que la webview : une feuille « 94% » ancrée en bas démarre trop bas
 * (grosse marge en haut) et déborde sous le pli. On borne donc l'overlay à la
 * hauteur visible. Retourne `undefined` sur natif (flex: 1 suffit).
 */
export function useSheetViewport(): number | undefined {
  const [height, setHeight] = useState<number | undefined>(webViewportHeight);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return;
    const update = () => setHeight(webViewportHeight());
    const vv = (window as any).visualViewport;
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    vv?.addEventListener('resize', update);
    update();
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
      vv?.removeEventListener('resize', update);
    };
  }, []);

  return Platform.OS === 'web' ? height : undefined;
}

/** Hauteur de la feuille : plein écran sur web (viewport borné), ratio sur natif. */
export function sheetHeight(ratio: '94%' | '88%' | '82%'): '100%' | '94%' | '88%' | '82%' {
  return Platform.OS === 'web' ? '100%' : ratio;
}
