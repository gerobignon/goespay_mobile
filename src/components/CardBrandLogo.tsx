import React from 'react';
import Svg, { Path, Circle, ClipPath, Defs, G } from 'react-native-svg';

/**
 * Logo du réseau gravé sur une carte : Visa ou Mastercard.
 *
 * Tracés vectoriels plutôt que texte stylé ou image bitmap : la carte est
 * rendue à des tailles très différentes (widget d'accueil, écran carte, futur
 * export) et un logo de réseau mal proportionné se remarque immédiatement —
 * c'est le repère que le porteur cherche en premier.
 */

interface Props {
  brand?: string | null;
  /** Hauteur du logo ; la largeur suit le ratio propre à chaque marque. */
  height?: number;
}

export function CardBrandLogo({ brand, height = 26 }: Props) {
  const isMastercard = (brand || '').toUpperCase() === 'MASTERCARD';

  if (isMastercard) {
    // Deux disques sécants ; l'intersection est le disque droit découpé par le
    // gauche — c'est ce recouvrement, et non un simple chevauchement, qui rend
    // la marque reconnaissable.
    const w = height * (36 / 24);
    return (
      <Svg width={w} height={height} viewBox="0 0 36 24">
        <Defs>
          <ClipPath id="mcLeft">
            <Circle cx="14" cy="12" r="9" />
          </ClipPath>
        </Defs>
        <Circle cx="14" cy="12" r="9" fill="#EB001B" />
        <Circle cx="22" cy="12" r="9" fill="#F79E1B" />
        <G clipPath="url(#mcLeft)">
          <Circle cx="22" cy="12" r="9" fill="#FF5F00" />
        </G>
      </Svg>
    );
  }

  // Visa : logotype officiel, en blanc comme sur une carte réelle. Le tracé
  // n'occupe qu'une bande du carré d'origine (y ≈ 8,26 → 15,76) : la fenêtre est
  // cadrée dessus, sinon le logo flotterait au milieu d'un vide vertical.
  const w = height * (24 / 7.5);
  return (
    <Svg width={w} height={height} viewBox="0 8.26 24 7.5">
      <Path
        fill="#ffffff"
        d="M9.112 8.262L5.97 15.758H3.92L2.374 9.775c-.094-.368-.175-.503-.461-.658C1.447 8.864.677 8.627 0 8.479l.046-.217h3.3a.904.904 0 01.894.764l.817 4.338 2.018-5.102zm8.033 5.049c.008-1.979-2.736-2.088-2.717-2.972.006-.269.262-.555.822-.628a3.66 3.66 0 011.913.336l.34-1.59a5.207 5.207 0 00-1.814-.333c-1.917 0-3.266 1.02-3.278 2.479-.012 1.079.963 1.68 1.698 2.04.756.367 1.01.603 1.006.931-.005.504-.602.725-1.16.734-.975.015-1.54-.263-1.992-.473l-.351 1.642c.453.208 1.289.39 2.156.398 2.037 0 3.37-1.006 3.377-2.564m5.061 2.447H24l-1.565-7.496h-1.656a.883.883 0 00-.826.55l-2.909 6.946h2.036l.405-1.12h2.488zm-2.163-2.656l1.02-2.815.588 2.815zm-8.16-4.84l-1.603 7.496H8.34l1.605-7.496z"
      />
    </Svg>
  );
}
