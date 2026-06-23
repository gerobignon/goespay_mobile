import api from './api';
import type {
  Transaction,
  DepositRequest,
  TransferRequest,
  PaginatedResponse,
} from '../types';

export type FincraRail = 'mobile_money' | 'bank_transfer' | 'SWIFT' | 'SEPA' | 'wire' | 'cny';

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

// Bénéficiaire CNY (Chine) — payout C2C : KYC bénéficiaire + compte bancaire
// + relation avec l'expéditeur (le user).
export interface KlashaCnyBeneficiary {
  receiverFirstName: string;   // prénom (caractères chinois)
  receiverLastName: string;    // nom (caractères chinois)
  receiverIdNumber: string;    // n° pièce d'identité
  receiverMobileNumber: string;// +86…
  receiverRelationship: string;// SELF | SPOUSE | PARENTS | … (relation expéditeur↔bénéficiaire)
  receiverIdType?: string;     // ID_CARD (défaut) | HONGKONG_MACAO_TAIWAN_PERMIT
  bankCode: string;            // code CNAPS (sélecteur banques Chine)
  bankName: string;
  accountNumber: string;
  accountName: string;         // titulaire (caractères chinois)
  accountType?: string;        // INDIVIDUAL (défaut) | COMPANY
}

// Expéditeur CNY = le user GoesPay (particulier). Identité requise par la
// conformité chinoise (C2C). Prénom/nom viennent du profil côté backend.
export interface KlashaCnySender {
  nationality: string;   // ISO-2
  idType: string;        // PASSPORT | ID_CARD | …
  idNumber: string;
  city: string;
  street: string;
  state?: string;
  postcode?: string;
  countryCode: string;   // ISO-2 (pays de résidence de l'expéditeur)
}

export interface KlashaCnyRequest {
  amount: number;      // montant DESTINATION (CNY)
  amount_xof: number;  // XOF débité du wallet
  beneficiary: KlashaCnyBeneficiary;
  sender: KlashaCnySender;
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
  rail?: string | null; // bank_transfer | SWIFT | SEPA
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
  // Triangulé via USD côté backend, taux mid unique (cf. /fincra/rates).
  getFincraRate: async (currency: string): Promise<{ currency: string; rate_to_xof: number }> => {
    const response = await api.get('/fincra/rates', { params: { currency } });
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

  // Taux Klasha : 1 unité de `currency` = N XOF (pivot du wallet, swap via USD).
  getKlashaRate: async (currency: string): Promise<{ currency: string; rate_to_xof: number }> => {
    const response = await api.get('/klasha/rates', { params: { currency } });
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
