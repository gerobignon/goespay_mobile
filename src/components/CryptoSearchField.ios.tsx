/**
 * Variante iOS : la recherche de devises crypto n'existe pas dans le binaire
 * iOS. Voir `cryptoStore.ios.ts`.
 */
interface CryptoSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function CryptoSearchField(_props: CryptoSearchFieldProps) {
  return null;
}
