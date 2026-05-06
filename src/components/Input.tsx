import React, { useState, forwardRef } from 'react';
import {
  View,
  TextInput as RNTextInput,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors, type ColorPalette, BorderRadius, FontSize, Spacing, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
  rightAction?: { icon: string; onPress: () => void; loading?: boolean };
  prefix?: string;
}

export const Input = forwardRef<RNTextInput, InputProps>(function Input(
  { label, error, containerStyle, style, secureTextEntry, rightAction, prefix, onFocus, onBlur, ...props },
  ref
) {
  const styles = useThemedStyles(createStyles);
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);
  const isPassword = secureTextEntry;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <View style={[styles.inputRow, focused && styles.inputFocused, error && styles.inputError]}>
        {prefix && <Text style={styles.prefixText}>{prefix}</Text>}
        <RNTextInput
          ref={ref}
          style={[styles.input, style]}
          placeholderTextColor={Colors.textMuted}
          selectionColor={Colors.secondary}
          secureTextEntry={isPassword && !showPassword}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...props}
        />
        {isPassword && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            style={styles.eyeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <FontAwesome6
              name={showPassword ? 'eye' : 'eye-slash'}
              size={18}
              color={Colors.textMuted}
            />
          </TouchableOpacity>
        )}
        {rightAction && !isPassword && (
          <TouchableOpacity
            onPress={rightAction.onPress}
            style={styles.eyeBtn}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            disabled={rightAction.loading}
          >
            <FontAwesome6
              name={rightAction.loading ? 'circle-notch' : rightAction.icon}
              size={18}
              color={Colors.secondary}
            />
          </TouchableOpacity>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
});

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginBottom: Spacing.xs,
    fontFamily: Fonts.semiBold,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    flex: 1,
    color: Colors.text,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : {}),
  } as any,
  prefixText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    paddingLeft: Spacing.md,
    fontFamily: Fonts.regular,
  },
  eyeBtn: {
    paddingHorizontal: Spacing.md,
  },
  inputError: {
    borderColor: Colors.error,
  },
  inputFocused: {
    borderColor: Colors.secondary,
  },
  error: {
    color: Colors.error,
    fontSize: FontSize.xs,
    marginTop: Spacing.xs,
  },
});
