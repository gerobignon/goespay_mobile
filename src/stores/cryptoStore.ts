import { create } from 'zustand';
import api from '../services/api';

export interface CryptoRate {
  code: string;
  name: string;
  buy_rate: number | string;
  sell_rate: number | string;
  // Per-country overrides (ISO lowercase). Backend returns null when not set.
  buy_rate_ng?: number | string | null;
  sell_rate_ng?: number | string | null;
  buy_rate_cm?: number | string | null;
  sell_rate_cm?: number | string | null;
  buy_rate_ga?: number | string | null;
  sell_rate_ga?: number | string | null;
  buy_rate_sn?: number | string | null;
  sell_rate_sn?: number | string | null;
  buy_rate_bj?: number | string | null;
  sell_rate_bj?: number | string | null;
  buy_rate_bf?: number | string | null;
  sell_rate_bf?: number | string | null;
  buy_rate_ci?: number | string | null;
  sell_rate_ci?: number | string | null;
  buy_rate_ml?: number | string | null;
  sell_rate_ml?: number | string | null;
  buy_rate_ne?: number | string | null;
  sell_rate_ne?: number | string | null;
  buy_rate_tg?: number | string | null;
  sell_rate_tg?: number | string | null;
  buy_rate_gn?: number | string | null;
  sell_rate_gn?: number | string | null;
  buy_rate_gw?: number | string | null;
  sell_rate_gw?: number | string | null;
  buy_rate_gm?: number | string | null;
  sell_rate_gm?: number | string | null;
  buy_rate_cd?: number | string | null;
  sell_rate_cd?: number | string | null;
  buy_rate_cg?: number | string | null;
  sell_rate_cg?: number | string | null;
  buy_rate_cf?: number | string | null;
  sell_rate_cf?: number | string | null;
  buy_rate_td?: number | string | null;
  sell_rate_td?: number | string | null;
  live_rate?: number;
  img?: string;
  // Catalogue NOWPayments (sync backend) — absents des devises hors NOWPayments.
  network?: string | null;
  wallet_regex?: string | null;
  precision?: number | null;
  is_stable?: boolean;
  is_popular?: boolean;
  extra_id_exists?: boolean;
  // Renseignés par fetchEstimate() à la sélection de la devise.
  min_crypto?: number | null;
  min_fiat?: number | null;
}

const CACHE_TTL = 60_000; // 1 minute
const ESTIMATE_TTL = 60_000;

interface CryptoState {
  rates: CryptoRate[];
  lastFetchedAt: number;
  loading: boolean;
  error: string | null;
  /** Devises dont l'estimation est en cours (spinner du taux). */
  estimating: Record<string, boolean>;
  fetchRates: (force?: boolean) => Promise<void>;
  /**
   * Prix USD + minimum d'UNE devise, à la sélection.
   * Le backend ne pré-calcule que les devises actives prioritaires : toutes les
   * autres arrivent avec live_rate=null et sont résolues ici.
   */
  fetchEstimate: (code: string, force?: boolean) => Promise<void>;
}

/** Horodatage des dernières estimations, hors state (aucun re-render utile). */
const estimatedAt: Record<string, number> = {};

export const useCryptoStore = create<CryptoState>((set, get) => ({
  rates: [],
  lastFetchedAt: 0,
  loading: false,
  error: null,
  estimating: {},

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

  fetchEstimate: async (code, force = false) => {
    const key = (code || '').toUpperCase();
    if (!key) return;

    const { estimating, rates } = get();
    if (estimating[key]) return;

    const known = rates.find((r) => (r.code || '').toUpperCase() === key);
    const fresh = estimatedAt[key] && Date.now() - estimatedAt[key] < ESTIMATE_TTL;
    // Déjà chiffrée et fraîche → rien à faire.
    if (!force && fresh && known?.live_rate) return;
    // Stablecoin : le backend renvoie déjà live_rate=1, inutile d'interroger.
    if (!force && known?.is_stable && known?.live_rate) return;

    set({ estimating: { ...estimating, [key]: true } });

    try {
      const response = await api.get('/crypto/estimate', { params: { currency: key } });
      const data = response.data?.data ?? response.data;
      if (!data) return;

      estimatedAt[key] = Date.now();
      set((s) => ({
        rates: s.rates.map((r) =>
          (r.code || '').toUpperCase() === key
            ? {
                ...r,
                live_rate: data.live_rate ?? r.live_rate,
                min_crypto: data.min_crypto ?? null,
                min_fiat: data.min_fiat ?? null,
              }
            : r
        ),
      }));
    } catch {
      // Silencieux : l'écran affiche déjà « taux indisponible » et propose de réessayer.
    } finally {
      set((s) => {
        const next = { ...s.estimating };
        delete next[key];
        return { estimating: next };
      });
    }
  },
}));
