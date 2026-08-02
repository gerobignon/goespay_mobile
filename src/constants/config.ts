import { Platform } from 'react-native';

// Android emulator : 10.0.2.2 → pointe vers localhost du Mac
// iOS physique (Expo Go) : utilise l'IP locale du Mac (ex: 192.168.1.x)
//   → retrouve-la avec : ipconfig getifaddr en0
// En prod : PROD_API est utilisé automatiquement
const DEV_API = Platform.select({
  android: 'http://10.133.207.177:8000/api/mobile/v1',
  ios: 'http://localhost:8000/api/mobile/v1',
  default: 'http://localhost:8000/api/mobile/v1',
});

// const PROD_API = 'https://potato-workflow-glen-individuals.trycloudflare.com/api/mobile/v1';
const PROD_API = 'https://goespay.io/api/mobile/v1';

export const API_BASE_URL = __DEV__ ? DEV_API : PROD_API;

export const OPERATORS = [
  // ─── PayDunya / Softpay ────────────────────────────────────────────────
  // Bénin
  { id: 'mtn-benin', name: 'MTN Momo', flag: '🇧🇯', country: 'BJ', withdraw: true, logo: require('../../assets/operators/pay_mtn.png') },
  { id: 'moov-benin', name: 'Moov Money', flag: '🇧🇯', country: 'BJ', withdraw: true, logo: require('../../assets/operators/pay_moov.png') },
  { id: 'celtiis-cash', name: 'Celtiis Cash', flag: '🇧🇯', country: 'BJ', withdraw: true, logo: require('../../assets/operators/pay_celtiis.png') },
  // Burkina Faso
  { id: 'moov-burkina-faso', name: 'Moov Money', flag: '🇧🇫', country: 'BF', withdraw: true, logo: require('../../assets/operators/pay_moov.png') },
  { id: 'orange-money-burkina', name: 'Orange Money', flag: '🇧🇫', country: 'BF', withdraw: true, logo: require('../../assets/operators/pay_orange.jpg') },
  // Côte d'Ivoire
  { id: 'moov-ci', name: 'Moov Money', flag: '🇨🇮', country: 'CI', withdraw: true, logo: require('../../assets/operators/pay_moov.png') },
  { id: 'mtn-ci', name: 'MTN Momo', flag: '🇨🇮', country: 'CI', withdraw: true, logo: require('../../assets/operators/pay_mtn.png') },
  { id: 'orange-money-ci', name: 'Orange Money', flag: '🇨🇮', country: 'CI', withdraw: true, logo: require('../../assets/operators/pay_orange.jpg') },
  { id: 'wave-ci', name: 'Wave', flag: '🇨🇮', country: 'CI', withdraw: true, logo: require('../../assets/operators/pay_wave.jpg') },
  // Togo
  { id: 't-money-togo', name: 'T-Money', flag: '🇹🇬', country: 'TG', withdraw: true, logo: require('../../assets/operators/pay_tmoney.jpg') },
  { id: 'moov-togo', name: 'Moov Money', flag: '🇹🇬', country: 'TG', withdraw: true, logo: require('../../assets/operators/pay_moov.png') },
  // Sénégal
  { id: 'orange-money-senegal', name: 'Orange Money', flag: '🇸🇳', country: 'SN', withdraw: true, logo: require('../../assets/operators/pay_orange.jpg') },
  { id: 'free-money-senegal', name: 'Free Money', flag: '🇸🇳', country: 'SN', withdraw: true, logo: require('../../assets/operators/pay_free.jpg') },
  { id: 'expresso-senegal', name: 'Expresso', flag: '🇸🇳', country: 'SN', withdraw: true, logo: require('../../assets/operators/pay_expresso.png') },
  { id: 'wave-senegal', name: 'Wave', flag: '🇸🇳', country: 'SN', withdraw: true, logo: require('../../assets/operators/pay_wave.jpg') },
  { id: 'wizall-senegal', name: 'Wizall', flag: '🇸🇳', country: 'SN', withdraw: true, logo: require('../../assets/operators/pay_wizall.jpg') },
  // Mali
  { id: 'orange-money-mali', name: 'Orange Money', flag: '🇲🇱', country: 'ML', withdraw: true, logo: require('../../assets/operators/pay_orange.jpg') },
  { id: 'moov-mali', name: 'Moov Money', flag: '🇲🇱', country: 'ML', withdraw: true, logo: require('../../assets/operators/pay_moov.png') },
  // Cameroun (PayDunya, historique)
  { id: 'mtn-cameroun', name: 'MTN Mobile Money', flag: '🇨🇲', country: 'CM', withdraw: true, logo: require('../../assets/operators/pay_mtn.png') },

  // ─── AfribaPay ──────────────────────────────────────────────────────────
  // Niger (XOF) — AfribaPay ne supporte qu'Airtel au Niger
  { id: 'airtel-ne', name: 'Airtel Money', flag: '🇳🇪', country: 'NE', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_airtel.png') },
  // Guinée Conakry (GNF)
  { id: 'orange-gn', name: 'Orange Money', flag: '🇬🇳', country: 'GN', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_orange.jpg') },
  { id: 'mtn-gn', name: 'MTN Mobile Money', flag: '🇬🇳', country: 'GN', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_mtn.png') },
  // Tchad (XAF)
  { id: 'airtel-td', name: 'Airtel Money', flag: '🇹🇩', country: 'TD', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_airtel.png') },
  { id: 'moov-td', name: 'Moov Money', flag: '🇹🇩', country: 'TD', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_moov.png') },
  // Gabon (XAF)
  { id: 'airtel-ga', name: 'Airtel Money', flag: '🇬🇦', country: 'GA', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_airtel.png') },
  { id: 'moov-ga', name: 'Moov Money', flag: '🇬🇦', country: 'GA', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_moov.png') },
  // Congo Brazzaville (XAF)
  { id: 'mtn-cg', name: 'MTN Mobile Money', flag: '🇨🇬', country: 'CG', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_mtn.png') },
  { id: 'airtel-cg', name: 'Airtel Money', flag: '🇨🇬', country: 'CG', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_airtel.png') },
  // Centrafrique (XAF)
  { id: 'orange-cf', name: 'Orange Money', flag: '🇨🇫', country: 'CF', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_orange.jpg') },
  { id: 'telecel-cf', name: 'Telecel', flag: '🇨🇫', country: 'CF', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_telecel.png') },
  // RDC (CDF)
  { id: 'mpesa-cd', name: 'M-Pesa', flag: '🇨🇩', country: 'CD', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_mpesa.jpg') },
  { id: 'orange-cd', name: 'Orange Money', flag: '🇨🇩', country: 'CD', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_orange.jpg') },
  { id: 'airtel-cd', name: 'Airtel Money', flag: '🇨🇩', country: 'CD', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_airtel.png') },
  { id: 'africell-cd', name: 'Africell Money', flag: '🇨🇩', country: 'CD', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_africell.png') },
  // Cameroun (XAF, AfribaPay — coexiste avec mtn-cameroun PayDunya)
  { id: 'mtn-cm', name: 'MTN Mobile Money', flag: '🇨🇲', country: 'CM', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_mtn.png') },
  { id: 'orange-cm', name: 'Orange Money', flag: '🇨🇲', country: 'CM', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_orange.jpg') },

  // ─── UEMOA via AfribaPay (codes -afp ; coexistent avec PayDunya, l'admin
  //     choisit l'agrégateur actif par pays/réseau dans le routing) ──────────
  // Bénin
  { id: 'moov-bj-afp', name: 'Moov Money', flag: '🇧🇯', country: 'BJ', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_moov.png') },
  { id: 'mtn-bj-afp', name: 'MTN Momo', flag: '🇧🇯', country: 'BJ', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_mtn.png') },
  // Côte d'Ivoire
  { id: 'orange-ci-afp', name: 'Orange Money', flag: '🇨🇮', country: 'CI', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_orange.jpg') },
  { id: 'moov-ci-afp', name: 'Moov Money', flag: '🇨🇮', country: 'CI', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_moov.png') },
  { id: 'mtn-ci-afp', name: 'MTN Momo', flag: '🇨🇮', country: 'CI', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_mtn.png') },
  { id: 'wave-ci-afp', name: 'Wave', flag: '🇨🇮', country: 'CI', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_wave.jpg') },
  // Burkina Faso
  { id: 'orange-bf-afp', name: 'Orange Money', flag: '🇧🇫', country: 'BF', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_orange.jpg') },
  { id: 'moov-bf-afp', name: 'Moov Money', flag: '🇧🇫', country: 'BF', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_moov.png') },
  { id: 'wave-bf-afp', name: 'Wave', flag: '🇧🇫', country: 'BF', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_wave.jpg') },
  // Mali
  { id: 'orange-ml-afp', name: 'Orange Money', flag: '🇲🇱', country: 'ML', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_orange.jpg') },
  { id: 'moov-ml-afp', name: 'Moov Money', flag: '🇲🇱', country: 'ML', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_moov.png') },
  // Sénégal
  { id: 'orange-sn-afp', name: 'Orange Money', flag: '🇸🇳', country: 'SN', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_orange.jpg') },
  { id: 'free-sn-afp', name: 'Free Money', flag: '🇸🇳', country: 'SN', withdraw: true, afribapay: true, logo: require('../../assets/operators/paydunya.png') },
  { id: 'expresso-sn-afp', name: 'Expresso', flag: '🇸🇳', country: 'SN', withdraw: true, afribapay: true, logo: require('../../assets/operators/paydunya.png') },
  { id: 'wave-sn-afp', name: 'Wave', flag: '🇸🇳', country: 'SN', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_wave.jpg') },
  // Togo
  { id: 'moov-tg-afp', name: 'Moov Money', flag: '🇹🇬', country: 'TG', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_moov.png') },
  { id: 'tmoney-tg-afp', name: 'T-Money', flag: '🇹🇬', country: 'TG', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_tmoney.jpg') },

  // Carte bancaire (international, dépôt uniquement)
  { id: 'card', name: 'Carte Bancaire', flag: '🌍', country: 'INTL', withdraw: false, logo: require('../../assets/operators/pay_card.jpg') },

  // ─── Fincra : un opérateur par couple (devise × rail) ──────────────────
  // Pour les zones XOF/XAF, countries[] liste les pays couverts (filter accepte
  // op.country === selectedCountry OU op.countries?.includes(selectedCountry)).

  // Nigeria (NGN)
  { id: 'fincra-ngn-mm',   name: 'Mobile Money',     flag: '🇳🇬', country: 'NG', withdraw: true, fincra: true, currency: 'NGN', rail: 'mobile_money',  logo: require('../../assets/operators/pay_momo.png') },
  { id: 'fincra-ngn-bt',   name: 'Virement bancaire (NGN)', flag: '🇳🇬', country: 'NG', withdraw: true, fincra: true, currency: 'NGN', rail: 'bank_transfer', logo: require('../../assets/operators/pay_bank.png') },
  { id: 'fincra-ngn-card', name: 'Open Banking (NGN)',   flag: '🇳🇬', country: 'NG', withdraw: false, fincra: true, currency: 'NGN', rail: 'checkout',     logo: require('../../assets/operators/pay_card.jpg') },

  // Ghana (GHS)
  { id: 'fincra-ghs-mm',   name: 'Mobile Money',     flag: '🇬🇭', country: 'GH', withdraw: true, fincra: true, currency: 'GHS', rail: 'mobile_money',  logo: require('../../assets/operators/pay_momo.png') },
  { id: 'fincra-ghs-bt',   name: 'Virement bancaire (GHS)', flag: '🇬🇭', country: 'GH', withdraw: true, fincra: true, currency: 'GHS', rail: 'bank_transfer', logo: require('../../assets/operators/pay_bank.png') },
  { id: 'fincra-ghs-card', name: 'Open Banking (GHS)',   flag: '🇬🇭', country: 'GH', withdraw: false, fincra: true, currency: 'GHS', rail: 'checkout',     logo: require('../../assets/operators/pay_card.jpg') },

  // Kenya (KES)
  { id: 'fincra-kes-mm',   name: 'Mobile Money',     flag: '🇰🇪', country: 'KE', withdraw: true, fincra: true, currency: 'KES', rail: 'mobile_money',  logo: require('../../assets/operators/pay_momo.png') },
  { id: 'fincra-kes-bt',   name: 'Virement bancaire (KES)', flag: '🇰🇪', country: 'KE', withdraw: true, fincra: true, currency: 'KES', rail: 'bank_transfer', logo: require('../../assets/operators/pay_bank.png') },
  { id: 'fincra-kes-card', name: 'Open Banking (KES)',   flag: '🇰🇪', country: 'KE', withdraw: false, fincra: true, currency: 'KES', rail: 'checkout',     logo: require('../../assets/operators/pay_card.jpg') },

  // Ouganda (UGX)
  { id: 'fincra-ugx-mm',   name: 'Mobile Money',     flag: '🇺🇬', country: 'UG', withdraw: true, fincra: true, currency: 'UGX', rail: 'mobile_money',  logo: require('../../assets/operators/pay_momo.png') },
  { id: 'fincra-ugx-bt',   name: 'Virement bancaire (UGX)', flag: '🇺🇬', country: 'UG', withdraw: true, fincra: true, currency: 'UGX', rail: 'bank_transfer', logo: require('../../assets/operators/pay_bank.png') },
  { id: 'fincra-ugx-card', name: 'Open Banking (UGX)',   flag: '🇺🇬', country: 'UG', withdraw: false, fincra: true, currency: 'UGX', rail: 'checkout',     logo: require('../../assets/operators/pay_card.jpg') },

  // Zambie (ZMW)
  { id: 'fincra-zmw-mm',   name: 'Mobile Money',     flag: '🇿🇲', country: 'ZM', withdraw: true, fincra: true, currency: 'ZMW', rail: 'mobile_money',  logo: require('../../assets/operators/pay_momo.png') },
  { id: 'fincra-zmw-bt',   name: 'Virement bancaire (ZMW)', flag: '🇿🇲', country: 'ZM', withdraw: true, fincra: true, currency: 'ZMW', rail: 'bank_transfer', logo: require('../../assets/operators/pay_bank.png') },
  { id: 'fincra-zmw-card', name: 'Open Banking (ZMW)',   flag: '🇿🇲', country: 'ZM', withdraw: false, fincra: true, currency: 'ZMW', rail: 'checkout',     logo: require('../../assets/operators/pay_card.jpg') },

  // Tanzanie (TZS) — Fincra ne supporte pas le checkout hébergé pour TZS, pas de carte
  { id: 'fincra-tzs-mm', name: 'Mobile Money',     flag: '🇹🇿', country: 'TZ', withdraw: true, fincra: true, currency: 'TZS', rail: 'mobile_money',  logo: require('../../assets/operators/pay_momo.png') },
  { id: 'fincra-tzs-bt', name: 'Virement bancaire (TZS)', flag: '🇹🇿', country: 'TZ', withdraw: true, fincra: true, currency: 'TZS', rail: 'bank_transfer', logo: require('../../assets/operators/pay_bank.png') },

  // Zone CEMAC (XAF) — Mobile Money + carte (hosted checkout). Pas de bank_transfer chez Fincra.
  { id: 'fincra-xaf-mm',   name: 'Mobile Money', flag: '', country: 'XAF', countries: ['CM','CF','CG','GA','GQ','TD'], withdraw: true, fincra: true, currency: 'XAF', rail: 'mobile_money', logo: require('../../assets/operators/pay_momo.png') },
  { id: 'fincra-xaf-card', name: 'Open Banking (XAF)', flag: '', country: 'XAF', countries: ['CM','CF','CG','GA','GQ','TD'], withdraw: false, fincra: true, currency: 'XAF', rail: 'checkout', logo: require('../../assets/operators/pay_card.jpg') },

  // Zone UEMOA (XOF) — Mobile Money + carte (hosted checkout). Pas de bank_transfer chez Fincra.
  { id: 'fincra-xof-mm',   name: 'Mobile Money', flag: '', country: 'XOF', countries: ['BJ','BF','CI','GW','ML','NE','SN','TG'], withdraw: true, fincra: true, currency: 'XOF', rail: 'mobile_money', logo: require('../../assets/operators/pay_momo.png') },
  { id: 'fincra-xof-card', name: 'Open Banking (XOF)', flag: '', country: 'XOF', countries: ['BJ','BF','CI','GW','ML','NE','SN','TG'], withdraw: false, fincra: true, currency: 'XOF', rail: 'checkout', logo: require('../../assets/operators/pay_card.jpg') },

  // Afrique du Sud (ZAR)
  { id: 'fincra-zar-bt',   name: 'Virement bancaire (ZAR)', flag: '🇿🇦', country: 'ZA', withdraw: true, fincra: true, currency: 'ZAR', rail: 'bank_transfer', logo: require('../../assets/operators/pay_bank.png') },
  { id: 'fincra-zar-card', name: 'Open Banking (ZAR)',   flag: '🇿🇦', country: 'ZA', withdraw: false, fincra: true, currency: 'ZAR', rail: 'checkout',     logo: require('../../assets/operators/pay_card.jpg') },

  // Égypte (EGP)
  { id: 'fincra-egp-mm', name: 'Mobile Money',     flag: '🇪🇬', country: 'EG', withdraw: true, fincra: true, currency: 'EGP', rail: 'mobile_money',  logo: require('../../assets/operators/pay_momo.png') },
  { id: 'fincra-egp-bt', name: 'Virement bancaire (EGP)', flag: '🇪🇬', country: 'EG', withdraw: true, fincra: true, currency: 'EGP', rail: 'bank_transfer', logo: require('../../assets/operators/pay_bank.png') },

  // International (USD/EUR/GBP) — payout via SWIFT/SEPA. Pas de bank_transfer en
  // pay-in (Fincra n'expose pas de virtual accounts dans ces devises) ni de carte
  // Fincra dédiée (supprimée) : le pay-in intl passe par l'Open Banking hébergé
  // (fincra-checkout-<cc>, catalogue serveur).
  { id: 'fincra-usd-bt',   name: 'Virement (SWIFT) USD',      flag: '🇺🇸', country: 'US', withdraw: true,  fincra: true, currency: 'USD', rail: 'SWIFT', minAmount: 100, logo: require('../../assets/operators/pay_bank.png') },
  { id: 'fincra-eur-bt',   name: 'Virement (SEPA) EUR',       flag: '🇪🇺', country: 'EU', withdraw: true,  fincra: true, currency: 'EUR', rail: 'SEPA', minAmount: 100, logo: require('../../assets/operators/pay_bank.png') },
  { id: 'fincra-gbp-bt',   name: 'Virement (SWIFT) GBP',      flag: '🇬🇧', country: 'GB', withdraw: true,  fincra: true, currency: 'GBP', rail: 'SWIFT', minAmount: 100, logo: require('../../assets/operators/pay_bank.png') },
] as const;

// Helper : un opérateur sert-il `selectedCountry` ?
// Accepte op.country direct OU op.countries[] (zones XOF/XAF).
export function operatorServesCountry(op: { country: string; countries?: readonly string[] }, code: string): boolean {
  return op.country === code || (op.countries?.includes(code) ?? false);
}

// Identifie le réseau mobile money depuis le nom de l'opérateur. Utilisé pour
// dédupliquer les paires (pays, réseau) servies à la fois par Softpay/PayDunya
// et par AfribaPay : on privilégie systématiquement Softpay/PayDunya.
export function getOperatorNetwork(op: { name: string; id: string }): string {
  const n = op.name.toLowerCase();
  if (n.includes('mtn')) return 'mtn';
  if (n.includes('moov')) return 'moov';
  if (n.includes('orange')) return 'orange';
  if (n.includes('airtel')) return 'airtel';
  if (n.includes('wave')) return 'wave';
  if (n.includes('t-money') || n.includes('tmoney')) return 'tmoney';
  if (n.includes('m-pesa') || n.includes('mpesa')) return 'mpesa';
  if (n.includes('africell') || n.includes('afrimoney')) return 'africell';
  if (n.includes('celtiis')) return 'celtiis';
  return op.id;
}

// Clés "country:network" déjà couvertes par un opérateur non-AfribaPay
// (Softpay/PayDunya). Un opérateur AfribaPay dont la clé est ici est considéré
// comme un doublon et doit être masqué.
const SOFTPAY_NETWORK_KEYS = new Set(
  OPERATORS
    .filter((op) => !(op as { afribapay?: true }).afribapay && op.id !== 'card')
    .map((op) => `${op.country}:${getOperatorNetwork(op)}`)
);

export function isAfribapayDuplicate(op: { afribapay?: true; country: string; name: string; id: string }): boolean {
  if (!op.afribapay) return false;
  return SOFTPAY_NETWORK_KEYS.has(`${op.country}:${getOperatorNetwork(op)}`);
}

// Pays couverts par les devises zones Fincra. Utilisé pour proposer un
// sélecteur de pays + l'indicatif téléphonique sur les flux XOF/XAF.
export const FINCRA_ZONES: Record<string, Array<{ code: string; flag: string; phone: string; name: string }>> = {
  XOF: [
    { code: 'BJ', flag: '🇧🇯', phone: '229', name: 'Bénin' },
    { code: 'BF', flag: '🇧🇫', phone: '226', name: 'Burkina Faso' },
    { code: 'CI', flag: '🇨🇮', phone: '225', name: "Côte d'Ivoire" },
    { code: 'GW', flag: '🇬🇼', phone: '245', name: 'Guinée-Bissau' },
    { code: 'ML', flag: '🇲🇱', phone: '223', name: 'Mali' },
    { code: 'NE', flag: '🇳🇪', phone: '227', name: 'Niger' },
    { code: 'SN', flag: '🇸🇳', phone: '221', name: 'Sénégal' },
    { code: 'TG', flag: '🇹🇬', phone: '228', name: 'Togo' },
  ],
  XAF: [
    { code: 'CM', flag: '🇨🇲', phone: '237', name: 'Cameroun' },
    { code: 'CF', flag: '🇨🇫', phone: '236', name: 'Centrafrique' },
    { code: 'CG', flag: '🇨🇬', phone: '242', name: 'Congo' },
    { code: 'GA', flag: '🇬🇦', phone: '241', name: 'Gabon' },
    { code: 'GQ', flag: '🇬🇶', phone: '240', name: 'Guinée Eq.' },
    { code: 'TD', flag: '🇹🇩', phone: '235', name: 'Tchad' },
  ],
};

// Zone CFA de cotation (pivot) pour un pays donné : XAF pour la CEMAC, XOF sinon.
// Le wallet reste XOF (parité stricte 1:1) MAIS Fincra/Klasha cotent les corridors
// cur↔XAF ≠ cur↔XOF → un user CEMAC doit être coté depuis XAF (dépôt ET envoi).
export function walletZone(country?: string | null): 'XOF' | 'XAF' {
  const iso = (country || '').toUpperCase();
  return FINCRA_ZONES.XAF.some((c) => c.code === iso) ? 'XAF' : 'XOF';
}

export const TRANSACTION_STATUS: Record<string, { label: string; color: string }> = {
  success: { label: 'Succès', color: '#3176FE' },
  wait: { label: 'En attente', color: '#F4B228' },
  failed: { label: 'Échoué', color: '#ff295b' },
  fail: { label: 'Échoué', color: '#ff295b' },
} as const;

export function getTransactionStatus(t: (key: string) => string): Record<string, { label: string; color: string }> {
  return {
    success: { label: t('transaction.statusSuccess'), color: '#3176FE' },
    wait: { label: t('transaction.statusWait'), color: '#F4B228' },
    failed: { label: t('transaction.statusFailed'), color: '#ff295b' },
    fail: { label: t('transaction.statusFailed'), color: '#ff295b' },
  };
}

export const COUNTRIES = [
  { code: 'BJ', name: 'Bénin', prefix: '+229' },
  { code: 'BF', name: 'Burkina Faso', prefix: '+226' },
  { code: 'CF', name: 'Centrafrique', prefix: '+236' },
  { code: 'CG', name: 'Congo Brazzaville', prefix: '+242' },
  { code: 'CD', name: 'RD Congo', prefix: '+243' },
  { code: 'CI', name: "Côte d'Ivoire", prefix: '+225' },
  { code: 'CM', name: 'Cameroun', prefix: '+237' },
  { code: 'GA', name: 'Gabon', prefix: '+241' },
  { code: 'GM', name: 'Gambie', prefix: '+220' },
  { code: 'GN', name: 'Guinée Conakry', prefix: '+224' },
  { code: 'GW', name: 'Guinée-Bissau', prefix: '+245' },
  { code: 'ML', name: 'Mali', prefix: '+223' },
  { code: 'NE', name: 'Niger', prefix: '+227' },
  { code: 'SN', name: 'Sénégal', prefix: '+221' },
  { code: 'TD', name: 'Tchad', prefix: '+235' },
  { code: 'TG', name: 'Togo', prefix: '+228' },
];
