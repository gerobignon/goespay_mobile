import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ImageBackground,
  Modal,
  ActivityIndicator,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../../../src/constants/theme';
import { useThemedStyles } from '../../../src/hooks/useThemedStyles';
import { CustomAlert } from '../../../src/components/CustomAlert';
import { useTheme } from '../../../src/components/ThemeProvider';
import { useTranslation } from 'react-i18next';
import { useResponsive } from '../../../src/hooks/useResponsive';
import { useMerchantStore } from '../../../src/stores/merchantStore';
import { useFormatXof, formatDate } from '../../../src/utils/format';
import type { MerchantPayment } from '../../../src/types';

export default function MerchantPaymentsScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const formatXof = useFormatXof();

  const {
    payments,
    paymentsPage,
    paymentsLastPage,
    fetchPayments,
  } = useMerchantStore();

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<MerchantPayment | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchPayments(1);
      setLoading(false);
    })();
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (loadingMore || paymentsPage >= paymentsLastPage) return;
    setLoadingMore(true);
    await fetchPayments(paymentsPage + 1);
    setLoadingMore(false);
  }, [loadingMore, paymentsPage, paymentsLastPage, fetchPayments]);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
      const paddingToBottom = 100;
      if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
        handleLoadMore();
      }
    },
    [handleLoadMore],
  );

  const statusColor = (status: string) => {
    switch (status) {
      case 'success': return Colors.success;
      case 'pending': return Colors.pending;
      case 'failed':
      case 'expired': return Colors.error;
      default: return Colors.textMuted;
    }
  };

  const content = (
    <>
      {!isDesktop && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('merchant.paymentsReceived')}</Text>
        </View>
      )}
      {isDesktop && <Text style={styles.title}>{t('merchant.paymentsReceived')}</Text>}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : payments.length === 0 ? (
        <View style={styles.formCard}>
          <Text style={styles.emptyText}>{t('merchant.noPayments')}</Text>
        </View>
      ) : (
        <View style={styles.formCard}>
          {payments.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={styles.paymentRow}
              onPress={() => setSelectedPayment(p)}
              activeOpacity={0.7}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentName}>{p.payer_name || p.payer_phone || '---'}</Text>
                <Text style={styles.paymentSub}>
                  {p.gateway} {p.payment_link ? `\u00B7 ${p.payment_link.title}` : ''}
                </Text>
                <Text style={styles.paymentDate}>{formatDate(p.created_at)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.paymentAmount}>{formatXof(p.amount)}</Text>
                <Text style={styles.paymentNet}>{formatXof(p.net_amount)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(p.status) + '22' }]}>
                  <Text style={[styles.statusText, { color: statusColor(p.status) }]}>
                    {t(`merchant.${p.status}`)}
                  </Text>
                </View>
              </View>
              <FontAwesome6 name="chevron-right" size={12} color={Colors.textMuted} style={{ marginLeft: Spacing.xs }} />
            </TouchableOpacity>
          ))}

          {loadingMore && (
            <View style={{ paddingVertical: Spacing.md, alignItems: 'center' }}>
              <ActivityIndicator size="small" color={Colors.primary} />
            </View>
          )}
        </View>
      )}
    </>
  );

  const detailModal = (
    <Modal
      visible={!!selectedPayment}
      transparent
      animationType="fade"
      onRequestClose={() => setSelectedPayment(null)}
    >
      <TouchableOpacity
        style={styles.formModalOverlay}
        activeOpacity={1}
        onPress={() => setSelectedPayment(null)}
      >
        <TouchableOpacity activeOpacity={1} style={styles.formModalContainer}>
          <View style={styles.formModalHeader}>
            <Text style={styles.formModalTitle}>{t('merchant.paymentDetail')}</Text>
            <TouchableOpacity onPress={() => setSelectedPayment(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FontAwesome6 name="xmark" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {selectedPayment && (
            <ScrollView showsVerticalScrollIndicator={false}>
              <DetailRow
                label={t('merchant.payer')}
                value={selectedPayment.payer_name || selectedPayment.payer_phone || '---'}
                styles={styles}
              />
              {selectedPayment.payer_email ? (
                <DetailRow label="Email" value={selectedPayment.payer_email} styles={styles} />
              ) : null}
              <DetailRow
                label={t('merchant.amount')}
                value={formatXof(selectedPayment.amount)}
                styles={styles}
              />
              <DetailRow
                label={t('merchant.fees')}
                value={formatXof(selectedPayment.fees)}
                styles={styles}
              />
              <DetailRow
                label={t('merchant.netAmount')}
                value={formatXof(selectedPayment.net_amount)}
                styles={styles}
                bold
              />
              <DetailRow
                label={t('merchant.gateway')}
                value={selectedPayment.gateway}
                styles={styles}
              />
              <DetailRow
                label={t('merchant.reference')}
                value={selectedPayment.reference}
                styles={styles}
              />
              {selectedPayment.payment_link ? (
                <DetailRow
                  label={t('merchant.paymentLinks')}
                  value={selectedPayment.payment_link.title}
                  styles={styles}
                />
              ) : null}
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Status</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(selectedPayment.status) + '22' }]}>
                  <Text style={[styles.statusText, { color: statusColor(selectedPayment.status) }]}>
                    {t(`merchant.${selectedPayment.status}`)}
                  </Text>
                </View>
              </View>
              <DetailRow
                label="Date"
                value={formatDate(selectedPayment.created_at)}
                styles={styles}
              />
            </ScrollView>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );

  if (isDesktop) {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: 0 }]}
          keyboardShouldPersistTaps="handled"
          onScroll={handleScroll}
          scrollEventThrottle={200}
        >
          {content}
        </ScrollView>
        {detailModal}
        <CustomAlert />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={isDark ? require('../../../assets/bg_page.jpg') : require('../../../assets/bg_page_light.jpg')}
        style={styles.background}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
            onScroll={handleScroll}
            scrollEventThrottle={200}
          >
            {content}
          </ScrollView>
        </SafeAreaView>
        {detailModal}
        <CustomAlert />
      </ImageBackground>
    </View>
  );
}

function DetailRow({
  label,
  value,
  styles,
  bold,
}: {
  label: string;
  value: string;
  styles: ReturnType<typeof createStyles>;
  bold?: boolean;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, bold && { fontFamily: Fonts.bold }]}>{value}</Text>
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
  },
  formCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  paymentName: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  paymentSub: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    marginTop: 1,
  },
  paymentDate: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    marginTop: 1,
  },
  paymentAmount: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
  },
  paymentNet: {
    color: Colors.success,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    marginTop: 1,
  },
  statusBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 2,
  },
  statusText: {
    fontSize: 10,
    fontFamily: Fonts.semiBold,
  },
  formModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  formModalContainer: {
    backgroundColor: Colors.cardSolid,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 420,
    maxHeight: '85%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  formModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  formModalTitle: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  detailLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
  },
  detailValue: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    textAlign: 'right',
    flexShrink: 1,
    marginLeft: Spacing.sm,
  },
});
