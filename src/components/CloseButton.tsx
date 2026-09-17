import React from 'react';
import { StyleSheet, TouchableOpacity, type StyleProp, type ViewStyle } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useColors } from './ThemeProvider';

interface CloseButtonProps {
  onPress: () => void;
  /** Taille du glyphe. La zone tactile, elle, ne bouge pas. */
  size?: number;
  color?: string;
  /** 'xmark' par défaut ; 'arrow-left' pour un retour d'étape. */
  icon?: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * Croix de fermeture des modals et des feuilles.
 *
 * La zone tactile vient d'un carré de 40 px posé autour du glyphe, pas de
 * `hitSlop` : react-native-web ignore purement et simplement cette propriété,
 * si bien que sur la PWA la cible se réduisait aux 18 à 20 px de l'icône et
 * qu'un appui sur deux tombait à côté. La marge négative rend au parent
 * l'encombrement du glyphe seul : aucune mise en page ne bouge.
 */
export function CloseButton({
  onPress,
  size = 20,
  color,
  icon = 'xmark',
  disabled,
  style,
  accessibilityLabel,
}: CloseButtonProps) {
  const colors = useColors();
  const { t } = useTranslation();

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.6}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? t('common.close')}
      style={[styles.button, style]}
    >
      <FontAwesome6 name={icon as any} size={size} color={color ?? colors.textMuted} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    margin: -10,
  },
});
