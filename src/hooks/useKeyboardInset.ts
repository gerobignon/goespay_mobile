import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

export interface KeyboardViewport {
  /** Hauteur occupée par le clavier, en points (natif). */
  keyboard: number;
  /** Hauteur réellement visible — web uniquement, null ailleurs. */
  viewportHeight: number | null;
}

/**
 * Place occupée par le clavier, et hauteur réellement visible sur le web.
 *
 * Natif : `KeyboardAvoidingView` ne convient pas en edge-to-edge (Android 15),
 * où le système ne redimensionne plus la fenêtre mais la pousse — l'en-tête
 * sortait de l'écran. On mesure donc le clavier et l'écran lui réserve la place.
 *
 * Web : le clavier virtuel ne change QUE le viewport visuel ; le document, lui,
 * garde sa hauteur. Réserver un espace en bas ne sert alors à rien — la barre
 * de saisie reste au bas du document, c'est-à-dire sous le clavier, et elle
 * suit le défilement de la page. D'où `viewportHeight` : l'écran s'y cale en
 * position fixe et cesse de dépendre du document.
 */
export function useKeyboardInset(): KeyboardViewport {
  const [keyboard, setKeyboard] = useState(0);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const vv = typeof window !== 'undefined' ? window.visualViewport : undefined;
      if (!vv) return;

      const update = () => {
        setViewportHeight(vv.height);
        const covered = window.innerHeight - vv.height - vv.offsetTop;
        setKeyboard(covered > 60 ? covered : 0);
        // Le navigateur fait défiler la page pour montrer le champ ; l'écran
        // étant calé sur le viewport visuel, ce défilement n'a plus lieu d'être
        // et ne ferait que décrocher la barre de saisie.
        if (window.scrollY !== 0) window.scrollTo(0, 0);
      };

      vv.addEventListener('resize', update);
      vv.addEventListener('scroll', update);
      update();

      return () => {
        vv.removeEventListener('resize', update);
        vv.removeEventListener('scroll', update);
      };
    }

    // iOS annonce le clavier avant l'animation, Android une fois posé.
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const show = Keyboard.addListener(showEvent, (e) => setKeyboard(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(hideEvent, () => setKeyboard(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return { keyboard, viewportHeight };
}
