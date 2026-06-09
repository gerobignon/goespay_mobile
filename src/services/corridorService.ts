import api from './api';

/**
 * Corridors de routing pilotés par le serveur (table aggregator_routing).
 * Source unique pour l'affichage des opérateurs disponibles + le badge
 * "corridor temporairement indisponible".
 */
export interface Corridor {
  code: string;      // = id d'opérateur (mtn-ci, mtn-cm, fincra-ngn-mm, card…)
  aggregator: string;
  country: string;   // ISO-2 (BJ, CM, NG…), INTL, ou zone (XOF/XAF)
  network: string;   // mtn | orange | moov | wave | mobile_money | bank | card
  currency: string | null;
  payin: boolean;
  payout: boolean;
  audience: 'all' | 'vip';
}

export interface CorridorsResponse {
  corridors: Corridor[];
  payout_countries: string[];
}

export const corridorService = {
  getCorridors: async (): Promise<CorridorsResponse> => {
    const { data } = await api.get<CorridorsResponse>('/corridors');
    return {
      corridors: data?.corridors ?? [],
      payout_countries: data?.payout_countries ?? [],
    };
  },

  // Inscription à la liste d'attente d'un pays (notification mail au rétablissement).
  joinWaitlist: async (country: string): Promise<{ ok: boolean; country: string }> => {
    const { data } = await api.post('/corridors/waitlist', { country });
    return data;
  },
};
