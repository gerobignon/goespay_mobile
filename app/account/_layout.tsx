import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, ImageBackground } from 'react-native';
import { Stack, Slot, useRouter, useSegments } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { useResponsive } from '../../src/hooks/useResponsive';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useTheme } from '../../src/components/ThemeProvider';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../src/stores/authStore';
import { usePinStore } from '../../src/stores/pinStore';
import { showAlert } from '../../src/stores/alertStore';
import { authService } from '../../src/services/authService';
import { CustomAlert } from '../../src/components/CustomAlert';
import { DesktopHeader } from '../../src/components/DesktopHeader';
import { DesktopFooter } from '../../src/components/DesktopFooter';
import { Button } from '../../src/components/Button';
import { Colors, DarkColors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../../src/constants/theme';
import { API_BASE_URL } from '../../src/constants/config';

export default function AccountLayout() {
  const { isDesktop } = useResponsive();

  if (!isDesktop) {
    return <Stack screenOptions={{ headerShown: false }} />;
  }

  return <DesktopAccountLayout />;
}

function DesktopAccountLayout() {
  const router = useRouter();
  const segments = useSegments();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();

  const activeKey = segments[segments.length - 1] || 'index';

  const handleAvatarPick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
    if (!result.canceled && result.assets[0]) {
      try {
        const result2 = await authService.uploadAvatar(result.assets[0].uri);
        const currentUser = useAuthStore.getState().user;
        if (currentUser) useAuthStore.setState({ user: { ...currentUser, avatar: result2.avatar } });
      } catch {
        showAlert(t('common.error'), t('account.avatarError', 'Impossible de mettre à jour la photo.'));
      }
    }
  };

  const avatarSource = user?.avatar
    ? { uri: user.avatar.startsWith('http') ? user.avatar : `${API_BASE_URL.replace('/api/mobile/v1', '')}${user.avatar}` }
    : null;

  const isCryptoUser = user?.group === 'admin' || user?.group === 'crypto';
  
  const allMenuItems = [
    { key: 'profile', label: t('account.personalInfo'), icon: 'user-pen', route: '/account/profile' as const },
    { key: 'security', label: t('account.security'), icon: 'shield-halved', route: '/account/security' as const },
    { key: 'phones', label: t('account.savedPhones'), icon: 'address-book', route: '/account/phones' as const },
    { key: 'wallets', label: t('account.savedWallets'), icon: 'wallet', route: '/account/wallets' as const, cryptoOnly: true },
    { key: 'affiliation', label: t('account.referral', 'Parrainage'), icon: 'users', route: '/account/affiliation' as const },
    { key: 'settings', label: t('account.appearance'), icon: 'gear', route: '/account/settings' as const },
  ];

  const menuItems = allMenuItems.filter((item) => !(item.cryptoOnly && !isCryptoUser));

  const handleLogout = () => {
    showAlert(t('account.logoutTitle'), t('account.logoutMessage'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('account.logoutConfirm'), style: 'destructive', onPress: async () => {
          await logout();
          usePinStore.setState({ lockMethod: null, isSetupDone: false, isLocked: false });
        }
      },
    ]);
  };

  return (
    <View style={{ flex: 1 }}>
      <DesktopHeader />
      <ImageBackground
        source={isDark ? require('../../assets/bg_page.jpg') : require('../../assets/bg_page_light.jpg')}
        style={styles.background}
      >
        <View style={styles.desktopContainer}>
          {/* Sidebar */}
          <View style={styles.sidebar}>
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Avatar */}
              <View style={styles.avatarSection}>
                <TouchableOpacity onPress={handleAvatarPick} activeOpacity={0.85} style={styles.avatarWrapper}>
                  {avatarSource ? (
                    <Image source={avatarSource} style={styles.avatarImg} />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <FontAwesome6 name="user" size={36} color={Colors.textMuted} />
                    </View>
                  )}
                  <View style={styles.avatarBadge}>
                    <FontAwesome6 name="pen" size={10} color={Colors.white} />
                  </View>
                </TouchableOpacity>
                <Text style={styles.userName}>{user?.surname} {user?.name}</Text>
                <Text style={styles.userEmail}>{user?.email}</Text>
              </View>

              {user?.validate === 1 && (
                <View style={styles.verifiedBadge}>
                  <FontAwesome6 name="circle-check" size={14} color={Colors.success} />
                  <Text style={styles.verifiedText}>{t('account.verified')}</Text>
                </View>
              )}

              {user?.validate === 0 && (
                <Button
                  title={t('account.verifyKyc')}
                  icon="id-card"
                  variant="secondary"
                  onPress={() => router.push('/kyc')}
                  style={{ marginBottom: Spacing.md, backgroundColor: DarkColors.secondary }}
                />
              )}

              {/* Menu */}
              <View style={styles.menuList}>
                {menuItems.map((item) => {
                  const isActive = activeKey === item.key;
                  return (
                    <TouchableOpacity
                      key={item.key}
                      style={[styles.menuRow, isActive && styles.menuRowActive]}
                      onPress={() => router.push(item.route)}
                      activeOpacity={0.7}
                    >
                      <View style={[styles.menuIcon, isActive && { backgroundColor: Colors.primary + '22' }]}>
                        <FontAwesome6 name={item.icon} size={14} color={isActive ? Colors.primary : Colors.textMuted} />
                      </View>
                      <Text style={[styles.menuLabel, isActive && { color: Colors.primary }]}>{item.label}</Text>
                    </TouchableOpacity>
                  );
                })}

                <TouchableOpacity style={styles.menuRow} onPress={handleLogout} activeOpacity={0.7}>
                  <View style={[styles.menuIcon, { backgroundColor: Colors.error + '22' }]}>
                    <FontAwesome6 name="right-from-bracket" size={14} color={Colors.error} />
                  </View>
                  <Text style={[styles.menuLabel, { color: Colors.error }]}>{t('account.logout')}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Slot />
          </View>
        </View>

        <CustomAlert />
      </ImageBackground>
      <DesktopFooter />
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  background: { flex: 1 },
  desktopContainer: {
    flex: 1,
    flexDirection: 'row',
    maxWidth: 1100,
    width: '100%',
    alignSelf: 'center',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xl,
  },
  sidebar: {
    width: 280,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    padding: Spacing.lg,
    alignSelf: 'flex-start',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  avatarWrapper: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginBottom: Spacing.sm,
  },
  avatarImg: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: Colors.secondary,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  userName: {
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
    color: Colors.text,
    textAlign: 'center',
  },
  userEmail: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(97,146,97,0.15)',
    borderRadius: BorderRadius.sm,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(97,146,97,0.3)',
  },
  verifiedText: {
    color: Colors.success,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
  },
  menuList: {
    marginTop: Spacing.sm,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    gap: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginBottom: 2,
  },
  menuRowActive: {
    backgroundColor: Colors.primary + '11',
  },
  menuIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  content: {
    flex: 1,
  },
});
