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
import * as Clipboard from 'expo-clipboard';
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
import { CardOrderModal } from '../src/components/CardOrderModal';
import { VirtualCardVisual, type CardCopyField } from '../src/components/VirtualCardVisual';
import { CardBrandLogo } from '../src/components/CardBrandLogo';
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
  /** Carte affichée : l'écran n'en montre qu'une à la fois. */
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [orderOpen, setOrderOpen] = useState(false);
  const [showDead, setShowDead] = useState(false);
  const [showFees, setShowFees] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Record<number, CardTransaction[]>>({});
  const [secretsFor, setSecretsFor] = useState<VirtualCard | null>(null);
  /** Champ demandé en copie directe : le secret ne s'affiche jamais. */
  const [copyField, setCopyField] = useState<'pan' | 'cvv' | null>(null);
  const [copiedOn, setCopiedOn] = useState<{ id: number; field: CardCopyField } | null>(null);
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

  /** Carte commandée depuis le modal : elle devient la carte affichée. */
  const onOrdered = (card: VirtualCard) => {
    setData((prev) => (prev ? { ...prev, cards: [card, ...prev.cards] } : prev));
    setSelectedId(card.id);
    pollCard(card.id);
  };

  /** Refus pour dossier incomplet : on renvoie au KYC plutôt qu'un refus sec. */
  const onIneligible = (e: any) => {
    const missing = (e?.response?.data?.missing ?? []) as string[];
    showAlert(
      t('cards.kycUpdateTitle'),
      t('cards.kycUpdateMessage', { fields: missing.map((f) => t(`cards.field_${f}`, f)).join(', ') }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('cards.completeKyc'), onPress: () => router.push('/kyc?edit=1') },
      ],
    );
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

  /** Coche brève sur le champ copié, puis retour à l'icône. */
  const flagCopied = (id: number, field: CardCopyField) => {
    setCopiedOn({ id, field });
    setTimeout(() => setCopiedOn((c) => (c?.id === id && c.field === field ? null : c)), 1500);
  };

  /**
   * Copie depuis la carte. L'expiration n'est pas un secret : elle part
   * directement. Le numéro et le cryptogramme passent par la ré-authentification
   * serveur, mais ne s'affichent pas pour autant.
   */
  const copyFromCard = async (card: VirtualCard, field: CardCopyField) => {
    if (field === 'expiry') {
      const value = card.expiry_month
        ? `${card.expiry_month}/${String(card.expiry_year).slice(-2)}`
        : '';
      if (!value) return;
      await Clipboard.setStringAsync(value);
      flagCopied(card.id, 'expiry');
      return;
    }
    setCopyField(field);
    setSecretsFor(card);
  };

  /**
   * Sélecteur de carte : n'apparaît qu'à partir de deux cartes vivantes. Une
   * pastille par carte (réseau + 4 derniers chiffres) plutôt qu'un défilement
   * masqué — le nombre de cartes reste petit, et rien ne doit se deviner.
   */
  const renderPicker = (list: VirtualCard[], current: VirtualCard) => {
    if (list.length < 2) return null;
    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pickerRow}
      >
        {list.map((c) => {
          const on = c.id === current.id;
          return (
            <TouchableOpacity
              key={c.id}
              style={[styles.pickerChip, on && styles.pickerChipOn]}
              onPress={() => setSelectedId(c.id)}
              activeOpacity={0.8}
            >
              <View style={styles.pickerLogo}>
                <CardBrandLogo brand={c.brand} height={12} />
              </View>
              <Text style={[styles.pickerText, on && styles.pickerTextOn]}>
                {c.last4 ? `•• ${c.last4}` : t('cards.statusPending')}
              </Text>
              <View style={[styles.pickerDot, { backgroundColor: statusColor(c) }]} />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  /** Demandes non abouties : une ligne, un motif, aucune maquette de carte. */
  const renderDead = (list: VirtualCard[]) => (
    <View style={styles.deadBlock}>
      <TouchableOpacity style={styles.deadHead} onPress={() => setShowDead((v) => !v)} activeOpacity={0.7}>
        <Text style={styles.deadTitle}>{t('cards.pastRequests', { count: list.length })}</Text>
        <FontAwesome6 name={showDead ? 'chevron-up' : 'chevron-down'} size={12} color={Colors.textMuted} />
      </TouchableOpacity>

      {showDead && list.map((c) => (
        <View key={c.id} style={styles.deadRow}>
          <View style={styles.deadRowLeft}>
            <Text style={styles.deadRowTitle}>
              {c.brand} · {statusLabel(c)}
            </Text>
            {!!c.reason && <Text style={styles.deadRowReason}>{c.reason}</Text>}
          </View>
          <Text style={styles.deadRowDate}>
            {c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR') : ''}
          </Text>
        </View>
      ))}
    </View>
  );

  const renderCard = (card: VirtualCard) => {
    const open = openId === card.id;
    const rows = transactions[card.id] ?? [];

    return (
      <View key={card.id} style={styles.cardBlock}>
        <VirtualCardVisual
          card={card}
          holder={holderName}
          onCopy={(field) => copyFromCard(card, field)}
          copiedField={copiedOn?.id === card.id ? copiedOn.field : null}
        />

        {/* Gel et résiliation touchent la carte elle-même : ils restent contre
            elle, avant le solde et les opérations, plutôt que relégués en bas
            d'écran où ils semblaient se rapporter à toute la page. */}
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
            <TouchableOpacity style={styles.action} onPress={() => { setCopyField(null); setSecretsFor(card); }}>
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

  // Une page = UNE carte. Les demandes échouées ou résiliées ne sont pas des
  // cartes : elles n'ont ni solde ni action, et empilées elles noyaient la seule
  // carte utilisable. Elles descendent dans un repli, en une ligne chacune.
  const liveCards = cards.filter((c) => c.status !== 'failed' && c.status !== 'terminated');
  const deadCards = cards.filter((c) => c.status === 'failed' || c.status === 'terminated');

  const shownCard = liveCards.find((c) => c.id === selectedId) ?? liveCards[0] ?? null;

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

      {renderFeeGrid()}
    </View>
  );

  /**
   * Grille tarifaire, telle que servie par le back-office.
   *
   * Elle ne montre QUE les frais que le client rencontre en utilisant sa carte.
   * Les frais de conditions (conversion de devise, transaction refusée,
   * contestation) sont volontairement absents : ils vivent dans les CGU, et les
   * poser ici noierait les tarifs réellement utiles.
   */
  const renderFeeGrid = () => {
    const grid = pricing?.card;
    if (!grid) return null;

    const usd = (v: number) => (v > 0 ? `${v.toFixed(2)} USD` : t('cards.free'));
    const rate = grid.rate_usd_xof > 0 ? grid.rate_usd_xof : pricing?.rate;

    const rows: Array<[string, string]> = [
      [t('cards.rate'), rate ? `1 USD = ${fmtXof(rate)}` : '—'],
      [t('cards.issueFee'), usd(grid.issue_fee_usd)],
      [
        t('cards.feeFundLow', { threshold: grid.fund_threshold_usd }),
        `${grid.fund_percent_low} % (min ${grid.fund_fee_min_usd.toFixed(2)} USD)`,
      ],
      [t('cards.feeFundHigh', { threshold: grid.fund_threshold_usd }), `${grid.fund_percent_high} %`],
      [t('cards.feeWithdraw'), usd(grid.withdraw_fee_usd)],
      [t('cards.feePayment'), usd(grid.payment_fee_usd)],
      [t('cards.feeMonthly'), usd(grid.monthly_fee_usd)],
    ];

    return (
      <View style={styles.priceCard}>
        {rows.map(([label, value]) => (
          <View key={label} style={styles.priceRow}>
            <Text style={styles.priceLabel}>{label}</Text>
            <Text style={styles.priceValue}>{value}</Text>
          </View>
        ))}
      </View>
    );
  };

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
          {shownCard ? (
            <>
              {renderPicker(liveCards, shownCard)}
              {renderCard(shownCard)}
            </>
          ) : (
            renderIntro()
          )}

          {/* La grille est déjà dépliée sur l'écran d'accueil du produit ; une
              fois la carte en main, elle se consulte à la demande. */}
          {!!shownCard && !!pricing?.card && (
            <View style={styles.feesBlock}>
              <TouchableOpacity style={styles.feesHead} onPress={() => setShowFees((v) => !v)} activeOpacity={0.7}>
                <Text style={styles.feesTitle}>{t('cards.fees')}</Text>
                <FontAwesome6 name={showFees ? 'chevron-up' : 'chevron-down'} size={12} color={Colors.textMuted} />
              </TouchableOpacity>
              {showFees && renderFeeGrid()}
            </View>
          )}

          {deadCards.length > 0 && renderDead(deadCards)}

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
              title={liveCards.length > 0 ? t('cards.orderAnother') : t('cards.order')}
              onPress={() => setOrderOpen(true)}
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
      <CardSecretsModal
        visible={!!secretsFor}
        card={secretsFor}
        copyField={copyField}
        onCopied={(field) => { if (secretsFor) flagCopied(secretsFor.id, field); }}
        onClose={() => { setSecretsFor(null); setCopyField(null); }}
      />
      <CardOrderModal
        visible={orderOpen}
        pricing={pricing}
        onClose={() => setOrderOpen(false)}
        onOrdered={onOrdered}
        onIneligible={onIneligible}
      />
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
  pickerRow: { flexDirection: 'row', gap: Spacing.sm, paddingBottom: Spacing.md },
  pickerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 7,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  pickerChipOn: { borderColor: Colors.primary, backgroundColor: Colors.primary + '14' },
  // Le logotype Visa est blanc : il lui faut un fond sombre pour rester lisible
  // hors de la carte, en thème clair comme en thème sombre.
  pickerLogo: {
    backgroundColor: '#0b1f5c',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  pickerText: { fontSize: FontSize.sm, color: Colors.textMuted, fontFamily: Fonts.medium },
  pickerTextOn: { color: Colors.text },
  pickerDot: { width: 7, height: 7, borderRadius: 4 },
  feesBlock: {
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  feesHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  feesTitle: { fontSize: FontSize.sm, color: Colors.textMuted, fontFamily: Fonts.medium },
  deadBlock: {
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  deadHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  deadTitle: { fontSize: FontSize.sm, color: Colors.textMuted, fontFamily: Fonts.medium },
  deadRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  deadRowLeft: { flex: 1, gap: 2 },
  deadRowTitle: { fontSize: FontSize.sm, color: Colors.text, fontFamily: Fonts.medium },
  deadRowReason: { fontSize: FontSize.sm, color: Colors.textMuted },
  deadRowDate: { fontSize: FontSize.sm, color: Colors.textMuted },
  statusText: { fontSize: FontSize.sm, fontFamily: Fonts.medium },

  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  pendingText: { fontSize: FontSize.sm, color: Colors.textMuted },

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
