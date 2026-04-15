import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { useWalletStore } from '../../src/stores/walletStore';
import { TransactionItem } from '../../src/components/TransactionItem';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../../src/constants/theme';
import type { Transaction } from '../../src/types';

const FILTERS = [
  { key: undefined, label: 'Tout' },
  { key: 'deposit', label: 'Dépôts' },
  { key: 'withdraw', label: 'Retraits' },
  { key: 'crypto', label: 'Crypto' },
] as const;

export default function HistoryScreen() {
  const router = useRouter();
  const {
    transactions,
    isLoadingTransactions,
    fetchTransactions,
    loadMoreTransactions,
  } = useWalletStore();
  const [activeFilter, setActiveFilter] = useState<string | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);
  const hasFetchedRef = useRef(false);

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
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Historique</Text>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.label}
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
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={transactions}
        keyExtractor={(item) => `${item.type}-${item.id}`}
        renderItem={({ item }) => (
          <TransactionItem transaction={item} onPress={handlePress} padded />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.secondary}
          />
        }
        onEndReached={() => loadMoreTransactions(activeFilter)}
        onEndReachedThreshold={0.3}
        ListHeaderComponent={
          isLoadingTransactions && transactions.length === 0 ? (
            <ActivityIndicator
              color={Colors.secondary}
              style={{ paddingTop: Spacing.xxl * 2 }}
            />
          ) : null
        }
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
              <Text style={styles.emptyText}>Aucune transaction</Text>
            </View>
          ) : null
        }
        contentContainerStyle={styles.list}
      />
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
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
});
