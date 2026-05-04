import { Platform } from 'react-native';

// Android emulator : 10.0.2.2 → pointe vers localhost du Mac
// iOS physique (Expo Go) : utilise l'IP locale du Mac (ex: 192.168.1.x)
//   → retrouve-la avec : ipconfig getifaddr en0
// En prod : PROD_API est utilisé automatiquement
const DEV_API = Platform.select({
  android: 'http://192.168.100.185:8002/api/mobile/v1',
  ios: 'http://localhost:8002/api/mobile/v1',
  default: 'http://192.168.100.185:8002/api/mobile/v1',
});

// const PROD_API = 'https://potato-workflow-glen-individuals.trycloudflare.com/api/mobile/v1';
const PROD_API = 'https://goespay.io/api/mobile/v1';

export const API_BASE_URL = __DEV__ ? DEV_API : PROD_API;

export const OPERATORS = [
  // Bénin
  { id: 'mtn-benin', name: 'MTN Momo Bénin', flag: '🇧🇯', country: 'BJ', withdraw: true, logo: require('../../assets/operators/pay_mtn.png') },
  { id: 'moov-benin', name: 'Moov Money Bénin', flag: '🇧🇯', country: 'BJ', withdraw: true, logo: require('../../assets/operators/pay_moov.png') },
  // Burkina Faso
  { id: 'moov-burkina-faso', name: 'Moov Money Burkina Faso', flag: '🇧🇫', country: 'BF', withdraw: true, logo: require('../../assets/operators/pay_moov.png') },
  { id: 'orange-money-burkina', name: 'Orange Money Burkina Faso', flag: '🇧🇫', country: 'BF', withdraw: true, logo: require('../../assets/operators/pay_orange.jpg') },
  // Côte d'Ivoire
  { id: 'moov-ci', name: 'Moov Money Côte d\'Ivoire', flag: '🇨🇮', country: 'CI', withdraw: true, logo: require('../../assets/operators/pay_moov.png') },
  { id: 'mtn-ci', name: 'MTN Momo Côte d\'Ivoire', flag: '🇨🇮', country: 'CI', withdraw: true, logo: require('../../assets/operators/pay_mtn.png') },
  { id: 'orange-money-ci', name: 'Orange Money Côte d\'Ivoire', flag: '🇨🇮', country: 'CI', withdraw: true, logo: require('../../assets/operators/pay_orange.jpg') },
  { id: 'wave-ci', name: 'Wave Côte d\'Ivoire', flag: '🇨🇮', country: 'CI', withdraw: true, logo: require('../../assets/operators/pay_wave.jpg') },
  // Togo
  { id: 't-money-togo', name: 'T-Money Togo', flag: '🇹🇬', country: 'TG', withdraw: true, logo: require('../../assets/operators/pay_tmoney.jpg') },
  { id: 'moov-togo', name: 'Moov Money Togo', flag: '🇹🇬', country: 'TG', withdraw: true, logo: require('../../assets/operators/pay_moov.png') },
  // Sénégal
  { id: 'orange-money-senegal', name: 'Orange Money Sénégal', flag: '🇸🇳', country: 'SN', withdraw: true, logo: require('../../assets/operators/pay_orange.jpg') },
  { id: 'wave-senegal', name: 'Wave Sénégal', flag: '🇸🇳', country: 'SN', withdraw: true, logo: require('../../assets/operators/pay_wave.jpg') },
  // Mali
  { id: 'orange-money-mali', name: 'Orange Money Mali', flag: '🇲🇱', country: 'ML', withdraw: true, logo: require('../../assets/operators/pay_orange.jpg') },
  // Cameroun (PayDunya, historique)
  { id: 'mtn-cameroun', name: 'MTN Mobile Money Cameroun', flag: '🇨🇲', country: 'CM', withdraw: true, logo: require('../../assets/operators/pay_mtn.png') },

  // ─── AfribaPay ──────────────────────────────────────────────────────────
  // Niger (XOF)
  { id: 'airtel-ne', name: 'Airtel Money Niger', flag: '🇳🇪', country: 'NE', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_airtel.png') },
  { id: 'moov-ne', name: 'Moov Money Niger', flag: '🇳🇪', country: 'NE', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_moov.png') },
  // Guinée Conakry (GNF)
  { id: 'orange-gn', name: 'Orange Money Guinée', flag: '🇬🇳', country: 'GN', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_orange.jpg') },
  { id: 'mtn-gn', name: 'MTN Mobile Money Guinée', flag: '🇬🇳', country: 'GN', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_mtn.png') },
  // Guinée Bissau (XOF)
  { id: 'orange-gw', name: 'Orange Money Guinée-Bissau', flag: '🇬🇼', country: 'GW', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_orange.jpg') },
  // Gambie (GMD)
  { id: 'afrimoney-gm', name: 'Africell Money Gambie', flag: '🇬🇲', country: 'GM', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_afrimoney.png') },
  // Tchad (XAF)
  { id: 'airtel-td', name: 'Airtel Money Tchad', flag: '🇹🇩', country: 'TD', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_airtel.png') },
  { id: 'moov-td', name: 'Moov Money Tchad', flag: '🇹🇩', country: 'TD', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_moov.png') },
  // Gabon (XAF)
  { id: 'airtel-ga', name: 'Airtel Money Gabon', flag: '🇬🇦', country: 'GA', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_airtel.png') },
  { id: 'moov-ga', name: 'Moov Money Gabon', flag: '🇬🇦', country: 'GA', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_moov.png') },
  // Congo Brazzaville (XAF)
  { id: 'mtn-cg', name: 'MTN Mobile Money Congo', flag: '🇨🇬', country: 'CG', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_mtn.png') },
  { id: 'airtel-cg', name: 'Airtel Money Congo', flag: '🇨🇬', country: 'CG', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_airtel.png') },
  // Centrafrique (XAF)
  { id: 'orange-cf', name: 'Orange Money Centrafrique', flag: '🇨🇫', country: 'CF', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_orange.jpg') },
  // RDC (CDF)
  { id: 'mpesa-cd', name: 'M-Pesa RDC', flag: '🇨🇩', country: 'CD', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_mpesa.jpg') },
  { id: 'orange-cd', name: 'Orange Money RDC', flag: '🇨🇩', country: 'CD', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_orange.jpg') },
  { id: 'airtel-cd', name: 'Airtel Money RDC', flag: '🇨🇩', country: 'CD', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_airtel.png') },
  { id: 'africell-cd', name: 'Africell Money RDC', flag: '🇨🇩', country: 'CD', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_africell.png') },
  // Cameroun (XAF, AfribaPay — coexiste avec mtn-cameroun PayDunya)
  { id: 'mtn-cm', name: 'MTN Mobile Money Cameroun', flag: '🇨🇲', country: 'CM', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_mtn.png') },
  { id: 'orange-cm', name: 'Orange Money Cameroun', flag: '🇨🇲', country: 'CM', withdraw: true, afribapay: true, logo: require('../../assets/operators/pay_orange.jpg') },

  // Carte bancaire (international, dépôt uniquement)
  { id: 'card', name: 'Carte Bancaire', flag: '🌍', country: 'INTL', withdraw: false, logo: require('../../assets/operators/pay_card.jpg') },
] as const;

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
