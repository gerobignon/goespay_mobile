import React from 'react';
import {
  Text,
  StyleSheet,
  TouchableOpacity,
  type ViewStyle,
  type StyleProp,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import {
  type ColorPalette,
  BorderRadius,
  FontSize,
  Fonts,
  Spacing,
} from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useColors } from './ThemeProvider';

interface LinkButtonProps {
  title: string;
  /** Action directe. Ignoré si `href` est fourni. */
  onPress?: () => void;
  /** Route expo-router à ouvrir (alternative à `onPress`). */
  href?: string;
  icon?: string;
  /**
   * `soft` : pilule bordée et légèrement teintée, pour une action alternative
   * qui doit rester visible sous le bouton principal.
   * `quiet` : simple libellé souligné, pour un renvoi discret.
   */
  variant?: 'soft' | 'quiet';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Action secondaire des écrans d'authentification. Remplace les anciens libellés
 * dorés posés à même la carte : sur le thème clair, l'or de marque ne se lisait
 * plus. Ici le libellé prend `Colors.link` (or sur fond sombre, bleu assombri
 * sur fond clair) et la variante `soft` lui donne une vraie surface cliquable.
 */
export function LinkButton({
  title,
  onPress,
  href,
  icon,
  variant = 'soft',
  disabled = false,
  style,
}: LinkButtonProps) {
  const styles = useThemedStyles(createStyles);
  const Colors = useColors();
  const router = useRouter();

  const handlePress = () => {
    if (href) {
      router.push(href as never);
      return;
    }
    onPress?.();
  };

  const soft = variant === 'soft';

  return (
    <TouchableOpacity
      accessibilityRole="button"
      activeOpacity={0.7}
      disabled={disabled}
      onPress={handlePress}
      style={[
        styles.base,
        soft ? styles.soft : styles.quiet,
        disabled && styles.disabled,
        style,
      ]}
    >
      {icon && (
        <FontAwesome6
          name={icon}
          size={14}
          color={soft ? Colors.link : Colors.textSecondary}
          style={styles.icon}
        />
      )}
      <Text style={soft ? styles.softText : styles.quietText}>{title}</Text>
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    borderRadius: BorderRadius.pill,
  },
  soft: {
    minHeight: 40,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.linkSurface,
    borderWidth: 1,
    borderColor: Colors.linkBorder,
  },
  quiet: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
  },
  disabled: {
    opacity: 0.5,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  softText: {
    color: Colors.link,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
  },
  quietText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});
