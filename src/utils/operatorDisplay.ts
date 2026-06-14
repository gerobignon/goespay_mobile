import { OPERATORS } from '../constants/config';
import { useCatalogStore } from '../stores/catalogStore';

// Drapeau du pays bénéficiaire dérivé de la devise Fincra (le « pays »).
const FINCRA_CUR_FLAG: Record<string, string> = {
  NGN: '🇳🇬', GHS: '🇬🇭', KES: '🇰🇪', UGX: '🇺🇬', ZMW: '🇿🇲', TZS: '🇹🇿',
  ZAR: '🇿🇦', EGP: '🇪🇬', USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧',
};

// Libellé propre par rail Fincra (jamais la string brute « fincra-… »).
const FINCRA_RAIL_LABEL: Record<string, string> = {
  bank_transfer: 'Virement bancaire',
  bank: 'Virement bancaire',
  mobile_money: 'Mobile Money',
  mm: 'Mobile Money',
  checkout: 'Carte bancaire',
  card: 'Carte bancaire',
};

export interface OperatorDisplay {
  name: string;
  flag: string;
  /** Objet opérateur pour <OperatorLogo>, ou null si non résolu. */
  op: any;
}

/**
 * Résout un `mode` de transaction (ex. mtn-benin, fincra-bank_transfer) en un
 * affichage propre { nom, drapeau, op }. SOURCE UNIQUE partagée par l'historique,
 * le détail et le reçu → plus de divergence entre écrans.
 */
export function resolveOperatorDisplay(
  mode?: string | null,
  currencyDest?: string | null,
): OperatorDisplay | null {
  if (!mode) return null;
  const found =
    useCatalogStore.getState().operators.find((o) => o.id === mode) ||
    (OPERATORS as unknown as any[]).find((o) => o.id === mode);
  if (found) return { name: String(found.name), flag: String(found.flag || ''), op: found };

  const m = mode.match(/^fincra-(bank_transfer|bank|mobile_money|mm|checkout|card)$/i);
  if (m) {
    const rail = m[1].toLowerCase();
    const name = FINCRA_RAIL_LABEL[rail] || 'Fincra';
    const flag = currencyDest ? (FINCRA_CUR_FLAG[currencyDest.toUpperCase()] || '') : '';
    return { name, flag, op: { fincra: true, rail: rail === 'mm' ? 'mobile_money' : rail } };
  }
  return { name: mode, flag: '', op: null };
}
