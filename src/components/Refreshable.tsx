import React, { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  FlatListProps,
  Platform,
  RefreshControl,
  ScrollView,
  ScrollViewProps,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { Colors } from '../constants/theme';
import { useTheme } from './ThemeProvider';

/*
 * Pull-to-refresh universel.
 *
 * Sur natif on s'appuie sur le RefreshControl de React Native.
 * Sur le web, react-native-web rend <RefreshControl> comme un simple <View> :
 * la prop `refreshControl` est purement décorative, aucun geste n'est câblé.
 * On implémente donc le geste à la main sur le nœud DOM scrollable (touchstart /
 * touchmove / touchend), en n'armant le tirage que lorsque le scroll est en haut.
 */

const PULL_MAX = 110;
const THRESHOLD = 64;
const RESISTANCE = 0.45;

const isWeb = Platform.OS === 'web';

interface RefreshProps {
  refreshing: boolean;
  onRefresh: () => void | Promise<void>;
  tintColor?: string;
  /** Style du conteneur ajouté sur le web autour du scroll (flex:1 par défaut). */
  refreshContainerStyle?: ViewStyle;
}

/** Récupère le div scrollable rendu par react-native-web. */
function scrollableNode(instance: any): HTMLElement | null {
  if (!instance) return null;
  const node =
    (typeof instance.getScrollableNode === 'function' && instance.getScrollableNode()) ||
    (typeof instance.getScrollResponder === 'function' &&
      instance.getScrollResponder()?.getScrollableNode?.()) ||
    instance;
  return node && typeof node.addEventListener === 'function' ? (node as HTMLElement) : null;
}

function useWebPullToRefresh(onRefresh: () => void | Promise<void>, refreshing: boolean) {
  const scrollRef = useRef<any>(null);
  const translate = useRef(new Animated.Value(0)).current;
  const [busy, setBusy] = useState(false);

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;
  const busyRef = useRef(false);
  busyRef.current = busy || refreshing;

  const setRef = useCallback((instance: any) => {
    scrollRef.current = instance;
  }, []);

  useEffect(() => {
    if (!isWeb) return;

    // Le nœud n'existe qu'après le premier rendu : on retente au tick suivant
    // si la ref n'est pas encore résolue (FlatList monte sa ScrollView après).
    let node: HTMLElement | null = null;
    let raf = 0;
    let startY = 0;
    let active = false;
    let distance = 0;

    const spring = (toValue: number) =>
      Animated.spring(translate, {
        toValue,
        useNativeDriver: false,
        bounciness: 0,
        speed: 14,
      }).start();

    // Le tirage ne s'arme qu'en haut du scroll. Si le div rendu n'est pas
    // lui-même scrollable (contenu plus court, ou scroll délégué au document),
    // on regarde aussi le scroll de la page.
    const atTop = () => {
      if (!node) return false;
      if (node.scrollTop > 0) return false;
      if (node.scrollHeight <= node.clientHeight + 1) {
        const doc = document.scrollingElement || document.documentElement;
        if (doc && doc.scrollTop > 0) return false;
      }
      return true;
    };

    const onStart = (e: TouchEvent) => {
      if (busyRef.current || !node || e.touches.length !== 1) return;
      if (!atTop()) return;
      startY = e.touches[0].clientY;
      active = true;
      distance = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!active || !node) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || !atTop()) {
        active = false;
        distance = 0;
        translate.setValue(0);
        return;
      }
      // Empêche le scroll élastique du navigateur pendant le tirage.
      if (e.cancelable) e.preventDefault();
      distance = Math.min(PULL_MAX, dy * RESISTANCE);
      translate.setValue(distance);
    };

    const onEnd = async () => {
      if (!active) return;
      active = false;
      if (distance < THRESHOLD) {
        distance = 0;
        spring(0);
        return;
      }
      distance = 0;
      setBusy(true);
      spring(THRESHOLD);
      try {
        await onRefreshRef.current();
      } finally {
        setBusy(false);
        spring(0);
      }
    };

    const attach = () => {
      node = scrollableNode(scrollRef.current);
      if (!node) {
        raf = requestAnimationFrame(attach);
        return;
      }
      node.addEventListener('touchstart', onStart, { passive: true });
      node.addEventListener('touchmove', onMove, { passive: false });
      node.addEventListener('touchend', onEnd);
      node.addEventListener('touchcancel', onEnd);
    };
    attach();

    return () => {
      if (raf) cancelAnimationFrame(raf);
      if (!node) return;
      node.removeEventListener('touchstart', onStart);
      node.removeEventListener('touchmove', onMove);
      node.removeEventListener('touchend', onEnd);
      node.removeEventListener('touchcancel', onEnd);
    };
  }, [translate]);

  return { setRef, translate, busy };
}

function WebPullWrapper({
  translate,
  spinning,
  tintColor,
  containerStyle,
  children,
}: {
  translate: Animated.Value;
  spinning: boolean;
  tintColor: string;
  containerStyle?: ViewStyle;
  children: React.ReactNode;
}) {
  const { isDark } = useTheme();
  const bubbleBg = isDark ? 'rgba(20,24,34,0.78)' : 'rgba(255,255,255,0.92)';
  const opacity = translate.interpolate({
    inputRange: [0, THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const indicatorY = translate.interpolate({
    inputRange: [0, THRESHOLD],
    outputRange: [-36, 14],
    extrapolate: 'clamp',
  });

  return (
    <View style={[styles.container, containerStyle]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.indicator, { opacity, transform: [{ translateY: indicatorY }] }]}
      >
        <View style={[styles.bubble, { backgroundColor: bubbleBg }]}>
          <ActivityIndicator size="small" color={tintColor} />
        </View>
      </Animated.View>
      <Animated.View style={[styles.content, { transform: [{ translateY: translate }] }]}>
        {children}
      </Animated.View>
    </View>
  );
}

export type RefreshableScrollViewProps = ScrollViewProps & RefreshProps;

export const RefreshableScrollView = forwardRef<ScrollView, RefreshableScrollViewProps>(
  function RefreshableScrollView(
    { refreshing, onRefresh, tintColor = Colors.secondary, refreshContainerStyle, ...props },
    ref
  ) {
    const { setRef, translate, busy } = useWebPullToRefresh(onRefresh, refreshing);

    if (!isWeb) {
      return (
        <ScrollView
          ref={ref}
          {...props}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tintColor} />
          }
        />
      );
    }

    return (
      <WebPullWrapper
        translate={translate}
        spinning={busy || refreshing}
        tintColor={tintColor}
        containerStyle={refreshContainerStyle}
      >
        <ScrollView
          {...props}
          ref={(instance) => {
            setRef(instance);
            if (typeof ref === 'function') ref(instance);
            else if (ref) (ref as React.MutableRefObject<ScrollView | null>).current = instance;
          }}
        />
      </WebPullWrapper>
    );
  }
);

export type RefreshableFlatListProps<T> = FlatListProps<T> & RefreshProps;

export function RefreshableFlatList<T>({
  refreshing,
  onRefresh,
  tintColor = Colors.secondary,
  refreshContainerStyle,
  ...props
}: RefreshableFlatListProps<T>) {
  const { setRef, translate, busy } = useWebPullToRefresh(onRefresh, refreshing);

  if (!isWeb) {
    return (
      <FlatList<T>
        {...props}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={tintColor} />
        }
      />
    );
  }

  return (
    <WebPullWrapper
      translate={translate}
      spinning={busy || refreshing}
      tintColor={tintColor}
      containerStyle={refreshContainerStyle}
    >
      <FlatList<T> {...props} ref={setRef} />
    </WebPullWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
  },
  indicator: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  bubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
