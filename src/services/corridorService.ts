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
  // Audience « International » (users de pays non listés) — toggles indépendants.
  intl_payin?: boolean;
  intl_payout?: boolean;
  audience: 'all' | 'vip';
}

export interface CorridorsResponse {
  corridors: Corridor[];
  payout_countries: string[];
}

export interface CatalogCountry {
  code: string;
  name: string;
  flag: string | null;
  dial_code: string | null;
  currency_code: string;
  zone: string | null;
}
export interface CatalogCurrency {
  code: string;
  name: string | null;
  decimals: number;
  symbol: string | null;
}
export interface CatalogNetwork {
  code: string;
  label: string;
  logo_key: string | null;
  kind: string;
}
export interface CatalogResponse extends CorridorsResponse {
  countries: CatalogCountry[];
  currencies: CatalogCurrency[];
  networks: CatalogNetwork[];
}

export const corridorService = {
  getCorridors: async (): Promise<CorridorsResponse> => {
    const { data } = await api.get<CorridorsResponse>('/corridors');
    return {
      corridors: data?.corridors ?? [],
      payout_countries: data?.payout_countries ?? [],
    };
  },

  // Catalogue complet server-driven (pays, devises, réseaux, corridors).
  getCatalog: async (): Promise<CatalogResponse> => {
    const { data } = await api.get<CatalogResponse>('/catalog');
    return {
      countries: data?.countries ?? [],
      currencies: data?.currencies ?? [],
      networks: data?.networks ?? [],
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
