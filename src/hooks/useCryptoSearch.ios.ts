/**
 * Variante iOS : la liste des devises est toujours vide, l'app iOS n'offrant
 * aucun service d'échange de crypto-monnaies. Voir `cryptoStore.ios.ts`.
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
