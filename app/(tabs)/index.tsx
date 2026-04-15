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
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { useAuthStore } from '../../src/stores/authStore';
import { useWalletStore } from '../../src/stores/walletStore';
import { KycBanner } from '../../src/components/KycBanner';
import { formatAmount } from '../../src/utils/format';
import {
  Colors,
  Spacing,
  FontSize,
  BorderRadius,
  Fonts,
} from '../../src/constants/theme';
import { API_BASE_URL } from '../../src/constants/config';
import { DepositModal } from '../../src/components/DepositModal';
import { TransferModal } from '../../src/components/TransferModal';
import { CryptoModal } from '../../src/components/CryptoModal';
import { TransactionItem } from '../../src/components/TransactionItem';

export default function DashboardScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);
  const { balance, fetchBalance, isLoadingBalance, transactions, fetchTransactions, loadCachedData } = useWalletStore();
  const [refreshing, setRefreshing] = useState(false);
  const [depositVisible, setDepositVisible] = useState(false);
  const [transferVisible, setTransferVisible] = useState(false);
  const [cryptoVisible, setCryptoVisible] = useState(false);

  const isCryptoUser =
    user?.group === 'admin' || user?.group === 'crypto';
  const isValidated = user?.validate === 1;

  useFocusEffect(
    useCallback(() => {
      loadCachedData();
      refreshProfile();
      fetchBalance();
      fetchTransactions(1);
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refreshProfile(), fetchBalance(), fetchTransactions(1)]);
    setRefreshing(false);
  };

  const avatarSource = user?.avatar
    ? { uri: user.avatar.startsWith('http') ? user.avatar : `${API_BASE_URL.replace('/api/mobile/v1', '')}${user.avatar}` }
    : require('../../assets/avatar.png');

  return (
    <ScreenBackground edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.secondary}
          />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Image source={require('../../assets/picto.png')} style={styles.headerLogo} />
            <View>
              <Text style={styles.greeting}>
                Bonjour, {user?.name || 'Utilisateur'}
              </Text>
              <Text style={styles.subGreeting}>Bienvenue sur GoesPay</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => router.push('/account')}>
            <Image source={avatarSource} style={styles.avatar} />
          </TouchableOpacity>
        </View>

        {/* KYC Banner */}
        {user?.validate !== 1 && (
          <KycBanner
            status={user?.validate as 0 | 2}
            onPress={user?.validate === 0 ? () => router.push('/kyc') : undefined}
          />
        )}

        {/* Balance Card with bg_page */}
        <ImageBackground
          source={require('../../assets/bg_page.jpg')}
          style={styles.balanceCard}
          imageStyle={styles.balanceCardImage}
        >
          <View style={styles.balanceOverlay}>
            <Text style={styles.balanceLabel}>Solde disponible</Text>
            <Text style={styles.balanceAmount}>
              {formatAmount(balance)}
            </Text>
            <Text style={styles.currency}>XOF</Text>
            <View style={styles.balanceActions}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Colors.secondary }, !isValidated && { opacity: 0.4 }]}
                onPress={() => isValidated && setDepositVisible(true)}
              >
                <FontAwesome6 name="plus" size={16} color={Colors.white} />
                <Text style={styles.actionLabel}>Dépôt</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: Colors.primary }, !isValidated && { opacity: 0.4 }]}
                onPress={() => isValidated && setTransferVisible(true)}
              >
                <FontAwesome6 name="paper-plane" size={16} color={Colors.white} />
                <Text style={styles.actionLabel}>Transfert</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ImageBackground>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Services</Text>
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => setDepositVisible(true)}
          >
            <View style={[styles.quickIcon, { backgroundColor: Colors.success + '25' }]}>
              <FontAwesome6 name="arrow-down" size={20} color={Colors.success} />
            </View>
            <Text style={styles.quickLabel}>Dépôt</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => setTransferVisible(true)}
          >
            <View style={[styles.quickIcon, { backgroundColor: Colors.primary + '25' }]}>
              <FontAwesome6 name="paper-plane" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.quickLabel}>Transfert</Text>
          </TouchableOpacity>

          {isCryptoUser && (
            <TouchableOpacity style={styles.quickBtn} onPress={() => setCryptoVisible(true)}>
              <View style={[styles.quickIcon, { backgroundColor: Colors.warning + '25' }]}>
                <FontAwesome6 name="bitcoin-sign" size={20} color={Colors.warning} />
              </View>
              <Text style={styles.quickLabel}>Crypto</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={styles.quickBtn}
            onPress={() => router.push('/(tabs)/history')}
          >
            <View style={[styles.quickIcon, { backgroundColor: Colors.secondary + '25' }]}>
              <FontAwesome6 name="clock-rotate-left" size={20} color={Colors.secondary} />
            </View>
            <Text style={styles.quickLabel}>Historique</Text>
          </TouchableOpacity>
        </View>

        {/* Recent transactions */}
        <View style={styles.recentHeader}>
          <Text style={styles.sectionTitle}>Dernières transactions</Text>
          <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
            <Text style={styles.seeAll}>Voir tout</Text>
          </TouchableOpacity>
        </View>
        {transactions.length > 0 ? (
          transactions.slice(0, 5).map((tx) => (
            <TransactionItem
              key={tx.id}
              transaction={tx}
              onPress={() => router.push(`/transaction/${tx.type === 'deposit' ? 'deposit' : tx.type === 'transfer' ? 'transfer' : tx.type === 'crypto' ? 'crypto' : 'withdraw'}/${tx.id}`)}
            />
          ))
        ) : (
          <View style={styles.emptyRecent}>
            <FontAwesome6 name="receipt" size={32} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Aucune transaction récente</Text>
          </View>
        )}
      </ScrollView>

      <DepositModal
        visible={depositVisible}
        onClose={() => setDepositVisible(false)}
      />
      <TransferModal
        visible={transferVisible}
        onClose={() => setTransferVisible(false)}
      />
      {isCryptoUser && (
        <CryptoModal
          visible={cryptoVisible}
          onClose={() => setCryptoVisible(false)}
        />
      )}
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    padding: Spacing.lg,
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
    color: Colors.secondary,
    textAlign: 'center',
  },
  currency: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
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
    backgroundColor: Colors.card,
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
    color: Colors.textSecondary,
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
});
