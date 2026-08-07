import type { ImageSourcePropType } from 'react-native';

// Assets locaux par code crypto (avec variantes courantes par réseau).
const CRYPTO_IMAGES: Record<string, ImageSourcePropType> = {
  BTC: require('../../assets/crypto/btc.png'),
  ETH: require('../../assets/crypto/eth.png'),
  TRX: require('../../assets/crypto/trx.png'),
  'BNB.BSC': require('../../assets/crypto/bnb.png'),
  BNB: require('../../assets/crypto/bnb.png'),
  'USDT.TRC20': require('../../assets/crypto/usdt.png'),
  USDT: require('../../assets/crypto/usdt.png'),
  'BUSD.BEP20': require('../../assets/crypto/busd.png'),
  BUSD: require('../../assets/crypto/busd.png'),
  LTC: require('../../assets/crypto/ltc.png'),
  LTCT: require('../../assets/crypto/ltc.png'),
};

// NOTE : ne pas réintroduire de helper renvoyant directement `{ uri: rate.img }`
// pour un <Image>. Les logos du catalogue NOWPayments sont des SVG, que <Image>
// ne rend pas en natif — passer par <CryptoLogo>, qui gère les deux cas.

/** Asset local éventuel, sans passer par l'URL distante. */
export function localCryptoSource(code?: string | null): ImageSourcePropType | null {
  const c = code?.toUpperCase();
  return (c && CRYPTO_IMAGES[c]) || null;
}

/**
 * Les logos du catalogue NOWPayments sont majoritairement des SVG, que
 * <Image> ne sait pas rendre sur iOS/Android (contrairement au web).
 */
export function isSvgUrl(url?: string | null): boolean {
  return typeof url === 'string' && url.split('?')[0].toLowerCase().endsWith('.svg');
}
