import type { TxKind } from '../addons/types';

/** Transaction `type` of a crypto buy or sell in the history. */
export const CRYPTO_TYPE = 'crypto';

/** Crypto operations carry a numeric state: 1 = success, 0 = failed, else pending. */
export function normalizeCryptoStatus(statut: string | number): string {
  return statut == 1 ? 'success' : statut == 0 ? 'failed' : 'wait';
}

const side = (mode: string | undefined, t: (key: string) => string) =>
  mode === 'Buy' ? t('history.buy') : t('history.sell');

/**
 * How past crypto operations read in the history.
 *
 * Shared by the native apps, which no longer offer crypto but must keep
 * showing the operations a customer already made, and by the web add-on,
 * which completes it with logos and the detail screen.
 */
export function cryptoKind(extra: Partial<TxKind> = {}): TxKind {
  return {
    labelKey: 'transaction.crypto',
    icon: 'bitcoin-sign',
    detailTitleKey: 'transaction.cryptoDetail',
    normalizeStatus: normalizeCryptoStatus,
    title: (tx, t) => `${side(tx.mode, t)} ${tx.currency_src ?? 'Crypto'}`,
    summary: (tx, t) => (tx.address
      ? `${side(tx.mode, t)} · ${tx.address.slice(0, 10)}…`
      : `${side(tx.mode, t)} ${tx.currency_src ?? ''}`),
    ...extra,
  };
}
