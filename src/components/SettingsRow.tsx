import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts, IconSize } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

interface Props {
  /** FontAwesome6 icon rendered inside the standard circle. */
  icon?: string;
  iconColor?: string;
  /** Fully custom leading element (e.g. an emoji flag), replaces the circle. */
  leading?: React.ReactNode;
  /** Custom node rendered inside the standard circle (e.g. a currency code). */
  leadingInCircle?: React.ReactNode;
  label: string;
  description?: string;
  /** Trailing element (chevron, check, spinner…). */
  trailing?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  /** Hide the top divider (e.g. for the first row in a group). */
  noBorder?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * Unified settings / option row: leading icon + label + optional description + trailing.
 * Replaces the duplicated `securityRow` pattern in security / settings / currency.
 */
export default function SettingsRow({
  icon,
  iconColor,
  leading,
  leadingInCircle,
  label,
  description,
  trailing,
  onPress,
  disabled,
  noBorder,
  style,
}: Props) {
  const styles = useThemedStyles(createStyles);

  const renderLeading = () => {
    if (leading) return leading;
    if (leadingInCircle) return <View style={styles.iconCircle}>{leadingInCircle}</View>;
    if (icon) {
      return (
        <View style={styles.iconCircle}>
          <FontAwesome6 name={icon as any} size={16} color={iconColor ?? Colors.textMuted} />
        </View>
      );
    }
    return null;
  };

  return (
    <TouchableOpacity
      style={[styles.row, noBorder && styles.noBorder, style]}
      onPress={onPress}
      disabled={disabled || !onPress}
      activeOpacity={onPress ? 0.6 : 1}
    >
      {renderLeading()}
      <View style={styles.body}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.desc}>{description}</Text> : null}
      </View>
      {trailing}
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      // 12px vertical for a comfortable touch target (was 8px / Spacing.sm)
      paddingVertical: Spacing.sm + Spacing.xs,
      gap: Spacing.md,
      borderTopWidth: 1,
      borderTopColor: Colors.border,
    },
    noBorder: {
      borderTopWidth: 0,
    },
    iconCircle: {
      width: IconSize.lg,
      height: IconSize.lg,
      borderRadius: IconSize.lg / 2,
      backgroundColor: Colors.inputBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    body: {
      flex: 1,
    },
    label: {
      color: Colors.text,
      fontSize: FontSize.md,
      fontFamily: Fonts.medium,
    },
    desc: {
      color: Colors.textMuted,
      fontSize: FontSize.xs,
      fontFamily: Fonts.regular,
      marginTop: 1,
    },
  });
