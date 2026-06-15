import React, { useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Share,
  Platform,
  Image,
  Dimensions,
  ImageSourcePropType,
  Linking,
  Modal,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useAuthStore } from '../../stores/authStore';
import { useWalletStore } from '../../stores/walletStore';
import { fetchFincraRate } from '../../stores/fincraRateStore';
import { showAlert } from '../../stores/alertStore';
import { useFormatXof } from '../../utils/format';
import { walletService, type SavedBank } from '../../services/walletService';
import { affiliationService } from '../../services/affiliationService';
import * as Clipboard from 'expo-clipboard';
import { Bounce } from '../anim';

// ═══════════════════════════════════════════════════════════════════
//  G — Carrousel promo : images 4:3, autoplay, tap → lien.
// ═══════════════════════════════════════════════════════════════════
export interface PromoSlide {
  id: string;
  /** Image (require ou {uri}). Ratio 4:3 recommandé. */
  image: ImageSourcePropType;
  /** URL externe à ouvrir au tap (ouvre en navigateur). */
  href?: string;
  /** Callback alternatif (action interne, ex. ouvrir un modal). */
  onPress?: () => void;
}

const PROMO_AUTOPLAY_MS = 5000;

const PROMO_PEEK = 0.85;       // largeur d'une slide ≈ 85% du container
const PROMO_GAP = Spacing.sm;  // espace entre slides (et amorce de la suivante)

export function PromoCarousel({ slides }: { slides: PromoSlide[] }) {
  const styles = useThemedStyles(createStyles);
  const [page, setPage] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const [containerWidth, setContainerWidth] = useState<number>(Dimensions.get('window').width - Spacing.lg * 2);

  // 1 slide → pleine largeur (pas de peek). Plusieurs → 85% + amorce suivante.
  const single = slides.length <= 1;
  const slideWidth = single ? containerWidth : Math.round(containerWidth * PROMO_PEEK);
  // Ratio 2:1 → hauteur = largeur / 2.
  const slideHeight = Math.round(slideWidth / 2);
  const snapInterval = slideWidth + PROMO_GAP;

  // Autoplay
  React.useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => {
      const next = (page + 1) % slides.length;
      scrollRef.current?.scrollTo({ x: next * snapInterval, animated: true });
      setPage(next);
    }, PROMO_AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [page, slides.length, snapInterval]);

  if (!slides.length) return null;

  const handleTap = (s: PromoSlide) => {
    if (s.onPress) s.onPress();
    else if (s.href) Linking.openURL(s.href).catch(() => {});
  };

  return (
    <View style={styles.promoWrap} onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={snapInterval}
        snapToAlignment="start"
        disableIntervalMomentum
        scrollEventThrottle={16}
        onScroll={(e) => {
          // Suit la position en continu → les dots défilent avec l'image.
          const p = Math.round(e.nativeEvent.contentOffset.x / snapInterval);
          setPage((prev) => (prev !== p ? p : prev));
        }}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / snapInterval))}
        scrollEnabled={!single}
        contentContainerStyle={{ paddingRight: single ? 0 : PROMO_GAP }}
      >
        {slides.map((s, i) => {
          // Lien vide (ni href ni onPress) → slide non cliquable (pas de feedback tactile).
          const tappable = !!(s.onPress || s.href);
          return (
            <Bounce
              key={s.id}
              disabled={!tappable}
              scaleTo={0.97}
              onPress={() => handleTap(s)}
              style={{
                width: slideWidth,
                height: slideHeight,
                marginRight: i === slides.length - 1 ? 0 : PROMO_GAP,
              }}
            >
              <Image source={s.image} style={styles.promoImage} resizeMode="cover" />
            </Bounce>
          );
        })}
      </ScrollView>
      {slides.length > 1 && (
        <View style={styles.promoDots}>
          {slides.map((_, i) => (
            <View key={i} style={[styles.promoDot, i === page && styles.promoDotActive]} />
          ))}
        </View>
      )}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  H — Insights mensuels (3 KPI dérivées des transactions en cache).
// ═══════════════════════════════════════════════════════════════════
export function MonthlyInsights() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const fmtXof = useFormatXof();
  const transactions = useWalletStore((s) => s.transactions);
  // Gains = commissions de parrainage cumulées (total affiliation).
  const [gains, setGains] = useState<number | null>(null);

  React.useEffect(() => {
    affiliationService.getStats()
      .then((s) => setGains(Number(s?.total) || 0))
      .catch(() => setGains(null));
  }, []);

  const insights = useMemo(() => {
    const now = new Date();
    const mStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const monthly = transactions.filter((tx) => {
      const ts = new Date((tx as any).created_at || (tx as any).date || 0).getTime();
      return ts >= mStart;
    });
    const sent = monthly
      .filter((tx) => tx.type === 'transfer' || tx.type === 'withdraw')
      .reduce((s, tx) => s + (Number((tx as any).amount) || 0), 0);
    const received = monthly
      .filter((tx) => tx.type === 'deposit')
      .reduce((s, tx) => s + (Number((tx as any).amount) || 0), 0);
    return { sent, received, count: monthly.length };
  }, [transactions]);

  if (insights.count === 0) return null;

  const cell = (icon: string, color: string, label: string, value: string) => (
    <View style={[styles.insightCell, { backgroundColor: color + '22', borderColor: color + '40' }]}>
      <View style={[styles.insightIconWrap, { backgroundColor: color + '33' }]}>
        <FontAwesome6 name={icon as any} size={12} color={'#FFFFFF'} />
      </View>
      <Text style={styles.insightLabel} numberOfLines={1}>{label}</Text>
      <Text style={styles.insightValue} numberOfLines={1}>{value}</Text>
    </View>
  );

  return (
    <View style={styles.insightsGrid}>
      {cell('arrow-down', '#10B981', t('home.insightsDeposit'), fmtXof(insights.received, { withCode: false }))}
      {cell('arrow-up', '#3176FE', t('home.insightsSent'), fmtXof(insights.sent, { withCode: false }))}
      {cell('sack-dollar', '#F4B228', t('home.insightsGains'), gains !== null ? fmtXof(gains, { withCode: false }) : '—')}
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  A — Bénéficiaires fréquents (avatars compacts + tile « Ajouter »).
// ═══════════════════════════════════════════════════════════════════
const PALETTE = ['#3176FE', '#F4900C', '#10B981', '#A855F7', '#EC4899', '#0EA5E9'];

export function RecentBeneficiaries({ onPick, onPickBank, onAdd, allowCrypto = false }: { onPick: (tel: string) => void; onPickBank: (bank: SavedBank) => void; onAdd: (type: 'phone' | 'bank' | 'crypto') => void; allowCrypto?: boolean }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const [phones, setPhones] = useState<{ id: number; tel: string; name?: string }[]>([]);
  const [banks, setBanks] = useState<SavedBank[]>([]);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const pick = (type: 'phone' | 'bank' | 'crypto') => { setAddMenuOpen(false); onAdd(type); };

  React.useEffect(() => {
    walletService.getSavedPhones({ type: 'transfer' })
      .then((list) => setPhones(list.slice(0, 8)))
      .catch(() => {});
    walletService.getSavedBanks()
      .then((list) => setBanks(list.slice(0, 8)))
      .catch(() => {});
  }, []);

  return (
    <View style={{ marginTop: Spacing.lg }}>
      <Text style={styles.sectionTitle}>{t('home.benefTitle')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.benefList}>
        <Bounce style={styles.benefTile} onPress={() => setAddMenuOpen(true)}>
          <View style={styles.benefAvatarAdd}>
            <FontAwesome6 name="plus" size={16} color={Colors.secondary} />
          </View>
          <Text style={styles.benefName} numberOfLines={1}>{t('home.benefAdd')}</Text>
        </Bounce>
        {phones.map((p, idx) => {
          const tint = PALETTE[idx % PALETTE.length];
          const initials = (p.name || p.tel).replace(/\s+/g, '').slice(0, 2).toUpperCase();
          return (
            <Bounce key={`p${p.id}`} style={styles.benefTile} onPress={() => onPick(p.tel)}>
              <View style={[styles.benefAvatar, { backgroundColor: tint }]}>
                <Text style={styles.benefInitials}>{initials}</Text>
              </View>
              <Text style={styles.benefName} numberOfLines={1}>{p.name || p.tel}</Text>
            </Bounce>
          );
        })}
        {banks.map((b) => {
          const label = b.name || b.account_holder || b.bank_name || '—';
          return (
            <Bounce key={`b${b.id}`} style={styles.benefTile} onPress={() => onPickBank(b)}>
              <View style={[styles.benefAvatar, { backgroundColor: '#475569' }]}>
                <FontAwesome6 name="building-columns" size={15} color="#fff" iconStyle="solid" />
              </View>
              <Text style={styles.benefName} numberOfLines={1}>{label}</Text>
            </Bounce>
          );
        })}
      </ScrollView>

      <Modal visible={addMenuOpen} transparent animationType="fade" onRequestClose={() => setAddMenuOpen(false)}>
        <TouchableOpacity style={styles.addMenuOverlay} activeOpacity={1} onPress={() => setAddMenuOpen(false)}>
          <View style={styles.addMenuSheet}>
            <TouchableOpacity style={styles.addMenuItem} onPress={() => pick('phone')}>
              <FontAwesome6 name="mobile-screen-button" size={16} color={Colors.secondary} iconStyle="solid" />
              <Text style={styles.addMenuItemText}>{t('home.benefAddPhone')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.addMenuItem} onPress={() => pick('bank')}>
              <FontAwesome6 name="building-columns" size={16} color={Colors.secondary} iconStyle="solid" />
              <Text style={styles.addMenuItemText}>{t('home.benefAddBank')}</Text>
            </TouchableOpacity>
            {allowCrypto && (
              <TouchableOpacity style={styles.addMenuItem} onPress={() => pick('crypto')}>
                <FontAwesome6 name="bitcoin-sign" size={16} color={Colors.secondary} iconStyle="solid" />
                <Text style={styles.addMenuItemText}>{t('home.benefAddCrypto')}</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  C — Convertisseur instantané (XOF → devise Fincra).
// ═══════════════════════════════════════════════════════════════════
const CONV_CURRENCIES = ['NGN', 'GHS', 'KES', 'USD', 'EUR', 'GBP'];

export function QuickConverter() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const fmtXof = useFormatXof();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('1000');
  const [targetCur, setTargetCur] = useState('NGN');
  const [rate, setRate] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    fetchFincraRate(targetCur)
      .then((r) => { if (!cancelled) { setRate(r); setLoading(false); } })
      .catch(() => { if (!cancelled) { setRate(null); setLoading(false); } });
    return () => { cancelled = true; };
  }, [targetCur, open]);

  const numAmount = parseFloat(amount.replace(',', '.')) || 0;
  // rate = XOF pour 1 unité de targetCur → XOF → cur : amount / rate
  const converted = rate && rate > 0 ? numAmount / rate : null;

  return (
    <>
      {/* Trigger compact (sur la home) */}
      <Bounce style={styles.convTrigger} scaleTo={0.98} onPress={() => setOpen(true)}>
        <View style={styles.convTriggerIcon}>
          <FontAwesome6 name="right-left" size={14} color={Colors.secondary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.convTriggerTitle}>{t('home.convertTitle')}</Text>
          <Text style={styles.convTriggerSub}>{t('home.convertSub')}</Text>
        </View>
        <FontAwesome6 name="chevron-right" size={12} color={Colors.textMuted} />
      </Bounce>

      {/* Modal centré */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.convOverlay}>
          <View style={styles.convSheet}>
            {/* Header */}
            <View style={styles.convSheetHeader}>
              <View style={styles.convHeaderRow}>
                <View style={styles.convHeaderIcon}>
                  <FontAwesome6 name="right-left" size={12} color={Colors.secondary} />
                </View>
                <Text style={styles.convTitle}>{t('home.convertTitle')}</Text>
              </View>
              <TouchableOpacity onPress={() => setOpen(false)} style={styles.convClose}>
                <FontAwesome6 name="xmark" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Devises cibles */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.convCurRow}>
              {CONV_CURRENCIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setTargetCur(c)}
                  style={[styles.convCurChip, c === targetCur && styles.convCurChipActive]}
                >
                  <Text style={[styles.convCurChipText, c === targetCur && styles.convCurChipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Source XOF */}
            <View style={styles.convField}>
              <Text style={styles.convCornerLabel}>XOF</Text>
              <TextInput
                value={amount}
                onChangeText={(t) => setAmount(t.replace(/[^0-9.,]/g, ''))}
                keyboardType="decimal-pad"
                style={styles.convInputBig}
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                autoFocus
              />
            </View>

            {/* Indicateur de flux */}
            <View style={styles.convArrowCenter}>
              <View style={styles.convArrowBg}>
                <FontAwesome6 name="arrow-down" size={12} color={Colors.secondary} />
              </View>
            </View>

            {/* Destination */}
            <View style={[styles.convField, styles.convFieldHighlight]}>
              <Text style={[styles.convCornerLabel, { color: Colors.secondary }]}>{targetCur}</Text>
              <Text style={styles.convResultBig} numberOfLines={1}>
                {loading ? '…' : converted !== null ? converted.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) : '—'}
              </Text>
            </View>

            {/* Taux */}
            <Text style={styles.convRate}>
              {rate && rate > 0
                ? `1 ${targetCur} ≈ ${fmtXof(rate, { withCode: false })} XOF`
                : (loading ? t('common.loading') : t('common.rateUnavailable'))}
            </Text>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  E — Parrainage (card gradient + code + share).
// ═══════════════════════════════════════════════════════════════════
const REFERRAL_BASE_URL = 'https://app.goespay.io/register';

export function ReferralCard() {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const user = useAuthStore((s) => s.user);
  const code = (user as any)?.referral_code || (user as any)?.referal_code;

  if (!code) return null;

  // Lien d'invitation contenant le code → l'inscription pré-remplit le filleul.
  const referralLink = `${REFERRAL_BASE_URL}?ref=${encodeURIComponent(code)}`;
  // Message partagé (i18n) : utilise le lien, le code reste mentionné pour info.
  const shareMessage = t('home.referralShareMsg', { code, link: referralLink });

  const share = async () => {
    try {
      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(shareMessage);
        showAlert(t('common.success'), t('home.referralCopied'));
      } else {
        await Share.share({ message: shareMessage, url: referralLink });
      }
    } catch {}
  };

  const copy = async () => {
    await Clipboard.setStringAsync(referralLink);
    showAlert(t('common.success'), t('home.referralLinkCopied'));
  };

  return (
    <LinearGradient
      colors={[Colors.secondary, '#1D3A8A', '#0F172A']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.refCard}
    >
      <View style={styles.refLeft}>
        <View style={styles.refIcon}>
          <FontAwesome6 name="gift" size={18} color={Colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.refTitle}>{t('home.referralTitle')}</Text>
          <Text style={styles.refDesc} numberOfLines={2}>{t('home.referralDesc')}</Text>
        </View>
      </View>
      <View style={styles.refBottom}>
        <TouchableOpacity onPress={copy} style={styles.refCodePill} activeOpacity={0.7}>
          <FontAwesome6 name="copy" size={11} color={Colors.white} />
          <Text style={styles.refCodeText}>{code}</Text>
        </TouchableOpacity>
        <Bounce onPress={share} style={styles.refShare}>
          <FontAwesome6 name="share-nodes" size={13} color={Colors.secondary} />
          <Text style={styles.refShareText}>{t('home.referralShare')}</Text>
        </Bounce>
      </View>
    </LinearGradient>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Styles
// ═══════════════════════════════════════════════════════════════════
const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  sectionTitle: {
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },

  // G — Promo (images 4:3)
  promoWrap: { marginTop: Spacing.lg },
  promoImage: { width: '100%', height: '100%', borderRadius: BorderRadius.xl },
  promoDots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: Spacing.sm },
  promoDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
  promoDotActive: { backgroundColor: Colors.secondary, width: 18 },

  // H — Insights (sur bg sombre du hero solde : chaque colonne a un fond
  // teinté distinct + bordure subtile pour bien se détacher).
  insightsGrid: {
    flexDirection: 'row',
    gap: 6,
    marginTop: Spacing.md,
    alignSelf: 'stretch',
    paddingHorizontal: Spacing.md,
  },
  insightCell: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: BorderRadius.lg,
    gap: 5,
    alignItems: 'flex-start',
    borderWidth: 1,
  },
  insightIconWrap: {
    width: 24, height: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  insightLabel: {
    fontSize: 12,
    fontFamily: Fonts.medium ?? Fonts.regular,
    color: 'rgba(255,255,255,0.78)',
  },
  insightValue: {
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },

  // A — Bénéficiaires
  benefList: { gap: Spacing.sm, paddingVertical: 2, paddingRight: Spacing.lg },
  benefTile: {
    width: 64,
    alignItems: 'center',
    gap: 6,
  },
  benefAvatar: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
  },
  benefAvatarAdd: {
    width: 48, height: 48, borderRadius: 24,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: Colors.secondary,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  benefInitials: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
    color: Colors.white,
    letterSpacing: 0.5,
  },
  benefName: {
    fontSize: 11,
    fontFamily: Fonts.medium ?? Fonts.regular,
    color: Colors.text,
    textAlign: 'center',
  },
  addMenuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  addMenuSheet: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.xs,
    width: '100%',
    maxWidth: 320,
    overflow: 'hidden',
  },
  addMenuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  addMenuItemText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold ?? Fonts.regular,
    color: Colors.text,
  },

  // C — Convertisseur : trigger compact sur la home + modal centré.
  convTrigger: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
    marginTop: Spacing.lg,
  },
  convTriggerIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.secondary + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  convTriggerTitle: { fontSize: FontSize.sm, fontFamily: Fonts.bold, color: Colors.text },
  convTriggerSub: { fontSize: 11, fontFamily: Fonts.regular, color: Colors.textMuted, marginTop: 1 },

  convOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center', justifyContent: 'center',
    padding: Spacing.lg,
  },
  convSheet: {
    width: '100%', maxWidth: 420,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  convSheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  convHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  convHeaderIcon: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.secondary + '22',
    alignItems: 'center', justifyContent: 'center',
  },
  convTitle: { fontSize: FontSize.md, fontFamily: Fonts.bold, color: Colors.text },
  convClose: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: Colors.inputBg,
    alignItems: 'center', justifyContent: 'center',
  },

  convCurRow: { flexDirection: 'row', gap: 6, paddingVertical: 4 },
  convCurChip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.inputBg,
  },
  convCurChipActive: { backgroundColor: Colors.secondary },
  convCurChipText: { fontSize: 11, fontFamily: Fonts.bold, color: Colors.text, letterSpacing: 0.3 },
  convCurChipTextActive: { color: Colors.white },

  convField: {
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
    gap: 4,
  },
  convFieldHighlight: {
    backgroundColor: Colors.secondary + '14',
    borderWidth: 1,
    borderColor: Colors.secondary + '33',
  },
  convCornerLabel: {
    fontSize: 10,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  convInputBig: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    color: Colors.text,
    padding: 0,
    margin: 0,
  },
  convResultBig: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    color: Colors.secondary,
  },
  convArrowCenter: { alignItems: 'center', marginVertical: -4 },
  convArrowBg: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.secondary + '20',
    alignItems: 'center', justifyContent: 'center',
  },
  convRate: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: 4,
  },

  // E — Parrainage
  refCard: {
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginTop: Spacing.lg,
    gap: Spacing.md,
    overflow: 'hidden',
  },
  refLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  refIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center', justifyContent: 'center',
  },
  refTitle: { fontSize: FontSize.md, fontFamily: Fonts.bold, color: Colors.white },
  refDesc: { fontSize: FontSize.xs, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  refBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
  refCodePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 11, paddingVertical: 6,
    borderRadius: BorderRadius.pill,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
  refCodeText: { fontSize: FontSize.sm, fontFamily: Fonts.bold, color: Colors.white, letterSpacing: 0.5 },
  refShare: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 9, paddingHorizontal: 16,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.white,
  },
  refShareText: { fontSize: FontSize.sm, fontFamily: Fonts.bold, color: Colors.secondary },
});
