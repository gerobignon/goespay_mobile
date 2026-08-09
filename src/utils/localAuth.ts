import { Platform } from 'react-native';
import type { TFunction } from 'i18next';
import { usePinStore } from '../stores/pinStore';
import { showAlert } from '../stores/alertStore';

/** Un verrou d'appareil est-il réellement armé (code, biométrie, clé) ? */
export function hasLocalLock(): boolean {
  return usePinStore.getState().isSetupDone;
}

/**
 * Écran où l'on arme le verrou. Sur mobile il est obligatoire et posé par le
 * parcours dédié ; sur le web il est optionnel et vit dans les réglages.
 */
export const LOCK_SETUP_ROUTE = Platform.OS === 'web' ? '/account/security' : '/(auth)/setup-pin';

/**
 * Exige un verrou local avant un geste sensible.
 *
 * Rend `true` si le verrou est déjà armé — l'appelant enchaîne alors sur la
 * confirmation (LocalAuthModal). Sinon l'utilisateur est envoyé l'armer : c'est
 * la condition d'entrée dans les cartes et la messagerie, pas une suggestion.
 */
export function requireLocalLock(
  t: TFunction,
  go: (route: string) => void,
  message?: string,
): boolean {
  if (hasLocalLock()) return true;

  showAlert(
    t('security.lockRequiredTitle'),
    message ?? t('security.lockRequiredMessage'),
    [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('security.lockRequiredAction'), onPress: () => go(LOCK_SETUP_ROUTE) },
    ],
  );
  return false;
}
