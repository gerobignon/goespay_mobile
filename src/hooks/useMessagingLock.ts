import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useMessagingLockStore } from '../stores/messagingLockStore';
import { requireLocalLock } from '../utils/localAuth';

/**
 * Interrupteur du verrou de la messagerie, partagé par Réglages › Sécurité et
 * les réglages des messages : les deux écrans commandent le même réglage.
 *
 * L'activer suppose un verrou d'appareil armé — sinon il n'y aurait rien à
 * demander : on renvoie l'armer. Le désactiver passe par une confirmation
 * (`askConfirm` → LocalAuthModal côté écran) : sans elle, qui a l'app ouverte
 * lèverait la protection d'un doigt.
 */
export function useMessagingLock() {
  const router = useRouter();
  const { t } = useTranslation();

  const enabled = useMessagingLockStore((s) => s.enabled);
  const isLoaded = useMessagingLockStore((s) => s.isLoaded);
  const load = useMessagingLockStore((s) => s.load);
  const setEnabled = useMessagingLockStore((s) => s.setEnabled);

  const [askConfirm, setAskConfirm] = useState(false);

  useEffect(() => {
    if (!isLoaded) load();
  }, [isLoaded]);

  const toggle = () => {
    if (enabled) {
      setAskConfirm(true);
      return;
    }
    if (!requireLocalLock(t, (route) => router.push(route as any), t('security.messagesLockMessage'))) return;
    setEnabled(true);
  };

  /** Confirmation réussie : on lève le verrou. */
  const confirmDisable = () => {
    setAskConfirm(false);
    setEnabled(false);
  };

  return {
    enabled,
    toggle,
    askConfirm,
    confirmDisable,
    cancelConfirm: () => setAskConfirm(false),
  };
}
