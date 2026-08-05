import { FINCRA_ZONES } from '../constants/config';

export type FincraCollectionRail = 'mobile_money' | 'bank_transfer' | 'checkout';

/**
 * Rails de dépôt Fincra par devise (réplique de Fincra::collectionRails()).
 * Doit rester synchronisée avec le backend.
 */
export function fincraCollectionRails(currency: string): FincraCollectionRail[] {
  const rails: FincraCollectionRail[] = [];
  if (['NGN', 'GHS', 'KES', 'UGX', 'ZMW', 'TZS', 'EGP', 'XOF', 'XAF'].includes(currency)) rails.push('mobile_money');
  if (['NGN', 'GHS', 'KES', 'TZS', 'UGX', 'ZMW', 'ZAR', 'EGP'].includes(currency)) rails.push('bank_transfer');
  if (['NGN', 'GHS', 'KES', 'ZAR', 'USD', 'EUR', 'GBP'].includes(currency)) rails.push('checkout');
  return rails;
}

// Indicatif principal par devise Fincra (utilisé quand on n'a pas de sous-pays
// sélectionné — XOF/XAF en particulier qui couvrent plusieurs pays).
const DEFAULT_DIAL: Record<string, string> = {
  NGN: '234', GHS: '233', KES: '254', UGX: '256', ZMW: '260', TZS: '255',
  RWF: '250', EGP: '20',  ZAR: '27',  XOF: '221', XAF: '237', SLE: '232',
};

// Devise → pays ISO-2 par défaut (utilisé pour le payout.beneficiary.country).
const DEFAULT_ISO2: Record<string, string> = {
  NGN: 'NG', GHS: 'GH', KES: 'KE', UGX: 'UG', ZMW: 'ZM', TZS: 'TZ',
  RWF: 'RW', EGP: 'EG', ZAR: 'ZA', XOF: 'SN', XAF: 'CM', SLE: 'SL',
};

/**
 * Résout l'indicatif et le code pays ISO-2 pour un opérateur Fincra donné.
 * Si l'utilisateur a choisi un sous-pays dans une zone XOF/XAF, celui-ci
 * a la priorité. Sinon on retombe sur le défaut de la devise.
 */
export function resolveFincraZone(currency: string, zoneCountry?: string | null): {
  dialCode: string;
  countryIso2: string;
} {
  const list = FINCRA_ZONES[currency];
  const sel = list?.find((c) => c.code === zoneCountry);
  return {
    dialCode:    sel?.phone ?? DEFAULT_DIAL[currency] ?? '',
    countryIso2: sel?.code  ?? DEFAULT_ISO2[currency] ?? '',
  };
}

/**
 * Normalise un numéro de téléphone pour Fincra.
 *
 * - Retire espaces, tirets, parenthèses, `+`, `00`
 * - Retire le `0` initial du numéro local (forme 0XX => XX)
 * - Préfixe l'indicatif pays si absent
 *
 * Le paramètre `withPlus` détermine le format de sortie :
 *   - `true`  : `+256770000000` (Direct Charge / depot)
 *   - `false` : `256770000000`  (Payout / disbursement)
 */
export function formatFincraPhone(raw: string, dialCode: string, withPlus: boolean): string {
  let p = (raw || '').replace(/[\s\-()]/g, '');
  if (p.startsWith('+')) p = p.substring(1);
  if (p.startsWith('00')) p = p.substring(2);
  if (dialCode && !p.startsWith(dialCode)) {
    p = dialCode + p.replace(/^0+/, '');
  }
  return withPlus ? '+' + p : p;
}
