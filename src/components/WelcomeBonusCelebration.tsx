import React, { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Modal, Dimensions, TouchableOpacity, Easing, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { FontSize, Fonts, Spacing, BorderRadius } from '../constants/theme';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

/** Palette « golden pétillant » pour les confettis. */
const CONFETTI_COLORS = ['#FFD700', '#FBBF24', '#F59E0B', '#FCD34D', '#FDE68A', '#FFFFFF', '#FFF3B0'];
const EMOJI = ['✨', '⭐', '🌟', '💫'];
const PIECES = 60;

interface Props {
  visible: boolean;
  amountLabel: string;
  onClose: () => void;
}

/**
 * Explosion de paillettes dorées + carte « golden » à l'ouverture, quand le
 * bonus de bienvenue vient d'être crédité sur le solde. Confettis maison
 * (Animated, native driver) → aucune dépendance externe.
 */
export function WelcomeBonusCelebration({ visible, amountLabel, onClose }: Props) {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        {/* Confettis */}
        {visible && Array.from({ length: PIECES }).map((_, i) => <ConfettiPiece key={i} />)}

        {/* Carte golden */}
        <Pressable onPress={(e) => e.stopPropagation()}>
          <GoldenCard amountLabel={amountLabel} onClose={onClose} t={t} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function GoldenCard({ amountLabel, onClose, t }: { amountLabel: string; onClose: () => void; t: (k: string, o?: any) => string }) {
  const pop = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 6, tension: 70 }).start();
    Animated.loop(
      Animated.timing(shimmer, { toValue: 1, duration: 2200, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
    ).start();
  }, []);

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] });
  const glowScale = shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.12, 1] });
  const glowOpacity = shimmer.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.6, 0.35] });

  return (
    <Animated.View style={[styles.cardWrap, { opacity: pop, transform: [{ scale }] }]}>
      {/* halo pulsant derrière la carte */}
      <Animated.View style={[styles.halo, { opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />

      <LinearGradient
        colors={['#FEF3C7', '#FBBF24', '#F59E0B', '#B45309']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.card}
      >
        <Text style={[styles.deco, styles.deco1]}>✨</Text>
        <Text style={[styles.deco, styles.deco2]}>💫</Text>
        <Text style={[styles.deco, styles.deco3]}>⭐</Text>

        <View style={styles.badgeGlow}>
          <View style={styles.badge}>
            <FontAwesome6 name="sack-dollar" size={30} color="#B45309" />
          </View>
        </View>

        <Text style={styles.title}>{t('welcomeBonus.unlockedTitle', 'Bonus débloqué !')}</Text>
        <Text style={styles.amount}>+ {amountLabel}</Text>
        <Text style={styles.sub}>{t('welcomeBonus.unlockedSub', 'crédités sur votre solde ✨')}</Text>

        <TouchableOpacity activeOpacity={0.9} onPress={onClose} style={styles.btn}>
          <Text style={styles.btnText}>{t('welcomeBonus.unlockedCta', 'Génial !')} 🎉</Text>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
}

function ConfettiPiece() {
  const fall = useRef(new Animated.Value(0)).current;

  const cfg = useMemo(() => {
    const emoji = Math.random() > 0.72 ? EMOJI[Math.floor(Math.random() * EMOJI.length)] : null;
    const size = 7 + Math.random() * 9;
    return {
      startX: Math.random() * SCREEN_W,
      drift: (Math.random() - 0.5) * 160,
      size,
      emoji,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      delay: Math.random() * 900,
      duration: 2600 + Math.random() * 2400,
      spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 900),
      circle: Math.random() > 0.5,
    };
  }, []);

  useEffect(() => {
    const anim = Animated.sequence([
      Animated.delay(cfg.delay),
      Animated.loop(
        Animated.timing(fall, { toValue: 1, duration: cfg.duration, easing: Easing.linear, useNativeDriver: true }),
      ),
    ]);
    anim.start();
    return () => anim.stop();
  }, []);

  const translateY = fall.interpolate({ inputRange: [0, 1], outputRange: [-60, SCREEN_H + 60] });
  const translateX = fall.interpolate({ inputRange: [0, 1], outputRange: [0, cfg.drift] });
  const rotate = fall.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${cfg.spin}deg`] });
  const opacity = fall.interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 1, 1, 0] });

  const transform = [{ translateY }, { translateX }, { rotate }];

  if (cfg.emoji) {
    return (
      <Animated.Text style={{ position: 'absolute', left: cfg.startX, top: 0, fontSize: cfg.size + 4, opacity, transform }}>
        {cfg.emoji}
      </Animated.Text>
    );
  }

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: cfg.startX,
        top: 0,
        width: cfg.size,
        height: cfg.circle ? cfg.size : cfg.size * 0.5,
        borderRadius: cfg.circle ? cfg.size / 2 : 1.5,
        backgroundColor: cfg.color,
        opacity,
        transform,
      }}
    />
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(10,8,20,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  cardWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: 'rgba(251,191,36,0.55)',
  },
  card: {
    width: 300,
    maxWidth: '100%',
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  deco: { position: 'absolute', opacity: 0.9 },
  deco1: { top: 14, left: 20, fontSize: 18 },
  deco2: { top: 40, right: 22, fontSize: 14 },
  deco3: { bottom: 66, left: 26, fontSize: 12 },
  badgeGlow: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.32)',
    marginBottom: Spacing.md,
  },
  badge: {
    width: 66,
    height: 66,
    borderRadius: 33,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  title: {
    color: '#FFFFFF',
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
    textShadowColor: 'rgba(120,53,15,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 6,
  },
  amount: {
    color: '#FFFFFF',
    fontSize: 40,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
    marginTop: Spacing.sm,
    textShadowColor: 'rgba(120,53,15,0.5)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 10,
  },
  sub: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    marginTop: 4,
    marginBottom: Spacing.lg,
  },
  btn: {
    backgroundColor: '#FFFFFF',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.pill,
  },
  btnText: {
    color: '#B45309',
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
});
