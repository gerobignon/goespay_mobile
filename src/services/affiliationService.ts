import api from './api';
import type {
  AffiliationStats,
  AffiliationChild,
  AffiliationHistoryItem,
  PaginatedResponse,
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
};
