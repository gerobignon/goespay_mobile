import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Transaction, PaginatedResponse } from '../types';
import { walletService } from '../services/walletService';

const CACHED_TRANSACTIONS_KEY = 'cached_transactions';
const CACHED_BALANCE_KEY = 'cached_balance';

interface WalletState {
  balance: number;
  fincraBalance: number;
  transactions: Transaction[];
  currentPage: number;
  lastPage: number;
  isLoadingBalance: boolean;
  isLoadingTransactions: boolean;

  fetchBalance: () => Promise<void>;
  fetchFincraBalance: () => Promise<void>;
  fetchTransactions: (page?: number, type?: string) => Promise<void>;
  loadMoreTransactions: (type?: string) => Promise<void>;
  loadCachedData: () => Promise<void>;
  reset: () => void;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  balance: 0,
  fincraBalance: 0,
  transactions: [],
  currentPage: 1,
  lastPage: 1,
  isLoadingBalance: false,
  isLoadingTransactions: false,

  loadCachedData: async () => {
    try {
      const [cachedBalance, cachedTx] = await AsyncStorage.multiGet([
        CACHED_BALANCE_KEY,
        CACHED_TRANSACTIONS_KEY,
      ]);
      const balance = cachedBalance[1] ? parseFloat(cachedBalance[1]) : 0;
      const transactions = cachedTx[1] ? JSON.parse(cachedTx[1]) : [];
      set({ balance, transactions });
    } catch {
      // ignore cache errors
    }
  },

  fetchBalance: async () => {
    set({ isLoadingBalance: true });
    try {
      const data = await walletService.getBalance();
      const balance = data.balance ?? 0;
      const fincraBalance = data.balance_fincra ?? 0;
      set({ balance, fincraBalance, isLoadingBalance: false });
      AsyncStorage.setItem(CACHED_BALANCE_KEY, String(balance));
    } catch (e) {
      set({ isLoadingBalance: false });
    }
  },

  fetchFincraBalance: async () => {
    try {
      const fincraBalance = await walletService.getFincraBalance();
      set({ fincraBalance });
    } catch {
      // ignore
    }
  },

  fetchTransactions: async (page = 1, type?) => {
    set({ isLoadingTransactions: true, ...(page === 1 ? { transactions: [] } : {}) });
    try {
      const data: PaginatedResponse<Transaction> =
        await walletService.getTransactions(page, type);
      const transactions = data.data ?? [];
      set({
        transactions,
        currentPage: data.current_page ?? 1,
        lastPage: data.last_page ?? 1,
        isLoadingTransactions: false,
      });
      if (page === 1 && !type) {
        AsyncStorage.setItem(CACHED_TRANSACTIONS_KEY, JSON.stringify(transactions));
      }
    } catch (e) {
      set({ isLoadingTransactions: false, transactions: [] });
    }
  },

  loadMoreTransactions: async (type?) => {
    const { currentPage, lastPage, isLoadingTransactions, transactions } =
      get();
    if (isLoadingTransactions || currentPage >= lastPage) return;
    set({ isLoadingTransactions: true });
    try {
      const data = await walletService.getTransactions(currentPage + 1, type);
      set({
        transactions: [...transactions, ...data.data],
        currentPage: data.current_page,
        lastPage: data.last_page,
        isLoadingTransactions: false,
      });
    } catch {
      set({ isLoadingTransactions: false });
    }
  },

  reset: () =>
    set({
      balance: 0,
      transactions: [],
      currentPage: 1,
      lastPage: 1,
    }),
}));
