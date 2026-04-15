import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';

interface KycBannerProps {
  onPress?: () => void;
  status?: 0 | 2;
}

export function KycBanner({ onPress, status = 0 }: KycBannerProps) {
  const isPending = status === 2;
  const message = isPending
    ? 'Votre dossier est en cours de vérification. Veuillez patienter.'
    : 'Votre compte n\'est pas encore validé. Vérifiez votre identité.';
  const color = isPending ? Colors.info ?? '#3b82f6' : Colors.warning;

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: color + '20' }]}
      onPress={isPending ? undefined : onPress}
      activeOpacity={isPending ? 1 : 0.7}
    >
      <FontAwesome6
        name={isPending ? 'clock' : 'triangle-exclamation'}
        size={16}
        color={color}
      />
      <Text style={[styles.text, { color }]}>
        {message}
      </Text>
      {!isPending && (
        <FontAwesome6 name="chevron-right" size={12} color={color} />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '20',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  text: {
    flex: 1,
    color: Colors.warning,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
  },
});
