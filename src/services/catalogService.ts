import api from './api';

// Référentiel serveur (P3) — piloté par l'admin « Marchés » (tables normalisées
// countries/currencies/networks + corridors aggregator_routing).
export interface CatalogCountry {
  code: string;
  name: string;
  flag: string;
  dial_code: string;
  currency_code: string;
  zone: string | null;
}
export interface CatalogCurrency {
  code: string;
  name: string;
  decimals: number;
  symbol: string | null;
}
export interface CatalogNetwork {
  code: string;
  label: string;
  logo_key: string;
  kind: string; // mobile_money | bank | card
}
export interface CatalogCorridor {
  code: string;        // = identifiant opérateur (ex: orange-money-ci, fincra-xof-mm)
  aggregator: string;  // paydunya | afribapay | fincra | nowpayments | …
  country: string;     // ISO-2 ou zone (XOF/XAF)
  network: string;
  currency: string;
  payin: boolean;
  payout: boolean;
  audience?: string;
  // Montant minimum d'envoi, dans la devise du corridor (ex. 100 EUR en SEPA).
  // null = pas de minimum imposé par GoesPay.
  min_payout_amount?: number | null;
}
export interface CatalogResponse {
  countries: CatalogCountry[];
  currencies: CatalogCurrency[];
  networks: CatalogNetwork[];
  corridors: CatalogCorridor[];
  payout_countries: string[];
}

export const catalogService = {
  getCatalog: async (): Promise<CatalogResponse> => {
    const { data } = await api.get('/catalog');
    return {
      countries: data.countries ?? [],
      currencies: data.currencies ?? [],
      networks: data.networks ?? [],
      corridors: data.corridors ?? [],
      payout_countries: data.payout_countries ?? [],
    };
  },
};
