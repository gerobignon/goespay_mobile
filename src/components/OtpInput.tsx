import React, { useRef, useState, useEffect } from 'react';
import { View, TextInput, StyleSheet, NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';
import { Colors, BorderRadius, FontSize, Spacing, Fonts } from '../constants/theme';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  onComplete?: () => void;
}

export function OtpInput({ value, onChange, length = 6, onComplete }: OtpInputProps) {
  const inputs = useRef<(TextInput | null)[]>([]);

  const digits = Array.from({ length }, (_, i) => value[i] || '');

  // Auto-submit when all digits are entered
  useEffect(() => {
    if (value.length === length && onComplete) {
      onComplete();
    }
  }, [value, length, onComplete]);

  const handleChange = (text: string, index: number) => {
    // Handle paste of full code
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length > 1) {
      const next = cleaned.slice(0, length);
      onChange(next);
      const focusIndex = Math.min(next.length, length - 1);
      inputs.current[focusIndex]?.focus();
      return;
    }

    const newDigits = [...digits];
    newDigits[index] = cleaned;
    onChange(newDigits.join(''));
    if (cleaned && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      const newDigits = [...digits];
      newDigits[index - 1] = '';
      onChange(newDigits.join(''));
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.row}>
      {Array.from({ length }, (_, i) => (
        <TextInput
          key={i}
          ref={(ref) => { inputs.current[i] = ref; }}
          style={[styles.cell, digits[i] ? styles.cellFilled : null]}
          value={digits[i]}
          onChangeText={(t) => handleChange(t, i)}
          onKeyPress={(e) => handleKeyPress(e, i)}
          keyboardType="number-pad"
          maxLength={length} // allow paste
          textAlign="center"
          selectionColor={Colors.secondary}
          placeholderTextColor={Colors.textMuted}
          placeholder="·"
          autoComplete="one-time-code"
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cell: {
    width: 48,
    height: 56,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
  },
  cellFilled: {
    borderColor: Colors.secondary,
  },
});
