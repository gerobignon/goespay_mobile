/**
 * Traductions chargées par i18next. Isolées dans leur propre module pour que
 * Metro puisse leur substituer `resources.ios.ts`, qui charge des fichiers
 * amputés des libellés crypto : le binaire iOS n'offre aucun service d'échange
 * de crypto-monnaies (règle App Store 3.1.5(iii)).
 */
import fr from './locales/fr.json';
import en from './locales/en.json';

export const resources = {
  fr: { translation: fr },
  en: { translation: en },
};
