/**
 * Variante iOS du magasin crypto : coquille vide.
 *
 * L'app iOS n'offre aucun service d'échange de crypto-monnaies (règle App Store
 * 3.1.5(iii) : licence exigée dans chaque pays de distribution). Metro résout ce
 * fichier à la place de `cryptoStore.ts` quand la cible est iOS, si bien que le
 * magasin réel, ses appels à l'API et le nom du prestataire ne sont pas
 * embarqués dans le binaire.
 *
 * Les écrans partagés compilent contre `cryptoStore.ts` : ce fichier n'existe
 * que pour l'exécution, et doit donc en garder exactement les signatures.
 * Android et la PWA continuent d'utiliser le magasin réel.
 */
import { create } from 'zustand';

/** Forme minimale conservée pour que les écrans partagés s'exécutent à vide. */
export interface CryptoRate {
  code: string;
  name: string;
  buy_rate: number | string;
  sell_rate: number | string;
  buy_active?: boolean;
  sell_active?: boolean;
  is_popular?: boolean;
  img?: string;
  network?: string | null;
  min_crypto?: number | null;
  min_fiat?: number | null;
}

export type CryptoDir = 'buy' | 'sell';

/** Aucune devise n'est proposable sur iOS. */
export const isCryptoDirAllowed = (_rate: CryptoRate, _dir: CryptoDir): boolean => false;

interface CryptoState {
  rates: CryptoRate[];
  lastFetchedAt: number;
  loading: boolean;
  error: string | null;
  estimating: Record<string, boolean>;
  fetchRates: (force?: boolean) => Promise<void>;
  fetchEstimate: (code: string, force?: boolean) => Promise<void>;
}

export const useCryptoStore = create<CryptoState>(() => ({
  rates: [],
  lastFetchedAt: 0,
  loading: false,
  error: null,
  estimating: {},
  fetchRates: async () => {},
  fetchEstimate: async () => {},
}));
