import React, { ReactNode, useCallback, useRef } from 'react';
import { Animated, Easing, ImageBackground, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTheme } from './ThemeProvider';

const bgDark = require('../../assets/bg_page.jpg');
const bgLight = require('../../assets/bg_page_light.jpg');

interface ScreenBackgroundProps {
  children: ReactNode;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  style?: ViewStyle;
  /** Animation d'entrée (fondu + léger slide) au montage. Mettre `false` pour la désactiver. */
  animateEntrance?: boolean;
}

export function ScreenBackground({ children, edges = ['top', 'bottom'], style, animateEntrance = true }: ScreenBackgroundProps) {
  const { isDark, colors } = useTheme();

  // Entrée : opacité 0→1 + translateY 16→0. useNativeDriver → pas d'impact perf/layout.
  // Rejouée à chaque focus de l'écran (changement d'onglet, retour arrière…) → bien visible.
  const enter = useRef(new Animated.Value(animateEntrance ? 0 : 1)).current;
  useFocusEffect(
    useCallback(() => {
      if (!animateEntrance) return;
      enter.setValue(0);
      Animated.timing(enter, {
        toValue: 1,
        duration: 550,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    }, [animateEntrance])
  );

  return (
    <ImageBackground
      source={isDark ? bgDark : bgLight}
      style={[styles.background, { backgroundColor: colors.background }]}
    >
      <SafeAreaView
        style={[styles.overlay, { backgroundColor: isDark ? 'rgba(23,30,43,0.25)' : 'rgba(240,242,245,0.3)' }, style]}
        edges={edges}
      >
        <Animated.View
          style={{
            flex: 1,
            opacity: enter,
            transform: [
              { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [40, 0] }) },
              { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
            ],
          }}
        >
          {children}
        </Animated.View>
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
