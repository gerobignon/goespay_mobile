import React, { ReactNode } from 'react';
import { View, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { BorderRadius, Spacing, type ColorPalette } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useTheme } from './ThemeProvider';

interface GlassCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Carte « glassmorphism » de marque : vrai flou dépoli via expo-blur (natif
 * iOS/Android ET web), fine teinte de marque, ombre douce et **contour dégradé
 * bleu→or sur les 4 côtés** (LinearGradient servant de bordure, contenu inséré de
 * 1,5px). Se pose par-dessus le fond image+dégradé de ScreenBackground.
 */
export function GlassCard({ children, style }: GlassCardProps) {
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  return (
    <LinearGradient
      colors={
        isDark
          ? ['rgba(49,118,254,0.85)', 'rgba(244,178,40,0.85)']
          : ['rgba(49,118,254,0.55)', 'rgba(49,118,254,0.18)']
      }
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.border}
    >
      <View style={styles.clip}>
        <BlurView
          intensity={isDark ? 40 : 55}
          tint={isDark ? 'dark' : 'light'}
          style={StyleSheet.absoluteFill}
        />
        {/* Teinte de marque légère par-dessus le flou (cohérence + lisibilité). */}
        <View style={styles.tint} pointerEvents="none" />
        <View style={[styles.content, style]}>{children}</View>
      </View>
    </LinearGradient>
  );
}

const createStyles = (Colors: ColorPalette) => {
  const dark = Colors.background === '#171e2b';
  return StyleSheet.create({
    // La gradient sert de bordure : padding = épaisseur du contour.
    border: {
      borderRadius: BorderRadius.xl,
      padding: 1.5,
      maxWidth: 460,
      width: '100%',
      alignSelf: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: dark ? 0.35 : 0.12,
      shadowRadius: 28,
      elevation: 10,
    },
    // Conteneur qui découpe le flou aux coins arrondis (requis Android).
    clip: {
      borderRadius: BorderRadius.xl - 1.5,
      overflow: 'hidden',
      // Repli si le flou ne rend pas (vieux Android / web sans support).
      backgroundColor: dark ? 'rgba(22,30,48,0.55)' : 'rgba(255,255,255,0.55)',
    },
    tint: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: dark ? 'rgba(22,30,48,0.30)' : 'rgba(255,255,255,0.35)',
    },
    content: {
      padding: Spacing.lg,
    },
  });
};
