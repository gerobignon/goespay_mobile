import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useAuthStore } from '../../stores/authStore';
import { useCatalogStore, type CatalogOperator } from '../../stores/catalogStore';
import { useCryptoStore, isCryptoDirAllowed, type CryptoRate } from '../../stores/cryptoStore';
import { walletService, type SimulationParams } from '../../services/walletService';
import { useFormatXof } from '../../utils/format';

// ═══════════════════════════════════════════════════════════════════
//  Simulateur de taux — calculatrice « combien ça me coûte ».
//
//  Les chiffres viennent de POST /simulate : le serveur renvoie le TAUX et la
//  FORMULE de frais du corridor (pas un montant), donc la conversion se fait
//  dans les deux sens sans un aller-retour par frappe, avec exactement ce que
//  le devis d'envoi appliquera ensuite.
//
//  Le rail Chine (CNY) est absent : son prix vient d'une cotation Klasha
//  facturée à l'unité, qu'on ne peut pas approcher par un taux (cf.
//  TransferQuote::quoteCnyForXof côté backend).
// ═══════════════════════════════════════════════════════════════════

type Tab = 'send' | 'deposit' | 'crypto';
type SimRail = 'mobile_money' | 'bank_transfer' | 'checkout' | 'SWIFT' | 'SEPA';

/** Corridor simulable, dérivé du catalogue serveur. */
interface Corridor {
  key: string;
  label: string;
  currency: string;
  country: string;
  aggregator?: 'fincra' | 'klasha';
  rail?: SimRail;
}

const num = (v: unknown): number => {
  if (typeof v === 'number') return isFinite(v) ? v : 0;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/\s/g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }
  return 0;
};

/** Montant lisible : XOF sans décimale, devises et cryptos avec la précision utile. */
const fmt = (v: number, decimals: number): string =>
  v > 0 ? v.toLocaleString('fr-FR', { maximumFractionDigits: decimals }) : '';

const railOf = (op: CatalogOperator): SimRail | undefined => {
  const r = (op.rail || '').toLowerCase();
  if (r === 'mobile_money' || r === 'bank_transfer' || r === 'checkout') return r;
  if (op.rail === 'SWIFT' || op.rail === 'SEPA') return op.rail;
  return undefined;
};

const aggOf = (op: CatalogOperator): Corridor['aggregator'] =>
  op.klasha ? 'klasha' : op.fincra ? 'fincra' : undefined;

export function RateSimulator({ allowCrypto = false }: { allowCrypto?: boolean }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const fmtXof = useFormatXof();
  const user = useAuthStore((s) => s.user);
  const userCountry = ((user as any)?.country || '').toUpperCase();
  const operators = useCatalogStore((s) => s.operators);
  const countries = useCatalogStore((s) => s.countries);
  const cryptoRates = useCryptoStore((s) => s.rates);
  const fetchCryptoRates = useCryptoStore((s) => s.fetchRates);
  const fetchCryptoEstimate = useCryptoStore((s) => s.fetchEstimate);

  const [tab, setTab] = useState<Tab>('send');
  const [corridorKey, setCorridorKey] = useState<Record<Tab, string>>({ send: '', deposit: '', crypto: '' });
  const [cryptoSide, setCryptoSide] = useState<'buy' | 'sell'>('buy');
  const [params, setParams] = useState<SimulationParams | null>(null);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState('');
  // Champ en cours d'édition : l'autre est recalculé à chaque frappe.
  const [edit, setEdit] = useState<'src' | 'dst'>('src');
  const [srcText, setSrcText] = useState('');
  const [dstText, setDstText] = useState('');

  const nameOfCountry = (code: string) =>
    countries.find((c) => c.code === code)?.name || code;

  // ── Corridors proposés, dédupliqués (une entrée par pays × devise × rail) ──
  const corridors = useMemo<Record<'send' | 'deposit', Corridor[]>>(() => {
    const build = (keep: (op: CatalogOperator) => boolean): Corridor[] => {
      const out = new Map<string, Corridor>();
      operators.forEach((op) => {
        // Chine : prix coté à l'unité par le provider, non simulable par un taux.
        if (op.cnyService) return;
        if (!keep(op)) return;
        const currency = (op.currency || 'XOF').toUpperCase();
        const country = (op.country || '').toUpperCase();
        if (!country || country === 'INTL') return;
        const rail = railOf(op);
        const key = `${aggOf(op) || 'local'}|${rail || ''}|${currency}|${country}`;
        if (out.has(key)) return;
        const railLabel = rail === 'mobile_money'
          ? t('simulator.railMobileMoney')
          : rail === 'bank_transfer' || rail === 'SWIFT' || rail === 'SEPA'
            ? t('simulator.railBank')
            : '';
        out.set(key, {
          key,
          label: `${op.flag || ''} ${nameOfCountry(country)}${railLabel ? ` · ${railLabel}` : ''}`.trim(),
          currency,
          country,
          aggregator: aggOf(op),
          rail,
        });
      });
      return [...out.values()].sort((a, b) => a.label.localeCompare(b.label, 'fr'));
    };

    return {
      send: build((op) => op.withdraw),
      // Recharge : seuls les corridors avec conversion (le local est à parité).
      deposit: build((op) => op.payin && !['XOF', 'XAF'].includes((op.currency || 'XOF').toUpperCase())),
    };
  }, [operators, countries, t]);

  // Le simulateur suit le sens choisi : une crypto ouverte à l'achat seulement
  // ne doit pas être cotée à la vente.
  const cryptoAny = useMemo(
    () => cryptoRates.filter((r) => r.code && (isCryptoDirAllowed(r, 'buy') || isCryptoDirAllowed(r, 'sell'))),
    [cryptoRates]
  );
  const cryptoList = useMemo(
    () => cryptoAny.filter((r) => isCryptoDirAllowed(r, cryptoSide)),
    [cryptoAny, cryptoSide]
  );

  // Aucun actif dans le sens courant : on bascule sur l'autre plutôt que de
  // laisser un onglet Crypto vide (et le simulateur entier masqué).
  useEffect(() => {
    if (!cryptoAny.length || cryptoList.length) return;
    setCryptoSide((s) => (s === 'buy' ? 'sell' : 'buy'));
  }, [cryptoAny, cryptoList]);

  // Sélection par défaut dès que les listes arrivent.
  useEffect(() => {
    setCorridorKey((prev) => {
      const next = { ...prev };
      if (!next.send && corridors.send.length) next.send = corridors.send[0].key;
      if (!next.deposit && corridors.deposit.length) next.deposit = corridors.deposit[0].key;
      if (cryptoList.length && !cryptoList.some((r) => r.code === next.crypto)) next.crypto = cryptoList[0].code;
      return next;
    });
  }, [corridors, cryptoList]);

  useEffect(() => { if (allowCrypto) fetchCryptoRates(); }, [allowCrypto, fetchCryptoRates]);

  const corridor = tab === 'crypto'
    ? undefined
    : corridors[tab].find((c) => c.key === corridorKey[tab]);

  const crypto: CryptoRate | undefined = tab === 'crypto'
    ? cryptoList.find((r) => r.code === corridorKey.crypto)
    : undefined;

  // ── Paramètres serveur du corridor sélectionné (un appel par corridor) ──
  useEffect(() => {
    if (tab === 'crypto' || !corridor) { setParams(null); return; }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    walletService
      .simulate({
        mode: tab,
        currency: corridor.currency,
        aggregator: corridor.aggregator,
        rail: corridor.rail,
        country: corridor.country,
      })
      .then((p) => { if (!cancelled) { setParams(p); setLoading(false); } })
      .catch(() => { if (!cancelled) { setParams(null); setFailed(true); setLoading(false); } });
    return () => { cancelled = true; };
  }, [tab, corridor?.key]);

  // Seules les devises les plus utilisées arrivent avec un live_rate : les
  // autres sont chiffrées à la sélection.
  useEffect(() => {
    if (tab !== 'crypto' || !crypto?.code) return;
    fetchCryptoEstimate(crypto.code);
  }, [tab, crypto?.code]);

  // ── Taux crypto : buy_rate/sell_rate du pays (XOF par USD) × live_rate (USD par unité) ──
  const cryptoRate = useMemo(() => {
    if (!crypto) return null;
    const suffix = userCountry.toLowerCase();
    const pick = (base: 'buy_rate' | 'sell_rate') => {
      const perCountry = num((crypto as any)[`${base}_${suffix}`]);
      return perCountry > 0 ? perCountry : num((crypto as any)[base]);
    };
    const xofPerUsd = pick(cryptoSide === 'buy' ? 'buy_rate' : 'sell_rate');
    const usdPerUnit = num(crypto.live_rate) || (num(crypto.buy_rate) > 0 ? 1 : 0);
    if (xofPerUsd <= 0 || usdPerUnit <= 0) return null;
    return xofPerUsd * usdPerUnit;   // XOF pour 1 unité de crypto
  }, [crypto, cryptoSide, userCountry]);

  // ── Conversion ─────────────────────────────────────────────────────────
  // send    : src = total débité (XOF)           → dst = reçu par le bénéficiaire
  // deposit : src = payé en devise               → dst = crédité au compte (XOF)
  // crypto  : src = XOF (achat) / crypto (vente) → dst = l'inverse
  const rate = tab === 'crypto' ? (cryptoRate ?? 0) : num(params?.rate);
  const feeFixed = num(params?.fee_fixed);
  const feePercent = num(params?.fee_percent);
  const payinFee = num(params?.payin_fee_percent) / 100;

  const srcVal = num(srcText);
  const dstVal = num(dstText);

  /** Montants dérivés, toujours calculés depuis le champ édité. */
  const computed = useMemo(() => {
    if (rate <= 0) return null;

    if (tab === 'send') {
      // amountXof = ce qui part réellement à la conversion (hors frais).
      let amountXof: number;
      if (edit === 'src') {
        if (srcVal <= 0) return null;
        amountXof = (srcVal - feeFixed) / (1 + feePercent / 100);
        if (amountXof <= 0) return null;
      } else {
        if (dstVal <= 0) return null;
        amountXof = dstVal * rate;
      }
      const fee = feeFixed + amountXof * feePercent / 100;
      return { total: amountXof + fee, received: amountXof / rate, fee };
    }

    if (tab === 'deposit') {
      // Frais d'encaissement prélevés sur le montant envoyé (dans la devise
      // payée) → brut = net / (1 − taux).
      if (edit === 'src') {
        if (srcVal <= 0) return null;
        const net = srcVal * (1 - payinFee);
        return { total: srcVal, received: net * rate, fee: srcVal - net };
      }
      if (dstVal <= 0) return null;
      const net = dstVal / rate;
      const gross = payinFee > 0 ? net / (1 - payinFee) : net;
      return { total: gross, received: dstVal, fee: gross - net };
    }

    // Crypto : le taux d'achat/vente porte déjà la marge, pas de frais séparés.
    if (cryptoSide === 'buy') {
      if (edit === 'src') {
        if (srcVal <= 0) return null;
        return { total: srcVal, received: srcVal / rate, fee: 0 };
      }
      if (dstVal <= 0) return null;
      return { total: dstVal * rate, received: dstVal, fee: 0 };
    }
    if (edit === 'src') {
      if (srcVal <= 0) return null;
      return { total: srcVal, received: srcVal * rate, fee: 0 };
    }
    if (dstVal <= 0) return null;
    return { total: dstVal / rate, received: dstVal, fee: 0 };
  }, [tab, edit, srcVal, dstVal, rate, feeFixed, feePercent, payinFee, cryptoSide]);

  // Le champ non édité reflète le calcul.
  const srcDecimals = tab === 'deposit' ? 2 : tab === 'crypto' && cryptoSide === 'sell' ? 8 : 0;
  const dstDecimals = tab === 'send' ? 2 : tab === 'crypto' && cryptoSide === 'buy' ? 8 : 0;
  const srcShown = edit === 'src' ? srcText : (computed ? fmt(computed.total, srcDecimals) : '');
  const dstShown = edit === 'dst' ? dstText : (computed ? fmt(computed.received, dstDecimals) : '');

  const srcCode = tab === 'send' ? 'XOF'
    : tab === 'deposit' ? (corridor?.currency ?? '')
    : cryptoSide === 'buy' ? 'XOF' : (crypto?.code ?? '');
  const dstCode = tab === 'send' ? (corridor?.currency ?? '')
    : tab === 'deposit' ? 'XOF'
    : cryptoSide === 'buy' ? (crypto?.code ?? '') : 'XOF';

  // Hors limites : le montant XOF concerné est le débit (envoi) ou le crédit (recharge).
  const limitAmount = tab === 'send' ? (computed?.total ?? 0) : (computed?.received ?? 0);
  const min = num(params?.min_xof);
  const max = num(params?.max_xof);
  const limitError = tab === 'crypto' || !computed ? null
    : min > 0 && limitAmount < min ? t('simulator.min', { amount: fmtXof(min, { withCode: false }) })
    : max > 0 && limitAmount > max ? t('simulator.max', { amount: fmtXof(max, { withCode: false }) })
    : null;

  const onEdit = (which: 'src' | 'dst') => (v: string) => {
    const clean = v.replace(/[^0-9.,]/g, '');
    setEdit(which);
    if (which === 'src') setSrcText(clean); else setDstText(clean);
  };

  const reset = () => { setEdit('src'); setSrcText(''); setDstText(''); };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'send', label: t('simulator.tabSend') },
    { key: 'deposit', label: t('simulator.tabDeposit') },
    ...(allowCrypto && cryptoAny.length ? [{ key: 'crypto' as Tab, label: t('simulator.tabCrypto') }] : []),
  ];

  const options = tab === 'crypto'
    ? cryptoList.map((r) => ({ value: r.code, label: r.name ? `${r.code} · ${r.name}` : r.code }))
    : corridors[tab].map((c) => ({ value: c.key, label: `${c.label} · ${c.currency}` }));
  const selectedOption = options.find((o) => o.value === (tab === 'crypto' ? corridorKey.crypto : corridorKey[tab]));
  const filteredOptions = search.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(search.trim().toLowerCase()))
    : options;

  // L'onglet crypto reste affiché tant qu'un sens est ouvert : le masquer
  // emporterait toute la carte, y compris Envoi et Recharge.
  if (!options.length && !(tab === 'crypto' && cryptoAny.length)) return null;

  const rateLine = rate <= 0 ? null
    : tab === 'deposit' ? `1 ${srcCode} = ${fmt(rate, 2)} XOF`
    : tab === 'crypto' ? `1 ${crypto?.code ?? ''} = ${fmt(rate, 0)} XOF`
    : `1 ${dstCode} = ${fmt(rate, 2)} XOF`;

  const feeLine = !computed
    ? (tab === 'send'
        ? `${fmtXof(feeFixed, { withCode: false })} XOF${feePercent > 0 ? ` + ${feePercent} %` : ''}`
        : `${payinFee * 100} %`)
    : tab === 'deposit'
      ? `${computed.fee > 0 ? fmt(computed.fee, 2) : '0'} ${srcCode}`
      : `${fmtXof(computed.fee, { withCode: false })} XOF`;

  const amountField = (
    which: 'src' | 'dst',
    label: string,
    value: string,
    code: string,
  ) => (
    <View style={[styles.amountRow, edit === which && styles.amountRowActive]}>
      <View style={styles.amountLeft}>
        <Text style={styles.amountLabel} numberOfLines={1}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onEdit(which)}
          keyboardType="decimal-pad"
          style={styles.amountInput}
          placeholder="0"
          placeholderTextColor={Colors.textMuted}
          selectTextOnFocus
        />
      </View>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{code || '—'}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <FontAwesome6 name="calculator" size={12} color={Colors.secondary} />
        </View>
        <Text style={styles.title}>{t('simulator.title')}</Text>
      </View>

      <View style={styles.segment}>
        {tabs.map((tb) => (
          <TouchableOpacity
            key={tb.key}
            onPress={() => { setTab(tb.key); reset(); }}
            style={[styles.segmentItem, tab === tb.key && styles.segmentItemActive]}
            activeOpacity={0.85}
          >
            <Text style={[styles.segmentText, tab === tb.key && styles.segmentTextActive]} numberOfLines={1}>
              {tb.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'crypto' && (
        <View style={styles.sideRow}>
          {(['buy', 'sell'] as const).map((side) => (
            <TouchableOpacity
              key={side}
              onPress={() => { setCryptoSide(side); reset(); }}
              style={[styles.sideChip, cryptoSide === side && styles.sideChipActive]}
              activeOpacity={0.85}
            >
              <Text style={[styles.sideText, cryptoSide === side && styles.sideTextActive]}>
                {side === 'buy' ? t('simulator.cryptoBuy') : t('simulator.cryptoSell')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity
        style={styles.selector}
        onPress={() => { setSearch(''); setPickerOpen(true); }}
        activeOpacity={0.8}
      >
        <Text style={styles.selectorText} numberOfLines={1}>
          {selectedOption?.label ?? t('common.select')}
        </Text>
        <FontAwesome6 name="chevron-down" size={11} color={Colors.textMuted} />
      </TouchableOpacity>

      <View style={styles.amounts}>
        {amountField(
          'src',
          tab === 'crypto' && cryptoSide === 'sell' ? t('simulator.youGive') : t('simulator.youPay'),
          srcShown,
          srcCode,
        )}
        <View style={styles.divider} />
        {amountField(
          'dst',
          tab === 'deposit' ? t('simulator.credited') : t('simulator.received'),
          dstShown,
          dstCode,
        )}
        <View style={styles.swapWrap} pointerEvents="none">
          <View style={styles.swapBtn}>
            <FontAwesome6 name="arrow-down" size={10} color={Colors.white} />
          </View>
        </View>
      </View>

      <View style={styles.recap}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.secondary} />
        ) : failed || rate <= 0 ? (
          <Text style={styles.recapMuted}>{t('common.rateUnavailable')}</Text>
        ) : (
          <>
            {rateLine && !(tab === 'send' && dstCode === 'XOF') && (
              <View style={styles.recapRow}>
                <Text style={styles.recapLabel}>{t('simulator.rate')}</Text>
                <Text style={styles.recapValue}>{rateLine}</Text>
              </View>
            )}
            {tab !== 'crypto' && (
              <View style={styles.recapRow}>
                <Text style={styles.recapLabel}>{t('simulator.fees')}</Text>
                <Text style={styles.recapValue}>{feeLine}</Text>
              </View>
            )}
          </>
        )}
        {limitError && <Text style={styles.limit}>{limitError}</Text>}
      </View>

      {/* Sélecteur : liste recherchable (les corridors se comptent en dizaines) */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => setPickerOpen(false)}>
          <TouchableOpacity style={styles.sheet} activeOpacity={1}>
            <View style={styles.sheetHeader}>
              <FontAwesome6 name="magnifying-glass" size={12} color={Colors.textMuted} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
                placeholder={t('simulator.search')}
                placeholderTextColor={Colors.textMuted}
                autoFocus={Platform.OS === 'web'}
              />
              <TouchableOpacity onPress={() => setPickerOpen(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <FontAwesome6 name="xmark" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.sheetList} keyboardShouldPersistTaps="handled">
              {filteredOptions.map((o) => {
                const active = o.value === selectedOption?.value;
                return (
                  <TouchableOpacity
                    key={o.value}
                    style={[styles.option, active && styles.optionActive]}
                    onPress={() => {
                      setCorridorKey((p) => ({ ...p, [tab]: o.value }));
                      setPickerOpen(false);
                      reset();
                    }}
                  >
                    <Text style={[styles.optionText, active && styles.optionTextActive]} numberOfLines={1}>
                      {o.label}
                    </Text>
                    {active && <FontAwesome6 name="check" size={11} color={Colors.secondary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  headerIcon: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.secondary + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: FontSize.md, fontFamily: Fonts.bold, color: Colors.text },

  // Segmented control : piste unique, pastille active.
  segment: {
    flexDirection: 'row',
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.pill,
    padding: 3,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 4,
    borderRadius: BorderRadius.pill,
    alignItems: 'center',
  },
  segmentItemActive: { backgroundColor: Colors.secondary },
  segmentText: { fontSize: FontSize.sm, fontFamily: Fonts.semiBold, color: Colors.textMuted },
  segmentTextActive: { color: Colors.white },

  sideRow: { flexDirection: 'row', gap: Spacing.xs },
  sideChip: {
    paddingVertical: 5, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.pill,
    borderWidth: 1, borderColor: Colors.border,
  },
  sideChipActive: { backgroundColor: Colors.secondary + '1A', borderColor: Colors.secondary },
  sideText: { fontSize: FontSize.sm, fontFamily: Fonts.semiBold, color: Colors.textMuted },
  sideTextActive: { color: Colors.secondary },

  selector: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    paddingVertical: 10, paddingHorizontal: Spacing.md,
  },
  selectorText: { flex: 1, fontSize: FontSize.md, fontFamily: Fonts.semiBold, color: Colors.text },

  // Bloc de conversion : deux lignes soudées, filet + pastille de sens.
  amounts: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    overflow: 'visible',
  },
  amountRow: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 10, paddingHorizontal: Spacing.md,
    borderWidth: 1, borderColor: 'transparent',
    borderRadius: BorderRadius.lg,
  },
  amountRowActive: { borderColor: Colors.secondary + '55', backgroundColor: Colors.secondary + '0D' },
  amountLeft: { flex: 1 },
  amountLabel: { fontSize: FontSize.sm, fontFamily: Fonts.medium, color: Colors.textMuted },
  amountInput: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
    padding: 0,
    marginTop: 1,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null),
  },
  badge: {
    paddingVertical: 4, paddingHorizontal: 10,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.secondary + '1A',
  },
  badgeText: { fontSize: FontSize.sm, fontFamily: Fonts.bold, color: Colors.secondary },

  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: Spacing.md },
  swapWrap: {
    position: 'absolute', top: '50%', left: 0, right: 0,
    marginTop: -11,
    alignItems: 'center',
  },
  swapBtn: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: Colors.secondary,
    alignItems: 'center', justifyContent: 'center',
  },

  recap: { gap: 6, paddingTop: 2 },
  recapRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm },
  recapLabel: { fontSize: FontSize.sm, fontFamily: Fonts.medium, color: Colors.textMuted },
  recapValue: { fontSize: FontSize.sm, fontFamily: Fonts.semiBold, color: Colors.text },
  recapMuted: { fontSize: FontSize.sm, fontFamily: Fonts.medium, color: Colors.textMuted },
  limit: { fontSize: FontSize.sm, fontFamily: Fonts.semiBold, color: Colors.error },

  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center', justifyContent: 'center',
    padding: Spacing.lg,
  },
  sheet: {
    width: '100%', maxWidth: 420, maxHeight: '75%',
    backgroundColor: Colors.cardSolid,
    borderRadius: BorderRadius.xl,
    borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden',
  },
  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm,
    borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: FontSize.md, fontFamily: Fonts.medium, color: Colors.text,
    paddingVertical: 6,
    ...(Platform.OS === 'web' ? { outlineStyle: 'none' as any } : null),
  },
  sheetList: { maxHeight: 340 },
  option: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingVertical: 11,
  },
  optionActive: { backgroundColor: Colors.secondary + '14' },
  optionText: { flex: 1, fontSize: FontSize.md, fontFamily: Fonts.medium, color: Colors.text },
  optionTextActive: { fontFamily: Fonts.semiBold, color: Colors.secondary },
});
