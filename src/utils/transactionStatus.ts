/**
 * Single source of truth for transaction status presentation.
 * Replaces the STATUS_ICONS map + crypto 1/0/3 normalization duplicated
 * across TransactionItem, history, the transaction detail screens and modals.
 */

export const STATUS_ICONS: Record<string, string> = {
  success: 'circle-check',
  wait: 'clock',
  failed: 'circle-xmark',
  fail: 'circle-xmark',
};

/**
 * Normalize a raw transaction status to a canonical key ('success' | 'wait' | 'failed').
 * Crypto transactions use a numeric state (1 = success, 0 = failed, anything else = pending).
 */
export function normalizeStatut(statut: string | number, type?: string): string {
  if (type === 'crypto') {
    return statut == 1 ? 'success' : statut == 0 ? 'failed' : 'wait';
  }
  return String(statut);
}

/** FontAwesome6 icon name for a normalized status. */
export function getStatusIcon(normalizedStatut: string): string {
  return STATUS_ICONS[normalizedStatut] || 'circle-question';
}
