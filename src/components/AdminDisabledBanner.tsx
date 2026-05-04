import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

interface Props {
  message: string;
}

export function AdminDisabledBanner({ message }: Props) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.banner}>
      <FontAwesome6 name="user-shield" size={14} color="#fff" style={{ marginRight: 8 }} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  text: {
    flex: 1,
    color: '#fff',
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
  },
});
