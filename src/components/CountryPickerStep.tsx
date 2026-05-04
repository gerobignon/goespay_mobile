import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { ALL_COUNTRIES } from '../constants/countries';
import { Colors as DefaultColors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useResponsive } from '../hooks/useResponsive';
import { useTranslation } from 'react-i18next';

export interface CountryEntry {
  code: string;
  flag: string;
  name: string;
}

interface Props {
  operators: { id: string; country: string; flag: string; name: string }[];
  /** Si true, ajoute une "tuile" Carte bancaire à la fin */
  showCardTile?: boolean;
  cardLabel?: string;
  onSelectCountry: (code: string) => void;
  /** Appelé si l'utilisateur clique sur la tuile carte (showCardTile) */
  onSelectCard?: () => void;
  label?: string;
}

export function CountryPickerStep({ operators, showCardTile, cardLabel, onSelectCountry, onSelectCard, label }: Props) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const { isDesktop } = useResponsive();

  const countries: CountryEntry[] = useMemo(() => {
    const map = new Map<string, CountryEntry>();
    operators.forEach((op) => {
      if (op.id === 'card') return;
      if (!map.has(op.country)) {
        const c = ALL_COUNTRIES.find((x) => x.code === op.country);
        map.set(op.country, { code: op.country, flag: op.flag, name: c?.name ?? op.country });
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [operators]);

  const Tiles = (
    <>
      {countries.map((c) => (
        <TouchableOpacity key={c.code} style={styles.chip} onPress={() => onSelectCountry(c.code)}>
          <Text style={styles.flag}>{c.flag}</Text>
          <Text style={styles.chipText} numberOfLines={1}>{c.name}</Text>
        </TouchableOpacity>
      ))}
      {showCardTile && onSelectCard && (
        <TouchableOpacity key="__card" style={styles.chip} onPress={onSelectCard}>
          <FontAwesome6 name="credit-card" size={16} color={DefaultColors.text} />
          <Text style={styles.chipText} numberOfLines={1}>{cardLabel ?? t('depositModal.bankCard')}</Text>
        </TouchableOpacity>
      )}
    </>
  );

  return (
    <>
      <Text style={styles.label}>{label ?? t('depositModal.chooseCountry')}</Text>
      {isDesktop ? (
        <View style={styles.grid}>{Tiles}</View>
      ) : (
        <View style={styles.gridMobile}>{Tiles}</View>
      )}
    </>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  label: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    marginBottom: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  gridMobile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  flag: {
    fontSize: 18,
  },
  chipText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium ?? Fonts.regular,
    color: Colors.text,
  },
});
