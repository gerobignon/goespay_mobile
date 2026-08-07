import type { CryptoRate } from '../stores/cryptoStore';

/**
 * Valide une adresse de portefeuille avec la regex fournie par le catalogue
 * NOWPayments (`wallet_regex`).
 *
 * Filet côté client uniquement : le backend reste l'autorité. En l'absence de
 * regex (devise hors catalogue) ou si elle est invalide, on laisse passer —
 * mieux vaut un refus serveur qu'un blocage à tort.
 */
export function isValidCryptoAddress(rate: CryptoRate | undefined | null, address: string): boolean {
  const pattern = rate?.wallet_regex;
  const value = (address || '').trim();
  if (!pattern || !value) return true;

  try {
    return new RegExp(pattern).test(value);
  } catch {
    return true;
  }
}
