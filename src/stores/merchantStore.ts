import { create } from 'zustand';
import { merchantService } from '../services/merchantService';
import type { MerchantConfig, PaymentLink, MerchantPayment, MerchantStats } from '../types';

interface MerchantState {
  isMerchant: boolean;
  config: MerchantConfig | null;
  links: PaymentLink[];
  payments: MerchantPayment[];
  stats: MerchantStats | null;
  loading: boolean;
  paymentsPage: number;
  paymentsLastPage: number;

  fetchConfig: () => Promise<void>;
  register: (params: { business_name: string; description?: string; website?: string }) => Promise<void>;
  updateConfig: (params: Partial<Pick<MerchantConfig, 'business_name' | 'description' | 'website' | 'webhook_url'>>) => Promise<void>;
  fetchLinks: () => Promise<void>;
  fetchPayments: (page?: number) => Promise<void>;
  fetchStats: () => Promise<void>;
  reset: () => void;
}

export const useMerchantStore = create<MerchantState>((set, get) => ({
  isMerchant: false,
  config: null,
  links: [],
  payments: [],
  stats: null,
  loading: false,
  paymentsPage: 1,
  paymentsLastPage: 1,

  fetchConfig: async () => {
    try {
      const res = await merchantService.getConfig();
      set({ isMerchant: res.is_merchant, config: res.config });
    } catch {
      set({ isMerchant: false, config: null });
    }
  },

  register: async (params) => {
    const res = await merchantService.register(params);
    set({ isMerchant: true, config: res.config as MerchantConfig });
  },

  updateConfig: async (params) => {
    await merchantService.updateConfig(params);
    await get().fetchConfig();
  },

  fetchLinks: async () => {
    try {
      const links = await merchantService.getLinks();
      set({ links });
    } catch {
      set({ links: [] });
    }
  },

  fetchPayments: async (page = 1) => {
    try {
      const res = await merchantService.getPayments(page);
      set({
        payments: page === 1 ? res.data : [...get().payments, ...res.data],
        paymentsPage: res.current_page,
        paymentsLastPage: res.last_page,
      });
    } catch {
      if (page === 1) set({ payments: [] });
    }
  },

  fetchStats: async () => {
    try {
      const stats = await merchantService.getStats();
      set({ stats });
    } catch {
      set({ stats: null });
    }
  },

  reset: () => set({
    isMerchant: false,
    config: null,
    links: [],
    payments: [],
    stats: null,
    loading: false,
    paymentsPage: 1,
    paymentsLastPage: 1,
  }),
}));
