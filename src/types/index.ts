export interface User {
  id: number;
  name: string;
  surname: string;
  email: string;
  phone: string;
  prefix?: string;
  telegram?: string;
  country: string;
  city?: string;
  address?: string;
  idnumber?: string;
  idexp?: string;
  avatar?: string;
  balance?: number;
  validate: 0 | 1 | 2;
  group: string;
  referral_code?: string;
  created_at?: string;
  currency?: string;
  currency_source?: 'auto' | 'manual';
}

export interface Transaction {
  id: number;
  user_id: number;
  type: 'deposit' | 'withdraw' | 'transfer' | 'crypto';
  amount: number;
  amount_sent?: number;
  real?: number;
  statut: string | number;
  mode?: string;
  reference?: string;
  note?: string;
  de?: string;
  phone?: string;
  receiver_id?: number;
  receiver_name?: string;
  receiver_email?: string;
  currency_src?: string;
  dollar?: number;
  currency_dest?: string;
  address?: string;
  cp_id?: string;
  cp_hash?: string;
  provider?: string;
  tx_id?: string;
  avant?: number;
  apres?: number;
  created_at: string;
  updated_at?: string;
}

export interface SavedPhone {
  id: number;
  name?: string;
  tel: string;
  type?: 'transfer' | 'deposit';
  operator?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SavedWallet {
  id: number;
  name?: string;
  currency: string;
  address: string;
  created_at?: string;
  updated_at?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token?: string;
  user?: User;
  two_factor_required?: boolean;
  temp_token?: string;
}

export interface RegisterRequest {
  name: string;
  surname: string;
  email: string;
  password: string;
  password_confirmation: string;
  parrain_code?: string;
}

export interface AffiliationStats {
  unpayed: number;
  payed: number;
  total: number;
  children: number;
  referral_code: string;
}

export interface AffiliationChild {
  id: number;
  name: string;
  email: string;
  created_at: string | null;
}

export interface AffiliationHistoryItem {
  id: number;
  type: string;
  commission: number;
  payed: string;
  filleul_id: number;
  filleul_name: string | null;
  created_at: string | null;
}

export interface DepositRequest {
  amount: number;
  moyen: string;
  tel: string;
  otp?: string;
}

export interface TransferRequest {
  amount: number;
  moyen: string;
  tel: string;
}

// ── Merchant ──────────────────────────────────────────────────────

export interface MerchantConfig {
  business_name: string;
  slug: string;
  description?: string;
  logo?: string;
  website?: string;
  webhook_url?: string;
  commission_rate: number;
  is_verified: boolean;
  is_active: boolean;
  api_key?: string;
  created_at?: string;
}

export interface PaymentLink {
  id: number;
  slug: string;
  title: string;
  description?: string;
  amount?: number;
  currency: string;
  status: 'active' | 'disabled' | 'expired';
  expires_at?: string;
  max_uses?: number;
  uses_count: number;
  pay_url: string;
  is_usable: boolean;
  created_at?: string;
}

export interface MerchantPayment {
  id: number;
  payment_link_id: number;
  merchant_id: number;
  payer_name?: string;
  payer_phone?: string;
  payer_email?: string;
  amount: number;
  fees: number;
  net_amount: number;
  gateway: string;
  reference: string;
  status: 'pending' | 'success' | 'failed' | 'expired';
  created_at: string;
  payment_link?: { id: number; title: string; slug: string };
}

export interface MerchantStats {
  balance: number;
  total_received: number;
  total_fees: number;
  total_payments: number;
  today_received: number;
  today_count: number;
  week_received: number;
  week_count: number;
  month_received: number;
  month_count: number;
  links_count: number;
  active_links_count: number;
}

export interface CreatePaymentLinkRequest {
  title: string;
  description?: string;
  amount?: number;
  currency?: string;
  max_uses?: number;
  expires_at?: string;
  redirect_url?: string;
  metadata?: Record<string, unknown>;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}
