import { create } from 'zustand';
import type {
  Addon,
  AddonFlows,
  AddonLink,
  HistoryFilter,
  QuoteSource,
  TxKind,
} from './types';

// ─────────────────────────────────────────────────────────────────────────
// Registry of the add-ons loaded for the signed-in user.
//
// An add-on is code kept out of the main bundle and fetched after login
// (`boot.ts`). Once loaded, it registers its components here and keeps the
// published availability (`flows`, `accountLinks`…) in sync with the user's
// profile and the server config. Shared screens only read this store: they
// never import an add-on.
// ─────────────────────────────────────────────────────────────────────────

export type AddonStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'none';

export interface AddonsState {
  status: AddonStatus;
  addon: Addon | null;
  /** History presentation of the transaction types it brings. */
  kinds: Record<string, TxKind>;
  /** Availability of its flows for this user. */
  flows: AddonFlows;
  /** Entries of the account menu. */
  accountLinks: AddonLink[];
  /** Entries of the « Add a beneficiary » menu. */
  beneficiaryLinks: AddonLink[];
  /** Filters of the history screen. */
  historyFilters: HistoryFilter[];
  /** Handlers of `/(tabs)?action=<key>`. */
  actions: Record<string, () => void>;
  /** Extra tab of the rate simulator. */
  quote: QuoteSource | null;
  /** Labels for payment modes it owns (raw mode, lowercased) → label or null. */
  modeLabel: ((mode: string) => string | null) | null;
}

const EMPTY_FLOWS: AddonFlows = { in: false, out: false };

export const useAddons = create<AddonsState>(() => ({
  status: 'idle',
  addon: null,
  kinds: {},
  flows: EMPTY_FLOWS,
  accountLinks: [],
  beneficiaryLinks: [],
  historyFilters: [],
  actions: {},
  quote: null,
  modeLabel: null,
}));

/** Presentation of a transaction type brought by an add-on, if any. */
export function getTxKind(type?: string | null): TxKind | undefined {
  if (!type) return undefined;
  return useAddons.getState().kinds[type];
}

/** Reactive variant of `getTxKind`, for components. */
export function useTxKind(type?: string | null): TxKind | undefined {
  return useAddons((s) => (type ? s.kinds[type] : undefined));
}

/** True while an add-on may still arrive (deep links wait for it). */
export function addonPending(status: AddonStatus): boolean {
  return status === 'idle' || status === 'loading';
}
