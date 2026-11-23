import { create } from 'zustand';
import api from '../services/api';

interface FeatureFlags {
  deposit_enabled: boolean;
  transfer_enabled: boolean;
  afribapay_enabled: boolean;
  /** Transfert compte à compte (interne au wallet, même zone monétaire). */
  p2p_enabled: boolean;
  /** Barrage ciblé du transfert compte à compte : suit celui de l'envoi. */
  p2p_blocked: boolean;
  p2p_block_message: string;
  // Blocage ciblé de CE user (admin → détail user) : bandeau sur l'écran
  // concerné. Le booléen distingue « bloqué sans message » de « non bloqué ».
  deposit_blocked: boolean;
  transfer_blocked: boolean;
  deposit_block_message: string;
  transfer_block_message: string;
}

export interface FeeConfig {
  fixed: number;   // Montant fixe en XOF
  percent: number; // Pourcentage (ex: 3.5 = 3.5%)
}

export type AlertLevel = 'info' | 'warning' | 'danger';
export interface TransactionAlert {
  message: string;
  level: AlertLevel;
}
// Les extensions (src/addons) ont leurs propres types de bandeau, servis par /config.
export type AlertType = 'deposit' | 'withdraw' | 'transfer' | (string & {});
export type TransactionAlerts = Partial<Record<AlertType, TransactionAlert>>;

export interface AppConfig {
  // Frais par défaut (fixe + pourcentage)
  transfer_fee_default: FeeConfig;
  // Frais par pays (code ISO -> { fixed, percent })
  country_fees: Record<string, FeeConfig>;
  // Frais sortants PAR DESTINATION pour le user connecté (source = son pays),
  // résolus côté backend (frais A→B). Indexé par pays ISO du destinataire.
  outgoing_fees: Record<string, FeeConfig>;
  // Limites montants (XOF)
  deposit_min: number;
  deposit_max: number; // 0 = pas de plafond
  transfer_min: number;
  transfer_max: number;
  transfer_min_world: number;
  transfer_min_ng: number;
  // Listes dynamiques
  mobile_money_countries: string[];
  // Bandeaux d'alerte par type de transaction (configurés via /admin/settings)
  transaction_alerts: TransactionAlerts;
  // Message défilant en haut de l'accueil (configuré via /admin/settings). Vide = masqué.
  site_message: string;
  // Carrousel promo de l'accueil (configuré via /admin/settings). Liste ordonnée.
  promo_slides: PromoSlideConfig[];
  // Rails internationaux disponibles pour CE user (codes corridor), par sens.
  // Calculé serveur (dim 3 si pays listé, dim 2 sinon) → groupe « International ».
  intl_rails: { payin: string[]; payout: string[] };
  // Clé VAPID publique pour les notifications Web Push (PWA). Vide si non configurée.
  vapid_public_key: string;
}

export interface PromoSlideConfig {
  image: string;
  link?: string;
}

interface ConfigState extends FeatureFlags, AppConfig {
  isLoaded: boolean;
  fetchConfig: () => Promise<void>;
}

const defaultFlags: FeatureFlags = {
  deposit_enabled: true,
  transfer_enabled: true,
  afribapay_enabled: true,
  p2p_enabled: true,
  p2p_blocked: false,
  p2p_block_message: '',
  deposit_blocked: false,
  transfer_blocked: false,
  deposit_block_message: '',
  transfer_block_message: '',
};

export const DEFAULT_APP_CONFIG: AppConfig = {
  transfer_fee_default: { fixed: 300, percent: 3.5 },
  country_fees: {
    BJ: { fixed: 300, percent: 3.5 },
    BF: { fixed: 300, percent: 3.5 },
    CI: { fixed: 300, percent: 3.5 },
    TG: { fixed: 300, percent: 3.5 },
    SN: { fixed: 300, percent: 3.5 },
    ML: { fixed: 300, percent: 3.5 },
    CM: { fixed: 300, percent: 3.5 },
  },
  outgoing_fees: {},
  deposit_min: 1000,
  deposit_max: 0,
  transfer_min: 2500,
  transfer_max: 500000,
  transfer_min_world: 5000,
  transfer_min_ng: 25000,
  mobile_money_countries: ['BJ', 'BF', 'CI', 'TG', 'SN', 'ML', 'CM'],
  transaction_alerts: {
    deposit:     { message: '', level: 'info' },
    withdraw:    { message: '', level: 'info' },
    transfer:    { message: '', level: 'info' },
  },
  site_message: '',
  promo_slides: [],
  intl_rails: { payin: [], payout: [] },
  vapid_public_key: '',
};

export const useConfigStore = create<ConfigState>((set) => ({
  ...defaultFlags,
  ...DEFAULT_APP_CONFIG,
  isLoaded: false,
  fetchConfig: async () => {
    try {
      const { data } = await api.get<FeatureFlags & AppConfig>('/config');
      // intl_rails peut manquer (backend non déployé / config non authentifiée) →
      // défaut sûr pour éviter un accès .payin sur undefined.
      set({ ...data, intl_rails: data.intl_rails ?? { payin: [], payout: [] }, isLoaded: true });
    } catch {
      // En cas d'erreur réseau, conserver les valeurs par défaut
      set({ ...defaultFlags, ...DEFAULT_APP_CONFIG, isLoaded: true });
    }
  },
}));
