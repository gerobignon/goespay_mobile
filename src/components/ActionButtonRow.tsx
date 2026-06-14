import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

export interface TxAction {
  key: string;
  icon: string;
  label: string;
  /** Pill background color. */
  color: string;
  onPress: () => void;
  loading?: boolean;
}

interface Props {
  actions: TxAction[];
}

/** Centered, wrapping row of pill action buttons for transaction detail screens. */
export default function ActionButtonRow({ actions }: Props) {
  const styles = useThemedStyles(createStyles);
  if (!actions.length) return null;

  return (
    <View style={styles.row}>
      {actions.map((a) => (
        <TouchableOpacity
          key={a.key}
          style={[styles.btn, { backgroundColor: a.color }, a.loading && { opacity: 0.6 }]}
          onPress={a.onPress}
          disabled={a.loading}
          activeOpacity={0.7}
        >
          <FontAwesome6 name={a.icon as any} size={12} color={Colors.white} />
          <Text style={styles.btnText}>{a.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      gap: Spacing.sm,
      marginBottom: Spacing.lg,
    },
    btn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.pill,
    },
    btnText: {
      color: Colors.white,
      fontSize: FontSize.xs,
      fontFamily: Fonts.bold,
    },
  });
