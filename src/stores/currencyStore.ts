import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '../services/api';

const RATES_CACHE_KEY = 'currency_rates_cache_v1';
const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

// Décimales par devise (rule canonique #8)
const DECIMALS: Record<string, number> = {
  XOF: 0, XAF: 0, GNF: 0, SLE: 0, LRD: 0, CDF: 0,
  NGN: 2, GHS: 2, GMD: 2, USD: 2, EUR: 2,
};

const SUPPORTED = ['XOF', 'XAF', 'NGN', 'GHS', 'GMD', 'SLE', 'LRD', 'GNF', 'CDF', 'USD', 'EUR'] as const;
export type SupportedCurrency = typeof SUPPORTED[number];

interface RatesResponse {
  base: string;
  rates: Record<string, number>;
  fetched_at: string;
  stale?: boolean;
  supported?: string[];
  decimals?: Record<string, number>;
}

interface CurrencyState {
  // Devise affichée pour l'utilisateur (XOF par défaut)
  userCurrency: string;
  // Source : 'auto' (déduite du pays) ou 'manual' (choisie par l'utilisateur)
  currencySource: 'auto' | 'manual';
  // Taux : 1 XOF = N <devise>
  rates: Record<string, number>;
  fetchedAt: number | null;
  stale: boolean;
  loading: boolean;

  // Actions
  init: () => Promise<void>;
  fetchRates: (force?: boolean) => Promise<void>;
  setUserCurrency: (currency: string, source?: 'auto' | 'manual') => Promise<void>;
  hydrateFromUser: (currency?: string | null, source?: 'auto' | 'manual' | null) => Promise<void>;

  // Helpers — XOF est la source de vérité, l'affichage est dérivé
  convertFromXof: (xofAmount: number, target?: string) => number;
  convertToXof: (displayAmount: number, source?: string) => number;
  formatFromXof: (xofAmount: number, opts?: { withCode?: boolean; approx?: boolean }) => string;
  decimalsFor: (currency: string) => number;
  isSupported: (currency: string) => boolean;
}

const formatNumber = (value: number, decimals: number): string => {
  // Pas d'arrondi à l'affichage : on garde jusqu'à 2 décimales si présentes
  // (les devises à 0 décimale comme XOF n'écrasent plus la partie décimale),
  // sans forcer de zéros au-delà de la convention de la devise.
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: 2,
  });
};

export const useCurrencyStore = create<CurrencyState>((set, get) => ({
  userCurrency: 'XOF',
  currencySource: 'auto',
  rates: { XOF: 1 },
  fetchedAt: null,
  stale: false,
  loading: false,

  init: async () => {
    try {
      // userCurrency d'affichage retiré : on ne restaure plus de devise en cache,
      // tout le monde reste en XOF. (Ancienne clé USER_CURRENCY_KEY ignorée.)
      const cachedRates = await AsyncStorage.getItem(RATES_CACHE_KEY);
      if (cachedRates) {
        const parsed: { data: RatesResponse; ts: number } = JSON.parse(cachedRates);
        set({
          rates: { XOF: 1, ...parsed.data.rates },
          fetchedAt: parsed.ts,
          stale: Date.now() - parsed.ts > TWELVE_HOURS_MS,
        });
      }
    } catch {
      // pas grave, fallback sur XOF
    }
  },

  fetchRates: async (force = false) => {
    const { fetchedAt, loading } = get();
    if (loading) return;
    if (!force && fetchedAt && Date.now() - fetchedAt < TWELVE_HOURS_MS) return;

    set({ loading: true });
    try {
      const { data } = await api.get<RatesResponse>('/exchange-rates');
      const ts = Date.now();
      const rates = { XOF: 1, ...data.rates };
      set({
        rates,
        fetchedAt: ts,
        stale: !!data.stale,
        loading: false,
      });
      await AsyncStorage.setItem(RATES_CACHE_KEY, JSON.stringify({ data, ts }));
    } catch {
      // Garde les taux précédents (rule #6 : stale OK)
      set({ loading: false, stale: true });
    }
  },

  // Multi-devise d'affichage RETIRÉ : tout le monde reste en XOF. Ces setters
  // sont conservés (compat appels existants) mais n'altèrent plus la devise.
  setUserCurrency: async () => {
    /* no-op : userCurrency reste 'XOF' */
  },

  hydrateFromUser: async () => {
    /* no-op : userCurrency reste 'XOF' */
  },

  convertFromXof: (xofAmount, target) => {
    const { rates, userCurrency } = get();
    const cur = target || userCurrency;
    if (cur === 'XOF') return xofAmount;
    const rate = rates[cur];
    if (!rate || !isFinite(rate) || rate <= 0) return xofAmount;
    return xofAmount * rate;
  },

  convertToXof: (displayAmount, source) => {
    const { rates, userCurrency } = get();
    const cur = source || userCurrency;
    if (cur === 'XOF') return displayAmount;
    const rate = rates[cur];
    if (!rate || !isFinite(rate) || rate <= 0) return displayAmount;
    // Inverse : 1 unité de cur = (1 / rate) XOF
    return displayAmount / rate;
  },

  formatFromXof: (xofAmount, opts = {}) => {
    const { userCurrency, convertFromXof } = get();
    const decimals = get().decimalsFor(userCurrency);
    const value = convertFromXof(xofAmount);
    const formatted = formatNumber(value, decimals);
    const prefix = opts.approx && userCurrency !== 'XOF' ? '≈ ' : '';
    const suffix = opts.withCode === false ? '' : ` ${userCurrency}`;
    return `${prefix}${formatted}${suffix}`;
  },

  decimalsFor: (currency) => DECIMALS[currency] ?? 2,
  isSupported: (currency) => SUPPORTED.includes(currency as SupportedCurrency),
}));

export const SUPPORTED_CURRENCIES = SUPPORTED;
