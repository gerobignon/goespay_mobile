/**
 * Variante native (iOS et Android) : la recherche de devises crypto n'existe
 * pas dans les binaires. Voir `cryptoStore.native.ts`.
 */
interface CryptoSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function CryptoSearchField(_props: CryptoSearchFieldProps) {
  return null;
}
