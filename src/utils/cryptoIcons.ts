import type { ImageSourcePropType } from 'react-native';

/**
 * Logos des crypto-monnaies historiques, embarqués dans le binaire.
 *
 * Isolés ici pour que la variante `cryptoIcons.ios.ts` puisse les retirer du
 * bundle iOS : l'app iOS n'offre aucun service d'échange de crypto-monnaies
 * (règle App Store 3.1.5(iii)) et ne doit donc en embarquer aucune image.
 */
const CRYPTO_LOGOS: Record<string, ImageSourcePropType> = {
  BTC:  require('../../assets/crypto/btc.png'),
  ETH:  require('../../assets/crypto/eth.png'),
  USDT: require('../../assets/crypto/usdt.png'),
  USDT_BEP20: require('../../assets/crypto/busdt.png'),
  TRX:  require('../../assets/crypto/trx.png'),
  LTC:  require('../../assets/crypto/ltc.png'),
  BNB:  require('../../assets/crypto/bnb.png'),
  BUSD: require('../../assets/crypto/busd.png'),
};

/**
 * Logo d'une devise crypto d'après le code de la transaction, ou `null`.
 * Le code est normalisé (points et tirets en underscore), puis on retombe sur
 * la base de la devise : `USDT_TRC20` retrouve ainsi le logo `USDT`.
 */
export function cryptoLogoFor(currencySrc?: string | null): ImageSourcePropType | null {
  const key = (currencySrc ?? '').toUpperCase().replace(/[.-]/g, '_');
  if (CRYPTO_LOGOS[key]) return CRYPTO_LOGOS[key];
  const base = key.split('_')[0];
  return CRYPTO_LOGOS[base] ?? null;
}
