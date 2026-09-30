import type { ImageSourcePropType } from 'react-native';

/**
 * Variante native (iOS et Android) : aucune image de crypto-monnaie n'est
 * embarquée dans les binaires. Voir `cryptoStore.native.ts`.
 */
export function cryptoLogoFor(_currencySrc?: string | null): ImageSourcePropType | null {
  return null;
}
