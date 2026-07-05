import React, { ReactNode, useCallback, useRef } from 'react';
import { Animated, Easing, ImageBackground, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTheme } from './ThemeProvider';

const bgDark = require('../../assets/bg_page.jpg');
const bgLight = require('../../assets/bg_page_light.jpg');

// Overlay teinté par-dessus l'image plexus.
// Sombre : dégradé diagonal aux couleurs de marque — bleu GoesPay (#3176FE) en
// haut-gauche → noir profond au centre → or GoesPay (#F4B228) en bas-droite.
// Miroir sombre du dégradé clair « bleu-blanc-jaune » → « bleu-noir-jaune ».
const DARK_OVERLAY = [
  'rgba(49,118,254,0.38)',
  'rgba(24,44,86,0.34)',
  'rgba(8,11,18,0.32)',
  'rgba(96,70,22,0.30)',
  'rgba(244,178,40,0.30)',
] as const;
const DARK_LOCATIONS = [0, 0.26, 0.5, 0.74, 1] as const;
// Clair : aplat quasi uniforme (aspect inchangé, apprécié tel quel).
const LIGHT_OVERLAY = ['rgba(240,242,245,0.3)', 'rgba(240,242,245,0.3)'] as const;

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
      <LinearGradient
        colors={isDark ? DARK_OVERLAY : LIGHT_OVERLAY}
        locations={isDark ? DARK_LOCATIONS : undefined}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={styles.overlay}
      >
        <SafeAreaView style={[styles.overlay, style]} edges={edges}>
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
      </LinearGradient>
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
