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

/**
 * Sélectionne la source d'image pour un taux crypto :
 *  1. URL fournie par l'API (`rate.img`)
 *  2. Asset local mappé par code (avec variantes BNB.BSC, USDT.TRC20…)
 *  3. null → le caller doit afficher une icône fallback
 */
export function pickCryptoSource(rate?: { code?: string; img?: string | null } | null): ImageSourcePropType | null {
  if (rate?.img && typeof rate.img === 'string' && rate.img.length > 0) {
    return { uri: rate.img };
  }
  const code = rate?.code?.toUpperCase();
  if (code && CRYPTO_IMAGES[code]) return CRYPTO_IMAGES[code];
  return null;
}
