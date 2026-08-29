import api from './api';

/**
 * Cartes virtuelles USD.
 *
 * L'émission est ASYNCHRONE côté émetteur : `issue()` renvoie une carte au statut
 * `pending`, et c'est `get()` (interrogé en boucle) ou une notification qui
 * confirme le passage à `active`.
 *
 * Les secrets (numéro complet, CVV) ont leur propre appel, précédé d'une
 * confirmation par le verrou de l'appareil (code ou biométrie) : le mot de passe
 * du compte n'y a plus sa part — beaucoup de comptes n'en ont pas, la connexion
 * se faisant par code reçu par mail. Ils ne doivent JAMAIS être stockés : ni state
 * persistant, ni AsyncStorage, ni SafeStorage — sur le web ce dernier est du
 * localStorage en clair.
 */

export type CardStatus = 'creating' | 'pending' | 'active' | 'frozen' | 'terminated' | 'failed';

export interface BillingAddress {
  street?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
}

export interface VirtualCard {
  id: number;
  brand: string;
  currency: string;
  masked_pan: string;
  last4: string;
  expiry_month: string;
  expiry_year: string;
  status: CardStatus;
  /** Utilisable pour payer (active et confirmée par l'émetteur). */
  usable: boolean;
  /** Émission encore en cours : la carte peut encore devenir active. */
  pending: boolean;
  /** Solde en USD. */
  balance: number;
  nickname: string;
  /** Adresse imposée par l'émetteur, requise par certains marchands. */
  billing_address: BillingAddress | null;
  /** Motif d'échec, à afficher quand status === 'failed'. */
  reason: string;
  /**
   * Code de vérification de l'activation sans contact (ajout au portefeuille du
   * téléphone). L'émetteur ne l'envoie qu'à nous : c'est le seul endroit où le
   * porteur peut le lire. Null hors de cette fenêtre.
   */
  activation_code: string | null;
  created_at: string | null;
}

/** Données sensibles : à garder en mémoire, jamais à persister. */
export interface CardSecrets {
  pan: string;
  cvv: string;
  expiry_month: string;
  expiry_year: string;
  holder: string;
  billing_address: BillingAddress | null;
}

export interface CardTransaction {
  id: number;
  reference: string;
  type: string;
  mode: 'CREDIT' | 'DEBIT' | string;
  credit: boolean;
  amount: number;
  fee: number;
  currency: string;
  auth_amount: number | null;
  auth_currency: string | null;
  merchant: string;
  country: string;
  description: string;
  status: string;
  settled: boolean;
  date: string | null;
}

export interface CardEligibility {
  kyc_ok: boolean;
  country_ok: boolean;
  can_order: boolean;
  /** 'profile' = KYC validé, mais l'émetteur exige des champs absents du dossier. */
  reason: 'country' | 'kyc' | 'profile' | null;
  /** Champs KYC à compléter avant de pouvoir commander. */
  missing: string[];
  /** Le dossier doit être re-soumis, puis validé à nouveau. */
  needs_kyc_update: boolean;
}

/** Grille affichée au client, en USD. Pilotée depuis le back-office. */
export interface CardFeeGrid {
  rate_usd_xof: number;
  /** Taux du retrait carte → wallet. 0 = même taux qu'au rechargement. */
  withdraw_rate_usd_xof: number;
  issue_fee_usd: number;
  fund_percent_low: number;
  fund_fee_min_usd: number;
  fund_threshold_usd: number;
  fund_percent_high: number;
  withdraw_fee_usd: number;
  payment_fee_usd: number;
  monthly_fee_usd: number;
}

/**
 * Frais des conditions générales. Réels, mais rares : ils n'ont leur place que
 * dans les CGU, jamais sur un écran d'opération.
 */
export interface CardTermsFees {
  fx_percent: number;
  fx_fixed_usd: number;
  decline_fee_usd: number;
  chargeback_fee_usd: number;
}

export interface CardPricing {
  currency: string;
  /** XOF pour 1 USD, marge comprise. null si aucun taux n'est disponible. */
  rate: number | null;
  min_fund: number | null;
  max_fund: number | null;
  /** Préfinancement minimum d'une émission, imposé par l'émetteur (USD). */
  min_issue?: number | null;
  card?: CardFeeGrid | null;
  terms?: CardTermsFees | null;
}

export interface CardsResponse {
  cards: VirtualCard[];
  enabled: boolean;
  eligibility: CardEligibility;
  pricing: CardPricing;
}

export interface CardQuote {
  amount_usd: number;
  rate: number;
  amount_xof: number;
  /** Frais de l'opération (recharge ou retrait). */
  fee_usd?: number;
  fee_xof: number;
  /** Frais de création — présents uniquement sur le devis d'une commande. */
  issue_fee_usd?: number;
  issue_fee_xof?: number;
  /**
   * Ce que le client paie (recharge, commande) ou reçoit (retrait), frais
   * compris. Le détail se lit en USD, ce total est la seule conversion.
   */
  total_usd?: number;
  total_xof: number;
  direction: 'fund' | 'withdraw';
}

export const cardService = {
  list: async (): Promise<CardsResponse> => {
    const response = await api.get('/maplerad/cards');
    return response.data;
  },

  get: async (id: number): Promise<VirtualCard> => {
    const response = await api.get(`/maplerad/cards/${id}`);
    return response.data.card;
  },

  /** Prépare le client chez l'émetteur. Renvoie les champs de profil manquants. */
  enroll: async (): Promise<{ tier: number; can_issue: boolean }> => {
    const response = await api.post('/maplerad/customer', {});
    return response.data.customer;
  },

  /** Commande une carte. La carte revient `pending` : l'émission est asynchrone. */
  issue: async (input: { brand?: string; initial_amount_usd?: number } = {}): Promise<VirtualCard> => {
    const response = await api.post('/maplerad/cards', input, { timeout: 70000 });
    return response.data.card;
  },

  /**
   * Coût en XOF du préfinancement d'une carte à commander. Distinct de `quote`,
   * qui suppose une carte existante : ici la carte n'existe pas encore.
   */
  issueQuote: async (amountUsd: number): Promise<CardQuote> => {
    const response = await api.post('/maplerad/issue-quote', { amount_usd: amountUsd }, { timeout: 45000 });
    return response.data;
  },

  quote: async (id: number, amountUsd: number, direction: 'fund' | 'withdraw' = 'fund'): Promise<CardQuote> => {
    const response = await api.post(`/maplerad/cards/${id}/quote`, {
      amount_usd: amountUsd,
      direction,
    }, { timeout: 45000 });
    return response.data;
  },

  fund: async (id: number, amountUsd: number): Promise<{ status: string; card?: VirtualCard; wallet?: number }> => {
    const response = await api.post(`/maplerad/cards/${id}/fund`, { amount_usd: amountUsd }, { timeout: 70000 });
    return response.data;
  },

  withdraw: async (id: number, amountUsd: number): Promise<{ status: string; card?: VirtualCard; wallet?: number }> => {
    const response = await api.post(`/maplerad/cards/${id}/withdraw`, { amount_usd: amountUsd }, { timeout: 70000 });
    return response.data;
  },

  /**
   * Numéro complet et CVV. Le résultat ne doit jamais quitter la mémoire du
   * composant appelant : pas de cache, pas de store, pas de journalisation.
   *
   * L'appel est précédé, côté app, d'une confirmation par le verrou de
   * l'appareil (code ou biométrie) : c'est elle qui autorise le geste.
   */
  secrets: async (id: number): Promise<CardSecrets> => {
    const response = await api.post(`/maplerad/cards/${id}/secrets`, {}, { timeout: 30000 });
    return response.data;
  },

  freeze: async (id: number): Promise<VirtualCard> => {
    const response = await api.post(`/maplerad/cards/${id}/freeze`, {}, { timeout: 45000 });
    return response.data.card;
  },

  unfreeze: async (id: number): Promise<VirtualCard> => {
    const response = await api.post(`/maplerad/cards/${id}/unfreeze`, {}, { timeout: 45000 });
    return response.data.card;
  },

  terminate: async (id: number): Promise<VirtualCard> => {
    const response = await api.post(`/maplerad/cards/${id}/terminate`, { confirm: true }, { timeout: 45000 });
    return response.data.card;
  },

  transactions: async (id: number, opts: { page?: number; reconcile?: boolean } = {}): Promise<CardTransaction[]> => {
    const response = await api.get(`/maplerad/cards/${id}/transactions`, {
      params: { page: opts.page ?? 1, reconcile: opts.reconcile ? 1 : undefined },
    });
    return response.data.entries ?? [];
  },

  /** Le porteur a noté son code d'activation : il disparaît de l'écran. */
  activationSeen: async (id: number): Promise<VirtualCard> => {
    const response = await api.post(`/maplerad/cards/${id}/activation-seen`, {});
    return response.data.card;
  },

  rename: async (id: number, nickname: string): Promise<VirtualCard> => {
    const response = await api.put(`/maplerad/cards/${id}`, { nickname });
    return response.data.card;
  },
};
