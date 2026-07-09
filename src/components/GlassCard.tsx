import React, { ReactNode } from 'react';
import { View, StyleSheet, Platform, ViewStyle, StyleProp } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BorderRadius, Spacing, type ColorPalette } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useTheme } from './ThemeProvider';

interface GlassCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Carte « glassmorphism » de marque : fond translucide + flou (web), ombre douce
 * et **contour dégradé bleu→or sur les 4 côtés** (via une LinearGradient qui sert
 * de bordure, contenu inséré de 1,5px). Se pose par-dessus le fond image+dégradé
 * de ScreenBackground pour un rendu premium.
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
      <View style={[styles.inner, style]}>{children}</View>
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
    inner: {
      backgroundColor: dark ? 'rgba(22,30,48,0.72)' : 'rgba(255,255,255,0.82)',
      borderRadius: BorderRadius.xl - 1.5,
      padding: Spacing.lg,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? ({ backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' } as any)
        : {}),
    },
  });
};
