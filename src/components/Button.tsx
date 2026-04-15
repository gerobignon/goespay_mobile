import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors, BorderRadius, FontSize, Spacing, Fonts } from '../constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({
  title,
  onPress,
  icon,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
}: ButtonProps) {
  const bgColor =
    variant === 'primary'
      ? Colors.primary
      : variant === 'secondary'
      ? Colors.secondary
      : 'transparent';

  const borderColor =
    variant === 'outline' ? Colors.primary : 'transparent';

  return (
    <TouchableOpacity
      style={[
        styles.button,
        { backgroundColor: bgColor, borderColor },
        variant === 'outline' && styles.outline,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={Colors.white} />
      ) : (
        <>
          {icon && (
            <FontAwesome6
              name={icon}
              size={16}
              color={variant === 'outline' ? Colors.primary : Colors.white}
              style={styles.icon}
            />
          )}
          <Text
            style={[
              styles.text,
              variant === 'outline' && { color: Colors.primary },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.pill,
    minHeight: 50,
  },
  outline: {
    borderWidth: 1.5,
  },
  disabled: {
    opacity: 0.5,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  text: {
    color: Colors.white,
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
  },
});
