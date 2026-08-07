/**
 * Helpers d'animation réutilisables (légers, sans dépendance externe).
 * Basés sur l'API Animated de React Native — useNativeDriver quand possible.
 *
 * - <Reveal>      : apparition fondu + slide, optionnellement décalée (cascade).
 * - <Bounce>      : feedback tactile (léger scale au toucher) — remplace TouchableOpacity.
 * - useCountUp()  : compteur animé (ex. solde) avec séparateurs de milliers FR.
 *
 * Tout est opt-in : on l'applique là où on veut, rien n'est imposé globalement.
 */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, type ViewStyle, type StyleProp } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/* ───────────────────────────── Reveal ──────────────────────────────────── */

interface RevealProps {
  children: React.ReactNode;
  /** Délai avant le départ (ms). Utiliser index * 60 pour une cascade. */
  delay?: number;
  /** Distance de slide vertical initiale (px). */
  offset?: number;
  duration?: number;
  style?: StyleProp<ViewStyle>;
}

/** Apparition fondu + slide vertical au montage. */
export function Reveal({ children, delay = 0, offset = 18, duration = 450, style }: RevealProps) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1,
      duration,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View
      style={[
        style,
        { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }] },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/* ───────────────────────────── Bounce ──────────────────────────────────── */

interface BounceProps {
  children: React.ReactNode;
  onPress?: () => void;
  /** Appui long — menu contextuel sur une carte, par exemple. */
  onLongPress?: () => void;
  disabled?: boolean;
  /** Échelle au toucher (défaut 0.96). */
  scaleTo?: number;
  style?: StyleProp<ViewStyle>;
  hitSlop?: number;
}

/**
 * Pressable avec micro-rebond (scale spring). Drop-in pour boutons/cartes.
 * Le `style` (y compris flex) est appliqué directement sur le Pressable animé
 * → conserve le layout d'origine (flex:1, etc.).
 */
export function Bounce({ children, onPress, onLongPress, disabled, scaleTo = 0.96, style, hitSlop }: BounceProps) {
  const s = useRef(new Animated.Value(1)).current;
  return (
    <AnimatedPressable
      onPress={onPress}
      onLongPress={onLongPress}
      disabled={disabled}
      hitSlop={hitSlop}
      onPressIn={() => Animated.spring(s, { toValue: scaleTo, useNativeDriver: true, friction: 6 }).start()}
      onPressOut={() => Animated.spring(s, { toValue: 1, useNativeDriver: true, friction: 6 }).start()}
      style={[style, { transform: [{ scale: s }] }] as any}
    >
      {children}
    </AnimatedPressable>
  );
}

/* ───────────────────────────── useCountUp ──────────────────────────────── */

/**
 * Compteur animé : renvoie la valeur numérique en cours d'animation.
 * Rejoue l'animation quand `target` change (interpole depuis la valeur précédente).
 * À formater soi-même (ex. via fmtXof) pour respecter la devise d'affichage.
 */
export function useCountUpValue(target: number, duration = 1100): number {
  const anim = useRef(new Animated.Value(0)).current;
  const [val, setVal] = useState(target);
  const prev = useRef(0);
  useEffect(() => {
    const from = prev.current;
    prev.current = target;
    if (from === target) { setVal(target); return; }
    anim.setValue(0);
    const id = anim.addListener(({ value }) => setVal(from + (target - from) * value));
    Animated.timing(anim, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [target]);
  return val;
}

/**
 * Compteur animé : renvoie une string formatée (séparateurs d'espaces, FR).
 * Rejoue l'animation quand `target` change.
 */
export function useCountUp(target: number, duration = 1100): string {
  return useCountUpValue(target, duration).toLocaleString('fr-FR', { maximumFractionDigits: 2 }).replace(/,/g, ' ');
}
