import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ImageBackground,
  TouchableOpacity,
  Platform,
  ScrollView,
  Pressable,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { FontAwesome6 } from '@expo/vector-icons';
import { cardService, type VirtualCard } from '../../services/cardService';
import { VirtualCardVisual } from '../VirtualCardVisual';
import { useAuthStore } from '../../stores/authStore';
import { Colors, DarkColors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';

/** Ce que la carte du dessous laisse RÉELLEMENT dépasser en bas, en pixels. */
const PEEK = 18;
/** Réduction de la carte du dessous. */
const BACK_SCALE = 0.94;
/** Largeur d'un segment du sélecteur. */
const SEG_W = 48;
/** Déplacement vertical minimal pour changer de panneau. */
const SWIPE_THRESHOLD = 55;
/** Largeur de l'aperçu de carte : un aperçu, pas la fiche de l'écran cartes. */
const CARD_PREVIEW_WIDTH = 300;
/** Marge rendue au conteneur pour que le découpage ne mange pas l'ombre. */
const CLIP_PAD = 24;
/** Cadence du défilement automatique des cartes. */
const AUTOPLAY_MS = 5000;

interface Props {
  /** Panneau principal : la carte de solde du wallet. */
  children: React.ReactNode;
}

/**
 * Pile de comptes : le solde du wallet et la carte virtuelle occupent le même
 * emplacement, l'une devant l'autre. Celle du dessous dépasse en bas, réduite,
 * comme dans un jeu de cartes.
 *
 * On change de carte en glissant vers la gauche ou la droite — la carte du
 * dessus part sur le côté et repasse dessous — ou en touchant l'une des deux
 * icônes sous la pile.
 *
 * Le panneau « carte » n'apparaît que si le service répond. Sur un compte où
 * les cartes ne sont pas ouvertes — ou si la fonctionnalité est coupée côté
 * serveur — l'accueil garde exactement son affichage d'avant.
 */
export function WalletStack({ children }: Props) {
  const styles = useThemedStyles(createStyles);
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  // Hauteur de chaque panneau. La pile prend la PLUS GRANDE des deux : imposer
  // celle du wallet au panneau carte rognait son contenu (titre coupé en haut,
  // le panneau étant centré verticalement sous un overflow: hidden).
  const [height, setHeight] = useState(0);
  const [cardHeight, setCardHeight] = useState(0);
  const [active, setActive] = useState(0);
  const [cards, setCards] = useState<VirtualCard[] | null>(null);
  const [cardsReady, setCardsReady] = useState(false);
  /** Carte visible dans le panneau, quand le client en a plusieurs. */
  const [cardIndex, setCardIndex] = useState(0);
  /** Largeur utile du panneau, mesurée : elle cale la pagination du glissement. */
  const [pagerWidth, setPagerWidth] = useState(0);
  /** Le défilement s'arrête dès que le client prend la main : il choisit sa carte. */
  const [autoPlay, setAutoPlay] = useState(true);
  const pagerRef = useRef<ScrollView>(null);

  /** Position de chaque panneau dans la pile : 0 = devant, 1 = dessous. */
  const depth = useRef([new Animated.Value(0), new Animated.Value(1)]).current;

  useEffect(() => {
    let alive = true;
    cardService.list()
      .then((res) => { if (alive) setCards(res.cards); })
      // Service indisponible ou non éligible : on n'affiche simplement pas le panneau.
      .catch(() => { if (alive) setCards(null); })
      .finally(() => { if (alive) setCardsReady(true); });
    return () => { alive = false; };
  }, []);

  const holder = `${user?.name ?? ''} ${user?.surname ?? ''}`.trim();
  const hasStack = cardsReady && cards !== null;

  // Cartes réellement présentables : une demande échouée ou une carte résiliée
  // n'a rien à faire dans un aperçu d'accueil.
  const liveCards = (cards ?? []).filter((c) => c.status !== 'failed' && c.status !== 'terminated');
  const activeCard = liveCards[Math.min(cardIndex, Math.max(0, liveCards.length - 1))] ?? null;

  /** Amène la carte demandée devant, et met à jour le solde affiché avec elle. */
  const goToCard = useCallback((i: number, stopAuto = true) => {
    if (stopAuto) setAutoPlay(false);
    setCardIndex(i);
    if (pagerWidth > 0) {
      pagerRef.current?.scrollTo({ x: i * pagerWidth, animated: true });
    }
  }, [pagerWidth]);

  // Défilement automatique des cartes, tant que le client n'a pas choisi la
  // sienne. Il reprend au début après la dernière.
  useEffect(() => {
    if (!autoPlay || liveCards.length < 2 || pagerWidth === 0) return;
    const id = setInterval(() => {
      setCardIndex((prev) => {
        const next = (prev + 1) % liveCards.length;
        pagerRef.current?.scrollTo({ x: next * pagerWidth, animated: true });
        return next;
      });
    }, AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [autoPlay, liveCards.length, pagerWidth]);

  /** Fait passer devant le panneau demandé, et l'autre dessous. */
  const goTo = useCallback((i: number) => {
    setActive(i);
    Animated.parallel([
      ...depth.map((v, idx) => Animated.spring(v, {
        toValue: idx === i ? 0 : 1,
        useNativeDriver: true,
        friction: 8,
        tension: 60,
      })),
    ]).start();
  }, [depth]);

  // Pas de geste de balayage sur la pile. Il ne pouvait pas cohabiter : en
  // horizontal il entrait en concurrence avec le défilement des cartes logé
  // dans l'un des panneaux, en vertical avec celui de la page d'accueil sur
  // laquelle la pile est posée. On change de panneau en touchant celui du
  // dessous, ou par le sélecteur sous la pile — deux gestes sans ambiguïté.

  /** Panneau « carte virtuelle », calé sur la présentation de la carte de solde. */
  const renderCardPanel = () => (
    <ImageBackground
      source={require('../../../assets/bg_page.jpg')}
      style={styles.panelCard}
      imageStyle={styles.panelCardImage}
    >
      {/* Conteneur NON tactile : un Touchable enveloppant tout le panneau se
          disputait chaque geste avec le défilement des cartes — le doigt
          déclenchait tantôt le glissement, tantôt la navigation, d'où des
          sauts. Les zones qui ouvrent l'écran cartes sont désignées une à une. */}
      <View style={styles.panelInner}>
        <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/cards')}>
          <Text style={styles.panelLabel}>{t('cards.title')}</Text>
        </TouchableOpacity>

        {/* Plusieurs cartes : elles défilent sur place. Le glissement reste
            capté par ce défilement, jamais par la pile — on change de panneau
            avec les deux pastilles sous la pile, pas en balayant la carte. */}
        {liveCards.length > 1 ? (
          <View style={styles.pager} onLayout={(e) => setPagerWidth(Math.round(e.nativeEvent.layout.width))}>
            <ScrollView
              ref={pagerRef}
              horizontal
              style={styles.pagerScroll}
              pagingEnabled
              snapToInterval={pagerWidth || undefined}
              decelerationRate="fast"
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                if (pagerWidth > 0) {
                  setCardIndex(Math.round(e.nativeEvent.contentOffset.x / pagerWidth));
                }
              }}
              onScrollBeginDrag={() => { setAutoPlay(false); }}
            >
              {liveCards.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  activeOpacity={0.9}
                  onPress={() => router.push('/cards')}
                  style={pagerWidth > 0 ? { width: pagerWidth, alignItems: 'center' } : undefined}
                >
                  <VirtualCardVisual card={c} holder={holder} maxWidth={CARD_PREVIEW_WIDTH} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : (
          <TouchableOpacity activeOpacity={0.9} onPress={() => router.push('/cards')}>
            <VirtualCardVisual card={activeCard} holder={holder} maxWidth={CARD_PREVIEW_WIDTH} />
          </TouchableOpacity>
        )}

        {activeCard ? (
          /* Une seule ligne sous la carte, calée sur sa largeur : le sélecteur de
             carte à gauche, le solde de la carte affichée à droite. Le rappel du
             numéro et le lien « Gérer » ajoutaient deux lignes qui faisaient
             dépasser le panneau. */
          <View style={styles.panelFooter}>
            <View style={styles.dots}>
              {liveCards.length > 1 && liveCards.map((c, i) => (
                <TouchableOpacity
                  key={c.id}
                  activeOpacity={0.8}
                  onPress={() => goToCard(i)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: i === cardIndex }}
                  style={[styles.dot, i === cardIndex && styles.dotOn]}
                >
                  <Text style={[styles.dotText, i === cardIndex && styles.dotTextOn]}>
                    {c.last4 ?? '••••'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity activeOpacity={0.7} onPress={() => router.push('/cards')}>
              <Text style={styles.panelBalance}>
                {activeCard.balance.toFixed(2)} {activeCard.currency}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={styles.panelAction} activeOpacity={0.7} onPress={() => router.push('/cards')}>
            <Text style={styles.panelActionText}>{t('cards.order')}</Text>
            <FontAwesome6 name="chevron-right" size={12} color={DarkColors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>
    </ImageBackground>
  );

  const measureHeight = useCallback((e: any) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0) setHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev));
  }, []);

  const measureCardHeight = useCallback((e: any) => {
    const h = Math.round(e.nativeEvent.layout.height);
    if (h > 0) setCardHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev));
  }, []);

  // Pas de carte à empiler, ou hauteur pas encore connue : le wallet seul.
  if (!hasStack || height === 0) {
    return <View onLayout={measureHeight}>{children}</View>;
  }

  const panels = [children, renderCardPanel()];
  const TABS = [
    { icon: 'wallet' as const, label: t('home.balance') },
    { icon: 'credit-card' as const, label: t('cards.title') },
  ];

  // L'ordre de rendu porte la profondeur : le panneau actif est dessiné en
  // dernier, donc au-dessus. Celui qui recule repasse dessous immédiatement,
  // et on le voit glisser sous l'autre en revenant de son écart.
  const order = [...panels.keys()].sort((a, b) => (a === active ? 1 : 0) - (b === active ? 1 : 0));

  // Aucun panneau n'est tronqué : la pile se cale sur le plus haut des deux.
  const stackHeight = Math.max(height, cardHeight);

  return (
    <View>
      {/* Le panneau qui part sur le côté doit être COUPÉ à la lisière de la
          pile : sans cela il glissait par-dessus le reste de l'accueil pendant
          le geste, jusqu'à recouvrir l'en-tête. La marge négative rend au
          conteneur la place que prend l'ombre, qui serait sinon rognée elle
          aussi. */}
      <View
        style={[styles.clip, { height: stackHeight + PEEK + CLIP_PAD * 2 }]}
      >
        {order.map((i) => {
          const d = depth[i];
          const isActive = i === active;
          return (
            <Animated.View
              key={i}
              onLayout={i === 0 ? measureHeight : measureCardHeight}
              style={[
                styles.panel,
                // Les deux panneaux gardent leur hauteur naturelle : leur imposer
                // celle de l'autre rognerait le contenu du plus haut. Le plus court
                // s'étire seulement jusqu'à la hauteur commune.
                i === 0 ? null : { minHeight: height },
                {
                  transform: [
                    {
                      translateY: d.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, PEEK + (stackHeight * (1 - BACK_SCALE)) / 2],
                      }),
                    },
                    { scale: d.interpolate({ inputRange: [0, 1], outputRange: [1, BACK_SCALE] }) },
                  ],
                  opacity: d.interpolate({ inputRange: [0, 1], outputRange: [1, 0.88] }),
                },
              ]}
            >
              {/* Le panneau du dessous ne fait qu'une chose au toucher : passer
                  devant. Sans ce garde, on déclencherait les actions du panneau
                  caché à travers la carte du dessus. */}
              {isActive ? (
                panels[i]
              ) : (
                <Pressable style={styles.flex} onPress={() => goTo(i)} accessibilityRole="button">
                  <View style={styles.flex} pointerEvents="none">{panels[i]}</View>
                </Pressable>
              )}
            </Animated.View>
          );
        })}
      </View>

      <View style={styles.switch}>
        {/* Le curseur suit la même animation que la pile : les deux bougent ensemble. */}
        <Animated.View
          style={[
            styles.switchThumb,
            {
              transform: [{
                translateX: depth[0].interpolate({ inputRange: [0, 1], outputRange: [0, SEG_W] }),
              }],
            },
          ]}
        />
        {panels.map((_, i) => {
          const tab = TABS[i] ?? TABS[0];
          const on = i === active;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => goTo(i)}
              style={styles.switchSeg}
              accessibilityLabel={tab.label}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
            >
              <FontAwesome6
                name={tab.icon}
                size={15}
                color={on ? Colors.white : Colors.textMuted}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  clip: {
    // Découpe ce qui sort de la pile pendant le glissement.
    overflow: 'hidden',
    marginHorizontal: -CLIP_PAD,
    paddingHorizontal: CLIP_PAD,
    paddingTop: CLIP_PAD,
    marginTop: -CLIP_PAD,
    // La réserve du bas n'existe que pour l'ombre : on la rend à la page, sauf
    // les quelques pixels où l'ombre se voit réellement. Sinon la pile laissait
    // un trou avant le sélecteur.
    marginBottom: -(CLIP_PAD - 8),
  },
  panel: {
    position: 'absolute',
    left: CLIP_PAD,
    right: CLIP_PAD,
    top: CLIP_PAD,
    // L'ombre épouse la forme de son conteneur : sans cet arrondi, elle dessine
    // un rectangle dont les angles dépassent de la carte.
    borderRadius: BorderRadius.xl,
    // Détache la carte du dessus de celle qui la suit. L'ombre est portée vers
    // le bas, là où le panneau du dessous dépasse : c'est ce qui donne la
    // profondeur, une ombre discrète laissait les deux panneaux à plat.
    ...Platform.select({
      web: { boxShadow: '0 10px 22px rgba(0,0,0,0.42)' } as any,
      default: {
        shadowColor: '#000',
        shadowOpacity: 0.42,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 8 },
        elevation: 9,
      },
    }),
  },
  panelCard: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    flex: 1,
    // Liseré sur les quatre côtés : c'est lui qui dessine le bord du panneau
    // quand il dépasse sous le wallet. Sans lui, deux fonds sombres se
    // confondaient et la pile ne se voyait pas.
    borderWidth: 1,
    borderColor: 'rgba(129,140,248,0.42)',
  },
  panelCardImage: { borderRadius: BorderRadius.xl },
  panelInner: {
    flex: 1,
    // Indigo profond, franchement distinct du bleu-nuit de la carte de solde :
    // les deux panneaux doivent se reconnaître au premier coup d'œil.
    backgroundColor: 'rgba(30,27,75,0.88)',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  panelLabel: {
    color: DarkColors.textSecondary,
    fontSize: FontSize.sm,
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  // Pas d'alignItems ici : centrer les enfants écrase la largeur du ScrollView,
  // qui prend alors celle de son contenu (n cartes) et déborde du panneau — on
  // voyait deux demi-cartes au lieu d'une, et la pagination ne tombait jamais juste.
  flex: { flex: 1 },
  pager: { width: '100%' },
  pagerScroll: { width: '100%' },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  // Le repère de défilement porte le numéro : on sait quelle carte est devant,
  // et on y va d'un toucher.
  dot: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: BorderRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  dotOn: { backgroundColor: 'rgba(255,255,255,0.28)' },
  dotText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: FontSize.xs,
    fontFamily: Fonts.medium,
  },
  dotTextOn: { color: '#ffffff' },
  panelFooter: {
    width: CARD_PREVIEW_WIDTH,
    maxWidth: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  panelBalance: {
    color: DarkColors.secondary,
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
  },
  panelAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  panelActionText: {
    color: DarkColors.textSecondary,
    fontSize: FontSize.md,
    fontFamily: Fonts.medium,
  },
  switch: {
    flexDirection: 'row',
    alignSelf: 'center',
    // Collé à la pile : il la commande, il doit lui appartenir visuellement.
    marginTop: Spacing.xs,
    padding: 3,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  switchThumb: {
    position: 'absolute',
    top: 3,
    left: 3,
    width: SEG_W,
    height: 30,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.primary,
  },
  switchSeg: {
    width: SEG_W,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
