import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ImageBackground,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { RefreshableScrollView } from '../../src/components/Refreshable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import {
  walletService,
  type VirtualAccount,
  type VirtualAccountsResponse,
  type VirtualAccountStatement,
} from '../../src/services/walletService';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../../src/constants/theme';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { showAlert } from '../../src/stores/alertStore';
import { CustomAlert } from '../../src/components/CustomAlert';
import { useTheme } from '../../src/components/ThemeProvider';
import { useTranslation } from 'react-i18next';
import { useResponsive } from '../../src/hooks/useResponsive';
import { useAuthStore } from '../../src/stores/authStore';
import { useWalletStore } from '../../src/stores/walletStore';
import { useFormatXof } from '../../src/utils/format';
import { getApiErrorMessage } from '../../src/utils/apiError';

const CURRENCY_FLAG: Record<string, string> = { NGN: '🇳🇬', GHS: '🇬🇭', TZS: '🇹🇿' };

/** Montant dans la devise du compte (jamais XOF) — séparateur d'espace fine. */
const fmtSrc = (amount: number, currency: string) =>
  `${amount.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${currency}`;

export default function VirtualAccountsScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const fetchBalance = useWalletStore((s) => s.fetchBalance);
  const fmtXof = useFormatXof();

  const [data, setData] = useState<VirtualAccountsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  // Devise dont le formulaire de création est ouvert (une seule à la fois).
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [bvn, setBvn] = useState('');
  const [busy, setBusy] = useState(false);
  // Relevés chargés à la demande, par id de compte.
  const [statements, setStatements] = useState<Record<number, VirtualAccountStatement>>({});
  const [openId, setOpenId] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // `silent` : rechargement sans écran de chargement (pull-to-refresh).
  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    return walletService.getVirtualAccounts()
      .then((res) => { setData(res); setLoadError(null); })
      .catch((e) => setLoadError(getApiErrorMessage(e, t, t('account.vaLoadError'))))
      .finally(() => setLoading(false));
  }, [t]);
  useEffect(() => { load(); }, [load]);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try { await load(true); } finally { setRefreshing(false); }
  }, [load]);

  const copy = (key: string, value: string) => {
    try {
      (navigator as any)?.clipboard?.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch (_) {}
  };

  const create = async (currency: string) => {
    setBusy(true);
    try {
      const account = await walletService.createVirtualAccount({ currency, bvn: bvn.trim() || undefined });
      setData((prev) => prev
        ? { ...prev, accounts: [...prev.accounts.filter((a) => a.currency !== currency), account] }
        : prev);
      setCreatingFor(null);
      setBvn('');
    } catch (e: any) {
      showAlert(t('common.error'), getApiErrorMessage(e, t, t('account.vaCreateError')));
    } finally {
      setBusy(false);
    }
  };

  const openStatement = async (account: VirtualAccount) => {
    if (openId === account.id) { setOpenId(null); return; }
    setOpenId(account.id);
    if (statements[account.id]) return;
    try {
      // `reconcile` interroge l'agrégateur et crédite les virements dont la
      // notification s'est perdue : le client voit son solde à jour en ouvrant
      // son relevé, sans attendre le passage horaire du rattrapage serveur.
      const st = await walletService.getVirtualAccountStatement(account.id, true);
      setStatements((prev) => ({ ...prev, [account.id]: st }));
      // Le rapprochement vient de créditer : le solde en cache est périmé.
      if (st.reconciled) {
        fetchBalance().catch(() => {});
      }
    } catch (_) {}
  };

  const accounts = data?.accounts ?? [];
  // Devises encore disponibles à l'ouverture (le serveur exclut déjà les
  // corridors fermés et celles déjà attribuées apparaissent plus haut).
  const openable = (data?.available ?? []).filter(
    (a) => !accounts.some((acc) => acc.currency === a.currency),
  );

  const renderAccount = (account: VirtualAccount) => {
    const st = statements[account.id];
    const open = openId === account.id;
    return (
      <View key={account.id} style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.flag}>{CURRENCY_FLAG[account.currency] ?? '🏦'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{account.bank_name || account.currency}</Text>
            <Text style={styles.cardSub} numberOfLines={1}>{account.account_name}</Text>
          </View>
          <View style={styles.badge}><Text style={styles.badgeText}>{account.currency}</Text></View>
        </View>

        {account.usable ? (
          <>
            <TouchableOpacity
              style={styles.numberRow}
              onPress={() => copy(`n-${account.id}`, account.account_number)}
              activeOpacity={0.7}
            >
              <Text style={styles.number} selectable>{account.account_number}</Text>
              {Platform.OS === 'web' && (
                <FontAwesome6
                  name={copied === `n-${account.id}` ? 'check' : 'copy'}
                  size={14}
                  color={Colors.primary}
                />
              )}
            </TouchableOpacity>

            <View style={styles.totals}>
              <View style={{ flex: 1 }}>
                <Text style={styles.totalLabel}>{t('account.vaTotalReceived')}</Text>
                <Text style={styles.totalValue}>
                  {st
                    ? (st.total_received !== null
                        ? fmtSrc(st.total_received, account.currency)
                        : fmtXof(st.total_xof))
                    : '—'}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.totalLabel}>{t('account.vaCreditedTotal')}</Text>
                <Text style={styles.totalValue}>{st ? fmtXof(st.total_xof) : '—'}</Text>
              </View>
            </View>

            {!!st && st.pending_count > 0 && (
              <View style={styles.pending}>
                <FontAwesome6 name="clock" size={12} color={Colors.warning} />
                <Text style={styles.pendingText}>
                  {t('account.vaPendingAmount', {
                    amount: fmtSrc(st.pending_amount, account.currency),
                    count: st.pending_count,
                  })}
                </Text>
              </View>
            )}

            <TouchableOpacity style={styles.toggle} onPress={() => openStatement(account)}>
              <Text style={styles.toggleText}>
                {open ? t('account.vaHideStatement') : t('account.vaShowStatement')}
              </Text>
              <FontAwesome6 name={open ? 'chevron-up' : 'chevron-down'} size={12} color={Colors.primary} />
            </TouchableOpacity>

            {open && (
              !st ? (
                <ActivityIndicator color={Colors.primary} style={{ marginVertical: Spacing.md }} />
              ) : st.entries.length === 0 ? (
                <Text style={styles.empty}>{t('account.vaNoEntries')}</Text>
              ) : (
                <View style={styles.entries}>
                  {st.entries.map((e) => (
                    <View key={e.id} style={styles.entry}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.entrySender} numberOfLines={1}>
                          {e.sender || t('account.vaUnknownSender')}
                        </Text>
                        <Text style={styles.entryDate}>
                          {e.date ? new Date(e.date).toLocaleDateString('fr-FR', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          }) : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={[styles.entryAmount, e.status !== 'success' && styles.entryPending]}>
                          {e.amount !== null ? `+ ${fmtSrc(e.amount, e.currency)}` : `+ ${fmtXof(e.credited_xof)}`}
                        </Text>
                        <Text style={styles.entryXof}>
                          {e.status === 'success' ? fmtXof(e.credited_xof) : t('account.vaPendingEntry')}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )
            )}
          </>
        ) : (
          <Text style={styles.empty}>
            {account.status === 'declined' ? t('depositModal.vaDeclined')
              : account.status === 'closed' ? t('account.vaClosed')
              : t('depositModal.vaPending')}
            {account.reason ? ` — ${account.reason}` : ''}
          </Text>
        )}
      </View>
    );
  };

  const renderOpenable = (offer: { currency: string; requires_bvn: boolean }) => {
    const open = creatingFor === offer.currency;
    return (
      <View key={offer.currency} style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.flag}>{CURRENCY_FLAG[offer.currency] ?? '🏦'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>{t('account.vaOpenTitle', { currency: offer.currency })}</Text>
          </View>
          {!open && (
            <TouchableOpacity
              style={styles.openBtn}
              onPress={() => {
                if (user?.validate !== 1) {
                  showAlert(t('depositModal.kycRequired3'), t('depositModal.kycRequired2'));
                  return;
                }
                setCreatingFor(offer.currency);
                setBvn('');
              }}
            >
              <Text style={styles.openBtnText}>{t('depositModal.vaCreate')}</Text>
            </TouchableOpacity>
          )}
        </View>

        {open && (
          <>
            {offer.requires_bvn && (
              <Input
                label={t('depositModal.vaBvnLabel')}
                placeholder="12345678901"
                value={bvn}
                onChangeText={(v) => setBvn(v.replace(/\D/g, '').slice(0, 11))}
                keyboardType="number-pad"
                containerStyle={{ alignSelf: 'stretch' }}
              />
            )}
            <View style={styles.actions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { setCreatingFor(null); setBvn(''); }}>
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <Button
                title={t('depositModal.vaCreate')}
                onPress={() => create(offer.currency)}
                loading={busy}
                disabled={offer.requires_bvn && bvn.length !== 11}
                style={{ flex: 1 }}
              />
            </View>
          </>
        )}
      </View>
    );
  };

  const content = (
    <>
      {!isDesktop && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('account.virtualAccounts')}</Text>
        </View>
      )}
      {isDesktop && <Text style={styles.title}>{t('account.virtualAccounts')}</Text>}

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xl }} />
      ) : (
        <>
          {accounts.map(renderAccount)}
          {openable.map(renderOpenable)}
          {accounts.length === 0 && openable.length === 0 && (
            <Text style={styles.empty}>{loadError ?? t('account.vaNone')}</Text>
          )}
          {!!loadError && accounts.length > 0 && <Text style={styles.empty}>{loadError}</Text>}
          <Text style={styles.hint}>{t('account.vaHint')}</Text>
        </>
      )}
    </>
  );

  if (isDesktop) {
    return (
      <View style={{ flex: 1 }}>
        <RefreshableScrollView contentContainerStyle={[styles.scroll, { paddingTop: 0 }]} keyboardShouldPersistTaps="handled"
            refreshing={refreshing}
            onRefresh={onRefresh}
          >
          {content}
        </RefreshableScrollView>
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
          <RefreshableScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled"
            refreshing={refreshing}
            onRefresh={onRefresh}
          >
            {content}
          </RefreshableScrollView>
        </SafeAreaView>
        <CustomAlert />
      </ImageBackground>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  background: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl, maxWidth: 760, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  title: { fontSize: FontSize.xl, fontFamily: Fonts.bold, color: Colors.text, marginBottom: Spacing.md },
  card: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  flag: { fontSize: 26 },
  cardTitle: { fontSize: FontSize.md, fontFamily: Fonts.semiBold, color: Colors.text },
  cardSub: { fontSize: FontSize.sm, color: Colors.textMuted, marginTop: 2 },
  badge: { backgroundColor: Colors.primary + '15', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: FontSize.xs, color: Colors.primary, fontFamily: Fonts.semiBold },
  numberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  number: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.text, letterSpacing: 1 },
  totals: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xs },
  totalLabel: { fontSize: FontSize.xs, color: Colors.textMuted },
  totalValue: { fontSize: FontSize.md, fontFamily: Fonts.semiBold, color: Colors.text, marginTop: 2 },
  pending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.warning + '1A',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
  },
  pendingText: { flex: 1, fontSize: FontSize.sm, color: Colors.text },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: Spacing.sm },
  toggleText: { fontSize: FontSize.sm, fontFamily: Fonts.semiBold, color: Colors.primary },
  entries: { gap: Spacing.xs },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
  },
  entrySender: { fontSize: FontSize.sm, fontFamily: Fonts.medium, color: Colors.text },
  entryDate: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  entryAmount: { fontSize: FontSize.sm, fontFamily: Fonts.semiBold, color: Colors.success },
  entryPending: { color: Colors.textMuted },
  entryXof: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  openBtn: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  openBtnText: { color: Colors.white, fontFamily: Fonts.semiBold, fontSize: FontSize.sm },
  actions: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  cancelBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: 'center', backgroundColor: Colors.border },
  cancelBtnText: { color: Colors.text, fontFamily: Fonts.semiBold },
  empty: { color: Colors.textMuted, textAlign: 'center', paddingVertical: Spacing.md },
  hint: { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: Spacing.xs },
});
