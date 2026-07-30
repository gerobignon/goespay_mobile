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
  Platform,
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
import { WelcomeBonusCard } from '../../src/components/WelcomeBonusCard';
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
import { API_BASE_URL } from '../../src/constants/config';
import { getAccountMenuItems } from '../../src/constants/accountMenu';
import { DepositModal } from '../../src/components/DepositModal';
import { TransferModal } from '../../src/components/TransferModal';
import type { SavedBank } from '../../src/services/walletService';
import { CryptoModal } from '../../src/components/CryptoModal';
import { TransactionItem } from '../../src/components/TransactionItem';
import { TransactionDetailModal, type TxType } from '../../src/components/TransactionDetailModal';
import {
  PromoCarousel,
  MonthlyInsights,
  RecentBeneficiaries,
  ReferralCard,
  type PromoSlide,
} from '../../src/components/home/HomeWidgets';
import { useCryptoStore } from '../../src/stores/cryptoStore';
import { useConfigStore } from '../../src/stores/configStore';
import { useCorridorStore } from '../../src/stores/corridorStore';
import { useCatalogStore } from '../../src/stores/catalogStore';
import { useResponsive } from '../../src/hooks/useResponsive';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useCountUpValue, Bounce } from '../../src/components/anim';
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
  // Crypto lancé depuis Dépôt (vente) ou Retrait (achat) : onglet forcé + crypto pré-sélectionnée.
  const [cryptoTab, setCryptoTab] = useState<'buy' | 'sell'>('sell');
  const [cryptoCurrency, setCryptoCurrency] = useState<string | undefined>(undefined);
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [modalTxId, setModalTxId] = useState<number | null>(null);
  const [modalTxType, setModalTxType] = useState<TxType | null>(null);
  const [transferPrefillPhone, setTransferPrefillPhone] = useState<string | undefined>(undefined);
  const [transferPrefillBank, setTransferPrefillBank] = useState<SavedBank | null>(null);
  // Hauteurs des 2 colonnes pour activer le sticky-top dynamique sur la
  // colonne la plus courte (web/desktop uniquement, en wide layout).
  const [leftColH, setLeftColH] = useState(0);
  const [rightColH, setRightColH] = useState(0);
  const stickyLeft  = Platform.OS === 'web' && leftColH > 0 && rightColH > 0 && leftColH < rightColH;
  const stickyRight = Platform.OS === 'web' && leftColH > 0 && rightColH > 0 && rightColH < leftColH;
  const stickyStyle = (active: boolean): any => active ? { position: 'sticky', top: 0, alignSelf: 'flex-start' } : undefined;

  const { logout } = useAuthStore();
  const { deposit_enabled, transfer_enabled, deposit_blocked, transfer_blocked, crypto_buy_enabled, crypto_sell_enabled, isLoaded: configLoaded, fetchConfig } = useConfigStore();
  const promoSlidesConfig = useConfigStore((s) => s.promo_slides);
  const fetchCorridors = useCorridorStore((s) => s.fetchCorridors);
  const fetchCatalog = useCatalogStore((s) => s.fetchCatalog);
  const isAdmin = user?.group === 'admin';
  // Éligibilité crypto : groupe `crypto` OU un corridor crypto (NowPayments ou
  // futur agrégateur crypto) actif en payin (vente) et/ou payout (achat) pour le
  // pays du user. Les flags /config crypto_*_enabled portent DÉJÀ cette logique
  // par pays (api_mobile.php → RoutingResolver::cryptoBuy/SellEnabledFor =
  // corridor nowpayments-<cc>). On ne dépend donc plus de la liste statique COUNTRIES.
  const isCryptoUser = isAdmin || user?.group === 'crypto' || crypto_buy_enabled || crypto_sell_enabled;
  // L'admin voit tous les services même désactivés (un bandeau s'affiche dans le modal concerné).
  // Conditions vérifiées AVANT rendu : tant que /config n'a pas répondu (isLoaded
  // false), on ne rend AUCUNE action (skeleton à la place). Évite le flash
  // « activé puis masqué » qu'un user rapide pourrait exploiter. L'admin voit tout
  // (un bandeau s'affiche dans le modal concerné). L'enforcement reste backend.
  const configReady = isAdmin || configLoaded;
  // Blocage ciblé de CE user : on GARDE le bouton visible (même si le flag enabled
  // est retombé à false) pour qu'il puisse ouvrir la modal et lire le motif +
  // message perso. L'enforcement reste backend.
  const showDeposit = isAdmin || (configLoaded && (deposit_enabled || deposit_blocked));
  const showTransfer = isAdmin || (configLoaded && (transfer_enabled || transfer_blocked));
  const showCrypto = isAdmin || (configLoaded && isCryptoUser && (crypto_buy_enabled || crypto_sell_enabled));
  // Ouvre le flux crypto avec l'action forcée, depuis Dépôt (vente) ou Retrait (achat).
  const openCrypto = (tab: 'buy' | 'sell', currency?: string) => {
    setCryptoTab(tab);
    setCryptoCurrency(currency);
    setDepositVisible(false);
    setTransferVisible(false);
    setTimeout(() => setCryptoVisible(true), 350);
  };
  const isValidated = user?.validate === 1;
  const { t } = useTranslation();

  // Slides du carrousel promo — pilotées depuis l'admin (/config → promo_slides).
  // Image = URL distante ({uri}), lien optionnel ouvert au tap. Carrousel masqué
  // si l'admin n'a configuré aucune slide.
  const promoSlides: PromoSlide[] = React.useMemo(
    () => (promoSlidesConfig || [])
      .filter((s) => !!s?.image)
      // Garde-fou : le backend renvoie parfois un port dupliqué (host:8000:8000)
      // qui rend l'URL invalide. On collapse `:port:port` → `:port`.
      .map((s, i) => ({
        id: `promo-${i}`,
        image: { uri: s.image.replace(/(:\d+):\d+/, '$1') },
        href: s.link || undefined,
      })),
    [promoSlidesConfig]
  );

  const onBenefPick = useCallback((tel: string) => {
    setTransferPrefillBank(null);
    setTransferPrefillPhone(tel);
    setTransferVisible(true);
  }, [isValidated]);
  const onBenefPickBank = useCallback((bank: SavedBank) => {
    setTransferPrefillPhone(undefined);
    setTransferPrefillBank(bank);
    setTransferVisible(true);
  }, [isValidated]);
  const onBenefAdd = useCallback((type: 'phone' | 'bank' | 'crypto') => {
    router.push(type === 'bank' ? '/account/bank-accounts' : type === 'crypto' ? '/account/wallets' : '/account/phones');
  }, [router]);
  const prefetchRates = useCryptoStore((s) => s.fetchRates);
  const { isWide, isDesktop, contentMaxWidth } = useResponsive();
  const { isDark } = useTheme();
  const styles = useThemedStyles(createStyles);
  // Solde affiché avec un compteur animé (interpole à chaque mise à jour).
  const animBalance = useCountUpValue(balance);

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

  const menuItems = getAccountMenuItems(t, { isCryptoUser, isSuperAdmin: user?.id === 1 });

  useFocusEffect(
    useCallback(() => {
      loadCachedData();
      refreshProfile();
      fetchBalance();
      fetchTransactions(1);
      fetchConfig();
      fetchCorridors();
      fetchCatalog();
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
            <TouchableOpacity onPress={() => setDropdownVisible(true)} style={styles.avatarWrap} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Image source={avatarSource} style={styles.avatar} />
              <View style={styles.avatarBadge}>
                <FontAwesome6 name="chevron-down" size={9} color={Colors.background} />
              </View>
            </TouchableOpacity>
          </View>
        )}

        {/* KYC Banner */}
        {user?.validate !== 1 && (
          <KycBanner
            status={user?.validate as 0 | 2}
            expired={user?.validate === 0 && !!user?.idexp_expired}
            bonus={user?.validate === 0 && !user?.idexp_expired}
            onPress={user?.validate === 0 ? () => router.push('/kyc') : undefined}
          />
        )}
        {/* KYC Expiring soon (validate=1 mais <=30j) */}
        {user?.validate === 1 && user?.idexp_warning && (
          <KycBanner
            status={0}
            expiringSoon
            daysLeft={user?.idexp_days_left ?? null}
            onPress={() => router.push('/kyc')}
          />
        )}

        {isWide ? (
          <View style={styles.wideRow}>
            {/* Left column: balance + services */}
            <View
              style={[styles.wideColLeft, stickyStyle(stickyLeft)]}
              onLayout={(e) => setLeftColH(Math.round(e.nativeEvent.layout.height))}
            >
              {/* Bonus de bienvenue KYC : carte au-dessus du solde (teaser / progression). */}
              <WelcomeBonusCard />

              <ImageBackground
                source={require('../../assets/bg_page.jpg')}
                style={styles.balanceCard}
                imageStyle={styles.balanceCardImage}
              >
                <View style={styles.balanceOverlay}>
                  {/* Bloc 1 : solde + boutons (padding latéral généreux) */}
                  <View style={styles.balanceTop}>
                    <Text style={styles.balanceLabel}>{ t('home.balance') }</Text>
                    <Text style={styles.balanceAmount}>{fmtXof(animBalance, { withCode: false, decimals: 2 })}</Text>
                    <Text style={styles.currency}>{currencyCode}</Text>
                    <View style={styles.balanceActions}>
                      {!configReady && (<><View style={[styles.actionBtn, styles.actionBtnSkeleton]} /><View style={[styles.actionBtn, styles.actionBtnSkeleton]} /></>)}
                      {showDeposit && (
                      <Bounce
                        style={[styles.actionBtn, { backgroundColor: DarkColors.secondary }]}
                        onPress={() => setDepositVisible(true)}
                      >
                        <FontAwesome6 name="plus" size={16} color={Colors.white} />
                        <Text style={styles.actionLabel}>{ t('home.deposit') }</Text>
                      </Bounce>
                      )}
                      {showTransfer && (
                      <Bounce
                        style={[styles.actionBtn, { backgroundColor: Colors.primary }]}
                        onPress={() => setTransferVisible(true)}
                      >
                        <FontAwesome6 name="paper-plane" size={16} color={Colors.white} />
                        <Text style={styles.actionLabel}>{ t('home.transfer') }</Text>
                      </Bounce>
                      )}
                    </View>
                  </View>
                  {/* Bloc 2 : insights (padding latéral léger, hérité de balanceOverlay) */}
                  <MonthlyInsights />
                </View>
              </ImageBackground>

              {/* Widgets en dessous : G + A + C + E. */}
              <PromoCarousel slides={promoSlides} />
              {showTransfer && <RecentBeneficiaries onPick={onBenefPick} onPickBank={onBenefPickBank} onAdd={onBenefAdd} allowCrypto={isCryptoUser} />}
              <ReferralCard />
            </View>

            {/* Right column: recent transactions */}
            <View
              style={[styles.wideColRight, stickyStyle(stickyRight)]}
              onLayout={(e) => setRightColH(Math.round(e.nativeEvent.layout.height))}
            >
              <View style={styles.recentHeader}>
                <Text style={styles.sectionTitle}>{ t('home.recentTransactions') }</Text>
                <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
                  <Text style={styles.seeAll}>{ t('common.seeAll') }</Text>
                </TouchableOpacity>
              </View>
              {transactions.length > 0 ? (
                transactions.slice(0, 10).map((tx, i) => (
                  <TransactionItem
                    key={tx.id}
                    transaction={tx}
                    index={i}
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
            {/* Bonus de bienvenue KYC : carte au-dessus du solde (teaser / progression). */}
            <WelcomeBonusCard />

            <ImageBackground
              source={require('../../assets/bg_page.jpg')}
              style={styles.balanceCard}
              imageStyle={styles.balanceCardImage}
            >
              <View style={styles.balanceOverlay}>
                {/* Bloc 1 : solde + boutons (padding latéral généreux) */}
                <View style={styles.balanceTop}>
                  <Text style={styles.balanceLabel}>{ t('home.balance') }</Text>
                  <Text style={styles.balanceAmount}>{fmtXof(animBalance, { withCode: false, decimals: 2 })}</Text>
                  <Text style={styles.currency}>{currencyCode}</Text>
                  <View style={styles.balanceActions}>
                    {!configReady && (<><View style={[styles.actionBtn, styles.actionBtnSkeleton]} /><View style={[styles.actionBtn, styles.actionBtnSkeleton]} /></>)}
                    {showDeposit && (
                    <Bounce
                      style={[styles.actionBtn, { backgroundColor: DarkColors.secondary }]}
                      onPress={() => setDepositVisible(true)}
                    >
                      <FontAwesome6 name="plus" size={16} color={Colors.white} />
                      <Text style={styles.actionLabel}>{ t('home.deposit') }</Text>
                    </Bounce>
                    )}
                    {showTransfer && (
                    <Bounce
                      style={[styles.actionBtn, { backgroundColor: Colors.primary }]}
                      onPress={() => setTransferVisible(true)}
                    >
                      <FontAwesome6 name="paper-plane" size={16} color={Colors.white} />
                      <Text style={styles.actionLabel}>{ t('home.transfer') }</Text>
                    </Bounce>
                    )}
                  </View>
                </View>
                {/* Bloc 2 : insights (padding latéral léger, hérité de balanceOverlay) */}
                <MonthlyInsights />
              </View>
            </ImageBackground>

            {/* Widgets en dessous : G + A + C + E. */}
            <PromoCarousel slides={promoSlides} />
            {showTransfer && <RecentBeneficiaries onPick={onBenefPick} onPickBank={onBenefPickBank} onAdd={onBenefAdd} allowCrypto={isCryptoUser} />}
            <ReferralCard />

            <View style={[styles.recentHeader, { marginTop: Spacing.lg }]}>
              <Text style={styles.sectionTitle}>{ t('home.recentTransactions') }</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
                <Text style={styles.seeAll}>{ t('common.seeAll') }</Text>
              </TouchableOpacity>
            </View>
            {transactions.length > 0 ? (
              transactions.slice(0, 5).map((tx, i) => (
                <TransactionItem
                  key={tx.id}
                  transaction={tx}
                  index={i}
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
        cryptoEnabled={showCrypto && (crypto_sell_enabled || isAdmin)}
        onSellCrypto={(currency?: string) => openCrypto('sell', currency)}
      />
      )}
      {showTransfer && (
      <TransferModal
        visible={transferVisible}
        onClose={() => { setTransferVisible(false); setTransferPrefillPhone(undefined); setTransferPrefillBank(null); }}
        cryptoEnabled={showCrypto && (crypto_buy_enabled || isAdmin)}
        onBuyCrypto={(currency?: string) => openCrypto('buy', currency)}
        prefillPhone={transferPrefillPhone}
        prefillBank={transferPrefillBank}
      />
      )}
      {showCrypto && (
        <CryptoModal
          visible={cryptoVisible}
          onClose={() => setCryptoVisible(false)}
          buyEnabled={crypto_buy_enabled}
          sellEnabled={crypto_sell_enabled}
          initialTab={cryptoTab}
          initialCurrency={cryptoCurrency}
          forceTab
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
  },
  balanceCardImage: {
    borderRadius: BorderRadius.xl,
  },
  balanceOverlay: {
    backgroundColor: 'rgba(5,12,30,0.82)',
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
  },
  // Bloc supérieur (solde + boutons) — garde un padding latéral généreux.
  balanceTop: {
    paddingHorizontal: Spacing.xl - Spacing.sm,
    alignItems: 'center',
    alignSelf: 'stretch',
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
  // Placeholder neutre affiché tant que /config n'a pas confirmé l'état des actions.
  actionBtnSkeleton: {
    width: 120,
    height: 44,
    backgroundColor: 'rgba(255,255,255,0.15)',
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
