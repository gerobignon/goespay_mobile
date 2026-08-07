import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import {
  cardService,
  type VirtualCard,
  type CardsResponse,
  type CardTransaction,
} from '../src/services/cardService';
import { Button } from '../src/components/Button';
import { CustomAlert } from '../src/components/CustomAlert';
import { CardSecretsModal } from '../src/components/CardSecretsModal';
import { CardFundModal } from '../src/components/CardFundModal';
import { VirtualCardVisual } from '../src/components/VirtualCardVisual';
import { DesktopHeader } from '../src/components/DesktopHeader';
import { DesktopFooter } from '../src/components/DesktopFooter';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../src/constants/theme';
import { useThemedStyles } from '../src/hooks/useThemedStyles';
import { useTheme } from '../src/components/ThemeProvider';
import { useResponsive } from '../src/hooks/useResponsive';
import { useAuthStore } from '../src/stores/authStore';
import { showAlert } from '../src/stores/alertStore';
import { useFormatXof } from '../src/utils/format';
import { getApiErrorMessage } from '../src/utils/apiError';

/** Rythme et durée du suivi d'émission (l'émetteur crée la carte de son côté). */
const POLL_INTERVAL = 5000;
const POLL_MAX_ATTEMPTS = 60;

export default function CardsScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const fmtXof = useFormatXof();

  const [data, setData] = useState<CardsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Record<number, CardTransaction[]>>({});
  const [secretsFor, setSecretsFor] = useState<VirtualCard | null>(null);
  const [fundFor, setFundFor] = useState<{ card: VirtualCard; direction: 'fund' | 'withdraw' } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttempts = useRef(0);

  // Fonctionnalité interne : un accès direct à l'URL par un compte ordinaire
  // repart à l'accueil (le serveur répondrait 404 de toute façon).
  const isAdmin = user?.group === 'admin';
  useEffect(() => {
    if (user && !isAdmin) router.replace('/(tabs)');
  }, [user, isAdmin, router]);

  const load = useCallback(() => {
    cardService.list()
      .then((res) => { setData(res); setLoadError(null); })
      .catch((e) => setLoadError(getApiErrorMessage(e, t, t('cards.loadError'))))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { if (isAdmin) load(); }, [load, isAdmin]);

  const stopPolling = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    pollAttempts.current = 0;
  };

  /**
   * Suit une carte en cours d'émission. Passé le délai, on cesse d'interroger sans
   * rien perdre : le serveur termine la création et une notification arrivera.
   */
  const pollCard = useCallback((cardId: number) => {
    stopPolling();
    pollAttempts.current = 0;

    const tick = async () => {
      pollAttempts.current += 1;
      try {
        const card = await cardService.get(cardId);
        setData((prev) => prev
          ? { ...prev, cards: prev.cards.map((c) => (c.id === card.id ? card : c)) }
          : prev);
        if (!card.pending) stopPolling();
      } catch (_) {
        // Une lecture ratée n'interrompt pas le suivi.
      }
      if (pollAttempts.current >= POLL_MAX_ATTEMPTS) stopPolling();
    };

    tick();
    pollTimer.current = setInterval(tick, POLL_INTERVAL);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const pending = data?.cards.find((c) => c.pending);
        if (pending) pollCard(pending.id);
      }
    });
    return () => sub.remove();
  }, [data, pollCard]);

  useEffect(() => () => stopPolling(), []);

  const order = async () => {
    setOrdering(true);
    try {
      const card = await cardService.issue({});
      setData((prev) => (prev ? { ...prev, cards: [card, ...prev.cards] } : prev));
      pollCard(card.id);
    } catch (e: any) {
      const missing = e?.response?.data?.missing as string[] | undefined;
      if (missing?.length) {
        // Le dossier doit repasser en validation : on renvoie vers le KYC en
        // mode re-soumission plutôt que d'afficher un refus sec.
        showAlert(
          t('cards.kycUpdateTitle'),
          t('cards.kycUpdateMessage', { fields: missing.map((f) => t(`cards.field_${f}`, f)).join(', ') }),
          [
            { text: t('common.cancel'), style: 'cancel' },
            { text: t('cards.completeKyc'), onPress: () => router.push('/kyc?edit=1') },
          ],
        );
      } else {
        showAlert(t('common.error'), getApiErrorMessage(e, t, t('cards.issueError')));
      }
    } finally {
      setOrdering(false);
    }
  };

  const toggleDetails = async (card: VirtualCard) => {
    if (openId === card.id) { setOpenId(null); return; }
    setOpenId(card.id);
    if (transactions[card.id]) return;
    try {
      const rows = await cardService.transactions(card.id, { reconcile: true });
      setTransactions((prev) => ({ ...prev, [card.id]: rows }));
    } catch (_) {}
  };

  const applyCard = (card: VirtualCard) => {
    setData((prev) => prev
      ? { ...prev, cards: prev.cards.map((c) => (c.id === card.id ? card : c)) }
      : prev);
  };

  const toggleFreeze = async (card: VirtualCard) => {
    setBusyId(card.id);
    try {
      const updated = card.status === 'frozen'
        ? await cardService.unfreeze(card.id)
        : await cardService.freeze(card.id);
      applyCard(updated);
    } catch (e: any) {
      showAlert(t('common.error'), getApiErrorMessage(e, t, t('cards.actionError')));
    } finally {
      setBusyId(null);
    }
  };

  const terminate = (card: VirtualCard) => {
    showAlert(t('cards.terminateTitle'), t('cards.terminateMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('cards.terminate'),
        style: 'destructive',
        onPress: async () => {
          setBusyId(card.id);
          try {
            applyCard(await cardService.terminate(card.id));
          } catch (e: any) {
            showAlert(t('common.error'), getApiErrorMessage(e, t, t('cards.actionError')));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const statusLabel = (card: VirtualCard) => ({
    active: t('cards.statusActive'),
    frozen: t('cards.statusFrozen'),
    terminated: t('cards.statusTerminated'),
    failed: t('cards.statusFailed'),
  } as Record<string, string>)[card.status] ?? t('cards.statusPending');

  const statusColor = (card: VirtualCard) => {
    if (card.status === 'active') return Colors.success;
    if (card.status === 'frozen') return Colors.pending;
    if (card.status === 'terminated' || card.status === 'failed') return Colors.error;
    return Colors.textMuted;
  };

  const holderName = `${user?.name ?? ''} ${user?.surname ?? ''}`.trim();

  const renderCard = (card: VirtualCard) => {
    const open = openId === card.id;
    const rows = transactions[card.id] ?? [];

    return (
      <View key={card.id} style={styles.cardBlock}>
        <VirtualCardVisual card={card} holder={holderName} />

        <View style={styles.cardMeta}>
          <View>
            <Text style={styles.metaLabel}>{t('cards.balance')}</Text>
            <Text style={styles.metaBalance}>{card.balance.toFixed(2)} {card.currency}</Text>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusColor(card) + '22' }]}>
            <Text style={[styles.statusText, { color: statusColor(card) }]}>{statusLabel(card)}</Text>
          </View>
        </View>

        {card.pending && (
          <View style={styles.pendingRow}>
            <ActivityIndicator size="small" color={Colors.primary} />
            <Text style={styles.pendingText}>{t('cards.issuing')}</Text>
          </View>
        )}

        {card.status === 'failed' && !!card.reason && (
          <Text style={styles.failReason}>{card.reason}</Text>
        )}

        {card.usable && (
          <View style={styles.actions}>
            <TouchableOpacity style={styles.action} onPress={() => setFundFor({ card, direction: 'fund' })}>
              <View style={styles.actionIcon}><FontAwesome6 name="plus" size={15} color={Colors.primary} /></View>
              <Text style={styles.actionText}>{t('cards.topUp')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => setFundFor({ card, direction: 'withdraw' })}>
              <View style={styles.actionIcon}><FontAwesome6 name="arrow-down" size={15} color={Colors.primary} /></View>
              <Text style={styles.actionText}>{t('cards.withdraw')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => setSecretsFor(card)}>
              <View style={styles.actionIcon}><FontAwesome6 name="eye" size={15} color={Colors.primary} /></View>
              <Text style={styles.actionText}>{t('cards.reveal')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => toggleDetails(card)}>
              <View style={styles.actionIcon}>
                <FontAwesome6 name={open ? 'chevron-up' : 'clock-rotate-left'} size={15} color={Colors.primary} />
              </View>
              <Text style={styles.actionText}>{t('cards.history')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {(card.status === 'active' || card.status === 'frozen') && (
          <View style={styles.secondaryRow}>
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => toggleFreeze(card)}
              disabled={busyId === card.id}
            >
              <FontAwesome6 name={card.status === 'frozen' ? 'lock-open' : 'lock'} size={13} color={Colors.pending} />
              <Text style={[styles.secondaryText, { color: Colors.pending }]}>
                {card.status === 'frozen' ? t('cards.unfreeze') : t('cards.freeze')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => terminate(card)} disabled={busyId === card.id}>
              <FontAwesome6 name="trash" size={13} color={Colors.error} />
              <Text style={[styles.secondaryText, { color: Colors.error }]}>{t('cards.terminate')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {open && (
          <View style={styles.history}>
            {rows.length === 0 ? (
              <Text style={styles.emptySmall}>{t('cards.noTransactions')}</Text>
            ) : (
              rows.map((tx) => (
                <View key={tx.id} style={styles.txRow}>
                  <View style={styles.txLeft}>
                    <Text style={styles.txMerchant} numberOfLines={1}>
                      {tx.merchant || tx.description || tx.type}
                    </Text>
                    <Text style={styles.txDate}>
                      {tx.date ? new Date(tx.date).toLocaleDateString('fr-FR') : ''}
                    </Text>
                  </View>
                  <Text style={[styles.txAmount, { color: tx.credit ? Colors.positive : Colors.text }]}>
                    {tx.credit ? '+' : '−'}{tx.amount.toFixed(2)} {tx.currency}
                  </Text>
                </View>
              ))
            )}
          </View>
        )}
      </View>
    );
  };

  const eligibility = data?.eligibility;
  const cards = data?.cards ?? [];
  const pricing = data?.pricing;

  /** Écran d'accueil du produit : aperçu de la carte et conditions. */
  const renderIntro = () => (
    <View style={styles.intro}>
      <VirtualCardVisual holder={holderName} />

      <View style={styles.perks}>
        {[
          { icon: 'globe', text: t('cards.perkOnline') },
          { icon: 'wallet', text: t('cards.perkTopUp') },
          { icon: 'lock', text: t('cards.perkFreeze') },
        ].map((p) => (
          <View key={p.icon} style={styles.perk}>
            <FontAwesome6 name={p.icon as any} size={14} color={Colors.primary} />
            <Text style={styles.perkText}>{p.text}</Text>
          </View>
        ))}
      </View>

      {!!pricing && (
        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <Text style={styles.priceLabel}>{t('cards.issueFee')}</Text>
            <Text style={styles.priceValue}>
              {pricing.issue_fee > 0 ? fmtXof(pricing.issue_fee) : t('cards.free')}
            </Text>
          </View>
          {!!pricing.rate && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>{t('cards.rate')}</Text>
              <Text style={styles.priceValue}>1 USD = {fmtXof(pricing.rate)}</Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  /** Le KYC est validé mais l'émetteur exige des informations absentes du dossier. */
  const renderKycUpdate = () => (
    <View style={styles.gateCard}>
      <FontAwesome6 name="triangle-exclamation" size={22} color={Colors.warning} iconStyle="solid" />
      <Text style={styles.gateTitle}>{t('cards.kycUpdateTitle')}</Text>
      <Text style={styles.gateText}>
        {t('cards.kycUpdateMessage', {
          fields: (eligibility?.missing ?? []).map((f) => t(`cards.field_${f}`, f)).join(', '),
        })}
      </Text>
      <Button
        title={t('cards.completeKyc')}
        icon="id-card"
        onPress={() => router.push('/kyc?edit=1')}
        style={{ marginTop: Spacing.md }}
      />
    </View>
  );

  const content = (
    <>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}>
          <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('cards.title')}</Text>
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: Spacing.xxl }} />
      ) : (
        <>
          {cards.length > 0 ? cards.map(renderCard) : renderIntro()}

          {!!loadError && <Text style={styles.empty}>{loadError}</Text>}

          {eligibility?.reason === 'country' && (
            <View style={styles.gateCard}>
              <FontAwesome6 name="circle-info" size={22} color={Colors.textMuted} iconStyle="solid" />
              <Text style={styles.gateTitle}>{t('cards.countryUnavailable')}</Text>
            </View>
          )}

          {eligibility?.reason === 'kyc' && (
            <View style={styles.gateCard}>
              <FontAwesome6 name="id-card" size={22} color={Colors.warning} iconStyle="solid" />
              <Text style={styles.gateTitle}>{t('cards.kycRequired')}</Text>
              <Button
                title={t('cards.verifyIdentity')}
                icon="id-card"
                onPress={() => router.push('/kyc')}
                style={{ marginTop: Spacing.md }}
              />
            </View>
          )}

          {eligibility?.reason === 'profile' && renderKycUpdate()}

          {eligibility?.can_order && (
            <Button
              title={cards.length > 0 ? t('cards.orderAnother') : t('cards.order')}
              onPress={order}
              loading={ordering}
              disabled={ordering}
              icon="credit-card"
              style={{ marginTop: Spacing.md }}
            />
          )}
        </>
      )}
    </>
  );

  const modals = (
    <>
      <CardSecretsModal visible={!!secretsFor} card={secretsFor} onClose={() => setSecretsFor(null)} />
      <CardFundModal
        visible={!!fundFor}
        card={fundFor?.card ?? null}
        direction={fundFor?.direction ?? 'fund'}
        onClose={() => setFundFor(null)}
        onDone={(card) => { if (card) applyCard(card); }}
      />
      <CustomAlert />
    </>
  );

  if (isDesktop) {
    return (
      <View style={{ flex: 1 }}>
        <DesktopHeader />
        <ImageBackground
          source={isDark ? require('../assets/bg_page.jpg') : require('../assets/bg_page_light.jpg')}
          style={styles.background}
        >
          <ScrollView contentContainerStyle={styles.scrollDesktop} keyboardShouldPersistTaps="handled">
            {content}
          </ScrollView>
        </ImageBackground>
        <DesktopFooter />
        {modals}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={isDark ? require('../assets/bg_page.jpg') : require('../assets/bg_page_light.jpg')}
        style={styles.background}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {content}
          </ScrollView>
        </SafeAreaView>
        {modals}
      </ImageBackground>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  background: { flex: 1 },
  scroll: { padding: Spacing.lg, paddingBottom: Spacing.xxl, maxWidth: 620, width: '100%', alignSelf: 'center' },
  scrollDesktop: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
    maxWidth: 620,
    width: '100%',
    alignSelf: 'center',
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  title: { fontSize: FontSize.xl, fontFamily: Fonts.bold, color: Colors.text },

  intro: { gap: Spacing.lg },
  perks: { gap: Spacing.sm },
  perk: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  perkText: { fontSize: FontSize.md, color: Colors.text },

  priceCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  priceLabel: { fontSize: FontSize.md, color: Colors.textMuted },
  priceValue: { fontSize: FontSize.md, color: Colors.text, fontFamily: Fonts.semiBold },

  cardBlock: { marginBottom: Spacing.xl, gap: Spacing.md },
  cardMeta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  metaBalance: { fontSize: FontSize.lg, color: Colors.text, fontFamily: Fonts.bold },
  statusPill: { borderRadius: BorderRadius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  statusText: { fontSize: FontSize.sm, fontFamily: Fonts.medium },

  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  pendingText: { fontSize: FontSize.sm, color: Colors.textMuted },
  failReason: { fontSize: FontSize.sm, color: Colors.error },

  actions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingVertical: Spacing.md,
  },
  action: { alignItems: 'center', gap: 6, flex: 1 },
  actionIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primary + '18',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontSize: FontSize.sm, color: Colors.text, fontFamily: Fonts.medium },

  secondaryRow: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.xl },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4 },
  secondaryText: { fontSize: FontSize.sm, fontFamily: Fonts.medium },

  history: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  txRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.md },
  txLeft: { flex: 1 },
  txMerchant: { fontSize: FontSize.sm, color: Colors.text, fontFamily: Fonts.medium },
  txDate: { fontSize: FontSize.sm, color: Colors.textMuted },
  txAmount: { fontSize: FontSize.sm, fontFamily: Fonts.semiBold },

  gateCard: {
    alignItems: 'center',
    backgroundColor: Colors.warning + '15',
    borderWidth: 1,
    borderColor: Colors.warning + '55',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
  },
  gateTitle: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    marginTop: Spacing.sm,
    textAlign: 'center',
  },
  gateText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginTop: 4,
  },

  empty: { fontSize: FontSize.md, color: Colors.textMuted, textAlign: 'center', marginVertical: Spacing.lg },
  emptySmall: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
});
