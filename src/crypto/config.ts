import { useConfigStore } from '../stores/configStore';
import { STABLECOIN_CODES } from './stablecoins';

/**
 * Crypto settings served by `/config`.
 *
 * The shared config store keeps whatever the server returns but only types
 * (and defaults) what the main bundle uses: these keys are read here, with
 * the offline defaults the app always had.
 */
export interface CryptoSettings {
  crypto_buy_enabled: boolean;
  crypto_sell_enabled: boolean;
  crypto_buy_max: number;
  crypto_buy_min_btc: number;
  crypto_buy_min_default: number;
  crypto_sell_min_receive: number;
  /** Minimum in XOF per code, set in /admin (overrides the globals). */
  crypto_min_buy_xof: Record<string, number>;
  crypto_min_sell_xof: Record<string, number>;
  stablecoin_codes: string[];
}

export const CRYPTO_DEFAULTS: CryptoSettings = {
  crypto_buy_enabled: true,
  crypto_sell_enabled: true,
  crypto_buy_max: 250000,
  crypto_buy_min_btc: 50000,
  crypto_buy_min_default: 2500,
  crypto_sell_min_receive: 1000,
  crypto_min_buy_xof: {},
  crypto_min_sell_xof: {},
  stablecoin_codes: STABLECOIN_CODES,
};

type ConfigSnapshot = ReturnType<typeof useConfigStore.getState>;

function read<K extends keyof CryptoSettings>(state: ConfigSnapshot, key: K): CryptoSettings[K] {
  const value = (state as unknown as Partial<CryptoSettings>)[key];
  return (value ?? CRYPTO_DEFAULTS[key]) as CryptoSettings[K];
}

/** One setting, reactive. */
export function useCryptoSetting<K extends keyof CryptoSettings>(key: K): CryptoSettings[K] {
  return useConfigStore((s) => read(s, key));
}

/** One setting, outside React. */
export function cryptoSetting<K extends keyof CryptoSettings>(key: K): CryptoSettings[K] {
  return read(useConfigStore.getState(), key);
}
