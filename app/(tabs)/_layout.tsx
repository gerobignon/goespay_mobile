import { useEffect, useRef } from 'react';
import { Tabs } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Text, Pressable, StyleSheet, Animated } from 'react-native';
import { Spacing, FontSize, Fonts } from '../../src/constants/theme';
import { useColors } from '../../src/components/ThemeProvider';
import { useResponsive } from '../../src/hooks/useResponsive';
import { DesktopHeader } from '../../src/components/DesktopHeader';
import { DesktopFooter } from '../../src/components/DesktopFooter';
import { useTranslation } from 'react-i18next';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

const ICON_FOR_ROUTE: Record<string, string> = {
  index: 'house',
  history: 'clock-rotate-left',
  affiliation: 'users',
  support: 'headset',
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
  // Plafonné : en PWA standalone iOS, safe-area-context renvoie parfois un inset
  // bas gonflé → padding énorme sous la barre. On borne à [8, 20] : assez pour
  // dégager le home indicator, jamais démesuré.
  const bottomPad = Math.min(Math.max(insets.bottom, 8), 20);

  return (
    <View style={[styles.bar, { paddingBottom: bottomPad, backgroundColor: colors.background, borderTopColor: colors.border }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label = (options.title ?? route.name) as string;
        const isFocused = state.index === index;
        const color = isFocused ? colors.secondary : colors.textMuted;
        const iconName = ICON_FOR_ROUTE[route.name] ?? 'circle';

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
            <TabIcon name={iconName} color={color} focused={isFocused} />
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
});
