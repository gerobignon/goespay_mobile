/**
 * Traductions du bundle web principal : aucun libellé crypto. Le module crypto
 * ajoute les siens quand il se charge, après la connexion (voir
 * `src/crypto/addon.ts`). Les fichiers `*.web.json` sont générés depuis les
 * fichiers de référence par `scripts/gen-locales.js`, rejoué à chaque
 * démarrage de Metro : ne pas les éditer à la main.
 */
import fr from './locales/fr.web.json';
import en from './locales/en.web.json';

export const resources = {
  fr: { translation: fr },
  en: { translation: en },
};
