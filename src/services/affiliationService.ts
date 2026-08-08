import api from './api';
import type {
  AffiliationStats,
  AffiliationChild,
  AffiliationHistoryItem,
  PaginatedResponse,
  WelcomeBonus,
} from '../types';

export const affiliationService = {
  getStats: async (): Promise<AffiliationStats> => {
    const { data } = await api.get<AffiliationStats>('/me/affiliation/stats');
    return data;
  },

  getChildren: async (page = 1): Promise<PaginatedResponse<AffiliationChild>> => {
    const { data } = await api.get<PaginatedResponse<AffiliationChild>>('/me/affiliation/children', {
      params: { page },
    });
    return data;
  },

  getHistory: async (page = 1): Promise<PaginatedResponse<AffiliationHistoryItem>> => {
    const { data } = await api.get<PaginatedResponse<AffiliationHistoryItem>>('/me/affiliation/history', {
      params: { page },
    });
    return data;
  },

  claim: async (): Promise<{ message: string; claimed: number; balance_after: number }> => {
    const { data } = await api.post('/me/affiliation/claim');
    return data;
  },

  updateCode: async (code: string): Promise<{ message: string; referral_code: string }> => {
    const { data } = await api.put('/me/affiliation/code', { code });
    return data;
  },

  getWelcomeBonus: async (): Promise<WelcomeBonus> => {
    const { data } = await api.get<WelcomeBonus>('/me/welcome-bonus');
    return data;
  },

  /** L'annonce du déblocage a été vue : mémorisé au compte, pas à l'appareil. */
  markBonusCelebrated: async (): Promise<void> => {
    await api.post('/me/welcome-bonus/celebrated', {});
  },
};
