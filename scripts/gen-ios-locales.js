/**
 * Génère les traductions iOS à partir des traductions de référence.
 *
 * L'app iOS n'offre aucun service d'échange de crypto-monnaies (règle App Store
 * 3.1.5(iii)) : les libellés des parcours d'achat et de vente ne doivent donc
 * pas se trouver dans le binaire. Ce script écrit `fr.ios.json` et `en.ios.json`
 * amputés de ces clés ; `src/i18n/resources.ios.ts` les charge à leur place.
 *
 * Il est rejoué automatiquement à chaque démarrage de Metro (voir
 * `metro.config.js`), donc les fichiers générés ne peuvent pas dériver de la
 * source. Les fichiers restent commités pour que `tsc` les trouve.
 *
 * Ce qui est retiré : tout ce qui sert à ACHETER ou VENDRE.
 * Ce qui reste : les libellés qui nomment une opération déjà inscrite à
 * l'historique d'un client (`transaction.crypto`, `transaction.buyType`,
 * `transaction.sellType`, `messages.kind_crypto`). Un client venu d'Android
 * doit continuer de lire son propre historique sur iOS.
 */
const fs = require('fs');
const path = require('path');

const LOCALES_DIR = path.join(__dirname, '..', 'src', 'i18n', 'locales');
const LANGUAGES = ['fr', 'en'];

/** Sections entières supprimées : elles ne servent qu'au parcours crypto. */
const DROP_SECTIONS = ['cryptoModal', 'cryptoSellDetails'];

/** Clés supprimées, section par section. */
const DROP_KEYS = {
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

function stripCrypto(source) {
  const out = {};
  for (const [section, value] of Object.entries(source)) {
    if (DROP_SECTIONS.includes(section)) continue;
    if (value && typeof value === 'object' && !Array.isArray(value) && DROP_KEYS[section]) {
      const kept = {};
      for (const [key, label] of Object.entries(value)) {
        if (DROP_KEYS[section].includes(key)) continue;
        kept[key] = label;
      }
      out[section] = kept;
      continue;
    }
    out[section] = value;
  }
  return out;
}

let changed = 0;
for (const lang of LANGUAGES) {
  const sourcePath = path.join(LOCALES_DIR, `${lang}.json`);
  const targetPath = path.join(LOCALES_DIR, `${lang}.ios.json`);
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const next = JSON.stringify(stripCrypto(source), null, 2) + '\n';
  const current = fs.existsSync(targetPath) ? fs.readFileSync(targetPath, 'utf8') : null;
  if (current !== next) {
    fs.writeFileSync(targetPath, next);
    changed += 1;
  }
}

if (require.main === module && changed > 0) {
  console.log(`[gen-ios-locales] ${changed} fichier(s) de traduction iOS régénéré(s).`);
}

module.exports = { stripCrypto, DROP_SECTIONS, DROP_KEYS };
