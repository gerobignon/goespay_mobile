import api from './api';
import type {
  Transaction,
  DepositRequest,
  TransferRequest,
  PaginatedResponse,
} from '../types';

export const walletService = {
  getBalance: async (): Promise<{ balance: number }> => {
    const response = await api.get('/wallet/balance');
    // Handle both { balance: 123 } and { data: { balance: 123 } }
    const body = response.data;
    if (body.balance !== undefined) return body;
    if (body.data?.balance !== undefined) return body.data;
    return { balance: body.data ?? body ?? 0 };
  },

  getFincraBalance: async (): Promise<number> => {
    try {
      const { data } = await api.get('/balance/fincra');
      return data.fincra_balance ?? 0;
    } catch {
      return 0;
    }
  },

  getTransactions: async (
    page = 1,
    type?: string
  ): Promise<PaginatedResponse<Transaction>> => {
    const params: Record<string, string | number> = { page };
    if (type) params.type = type;
    const response = await api.get('/wallet/history', { params });
    const body = response.data;
    // API may return paginated directly or wrapped in { data: { data: [...] } }
    if (Array.isArray(body.data) && body.current_page !== undefined) {
      return body; // Standard Laravel paginated
    }
    if (body.data && Array.isArray(body.data.data)) {
      return body.data; // Wrapped in extra data key
    }
    // If body is an array directly
    if (Array.isArray(body)) {
      return { data: body, current_page: 1, last_page: 1, per_page: body.length, total: body.length };
    }
    // Fallback: return as-is and let store handle nulls
    return body;
  },

  getTransaction: async (id: number, type?: string): Promise<Transaction> => {
    const params: Record<string, string> = {};
    if (type) params.type = type;
    const response = await api.get(`/wallet/history/${id}`, { params });
    return response.data?.data ?? response.data;
  },

  getCryptoTransaction: async (id: number): Promise<Transaction> => {
    const response = await api.get(`/wallet/history/crypto/${id}`);
    return response.data?.data ?? response.data;
  },

  deposit: async (data: DepositRequest): Promise<any> => {
    const response = await api.post('/deposit/init', data);
    return response.data;
  },

  getDepositStatus: async (depositId: number): Promise<{ deposit_id: number; statut: 'wait' | 'success' | 'fail' | 'failed'; amount: number; type: string }> => {
    const response = await api.get(`/deposit/status/${depositId}`);
    return response.data;
  },

  transfer: async (
    data: TransferRequest
  ): Promise<any> => {
    const response = await api.post('/transfer', data, { timeout: 70000 });
    return response.data;
  },

  getTransferStatus: async (transferId: number): Promise<{ transfer_id: number; statut: 'wait' | 'success' | 'fail' | 'failed'; amount: number; amount_sent: number; mode: string }> => {
    const response = await api.get(`/transfer/status/${transferId}`);
    return response.data;
  },

  submitClaim: async (data: { transaction_id: number; type: string; message: string }): Promise<any> => {
    const response = await api.post('/claim', data);
    return response.data;
  },

  submitClaimCrypto: async (data: { transaction_id: number; message: string }): Promise<any> => {
    const response = await api.post('/claim/crypto', data);
    return response.data;
  },

  addNote: async (data: { transaction_id: number; message: string }): Promise<any> => {
    const response = await api.post('/wallet/note', data);
    return response.data;
  },

  getSavedPhones: async (params?: { type?: 'transfer' | 'deposit'; operator?: string }): Promise<any[]> => {
    const response = await api.get('/user/phones', { params });
    return response.data?.data ?? response.data ?? [];
  },

  saveSavedPhone: async (data: { label: string; phone: string; operator: string }): Promise<any> => {
    const response = await api.post('/user/phones', data);
    return response.data;
  },

  createSavedPhone: async (data: { tel: string; name?: string; type?: 'transfer' | 'deposit'; operator?: string }): Promise<any> => {
    const response = await api.post('/user/phones', data);
    return response.data?.data ?? response.data;
  },

  updateSavedPhone: async (id: number, data: { tel?: string; name?: string; type?: 'transfer' | 'deposit'; operator?: string }): Promise<any> => {
    const response = await api.put(`/user/phones/${id}`, data);
    return response.data?.data ?? response.data;
  },

  deleteSavedPhone: async (id: number): Promise<any> => {
    const response = await api.delete(`/user/phones/${id}`);
    return response.data;
  },

  getSavedWallets: async (): Promise<any[]> => {
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
