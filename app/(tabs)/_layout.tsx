import { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, Pressable, StyleSheet, Animated, AppState } from 'react-native';
import { setAppBadgeCount, clearWebNotifications } from '../../src/services/appBadge';
import { Spacing, FontSize, Fonts } from '../../src/constants/theme';
import { useColors } from '../../src/components/ThemeProvider';
import { useResponsive } from '../../src/hooks/useResponsive';
import { DesktopHeader } from '../../src/components/DesktopHeader';
import { DesktopFooter } from '../../src/components/DesktopFooter';
import { useTranslation } from 'react-i18next';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useAuthStore } from '../../src/stores/authStore';
import { useDevBoardStore, selectDevUnread } from '../../src/stores/devBoardStore';

const ICON_FOR_ROUTE: Record<string, string> = {
  index: 'house',
  history: 'clock-rotate-left',
  affiliation: 'users',
  support: 'headset',
  dev: 'diagram-project',
};

/** Icône d'onglet qui fait un petit pop quand elle devient active. */
function TabIcon({ name, color, focused }: { name: string; color: string; focused: boolean }) {
  const scale = useRef(new Animated.Value(focused ? 1.15 : 1)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: focused ? 1.15 : 1, useNativeDriver: true, friction: 5, tension: 160 }).start();
  }, [focused]);
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <FontAwesome6 name={name as any} size={20} color={color} />
    </Animated.View>
  );
}

function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const isSuperAdmin = useAuthStore((s) => s.user?.id === 1);
  const devUnread = useDevBoardStore(selectDevUnread);
  // L'onglet Dev n'apparaît que pour le user id 1.
  const routes = state.routes.filter((r) => r.name !== 'dev' || isSuperAdmin);
  const focusedKey = state.routes[state.index]?.key;
  // Le document est calé sur l'écran physique (cf. app/_layout.tsx). En PWA
  // standalone iOS, la webview de layout (innerHeight) est plus courte que
  // l'écran (screen.height) : cet écart est de l'espace « en trop » sous le
  // contenu. On l'ajoute au padding bas de la barre pour qu'elle garde sa
  // position naturelle (icônes en haut) tout en remplissant, avec son fond,
  // jusqu'au bas physique — pas de bande, pas d'espace au-dessus.
  const bottomPad = insets.bottom > 0 ? insets.bottom : 8;

  return (
    <View style={[styles.bar, { paddingTop: bottomPad, paddingBottom: bottomPad, backgroundColor: colors.background, borderTopColor: colors.border }]}>
      {routes.map((route) => {
        const { options } = descriptors[route.key];
        const label = (options.title ?? route.name) as string;
        const isFocused = route.key === focusedKey;
        const color = isFocused ? colors.secondary : colors.textMuted;
        const iconName = ICON_FOR_ROUTE[route.name] ?? 'circle';
        const badge = route.name === 'dev' && devUnread > 0 ? devUnread : 0;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            (navigation.navigate as any)(route.name, route.params);
          }
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            style={styles.item}
          >
            <View>
              <TabIcon name={iconName} color={color} focused={isFocused} />
              {badge > 0 && (
                <View style={[styles.badge, { backgroundColor: colors.error, borderColor: colors.background }]}>
                  <Text style={styles.badgeTxt}>{badge > 99 ? '99+' : badge}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, { color }]} numberOfLines={1}>
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const { isDesktop } = useResponsive();
  const colors = useColors();
  const { t } = useTranslation();
  const isSuperAdmin = useAuthStore((s) => s.user?.id === 1);
  const fetchBoard = useDevBoardStore((s) => s.fetchBoard);
  const devUnread = useDevBoardStore(selectDevUnread);

  // User id 1 : précharge le board pour alimenter le badge de non-lus de l'onglet Dev,
  // puis rafraîchit régulièrement (app au premier plan) pour garder la pastille à jour.
  useEffect(() => {
    if (!isSuperAdmin) return;
    fetchBoard(true);
    const tick = () => {
      if (AppState.currentState === 'active') fetchBoard(true);
    };
    const timer = setInterval(tick, 90000);
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') fetchBoard(true);
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [isSuperAdmin]);

  // Pastille de décompte sur l'icône (PWA installée / natif).
  useEffect(() => {
    setAppBadgeCount(devUnread);
    if (devUnread === 0) clearWebNotifications();
  }, [devUnread]);

  const tabs = (
    <Tabs
      tabBar={isDesktop ? () => null : (props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="history" options={{ title: t('tabs.history') }} />
      <Tabs.Screen name="affiliation" options={{ title: t('account.referral', 'Parrainage') }} />
      <Tabs.Screen name="support" options={{ title: t('tabs.support') }} />
      {/* Onglet Dev : présent pour tous en tant que route, masqué de la barre pour
          les non-admins (href:null) et filtré dans la CustomTabBar. */}
      <Tabs.Screen name="dev" options={{ title: t('dev.menuTitle'), href: isSuperAdmin ? undefined : null }} />
    </Tabs>
  );

  if (!isDesktop) return tabs;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <DesktopHeader />
      <View style={{ flex: 1 }}>{tabs}</View>
      <DesktopFooter />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    paddingTop: Spacing.sm,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    minHeight: 48,
  },
  label: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    lineHeight: 14,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -10,
    minWidth: 17,
    height: 17,
    borderRadius: 9,
    paddingHorizontal: 4,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeTxt: {
    color: '#fff',
    fontSize: 9,
    fontFamily: Fonts.bold,
    lineHeight: 11,
  },
});
