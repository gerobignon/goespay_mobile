import React, { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

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

/** Pill action button with press-bounce. */
function ActionPill({ action, styles }: { action: TxAction; styles: any }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <AnimatedTouchable
      style={[styles.btn, { backgroundColor: action.color }, action.loading && { opacity: 0.6 }, { transform: [{ scale }] }]}
      onPress={action.onPress}
      onPressIn={() => Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, friction: 6 }).start()}
      onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }).start()}
      disabled={action.loading}
      activeOpacity={0.85}
    >
      <FontAwesome6 name={action.icon as any} size={12} color={Colors.white} />
      <Text style={styles.btnText}>{action.label}</Text>
    </AnimatedTouchable>
  );
}

/** Centered, wrapping row of pill action buttons for transaction detail screens. */
export default function ActionButtonRow({ actions }: Props) {
  const styles = useThemedStyles(createStyles);
  if (!actions.length) return null;

  return (
    <View style={styles.row}>
      {actions.map((a) => (
        <ActionPill key={a.key} action={a} styles={styles} />
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
