import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Modal,
  Image,
  StyleSheet,
  Animated,
  PanResponder,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;
const DOUBLE_TAP_MS = 280;

/**
 * Visionneuse plein écran : pincement, déplacement, double tap.
 *
 * Pourquoi ne pas garder l'ancienne : elle empilait deux ScrollView à zoom
 * natif et redimensionnait l'image elle-même (`width * scale`). Le zoom du
 * ScrollView et celui du style se cumulaient, la taille de contenu changeait
 * sous le doigt, et rien ne bornait le déplacement — l'image partait hors
 * cadre dès qu'on agrandissait, d'où la sensation d'instabilité. Le zoom natif
 * des ScrollView n'existe d'ailleurs ni sur Android ni sur le web.
 *
 * Ici tout passe par une seule transform animée, et le déplacement est BORNÉ
 * à ce que l'image dépasse réellement de l'écran : on ne peut donc jamais la
 * perdre. La taille affichée est calculée depuis les dimensions réelles du
 * fichier, sinon les bornes seraient fausses pour une image plus étroite ou
 * plus large que l'écran.
 */
export function ImageLightbox({ uri, onClose }: { uri: string | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const scale = useRef(new Animated.Value(1)).current;
  const tx = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(0)).current;

  // État courant suivi hors rendu : un Animated.Value ne se lit pas de façon
  // synchrone, et chaque geste doit repartir d'où le précédent s'est arrêté —
  // c'est ce qui évite le saut au début de chaque nouveau pincement.
  const view = useRef({ scale: 1, x: 0, y: 0 });
  const gesture = useRef({ startScale: 1, startX: 0, startY: 0, startDist: 0, fx: 0, fy: 0, startMidX: 0, startMidY: 0 });
  const lastTap = useRef(0);

  // Taille réellement affichée (resizeMode contain), base des bornes.
  const shown = (() => {
    if (!size) return { w: width, h: height };
    const imageRatio = size.w / size.h;
    const screenRatio = width / height;
    return imageRatio > screenRatio
      ? { w: width, h: width / imageRatio }
      : { w: height * imageRatio, h: height };
  })();

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  /** Déplacement maximal autorisé : la moitié de ce qui dépasse de l'écran. */
  const bounds = (s: number) => ({
    x: Math.max(0, (shown.w * s - width) / 2),
    y: Math.max(0, (shown.h * s - height) / 2),
  });

  const apply = (s: number, x: number, y: number) => {
    const b = bounds(s);
    const nx = clamp(x, -b.x, b.x);
    const ny = clamp(y, -b.y, b.y);
    view.current = { scale: s, x: nx, y: ny };
    scale.setValue(s);
    tx.setValue(nx);
    ty.setValue(ny);
  };

  const animateTo = (s: number, x = 0, y = 0) => {
    const b = bounds(s);
    const nx = clamp(x, -b.x, b.x);
    const ny = clamp(y, -b.y, b.y);
    view.current = { scale: s, x: nx, y: ny };
    Animated.parallel([
      Animated.spring(scale, { toValue: s, useNativeDriver: true, friction: 8, tension: 90 }),
      Animated.spring(tx, { toValue: nx, useNativeDriver: true, friction: 8, tension: 90 }),
      Animated.spring(ty, { toValue: ny, useNativeDriver: true, friction: 8, tension: 90 }),
    ]).start();
  };

  const reset = () => animateTo(1, 0, 0);

  // Nouvelle image : on repart d'une vue neuve et on mesure le fichier.
  useEffect(() => {
    if (!uri) return;
    view.current = { scale: 1, x: 0, y: 0 };
    scale.setValue(1);
    tx.setValue(0);
    ty.setValue(0);
    setSize(null);
    Image.getSize(uri, (w, h) => setSize({ w, h }), () => setSize(null));
  }, [uri]);

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (e, g) =>
        e.nativeEvent.touches.length >= 2 || view.current.scale > 1 || Math.abs(g.dy) > 6,

      onPanResponderGrant: (e) => {
        const touches = e.nativeEvent.touches;
        gesture.current.startScale = view.current.scale;
        gesture.current.startX = view.current.x;
        gesture.current.startY = view.current.y;

        if (touches.length >= 2) {
          const [a, b] = touches;
          gesture.current.startDist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) || 1;
          // Point entre les doigts, exprimé depuis le centre de l'écran : c'est
          // lui qui doit rester sous les doigts pendant le pincement.
          gesture.current.startMidX = (a.pageX + b.pageX) / 2;
          gesture.current.startMidY = (a.pageY + b.pageY) / 2;
          gesture.current.fx = gesture.current.startMidX - width / 2;
          gesture.current.fy = gesture.current.startMidY - height / 2;
        }
      },

      onPanResponderMove: (e, g) => {
        const touches = e.nativeEvent.touches;

        if (touches.length >= 2) {
          const [a, b] = touches;
          const dist = Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY) || 1;
          if (!gesture.current.startDist) {
            gesture.current.startDist = dist;
            return;
          }
          const ratio = dist / gesture.current.startDist;
          const s = clamp(gesture.current.startScale * ratio, MIN_SCALE, MAX_SCALE);
          const factor = s / gesture.current.startScale;

          // Le point pincé reste au même endroit à l'écran, et suit le
          // déplacement des deux doigts.
          const midX = (a.pageX + b.pageX) / 2;
          const midY = (a.pageY + b.pageY) / 2;
          const x = gesture.current.fx - (gesture.current.fx - gesture.current.startX) * factor
            + (midX - gesture.current.startMidX);
          const y = gesture.current.fy - (gesture.current.fy - gesture.current.startY) * factor
            + (midY - gesture.current.startMidY);

          apply(s, x, y);
          return;
        }

        // Un doigt : déplacement, seulement s'il y a de quoi déplacer.
        if (view.current.scale > 1) {
          apply(view.current.scale, gesture.current.startX + g.dx, gesture.current.startY + g.dy);
        }
      },

      onPanResponderRelease: (e, g) => {
        gesture.current.startDist = 0;

        // Double tap : bascule entre taille écran et agrandissement.
        const isTap = Math.abs(g.dx) < 6 && Math.abs(g.dy) < 6;
        if (isTap) {
          const now = Date.now();
          if (now - lastTap.current < DOUBLE_TAP_MS) {
            lastTap.current = 0;
            if (view.current.scale > 1.05) {
              reset();
            } else {
              const px = (e.nativeEvent.pageX ?? width / 2) - width / 2;
              const py = (e.nativeEvent.pageY ?? height / 2) - height / 2;
              // On zoome vers l'endroit touché, pas vers le centre.
              animateTo(DOUBLE_TAP_SCALE, -px * (DOUBLE_TAP_SCALE - 1), -py * (DOUBLE_TAP_SCALE - 1));
            }
            return;
          }
          lastTap.current = now;
          return;
        }

        // Sous l'échelle 1, l'image se recentre d'elle-même ; au-dessus, on la
        // ramène dans ses bornes si le geste l'a poussée trop loin.
        if (view.current.scale <= MIN_SCALE + 0.02) {
          reset();
        } else {
          animateTo(view.current.scale, view.current.x, view.current.y);
        }
      },

      onPanResponderTerminate: () => {
        gesture.current.startDist = 0;
      },
    }),
  ).current;

  // Web : la molette zoome, comme dans n'importe quelle visionneuse de bureau.
  const rootRef = useRef<View>(null);
  useEffect(() => {
    if (Platform.OS !== 'web' || !uri) return;
    const node = rootRef.current as unknown as HTMLElement | null;
    if (!node?.addEventListener) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const s = clamp(view.current.scale * (event.deltaY < 0 ? 1.12 : 0.89), MIN_SCALE, MAX_SCALE);
      if (s <= MIN_SCALE + 0.02) {
        apply(MIN_SCALE, 0, 0);
      } else {
        apply(s, view.current.x, view.current.y);
      }
    };

    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [uri, shown.w, shown.h]);

  if (!uri) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root} ref={rootRef}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { transform: [{ translateX: tx }, { translateY: ty }, { scale }] },
          ]}
          {...pan.panHandlers}
        >
          <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
        </Animated.View>

        <View style={styles.toolbar}>
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => animateTo(clamp(view.current.scale - 0.75, MIN_SCALE, MAX_SCALE), view.current.x, view.current.y)}
          >
            <FontAwesome6 name="magnifying-glass-minus" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.toolBtn} onPress={reset}>
            <FontAwesome6 name="arrows-to-dot" size={16} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.toolBtn}
            onPress={() => animateTo(clamp(view.current.scale + 0.75, MIN_SCALE, MAX_SCALE), view.current.x, view.current.y)}
          >
            <FontAwesome6 name="magnifying-glass-plus" size={16} color="#fff" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.close} onPress={onClose} hitSlop={12}>
          <FontAwesome6 name="xmark" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.96)', overflow: 'hidden' },
  close: {
    position: 'absolute',
    top: 44,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.14)',
  },
  toolbar: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 999,
    padding: 6,
  },
  toolBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
