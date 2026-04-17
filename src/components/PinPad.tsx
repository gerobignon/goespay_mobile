import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

interface PinPadProps {
  length?: 4 | 6;
  onComplete: (pin: string) => void;
  onBiometric?: () => void;
  error?: string | null;
  label?: string;
  reset?: boolean; // quand true, efface le pin saisi
}

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

export function PinPad({ length = 4, onComplete, onBiometric, error, label, reset }: PinPadProps) {
  const styles = useThemedStyles(createStyles);
  const [pin, setPin] = useState('');

  // reset toggle: vide le PIN à chaque flip, vibre si erreur présente
  useEffect(() => {
    setPin('');
    if (error) Vibration.vibrate(300);
  }, [reset]);

  useEffect(() => {
    if (pin.length === length) {
      onComplete(pin);
    }
  }, [pin]);

  const press = (key: string) => {
    if (key === '⌫') {
      setPin((p) => p.slice(0, -1));
    } else if (key === '') {
      // espace vide = biométrie si disponible
      if (onBiometric) onBiometric();
    } else {
      if (pin.length < length) {
        setPin((p) => p + key);
      }
    }
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {/* Indicateurs de points */}
      <View style={styles.dots}>
        {Array.from({ length }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < pin.length && styles.dotFilled,
              // Affiche l'erreur (rouge) seulement si le pin est vide (juste après reset)
              error && pin.length === 0 ? styles.dotError : null,
            ]}
          />
        ))}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {/* Clavier */}
      <View style={styles.grid}>
        {KEYS.map((key, i) => {
          const isBioKey = key === '' && !!onBiometric;
          return (
            <TouchableOpacity
              key={i}
              style={[styles.key, key === '' && !onBiometric && styles.keyEmpty]}
              onPress={() => press(key)}
              disabled={key === '' && !onBiometric}
              activeOpacity={0.7}
            >
              {isBioKey ? (
                <FontAwesome6 name="face-smile" size={24} color={Colors.textMuted} />
              ) : key === '⌫' ? (
                <FontAwesome6 name="delete-left" size={22} color={Colors.text} />
              ) : (
                <Text style={styles.keyText}>{key}</Text>
              )}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.lg,
  },
  label: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginVertical: Spacing.sm,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: Colors.textMuted,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  dotError: {
    borderColor: Colors.error,
    backgroundColor: Colors.error,
  },
  error: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: 280,
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  key: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyEmpty: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  keyText: {
    color: Colors.text,
    fontSize: 24,
    fontFamily: Fonts.semiBold,
  },
});
