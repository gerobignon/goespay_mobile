import { Platform } from 'react-native';

// Android emulator : 10.0.2.2 → pointe vers localhost du Mac
// iOS physique (Expo Go) : utilise l'IP locale du Mac (ex: 192.168.1.x)
//   → retrouve-la avec : ipconfig getifaddr en0
// En prod : PROD_API est utilisé automatiquement
const DEV_API = Platform.select({
  android: 'http://192.168.100.185:8000/api/mobile/v1',
  ios: 'http://localhost:8000/api/mobile/v1',
  default: 'http://192.168.100.185:8000/api/mobile/v1',
});

const PROD_API = 'https://goespay.io/api/mobile/v1';

// export const API_BASE_URL = __DEV__ ? DEV_API : PROD_API;
export const API_BASE_URL = PROD_API;

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
  // Cameroun
  { id: 'mtn-cameroun', name: 'MTN Mobile Money Cameroun', flag: '🇨🇲', country: 'CM', withdraw: true, logo: require('../../assets/operators/pay_mtn.png') },
  // Carte bancaire (international, dépôt uniquement)
  { id: 'card', name: 'Carte Bancaire', flag: '🌍', country: 'INTL', withdraw: false, logo: require('../../assets/operators/pay_card.jpg') },
] as const;

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
  { code: 'CI', name: "Côte d'Ivoire", prefix: '+225' },
  { code: 'GW', name: 'Guinée-Bissau', prefix: '+245' },
  { code: 'ML', name: 'Mali', prefix: '+223' },
  { code: 'NE', name: 'Niger', prefix: '+227' },
  { code: 'SN', name: 'Sénégal', prefix: '+221' },
  { code: 'TG', name: 'Togo', prefix: '+228' },
];
