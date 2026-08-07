import React from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { type ColorPalette, BorderRadius, FontSize, Fonts, Spacing } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useColors } from './ThemeProvider';

interface CryptoSearchFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/** Champ de recherche des devises crypto (affiché au-delà d'une douzaine). */
export function CryptoSearchField({ value, onChange }: CryptoSearchFieldProps) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const Colors = useColors();

  return (
    <View style={styles.wrap}>
      <FontAwesome6 name="magnifying-glass" size={13} color={Colors.textSecondary} />
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholder={t('cryptoModal.searchPlaceholder')}
        placeholderTextColor={Colors.textSecondary}
        autoCapitalize="characters"
        autoCorrect={false}
        returnKeyType="search"
      />
      {value.length > 0 && (
        <FontAwesome6
          name="circle-xmark"
          size={14}
          color={Colors.textSecondary}
          onPress={() => onChange('')}
          suppressHighlighting
        />
      )}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    wrap: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: Colors.inputBg,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.xs,
      marginBottom: Spacing.sm,
    },
    input: {
      flex: 1,
      color: Colors.text,
      fontSize: FontSize.sm,
      fontFamily: Fonts.regular,
      paddingVertical: Spacing.xs,
      // Supprime le contour bleu par défaut du champ sur web.
      outlineStyle: 'none' as any,
    },
  });
