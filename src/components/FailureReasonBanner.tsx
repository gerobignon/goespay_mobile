import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

interface Props {
  // Motif d'échec déjà traduit par le serveur (`user_error`). Vide → rien.
  message?: string | null;
}

/**
 * Motif d'un échec reconnu par le serveur (ex. numéro incorrect ou mauvais
 * réseau), affiché en aplat plein pour qu'il ne passe pas inaperçu.
 */
export function FailureReasonBanner({ message }: Props) {
  const styles = useThemedStyles(createStyles);
  const text = (message ?? '').trim();
  if (!text) return null;
  return (
    <View style={styles.banner}>
      <FontAwesome6 name="triangle-exclamation" size={18} color="#fff" style={{ marginTop: 2 }} />
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    alignSelf: 'stretch',
    backgroundColor: Colors.errorSolid,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.md,
  },
  text: {
    flex: 1,
    color: '#fff',
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    lineHeight: 22,
  },
});
