import i18n from '../i18n';
import { useAddons } from '../addons/registry';
import type { Addon, AddonLink, HistoryFilter } from '../addons/types';
import { useAuthStore } from '../stores/authStore';
import { useConfigStore } from '../stores/configStore';
import fr from './i18n/fr.json';
import en from './i18n/en.json';
import { CRYPTO_TYPE, cryptoKind } from './kind';
import { computeAccess, sameAccess, useCryptoAccess, type CryptoAccess } from './access';
import { useCryptoStore } from './store';
import { cryptoLogoFor } from './icons';
import { buildQuote } from './quote';
import { Host, startFlow } from './components/Host';
import { PickerEntry, PickerPanel } from './components/Picker';
import TransactionView from './screens/TransactionView';
import SavedWalletsScreen from './screens/SavedWalletsScreen';

// ─────────────────────────────────────────────────────────────────────────
// Crypto add-on (web only).
//
// Entry point of the separate bundle fetched by `src/addons/boot.ts` once the
// user is signed in. Nothing in this folder may be imported statically by
// shared code: that is what keeps the crypto service, its wording and its
// provider out of the page every visitor loads. The native apps never load
// it (see `boot.native.ts`).
// ─────────────────────────────────────────────────────────────────────────

const SAVED_ADDRESSES = '/account/wallets';

const ACCOUNT_LINKS: AddonLink[] = [
  { key: 'wallets', labelKey: 'account.savedWallets', icon: 'wallet', route: SAVED_ADDRESSES },
];
const BENEFICIARY_LINKS: AddonLink[] = [
  { key: 'wallets', labelKey: 'home.benefAddCrypto', icon: 'bitcoin-sign', route: SAVED_ADDRESSES },
];
const HISTORY_FILTERS: HistoryFilter[] = [{ key: CRYPTO_TYPE, labelKey: 'history.filterCrypto' }];

/** Payment modes carrying a crypto rail (legacy deposits), for the history. */
const modeLabel = (mode: string): string | null => (/crypto|usdt|trc|erc/.test(mode) ? 'Crypto' : null);

const addon: Addon = {
  Host,
  start: startFlow,
  refresh: () => {
    if (useCryptoAccess.getState().member) useCryptoStore.getState().fetchRates();
  },
  PickerEntry,
  PickerPanel,
  screens: { wallets: SavedWalletsScreen },
};

let published = false;
let quotedRates: unknown = null;
let quotedActive = false;

/** Republishes what the user may see, after any profile, config or rate change. */
function sync() {
  const prev = useCryptoAccess.getState();
  const next: CryptoAccess = computeAccess();
  const rates = useCryptoStore.getState().rates;

  if (!published || !sameAccess(prev, next)) {
    published = true;
    useCryptoAccess.setState(next, true);
    useAddons.setState({
      flows: { in: next.sell, out: next.buy },
      accountLinks: next.member ? ACCOUNT_LINKS : [],
      beneficiaryLinks: next.member ? BENEFICIARY_LINKS : [],
      historyFilters: next.history ? HISTORY_FILTERS : [],
      actions: next.active ? { [CRYPTO_TYPE]: () => startFlow('out') } : {},
    });
    if (next.active && !prev.active) useCryptoStore.getState().fetchRates();
  }

  if (rates !== quotedRates || next.active !== quotedActive) {
    quotedRates = rates;
    quotedActive = next.active;
    useAddons.setState({ quote: next.active ? buildQuote(rates) : null });
  }
}

let installed = false;

export function install() {
  if (installed) return;
  installed = true;

  i18n.addResourceBundle('fr', 'translation', fr, true, true);
  i18n.addResourceBundle('en', 'translation', en, true, true);

  useAddons.setState((s) => ({
    status: 'ready',
    addon,
    kinds: {
      ...s.kinds,
      [CRYPTO_TYPE]: cryptoKind({
        logo: (tx) => cryptoLogoFor(tx.currency_src),
        Detail: TransactionView,
      }),
    },
    modeLabel,
  }));

  sync();
  useAuthStore.subscribe(sync);
  useConfigStore.subscribe(sync);
  // Rates only change the simulator tab: rebuild it when they move.
  useCryptoStore.subscribe((s, p) => { if (s.rates !== p.rates) sync(); });
}
