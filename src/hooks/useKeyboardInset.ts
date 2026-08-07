import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Hauteur occupée par le clavier, en points.
 *
 * Pourquoi pas `KeyboardAvoidingView` : en edge-to-edge (Android 15, activé
 * dans app.json), la fenêtre n'est plus redimensionnée par le système — elle
 * est poussée vers le haut. L'en-tête sortait donc de l'écran et le fil se
 * décalait, au lieu de rester en place comme dans WhatsApp.
 *
 * Ici on mesure le clavier et on laisse l'écran réserver la place lui-même :
 * l'en-tête ne bouge jamais, la liste rétrécit, la saisie se cale au-dessus du
 * clavier.
 *
 * Sur le web, `visualViewport` joue le même rôle : sa hauteur diminue à
 * l'ouverture du clavier virtuel alors que celle du document ne change pas.
 */
export function useKeyboardInset(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const vv = typeof window !== 'undefined' ? window.visualViewport : undefined;
      if (!vv) return;

      const update = () => {
        // Ce que le clavier recouvre = tout ce qui manque au viewport visuel.
        const covered = window.innerHeight - vv.height - vv.offsetTop;
        setHeight(covered > 60 ? covered : 0);
        // Le navigateur fait souvent défiler la page pour montrer le champ ;
        // on annule, la mise en page se charge déjà de dégager la saisie.
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

    const show = Keyboard.addListener(showEvent, (e) => setHeight(e.endCoordinates?.height ?? 0));
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));

    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
