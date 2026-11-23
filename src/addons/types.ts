import type { ComponentType } from 'react';
import type { ImageSourcePropType, StyleProp, TextStyle, ViewStyle } from 'react-native';
import type { Href } from 'expo-router';
import type { Transaction } from '../types';

// ─────────────────────────────────────────────────────────────────────────
// Contract between the app and an add-on: a feature shipped as a separate
// bundle, loaded only once the user is signed in (see `boot.ts`).
//
// The shared screens know nothing about the feature itself. They render the
// slots below when an add-on fills them, and fall back to their own content
// otherwise. Everything here is a type: nothing of it reaches the bundle.
// ─────────────────────────────────────────────────────────────────────────

/** Way the money moves for the wallet: `in` credits it (top up), `out` debits it (send). */
export type FlowDirection = 'in' | 'out';

/** Presentation of a transaction type the add-on brings to the history. */
export interface TxKind {
  /** Translation key of the type name (history table, filters). */
  labelKey: string;
  /** FontAwesome6 icon shown when there is no logo. */
  icon: string;
  /** Translation key of the detail screen title. */
  detailTitleKey?: string;
  /** Maps the raw status of this type onto `success` | `wait` | `failed`. */
  normalizeStatus?: (statut: string | number) => string;
  /** Line title in the history list. */
  title: (tx: Transaction, t: (key: string) => string) => string;
  /** Short description (desktop history table). */
  summary: (tx: Transaction, t: (key: string) => string) => string;
  /** Logo of the line, if any. */
  logo?: (tx: Transaction) => ImageSourcePropType | null;
  /**
   * Detail of one transaction. `embedded` renders the body only (desktop
   * modal); otherwise it is a full screen with its own header.
   */
  Detail?: ComponentType<{ id: number; embedded?: boolean }>;
}

/** Shortcut to one of the add-on's screens. */
export interface AddonLink {
  key: string;
  labelKey: string;
  icon: string;
  route: Href;
}

/** History filter chip. */
export interface HistoryFilter {
  key: string;
  labelKey: string;
}

/** Extra tab of the home rate simulator. */
export interface QuoteSource {
  tabKey: string;
  sides: { key: string; labelKey: string }[];
  /** Options for a side, in display order. */
  options: (side: string) => { value: string; label: string }[];
  /** Wallet currency (XOF) for one unit of `value`, or null when unknown. */
  rate: (value: string, side: string) => number | null;
  /** True when the user pays in the wallet currency on this side. */
  paysInWallet: (side: string) => boolean;
  /** Decimals of the non-wallet amounts. */
  decimals: number;
  /** Refreshes the price of an option when it gets selected. */
  prepare: (value: string) => void;
}

/** Style hooks the host gives an entry, so it blends in with its siblings. */
export interface EntryStyles {
  item: StyleProp<ViewStyle>;
  text: StyleProp<TextStyle>;
  /** Round frame around the icon (`card` variant). */
  iconWrap?: StyleProp<ViewStyle>;
}

export interface PickerEntryProps {
  direction: FlowDirection;
  /** `chip`: grid tile · `row`: list row · `card`: continent-list row. */
  variant: 'chip' | 'row' | 'card';
  /** Lists the items one by one when there are few of them, instead of a group entry. */
  inline?: boolean;
  styles: EntryStyles;
  onOpen: () => void;
  onPick: (item: string) => void;
}

export interface PickerPanelProps {
  direction: FlowDirection;
  layout: 'grid' | 'list';
  styles: {
    title: StyleProp<TextStyle>;
    back: StyleProp<ViewStyle>;
    backText: StyleProp<TextStyle>;
    hint: StyleProp<TextStyle>;
    container: StyleProp<ViewStyle>;
    item: StyleProp<ViewStyle>;
    itemText: StyleProp<TextStyle>;
  };
  backLabel: string;
  onBack: () => void;
  onPick: (item: string) => void;
}

/** What a loaded add-on provides. */
export interface Addon {
  /** Mounted once on the home screen, hosts the add-on's own modals. */
  Host: ComponentType;
  /** Opens one of its flows, optionally on a given item. */
  start: (direction: FlowDirection, item?: string) => void;
  /** Refreshes its data (home screen focus). */
  refresh: () => void;
  /** Entry inside the top up / send pickers. */
  PickerEntry: ComponentType<PickerEntryProps>;
  /** Item list opened from that entry. */
  PickerPanel: ComponentType<PickerPanelProps>;
  /** Screens served under generic routes (`/account/<name>`). */
  screens: Record<string, ComponentType>;
}

/** Availability published by the add-on for the signed-in user. */
export interface AddonFlows {
  in: boolean;
  out: boolean;
}
