import { OPERATORS } from '../constants/config';
import { useCatalogStore } from '../stores/catalogStore';

// Drapeau du pays bénéficiaire dérivé de la devise Fincra (le « pays »).
const FINCRA_CUR_FLAG: Record<string, string> = {
  NGN: '🇳🇬', GHS: '🇬🇭', KES: '🇰🇪', UGX: '🇺🇬', ZMW: '🇿🇲', TZS: '🇹🇿',
  ZAR: '🇿🇦', EGP: '🇪🇬', USD: '🇺🇸', EUR: '🇪🇺', GBP: '🇬🇧',
  // Devises Klasha additionnelles.
  CDF: '🇨🇩', RWF: '🇷🇼', MWK: '🇲🇼', MZN: '🇲🇿', SLE: '🇸🇱', SLL: '🇸🇱', CNY: '🇨🇳',
};

// Libellé propre par rail Fincra (jamais la string brute « fincra-… »).
const FINCRA_RAIL_LABEL: Record<string, string> = {
  bank_transfer: 'Virement bancaire',
  bank: 'Virement bancaire',
  mobile_money: 'Mobile Money',
  mm: 'Mobile Money',
  checkout: 'Open Banking',
  card: 'Carte bancaire',
};

// Logo par rail Fincra — MÊMES visuels que les modals dépôt/retrait (LOGO_BY_KEY :
// pay_bank / pay_momo / pay_card) → cohérence garantie.
const FINCRA_RAIL_LOGO: Record<string, any> = {
  bank_transfer: require('../../assets/operators/pay_bank.png'),
  bank: require('../../assets/operators/pay_bank.png'),
  mobile_money: require('../../assets/operators/pay_momo.png'),
  mm: require('../../assets/operators/pay_momo.png'),
  checkout: require('../../assets/operators/pay_card.jpg'),
  card: require('../../assets/operators/pay_card.jpg'),
};

// Logo par moyen de paiement chinois (Klasha CNY).
const CNY_LOGO: Record<string, any> = {
  card: require('../../assets/operators/pay_unionpay.png'),   // UnionPay
  wallet: require('../../assets/operators/pay_alipay.png'),   // Alipay
  wechat: require('../../assets/operators/pay_wechat.png'),   // WeChat
  bank: require('../../assets/operators/pay_bank.png'),       // Virement bancaire
};

// Libellé propre par opérateur Mobile Money (repli quand le corridor précis
// fincra-mm-<pays>-<op> / klasha-mm-<pays>-<op> n'est pas résolu par le catalogue).
const MM_OP_LABEL: Record<string, string> = {
  MTN: 'MTN MoMo', ORANGE: 'Orange Money', MOOV: 'Moov Money', WAVE: 'Wave',
  AIRTEL: 'Airtel Money', MPESA: 'M-Pesa', SAFARICOM: 'M-Pesa', TIGO: 'Tigo',
  VODAFONE: 'Vodafone Cash', FREE: 'Free Money', EXPRESSO: 'Expresso', TMONEY: 'T-Money',
};

// Code pays ISO-2 → drapeau emoji (indicateurs régionaux). '' pour un code invalide.
function isoFlag(cc: string): string {
  const c = (cc || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

// Marques d'agrégateur : ne doivent JAMAIS apparaître côté utilisateur.
const AGGREGATOR_BRANDS = /fincra|klasha|afribapay|paydunya|kkiapay|kkia|payci|pdy|fedapay|cybersource/i;

/**
 * Repli quand aucun corridor ne correspond : libellé de rail générique déduit du
 * code, sans jamais laisser fuiter la marque de l'agrégateur ni le code brut.
 */
function genericModeLabel(mode: string): string {
  const n = mode.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  if (/mobile_money|(^|_)mm(_|$)|momo/.test(n)) return 'Mobile Money';
  if (/checkout/.test(n)) return 'Open Banking';
  if (/swift/.test(n)) return 'Virement SWIFT';
  if (/sepa/.test(n)) return 'Virement SEPA';
  if (/wire/.test(n)) return 'Virement international';
  if (/bank|(^|_)bt(_|$)/.test(n)) return 'Virement bancaire';
  if (/card|visa|mastercard/.test(n)) return 'Carte bancaire';
  if (/crypto|usdt|trc|erc/.test(n)) return 'Crypto';
  const clean = n.replace(AGGREGATOR_BRANDS, '').replace(/_+/g, ' ').trim();
  if (!clean) return 'Transfert';
  return clean.replace(/\b\w/g, (c) => c.toUpperCase());
}

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
    const baseLabel = FINCRA_RAIL_LABEL[rail] || 'Transfert';
    const cur = currencyDest ? currencyDest.toUpperCase() : '';
    // Comme l'admin : suffixe la devise sur les cartes et virements (pas le MM).
    const isCardOrBank = ['bank_transfer', 'bank', 'checkout', 'card'].includes(rail);
    const name = (isCardOrBank && cur && !baseLabel.includes(cur)) ? `${baseLabel} (${cur})` : baseLabel;
    const flag = cur ? (FINCRA_CUR_FLAG[cur] || '') : '';
    const normRail = rail === 'mm' ? 'mobile_money' : rail;
    // logo = même visuel que dépôt/retrait → OperatorLogo affiche l'image (pas l'icône).
    return { name, flag, op: { fincra: true, rail: normRail, logo: FINCRA_RAIL_LOGO[rail] } };
  }

  // Klasha Chine : klasha-cny + variantes corridor (klasha-cny-bt / -card / -wallet
  // / -wechat). Libellé propre 🇨🇳 SANS jamais laisser fuiter « klasha » ni « cny »
  // sur le reçu / l'historique.
  const cny = mode.match(/^klasha-cny(?:-(bt|bank|card|wallet|wechat))?$/i);
  if (cny) {
    const svc = (cny[1] || '').toLowerCase();
    // Le drapeau 🇨🇳 porte déjà le contexte « Chine » → pas de « Chine » dans le texte.
    const name = svc === 'card' ? 'UnionPay'
      : svc === 'wallet' ? 'Alipay'
      : svc === 'wechat' ? 'WeChat'
      : 'Virement bancaire';
    const logo = CNY_LOGO[svc] || CNY_LOGO.bank;
    return { name, flag: '🇨🇳', op: { klasha: true, rail: 'cny', logo } };
  }

  // Klasha : mode stocké = klasha-<mobile_money|bank_transfer|card|checkout|wire|cny> (mêmes visuels).
  const k = mode.match(/^klasha-(bank_transfer|mobile_money|card|checkout|wire|cny)$/i);
  if (k) {
    const rail = k[1].toLowerCase();
    const baseLabel = rail === 'wire' ? 'Virement international'
      : rail === 'cny' ? 'Virement Chine'
      : (FINCRA_RAIL_LABEL[rail] || 'Transfert');
    const cur = currencyDest ? currencyDest.toUpperCase() : '';
    const isCardOrBank = ['bank_transfer', 'card', 'checkout', 'wire', 'cny'].includes(rail);
    const name = (isCardOrBank && cur && !baseLabel.includes(cur)) ? `${baseLabel} (${cur})` : baseLabel;
    const flag = cur ? (FINCRA_CUR_FLAG[cur] || '') : '';
    return { name, flag, op: { klasha: true, rail, logo: FINCRA_RAIL_LOGO[rail] ?? FINCRA_RAIL_LOGO['bank_transfer'] } };
  }

  // Corridor MM précis fincra-mm-<pays>-<op> / klasha-mm-<pays>-<op> non résolu par
  // le catalogue (offline, corridor retiré) : on dérive l'opérateur + le drapeau du
  // pays plutôt que d'afficher le code brut.
  const mm = mode.match(/^(fincra|klasha)-mm-([a-z]{2})-([a-z0-9_]+)$/i);
  if (mm) {
    const isKlasha = mm[1].toLowerCase() === 'klasha';
    const opCode = mm[3].toUpperCase();
    const name = MM_OP_LABEL[opCode] || (opCode.charAt(0) + opCode.slice(1).toLowerCase());
    return {
      name,
      flag: isoFlag(mm[2]),
      op: { [isKlasha ? 'klasha' : 'fincra']: true, rail: 'mobile_money', logo: FINCRA_RAIL_LOGO['mobile_money'] },
    };
  }

  // Dernier repli : jamais le code brut ni un nom d'agrégateur côté client.
  return { name: genericModeLabel(mode), flag: '', op: null };
}
