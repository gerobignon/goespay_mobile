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
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../../src/stores/authStore';
import { useConfigStore } from '../../src/stores/configStore';
import { usePinStore } from '../../src/stores/pinStore';
import { authService } from '../../src/services/authService';
import { Button } from '../../src/components/Button';
import { Colors, DarkColors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../../src/constants/theme';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { API_BASE_URL } from '../../src/constants/config';
import { getAccountMenuItems } from '../../src/constants/accountMenu';
import { CustomAlert } from '../../src/components/CustomAlert';
import { showAlert } from '../../src/stores/alertStore';
import { DesktopHeader } from '../../src/components/DesktopHeader';
import { DesktopFooter } from '../../src/components/DesktopFooter';
import { useResponsive } from '../../src/hooks/useResponsive';
import { useTheme } from '../../src/components/ThemeProvider';
import VerifiedBadge from '../../src/components/VerifiedBadge';
import { Reveal, Bounce } from '../../src/components/anim';
import { useTranslation } from 'react-i18next';

export default function AccountScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { isWide, isDesktop, contentMaxWidth } = useResponsive();
  const { user, logout } = useAuthStore();
  const { isDark } = useTheme();
  const { t } = useTranslation();

  // Sur desktop, la sidebar est dans le layout — rediriger vers profil
  React.useEffect(() => {
    if (isDesktop) router.replace('/account/profile');
  }, [isDesktop]);

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

  // Éligibilité crypto : groupe `crypto`/admin OU corridor crypto (NowPayments/
  // futur) actif en payin (vente) et/ou payout (achat) pour le pays — porté par
  // les flags /config crypto_*_enabled (cohérent avec l'accueil et l'historique).
  const cryptoBuyEnabled = useConfigStore((s) => s.crypto_buy_enabled);
  const cryptoSellEnabled = useConfigStore((s) => s.crypto_sell_enabled);
  const isCryptoUser = user?.group === 'admin' || user?.group === 'crypto' || cryptoBuyEnabled || cryptoSellEnabled;
  const menuItems = getAccountMenuItems(t, { isCryptoUser });

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
                onPress={handleAvatarPick}
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
                  <FontAwesome6 name="pen" size={10} color={Colors.white} />
                </View>
              </TouchableOpacity>
              <Text style={styles.userName}>
                {user?.surname} {user?.name}
              </Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>

            {/* Verified badge */}
            {user?.validate === 1 && (
              <VerifiedBadge style={{ marginBottom: Spacing.lg }} />
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
              {menuItems.map((item, i) => (
                <Reveal key={item.key} delay={i * 45} offset={10}>
                  <Bounce
                    style={styles.menuRow}
                    scaleTo={0.98}
                    onPress={() => router.push(item.route)}
                  >
                    <View style={styles.menuIcon}>
                      <FontAwesome6 name={item.icon} size={16} color={Colors.secondary} />
                    </View>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <FontAwesome6 name="chevron-right" size={14} color={Colors.textMuted} />
                  </Bounce>
                </Reveal>
              ))}

              {/* Logout */}
              <Reveal delay={menuItems.length * 45} offset={10}>
                <Bounce style={styles.menuRow} scaleTo={0.98} onPress={handleLogout}>
                  <View style={[styles.menuIcon, { backgroundColor: Colors.error + '22' }]}>
                    <FontAwesome6 name="right-from-bracket" size={16} color={Colors.error} />
                  </View>
                  <Text style={[styles.menuLabel, { color: Colors.error }]}>{t('account.logout')}</Text>
                </Bounce>
              </Reveal>
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
