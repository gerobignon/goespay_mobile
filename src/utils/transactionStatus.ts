import { getTxKind } from '../addons/registry';

/**
 * Single source of truth for transaction status presentation, shared by
 * TransactionItem, history, the transaction detail screens and modals.
 */

export const STATUS_ICONS: Record<string, string> = {
  success: 'circle-check',
  wait: 'clock',
  failed: 'circle-xmark',
  fail: 'circle-xmark',
};

/**
 * Normalize a raw transaction status to a canonical key ('success' | 'wait' | 'failed').
 * Types brought by an add-on may use their own encoding (see `TxKind.normalizeStatus`).
 */
export function normalizeStatut(statut: string | number, type?: string): string {
  const normalize = getTxKind(type)?.normalizeStatus;
  return normalize ? normalize(statut) : String(statut);
}

/** FontAwesome6 icon name for a normalized status. */
export function getStatusIcon(normalizedStatut: string): string {
  return STATUS_ICONS[normalizedStatut] || 'circle-question';
}
