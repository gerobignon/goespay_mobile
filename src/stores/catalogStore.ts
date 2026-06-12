import { create } from 'zustand';
import { catalogService, type CatalogCountry, type CatalogCurrency } from '../services/catalogService';

// ─────────────────────────────────────────────────────────────────────────
// Catalogue serveur (P3) — l'app construit ses listes opérateurs/pays/devises
// depuis /catalog (piloté par l'admin « Marchés »), au lieu des listes en dur
// de config.ts. Les composants gardent config.ts en FALLBACK tant que le
// catalogue n'est pas chargé (offline / premier rendu).
// ─────────────────────────────────────────────────────────────────────────

// Map logo_key (réseau, côté serveur) → asset local. Tous les require() doivent
// être statiques (Metro). Clés = valeurs `logo_key` de lightlab_goes_networks.
const LOGO_BY_KEY: Record<string, any> = {
  pay_orange:   require('../../assets/operators/pay_orange.jpg'),
  pay_mtn:      require('../../assets/operators/pay_mtn.png'),
  pay_moov:     require('../../assets/operators/pay_moov.png'),
  pay_wave:     require('../../assets/operators/pay_wave.jpg'),
  pay_airtel:   require('../../assets/operators/pay_airtel.png'),
  pay_mpesa:    require('../../assets/operators/pay_mpesa.jpg'),
  pay_africell: require('../../assets/operators/pay_africell.png'),
  pay_afrimoney:require('../../assets/operators/pay_afrimoney.png'),
  pay_tmoney:   require('../../assets/operators/pay_tmoney.jpg'),
  pay_telecel:  require('../../assets/operators/pay_telecel.png'),
  pay_card:     require('../../assets/operators/pay_card.jpg'),
  pay_fincra:   require('../../assets/operators/pay_fincra.png'),
  paydunya:     require('../../assets/operators/paydunya.png'),
};
const DEFAULT_LOGO = LOGO_BY_KEY.pay_card;

export interface CatalogOperator {
  id: string;
  name: string;
  flag: string;
  country: string;
  countries?: string[];
  currency?: string;
  rail?: string;
  withdraw: boolean;
  payin: boolean;
  afribapay?: boolean;
  fincra?: boolean;
  // Code opérateur Fincra (ORANGE, MTN…) pour les corridors fincra-mm-<pays>-<op>.
  fincraOperator?: string;
  aggregator: string;
  logo: any;
}
export interface CatalogCountryEntry { code: string; name: string; prefix: string; flag: string; }

// Rail Fincra déduit du code corridor.
function railFromCode(code: string): string | undefined {
  // MM par pays×opérateur : fincra-mm-<pays>-<operateur>.
  if (code.startsWith('fincra-mm-')) return 'mobile_money';
  if (code.endsWith('-mm')) return 'mobile_money';
  if (code.endsWith('-bt')) return 'bank_transfer';
  if (code.endsWith('-card')) return 'checkout';
  return undefined;
}

export interface CatalogZoneEntry { code: string; flag: string; name: string; phone: string; }

interface CatalogState {
  operators: CatalogOperator[];
  countries: CatalogCountryEntry[];
  currencies: CatalogCurrency[];
  payoutCountries: string[];
  // Sous-pays par zone-devise (XOF/XAF…) + indicatifs, depuis le catalogue Marchés.
  zones: Record<string, CatalogZoneEntry[]>;
  dialByCode: Record<string, string>;
  isLoaded: boolean;
  isLoading: boolean;
  fetchCatalog: () => Promise<void>;
}

export const useCatalogStore = create<CatalogState>((set, get) => ({
  operators: [],
  countries: [],
  currencies: [],
  payoutCountries: [],
  zones: {},
  dialByCode: {},
  isLoaded: false,
  isLoading: false,

  fetchCatalog: async () => {
    if (get().isLoading) return;
    set({ isLoading: true });
    try {
      const cat = await catalogService.getCatalog();

      const netByCode: Record<string, { label: string; logo_key: string; kind: string }> = {};
      cat.networks.forEach((n) => { netByCode[n.code] = { label: n.label, logo_key: n.logo_key, kind: n.kind }; });

      const countryByCode: Record<string, CatalogCountry> = {};
      cat.countries.forEach((c) => { countryByCode[c.code] = c; });

      // Pays actifs : /catalog.countries ne renvoie que les is_active=1. Un corridor
      // dont le pays est désactivé ne doit donc PAS produire d'opérateur.
      const activeCountries = new Set(cat.countries.map((c) => c.code));

      // Membres d'une zone (XOF/XAF), restreints aux pays ACTIFS → opérateurs Fincra zonaux.
      const zoneMembers: Record<string, string[]> = {};
      cat.countries.forEach((c) => {
        if (c.zone) (zoneMembers[c.zone] ??= []).push(c.code);
      });

      const operators: CatalogOperator[] = cat.corridors
        // Garde le corridor si : zone avec ≥1 pays membre actif, ou pays ISO actif.
        .filter((r) => (zoneMembers[r.country]?.length ?? 0) > 0 || activeCountries.has(r.country))
        .map((r) => {
        const net = netByCode[r.network];
        const isZone = !!zoneMembers[r.country];
        return {
          id: r.code,
          name: net?.label ?? r.network,
          flag: countryByCode[r.country]?.flag ?? '',
          country: r.country,
          countries: isZone ? zoneMembers[r.country] : undefined,
          currency: r.currency,
          rail: r.aggregator === 'fincra' ? railFromCode(r.code) : undefined,
          withdraw: !!r.payout,
          payin: !!r.payin,
          afribapay: r.aggregator === 'afribapay' || undefined,
          fincra: r.aggregator === 'fincra' || undefined,
          // Opérateur Fincra (ORANGE…) porté par les corridors fincra-mm-<pays>-<op>.
          fincraOperator: r.code.startsWith('fincra-mm-') ? r.network.toUpperCase() : undefined,
          aggregator: r.aggregator,
          logo: (net && LOGO_BY_KEY[net.logo_key]) || DEFAULT_LOGO,
        };
      });

      const countries: CatalogCountryEntry[] = cat.countries
        .filter((c) => c.code !== 'INTL' && /^[A-Z]{2}$/.test(c.code))
        .map((c) => ({ code: c.code, name: c.name, prefix: `+${c.dial_code}`, flag: c.flag }));

      // Sous-pays par zone-devise (XOF/XAF…) + indicatifs, depuis le catalogue.
      const zones: Record<string, CatalogZoneEntry[]> = {};
      const dialByCode: Record<string, string> = {};
      cat.countries.forEach((c) => {
        if (/^[A-Z]{2}$/.test(c.code)) dialByCode[c.code] = String(c.dial_code ?? '');
        if (c.zone && /^[A-Z]{2}$/.test(c.code)) {
          (zones[c.zone] ??= []).push({ code: c.code, flag: c.flag, name: c.name, phone: String(c.dial_code ?? '') });
        }
      });

      set({
        operators,
        countries,
        currencies: cat.currencies,
        payoutCountries: cat.payout_countries,
        zones,
        dialByCode,
        isLoaded: true,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false }); // garde l'état précédent ; fallback config.ts
    }
  },
}));
