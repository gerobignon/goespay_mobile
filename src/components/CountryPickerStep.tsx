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
  /** Tuile « Crypto-monnaies » */
  showCryptoTile?: boolean;
  cryptoLabel?: string;
  onSelectCrypto?: () => void;
  label?: string;
}

export function CountryPickerStep({ operators, showCardTile, cardLabel, onSelectCountry, onSelectCard, showCryptoTile, cryptoLabel, onSelectCrypto, label }: Props) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const { isDesktop } = useResponsive();

  const countries: CountryEntry[] = useMemo(() => {
    const map = new Map<string, CountryEntry>();
    const addCountry = (code: string) => {
      if (!code || code === 'INTL' || map.has(code)) return;
      const c = ALL_COUNTRIES.find((x) => x.code === code);
      // i18n : `countries.<ISO>` ; fallback sur le nom anglais de ALL_COUNTRIES.
      const fallback = c?.name ?? code;
      const translated = t(`countries.${code}`, { defaultValue: fallback });
      // Drapeau emoji dérivé du code ISO-2 (chaque lettre +127397 = regional indicator).
      const flag = /^[A-Z]{2}$/.test(code)
        ? String.fromCodePoint(...[...code].map(ch => 127397 + ch.charCodeAt(0)))
        : '';
      map.set(code, { code, flag, name: translated });
    };
    operators.forEach((op) => {
      if (op.id === 'card') return;
      // Si l'opérateur sert plusieurs pays (zone XOF/XAF), on les ajoute tous.
      const list = (op as any).countries as string[] | undefined;
      if (Array.isArray(list) && list.length > 0) {
        list.forEach(addCountry);
      } else {
        addCountry(op.country);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [operators, t]);

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
      {showCryptoTile && onSelectCrypto && (
        <TouchableOpacity key="__crypto" style={styles.chip} onPress={onSelectCrypto}>
          <FontAwesome6 name="bitcoin-sign" size={16} color={DefaultColors.text} />
          <Text style={styles.chipText} numberOfLines={1}>{cryptoLabel ?? 'Crypto'}</Text>
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
