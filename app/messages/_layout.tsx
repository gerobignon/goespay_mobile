import React from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { useResponsive } from '../../src/hooks/useResponsive';
import { useColors } from '../../src/components/ThemeProvider';
import { DesktopHeader } from '../../src/components/DesktopHeader';
import { DesktopFooter } from '../../src/components/DesktopFooter';

/** Section messagerie : chaque écran porte son propre en-tête. */
export default function MessagesLayout() {
  const { isDesktop } = useResponsive();
  const colors = useColors();

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
