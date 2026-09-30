/**
 * Traductions chargées par i18next. Isolées dans leur propre module pour que
 * Metro puisse leur substituer `resources.native.ts`, qui charge des fichiers
 * amputés des libellés crypto : les apps iOS et Android n'offrent aucun service
 * d'échange de crypto-monnaies. Seule la PWA charge ce fichier.
 */
import fr from './locales/fr.json';
import en from './locales/en.json';

export const resources = {
  fr: { translation: fr },
  en: { translation: en },
};
