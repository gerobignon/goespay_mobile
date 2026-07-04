import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { ALL_COUNTRIES } from '../constants/countries';
import { CONTINENTS, POPULAR_BY_CONTINENT, continentOf, type Continent } from '../constants/continents';
import { Colors as DefaultColors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useResponsive } from '../hooks/useResponsive';
import { useTheme } from './ThemeProvider';
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
  /**
   * Envoi : regroupe d'abord les pays par continent (écran continents →
   * recherche + populaires + liste A-Z). Off (dépôt) = grille de chips legacy.
   */
  groupByContinent?: boolean;
}

export function CountryPickerStep({
  operators, showCardTile, cardLabel, onSelectCountry, onSelectCard,
  showCryptoTile, cryptoLabel, onSelectCrypto, label, groupByContinent,
}: Props) {
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

  // ── Mode legacy (dépôt) : grille de chips plate ─────────────────────────────
  if (!groupByContinent) {
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
        <View style={isDesktop ? styles.grid : styles.gridMobile}>{Tiles}</View>
      </>
    );
  }

  // ── Mode continent (envoi) ──────────────────────────────────────────────────
  return (
    <ContinentPicker
      countries={countries}
      styles={styles}
      onSelectCountry={onSelectCountry}
      showCryptoTile={showCryptoTile}
      cryptoLabel={cryptoLabel}
      onSelectCrypto={onSelectCrypto}
      showCardTile={showCardTile}
      cardLabel={cardLabel}
      onSelectCard={onSelectCard}
    />
  );
}

interface ContinentPickerProps {
  countries: CountryEntry[];
  styles: ReturnType<typeof createStyles>;
  onSelectCountry: (code: string) => void;
  showCryptoTile?: boolean;
  cryptoLabel?: string;
  onSelectCrypto?: () => void;
  showCardTile?: boolean;
  cardLabel?: string;
  onSelectCard?: () => void;
}

function ContinentPicker({
  countries, styles, onSelectCountry,
  showCryptoTile, cryptoLabel, onSelectCrypto, showCardTile, cardLabel, onSelectCard,
}: ContinentPickerProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [continent, setContinent] = useState<Continent | null>(null);
  const [query, setQuery] = useState('');
  const [activeLetter, setActiveLetter] = useState<string | null>(null);

  // Pays disponibles regroupés par continent (dérivé du code ISO-2).
  const byContinent = useMemo(() => {
    const groups = {} as Record<Continent, CountryEntry[]>;
    countries.forEach((c) => {
      const cont = continentOf(c.code);
      (groups[cont] ??= []).push(c);
    });
    return groups;
  }, [countries]);

  // ── Écran 1 : choix du continent ────────────────────────────────────────────
  if (!continent) {
    const shown = CONTINENTS.filter((c) => (byContinent[c.key]?.length ?? 0) > 0);
    return (
      <>
        <Text style={styles.stepTitle}>{t('transferModal.chooseContinent')}</Text>
        {shown.map(({ key, icon, image }) => {
          const count = byContinent[key]?.length ?? 0;
          return (
            <TouchableOpacity
              key={key}
              style={styles.continentCard}
              onPress={() => { setContinent(key); setQuery(''); setActiveLetter(null); }}
            >
              <View style={styles.continentIconWrap}>
                {image ? (
                  <Image
                    source={image}
                    style={[styles.continentImg, { tintColor: colors.secondary }]}
                    resizeMode="contain"
                  />
                ) : (
                  <FontAwesome6 name={icon as any} size={22} color={colors.secondary} iconStyle="solid" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.continentName}>{t(`continents.${key}.name`)}</Text>
                <Text style={styles.continentDesc} numberOfLines={2}>
                  {t(`continents.${key}.desc`, { n: count })}
                </Text>
              </View>
              <FontAwesome6 name="chevron-right" size={16} color={colors.textMuted} />
            </TouchableOpacity>
          );
        })}

        {showCryptoTile && onSelectCrypto && (
          <TouchableOpacity style={styles.specialRow} onPress={onSelectCrypto}>
            <View style={styles.continentIconWrap}>
              <FontAwesome6 name="bitcoin-sign" size={20} color={colors.secondary} iconStyle="solid" />
            </View>
            <Text style={styles.specialRowText}>{cryptoLabel ?? 'Crypto'}</Text>
            <FontAwesome6 name="chevron-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
        {showCardTile && onSelectCard && (
          <TouchableOpacity style={styles.specialRow} onPress={onSelectCard}>
            <View style={styles.continentIconWrap}>
              <FontAwesome6 name="credit-card" size={18} color={colors.secondary} iconStyle="solid" />
            </View>
            <Text style={styles.specialRowText}>{cardLabel ?? t('depositModal.bankCard')}</Text>
            <FontAwesome6 name="chevron-right" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </>
    );
  }

  // ── Écran 2 : liste des pays du continent ───────────────────────────────────
  const list = byContinent[continent] ?? [];
  const q = query.trim().toLowerCase();
  const filtered = q
    ? list.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
    : (activeLetter ? list.filter((c) => firstLetter(c.name) === activeLetter) : list);

  // Populaires ∩ disponibles (max 6), masqués dès qu'une recherche/lettre filtre.
  const popularCodes = POPULAR_BY_CONTINENT[continent] ?? [];
  const popular = (!q && !activeLetter)
    ? popularCodes.map((code) => list.find((c) => c.code === code)).filter(Boolean).slice(0, 6) as CountryEntry[]
    : [];

  // Groupes alphabétiques (A, B, C…) sur la liste filtrée.
  const groups = groupByLetter(filtered);
  // Rail A-Z : lettres présentes dans la liste complète du continent. (Calcul
  // direct : pas de useMemo ici — on est après un return conditionnel.)
  const availableLetters = Array.from(new Set(list.map((c) => firstLetter(c.name)))).sort();

  return (
    <>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => { setContinent(null); setQuery(''); setActiveLetter(null); }}
      >
        <FontAwesome6 name="arrow-left" size={16} color={colors.secondary} />
        <Text style={styles.backText}>{t(`continents.${continent}.name`)}</Text>
      </TouchableOpacity>

      <View style={styles.searchWrap}>
        <FontAwesome6 name="magnifying-glass" size={14} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('transferModal.searchCountry')}
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={(v) => { setQuery(v); setActiveLetter(null); }}
          autoCorrect={false}
          returnKeyType="search"
        />
        {!!query && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <FontAwesome6 name="circle-xmark" size={16} color={colors.textMuted} iconStyle="solid" />
          </TouchableOpacity>
        )}
      </View>

      {popular.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>{t('transferModal.popularCountries')}</Text>
          <View style={styles.popularWrap}>
            {popular.map((c) => (
              <TouchableOpacity key={c.code} style={styles.popularChip} onPress={() => onSelectCountry(c.code)}>
                <Text style={styles.flag}>{c.flag}</Text>
                <Text style={styles.popularChipText} numberOfLines={1}>{c.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}

      <Text style={styles.sectionTitle}>{t('transferModal.allCountries', { n: list.length })}</Text>

      <View style={styles.listRow}>
        <View style={{ flex: 1 }}>
          {filtered.length === 0 ? (
            <Text style={styles.emptyText}>{t('transferModal.noCountryFound')}</Text>
          ) : (
            groups.map(({ letter, items }) => (
              <View key={letter}>
                <Text style={styles.letterHeader}>{letter}</Text>
                {items.map((c) => (
                  <TouchableOpacity key={c.code} style={styles.countryRow} onPress={() => onSelectCountry(c.code)}>
                    <View style={styles.countryFlagWrap}>
                      <Text style={styles.countryFlag}>{c.flag}</Text>
                    </View>
                    <Text style={styles.countryName} numberOfLines={1}>{c.name}</Text>
                    <FontAwesome6 name="chevron-right" size={14} color={colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            ))
          )}
        </View>

        {!q && availableLetters.length > 6 && (
          <View style={styles.azRail}>
            {availableLetters.map((L) => (
              <TouchableOpacity
                key={L}
                hitSlop={{ top: 2, bottom: 2, left: 6, right: 6 }}
                onPress={() => setActiveLetter((prev) => (prev === L ? null : L))}
              >
                <Text style={[styles.azLetter, activeLetter === L && styles.azLetterActive]}>{L}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </>
  );
}

// Première lettre d'affichage (A-Z), « # » pour les autres (chiffres, symboles).
function firstLetter(name: string): string {
  const ch = (name.trim()[0] || '').toUpperCase();
  return /[A-Z]/.test(ch) ? ch : '#';
}

function groupByLetter(items: CountryEntry[]): { letter: string; items: CountryEntry[] }[] {
  const map = new Map<string, CountryEntry[]>();
  items.forEach((c) => {
    const L = firstLetter(c.name);
    (map.get(L) ?? map.set(L, []).get(L)!).push(c);
  });
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([letter, list]) => ({ letter, items: list }));
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

  // ── Continent ──
  stepTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    marginBottom: Spacing.sm,
  },
  continentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.card ?? Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  continentIconWrap: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  continentImg: {
    width: 30,
    height: 30,
  },
  continentName: {
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  continentDesc: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginTop: 2,
  },
  specialRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.card ?? Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  specialRowText: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },

  // ── Liste pays ──
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  backText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Colors.text,
    padding: 0,
  },
  sectionTitle: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  popularWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  popularChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 9,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  popularChipText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium ?? Fonts.regular,
    color: Colors.text,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
  },
  letterHeader: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
    color: Colors.secondary,
    marginTop: Spacing.sm,
    marginBottom: 4,
  },
  countryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 6,
  },
  countryFlagWrap: {
    width: 34,
    height: 34,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.card ?? Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  countryFlag: {
    fontSize: 22,
  },
  countryName: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  emptyText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    paddingVertical: Spacing.lg,
    textAlign: 'center',
  },
  azRail: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    gap: 2,
  },
  azLetter: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.secondary,
    paddingHorizontal: 3,
  },
  azLetterActive: {
    color: Colors.text,
    fontFamily: Fonts.bold,
  },
});
