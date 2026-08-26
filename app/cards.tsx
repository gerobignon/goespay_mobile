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
  type CardSecrets,
} from '../src/services/cardService';
import { Button } from '../src/components/Button';
import { CustomAlert } from '../src/components/CustomAlert';
import { LocalAuthModal } from '../src/components/LocalAuthModal';
import { CardFundModal } from '../src/components/CardFundModal';
import { CardOrderModal } from '../src/components/CardOrderModal';
import { CardTerminateModal } from '../src/components/CardTerminateModal';
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
import { requireLocalLock } from '../src/utils/localAuth';

/**
 * Rythme et durée du suivi d'émission. Le serveur va lui-même chercher la carte
 * chez l'émetteur dès la première interrogation : elle aboutit le plus souvent
 * en quelques secondes, d'où une cadence serrée au début — c'est le moment où le
 * client regarde l'écran — puis relâchée pour les cas qui traînent.
 */
const POLL_FAST_INTERVAL = 2000;
const POLL_FAST_ATTEMPTS = 15;
const POLL_INTERVAL = 5000;
const POLL_MAX_ATTEMPTS = 60;
/** Les données réelles restent lisibles sur la carte ce nombre de secondes. */
const REVEAL_SECONDS = 60;

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
  /** Carte pour laquelle on demande la confirmation par le verrou de l'appareil. */
  const [authFor, setAuthFor] = useState<VirtualCard | null>(null);
  /** Ce que le verrou est en train d'autoriser : voir la carte, ou la fermer. */
  const [authAction, setAuthAction] = useState<'secrets' | 'terminate'>('secrets');
  /** Carte dont la fermeture définitive est en cours de confirmation. */
  const [terminateFor, setTerminateFor] = useState<VirtualCard | null>(null);
  /** Champ à copier dès que les secrets arrivent (copie déclenchée sur la carte). */
  const [copyAfterAuth, setCopyAfterAuth] = useState<'pan' | 'cvv' | null>(null);
  /** Données réelles affichées sur la carte, et pour combien de temps encore. */
  const [revealed, setRevealed] = useState<{ id: number; secrets: CardSecrets } | null>(null);
  const [revealLeft, setRevealLeft] = useState(REVEAL_SECONDS);
  const [copiedOn, setCopiedOn] = useState<{ id: number; field: CardCopyField } | null>(null);
  const [fundFor, setFundFor] = useState<{ card: VirtualCard; direction: 'fund' | 'withdraw' } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollAttempts = useRef(0);

  const load = useCallback(() => {
    cardService.list()
      .then((res) => { setData(res); setLoadError(null); })
      .catch((e) => setLoadError(getApiErrorMessage(e, t, t('cards.loadError'))))
      .finally(() => setLoading(false));
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const stopPolling = () => {
    if (pollTimer.current) {
      clearTimeout(pollTimer.current);
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

    // Chaîne de setTimeout plutôt qu'un setInterval : la cadence change en cours
    // de route, et une lecture lente ne doit pas déclencher la suivante par-dessus.
    const tick = async () => {
      pollAttempts.current += 1;
      let done = false;
      try {
        const card = await cardService.get(cardId);
        setData((prev) => prev
          ? { ...prev, cards: prev.cards.map((c) => (c.id === card.id ? card : c)) }
          : prev);
        done = !card.pending;
      } catch (_) {
        // Une lecture ratée n'interrompt pas le suivi.
      }

      if (done || pollAttempts.current >= POLL_MAX_ATTEMPTS) {
        stopPolling();
        return;
      }
      pollTimer.current = setTimeout(
        tick,
        pollAttempts.current < POLL_FAST_ATTEMPTS ? POLL_FAST_INTERVAL : POLL_INTERVAL,
      );
    };

    tick();
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        const pending = data?.cards.find((c) => c.pending);
        if (pending) pollCard(pending.id);
      } else {
        // Un numéro affiché ne doit pas survivre dans le sélecteur d'applications.
        setRevealed(null);
        setRevealLeft(REVEAL_SECONDS);
      }
    });
    return () => sub.remove();
  }, [data, pollCard]);

  // Les données réelles s'effacent d'elles-mêmes au bout d'une minute.
  useEffect(() => {
    if (!revealed) return;
    const id = setInterval(() => {
      setRevealLeft((left) => {
        if (left <= 1) {
          setRevealed(null);
          return REVEAL_SECONDS;
        }
        return left - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [revealed]);

  // Changement de carte affichée : ce qui était révélé ne l'est plus.
  useEffect(() => {
    setRevealed(null);
    setRevealLeft(REVEAL_SECONDS);
  }, [selectedId]);

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

  /**
   * Fermeture définitive : fenêtre dédiée (conséquences + case à cocher), puis
   * verrou de l'appareil. Une alerte à deux boutons ne suffisait pas — le mot
   * « Résilier » ne dit pas au client ce qu'il perd, et le bouton rouge se
   * tapait aussi vite que « Annuler ».
   */
  const terminate = (card: VirtualCard) => setTerminateFor(card);

  /** Case cochée : on ne ferme rien avant d'avoir la preuve du porteur. */
  const askTerminate = () => {
    const card = terminateFor;
    if (!card) return;
    if (!requireLocalLock(t, (route) => router.push(route as any))) return;
    setTerminateFor(null);
    setAuthAction('terminate');
    setAuthFor(card);
  };

  /** Verrou franchi : la carte est fermée chez l'émetteur. */
  const doTerminate = async (card: VirtualCard) => {
    setAuthFor(null);
    setAuthAction('secrets');
    setBusyId(card.id);
    try {
      applyCard(await cardService.terminate(card.id));
    } catch (e: any) {
      showAlert(t('common.error'), getApiErrorMessage(e, t, t('cards.actionError')));
    } finally {
      setBusyId(null);
    }
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

  /** Efface les données réelles de l'écran. */
  const hideSecrets = useCallback(() => {
    setRevealed(null);
    setRevealLeft(REVEAL_SECONDS);
  }, []);

  /**
   * Copie depuis la carte. L'expiration n'est pas un secret : elle part
   * directement. Le numéro et le cryptogramme se copient sans rien redemander
   * une fois la carte révélée ; sinon, le mot de passe est exigé — et la
   * révélation qui s'ensuit affiche TOUS les champs, pour que la copie du
   * suivant ne repasse pas par la case authentification.
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

    if (revealed?.id === card.id) {
      await Clipboard.setStringAsync(field === 'pan' ? revealed.secrets.pan : revealed.secrets.cvv);
      flagCopied(card.id, field);
      return;
    }

    askSecrets(card, field);
  };

  /**
   * Demande d'accès aux données réelles. Le verrou de l'appareil est la seule
   * preuve exigée — beaucoup de comptes n'ont pas de mot de passe, la connexion
   * se faisant par code reçu par mail.
   */
  const askSecrets = (card: VirtualCard, field: CardCopyField | null) => {
    if (!requireLocalLock(t, (route) => router.push(route as any))) return;
    setCopyAfterAuth(field === 'expiry' ? null : field);
    setAuthFor(card);
  };

  /** Verrou franchi : on va chercher les secrets, puis on les pose sur la carte. */
  const fetchSecrets = async (card: VirtualCard) => {
    setAuthFor(null);
    try {
      const secrets = await cardService.secrets(card.id);
      await onRevealed(card, secrets);
    } catch (e: any) {
      showAlert(t('common.error'), getApiErrorMessage(e, t, t('cards.revealError')));
    } finally {
      setCopyAfterAuth(null);
    }
  };

  /** Secrets obtenus : ils s'écrivent sur la carte, et la copie en cours aboutit. */
  const onRevealed = async (card: VirtualCard, secrets: CardSecrets) => {
    setRevealed({ id: card.id, secrets });
    setRevealLeft(REVEAL_SECONDS);
    if (copyAfterAuth) {
      await Clipboard.setStringAsync(copyAfterAuth === 'pan' ? secrets.pan : secrets.cvv);
      flagCopied(card.id, copyAfterAuth);
    }
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

      {showDead && list.map((c, i) => (
        <View key={c.id} style={[styles.deadRow, i > 0 && styles.deadRowSep]}>
          {/* L'icône dit d'un coup d'œil ce qu'il est advenu : demande refusée
              par l'émetteur, ou carte que le porteur a lui-même résiliée. */}
          <View style={[styles.deadIcon, { backgroundColor: statusColor(c) + '18' }]}>
            <FontAwesome6
              name={c.status === 'failed' ? 'circle-xmark' : 'ban'}
              size={14}
              color={statusColor(c)}
              iconStyle="solid"
            />
          </View>
          <View style={styles.deadRowLeft}>
            <View style={styles.deadRowHead}>
              <Text style={styles.deadRowTitle} numberOfLines={1}>{c.brand}</Text>
              <Text style={styles.deadRowDate}>
                {c.created_at ? new Date(c.created_at).toLocaleDateString('fr-FR') : ''}
              </Text>
            </View>
            <Text style={[styles.deadRowStatus, { color: statusColor(c) }]}>{statusLabel(c)}</Text>
            {!!c.reason && <Text style={styles.deadRowReason} numberOfLines={2}>{c.reason}</Text>}
          </View>
        </View>
      ))}
    </View>
  );

  const renderCard = (card: VirtualCard) => {
    const open = openId === card.id;
    const rows = transactions[card.id] ?? [];
    const secrets = revealed?.id === card.id ? revealed.secrets : null;

    return (
      <View key={card.id} style={styles.cardBlock}>
        <VirtualCardVisual
          card={card}
          holder={holderName}
          onCopy={(field) => copyFromCard(card, field)}
          copiedField={copiedOn?.id === card.id ? copiedOn.field : null}
          secrets={secrets}
        />

        {/* Le porteur voit combien de temps ses données restent lisibles. */}
        {!!secrets && (
          <Text style={styles.revealCountdown}>{t('cards.autoHide', { seconds: revealLeft })}</Text>
        )}

        {/* Le gel touche la carte elle-même : il reste contre elle, avant le
            solde et les opérations. La fermeture définitive, elle, n'est plus
            ici : réversible et irréversible côte à côte, même taille, invitaient
            à la confondre — elle descend en bas du bloc. */}
        {(card.status === 'active' || card.status === 'frozen') && (
          <View style={styles.secondaryRow}>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: Colors.pending + '66', backgroundColor: Colors.pending + '14' }]}
              onPress={() => toggleFreeze(card)}
              disabled={busyId === card.id}
              activeOpacity={0.8}
            >
              <FontAwesome6 name={card.status === 'frozen' ? 'lock-open' : 'lock'} size={13} color={Colors.pending} iconStyle="solid" />
              <Text style={[styles.secondaryText, { color: Colors.pending }]}>
                {card.status === 'frozen' ? t('cards.unfreeze') : t('cards.freeze')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Le solde de la carte est l'information principale de l'écran : il a
            sa propre surface, son montant en grand, et l'état de la carte à côté. */}
        <View style={styles.balanceCard}>
          <View style={styles.balanceIcon}>
            <FontAwesome6 name="credit-card" size={16} color={Colors.primary} iconStyle="solid" />
          </View>
          <View style={styles.balanceMain}>
            <Text style={styles.metaLabel}>{t('cards.balance')}</Text>
            <View style={styles.balanceValueRow}>
              <Text style={styles.metaBalance} numberOfLines={1} adjustsFontSizeToFit>
                {card.balance.toFixed(2)}
              </Text>
              <Text style={styles.balanceCurrency}>{card.currency}</Text>
            </View>
          </View>
          <View style={[styles.statusPill, { backgroundColor: statusColor(card) + '22' }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor(card) }]} />
            <Text style={[styles.statusText, { color: statusColor(card) }]}>{statusLabel(card)}</Text>
          </View>
        </View>

        {/* Rappel de la règle des refus, sous le solde : c'est en le regardant
            qu'on décide de payer ou de recharger d'abord. */}
        <View style={styles.warn}>
          <FontAwesome6 name="triangle-exclamation" size={12} color={Colors.warning} iconStyle="solid" />
          <Text style={styles.warnText}>{t('cards.declineWarningShort')}</Text>
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
              <View style={styles.actionIcon}><FontAwesome6 name="plus" size={15} color={Colors.primary} iconStyle="solid" /></View>
              <Text style={styles.actionText}>{t('cards.topUp')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => setFundFor({ card, direction: 'withdraw' })}>
              <View style={styles.actionIcon}><FontAwesome6 name="arrow-down" size={15} color={Colors.primary} iconStyle="solid" /></View>
              <Text style={styles.actionText}>{t('cards.withdraw')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.action}
              onPress={() => {
                if (secrets) { hideSecrets(); return; }
                askSecrets(card, null);
              }}
            >
              <View style={styles.actionIcon}>
                <FontAwesome6 name={secrets ? 'eye-slash' : 'eye'} size={15} color={Colors.primary} iconStyle="solid" />
              </View>
              <Text style={styles.actionText}>{secrets ? t('cards.hide') : t('cards.reveal')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.action} onPress={() => toggleDetails(card)}>
              <View style={styles.actionIcon}>
                <FontAwesome6 name={open ? 'chevron-up' : 'clock-rotate-left'} size={15} color={Colors.primary} iconStyle="solid" />
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
                      {/* Le backend vide le marchand des mouvements internes
                          (marque émetteur) : le type traduit prend le relais. */}
                      {tx.merchant || tx.description || t([`cards.txTypes.${tx.type}`, 'cards.txTypes.default'])}
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

        {/* Fermeture définitive : en bas, sans surface ni couleur d'alerte, et
            dite en toutes lettres — « Résilier » ne disait pas au client ce
            qu'il perdait. Tout l'avertissement vit dans la fenêtre qui suit. */}
        {(card.status === 'active' || card.status === 'frozen') && (
          <TouchableOpacity
            style={styles.terminateLink}
            onPress={() => terminate(card)}
            disabled={busyId === card.id}
            activeOpacity={0.7}
          >
            <Text style={styles.terminateLinkText}>{t('cards.terminateEntry')}</Text>
          </TouchableOpacity>
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

      {/* Trois tuiles plutôt que trois lignes : l'argument produit se lit d'un
          coup d'œil, et l'icône a la place d'exister.
          `iconStyle="solid"` est OBLIGATOIRE — seules les fontes Regular et
          Brands sont chargées, et un glyphe solide non résolu retombe sur
          l'emoji du système : c'est ce qui donnait 🌐💳🔒 sur le web. */}
      <View style={styles.perks}>
        {[
          { icon: 'globe', text: t('cards.perkOnline') },
          { icon: 'wallet', text: t('cards.perkTopUp') },
          { icon: 'lock', text: t('cards.perkFreeze') },
        ].map((p) => (
          <View key={p.icon} style={styles.perk}>
            <View style={styles.perkIcon}>
              <FontAwesome6 name={p.icon as any} size={15} color={Colors.primary} iconStyle="solid" />
            </View>
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
    // Le rachat du dollar se fait plus bas que la vente ; à zéro, le même taux
    // vaut dans les deux sens et la ligne de retrait n'apprend rien.
    const withdrawRate = grid.withdraw_rate_usd_xof > 0 ? grid.withdraw_rate_usd_xof : rate;

    const rows: Array<[string, string]> = [
      [t('cards.rateFund'), rate ? `1 USD = ${fmtXof(rate)}` : '—'],
      ...(withdrawRate && withdrawRate !== rate
        ? ([[t('cards.rateWithdraw'), `1 USD = ${fmtXof(withdrawRate)}`]] as Array<[string, string]>)
        : []),
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

    const free = t('cards.free');

    return (
      <View style={styles.priceCard}>
        <Text style={styles.priceTitle}>{t('cards.pricingTitle', 'Tarifs')}</Text>

        {rows.map(([label, value], i) => (
          <View key={label} style={[styles.priceRow, i > 0 && styles.priceRowSep]}>
            <Text style={styles.priceLabel} numberOfLines={2}>{label}</Text>
            {/* La gratuité est une bonne nouvelle : elle se lit comme telle,
                au lieu de se fondre dans la colonne des montants. */}
            {value === free ? (
              <View style={styles.freePill}>
                <Text style={styles.freePillText}>{free}</Text>
              </View>
            ) : (
              <Text style={styles.priceValue}>{value}</Text>
            )}
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
          <FontAwesome6 name="arrow-left" size={20} color={Colors.text} iconStyle="solid" />
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
              onPress={() => {
                if (!requireLocalLock(t, (route) => router.push(route as any), t('security.cardLockMessage'))) return;
                setOrderOpen(true);
              }}
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
      <LocalAuthModal
        visible={!!authFor}
        title={authAction === 'terminate' ? t('cards.terminateAuthTitle') : t('security.confirmCardTitle')}
        onSuccess={() => {
          if (!authFor) return;
          if (authAction === 'terminate') { doTerminate(authFor); return; }
          fetchSecrets(authFor);
        }}
        onClose={() => { setAuthFor(null); setCopyAfterAuth(null); setAuthAction('secrets'); }}
      />
      <CardTerminateModal
        visible={!!terminateFor}
        card={terminateFor}
        busy={busyId === terminateFor?.id}
        onClose={() => setTerminateFor(null)}
        onConfirm={askTerminate}
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
  /** Trois tuiles de largeur égale, sur une ligne. */
  perks: { flexDirection: 'row', gap: Spacing.sm },
  perk: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  perkIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '1F',
  },
  perkText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontFamily: Fonts.medium,
    textAlign: 'center',
    lineHeight: 17,
  },

  priceCard: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  priceTitle: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    paddingVertical: Spacing.sm,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  /** Filet entre deux lignes : sept lignes nues formaient un bloc illisible.
      `surfaceBorder` était trop pâle pour se voir sur la surface des cartes. */
  priceRowSep: { borderTopWidth: 1, borderTopColor: Colors.border },
  priceLabel: { flex: 1, fontSize: FontSize.md, color: Colors.textMuted },
  priceValue: { fontSize: FontSize.md, color: Colors.text, fontFamily: Fonts.semiBold },
  freePill: {
    backgroundColor: Colors.positive + '1F',
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: 3,
  },
  freePillText: { fontSize: FontSize.sm, fontFamily: Fonts.bold, color: Colors.positive },

  cardBlock: { marginBottom: Spacing.xl, gap: Spacing.md },
  revealCountdown: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  balanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  balanceIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '18',
  },
  balanceMain: { flex: 1, minWidth: 0 },
  balanceValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6 },
  balanceCurrency: { fontSize: FontSize.md, color: Colors.textMuted, fontFamily: Fonts.semiBold },
  metaLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  metaBalance: { fontSize: FontSize.xxl, color: Colors.text, fontFamily: Fonts.bold },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: BorderRadius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
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
    gap: Spacing.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  /** Filet entre deux demandes : trois blocs de texte se confondaient. */
  deadRowSep: { borderTopWidth: 1, borderTopColor: Colors.border },
  deadIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deadRowLeft: { flex: 1, gap: 2 },
  deadRowHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  deadRowTitle: { flex: 1, fontSize: FontSize.md, color: Colors.text, fontFamily: Fonts.semiBold },
  deadRowStatus: { fontSize: FontSize.sm, fontFamily: Fonts.medium },
  deadRowReason: { fontSize: FontSize.sm, color: Colors.textMuted, lineHeight: 18 },
  deadRowDate: { fontSize: FontSize.sm, color: Colors.textMuted },
  statusText: { fontSize: FontSize.sm, fontFamily: Fonts.medium },

  warn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.warning + '1a',
    borderWidth: 1,
    borderColor: Colors.warning + '55',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  warnText: { flex: 1, fontSize: FontSize.sm, lineHeight: 18, color: Colors.text },
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

  // Gel et résiliation sont des actions, pas des liens : chacune est un bouton
  // à part entière, teinté de sa couleur d'état et bordé sur ses quatre côtés.
  secondaryRow: { flexDirection: 'row', gap: Spacing.sm },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    minHeight: 42,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  secondaryText: { fontSize: FontSize.md, fontFamily: Fonts.semiBold },

  // Sortie de secours, pas une action courante : ni surface, ni bordure, ni
  // rouge vif — la gravité est dite par le mot, pas par la couleur.
  terminateLink: { alignSelf: 'center', paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  terminateLinkText: { fontSize: FontSize.sm, color: Colors.textMuted, fontFamily: Fonts.medium },

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
