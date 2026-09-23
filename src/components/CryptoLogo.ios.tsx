/**
 * Variante iOS : aucun logo de crypto-monnaie n'est embarqué dans le binaire.
 * Remplacer ce composant coupe aussi `utils/cryptoLogos` et les images locales
 * du graphe de dépendances iOS. Voir `cryptoStore.ios.ts`.
 */
interface CryptoLogoProps {
  rate?: { code?: string; img?: string | null } | null;
  size?: number;
  fallbackBackground?: string;
  fallbackColor?: string;
}

export function CryptoLogo(_props: CryptoLogoProps) {
  return null;
}
