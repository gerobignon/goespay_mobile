import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { useWalletStore } from '../../src/stores/walletStore';
import { TransactionItem, getTransactionLogo, getModeName } from '../../src/components/TransactionItem';
import { useAuthStore } from '../../src/stores/authStore';
import { TransactionDetailModal, type TxType } from '../../src/components/TransactionDetailModal';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../../src/constants/theme';
import { TRANSACTION_STATUS, getTransactionStatus, COUNTRIES } from '../../src/constants/config';
import { formatAmount, formatDate, useFormatXof, useCurrencyCode } from '../../src/utils/format';
import type { Transaction } from '../../src/types';
import { useResponsive } from '../../src/hooks/useResponsive';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useTranslation } from 'react-i18next';
import { useConfigStore } from '../../src/stores/configStore';

// 8 colonnes sur 12 à 1200px max
const DESKTOP_MAX_WIDTH = 1100;

const getTypeLabels = (t: (key: string) => string): Record<string, string> => ({
  deposit: t('transaction.deposit'),
  withdraw: t('transaction.withdraw'),
  transfer: t('transaction.transfer'),
  crypto: t('transaction.crypto'),
});

const FILTER_KEYS = [
  { key: undefined, labelKey: 'history.filterAll' },
  { key: 'deposit', labelKey: 'history.filterDeposit' },
  { key: 'withdraw', labelKey: 'history.filterWithdraw' },
  { key: 'crypto', labelKey: 'history.filterCrypto' },
] as const;

export default function HistoryScreen() {
  const router = useRouter();
  const { isWide, isDesktop } = useResponsive();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const {
    transactions,
    isLoadingTransactions,
    fetchTransactions,
    loadMoreTransactions,
  } = useWalletStore();
  const { user } = useAuthStore();
  const crypto_buy_enabled = useConfigStore((s) => s.crypto_buy_enabled);
  const isAdmin = user?.group === 'admin';
  const isSupportedCountry = COUNTRIES.some((c) => c.code === user?.country);
  const isCryptoUser = isAdmin || user?.group === 'crypto' || isSupportedCountry;
  // crypto_buy_enabled est prioritaire : si off, seuls les admins voient le filtre Crypto.
  const showCrypto = isAdmin || (isCryptoUser && crypto_buy_enabled);
  const filteredFilterKeys = FILTER_KEYS.filter((f) => f.key !== 'crypto' || showCrypto);
  const [activeFilter, setActiveFilter] = useState<string | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const hasFetchedRef = useRef(false);

  // Desktop modal state
  const [modalTxId, setModalTxId] = useState<number | null>(null);
  const [modalTxType, setModalTxType] = useState<TxType | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!hasFetchedRef.current) {
        hasFetchedRef.current = true;
        fetchTransactions(1, activeFilter);
      }
    }, [])
  );

  const handleFilterChange = (key: string | undefined) => {
    setActiveFilter(key);
    fetchTransactions(1, key);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTransactions(1, activeFilter);
    setRefreshing(false);
  };

  const handlePress = (tx: Transaction) => {
    const type = tx.type as TxType;
    if (isDesktop) {
      setModalTxId(tx.id);
      setModalTxType(type);
      return;
    }
    if (tx.type === 'deposit') {
      router.push(`/transaction/deposit/${tx.id}`);
    } else if (tx.type === 'withdraw') {
      router.push(`/transaction/withdraw/${tx.id}`);
    } else if (tx.type === 'transfer') {
      router.push(`/transaction/transfer/${tx.id}`);
    } else if (tx.type === 'crypto') {
      router.push(`/transaction/crypto/${tx.id}`);
    }
  };

  return (
    <ScreenBackground edges={['top']} style={styles.container}>
      <View style={[styles.header, isWide && { maxWidth: DESKTOP_MAX_WIDTH, alignSelf: 'center', width: '100%' }]}>
        <TouchableOpacity onPress={() => router.back()}>
          <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('history.title')}</Text>
      </View>

      {/* Filters */}
      <View style={[styles.filters, isWide && { maxWidth: DESKTOP_MAX_WIDTH, alignSelf: 'center', width: '100%' }]}>
        {filteredFilterKeys.map((f) => (
          <TouchableOpacity
            key={f.labelKey}
            style={[
              styles.filterBtn,
              activeFilter === f.key && styles.filterBtnActive,
            ]}
            onPress={() => handleFilterChange(f.key)}
          >
            <Text
              style={[
                styles.filterText,
                activeFilter === f.key && styles.filterTextActive,
              ]}
            >
              {t(f.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={({ item }) =>
          isDesktop ? (
            <DesktopTransactionRow tx={item} onPress={handlePress} styles={styles} />
          ) : (
            <TransactionItem transaction={item} onPress={handlePress} padded />
          )
        }
        ListHeaderComponent={
          isDesktop && transactions.length > 0 ? (
            <View style={styles.tableHeader}>
              <Text style={[styles.thCell, styles.tdCol12]}>{t('transaction.date')}</Text>
              <Text style={[styles.thCell, styles.tdCol1]}>{t('transaction.type')}</Text>
              <Text style={[styles.thCell, styles.tdCol1]}>{t('transaction.reference')}</Text>
              <Text style={[styles.thCell, styles.tdCol13]}>{t('transaction.details', 'Détails')}</Text>
              <Text style={[styles.thCell, styles.tdCol1]}>{t('transaction.balanceBefore')}</Text>
              <Text style={[styles.thCell, styles.tdCol1]}>{t('transaction.balanceAfter')}</Text>
              <Text style={[styles.thCell, { ...styles.tdCol1 as any, textAlign: 'right' }]}>{t('transaction.amount')}</Text>
              <Text style={[styles.thCell, { ...styles.tdCol08 as any, textAlign: 'center' }]}>{t('transaction.status')}</Text>
            </View>
          ) : isLoadingTransactions && transactions.length === 0 ? (
            <ActivityIndicator
              color={Colors.secondary}
              style={{ paddingTop: Spacing.xxl * 2 }}
            />
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.secondary}
          />
        }
        onEndReached={() => loadMoreTransactions(activeFilter)}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          isLoadingTransactions && transactions.length > 0 ? (
            <ActivityIndicator
              color={Colors.secondary}
              style={{ padding: Spacing.lg }}
            />
          ) : null
        }
        ListEmptyComponent={
          !isLoadingTransactions ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>{t('history.noTransactions')}</Text>
            </View>
          ) : null
        }
        contentContainerStyle={[
          styles.list,
          isWide && { alignSelf: 'center', width: '100%', maxWidth: DESKTOP_MAX_WIDTH },
        ]}
      />

      {/* Modal détail transaction (desktop uniquement) */}
      <TransactionDetailModal
        txId={modalTxId}
        txType={modalTxType}
        onClose={() => { setModalTxId(null); setModalTxType(null); }}
      />
    </ScreenBackground>
  );
}

function getDetail(tx: Transaction, t: (key: string) => string): string {
  if (tx.type === 'transfer') return tx.receiver_name || tx.receiver_email || tx.phone || tx.note || '—';
  if (tx.type === 'crypto') {
    const side = tx.mode === 'Buy' ? t('history.buy') : t('history.sell');
    if (tx.address) return `${side} · ${tx.address.slice(0, 10)}…`;
    return `${side} ${tx.currency_src ?? ''}`;
  }
  if (tx.type === 'withdraw') return tx.phone || tx.note || '—';
  // deposit
  return tx.note || '—';
}

function getRef(tx: Transaction): string {
  return tx.reference || tx.cp_hash || `#${tx.id}`;
}

function DesktopTransactionRow({ tx, onPress, styles }: { tx: Transaction; onPress: (tx: Transaction) => void; styles: any }) {
  const { t } = useTranslation();
  const fmtXof = useFormatXof();
  const currencyCode = useCurrencyCode();
  const TYPE_LABELS = getTypeLabels(t);
  const normalizedStatut =
    tx.type === 'crypto'
      ? tx.statut == 1 ? 'success' : tx.statut == 0 ? 'failed' : 'wait'
      : tx.statut;
  const status = getTransactionStatus(t)[normalizedStatut] || { label: String(tx.statut), color: '#888' };
  const logo = getTransactionLogo(tx);
  const modeName = getModeName(tx);

  return (
    <TouchableOpacity style={styles.tableRow} onPress={() => onPress(tx)} activeOpacity={0.7}>
      {/* Date */}
      <View style={styles.tdCol12}>
        <Text style={styles.tdCell}>{formatDate(tx.created_at)}</Text>
      </View>
      {/* Type + Moyen */}
      <View style={[styles.tdCol1, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
        {logo ? (
          <Image source={logo} style={styles.rowLogo} resizeMode="contain" />
        ) : (
          <View style={[styles.rowIconCircle, { backgroundColor: status.color + '20' }]}>
            <FontAwesome6 name={TYPE_LABELS[tx.type] ? 'arrow-down' : 'circle-question'} size={12} color={status.color} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.tdCell} numberOfLines={1}>{TYPE_LABELS[tx.type] || tx.type}</Text>
          {modeName ? <Text style={styles.tdModeLabel} numberOfLines={1}>{modeName}</Text> : null}
        </View>
      </View>
      {/* Référence */}
      <View style={styles.tdCol1}>
        <Text style={[styles.tdCell, { opacity: 0.6 }]} numberOfLines={1}>{getRef(tx)}</Text>
      </View>
      {/* Détails */}
      <View style={styles.tdCol13}>
        <Text style={styles.tdCell} numberOfLines={1}>{getDetail(tx, t)}</Text>
      </View>
      {/* Solde avant */}
      <View style={styles.tdCol1}>
        <Text style={[styles.tdCell, { opacity: 0.55 }]} numberOfLines={1}>
          {tx.avant != null ? fmtXof(tx.avant, { withCode: false }) : '—'}
        </Text>
      </View>
      {/* Solde après */}
      <View style={styles.tdCol1}>
        <Text style={[styles.tdCell, { opacity: 0.55 }]} numberOfLines={1}>
          {tx.apres != null ? fmtXof(tx.apres, { withCode: false }) : '—'}
        </Text>
      </View>
      {/* Montant */}
      <View style={[styles.tdCol1, { alignItems: 'flex-end' }]}>
        <Text style={[styles.tdCell, { color: status.color, fontFamily: Fonts.bold }]}>
          {tx.type === 'deposit' ? '+' : '-'}{fmtXof(Number(tx.amount), { withCode: false })}
        </Text>
        <Text style={[styles.tdModeLabel, { color: status.color, opacity: 0.7 }]}>{currencyCode}</Text>
      </View>
      {/* Statut */}
      <View style={[styles.tdCol08, { alignItems: 'center' }]}>
        <View style={[styles.statusBadge, { backgroundColor: status.color + '25' }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  filters: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  filterBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.inputBg,
  },
  filterBtnActive: {
    backgroundColor: Colors.secondary,
  },
  filterText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  filterTextActive: {
    color: Colors.white,
  },
  list: {
    flexGrow: 1,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: Spacing.xxl * 2,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
  // Desktop table styles
  tableHeader: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.xs,
  },
  thCell: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  // Column flex definitions
  tdCol12: { flex: 1.2 },
  tdCol13: { flex: 1.3 },
  tdCol1: { flex: 1 },
  tdCol08: { flex: 0.8 },
  tdCell: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Colors.text,
  },
  tdModeLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginTop: 1,
  },
  rowLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  rowIconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.pill,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
  },
});
