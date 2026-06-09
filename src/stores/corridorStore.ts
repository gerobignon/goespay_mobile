import { create } from 'zustand';
import { corridorService, type Corridor } from '../services/corridorService';

/**
 * État des corridors actifs (server-driven). Remplace progressivement le filtrage
 * statique de `OPERATORS` (config.ts) : un opérateur n'est proposé que si son
 * corridor est actif côté serveur, et un pays sans payout actif affiche un badge.
 */
interface CorridorState {
  corridors: Corridor[];
  payoutCountries: string[];
  isLoaded: boolean;
  isLoading: boolean;

  fetchCorridors: () => Promise<void>;

  // ── Helpers ──
  // Le pays a-t-il au moins un corridor payout actif ?
  isPayoutAvailable: (country: string) => boolean;
  // Un moyen précis (code = id opérateur) est-il actif pour un sens donné ?
  // Code inconnu (corridors pas chargés / non listé) → true (fallback statique).
  isCodeEnabled: (code: string, dir: 'payin' | 'payout') => boolean;
  // Existe-t-il un corridor PayDunya actif couvrant ce pays+réseau (dédup AfribaPay) ?
  hasEnabledAggregator: (country: string, network: string, dir: 'payin' | 'payout', aggregator: string) => boolean;
}

export const useCorridorStore = create<CorridorState>((set, get) => ({
  corridors: [],
  payoutCountries: [],
  isLoaded: false,
  isLoading: false,

  fetchCorridors: async () => {
    set({ isLoading: true });
    try {
      const data = await corridorService.getCorridors();
      set({
        corridors: data.corridors,
        payoutCountries: data.payout_countries,
        isLoaded: true,
        isLoading: false,
      });
    } catch {
      // En cas d'échec réseau, on garde l'état précédent (ou vide). Les écrans
      // doivent tolérer isLoaded=false en retombant sur la liste statique.
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
}));
