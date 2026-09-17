import React, { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface AlertOverlayProps {
  visible: boolean;
  onRequestClose: () => void;
  children: ReactNode;
}

/**
 * Couche d'affichage de l'alerte globale sur le web.
 *
 * react-native-web donne le MÊME z-index (9999) à tous les <Modal> et les pose
 * dans des div ajoutés au body au moment où le composant est monté, pas au
 * moment où il s'ouvre. L'alerte, montée une fois pour toutes à la racine,
 * arrivait donc toujours avant les modals des écrans et passait dessous :
 * confirmer la fermeture d'un dépôt ou d'un envoi ouvrait une alerte invisible,
 * et la croix semblait ne rien faire.
 *
 * On sort donc l'alerte du mécanisme de <Modal> : son hôte est rattaché au body
 * à chaque ouverture, donc toujours en dernier, et porte un z-index qu'aucune
 * couche de l'application ne dépasse.
 */
export function AlertOverlay({ visible, onRequestClose, children }: AlertOverlayProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  if (!hostRef.current && typeof document !== 'undefined') {
    const el = document.createElement('div');
    el.setAttribute('data-alert-host', '');
    el.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;flex-direction:column;';
    hostRef.current = el;
  }

  useEffect(() => {
    const el = hostRef.current;
    if (!el || typeof document === 'undefined') return;
    if (visible) {
      // Ré-attacher déplace le noeud en fin de body : l'alerte passe au-dessus
      // des modals ouverts avant elle.
      document.body.appendChild(el);
    } else if (el.parentNode) {
      el.parentNode.removeChild(el);
    }
    return () => {
      if (el.parentNode) el.parentNode.removeChild(el);
    };
  }, [visible]);

  useEffect(() => {
    if (!visible || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onRequestClose();
      }
    };
    document.addEventListener('keyup', onKey, false);
    return () => document.removeEventListener('keyup', onKey, false);
  }, [visible, onRequestClose]);

  if (!visible || !hostRef.current) return null;
  return createPortal(children, hostRef.current);
}
