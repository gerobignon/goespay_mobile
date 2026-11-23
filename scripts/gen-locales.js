/**
 * Génère les traductions dérivées à partir des traductions de référence
 * (`src/i18n/locales/fr.json` et `en.json`, les seules à éditer).
 *
 * Le service crypto n'existe que dans la PWA, et seulement une fois le client
 * connecté : son code et ses libellés vivent dans un fichier JS à part, chargé
 * après la connexion (voir `src/addons/boot.ts`). Le script répartit donc les
 * libellés en trois jeux :
 *
 *   ▸ `<lang>.web.json`, bundle web principal : AUCUN libellé crypto. C'est la
 *     page que charge tout visiteur, robots publicitaires compris.
 *   ▸ `src/crypto/i18n/<lang>.json`, module crypto : ses libellés, ajoutés à
 *     i18next quand il se charge.
 *   ▸ `<lang>.native.json`, apps iOS et Android : sans les parcours d'achat et
 *     de vente (licence d'échange exigée par les stores), mais avec les noms
 *     d'opérations de l'historique, pour qu'un client qui a acheté de la crypto
 *     continue de lire son propre historique.
 *
 * Il échoue si un libellé crypto non répertorié ci-dessous se glisse dans le
 * jeu web principal : le nouveau libellé doit alors être rangé dans
 * TRADE_KEYS ou HISTORY_KEYS.
 *
 * Il est rejoué à chaque démarrage de Metro (voir `metro.config.js`), donc les
 * fichiers générés ne peuvent pas dériver de la source. Ils restent commités
 * pour que `tsc` les trouve.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const LOCALES_DIR = path.join(ROOT, 'src', 'i18n', 'locales');
const ADDON_DIR = path.join(ROOT, 'src', 'crypto', 'i18n');
const LANGUAGES = ['fr', 'en'];

/** Sections entières propres au parcours d'achat et de vente. */
const TRADE_SECTIONS = ['cryptoModal', 'cryptoSellDetails'];

/** Libellés d'achat et de vente, section par section. */
const TRADE_KEYS = {
  account: [
    'savedWallets', 'addWallet', 'editWallet', 'noWallets', 'walletAdded',
    'walletAddress', 'walletAddressPlaceholder', 'walletDeleteError',
    'walletLabelPlaceholder', 'walletSaveError', 'walletsLoadError',
    'walletUpdated', 'deleteWalletConfirm', 'enterCurrencyAndAddress',
  ],
  admin: ['bannerCryptoBuy', 'bannerCryptoSell', 'bannerCryptoBoth'],
  depositModal: ['cryptoGroup'],
  history: ['filterCrypto'],
  home: ['crypto', 'benefAddCrypto', 'promo2Title', 'promo2Desc'],
  simulator: ['tabCrypto', 'cryptoBuy', 'cryptoSell'],
  transaction: ['sellCrypto', 'buyCrypto', 'cryptoDetail', 'claimCryptoWarning'],
};

/** Noms des opérations crypto déjà inscrites à l'historique. */
const HISTORY_KEYS = {
  transaction: ['crypto', 'buyType', 'sellType'],
  messages: ['kind_crypto'],
};

/** Mots qui ne doivent jamais apparaître dans le bundle web principal. */
const FORBIDDEN = /crypto(?!gramm)|bitcoin|\busdt\b|stablecoin|blockchain|nowpayments|coinpayments|monnaie num/i;

const isObject = (v) => v && typeof v === 'object' && !Array.isArray(v);

/** Sépare `source` en (gardé, retiré) selon les sections et clés listées. */
function split(source, sections, keys) {
  const kept = {};
  const taken = {};
  for (const [section, value] of Object.entries(source)) {
    if (sections.includes(section)) {
      taken[section] = value;
      continue;
    }
    if (isObject(value) && keys[section]) {
      const keep = {};
      const take = {};
      for (const [key, label] of Object.entries(value)) {
        if (keys[section].includes(key)) take[key] = label;
        else keep[key] = label;
      }
      kept[section] = keep;
      if (Object.keys(take).length) taken[section] = take;
      continue;
    }
    kept[section] = value;
  }
  return { kept, taken };
}

/** Fusion profonde de deux arbres de libellés. */
function merge(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = isObject(v) && isObject(out[k]) ? merge(out[k], v) : v;
  }
  return out;
}

/** Chemins dont la clé ou la valeur contient un mot interdit. */
function leaks(tree, prefix = '') {
  const found = [];
  for (const [k, v] of Object.entries(tree)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (isObject(v)) found.push(...leaks(v, p));
    else if (FORBIDDEN.test(k) || FORBIDDEN.test(String(v))) found.push(p);
  }
  return found;
}

function write(file, data) {
  const next = JSON.stringify(data, null, 2) + '\n';
  const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
  if (current === next) return 0;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, next);
  return 1;
}

let changed = 0;
for (const lang of LANGUAGES) {
  const source = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${lang}.json`), 'utf8'));

  const trade = split(source, TRADE_SECTIONS, TRADE_KEYS);
  const history = split(trade.kept, [], HISTORY_KEYS);

  const leaked = leaks(history.kept);
  if (leaked.length) {
    throw new Error(
      `[gen-locales] ${lang}.json : libellé(s) crypto hors des listes du script, ` +
      `ils fuiraient dans la page publique : ${leaked.join(', ')}. ` +
      'Ranger chaque clé dans TRADE_KEYS ou HISTORY_KEYS (scripts/gen-locales.js).',
    );
  }

  changed += write(path.join(LOCALES_DIR, `${lang}.native.json`), trade.kept);
  changed += write(path.join(LOCALES_DIR, `${lang}.web.json`), history.kept);
  changed += write(path.join(ADDON_DIR, `${lang}.json`), merge(trade.taken, history.taken));
}

if (require.main === module && changed > 0) {
  console.log(`[gen-locales] ${changed} fichier(s) de traduction régénéré(s).`);
}
