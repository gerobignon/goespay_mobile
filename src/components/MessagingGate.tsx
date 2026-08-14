import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LocalAuthModal } from './LocalAuthModal';
import { useColors } from './ThemeProvider';
import { usePinStore } from '../stores/pinStore';
import { useMessagingLockStore } from '../stores/messagingLockStore';
import { hasLocalLock } from '../utils/localAuth';

/**
 * Verrou d'entrée de la messagerie — OPTIONNEL.
 *
 * Par défaut la messagerie s'ouvre comme n'importe quel onglet. Qui veut la
 * protéger arme le verrou depuis Réglages › Sécurité ou les réglages des
 * messages ; on demande alors la même preuve que pour ouvrir l'app. La
 * confirmation vaut pour toute la session — la redemander à chaque aller-retour
 * entre l'onglet et une conversation rendrait la messagerie inutilisable — et
 * tombe dès que l'app se verrouille, c'est-à-dire dès qu'elle passe en
 * arrière-plan.
 */
let confirmedForSession = false;

interface Props {
  children: React.ReactNode;
  /** Où renvoyer l'utilisateur s'il refuse la confirmation. */
  onDeny?: () => void;
}

export function MessagingGate({ children, onDeny }: Props) {
  const router = useRouter();
  const colors = useColors();
  const { t } = useTranslation();
  const isLocked = usePinStore((s) => s.isLocked);
  const isInitialized = usePinStore((s) => s.isInitialized);

  const lockEnabled = useMessagingLockStore((s) => s.enabled);
  const lockLoaded = useMessagingLockStore((s) => s.isLoaded);
  const loadLock = useMessagingLockStore((s) => s.load);
  const setLockEnabled = useMessagingLockStore((s) => s.setEnabled);

  const [confirmed, setConfirmed] = useState(confirmedForSession);
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    if (!lockLoaded) loadLock();
  }, [lockLoaded]);

  // L'app s'est reverrouillée : la messagerie redemande sa confirmation.
  useEffect(() => {
    if (isLocked) {
      confirmedForSession = false;
      setConfirmed(false);
    }
  }, [isLocked]);

  useEffect(() => {
    if (confirmed || asking || !isInitialized || isLocked || !lockLoaded || !lockEnabled) return;

    // Le verrou de l'appareil a été désarmé depuis (PIN effacé, clé révoquée) :
    // il n'y a plus rien à demander. On ne barre pas l'entrée pour autant — on
    // retire le réglage, qui ne veut plus rien dire.
    if (!hasLocalLock()) {
      setLockEnabled(false);
      return;
    }
    setAsking(true);
  }, [confirmed, asking, isInitialized, isLocked, lockLoaded, lockEnabled]);

  const deny = () => {
    setAsking(false);
    onDeny ? onDeny() : router.replace('/(tabs)');
  };

  const accept = () => {
    confirmedForSession = true;
    setConfirmed(true);
    setAsking(false);
  };

  // Verrou non demandé (réglage éteint, ou pas encore lu) : la messagerie
  // s'ouvre directement. `lockLoaded` évite l'écran vide d'un instant au
  // premier rendu.
  if (lockLoaded && !lockEnabled) return <>{children}</>;

  if (!confirmed) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <LocalAuthModal
          visible={asking}
          title={t('security.confirmMessagesTitle')}
          onSuccess={accept}
          onClose={deny}
        />
      </View>
    );
  }

  return <>{children}</>;
}
