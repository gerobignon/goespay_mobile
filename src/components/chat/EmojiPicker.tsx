import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, useWindowDimensions } from 'react-native';
import { BorderRadius, FontSize, Fonts, Spacing, withAlpha, type ColorPalette } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useColors } from '../ThemeProvider';

/**
 * Sélecteur d'emojis.
 *
 * Liste figée plutôt qu'une dépendance : les bibliothèques d'emojis embarquent
 * plusieurs milliers d'entrées et leurs images, pour un usage qui se limite en
 * pratique à quelques dizaines de symboles. Ceux-ci sont rendus par la police
 * système, donc rien à télécharger.
 */
const CATEGORIES: { key: string; icon: string; emojis: string[] }[] = [
  {
    key: 'smileys',
    icon: '🙂',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🙂', '🙃', '😉', '😊',
      '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😋', '😛', '😜', '🤪', '🤨',
      '🧐', '🤓', '😎', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '😣',
      '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳',
      '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥',
      '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴',
      '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑',
    ],
  },
  {
    key: 'gestures',
    icon: '👍',
    emojis: [
      '👍', '👎', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
      '👆', '👇', '☝️', '✋', '🤚', '🖐️', '🖖', '👋', '🤝', '🙏', '✍️', '💪',
      '🦾', '🙌', '👏', '🤲', '🫶', '👊', '✊', '🤛', '🤜', '👐', '💅', '🤳',
    ],
  },
  {
    key: 'hearts',
    icon: '❤️',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕',
      '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '🔥', '✨', '⭐', '🌟',
      '💫', '💥', '💯', '🎉', '🎊', '🎈', '🎁', '🏆', '🥇', '👑', '💎', '🌈',
    ],
  },
  {
    key: 'money',
    icon: '💰',
    emojis: [
      '💰', '💵', '💴', '💶', '💷', '💸', '💳', '🧾', '🪙', '💱', '💲', '🏦',
      '🏧', '📈', '📉', '📊', '🤝', '⏳', '⌛', '✅', '☑️', '❌', '⚠️', '🔒',
      '🔓', '🔑', '📱', '💻', '📧', '📩', '📤', '📥', '🔔', '🔕', '⚡', '🚀',
    ],
  },
  {
    key: 'people',
    icon: '🙋',
    emojis: [
      '🙋', '🙋‍♂️', '🙋‍♀️', '🤷', '🤷‍♂️', '🤷‍♀️', '🙆', '🙅', '💁', '🙇', '🤦', '🧑',
      '👨', '👩', '👶', '👴', '👵', '👮', '🕵️', '👨‍💻', '👩‍💻', '👨‍🔧', '👩‍🔧', '🧑‍🌾',
      '👨‍🎓', '👩‍🎓', '🤵', '👰', '🎅', '🦸', '🦹', '🧙', '👻', '🤖', '👽', '🐱',
    ],
  },
  {
    key: 'objects',
    icon: '🌍',
    emojis: [
      '🌍', '🌎', '🌏', '🗺️', '🏠', '🏢', '🏥', '🏫', '🚗', '🚌', '✈️', '🚀',
      '⛵', '🚲', '🛵', '☀️', '🌙', '⛅', '🌧️', '❄️', '🌊', '🌴', '🌸', '🍀',
      '🍎', '🍕', '🍔', '☕', '🍵', '🍺', '🥂', '🎂', '⚽', '🏀', '🎮', '🎵',
    ],
  },
];

interface EmojiPickerProps {
  onPick: (emoji: string) => void;
  /** Hauteur du panneau — calée sur celle du clavier quand elle est connue. */
  height?: number;
}

export function EmojiPicker({ onPick, height = 260 }: EmojiPickerProps) {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const { width } = useWindowDimensions();
  const [active, setActive] = useState(0);

  // Grille fluide : on vise ~44 px par emoji, jamais moins de 6 colonnes.
  const columns = Math.max(6, Math.floor((width - Spacing.md * 2) / 46));
  const size = (width - Spacing.md * 2) / columns;

  return (
    <View style={[styles.wrap, { height }]}>
      <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
        {CATEGORIES[active].emojis.map((emoji, i) => (
          <TouchableOpacity
            key={`${emoji}-${i}`}
            style={[styles.cell, { width: size, height: size }]}
            onPress={() => onPick(emoji)}
            activeOpacity={0.6}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.tabs}>
        {CATEGORIES.map((cat, i) => (
          <TouchableOpacity
            key={cat.key}
            style={[
              styles.tab,
              i === active && { backgroundColor: withAlpha(colors.primary, 0.18) },
            ]}
            onPress={() => setActive(i)}
          >
            <Text style={styles.tabIcon}>{cat.icon}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    wrap: {
      backgroundColor: Colors.cardSolid,
      borderTopWidth: 1,
      borderTopColor: Colors.border,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.sm,
      paddingBottom: Spacing.sm,
    },
    cell: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    emoji: {
      fontSize: 26,
      lineHeight: 32,
    },
    tabs: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      alignItems: 'center',
      paddingVertical: Spacing.xs,
      paddingHorizontal: Spacing.sm,
      borderTopWidth: 1,
      borderTopColor: Colors.border,
    },
    tab: {
      paddingHorizontal: Spacing.md,
      paddingVertical: 6,
      borderRadius: BorderRadius.pill,
    },
    tabIcon: {
      fontSize: 19,
    },
  });
