import { useCallback, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

const MAX_KEY = 80;
const MIN_KEY = 44;
/** Rangées du pavé : chaque point retiré au diamètre rend quatre points de hauteur. */
const ROWS = 4;

/**
 * Ajuste le diamètre des touches pour que l'écran de code tienne d'un seul
 * tenant, boutons du bas compris.
 *
 * Les touches avaient une taille fixe : sur un téléphone court, ou dès qu'une
 * barre de navigation mange le bas de l'écran, « PIN oublié ? » et
 * « Déconnexion » passaient sous le bord. Plutôt que de deviner les hauteurs,
 * on compare ce que le contenu occupe à ce que la page offre, et on resserre le
 * pavé de la différence. La valeur ne fait que baisser, jamais remonter : la
 * mise en page se stabilise en une ou deux passes, sans oscillation.
 */
export function usePinPadFit() {
  const [keySize, setKeySize] = useState(MAX_KEY);
  const viewportRef = useRef(0);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
    viewportRef.current = e.nativeEvent.layout.height;
  }, []);

  const onContentSizeChange = useCallback((_w: number, contentHeight: number) => {
    const viewport = viewportRef.current;
    if (!viewport || contentHeight <= viewport) return;
    setKeySize((current) => {
      const shrunk = Math.floor(current - (contentHeight - viewport) / ROWS) - 1;
      return Math.max(MIN_KEY, Math.min(current - 1, shrunk));
    });
  }, []);

  return { keySize, onLayout, onContentSizeChange };
}
