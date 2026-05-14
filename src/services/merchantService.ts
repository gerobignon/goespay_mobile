import api from './api';
import type {
  MerchantConfig,
  PaymentLink,
  MerchantPayment,
  MerchantStats,
  CreatePaymentLinkRequest,
  PaginatedResponse,
} from '../types';

export const merchantService = {
  // ── Config ──────────────────────────────────────────────────────
  async getConfig(): Promise<{ is_merchant: boolean; config: MerchantConfig | null }> {
    const { data } = await api.get('/merchant/config');
    return data;
  },

  async register(params: {
    business_name: string;
    description?: string;
    website?: string;
  }): Promise<{ message: string; config: MerchantConfig }> {
    const { data } = await api.post('/merchant/register', params);
    return data;
  },

  async updateConfig(params: Partial<Pick<MerchantConfig, 'business_name' | 'description' | 'website' | 'webhook_url'>>): Promise<void> {
    await api.put('/merchant/config', params);
  },

  // ── Payment Links ──────────────────────────────────────────────
  async getLinks(): Promise<PaymentLink[]> {
    const { data } = await api.get('/merchant/links');
    return data.links;
  },

  async createLink(params: CreatePaymentLinkRequest): Promise<PaymentLink> {
    const { data } = await api.post('/merchant/links', params);
    return data.link;
  },

  async updateLink(id: number, params: Partial<CreatePaymentLinkRequest & { status: 'active' | 'disabled' }>): Promise<void> {
    await api.put(`/merchant/links/${id}`, params);
  },

  async deleteLink(id: number): Promise<void> {
    await api.delete(`/merchant/links/${id}`);
  },

  // ── Payments ───────────────────────────────────────────────────
  async getPayments(page = 1): Promise<PaginatedResponse<MerchantPayment>> {
    const { data } = await api.get('/merchant/payments', { params: { page } });
    return data;
  },

  async getPayment(id: number): Promise<MerchantPayment> {
    const { data } = await api.get(`/merchant/payments/${id}`);
    return data;
  },

  // ── Stats ──────────────────────────────────────────────────────
  async getStats(): Promise<MerchantStats> {
    const { data } = await api.get('/merchant/stats');
    return data;
  },
};
