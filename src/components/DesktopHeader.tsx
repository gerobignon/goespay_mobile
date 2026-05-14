import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet, ImageBackground } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../stores/authStore';
import { Colors, DarkColors, type ColorPalette, Spacing, FontSize, Fonts, BorderRadius } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { API_BASE_URL } from '../constants/config';
import { useTranslation } from 'react-i18next';

const bgPage = require('../../assets/bg_page.jpg');

const NAV_ITEMS = [
  { path: '/(tabs)', labelKey: 'tabs.home', icon: 'house' },
  { path: '/(tabs)/history', labelKey: 'tabs.history', icon: 'clock-rotate-left' },
  { path: '/(tabs)/affiliation', labelKey: 'account.referral', icon: 'users' },
  { path: '/(tabs)/support', labelKey: 'tabs.support', icon: 'headset' },
];

export function DesktopHeader() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  const avatarSource = user?.avatar
    ? { uri: user.avatar.startsWith('http') ? user.avatar : `${API_BASE_URL.replace('/api/mobile/v1', '')}${user.avatar}` }
    : require('../../assets/avatar.png');

  const isActive = (path: string) => {
    if (path === '/(tabs)') return pathname === '/' || pathname === '/index';
    return pathname === path.replace('/(tabs)', '');
  };

  return (
    <ImageBackground source={bgPage} style={[styles.header, { paddingTop: insets.top + Spacing.xl }]} imageStyle={styles.bgImage}>
      <View style={styles.inner}>
        {/* Logo */}
        <TouchableOpacity onPress={() => router.push('/(tabs)')} style={styles.logoWrap}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} />
          <Text style={styles.brand}>GoesPay</Text>
        </TouchableOpacity>

        {/* Navigation */}
        <View style={styles.nav}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            return (
              <TouchableOpacity
                key={item.path}
                style={[styles.navItem, active && styles.navItemActive]}
                onPress={() => router.push(item.path as any)}
                activeOpacity={0.7}
              >
                <FontAwesome6
                  name={item.icon}
                  size={16}
                  color={active ? Colors.secondary : 'rgba(255,255,255,0.55)'}
                />
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                  {t(item.labelKey)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* User avatar */}
        <TouchableOpacity onPress={() => router.push('/account')} style={styles.avatarWrap}>
          <Text style={styles.userName}>{user?.name || ''}</Text>
          <Image source={avatarSource} style={styles.avatar} />
        </TouchableOpacity>
      </View>
    </ImageBackground>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  header: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    paddingVertical: Spacing.xl,
    overflow: 'hidden',
  },
  bgImage: {
    resizeMode: 'cover',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    height: 64,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  logoWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  logo: {
    width: 160,
    height: 50,
    resizeMode: 'contain',
  },
  brand: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.secondary,
    display: 'none',
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  navItemActive: {
    backgroundColor: Colors.secondary + '18',
  },
  navLabel: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.65)',
  },
  navLabelActive: {
    color: Colors.secondary,
  },
  avatarWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  userName: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: '#fff',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.inputBg,
  },
});
