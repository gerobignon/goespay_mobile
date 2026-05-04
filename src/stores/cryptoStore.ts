import { create } from 'zustand';
import api from '../services/api';

export interface CryptoRate {
  code: string;
  name: string;
  buy_rate: number;
  sell_rate: number;
  buy_rate_ng?: number;
  sell_rate_ng?: number;
  buy_rate_cm?: number;
  sell_rate_cm?: number;
  buy_rate_ga?: number;
  sell_rate_ga?: number;
  live_rate?: number;
  img?: string;
}

const CACHE_TTL = 60_000; // 1 minute

interface CryptoState {
  rates: CryptoRate[];
  lastFetchedAt: number;
  loading: boolean;
  error: string | null;
  fetchRates: (force?: boolean) => Promise<void>;
}

export const useCryptoStore = create<CryptoState>((set, get) => ({
  rates: [],
  lastFetchedAt: 0,
  loading: false,
  error: null,

  fetchRates: async (force = false) => {
    const { lastFetchedAt, loading } = get();

    // Skip if cache is fresh and not forced
    if (!force && lastFetchedAt > 0 && Date.now() - lastFetchedAt < CACHE_TTL) {
      return;
    }

    // Skip if already loading (avoid parallel calls)
    if (loading) return;

    set({ loading: true, error: null });

    try {
      const response = await api.get('/crypto/rates');
      const body = response.data;

      // Handle multiple possible response shapes
      let list: CryptoRate[] = [];
      if (Array.isArray(body)) {
        list = body;
      } else if (body && typeof body === 'object') {
        list = body.data ?? body.list ?? body.rates ?? [];
      }

      if (list.length > 0) {
        set({ rates: list, lastFetchedAt: Date.now(), error: null });
      } else {
        // API succeeded but no active crypto — distinct from a network error
        set({ rates: [], lastFetchedAt: Date.now(), error: 'NO_ACTIVE_CRYPTO' });
      }
    } catch (e: any) {
      const msg = e?.message || 'Erreur réseau';
      set({ error: msg });
    } finally {
      set({ loading: false });
    }
  },
}));
