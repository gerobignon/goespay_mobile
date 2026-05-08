import React, { ReactNode } from 'react';
import { ImageBackground, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './ThemeProvider';

const bgDark = require('../../assets/bg_page.jpg');
const bgLight = require('../../assets/bg_page_light.jpg');

interface ScreenBackgroundProps {
  children: ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  style?: ViewStyle;
}

export function ScreenBackground({ children, edges = ['top', 'bottom'], style }: ScreenBackgroundProps) {
  const { isDark, colors } = useTheme();

  return (
    <ImageBackground
      source={isDark ? bgDark : bgLight}
      style={[styles.background, { backgroundColor: colors.background }]}
    >
      <SafeAreaView
        style={[styles.overlay, { backgroundColor: isDark ? 'rgba(23,30,43,0.25)' : 'rgba(240,242,245,0.3)' }, style]}
        edges={edges}
      >
        {children}
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
});
