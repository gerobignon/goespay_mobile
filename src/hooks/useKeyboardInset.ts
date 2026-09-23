import { useEffect, useRef, useState } from 'react';
import { Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface KeyboardViewport {
  /** Hauteur occupée par le clavier, en points (natif). */
  keyboard: number;
  /** Hauteur réellement visible : web uniquement, null ailleurs. */
  viewportHeight: number | null;
  /**
   * Décalage du viewport visible par rapport au viewport de mise en page,
   * web uniquement, 0 ailleurs.
   *
   * iOS ne se contente pas de rétrécir la zone visible quand le clavier monte :
   * il la FAIT GLISSER vers le bas pour amener le champ au-dessus des touches,
   * sans toucher à `scrollY`. Un élément en `position: fixed` reste, lui, collé
   * au viewport de mise en page : caler sa seule hauteur ne suffit pas, il faut
   * aussi lui rendre ce décalage, sinon son bas repasse sous le clavier.
   */
  offsetTop: number;
}

/**
 * Place occupée par le clavier, et hauteur réellement visible sur le web.
 *
 * Natif : `KeyboardAvoidingView` ne convient pas en edge-to-edge (Android 15),
 * où le système ne redimensionne plus la fenêtre mais la pousse, l'en-tête
 * sortait de l'écran. On mesure donc le clavier et l'écran lui réserve la place.
 *
 * Web : le clavier virtuel ne change QUE le viewport visuel ; le document, lui,
 * garde sa hauteur. Réserver un espace en bas ne sert alors à rien, la barre
 * de saisie reste au bas du document, c'est-à-dire sous le clavier, et elle
 * suit le défilement de la page. D'où `viewportHeight` : l'écran s'y cale en
 * position fixe et cesse de dépendre du document.
 */
export function useKeyboardInset(): KeyboardViewport {
  const [keyboard, setKeyboard] = useState(0);
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);
  const [offsetTop, setOffsetTop] = useState(0);
  // Android annonce la hauteur du clavier barre de navigation DÉDUITE
  // (ReactRootView : ime.bottom - systemBars.bottom). L'app étant dessinée bord
  // à bord, cette barre recouvre elle aussi le bas de l'écran : sans la rajouter,
  // la saisie restait coincée sous le clavier, entièrement avec la navigation
  // à trois boutons. iOS, lui, compte déjà la zone du home indicator.
  const bottomBar = useSafeAreaInsets().bottom;
  const bottomBarRef = useRef(bottomBar);
  bottomBarRef.current = bottomBar;

  useEffect(() => {
    if (Platform.OS === 'web') {
      const vv = typeof window !== 'undefined' ? window.visualViewport : undefined;
      if (!vv) return;

      const update = () => {
        setViewportHeight(vv.height);
        setOffsetTop(vv.offsetTop);
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

    const show = Keyboard.addListener(showEvent, (e) => {
      const height = e.endCoordinates?.height ?? 0;
      setKeyboard(Platform.OS === 'android' && height > 0 ? height + bottomBarRef.current : height);
    });
    const hide = Keyboard.addListener(hideEvent, () => setKeyboard(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return { keyboard, viewportHeight, offsetTop };
}
