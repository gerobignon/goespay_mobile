import { create } from 'zustand';
import { useAuthStore } from '../stores/authStore';
import { useConfigStore } from '../stores/configStore';
import { cryptoSetting } from './config';

/**
 * Who sees what of the crypto service.
 *
 * Eligibility: the `crypto` group, or a crypto corridor open for the user's
 * country in pay-in (sell) and/or payout (buy). The `/config` flags
 * `crypto_*_enabled` already carry that per-country logic on the backend
 * (RoutingResolver::cryptoBuy/SellEnabledFor). Admins see everything, with a
 * banner when a direction is off for users. Enforcement stays server-side.
 */
export interface CryptoAccess {
  /** Crypto user: saved addresses, beneficiary shortcut. */
  member: boolean;
  /** Service usable right now (config loaded, a direction open). */
  active: boolean;
  /** Buying offered from the send flow. */
  buy: boolean;
  /** Selling offered from the top up flow. */
  sell: boolean;
  /** « Crypto » history filter (buy direction is the reference). */
  history: boolean;
}

export const NO_ACCESS: CryptoAccess = { member: false, active: false, buy: false, sell: false, history: false };

export function computeAccess(): CryptoAccess {
  const user = useAuthStore.getState().user;
  if (!user) return NO_ACCESS;
  const configLoaded = useConfigStore.getState().isLoaded;
  const isAdmin = user.group === 'admin';
  const buyOn = cryptoSetting('crypto_buy_enabled');
  const sellOn = cryptoSetting('crypto_sell_enabled');
  const member = isAdmin || user.group === 'crypto' || buyOn || sellOn;
  const active = isAdmin || (configLoaded && member && (buyOn || sellOn));
  return {
    member,
    active,
    buy: active && (buyOn || isAdmin),
    sell: active && (sellOn || isAdmin),
    history: isAdmin || (member && buyOn),
  };
}

export function sameAccess(a: CryptoAccess, b: CryptoAccess): boolean {
  return a.member === b.member && a.active === b.active && a.buy === b.buy
    && a.sell === b.sell && a.history === b.history;
}

/** Current access, kept in sync by `addon.ts`. */
export const useCryptoAccess = create<CryptoAccess>(() => NO_ACCESS);
