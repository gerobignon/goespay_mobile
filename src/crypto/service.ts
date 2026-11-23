import api from '../services/api';
import type { Transaction } from '../types';

/** Receiving address saved by the user. */
export interface SavedWallet {
  id: number;
  name?: string;
  currency: string;
  address: string;
  created_at?: string;
  updated_at?: string;
}

/** Crypto endpoints. Part of the add-on bundle: never imported by shared code. */
export const cryptoService = {
  getTransaction: async (id: number): Promise<Transaction> => {
    const response = await api.get(`/wallet/history/crypto/${id}`);
    return response.data?.data ?? response.data;
  },

  submitClaim: async (data: { transaction_id: number; message: string }): Promise<any> => {
    const response = await api.post('/claim/crypto', data);
    return response.data;
  },

  getSavedWallets: async (): Promise<SavedWallet[]> => {
    const response = await api.get('/user/wallets');
    return response.data?.data ?? response.data ?? [];
  },

  createSavedWallet: async (data: Record<string, any>): Promise<any> => {
    const response = await api.post('/user/wallets', data);
    return response.data?.data ?? response.data;
  },

  updateSavedWallet: async (id: number, data: Record<string, any>): Promise<any> => {
    const response = await api.put(`/user/wallets/${id}`, data);
    return response.data?.data ?? response.data;
  },

  deleteSavedWallet: async (id: number): Promise<any> => {
    const response = await api.delete(`/user/wallets/${id}`);
    return response.data;
  },
};
