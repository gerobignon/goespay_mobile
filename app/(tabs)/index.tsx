import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Image,
  ImageBackground,
  Modal,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { useAuthStore } from '../../src/stores/authStore';
import { useWalletStore } from '../../src/stores/walletStore';
import { usePinStore } from '../../src/stores/pinStore';
import { authService } from '../../src/services/authService';
import { showAlert } from '../../src/stores/alertStore';
import { CustomAlert } from '../../src/components/CustomAlert';
import { KycBanner } from '../../src/components/KycBanner';
import { formatAmount } from '../../src/utils/format';
import { useFormatXof, useCurrencyCode } from '../../src/utils/format';
import {
  Colors,
  DarkColors,
  type ColorPalette,
  Spacing,
  FontSize,
  BorderRadius,
  Fonts,
} from '../../src/constants/theme';
import { API_BASE_URL, COUNTRIES } from '../../src/constants/config';
import { DepositModal } from '../../src/components/DepositModal';
import { TransferModal } from '../../src/components/TransferModal';
import { CryptoModal } from '../../src/components/CryptoModal';
import { TransactionItem } from '../../src/components/TransactionItem';
import { TransactionDetailModal, type TxType } from '../../src/components/TransactionDetailModal';
import { useCryptoStore } from '../../src/stores/cryptoStore';
import { useConfigStore } from '../../src/stores/configStore';
import { useResponsive } from '../../src/hooks/useResponsive';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useTheme } from '../../src/components/ThemeProvider';
import { useTranslation } from 'react-i18next';

export default function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const { balance, fetchBalance, isLoadingBalance, transactions, fetchTransactions, loadCachedData } = useWalletStore();
  const fmtXof = useFormatXof();
  const currencyCode = useCurrencyCode();
  const [refreshing, setRefreshing] = useState(false);
  const [depositVisible, setDepositVisible] = useState(false);
  const [transferVisible, setTransferVisible] = useState(false);
  const [cryptoVisible, setCryptoVisible] = useState(false);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [modalTxId, setModalTxId] = useState<number | null>(null);
  const [modalTxType, setModalTxType] = useState<TxType | null>(null);

  const { logout } = useAuthStore();
  const { deposit_enabled, transfer_enabled, crypto_buy_enabled, crypto_sell_enabled, fetchConfig } = useConfigStore();
  const isAdmin = user?.group === 'admin';
  const isSupportedCountry = COUNTRIES.some((c) => c.code === user?.country);
  const isCryptoUser = isAdmin || user?.group === 'crypto' || isSupportedCountry;
  // L'admin voit tous les services même désactivés (un bandeau s'affiche dans le modal concerné).
  const showDeposit = isAdmin || deposit_enabled;
  const showTransfer = isAdmin || transfer_enabled;
  const showCrypto = isAdmin || (isCryptoUser && crypto_buy_enabled);
  const isValidated = user?.validate === 1;
  const prefetchRates = useCryptoStore((s) => s.fetchRates);
  const { isWide, isDesktop, contentMaxWidth } = useResponsive();
  const { isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  const handleTxPress = (tx: any) => {
    const type = tx.type as TxType;
    if (isDesktop) {
      setModalTxId(tx.id);
      setModalTxType(type);
      return;
    }
    router.push(`/transaction/${type === 'deposit' ? 'deposit' : type === 'transfer' ? 'transfer' : type === 'crypto' ? 'crypto' : 'withdraw'}/${tx.id}`);
  };

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

  const allMenuItems = [
    { key: 'profile', label: t('account.personalInfo'), icon: 'user-pen', route: '/account/profile' as const },
    { key: 'security', label: t('account.security'), icon: 'shield-halved', route: '/account/security' as const },
    { key: 'phones', label: t('account.savedPhones'), icon: 'address-book', route: '/account/phones' as const },
    { key: 'wallets', label: t('account.savedWallets'), icon: 'wallet', route: '/account/wallets' as const, cryptoOnly: true },
    { key: 'settings', label: t('account.appearance'), icon: 'gear', route: '/account/settings' as const },
  ];

  const menuItems = allMenuItems.filter((item) => !(item.cryptoOnly && !isCryptoUser));

  useFocusEffect(
    useCallback(() => {
      loadCachedData();
      refreshProfile();
      fetchBalance();
      fetchTransactions(1);
      fetchConfig();
      if (isCryptoUser) prefetchRates();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), fetchBalance(), fetchTransactions(1), fetchConfig()]);
    setRefreshing(false);
  };

  const avatarSource = user?.avatar
    ? { uri: user.avatar.startsWith('http') ? user.avatar : `${API_BASE_URL.replace('/api/mobile/v1', '')}${user.avatar}` }
    : require('../../assets/avatar.png');

  return (
    <ScreenBackground edges={['top']}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          isWide && { alignSelf: 'center', width: '100%', maxWidth: contentMaxWidth, paddingHorizontal: Spacing.xl, paddingTop: Spacing.xxl },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.secondary}
          />
        }
      >
        {/* Header - hidden on desktop (shown in DesktopHeader) */}
        {!isWide && (
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Image source={require('../../assets/picto.png')} style={styles.headerLogo} />
              <View>
                <Text style={styles.greeting}>
                  {t('home.greeting', { name: user?.name || 'Utilisateur' })}
                </Text>
                <Text style={styles.subGreeting}>{t('home.welcome')}</Text>
              </View>
            </View>
            <TouchableOpacity onPress={() => setDropdownVisible(true)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <View style={styles.avatarWrap}>
                <Image source={avatarSource} style={styles.avatar} />
                <View style={styles.avatarBadge}>
                  <FontAwesome6 name="chevron-down" size={9} color={Colors.background} />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* KYC Banner */}
        {user?.validate !== 1 && (
          <KycBanner
            status={user?.validate as 0 | 2}
            onPress={user?.validate === 0 ? () => router.push('/kyc') : undefined}
          />
        )}

        {isWide ? (
          <View style={styles.wideRow}>
            {/* Left column: balance + services */}
            <View style={styles.wideColLeft}>
              <ImageBackground
                source={require('../../assets/bg_page.jpg')}
                style={styles.balanceCard}
                imageStyle={styles.balanceCardImage}
              >
                <View style={styles.balanceOverlay}>
                  <Text style={styles.balanceLabel}>{ t('home.balance') }</Text>
                  <Text style={styles.balanceAmount}>{fmtXof(balance, { withCode: false })}</Text>
                  <Text style={styles.currency}>{currencyCode}</Text>
                  <View style={styles.balanceActions}>
                    {showDeposit && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: DarkColors.secondary }, !isValidated && { opacity: 0.4 }]}
                      onPress={() => isValidated && setDepositVisible(true)}
                    >
                      <FontAwesome6 name="plus" size={16} color={Colors.white} />
                      <Text style={styles.actionLabel}>{ t('home.deposit') }</Text>
                    </TouchableOpacity>
                    )}
                    {showTransfer && (
                    <TouchableOpacity
                      style={[styles.actionBtn, { backgroundColor: Colors.primary }, !isValidated && { opacity: 0.4 }]}
                      onPress={() => isValidated && setTransferVisible(true)}
                    >
                      <FontAwesome6 name="paper-plane" size={16} color={Colors.white} />
                      <Text style={styles.actionLabel}>{ t('home.transfer') }</Text>
                    </TouchableOpacity>
                    )}
                  </View>
                </View>
              </ImageBackground>

              <Text style={styles.sectionTitle}>{ t('home.quickActions', 'Services') }</Text>
              <View style={styles.quickActions}>
                {showDeposit && (
                <TouchableOpacity style={styles.quickBtn} onPress={() => setDepositVisible(true)}>
                  <View style={[styles.quickIcon, { backgroundColor: Colors.success + '45' }]}>
                    <FontAwesome6 name="arrow-down" size={20} color={Colors.success} />
                  </View>
                  <Text style={styles.quickLabel}>{ t('home.deposit') }</Text>
                </TouchableOpacity>
                )}
                {showTransfer && (
                <TouchableOpacity style={styles.quickBtn} onPress={() => setTransferVisible(true)}>
                  <View style={[styles.quickIcon, { backgroundColor: Colors.primary + '45' }]}>
                    <FontAwesome6 name="paper-plane" size={20} color={Colors.primary} />
                  </View>
                  <Text style={styles.quickLabel}>{ t('home.transfer') }</Text>
                </TouchableOpacity>
                )}
                {showCrypto && (
                  <TouchableOpacity style={styles.quickBtn} onPress={() => setCryptoVisible(true)}>
                    <View style={[styles.quickIcon, { backgroundColor: Colors.warning + '45' }]}>
                      <FontAwesome6 name="bitcoin-sign" size={20} color={Colors.warning} />
                    </View>
                    <Text style={styles.quickLabel}>{ t('home.crypto') }</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/(tabs)/history')}>
                  <View style={[styles.quickIcon, { backgroundColor: DarkColors.secondary + '45' }]}>
                    <FontAwesome6 name="clock-rotate-left" size={20} color={Colors.secondary} />
                  </View>
                  <Text style={styles.quickLabel}>{ t('history.title') }</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Right column: recent transactions */}
            <View style={styles.wideColRight}>
              <View style={styles.recentHeader}>
                <Text style={styles.sectionTitle}>{ t('home.recentTransactions') }</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
                  <Text style={styles.seeAll}>{ t('common.seeAll') }</Text>
                </TouchableOpacity>
              </View>
              {transactions.length > 0 ? (
                transactions.slice(0, 10).map((tx) => (
                  <TransactionItem
                    key={tx.id}
                    transaction={tx}
                    onPress={() => handleTxPress(tx)}
                  />
                ))
              ) : (
                <View style={styles.emptyRecent}>
                  <FontAwesome6 name="receipt" size={32} color={Colors.textMuted} />
                  <Text style={styles.emptyText}>{ t('home.noTransactions') }</Text>
                </View>
              )}
            </View>
          </View>
        ) : (
          <>
            {/* Mobile: single column layout */}
            <ImageBackground
              source={require('../../assets/bg_page.jpg')}
              style={styles.balanceCard}
              imageStyle={styles.balanceCardImage}
            >
              <View style={styles.balanceOverlay}>
                <Text style={styles.balanceLabel}>{ t('home.balance') }</Text>
                <Text style={styles.balanceAmount}>{fmtXof(balance, { withCode: false })}</Text>
                <Text style={styles.currency}>{currencyCode}</Text>
                <View style={styles.balanceActions}>
                  {showDeposit && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: DarkColors.secondary }, !isValidated && { opacity: 0.4 }]}
                    onPress={() => isValidated && setDepositVisible(true)}
                  >
                    <FontAwesome6 name="plus" size={16} color={Colors.white} />
                    <Text style={styles.actionLabel}>{ t('home.deposit') }</Text>
                  </TouchableOpacity>
                  )}
                  {showTransfer && (
                  <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: Colors.primary }, !isValidated && { opacity: 0.4 }]}
                    onPress={() => isValidated && setTransferVisible(true)}
                  >
                    <FontAwesome6 name="paper-plane" size={16} color={Colors.white} />
                    <Text style={styles.actionLabel}>{ t('home.transfer') }</Text>
                  </TouchableOpacity>
                  )}
                </View>
              </View>
            </ImageBackground>

            <Text style={styles.sectionTitle}>{ t('home.quickActions', 'Services') }</Text>
            <View style={styles.quickActions}>
              {showDeposit && (
              <TouchableOpacity style={styles.quickBtn} onPress={() => setDepositVisible(true)}>
                <View style={[styles.quickIcon, { backgroundColor: Colors.success + '45' }]}>
                  <FontAwesome6 name="arrow-down" size={20} color={Colors.success} />
                </View>
                <Text style={styles.quickLabel}>{ t('home.deposit') }</Text>
              </TouchableOpacity>
              )}
              {showTransfer && (
              <TouchableOpacity style={styles.quickBtn} onPress={() => setTransferVisible(true)}>
                <View style={[styles.quickIcon, { backgroundColor: Colors.primary + '45' }]}>
                  <FontAwesome6 name="paper-plane" size={20} color={Colors.primary} />
                </View>
                <Text style={styles.quickLabel}>{ t('home.transfer') }</Text>
              </TouchableOpacity>
              )}
              {showCrypto && (
                <TouchableOpacity style={styles.quickBtn} onPress={() => setCryptoVisible(true)}>
                  <View style={[styles.quickIcon, { backgroundColor: Colors.warning + '45' }]}>
                    <FontAwesome6 name="bitcoin-sign" size={20} color={Colors.warning} />
                  </View>
                  <Text style={styles.quickLabel}>{ t('home.crypto') }</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.quickBtn} onPress={() => router.push('/(tabs)/history')}>
                <View style={[styles.quickIcon, { backgroundColor: DarkColors.secondary + '45' }]}>
                  <FontAwesome6 name="clock-rotate-left" size={20} color={Colors.secondary} />
                </View>
                <Text style={styles.quickLabel}>{ t('history.title') }</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.recentHeader}>
              <Text style={styles.sectionTitle}>{ t('home.recentTransactions') }</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
                <Text style={styles.seeAll}>{ t('common.seeAll') }</Text>
              </TouchableOpacity>
            </View>
            {transactions.length > 0 ? (
              transactions.slice(0, 5).map((tx) => (
                <TransactionItem
                  key={tx.id}
                  transaction={tx}
                  onPress={() => handleTxPress(tx)}
                />
              ))
            ) : (
              <View style={styles.emptyRecent}>
                <FontAwesome6 name="receipt" size={32} color={Colors.textMuted} />
                <Text style={styles.emptyText}>{ t('home.noTransactions') }</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>

      {showDeposit && (
      <DepositModal
        visible={depositVisible}
        onClose={() => setDepositVisible(false)}
      />
      )}
      {showTransfer && (
      <TransferModal
        visible={transferVisible}
        onClose={() => setTransferVisible(false)}
      />
      )}
      {showCrypto && (
        <CryptoModal
          visible={cryptoVisible}
          onClose={() => setCryptoVisible(false)}
          buyEnabled={crypto_buy_enabled}
          sellEnabled={crypto_sell_enabled}
        />
      )}

      {/* Dropdown avatar menu */}
      <Modal
        visible={dropdownVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDropdownVisible(false)}
      >
        <TouchableOpacity
          style={styles.dropdownOverlay}
          activeOpacity={1}
          onPress={() => setDropdownVisible(false)}
        >
          <View style={styles.dropdownMenu}>
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => { setDropdownVisible(false); handleAvatarPick(); }}
            >
              <FontAwesome6 name="camera" size={14} color={Colors.secondary} />
              <Text style={styles.dropdownLabel}>{t('account.changePhoto', 'Changer la photo')}</Text>
            </TouchableOpacity>
            <View style={styles.dropdownDivider} />
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.key}
                style={styles.dropdownItem}
                onPress={() => { setDropdownVisible(false); router.push(item.route); }}
              >
                <FontAwesome6 name={item.icon} size={14} color={Colors.secondary} />
                <Text style={styles.dropdownLabel}>{item.label}</Text>
              </TouchableOpacity>
            ))}
            <View style={styles.dropdownDivider} />
            <TouchableOpacity
              style={styles.dropdownItem}
              onPress={() => { setDropdownVisible(false); handleLogout(); }}
            >
              <FontAwesome6 name="right-from-bracket" size={14} color={Colors.error} />
              <Text style={[styles.dropdownLabel, { color: Colors.error }]}>{t('account.logout')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <TransactionDetailModal
        txId={modalTxId}
        txType={modalTxType}
        onClose={() => { setModalTxId(null); setModalTxType(null); }}
      />

      <CustomAlert />
    </ScreenBackground>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerLogo: {
    width: 36,
    height: 36,
    resizeMode: 'contain',
  },
  greeting: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  subGreeting: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginTop: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.inputBg,
  },
  avatarWrap: {
    width: 44,
    height: 44,
    position: 'relative',
  },
  avatarBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.secondary,
    borderWidth: 2,
    borderColor: Colors.background,
  },
  balanceCard: {
    borderRadius: BorderRadius.xl,
    overflow: 'hidden',
    marginBottom: Spacing.xl,
  },
  balanceCardImage: {
    borderRadius: BorderRadius.xl,
  },
  balanceOverlay: {
    backgroundColor: 'rgba(23,30,43,0)',
    padding: Spacing.xl,
    alignItems: 'center',
  },
  balanceLabel: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.7)',
    marginBottom: Spacing.xs,
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  balanceAmount: {
    fontSize: FontSize.hero,
    fontFamily: Fonts.bold,
    color: DarkColors.secondary,
    textAlign: 'center',
  },
  currency: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'center',
    letterSpacing: 2,
  },
  balanceActions: {
    flexDirection: 'row',
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm + 4,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  actionLabel: {
    color: Colors.white,
    fontFamily: Fonts.bold,
    fontSize: FontSize.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.xl,
  },
  quickBtn: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: DarkColors.card,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  quickLabel: {
    fontSize: FontSize.xs,
    color: DarkColors.textSecondary,
    fontFamily: Fonts.semiBold,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  seeAll: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    marginBottom: Spacing.md,
  },
  emptyRecent: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
  },
  wideRow: {
    flexDirection: 'row',
    gap: Spacing.xl,
  },
  wideColLeft: {
    flex: 2,
    maxWidth: 420,
  },
  wideColRight: {
    flex: 3,
    minWidth: 320,
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
