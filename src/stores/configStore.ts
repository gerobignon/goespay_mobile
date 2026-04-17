import { create } from 'zustand';
import api from '../services/api';

interface FeatureFlags {
  deposit_enabled: boolean;
  transfer_enabled: boolean;
  crypto_buy_enabled: boolean;
  crypto_sell_enabled: boolean;
}

interface ConfigState extends FeatureFlags {
  isLoaded: boolean;
  fetchConfig: () => Promise<void>;
}

const defaultFlags: FeatureFlags = {
  deposit_enabled: true,
  transfer_enabled: true,
  crypto_buy_enabled: true,
  crypto_sell_enabled: true,
};

export const useConfigStore = create<ConfigState>((set) => ({
  ...defaultFlags,
  isLoaded: false,
  fetchConfig: async () => {
    try {
      const { data } = await api.get<FeatureFlags>('/config');
      set({ ...data, isLoaded: true });
    } catch {
      // En cas d'erreur, garder tout activé
      set({ ...defaultFlags, isLoaded: true });
    }
  },
}));
