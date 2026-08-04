import api from './api';

/** Qui supporte les frais d'encaissement du paiement. */
export type FeeBearer = 'payer' | 'owner';

export interface PayLink {
  id: number;
  code: string;
  /** URL publique à partager (page de paiement, ouverte sans compte). */
  url: string;
  title: string;
  description: string;
  /** null = le payeur saisit le montant. */
  amount: number | null;
  currency: string;
  reusable: boolean;
  max_uses: number | null;
  uses_count: number;
  fee_bearer: FeeBearer;
  expires_at: string | null;
  is_active: boolean;
  /** Encore payable (actif, non expiré, quota non atteint). */
  open: boolean;
  closed_reason: 'disabled' | 'expired' | 'used' | null;
  /** Cumul reçu sur ce lien (XOF). */
  received: number;
  created_at: string | null;
}

export interface PayLinkPayment {
  id: number;
  reference: string;
  payer_name: string;
  amount: number;
  fee: number;
  status: 'pending' | 'success' | 'fail';
  created_at: string | null;
}

export interface CreatePayLinkInput {
  title: string;
  description?: string;
  /** Omis = montant libre. */
  amount?: number;
  reusable?: boolean;
  max_uses?: number;
  fee_bearer?: FeeBearer;
  expires_at?: string;
}

export const paylinkService = {
  list: async (): Promise<PayLink[]> => {
    const response = await api.get('/me/paylinks');
    return response.data.links ?? [];
  },

  create: async (data: CreatePayLinkInput): Promise<PayLink> => {
    const response = await api.post('/me/paylinks', data);
    return response.data.link;
  },

  update: async (id: number, data: Partial<Pick<PayLink, 'title' | 'description' | 'is_active' | 'expires_at'>>): Promise<PayLink> => {
    const response = await api.put(`/me/paylinks/${id}`, data);
    return response.data.link;
  },

  remove: async (id: number): Promise<void> => {
    await api.delete(`/me/paylinks/${id}`);
  },

  payments: async (id: number): Promise<PayLinkPayment[]> => {
    const response = await api.get(`/me/paylinks/${id}/payments`);
    return response.data.payments ?? [];
  },
};
