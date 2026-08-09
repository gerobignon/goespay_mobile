import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { LocalAuthModal } from './LocalAuthModal';
import { useColors } from './ThemeProvider';
import { usePinStore } from '../stores/pinStore';
import { requireLocalLock } from '../utils/localAuth';

/**
 * Verrou d'entrée de la messagerie.
 *
 * Les conversations sont des données personnelles : on les protège comme les
 * données d'une carte, par le verrou de l'appareil. La confirmation vaut pour
 * toute la session — la redemander à chaque aller-retour entre l'onglet et une
 * conversation rendrait la messagerie inutilisable — et tombe dès que l'app se
 * verrouille, c'est-à-dire dès qu'elle passe en arrière-plan.
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

  const [confirmed, setConfirmed] = useState(confirmedForSession);
  const [asking, setAsking] = useState(false);

  // L'app s'est reverrouillée : la messagerie redemande sa confirmation.
  useEffect(() => {
    if (isLocked) {
      confirmedForSession = false;
      setConfirmed(false);
    }
  }, [isLocked]);

  useEffect(() => {
    if (confirmed || asking || !isInitialized || isLocked) return;

    if (!requireLocalLock(t, (route) => router.replace(route as any))) {
      deny();
      return;
    }
    setAsking(true);
  }, [confirmed, asking, isInitialized, isLocked]);

  const deny = () => {
    setAsking(false);
    onDeny ? onDeny() : router.replace('/(tabs)');
  };

  const accept = () => {
    confirmedForSession = true;
    setConfirmed(true);
    setAsking(false);
  };

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
