import React, { useRef, useState, useEffect } from 'react';
import { View, Text, TextInput, StyleSheet, NativeSyntheticEvent, TextInputKeyPressEventData } from 'react-native';
import { Colors, type ColorPalette, BorderRadius, FontSize, Spacing, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  onComplete?: () => void;
}

export function OtpInput({ value, onChange, length = 6, onComplete }: OtpInputProps) {
  const styles = useThemedStyles(createStyles);
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
        <View key={i} style={styles.cellWrapper}>
          <TextInput
            ref={(ref) => { inputs.current[i] = ref; }}
            style={[styles.cell, digits[i] ? styles.cellFilled : null]}
            value={digits[i]}
            onChangeText={(t) => handleChange(t, i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={length}
            textAlign="center"
            selectionColor={Colors.secondary}
            autoComplete="one-time-code"
          />
          {!digits[i] && (
            <View style={styles.dotOverlay} pointerEvents="none">
              <Text style={styles.dotText}>·</Text>
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cellWrapper: {
    position: 'relative',
    width: 40,
    height: 52,
  },
  cell: {
    width: 40,
    height: 52,
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
  dotOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dotText: {
    color: Colors.textMuted,
    fontSize: 28,
    lineHeight: 32,
    textAlign: 'center',
  },
});
