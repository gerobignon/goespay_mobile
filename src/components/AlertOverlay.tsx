import React, { type ReactNode } from 'react';
import { Modal } from 'react-native';

interface AlertOverlayProps {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
}

/**
 * Couche d'affichage de l'alerte globale. En natif, un <Modal> suffit : iOS et
 * Android présentent la dernière fenêtre ouverte au-dessus des précédentes.
 * La variante web (AlertOverlay.web.tsx) doit, elle, forcer l'empilement.
 */
export function AlertOverlay({ visible, onRequestClose, children }: AlertOverlayProps) {
  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent onRequestClose={onRequestClose}>
      {children}
    </Modal>
  );
}
