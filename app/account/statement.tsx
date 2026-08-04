import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { walletService, type AccountStatement, type StatementRow } from '../../src/services/walletService';
import { downloadStatement } from '../../src/utils/statement';
import { Button } from '../../src/components/Button';
import { CustomAlert } from '../../src/components/CustomAlert';
import { showAlert } from '../../src/stores/alertStore';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../../src/constants/theme';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useTheme } from '../../src/components/ThemeProvider';
import { useResponsive } from '../../src/hooks/useResponsive';
import { formatXof } from '../../src/utils/format';
import { useTranslation } from 'react-i18next';

type PresetKey = '30d' | '3m' | 'month' | 'custom';

/** Date locale au format YYYY-MM-DD (jamais toISOString : décalage UTC). */
function toIso(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function fromIso(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Locale d'affichage des dates : celle choisie dans l'app, jamais figée. */
function dateLocale(lang: string): string {
  return lang?.startsWith('en') ? 'en-GB' : 'fr-FR';
}

function shortDate(iso: string, lang: string): string {
  return fromIso(iso).toLocaleDateString(dateLocale(lang), { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function rowDate(value: string, lang: string): string {
  const loc = dateLocale(lang);
  const d = new Date(value.replace(' ', 'T'));
  return d.toLocaleDateString(loc, { day: '2-digit', month: '2-digit', year: '2-digit' })
    + ' · ' + d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
}

/** Bornes d'une période prédéfinie. */
function presetRange(key: Exclude<PresetKey, 'custom'>): { from: string; to: string } {
  const today = new Date();
  if (key === 'month') {
    return { from: toIso(new Date(today.getFullYear(), today.getMonth(), 1)), to: toIso(today) };
  }
  const start = new Date(today);
  if (key === '30d') start.setDate(start.getDate() - 30);
  else start.setMonth(start.getMonth() - 3);
  return { from: toIso(start), to: toIso(today) };
}

export default function StatementScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { isDesktop } = useResponsive();
  const { t, i18n } = useTranslation();

  const [preset, setPreset] = useState<PresetKey>('30d');
  const [range, setRange] = useState(() => presetRange('30d'));
  const [picking, setPicking] = useState<'from' | 'to' | null>(null);
  const [statement, setStatement] = useState<AccountStatement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async (from: string, to: string) => {
    setLoading(true);
    setError(null);
    try {
      setStatement(await walletService.getStatement(from, to));
    } catch (e: any) {
      setStatement(null);
      setError(e?.response?.data?.error || t('statement.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(range.from, range.to); }, [range.from, range.to, load]);

  const selectPreset = (key: PresetKey) => {
    setPreset(key);
    if (key !== 'custom') setRange(presetRange(key));
  };

  const setBound = (which: 'from' | 'to', date: Date) => {
    const iso = toIso(date);
    setRange((prev) => {
      // Un choix incohérent (début après fin) cale l'autre borne sur la même date.
      if (which === 'from') return { from: iso, to: iso > prev.to ? iso : prev.to };
      return { from: iso < prev.from ? iso : prev.from, to: iso };
    });
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadStatement(range.from, range.to, t('statement.shareTitle'));
    } catch (e: any) {
      showAlert(t('common.error'), e?.response?.data?.error || t('statement.downloadError'));
    } finally {
      setDownloading(false);
    }
  };

  const PRESETS: { key: PresetKey; label: string }[] = useMemo(() => ([
    { key: '30d', label: t('statement.last30Days') },
    { key: '3m', label: t('statement.last3Months') },
    { key: 'month', label: t('statement.thisMonth') },
    { key: 'custom', label: t('statement.custom') },
  ]), [t]);

  const content = (
    <>
      {!isDesktop && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('statement.title')}</Text>
        </View>
      )}
      {isDesktop && <Text style={styles.title}>{t('statement.title')}</Text>}

      <View style={styles.chips}>
        {PRESETS.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.chip, preset === p.key && styles.chipActive]}
            onPress={() => selectPreset(p.key)}
          >
            <Text style={[styles.chipText, preset === p.key && styles.chipTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {preset === 'custom' && (
        <View style={styles.dateRow}>
          <DateField
            label={t('statement.from')}
            value={range.from}
            max={range.to}
            lang={i18n.language}
            onChange={(d) => setBound('from', d)}
            onOpen={() => setPicking('from')}
            styles={styles}
          />
          <DateField
            label={t('statement.to')}
            value={range.to}
            min={range.from}
            max={toIso(new Date())}
            lang={i18n.language}
            onChange={(d) => setBound('to', d)}
            onOpen={() => setPicking('to')}
            styles={styles}
          />
        </View>
      )}

      {Platform.OS !== 'web' && picking && (
        <DateTimePicker
          value={fromIso(picking === 'from' ? range.from : range.to)}
          mode="date"
          maximumDate={new Date()}
          onChange={(event, date) => {
            setPicking(null);
            if (event.type === 'set' && date) setBound(picking, date);
          }}
        />
      )}

      {loading ? (
        <View style={styles.loader}><ActivityIndicator color={Colors.primary} /></View>
      ) : error ? (
        <Text style={styles.emptyText}>{error}</Text>
      ) : statement ? (
        <>
          <View style={styles.card}>
            <Text style={styles.period}>{shortDate(statement.from, i18n.language)} → {shortDate(statement.to, i18n.language)}</Text>
            <SummaryLine label={t('statement.opening')} value={formatXof(statement.opening_balance)} styles={styles} />
            <SummaryLine
              label={t('statement.totalIn')}
              value={`+ ${formatXof(statement.totals.in)}`}
              color={Colors.success}
              styles={styles}
            />
            <SummaryLine
              label={t('statement.totalOut')}
              value={`- ${formatXof(statement.totals.out)}`}
              color={Colors.error}
              styles={styles}
            />
            {statement.totals.fees > 0 && (
              <SummaryLine label={t('statement.fees')} value={formatXof(statement.totals.fees)} styles={styles} />
            )}
            <SummaryLine
              label={t('statement.closing')}
              value={formatXof(statement.closing_balance)}
              strong
              styles={styles}
            />
          </View>

          <Button
            title={t('statement.download')}
            icon="file-arrow-down"
            onPress={handleDownload}
            loading={downloading}
            style={{ marginBottom: Spacing.lg }}
          />

          <View style={styles.card}>
            {statement.rows.length === 0 ? (
              <Text style={styles.emptyText}>{t('statement.empty')}</Text>
            ) : (
              statement.rows.map((row) => <Row key={`${row.type}-${row.id}`} row={row} lang={i18n.language} styles={styles} />)
            )}
          </View>
        </>
      ) : null}
    </>
  );

  if (isDesktop) {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: 0 }]}>{content}</ScrollView>
        <CustomAlert />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={isDark ? require('../../assets/bg_page.jpg') : require('../../assets/bg_page_light.jpg')}
        style={styles.background}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <ScrollView contentContainerStyle={styles.scroll}>{content}</ScrollView>
        </SafeAreaView>
        <CustomAlert />
      </ImageBackground>
    </View>
  );
}

function SummaryLine({ label, value, color, strong, styles }: {
  label: string;
  value: string;
  color?: string;
  strong?: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  return (
    <View style={styles.summaryLine}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, strong && styles.summaryValueStrong, !!color && { color }]}>{value}</Text>
    </View>
  );
}

function Row({ row, lang, styles }: { row: StatementRow; lang: string; styles: ReturnType<typeof createStyles> }) {
  const isIn = row.direction === 'in';
  return (
    <View style={styles.row}>
      <View style={[styles.rowIcon, isIn ? styles.rowIconIn : styles.rowIconOut]}>
        <FontAwesome6
          name={isIn ? 'arrow-down' : 'arrow-up'}
          size={13}
          color={isIn ? Colors.success : Colors.error}
          iconStyle="solid"
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle} numberOfLines={1}>{row.label}</Text>
        <Text style={styles.rowSub} numberOfLines={1}>
          {rowDate(row.date, lang)}{row.mode ? ` · ${row.mode}` : ''}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[styles.rowAmount, { color: isIn ? Colors.success : Colors.error }]}>
          {isIn ? '+' : '-'} {formatXof(row.amount, { withCode: false })}
        </Text>
        <Text style={styles.rowBalance}>{formatXof(row.balance)}</Text>
      </View>
    </View>
  );
}

/**
 * Champ date : `<input type="date">` natif sur web (PWA), déclencheur du
 * DateTimePicker système sur mobile.
 */
function DateField({ label, value, min, max, lang, onChange, onOpen, styles }: {
  label: string;
  value: string;
  min?: string;
  max?: string;
  lang: string;
  onChange: (d: Date) => void;
  onOpen: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.dateField}>
        <Text style={styles.dateLabel}>{label}</Text>
        {React.createElement('input', {
          type: 'date',
          value,
          min,
          max,
          onChange: (e: any) => e.target.value && onChange(fromIso(e.target.value)),
          style: {
            border: 'none',
            background: 'transparent',
            color: Colors.text,
            fontFamily: Fonts.semiBold,
            fontSize: FontSize.md,
            outline: 'none',
            width: '100%',
          },
        })}
      </View>
    );
  }

  return (
    <TouchableOpacity style={styles.dateField} onPress={onOpen}>
      <Text style={styles.dateLabel}>{label}</Text>
      <Text style={styles.dateValue}>{shortDate(value, lang)}</Text>
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  background: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl, maxWidth: 760, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  title: { fontSize: FontSize.xl, fontFamily: Fonts.bold, color: Colors.text, marginBottom: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border },
  chipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { fontSize: FontSize.sm, color: Colors.text, fontFamily: Fonts.semiBold },
  chipTextActive: { color: Colors.white },
  dateRow: { flexDirection: 'row', gap: Spacing.md, marginBottom: Spacing.md },
  dateField: { flex: 1, backgroundColor: Colors.card, borderRadius: BorderRadius.md, padding: Spacing.md, borderWidth: 1, borderColor: Colors.border },
  dateLabel: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: 4 },
  dateValue: { fontSize: FontSize.md, color: Colors.text, fontFamily: Fonts.semiBold },
  card: { backgroundColor: Colors.card, borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.lg },
  period: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: Spacing.sm },
  summaryLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  summaryLabel: { fontSize: FontSize.md, color: Colors.textMuted },
  summaryValue: { fontSize: FontSize.md, color: Colors.text, fontFamily: Fonts.semiBold },
  summaryValueStrong: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.primary },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.border },
  rowIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  rowIconIn: { backgroundColor: Colors.success + '18' },
  rowIconOut: { backgroundColor: Colors.error + '18' },
  rowTitle: { fontSize: FontSize.md, fontFamily: Fonts.semiBold, color: Colors.text },
  rowSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  rowAmount: { fontSize: FontSize.md, fontFamily: Fonts.semiBold },
  rowBalance: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  loader: { paddingVertical: Spacing.xxl },
  emptyText: { color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.md },
});
