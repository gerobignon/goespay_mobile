import { create } from 'zustand';
import api from '../services/api';

interface FeatureFlags {
  deposit_enabled: boolean;
  transfer_enabled: boolean;
  crypto_buy_enabled: boolean;
  crypto_sell_enabled: boolean;
}

export interface AppConfig {
  // Frais de transfert (en %, ex: 5 = 5%)
  transfer_fee_default: number;
  transfer_fee_cm: number;
  // Limites montants (XOF)
  deposit_min: number;
  transfer_min: number;
  transfer_max: number;
  transfer_min_ng: number;
  transfer_max_ng: number;
  crypto_buy_max: number;
  crypto_buy_min_btc: number;
  crypto_buy_min_default: number;
  crypto_sell_min_receive: number;
  // Listes dynamiques
  stablecoin_codes: string[];
  mobile_money_countries: string[];
}

interface ConfigState extends FeatureFlags, AppConfig {
  isLoaded: boolean;
  fetchConfig: () => Promise<void>;
}

const defaultFlags: FeatureFlags = {
  deposit_enabled: true,
  transfer_enabled: true,
  crypto_buy_enabled: true,
  crypto_sell_enabled: true,
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  transfer_fee_default: 5,
  transfer_fee_cm: 10,
  deposit_min: 1000,
  transfer_min: 2500,
  transfer_max: 500000,
  transfer_min_ng: 25000,
  transfer_max_ng: 250000,
  crypto_buy_max: 250000,
  crypto_buy_min_btc: 50000,
  crypto_buy_min_default: 2500,
  crypto_sell_min_receive: 1000,
  stablecoin_codes: ['PM', 'PAYEER', 'USDT.TRC20', 'BUSD.BEP20', 'USDT', 'BUSD'],
  mobile_money_countries: ['BJ', 'BF', 'CI', 'TG', 'SN', 'ML', 'CM'],
};

export const useConfigStore = create<ConfigState>((set) => ({
  ...defaultFlags,
  ...DEFAULT_APP_CONFIG,
  isLoaded: false,
  fetchConfig: async () => {
    try {
      const { data } = await api.get<FeatureFlags & AppConfig>('/config');
      set({ ...data, isLoaded: true });
    } catch {
      // En cas d'erreur réseau, conserver les valeurs par défaut
      set({ ...defaultFlags, ...DEFAULT_APP_CONFIG, isLoaded: true });
    }
  },
}));
