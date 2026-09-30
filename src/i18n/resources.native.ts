/**
 * Variante native (iOS et Android) : traductions sans aucun libellé d'achat ou
 * de vente de crypto-monnaies. Les fichiers `*.native.json` sont générés depuis
 * les fichiers de référence par `scripts/gen-native-locales.js`, rejoué à
 * chaque démarrage de Metro : ne pas les éditer à la main.
 */
import fr from './locales/fr.native.json';
import en from './locales/en.native.json';

export const resources = {
  fr: { translation: fr },
  en: { translation: en },
};
