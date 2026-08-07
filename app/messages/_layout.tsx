import React, { useEffect } from 'react';
import { View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useResponsive } from '../../src/hooks/useResponsive';
import { useColors } from '../../src/components/ThemeProvider';
import { useMessagingAccess } from '../../src/hooks/useMessagingAccess';
import { useAuthStore } from '../../src/stores/authStore';
import { DesktopHeader } from '../../src/components/DesktopHeader';
import { DesktopFooter } from '../../src/components/DesktopFooter';

/**
 * Section messagerie : chaque écran porte son propre en-tête.
 *
 * Garde d'accès : sur le web ces routes s'atteignent en tapant l'URL, sans
 * passer par l'onglet. Un compte sans droit de messagerie est renvoyé à
 * l'accueil — le serveur refuserait de toute façon, mais autant ne pas
 * afficher une coquille vide.
 */
export default function MessagesLayout() {
  const { isDesktop } = useResponsive();
  const colors = useColors();
  const router = useRouter();
  const canMessage = useMessagingAccess();
  // Le profil arrive après le token : on ne renvoie personne tant qu'il manque.
  const userLoaded = useAuthStore((s) => !!s.user);

  useEffect(() => {
    if (userLoaded && !canMessage) {
      router.replace('/(tabs)');
    }
  }, [userLoaded, canMessage]);

  if (userLoaded && !canMessage) {
    return <View style={{ flex: 1, backgroundColor: colors.background }} />;
  }

  const stack = <Stack screenOptions={{ headerShown: false }} />;

  if (!isDesktop) return stack;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <DesktopHeader />
      <View style={{ flex: 1 }}>{stack}</View>
      <DesktopFooter />
    </View>
  );
}
