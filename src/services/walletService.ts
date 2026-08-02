import api from './api';
import type {
  Transaction,
  DepositRequest,
  TransferRequest,
  PaginatedResponse,
} from '../types';

export type FincraRail = 'mobile_money' | 'bank_transfer' | 'SWIFT' | 'SEPA' | 'wire' | 'cny';

/** Compte bancaire permanent attribué au client (réutilisable, tous montants). */
export interface VirtualAccount {
  id: number;
  currency: string;
  account_number: string;
  account_name: string;
  bank_name: string;
  bank_code: string;
  status: 'pending' | 'approved' | 'declined' | 'closed';
  is_active: boolean;
  usable: boolean;
  reason?: string;
  created_at?: string | null;
}

/** Un versement encaissé sur un compte de réception. */
export interface VirtualAccountEntry {
  id: number;
  date: string | null;
  sender: string;
  /** Montant viré dans la devise du compte (null sur les crédits d'avant la colonne). */
  amount: number | null;
  currency: string;
  credited_xof: number;
  status: 'success' | 'wait' | 'fail' | string;
  reference: string;
}

export interface VirtualAccountStatement {
  account: VirtualAccount;
  /** Cumul encaissé — un compte virtuel ne retient aucun fonds. */
  total_received: number | null;
  total_xof: number;
  count: number;
  /** Reçu mais pas encore crédité (devise du compte) — 0 si tout est à jour. */
  pending_amount: number;
  pending_count: number;
  entries: VirtualAccountEntry[];
  /** Versements vus chez l'agrégateur mais non crédités (webhook perdu). */
  unreconciled?: { reference: string; amount: number; currency: string; date: string }[];
}

export interface VirtualAccountsResponse {
  accounts: VirtualAccount[];
  /** Devises ouvertes à la demande, avec l'exigence KYC du corridor. */
  available: { currency: string; requires_bvn: boolean }[];
  kyc_ok: boolean;
}

export interface FincraBeneficiary {
  firstName?: string;
  lastName?: string;
  accountHolderName?: string;
  accountNumber?: string;
  bankCode?: string;
  bankSwiftCode?: string;
  bankName?: string;
  bankCountry?: string;
  country?: string;
  swiftCode?: string;
  iban?: string;
  bic?: string;
  type?: 'individual' | 'corporate';
}

export interface FincraPayoutRequest {
  amount: number;        // montant LIVRÉ au bénéficiaire (devise Fincra : NGN/GHS/…)
  amount_xof: number;    // montant XOF saisi par l'utilisateur (base du débit wallet)
  quote_id?: string;     // devis serveur affiché → rejoué à l'identique par le backend
  currency: string;
  rail: FincraRail;
  sourceCurrency?: string;
  phone?: string;
  operator?: string;
  country?: string;
  beneficiary?: FincraBeneficiary;
}

export interface FincraPayoutResponse {
  message?: string;
  status: 'wait' | 'success' | 'fail';
  reference: string;
  transfer_id: number;
  amount: number;
  amount_sent: number;
  fees: number;
  fincra_balance: number;
}

// Klasha Wire (transfert international USD/EUR/GBP) — process Klasha (bénéficiaire
// → quote → initiate côté backend). Champs requis par la Klasha Wire API.
export interface KlashaWireBeneficiary {
  beneficiaryName: string;
  accountNumber: string;
  bankName: string;
  swiftCode: string;
  country: string;        // nom du pays du bénéficiaire (ex. "United States")
  countryCode: string;    // ISO-2 (ex. "US")
  iban?: string;
  routingNumber?: string; // US uniquement
  bankAddress?: string;
  beneficiaryAddress?: string;
  phone?: string;
  email?: string;
  narration?: string;
}

export interface KlashaWireRequest {
  amount: number;      // montant DESTINATION (USD/EUR/GBP)
  currency: string;    // USD | EUR | GBP
  amount_xof: number;  // XOF débité du wallet
  beneficiary: KlashaWireBeneficiary;
}

// Service de payout Chine : virement bancaire, carte UnionPay, ou wallet Alipay.
export type KlashaCnyService = 'BANK_ACCOUNT' | 'BANK_CARD' | 'WALLET';

// Bénéficiaire CNY (Chine) — champs variables selon le service. L'expéditeur (le
// user) est auto-rempli côté backend depuis le profil KYC → non transmis ici.
export interface KlashaCnyBeneficiary {
  receiverFirstName: string;     // prénom (caractères chinois) — tous services
  receiverLastName: string;      // nom (caractères chinois) — tous services
  // BANK_ACCOUNT + WALLET :
  receiverIdNumber?: string;     // n° pièce d'identité
  receiverRelationship?: string; // SELF | SPOUSE | PARENTS | …
  receiverIdType?: string;       // ID_CARD (défaut)
  receiverMobileNumber?: string; // +86… (BANK_ACCOUNT)
  // BANK_ACCOUNT + BANK_CARD :
  bankCode?: string;             // code CNAPS (sélecteur banques Chine)
  bankName?: string;
  // BANK_ACCOUNT :
  accountNumber?: string;
  accountName?: string;          // titulaire (caractères chinois)
  accountType?: string;          // INDIVIDUAL (défaut)
  // BANK_CARD (UnionPay) :
  cardNumber?: string;
  cardHolderName?: string;
  // WALLET (Alipay) : accountNumber = email|mobile, accountId = MOBILE|EMAIL.
  accountId?: string;
}

export interface KlashaCnyRequest {
  amount: number;            // montant DESTINATION (CNY)
  amount_xof: number;        // XOF débité du wallet
  quote_id?: string;         // devis serveur (porte le quotationId Klasha coté)
  service: KlashaCnyService;
  // Wallet chinois (service WALLET) : Alipay (défaut) ou WeChat → serviceCode Klasha.
  serviceCode?: 'ALIPAY' | 'WECHAT';
  beneficiary: KlashaCnyBeneficiary;
  // L'expéditeur (identité + date de naissance + adresse) vient du profil KYC,
  // côté backend → non transmis ici.
}

// ── Devis d'envoi (backend) ────────────────────────────────────────────────
// Le backend est la SEULE source des montants affichés : l'app ne convertit
// plus rien elle-même. On affiche le devis, puis on l'exécute via `quote_id`
// → ce qui est montré est exactement ce qui est débité.
export interface TransferQuoteRequest {
  aggregator: 'fincra' | 'klasha';
  rail: 'mobile_money' | 'bank_transfer' | 'SWIFT' | 'SEPA' | 'cny';
  currency: string;
  amount_xof?: number;   // saisie en XOF (rails classiques)
  amount_dest?: number;  // saisie dans la devise destination (Chine : le client achète des CNY)
  country?: string;      // pays destination (frais A→B) ; dérivé de la devise sinon
  operator?: string;
  service?: KlashaCnyService;          // Chine
  serviceCode?: 'ALIPAY' | 'WECHAT';   // Chine (wallet)
}

export interface TransferQuote {
  quote_id: string;
  currency: string;
  send_amount: number;   // reçu par le bénéficiaire (devise destination)
  rate: number | null;   // XOF pour 1 unité de devise
  amount_xof: number;    // XOF envoyé (hors frais)
  fee_xof: number;
  total_xof: number;     // débit wallet total
  expires_at: number;    // timestamp UNIX (secondes)
}

export interface DepositQuote {
  quote_id: string;
  currency: string;
  amount: number;        // encaissé dans la devise du moyen
  credit_xof: number;    // crédité au wallet
  rate: number;          // XOF pour 1 unité de devise
  expires_at: number;
}

export interface SavedBank {
  id: number;
  name?: string | null;
  account_holder?: string | null;
  account_number?: string | null;
  bank_code?: string | null;
  bank_name?: string | null;
  currency?: string | null;
  country?: string | null;
  swift_code?: string | null;
  iban?: string | null;
  rail?: string | null; // bank_transfer | SWIFT | SEPA | cny
  // Chine (Klasha C2C) : champs spécifiques portés hors colonnes standard.
  meta?: Record<string, any> | null;
  created_at?: string;
  updated_at?: string;
}

export const walletService = {
  getBalance: async (): Promise<{ balance: number; balance_fincra?: number }> => {
    const response = await api.get('/wallet/balance');
    // Handle both { balance: 123 } and { data: { balance: 123 } }
    const body = response.data;
    if (body.balance !== undefined) return body;
    if (body.data?.balance !== undefined) return body.data;
    return { balance: body.data ?? body ?? 0 };
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

  // Totaux du mois courant (agrégation serveur, exacte). Indépendant de la
  // pagination de l'historique → ne « baisse » pas quand de nouvelles ops arrivent.
  getInsights: async (): Promise<{ deposit_month: number; sent_month: number; count_month: number }> => {
    const response = await api.get('/me/insights');
    return response.data;
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

  getDepositStatus: async (depositId: number): Promise<{ deposit_id: number; statut: 'wait' | 'success' | 'fail' | 'failed'; amount: number; type: string; user_error?: string | null }> => {
    const response = await api.get(`/deposit/status/${depositId}`);
    return response.data;
  },

  getFincraDepositStatus: async (ref: string): Promise<{ status: 'wait' | 'success' | 'fail'; user_error?: string | null }> => {
    const response = await api.get(`/deposit/fincra/status/${ref}`);
    return response.data;
  },

  // Soumet l'OTP d'une charge MM Fincra (opérateurs en auth_model=OTP, ex. Orange SN).
  authorizeFincraDeposit: async (payload: { charge_id: string; otp: string }): Promise<{ status: string }> => {
    const response = await api.post('/deposit/fincra/authorize', payload, { timeout: 60000 });
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

  fincraPayout: async (payload: FincraPayoutRequest): Promise<FincraPayoutResponse> => {
    const response = await api.post('/payout/fincra', payload, { timeout: 70000 });
    return response.data;
  },

  getFincraPayoutStatus: async (reference: string): Promise<{ transfer_id: number; statut: 'wait' | 'success' | 'fail' | 'failed'; amount: number; amount_sent: number; mode: string }> => {
    const response = await api.get(`/payout/fincra/status/${encodeURIComponent(reference)}`);
    return response.data;
  },

  getFincraPayoutRails: async (currency: string): Promise<{ currency: string; rails: FincraRail[] }> => {
    const response = await api.get('/fincra/payout-rails', { params: { currency } });
    return response.data;
  },

  getFincraBanks: async (currency: string, country: string): Promise<{ currency: string; country: string; banks: { code: string; name: string; swiftCode?: string }[] }> => {
    const response = await api.get('/fincra/banks', { params: { currency, country } });
    return response.data;
  },

  // Taux de conversion Fincra : 1 unité de `currency` = N XOF (pivot du wallet).
  // Direct + directionnel côté backend (side sell=dépôt / buy=payout), cf.
  // /fincra/rates. forDeposit → taux d'encaissement (≠ versement).
  getFincraRate: async (currency: string, forDeposit = false, zone: 'XOF' | 'XAF' = 'XOF'): Promise<{ currency: string; rate_to_xof: number }> => {
    const params: Record<string, string> = { currency };
    if (forDeposit) params.for = 'deposit';
    if (zone === 'XAF') params.zone = 'XAF';   // pivot de cotation (CEMAC) ; XOF = défaut
    const response = await api.get('/fincra/rates', { params });
    return response.data;
  },

  resolveFincraAccount: async (payload: {
    accountNumber?: string;
    bankCode?: string;
    type: 'nuban' | 'bank_account' | 'mobile_money' | 'iban';
    currency: string;
    bankSwiftCode?: string;
    iban?: string;
  }): Promise<{ resolved: boolean; accountName: string | null; raw: any }> => {
    const response = await api.post('/fincra/resolve-account', payload);
    return response.data;
  },

  // ── Comptes bancaires permanents (un par client et par devise) ──
  // Contrairement au compte temporaire régénéré à chaque recharge, celui-ci
  // appartient au client : il le réutilise pour n'importe quel montant.
  getVirtualAccounts: async (): Promise<VirtualAccountsResponse> => {
    const response = await api.get('/fincra/virtual-accounts');
    return {
      accounts: response.data?.accounts ?? [],
      available: response.data?.available ?? [],
      kyc_ok: !!response.data?.kyc_ok,
    };
  },

  createVirtualAccount: async (payload: { currency: string; bvn?: string }): Promise<VirtualAccount> => {
    const response = await api.post('/fincra/virtual-accounts', payload, { timeout: 70000 });
    return response.data?.account;
  },

  syncVirtualAccount: async (id: number): Promise<VirtualAccount> => {
    const response = await api.post(`/fincra/virtual-accounts/${id}/sync`, {}, { timeout: 40000 });
    return response.data?.account;
  },

  // Relevé d'un compte de réception. `reconcile` interroge en plus l'agrégateur
  // pour révéler d'éventuels versements non crédités (webhook perdu).
  getVirtualAccountStatement: async (id: number, reconcile = false): Promise<VirtualAccountStatement> => {
    const response = await api.get(`/fincra/virtual-accounts/${id}/statement`, {
      params: reconcile ? { reconcile: 1 } : undefined,
      timeout: reconcile ? 40000 : 20000,
    });
    return response.data;
  },

  // ── Klasha (4e agrégateur — mêmes patterns que Fincra) ──
  klashaDeposit: async (payload: {
    amount: number; currency: string; method: 'mobile_money' | 'bank_transfer' | 'card';
    operator?: string; phone?: string; country?: string; code?: string; card?: any;
  }): Promise<any> => {
    const response = await api.post('/deposit/klasha', payload, { timeout: 70000 });
    return response.data;
  },

  getKlashaDepositStatus: async (ref: string): Promise<{ status: 'wait' | 'success' | 'fail'; user_error?: string | null }> => {
    const response = await api.get(`/deposit/klasha/status/${ref}`);
    return response.data;
  },

  // Soumet l'OTP d'une charge MM/carte Klasha (par référence KLD-).
  authorizeKlashaDeposit: async (payload: { reference: string; otp: string; currency?: string; type?: string }): Promise<{ status: string }> => {
    const response = await api.post('/deposit/klasha/authorize', payload, { timeout: 60000 });
    return response.data;
  },

  klashaPayout: async (payload: FincraPayoutRequest): Promise<FincraPayoutResponse> => {
    const response = await api.post('/payout/klasha', payload, { timeout: 70000 });
    return response.data;
  },

  getKlashaPayoutStatus: async (reference: string): Promise<{ transfer_id: number; statut: 'wait' | 'success' | 'fail' | 'failed'; amount: number; amount_sent: number; mode: string }> => {
    const response = await api.get(`/payout/klasha/status/${encodeURIComponent(reference)}`);
    return response.data;
  },

  getKlashaPayoutRails: async (currency: string): Promise<{ currency: string; rails: string[] }> => {
    const response = await api.get('/klasha/payout-rails', { params: { currency } });
    return response.data;
  },

  getKlashaBanks: async (currency: string): Promise<{ currency: string; banks: { code: string; name: string }[] }> => {
    const response = await api.get('/klasha/banks', { params: { currency } });
    return response.data;
  },

  // Taux Klasha : 1 unité de `currency` = N XOF (pivot du wallet).
  // forDeposit → taux direct (sans triangulation), cohérent avec la charge dépôt ;
  // sinon (payout) → triangulé via USD.
  getKlashaRate: async (currency: string, forDeposit = false, zone: 'XOF' | 'XAF' = 'XOF'): Promise<{ currency: string; rate_to_xof: number }> => {
    const params: Record<string, string> = { currency };
    if (forDeposit) params.for = 'deposit';
    if (zone === 'XAF') params.zone = 'XAF';   // pivot de cotation (CEMAC) ; XOF = défaut
    const response = await api.get('/klasha/rates', { params });
    return response.data;
  },

  getKlashaMobileMoneyOperators: async (country: string): Promise<{ country: string; operators: string[] }> => {
    const response = await api.get('/klasha/mobile-money-operators', { params: { country } });
    return response.data;
  },

  resolveKlashaAccount: async (payload: { accountNumber: string; bankCode: string; currency: string }): Promise<{ resolved: boolean; accountName: string | null; raw: any }> => {
    const response = await api.post('/klasha/resolve-account', payload);
    return response.data;
  },

  // Wire international Klasha (USD/EUR/GBP). Le backend orchestre bénéficiaire→quote→initiate.
  klashaWire: async (payload: KlashaWireRequest): Promise<FincraPayoutResponse> => {
    const response = await api.post('/transfer/klasha/wire', payload, { timeout: 70000 });
    return response.data;
  },

  // Statut d'un wire (par notre réf KLW-) : le backend poll Klasha par sa transactionReference.
  getKlashaWireStatus: async (reference: string): Promise<{ transfer_id: number; statut: 'wait' | 'success' | 'fail' | 'failed'; amount: number; amount_sent: number; mode: string }> => {
    const response = await api.get(`/transfer/klasha/wire/status/${encodeURIComponent(reference)}`);
    return response.data;
  },

  // Devis d'envoi : montants calculés par le backend (taux + frais), à afficher
  // tels quels puis à exécuter via `quote_id`.
  createTransferQuote: async (payload: TransferQuoteRequest): Promise<TransferQuote> => {
    const response = await api.post('/transfer/quote', payload, { timeout: 45000 });
    return response.data;
  },

  // Devis de dépôt : crédit XOF figé par le backend pour un encaissement en devise.
  createDepositQuote: async (payload: {
    aggregator: 'fincra' | 'klasha';
    currency: string;
    amount: number;
    method?: string;
  }): Promise<DepositQuote> => {
    const response = await api.post('/deposit/quote', payload, { timeout: 45000 });
    return response.data;
  },

  // Payout CNY (Chine) C2C. Le backend orchestre quote→initiate (corps 3DES).
  klashaCny: async (payload: KlashaCnyRequest): Promise<FincraPayoutResponse> => {
    const response = await api.post('/transfer/klasha/cny', payload, { timeout: 70000 });
    return response.data;
  },

  // Statut d'un payout CNY (par notre réf KLC-) : terminal posé par le webhook Klasha.
  getKlashaCnyStatus: async (reference: string): Promise<{ transfer_id: number; statut: 'wait' | 'success' | 'fail' | 'failed'; amount: number; amount_sent: number; mode: string }> => {
    const response = await api.get(`/transfer/klasha/cny/status/${encodeURIComponent(reference)}`);
    return response.data;
  },

  // Banques chinoises (code CNAPS + nom) pour le sélecteur du formulaire Chine.
  getKlashaChinaBanks: async (): Promise<{ code: string; name: string }[]> => {
    const response = await api.get('/transfer/klasha/cny/banks');
    return response.data?.data ?? [];
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

  // Bénéficiaires bancaires enregistrés (virement Fincra).
  getSavedBanks: async (): Promise<SavedBank[]> => {
    const response = await api.get('/user/bank-accounts');
    return response.data?.data ?? response.data ?? [];
  },

  createSavedBank: async (data: Partial<SavedBank>): Promise<SavedBank> => {
    const response = await api.post('/user/bank-accounts', data);
    return response.data?.data ?? response.data;
  },

  updateSavedBank: async (id: number, data: Partial<SavedBank>): Promise<SavedBank> => {
    const response = await api.put(`/user/bank-accounts/${id}`, data);
    return response.data?.data ?? response.data;
  },

  deleteSavedBank: async (id: number): Promise<any> => {
    const response = await api.delete(`/user/bank-accounts/${id}`);
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
