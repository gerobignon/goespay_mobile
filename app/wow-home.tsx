/**
 * ─────────────────────────────────────────────────────────────────────────
 *  PAGE VITRINE "WOW" — fictive, isolée, jetable.
 * ─────────────────────────────────────────────────────────────────────────
 *  But : prévisualiser le BOOST UI de la home (même structure que la vraie
 *  home) + les effets "waouh". 100% autonome :
 *    - données factices en dur (aucun store / API / i18n)
 *    - n'importe QUE le thème + ScreenBackground + expo-linear-gradient
 *    - aucune autre page n'est modifiée
 *
 *  Structure calquée sur app/(tabs)/index.tsx :
 *    Header (logo + greeting + avatar)
 *    → Carte solde (image bg + boutons + insights)
 *    → Carrousel promo
 *    → Bénéficiaires
 *    → Carte parrainage
 *    → Transactions récentes
 *
 *  Accès :  Web → /wow-home   ·   Mobile → router.push('/wow-home')
 *  Réversible : supprimer CE fichier suffit.
 *  (Strings en dur — page de test, pas d'UI livrée.)
 * ─────────────────────────────────────────────────────────────────────────
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  Pressable,
  Image,
  ImageBackground,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { useTheme } from '../src/components/ThemeProvider';
import {
  type ColorPalette,
  Spacing,
  FontSize,
  BorderRadius,
  Fonts,
  withAlpha,
} from '../src/constants/theme';
import { useThemedStyles } from '../src/hooks/useThemedStyles';

/* ───────────────────────────── Données factices ───────────────────────── */

const FAKE_BALANCE = 1284750;
const CURRENCY = 'XOF';

const FAKE_INSIGHTS = [
  { icon: 'arrow-down', label: 'Reçu', value: '845 200', color: '#10B981', pct: 0.8 },
  { icon: 'arrow-up', label: 'Envoyé', value: '312 400', color: '#3176FE', pct: 0.45 },
  { icon: 'sack-dollar', label: 'Gains', value: '18 600', color: '#F4B228', pct: 0.3 },
];

const FAKE_PROMOS = [
  { id: 1, title: 'Parraine & gagne', sub: 'Jusqu’à 2% sur chaque filleul', icon: 'gift', colors: ['#3176FE', '#1D3A8A'] },
  { id: 2, title: 'Crypto 0 frais', sub: 'Achète USDT ce week-end', icon: 'bitcoin-sign', colors: ['#F4B228', '#b45309'] },
];

const FAKE_BENEFS = [
  { name: 'Awa', color: '#3176FE' },
  { name: 'Koffi', color: '#F4900C' },
  { name: 'Mariam', color: '#10B981' },
  { name: 'Yao', color: '#A855F7' },
  { name: 'Fatou', color: '#EC4899' },
];

type TxStatus = 'success' | 'wait' | 'failed';
const FAKE_TX: {
  id: number; title: string; sub: string; amount: string;
  icon: string; status: TxStatus; positive: boolean;
}[] = [
  { id: 1, title: 'Dépôt Orange Money', sub: 'Aujourd’hui · 14:32', amount: '+150 000', icon: 'arrow-down', status: 'success', positive: true },
  { id: 2, title: 'Envoi à Mariam', sub: 'Aujourd’hui · 09:11', amount: '-45 000', icon: 'paper-plane', status: 'success', positive: false },
  { id: 3, title: 'Achat USDT', sub: 'Hier · 21:05', amount: '-200 000', icon: 'bitcoin-sign', status: 'wait', positive: false },
  { id: 4, title: 'Retrait Wave', sub: 'Hier · 17:48', amount: '-80 000', icon: 'arrow-up', status: 'failed', positive: false },
  { id: 5, title: 'Dépôt MTN MoMo', sub: '12 juin · 10:20', amount: '+320 000', icon: 'arrow-down', status: 'success', positive: true },
];

/* ─────────────────────────── Helpers d'animation ──────────────────────── */

function useStagger(count: number, replayKey: number) {
  const vals = useRef<Animated.Value[]>(
    Array.from({ length: count }, () => new Animated.Value(0))
  ).current;
  useEffect(() => {
    vals.forEach((v) => v.setValue(0));
    Animated.stagger(
      80,
      vals.map((v) => Animated.spring(v, { toValue: 1, useNativeDriver: true, friction: 7, tension: 60 }))
    ).start();
  }, [replayKey]);
  return vals;
}

function Reveal({ v, children, style }: { v: Animated.Value; children: React.ReactNode; style?: any }) {
  return (
    <Animated.View
      style={[
        style,
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [22, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function Bounce({
  children, onPress, style,
}: { children: React.ReactNode; onPress?: () => void; style?: any }) {
  const s = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(s, { toValue: 0.95, useNativeDriver: true, friction: 6 }).start()}
      onPressOut={() => Animated.spring(s, { toValue: 1, useNativeDriver: true, friction: 6 }).start()}
    >
      <Animated.View style={[style, { transform: [{ scale: s }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

function useCountUp(target: number, replayKey: number) {
  const anim = useRef(new Animated.Value(0)).current;
  const [val, setVal] = useState(0);
  useEffect(() => {
    anim.setValue(0);
    const id = anim.addListener(({ value }) => setVal(value));
    Animated.timing(anim, { toValue: target, duration: 1300, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [replayKey]);
  return Math.round(val).toLocaleString('fr-FR').replace(/,/g, ' ');
}

function Shimmer({ width, color }: { width: number; color: string }) {
  const x = useRef(new Animated.Value(-1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(x, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ).start();
  }, []);
  return (
    <Animated.View
      pointerEvents="none"
      style={{ ...StyleSheet.absoluteFillObject, transform: [{ translateX: x.interpolate({ inputRange: [-1, 1], outputRange: [-width, width] }) }] }}
    >
      <LinearGradient colors={['transparent', color, 'transparent']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ flex: 1 }} />
    </Animated.View>
  );
}

function Bar({ pct, color, replayKey }: { pct: number; color: string; replayKey: number }) {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    w.setValue(0);
    Animated.timing(w, { toValue: pct, duration: 1100, delay: 300, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [replayKey]);
  return (
    <Animated.View
      style={{ height: '100%', borderRadius: BorderRadius.pill, backgroundColor: color, width: w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }}
    />
  );
}

/* ──────────────────────────────── Écran ───────────────────────────────── */

export default function WowHomeScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { width } = useWindowDimensions();

  const [replayKey, setReplayKey] = useState(0);
  const [skeleton, setSkeleton] = useState(false);
  const [promoPage, setPromoPage] = useState(0);

  const reveals = useStagger(7, replayKey);
  const balance = useCountUp(FAKE_BALANCE, replayKey);

  const cardW = Math.min(width - Spacing.lg * 2, 560);
  const promoW = cardW;

  const statusColor = (s: TxStatus) => (s === 'success' ? colors.positive : s === 'wait' ? colors.pending : colors.error);
  const statusIcon = (s: TxStatus) => (s === 'success' ? 'circle-check' : s === 'wait' ? 'clock' : 'circle-xmark');
  const statusLabel = (s: TxStatus) => (s === 'success' ? 'Réussi' : s === 'wait' ? 'En attente' : 'Échoué');

  const replay = () => setReplayKey((k) => k + 1);

  return (
    <ScreenBackground edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ─── Header : logo + greeting + avatar (calqué sur la vraie home) ─── */}
        <Reveal v={reveals[0]}>
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Image source={require('../assets/picto.png')} style={styles.headerLogo} />
              <View>
                <Text style={styles.greeting}>Bonsoir, Gero</Text>
                <Text style={styles.subGreeting}>Content de vous revoir 👋</Text>
              </View>
            </View>
            <Bounce>
              <LinearGradient
                colors={[colors.secondary, colors.primary]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.avatarRing}
              >
                <View style={styles.avatarInner}>
                  <FontAwesome6 name="user-astronaut" size={16} color={colors.text} />
                </View>
              </LinearGradient>
            </Bounce>
          </View>
        </Reveal>

        {/* ─── Carte solde : image bg + scrim gradient + glow + count-up + insights ─── */}
        <Reveal v={reveals[1]}>
          <View style={[styles.balanceShadow, { shadowColor: colors.primary }]}>
            <ImageBackground
              source={require('../assets/bg_page.jpg')}
              style={styles.balanceCard}
              imageStyle={styles.balanceCardImg}
            >
              {/* Scrim gradient pour profondeur + identité de marque */}
              <LinearGradient
                colors={['rgba(15,23,42,0.35)', 'rgba(49,118,254,0.45)', 'rgba(15,23,42,0.8)']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.balanceHalo} />

              <View style={styles.balanceInner}>
                {/* Ligne label + chip période */}
                <View style={styles.balanceTopRow}>
                  <Text style={styles.balanceLabel}>SOLDE TOTAL</Text>
                  <View style={styles.periodChip}>
                    <View style={styles.liveDot} />
                    <Text style={styles.periodText}>Temps réel</Text>
                  </View>
                </View>

                {skeleton ? (
                  <View style={styles.skelBalance}><Shimmer width={cardW} color={withAlpha('#ffffff', 0.2)} /></View>
                ) : (
                  <View style={styles.balanceAmountRow}>
                    <Text style={styles.balanceAmount}>{balance}</Text>
                    <Text style={styles.balanceCurrency}>{CURRENCY}</Text>
                  </View>
                )}

                {/* Boutons d'action avec glow + bounce */}
                <View style={styles.actions}>
                  <Bounce style={{ flex: 1 }}>
                    <View style={[styles.actionBtn, styles.actionPrimary, { shadowColor: colors.secondary }]}>
                      <FontAwesome6 name="plus" size={15} color="#1a1a2e" />
                      <Text style={[styles.actionText, { color: '#1a1a2e' }]}>Recharger</Text>
                    </View>
                  </Bounce>
                  <Bounce style={{ flex: 1 }}>
                    <View style={[styles.actionBtn, styles.actionGhost]}>
                      <FontAwesome6 name="paper-plane" size={15} color="#fff" />
                      <Text style={styles.actionText}>Envoyer</Text>
                    </View>
                  </Bounce>
                </View>

                {/* Insights : cellules glass + mini-barres animées */}
                <View style={styles.insightsGrid}>
                  {FAKE_INSIGHTS.map((it) => (
                    <View key={it.label} style={[styles.insightCell, { borderColor: withAlpha(it.color, 0.4), backgroundColor: withAlpha(it.color, 0.16) }]}>
                      <View style={styles.insightHead}>
                        <View style={[styles.insightIcon, { backgroundColor: withAlpha(it.color, 0.35) }]}>
                          <FontAwesome6 name={it.icon as any} size={10} color="#fff" />
                        </View>
                        <Text style={styles.insightLabel}>{it.label}</Text>
                      </View>
                      <Text style={styles.insightValue} numberOfLines={1}>{it.value}</Text>
                      <View style={styles.insightBar}><Bar pct={it.pct} color="#fff" replayKey={replayKey} /></View>
                    </View>
                  ))}
                </View>
              </View>
            </ImageBackground>
          </View>
        </Reveal>

        {/* ─── Carrousel promo (gradient banners) ─── */}
        <Reveal v={reveals[2]}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            decelerationRate="fast"
            snapToInterval={promoW + Spacing.sm}
            snapToAlignment="start"
            onMomentumScrollEnd={(e) => setPromoPage(Math.round(e.nativeEvent.contentOffset.x / (promoW + Spacing.sm)))}
            style={{ marginTop: Spacing.lg }}
          >
            {FAKE_PROMOS.map((p, i) => (
              <Bounce key={p.id} style={{ width: promoW, marginRight: i === FAKE_PROMOS.length - 1 ? 0 : Spacing.sm }}>
                <LinearGradient colors={p.colors as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.promo}>
                  <View style={styles.promoHalo} />
                  <View style={styles.promoIcon}><FontAwesome6 name={p.icon as any} size={20} color="#fff" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.promoTitle}>{p.title}</Text>
                    <Text style={styles.promoSub}>{p.sub}</Text>
                  </View>
                  <FontAwesome6 name="arrow-right" size={14} color="rgba(255,255,255,0.9)" />
                </LinearGradient>
              </Bounce>
            ))}
          </ScrollView>
          <View style={styles.dots}>
            {FAKE_PROMOS.map((_, i) => (
              <View key={i} style={[styles.dot, i === promoPage && styles.dotActive]} />
            ))}
          </View>
        </Reveal>

        {/* ─── Bénéficiaires ─── */}
        <Reveal v={reveals[3]}>
          <Text style={styles.sectionTitle}>Bénéficiaires fréquents</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.benefRow}>
            <Bounce style={styles.benef}>
              <View style={[styles.benefAdd, { borderColor: colors.secondary }]}>
                <FontAwesome6 name="plus" size={16} color={colors.secondary} />
              </View>
              <Text style={styles.benefName}>Ajouter</Text>
            </Bounce>
            {FAKE_BENEFS.map((b) => (
              <Bounce key={b.name} style={styles.benef}>
                <LinearGradient colors={[withAlpha(b.color, 0.95), withAlpha(b.color, 0.45)]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.benefRing}>
                  <View style={[styles.benefInner, { backgroundColor: colors.cardSolid }]}>
                    <Text style={[styles.benefInitial, { color: b.color }]}>{b.name[0]}</Text>
                  </View>
                </LinearGradient>
                <Text style={styles.benefName} numberOfLines={1}>{b.name}</Text>
              </Bounce>
            ))}
          </ScrollView>
        </Reveal>

        {/* ─── Carte parrainage ─── */}
        <Reveal v={reveals[4]}>
          <LinearGradient colors={[colors.secondary, '#1D3A8A', '#0F172A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.refCard}>
            <View style={styles.refHalo} />
            <View style={styles.refLeft}>
              <View style={styles.refIcon}><FontAwesome6 name="gift" size={18} color="#fff" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.refTitle}>Parrainez vos proches</Text>
                <Text style={styles.refDesc} numberOfLines={2}>Gagnez une commission sur chaque filleul actif.</Text>
              </View>
            </View>
            <View style={styles.refBottom}>
              <View style={styles.refCodePill}>
                <FontAwesome6 name="copy" size={11} color="#fff" />
                <Text style={styles.refCodeText}>GERO-2026</Text>
              </View>
              <Bounce>
                <View style={styles.refShare}>
                  <FontAwesome6 name="share-nodes" size={13} color={colors.secondary} />
                  <Text style={[styles.refShareText, { color: colors.secondary }]}>Partager</Text>
                </View>
              </Bounce>
            </View>
          </LinearGradient>
        </Reveal>

        {/* ─── Transactions récentes ─── */}
        <Reveal v={reveals[5]} style={styles.recentHead}>
          <Text style={styles.sectionTitle}>Transactions récentes</Text>
          <Text style={[styles.seeAll, { color: colors.primary }]}>Tout voir</Text>
        </Reveal>

        {(skeleton ? Array.from({ length: 4 }) : FAKE_TX).map((tx: any, i) => (
          <Reveal key={skeleton ? `sk-${i}` : tx.id} v={reveals[6]}>
            <View style={styles.txCard}>
              {skeleton ? (
                <>
                  <View style={[styles.txIcon, { backgroundColor: withAlpha(colors.text, 0.08), overflow: 'hidden' }]}>
                    <Shimmer width={48} color={withAlpha(colors.text, 0.12)} />
                  </View>
                  <View style={{ flex: 1, gap: 7 }}>
                    <View style={[styles.skelSm, { width: '60%' }]}><Shimmer width={cardW} color={withAlpha(colors.text, 0.1)} /></View>
                    <View style={[styles.skelSm, { width: '35%' }]}><Shimmer width={cardW} color={withAlpha(colors.text, 0.1)} /></View>
                  </View>
                </>
              ) : (
                <>
                  <View style={[styles.txIcon, { backgroundColor: withAlpha(tx.positive ? colors.positive : colors.primary, 0.16) }]}>
                    <FontAwesome6 name={tx.icon} size={15} color={tx.positive ? colors.positive : colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.txTitle} numberOfLines={1}>{tx.title}</Text>
                    <View style={styles.txMetaRow}>
                      <View style={[styles.statusPill, { backgroundColor: withAlpha(statusColor(tx.status), 0.14) }]}>
                        <FontAwesome6 name={statusIcon(tx.status) as any} size={9} color={statusColor(tx.status)} />
                        <Text style={[styles.statusText, { color: statusColor(tx.status) }]}>{statusLabel(tx.status)}</Text>
                      </View>
                      <Text style={styles.txSub}>{tx.sub}</Text>
                    </View>
                  </View>
                  <Text style={[styles.txAmount, { color: tx.positive ? colors.positive : colors.text }]}>{tx.amount}</Text>
                </>
              )}
            </View>
          </Reveal>
        ))}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* ─── Contrôles de démo (flottants) ─── */}
      <View style={styles.fabRow}>
        <Bounce onPress={() => setSkeleton((s) => !s)}>
          <View style={[styles.fab, styles.fabGhost, { borderColor: colors.surfaceBorder }]}>
            <FontAwesome6 name={skeleton ? 'eye' : 'spinner'} size={14} color={colors.text} />
            <Text style={[styles.fabText, { color: colors.text }]}>{skeleton ? 'Contenu' : 'Skeleton'}</Text>
          </View>
        </Bounce>
        <Bounce onPress={replay}>
          <LinearGradient colors={[colors.secondary, colors.primary]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.fab, { shadowColor: colors.primary }]}>
            <FontAwesome6 name="wand-magic-sparkles" size={14} color="#fff" />
            <Text style={[styles.fabText, { color: '#fff' }]}>Rejouer</Text>
          </LinearGradient>
        </Bounce>
      </View>
    </ScreenBackground>
  );
}

/* ──────────────────────────────── Styles ──────────────────────────────── */

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    scroll: { padding: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.xxl },

    // Header
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.lg },
    headerLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    headerLogo: { width: 38, height: 38, resizeMode: 'contain' },
    greeting: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.text },
    subGreeting: { fontSize: FontSize.xs, fontFamily: Fonts.regular, color: Colors.textMuted, marginTop: 1 },
    avatarRing: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
    avatarInner: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.cardSolid },

    // Carte solde
    balanceShadow: {
      borderRadius: BorderRadius.xl,
      shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.5, shadowRadius: 24, elevation: 16,
    },
    balanceCard: { borderRadius: BorderRadius.xl, overflow: 'hidden' },
    balanceCardImg: { borderRadius: BorderRadius.xl },
    balanceHalo: { position: 'absolute', top: -60, right: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.1)' },
    balanceInner: { padding: Spacing.lg },
    balanceTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
    balanceLabel: { fontSize: FontSize.xs, fontFamily: Fonts.semiBold, color: 'rgba(255,255,255,0.75)', letterSpacing: 2 },
    periodChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.pill },
    liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#3ecf8e' },
    periodText: { fontSize: 10, fontFamily: Fonts.semiBold, color: '#fff' },
    balanceAmountRow: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.sm },
    balanceAmount: { fontSize: FontSize.hero, fontFamily: Fonts.bold, color: '#fff', lineHeight: FontSize.hero + 4 },
    balanceCurrency: { fontSize: FontSize.md, fontFamily: Fonts.semiBold, color: 'rgba(255,255,255,0.8)', marginBottom: 8, letterSpacing: 1 },

    actions: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.lg },
    actionBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingVertical: Spacing.sm + 4, borderRadius: BorderRadius.lg },
    actionPrimary: { backgroundColor: Colors.secondary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.5, shadowRadius: 12, elevation: 8 },
    actionGhost: { backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.35)' },
    actionText: { fontFamily: Fonts.bold, fontSize: FontSize.md, color: '#fff' },

    insightsGrid: { flexDirection: 'row', gap: 6, marginTop: Spacing.lg },
    insightCell: { flex: 1, borderRadius: BorderRadius.lg, borderWidth: 1, padding: 10, gap: 6 },
    insightHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    insightIcon: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    insightLabel: { fontSize: 11, fontFamily: Fonts.medium, color: 'rgba(255,255,255,0.8)' },
    insightValue: { fontSize: FontSize.md, fontFamily: Fonts.bold, color: '#fff' },
    insightBar: { height: 3, borderRadius: BorderRadius.pill, backgroundColor: 'rgba(255,255,255,0.2)', overflow: 'hidden' },

    // Promo
    promo: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, borderRadius: BorderRadius.xl, padding: Spacing.lg, overflow: 'hidden' },
    promoHalo: { position: 'absolute', top: -40, right: -20, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.12)' },
    promoIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    promoTitle: { fontSize: FontSize.md, fontFamily: Fonts.bold, color: '#fff' },
    promoSub: { fontSize: FontSize.xs, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, marginTop: Spacing.sm },
    dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.border },
    dotActive: { backgroundColor: Colors.secondary, width: 18 },

    sectionTitle: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.text, marginTop: Spacing.lg, marginBottom: Spacing.md },

    // Bénéficiaires
    benefRow: { gap: Spacing.md, paddingRight: Spacing.lg },
    benef: { alignItems: 'center', width: 64, gap: 6 },
    benefRing: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
    benefInner: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center' },
    benefInitial: { fontSize: FontSize.lg, fontFamily: Fonts.bold },
    benefAdd: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderStyle: 'dashed' },
    benefName: { fontSize: FontSize.xs, fontFamily: Fonts.medium, color: Colors.textMuted, maxWidth: 64 },

    // Parrainage
    refCard: { borderRadius: BorderRadius.xl, padding: Spacing.lg, marginTop: Spacing.lg, gap: Spacing.md, overflow: 'hidden' },
    refHalo: { position: 'absolute', bottom: -50, right: -30, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(255,255,255,0.1)' },
    refLeft: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    refIcon: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    refTitle: { fontSize: FontSize.md, fontFamily: Fonts.bold, color: '#fff' },
    refDesc: { fontSize: FontSize.xs, fontFamily: Fonts.regular, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    refBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
    refCodePill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 11, paddingVertical: 6, borderRadius: BorderRadius.pill, backgroundColor: 'rgba(0,0,0,0.2)' },
    refCodeText: { fontSize: FontSize.sm, fontFamily: Fonts.bold, color: '#fff', letterSpacing: 0.5 },
    refShare: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 9, paddingHorizontal: 16, borderRadius: BorderRadius.pill, backgroundColor: '#fff' },
    refShareText: { fontSize: FontSize.sm, fontFamily: Fonts.bold },

    // Transactions
    recentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    seeAll: { fontSize: FontSize.sm, fontFamily: Fonts.semiBold },
    txCard: {
      flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
      backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
      borderWidth: 1, borderColor: Colors.surfaceBorder, padding: Spacing.md, marginBottom: Spacing.sm,
    },
    txIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
    txTitle: { fontSize: FontSize.md, fontFamily: Fonts.semiBold, color: Colors.text },
    txMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginTop: 3 },
    statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: BorderRadius.pill },
    statusText: { fontSize: 10, fontFamily: Fonts.semiBold },
    txSub: { fontSize: FontSize.xs, fontFamily: Fonts.regular, color: Colors.textMuted },
    txAmount: { fontSize: FontSize.md, fontFamily: Fonts.bold },

    // Skeleton
    skelBalance: { height: 48, borderRadius: BorderRadius.md, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden', marginVertical: 2 },
    skelSm: { height: 12, borderRadius: BorderRadius.sm, backgroundColor: withAlpha(Colors.text, 0.06), overflow: 'hidden' },

    // FAB controls
    fabRow: { position: 'absolute', bottom: Spacing.lg, alignSelf: 'center', flexDirection: 'row', gap: Spacing.sm },
    fab: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm + 4, borderRadius: BorderRadius.pill, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8 },
    fabGhost: { backgroundColor: Colors.cardSolid, borderWidth: 1, shadowOpacity: 0.15 },
    fabText: { fontFamily: Fonts.bold, fontSize: FontSize.sm },
  });
