import type { ImageSourcePropType } from 'react-native';

/**
 * Variante iOS : aucune image de crypto-monnaie n'est embarquée dans le
 * binaire. Voir `cryptoStore.ios.ts`.
 */
export function cryptoLogoFor(_currencySrc?: string | null): ImageSourcePropType | null {
  return null;
}
