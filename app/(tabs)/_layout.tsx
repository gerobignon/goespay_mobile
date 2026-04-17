import { Tabs } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { View, Platform } from 'react-native';
import { DarkColors, FontSize, Fonts } from '../../src/constants/theme';
import { useColors } from '../../src/components/ThemeProvider';
import { useResponsive } from '../../src/hooks/useResponsive';
import { DesktopHeader } from '../../src/components/DesktopHeader';
import { DesktopFooter } from '../../src/components/DesktopFooter';
import { useTranslation } from 'react-i18next';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { isDesktop } = useResponsive();
  const colors = useColors();
  const { t } = useTranslation();

  const tabs = (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: isDesktop
          ? { display: 'none' }
          : {
              // Mobile / Tablet: bottom tabs
              backgroundColor: DarkColors.background,
              borderTopColor: DarkColors.border,
              borderTopWidth: 1,
              height: 60 + insets.bottom,
              paddingBottom: insets.bottom > 0 ? insets.bottom : 6,
              paddingTop: 8,
            },
        tabBarActiveTintColor: DarkColors.secondary,
        tabBarInactiveTintColor: DarkColors.textMuted,
        tabBarLabelStyle: {
          fontSize: FontSize.xs,
          fontFamily: Fonts.semiBold,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.home'),
          tabBarIcon: ({ color, size }) => (
            <FontAwesome6 name="house" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: t('tabs.history'),
          tabBarIcon: ({ color, size }) => (
            <FontAwesome6 name="clock-rotate-left" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="support"
        options={{
          title: t('tabs.support'),
          tabBarIcon: ({ color, size }) => (
            <FontAwesome6 name="headset" size={size} color={color} />
          ),
        }}
      />
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
