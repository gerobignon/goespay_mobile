import React, { useEffect, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors } from '../../constants/theme';
import type { FlowDirection, PickerEntryProps, PickerPanelProps } from '../../addons/types';
import { useCryptoStore, isCryptoDirAllowed, type CryptoDir } from '../store';
import { useCryptoSearch } from '../useCryptoSearch';
import { CryptoLogo } from './CryptoLogo';
import { CryptoSearchField } from './CryptoSearchField';

/**
 * Past this many currencies, listing them one by one would drown the Mobile
 * Money operators: the « Cryptocurrencies » group entry comes back, and opens
 * the searchable list.
 */
const INLINE_MAX = 4;

/** Topping up with crypto is selling it, sending crypto out is buying it. */
const dirOf = (direction: FlowDirection): CryptoDir => (direction === 'in' ? 'sell' : 'buy');

/** Loads the rates when a picker shows (cached for a minute by the store). */
function useRates() {
  const rates = useCryptoStore((s) => s.rates);
  const fetchRates = useCryptoStore((s) => s.fetchRates);
  useEffect(() => { fetchRates(rates.length === 0); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return rates;
}

/**
 * Crypto entry of the top up / send pickers: one group entry, or the
 * currencies themselves when there are few of them (`inline`).
 */
export function PickerEntry({ direction, variant, inline = false, styles, onOpen, onPick }: PickerEntryProps) {
  const { t } = useTranslation();
  const dir = dirOf(direction);
  const rates = useRates();
  const { cryptos } = useCryptoSearch(rates, undefined, dir);
  const allowed = useMemo(() => rates.filter((r) => isCryptoDirAllowed(r, dir)), [rates, dir]);

  // Until the rates arrive the entry stays: hiding then showing it again would
  // make the list of payment means jump.
  if (rates.length > 0 && allowed.length === 0) return null;

  const logoSize = variant === 'row' ? 26 : 22;
  if (inline && allowed.length > 0 && allowed.length <= INLINE_MAX) {
    return (
      <>
        {cryptos.map((c) => (
          <TouchableOpacity key={`asset-${c.code}`} style={styles.item} onPress={() => onPick(c.code)}>
            <CryptoLogo rate={c} size={logoSize} fallbackBackground={Colors.inputBg} fallbackColor={Colors.text} />
            <Text style={styles.text} numberOfLines={1}>{c.name || c.code}</Text>
          </TouchableOpacity>
        ))}
      </>
    );
  }

  const label = t('depositModal.cryptoGroup');
  if (variant === 'card') {
    return (
      <TouchableOpacity style={styles.item} onPress={onOpen}>
        <View style={styles.iconWrap}>
          <FontAwesome6 name="bitcoin-sign" size={20} color={Colors.secondary} iconStyle="solid" />
        </View>
        <Text style={styles.text}>{label}</Text>
        <FontAwesome6 name="chevron-right" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    );
  }
  return (
    <TouchableOpacity style={styles.item} onPress={onOpen}>
      {variant === 'row' ? (
        <FontAwesome6 name="bitcoin-sign" size={20} color={Colors.text} style={{ width: 32, textAlign: 'center' }} />
      ) : (
        <FontAwesome6 name="bitcoin-sign" size={16} color={Colors.text} />
      )}
      <Text style={styles.text} numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Searchable list of the currencies open in this direction. */
export function PickerPanel({ direction, layout, styles, backLabel, onBack, onPick }: PickerPanelProps) {
  const { t } = useTranslation();
  const dir = dirOf(direction);
  const rates = useRates();
  const { query, setQuery, cryptos, showSearch, empty, none } = useCryptoSearch(rates, undefined, dir);
  const logoSize = layout === 'grid' ? 22 : 26;

  return (
    <>
      <Text style={styles.title}>{t('depositModal.cryptoGroup')}</Text>
      <TouchableOpacity onPress={onBack} style={styles.back}>
        <FontAwesome6 name="arrow-left" size={12} color={Colors.secondary} />
        <Text style={styles.backText}>{backLabel}</Text>
      </TouchableOpacity>
      {rates.length === 0 ? (
        <Text style={styles.hint}>{t('common.loading')}</Text>
      ) : none ? (
        <Text style={styles.hint}>{t(dir === 'sell' ? 'cryptoModal.noSellCrypto' : 'cryptoModal.noBuyCrypto')}</Text>
      ) : (
        <>
          {showSearch && <CryptoSearchField value={query} onChange={setQuery} />}
          {empty && <Text style={styles.hint}>{t('cryptoModal.noSearchResult')}</Text>}
          {cryptos.length > 0 && (
            <View style={styles.container}>
              {cryptos.map((c) => (
                <TouchableOpacity key={c.code} style={styles.item} onPress={() => onPick(c.code)}>
                  <CryptoLogo rate={c} size={logoSize} fallbackBackground={Colors.inputBg} fallbackColor={Colors.text} />
                  <Text style={styles.itemText} numberOfLines={1}>{c.name || c.code}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}
    </>
  );
}
