import type { QuoteSource } from '../addons/types';
import { useAuthStore } from '../stores/authStore';
import { useCryptoStore, isCryptoDirAllowed, type CryptoDir, type CryptoRate } from './store';

const num = (v: unknown): number => {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/\s/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }
  return 0;
};

const asDir = (side: string): CryptoDir => (side === 'sell' ? 'sell' : 'buy');

/**
 * Crypto tab of the home rate simulator, built from the current rates.
 * Null when no currency is open in either direction.
 *
 * Price of one unit = country buy/sell rate (XOF per USD) × live_rate (USD per
 * unit). The buy/sell rates already carry the margin: no separate fees.
 */
export function buildQuote(rates: CryptoRate[]): QuoteSource | null {
  const open = rates.filter((r) => r.code && (isCryptoDirAllowed(r, 'buy') || isCryptoDirAllowed(r, 'sell')));
  if (!open.length) return null;

  return {
    tabKey: 'simulator.tabCrypto',
    sides: [
      { key: 'buy', labelKey: 'simulator.cryptoBuy' },
      { key: 'sell', labelKey: 'simulator.cryptoSell' },
    ],
    options: (side) => open
      .filter((r) => isCryptoDirAllowed(r, asDir(side)))
      .map((r) => ({ value: r.code, label: r.name ? `${r.code} · ${r.name}` : r.code })),
    rate: (value, side) => {
      const rate = open.find((r) => r.code === value);
      if (!rate) return null;
      const suffix = String((useAuthStore.getState().user as any)?.country || '').toLowerCase();
      const pick = (base: 'buy_rate' | 'sell_rate') => {
        const perCountry = num((rate as any)[`${base}_${suffix}`]);
        return perCountry > 0 ? perCountry : num(rate[base]);
      };
      const xofPerUsd = pick(asDir(side) === 'buy' ? 'buy_rate' : 'sell_rate');
      const usdPerUnit = num(rate.live_rate) || (num(rate.buy_rate) > 0 ? 1 : 0);
      if (xofPerUsd <= 0 || usdPerUnit <= 0) return null;
      return xofPerUsd * usdPerUnit;
    },
    paysInWallet: (side) => asDir(side) === 'buy',
    decimals: 8,
    // Only the most traded currencies come with a live_rate: the others are
    // priced when selected.
    prepare: (value) => { useCryptoStore.getState().fetchEstimate(value); },
  };
}
