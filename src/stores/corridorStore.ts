import { create } from 'zustand';
import {
  corridorService,
  type Corridor,
  type CatalogCountry,
  type CatalogCurrency,
  type CatalogNetwork,
} from '../services/corridorService';

/**
 * État du catalogue server-driven (pays, devises, réseaux, corridors).
 * Source unique : endpoint /catalog. Remplace progressivement les listes
 * hardcodées (OPERATORS/COUNTRIES) : la dispo vient du serveur ; la présentation
 * (logos bundlés) reste locale, mappée par `network`/`logo_key`.
 */
interface CorridorState {
  corridors: Corridor[];
  payoutCountries: string[];
  countries: CatalogCountry[];
  currencies: CatalogCurrency[];
  networks: CatalogNetwork[];
  isLoaded: boolean;
  isLoading: boolean;

  fetchCorridors: () => Promise<void>;

  // ── Helpers corridors ──
  isPayoutAvailable: (country: string) => boolean;
  isCodeEnabled: (code: string, dir: 'payin' | 'payout') => boolean;
  // Audience « International » (pays non listés) : toggles intl_* indépendants.
  isCodeIntlEnabled: (code: string, dir: 'payin' | 'payout') => boolean;
  hasEnabledAggregator: (country: string, network: string, dir: 'payin' | 'payout', aggregator: string) => boolean;

  // ── Helpers référentiel ──
  dialCodeFor: (country: string) => string | null;     // indicatif d'un pays (serveur)
  networkLabel: (code: string) => string | null;       // libellé d'un réseau
}

export const useCorridorStore = create<CorridorState>((set, get) => ({
  corridors: [],
  payoutCountries: [],
  countries: [],
  currencies: [],
  networks: [],
  isLoaded: false,
  isLoading: false,

  fetchCorridors: async () => {
    set({ isLoading: true });
    try {
      const data = await corridorService.getCatalog();
      set({
        corridors: data.corridors,
        payoutCountries: data.payout_countries,
        countries: data.countries,
        currencies: data.currencies,
        networks: data.networks,
        isLoaded: true,
        isLoading: false,
      });
    } catch {
      // Échec réseau : on garde l'état précédent. Les écrans tolèrent isLoaded=false
      // en retombant sur les listes statiques (config.ts).
      set({ isLoading: false });
    }
  },

  isPayoutAvailable: (country) => {
    const c = (country || '').toUpperCase();
    return get().payoutCountries.includes(c);
  },

  isCodeEnabled: (code, dir) => {
    if (!get().isLoaded) return true; // pas encore chargé : ne pas masquer
    const row = get().corridors.find((x) => x.code === code);
    if (!row) return true; // moyen non listé côté serveur : fallback statique
    return dir === 'payout' ? row.payout : row.payin;
  },

  // Audience « International » : un moyen n'est proposé aux pays non listés que si
  // son flag intl_* est ON (indépendant du toggle pays). Code non listé côté
  // serveur → false (pas de fuite : l'International est opt-in explicite).
  isCodeIntlEnabled: (code, dir) => {
    if (!get().isLoaded) return false;
    const row = get().corridors.find((x) => x.code === code);
    if (!row) return false;
    return dir === 'payout' ? !!row.intl_payout : !!row.intl_payin;
  },

  hasEnabledAggregator: (country, network, dir, aggregator) => {
    const c = (country || '').toUpperCase();
    return get().corridors.some(
      (x) =>
        x.country === c &&
        x.network === network &&
        x.aggregator === aggregator &&
        (dir === 'payout' ? x.payout : x.payin)
    );
  },

  dialCodeFor: (country) => {
    const c = (country || '').toUpperCase();
    return get().countries.find((x) => x.code === c)?.dial_code ?? null;
  },

  networkLabel: (code) => get().networks.find((x) => x.code === code)?.label ?? null,
}));
