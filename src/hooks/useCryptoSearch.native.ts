/**
 * Variante native (iOS et Android) : la liste des devises est toujours vide,
 * les apps natives n'offrant aucun service d'échange de crypto-monnaies. Voir
 * `cryptoStore.native.ts`.
 */
import type { CryptoDir, CryptoRate } from '../stores/cryptoStore';

export function useCryptoSearch(_rates: CryptoRate[], _selectedCode?: string, _dir?: CryptoDir) {
  return {
    query: '',
    setQuery: (_value: string) => {},
    cryptos: [] as CryptoRate[],
    showSearch: false,
    empty: false,
    none: true,
  };
}
