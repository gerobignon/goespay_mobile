import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { SafeStorage } from '../services/storage';
import fr from './locales/fr.json';
import en from './locales/en.json';

const LANGUAGE_KEY = 'app_language';

export const SUPPORTED_LANGUAGES = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
] as const;

export type LanguageCode = (typeof SUPPORTED_LANGUAGES)[number]['code'];

async function getInitialLanguage(): Promise<LanguageCode> {
  try {
    const saved = await SafeStorage.getItem(LANGUAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
      return saved as LanguageCode;
    }
  } catch {}
  const deviceLang = getLocales()[0]?.languageCode ?? 'fr';
  return SUPPORTED_LANGUAGES.some((l) => l.code === deviceLang)
    ? (deviceLang as LanguageCode)
    : 'fr';
}

i18n.use(initReactI18next).init({
  resources: { fr: { translation: fr }, en: { translation: en } },
  lng: 'fr', // default, overridden by initLanguage()
  fallbackLng: 'fr',
  interpolation: { escapeValue: false },
  compatibilityJSON: 'v4',
});

/** Call once at app startup to load persisted language */
export async function initLanguage() {
  const lang = await getInitialLanguage();
  await i18n.changeLanguage(lang);
}

/** Change language and persist */
export async function setLanguage(code: LanguageCode) {
  await i18n.changeLanguage(code);
  await SafeStorage.setItem(LANGUAGE_KEY, code);
}

export default i18n;
