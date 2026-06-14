import React, { useRef } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  StyleProp,
  Animated,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors, type ColorPalette, BorderRadius, FontSize, Spacing, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface ButtonProps {
  title: string;
  onPress: () => void;
  icon?: string;
  variant?: 'primary' | 'secondary' | 'outline';
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
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
  const styles = useThemedStyles(createStyles);
  const scale = useRef(new Animated.Value(1)).current;
  const bgColor =
    variant === 'primary'
      ? Colors.primary
      : variant === 'secondary'
      ? Colors.secondary
      : 'transparent';

  const borderColor =
    variant === 'outline' ? Colors.primary : 'transparent';

  return (
    <AnimatedTouchable
      style={[
        styles.button,
        { backgroundColor: bgColor, borderColor },
        variant === 'outline' && styles.outline,
        disabled && styles.disabled,
        style,
        { transform: [{ scale }] },
      ]}
      onPress={onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, friction: 6 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }).start()}
      disabled={disabled || loading}
      activeOpacity={0.8}
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
    </AnimatedTouchable>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.pill,
    minHeight: 42,
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
