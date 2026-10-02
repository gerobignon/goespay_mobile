import React, { useEffect, type ReactNode } from 'react';
import { Keyboard } from 'react-native';
import { FullWindowOverlay } from 'react-native-screens';

interface AlertOverlayProps {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
}

/**
 * Couche d'affichage de l'alerte globale sur iOS.
 *
 * Un <Modal> React Native se présente depuis le contrôleur de sa vue parente,
 * ici le contrôleur racine. Quand un écran est déjà ouvert dans un modal
 * (envoi, dépôt, crypto, détail), ce contrôleur présente déjà quelque chose et
 * iOS refuse la seconde présentation sans rien dire : l'alerte de l'écran ne
 * s'affichait jamais, et la croix, qui demande confirmation dès qu'un champ est
 * rempli, semblait ne rien faire.
 *
 * FullWindowOverlay ajoute l'alerte à la fenêtre principale au moment où elle
 * se monte, donc par-dessus les modals déjà ouverts : on ne la monte que
 * pendant l'affichage pour qu'elle passe toujours en dernier. Le clavier vit
 * dans une fenêtre plus haute encore et cacherait les boutons, on le ferme.
 * Pas de retour matériel sur iOS, onRequestClose est donc inutile.
 */
export function AlertOverlay({ visible, children }: AlertOverlayProps) {
  useEffect(() => {
    if (visible) Keyboard.dismiss();
  }, [visible]);

  if (!visible) return null;
  return <FullWindowOverlay>{children}</FullWindowOverlay>;
}
