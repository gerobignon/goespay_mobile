import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ImageBackground,
  TouchableOpacity,
  PanResponder,
  Platform,
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
/** Déplacement horizontal minimal pour changer de carte. */
const SWIPE_THRESHOLD = 55;

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

  /** Position de chaque panneau dans la pile : 0 = devant, 1 = dessous. */
  const depth = useRef([new Animated.Value(0), new Animated.Value(1)]).current;
  /** Suivi du doigt sur la carte du dessus. */
  const drag = useRef(new Animated.Value(0)).current;

  const isAdmin = user?.group === 'admin';

  useEffect(() => {
    // Fonctionnalité interne : inutile d'interroger le serveur pour un compte
    // qui n'y a pas droit (il répondrait 404 de toute façon).
    if (!isAdmin) { setCardsReady(true); return; }
    let alive = true;
    cardService.list()
      .then((res) => { if (alive) setCards(res.cards); })
      // Service indisponible ou non éligible : on n'affiche simplement pas le panneau.
      .catch(() => { if (alive) setCards(null); })
      .finally(() => { if (alive) setCardsReady(true); });
    return () => { alive = false; };
  }, [isAdmin]);

  const holder = `${user?.name ?? ''} ${user?.surname ?? ''}`.trim();
  const activeCard = cards?.find((c) => c.status === 'active') ?? cards?.[0] ?? null;
  const hasStack = cardsReady && cards !== null;

  /** Fait passer devant le panneau demandé, et l'autre dessous. */
  const goTo = useCallback((i: number) => {
    setActive(i);
    Animated.parallel([
      Animated.spring(drag, { toValue: 0, useNativeDriver: true, friction: 8, tension: 60 }),
      ...depth.map((v, idx) => Animated.spring(v, {
        toValue: idx === i ? 0 : 1,
        useNativeDriver: true,
        friction: 8,
        tension: 60,
      })),
    ]).start();
  }, [depth, drag]);

  // Glissement horizontal sur la pile. Le geste ne se déclenche qu'au-delà d'un
  // seuil et seulement s'il est franchement horizontal, pour ne jamais voler le
  // défilement vertical de la page.
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 12 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderMove: (_, g) => drag.setValue(g.dx),
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) > SWIPE_THRESHOLD) {
        goTo(active === 0 ? 1 : 0);
      } else {
        Animated.spring(drag, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(drag, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
    },
  }), [active, drag, goTo]);

  /** Panneau « carte virtuelle », calé sur la présentation de la carte de solde. */
  const renderCardPanel = () => (
    <ImageBackground
      source={require('../../../assets/bg_page.jpg')}
      style={styles.panelCard}
      imageStyle={styles.panelCardImage}
    >
      <TouchableOpacity
        style={styles.panelInner}
        activeOpacity={0.9}
        onPress={() => router.push('/cards')}
      >
        <Text style={styles.panelLabel}>{t('cards.title')}</Text>

        <VirtualCardVisual card={activeCard} holder={holder} />

        {activeCard ? (
          <View style={styles.panelFooter}>
            <Text style={styles.panelBalance}>
              {activeCard.balance.toFixed(2)} {activeCard.currency}
            </Text>
            <View style={styles.panelAction}>
              <Text style={styles.panelActionText}>{t('cards.manage')}</Text>
              <FontAwesome6 name="chevron-right" size={12} color={DarkColors.textSecondary} />
            </View>
          </View>
        ) : (
          <View style={styles.panelAction}>
            <Text style={styles.panelActionText}>{t('cards.order')}</Text>
            <FontAwesome6 name="chevron-right" size={12} color={DarkColors.textSecondary} />
          </View>
        )}
      </TouchableOpacity>
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
      <View style={{ height: stackHeight + PEEK }} {...pan.panHandlers}>
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
                    // Seule la carte du dessus suit le doigt.
                    { translateX: isActive ? drag : 0 },
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
              {panels[i]}
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
  panel: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
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
  panelFooter: { alignItems: 'center', gap: Spacing.sm },
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
    marginTop: Spacing.md,
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
