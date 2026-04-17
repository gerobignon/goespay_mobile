import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { Button } from '../../src/components/Button';
import { Colors, DarkColors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../../src/constants/theme';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { API_BASE_URL } from '../../src/constants/config';
import { CustomAlert } from '../../src/components/CustomAlert';
import { DesktopHeader } from '../../src/components/DesktopHeader';
import { DesktopFooter } from '../../src/components/DesktopFooter';
import { useResponsive } from '../../src/hooks/useResponsive';
import { useTheme } from '../../src/components/ThemeProvider';
import { useTranslation } from 'react-i18next';

export default function AccountScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { isWide, isDesktop, contentMaxWidth } = useResponsive();
  const { user } = useAuthStore();
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const avatarSource = user?.avatar
    ? { uri: user.avatar.startsWith('http') ? user.avatar : `${API_BASE_URL.replace('/api/mobile/v1', '')}${user.avatar}` }
    : null;

  const menuItems = [
    { key: 'profile', label: t('account.personalInfo'), icon: 'user-pen', route: '/account/profile' as const },
    { key: 'security', label: t('account.security'), icon: 'shield-halved', route: '/account/security' as const },
    { key: 'phones', label: t('account.savedPhones'), icon: 'address-book', route: '/account/phones' as const },
    { key: 'wallets', label: t('account.savedWallets'), icon: 'wallet', route: '/account/wallets' as const },
    { key: 'settings', label: t('account.appearance'), icon: 'gear', route: '/account/settings' as const },
  ];

  return (
    <View style={{ flex: 1 }}>
      {isDesktop && <DesktopHeader />}
      <ImageBackground
        source={isDark ? require('../../assets/bg_page.jpg') : require('../../assets/bg_page_light.jpg')}
        style={styles.background}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <ScrollView
            contentContainerStyle={[
              styles.scroll,
              isWide && { alignSelf: 'center', width: '100%', maxWidth: contentMaxWidth },
            ]}
          >
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()}>
                <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.title}>{t('account.title')}</Text>
            </View>

            {/* Avatar section */}
            <View style={styles.avatarSection}>
              <TouchableOpacity
                style={styles.avatarWrapper}
                onPress={() => router.push('/account/profile')}
                activeOpacity={0.85}
              >
                {avatarSource ? (
                  <Image source={avatarSource} style={styles.avatarImg} />
                ) : (
                  <View style={styles.avatarPlaceholder}>
                    <FontAwesome6 name="user" size={32} color={Colors.textMuted} />
                  </View>
                )}
                <View style={styles.avatarBadge}>
                  <FontAwesome6 name="ellipsis" size={10} color={Colors.white} />
                </View>
              </TouchableOpacity>
              <Text style={styles.userName}>
                {user?.surname} {user?.name}
              </Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>

            {/* Verified badge */}
            {user?.validate === 1 && (
              <View style={styles.verifiedBadge}>
                <FontAwesome6 name="circle-check" size={16} color={Colors.success} />
                <Text style={styles.verifiedText}>{t('account.verified')}</Text>
              </View>
            )}

            {/* KYC button */}
            {user?.validate === 0 && (
              <Button
                title={t('account.verifyKyc')}
                icon="id-card"
                variant="secondary"
                onPress={() => router.push('/kyc')}
                style={{ marginBottom: Spacing.lg, backgroundColor: DarkColors.secondary }}
              />
            )}

            {/* Menu cards */}
            <View style={styles.menuList}>
              {menuItems.map((item) => (
                <TouchableOpacity
                  key={item.key}
                  style={styles.menuRow}
                  onPress={() => router.push(item.route)}
                  activeOpacity={0.7}
                >
                  <View style={styles.menuIcon}>
                    <FontAwesome6 name={item.icon} size={16} color={Colors.secondary} />
                  </View>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <FontAwesome6 name="chevron-right" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              ))}

              {/* Logout */}
              <TouchableOpacity
                style={styles.menuRow}
                onPress={handleLogout}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIcon, { backgroundColor: Colors.error + '22' }]}>
                  <FontAwesome6 name="right-from-bracket" size={16} color={Colors.error} />
                </View>
                <Text style={[styles.menuLabel, { color: Colors.error }]}>{t('account.logout')}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>

        <CustomAlert />
      </ImageBackground>
      {isDesktop && <DesktopFooter />}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  background: { flex: 1 },
  scroll: {
    flexGrow: 1,
    padding: Spacing.lg,
    paddingTop: Spacing.xxl + Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatarWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: Spacing.sm,
  },
  avatarImg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: Colors.secondary,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
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
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  userEmail: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(97,146,97,0.15)',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(97,146,97,0.3)',
  },
  verifiedText: {
    color: Colors.success,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
  },
  menuList: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    overflow: 'hidden',
    marginTop: Spacing.md,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  dropdownOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  dropdownMenu: {
    backgroundColor: Colors.cardSolid,
    borderRadius: BorderRadius.lg,
    width: '100%',
    maxWidth: 320,
    overflow: 'hidden',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  dropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  dropdownLabel: {
    fontSize: FontSize.md,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  dropdownDivider: {
    height: 1,
    backgroundColor: Colors.border,
  },
});
