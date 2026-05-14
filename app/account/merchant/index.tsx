import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ImageBackground,
  KeyboardAvoidingView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { Input } from '../../../src/components/Input';
import { Button } from '../../../src/components/Button';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../../../src/constants/theme';
import { useThemedStyles } from '../../../src/hooks/useThemedStyles';
import { showAlert } from '../../../src/stores/alertStore';
import { CustomAlert } from '../../../src/components/CustomAlert';
import { useTheme } from '../../../src/components/ThemeProvider';
import { useTranslation } from 'react-i18next';
import { useResponsive } from '../../../src/hooks/useResponsive';
import { useMerchantStore } from '../../../src/stores/merchantStore';
import { useFormatXof, formatDate } from '../../../src/utils/format';

export default function MerchantDashboardScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const formatXof = useFormatXof();

  const {
    isMerchant,
    config,
    stats,
    payments,
    fetchConfig,
    fetchStats,
    fetchPayments,
    register,
  } = useMerchantStore();

  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [form, setForm] = useState({ business_name: '', description: '', website: '' });

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchConfig();
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (isMerchant) {
      fetchStats();
      fetchPayments(1);
    }
  }, [isMerchant]);

  const handleRegister = async () => {
    if (!form.business_name.trim()) {
      showAlert(t('common.error'), t('merchant.businessName'));
      return;
    }
    setRegistering(true);
    try {
      await register({
        business_name: form.business_name.trim(),
        description: form.description.trim() || undefined,
        website: form.website.trim() || undefined,
      });
      showAlert(t('common.success'), t('merchant.registerSuccess'));
    } catch (error: any) {
      showAlert(
        t('common.error'),
        error?.response?.data?.error || error?.response?.data?.message || t('common.error'),
      );
    } finally {
      setRegistering(false);
    }
  };

  const lastPayments = payments.slice(0, 5);

  const statusColor = (status: string) => {
    switch (status) {
      case 'success': return Colors.success;
      case 'pending': return Colors.pending;
      case 'failed':
      case 'expired': return Colors.error;
      default: return Colors.textMuted;
    }
  };

  const registrationForm = (
    <View style={styles.formCard}>
      <View style={styles.registerHeader}>
        <FontAwesome6 name="store" size={32} color={Colors.primary} />
        <Text style={styles.registerTitle}>{t('merchant.createAccount')}</Text>
        <Text style={styles.registerSub}>{t('merchant.notMerchant')}</Text>
      </View>
      <Input
        label={`${t('merchant.businessName')} *`}
        value={form.business_name}
        onChangeText={(v) => setForm((p) => ({ ...p, business_name: v }))}
        placeholder={t('merchant.businessNamePlaceholder')}
      />
      <Input
        label={t('merchant.description')}
        value={form.description}
        onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
        placeholder={t('merchant.descriptionPlaceholder')}
      />
      <Input
        label={t('merchant.website')}
        value={form.website}
        onChangeText={(v) => setForm((p) => ({ ...p, website: v }))}
        placeholder="https://..."
        keyboardType="url"
        autoCapitalize="none"
      />
      <Button
        title={registering ? t('merchant.registering') : t('merchant.register')}
        onPress={handleRegister}
        loading={registering}
        disabled={registering}
        style={{ marginTop: Spacing.sm }}
      />
    </View>
  );

  const dashboard = (
    <>
      {/* Stats cards */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <FontAwesome6 name="wallet" size={16} color={Colors.primary} />
          <Text style={styles.statLabel}>{t('merchant.balance')}</Text>
          <Text style={styles.statValue}>{formatXof(stats?.balance ?? 0)}</Text>
        </View>
        <View style={styles.statCard}>
          <FontAwesome6 name="arrow-down" size={16} color={Colors.success} />
          <Text style={styles.statLabel}>{t('merchant.todayReceived')}</Text>
          <Text style={styles.statValue}>{formatXof(stats?.today_received ?? 0)}</Text>
        </View>
      </View>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <FontAwesome6 name="calendar" size={16} color={Colors.secondary} />
          <Text style={styles.statLabel}>{t('merchant.monthReceived')}</Text>
          <Text style={styles.statValue}>{formatXof(stats?.month_received ?? 0)}</Text>
        </View>
        <View style={styles.statCard}>
          <FontAwesome6 name="receipt" size={16} color={Colors.textMuted} />
          <Text style={styles.statLabel}>{t('merchant.totalPayments')}</Text>
          <Text style={styles.statValue}>{stats?.total_payments ?? 0}</Text>
        </View>
      </View>

      {/* Commission rate */}
      {config && (
        <View style={styles.commissionBadge}>
          <FontAwesome6 name="percent" size={12} color={Colors.secondary} />
          <Text style={styles.commissionText}>
            {t('merchant.commission')} : {config.commission_rate}%
          </Text>
          <View style={{ flex: 1 }} />
          {config.is_verified ? (
            <View style={styles.verifiedChip}>
              <FontAwesome6 name="circle-check" size={10} color={Colors.success} />
              <Text style={[styles.chipText, { color: Colors.success }]}>{t('merchant.verified')}</Text>
            </View>
          ) : (
            <View style={[styles.verifiedChip, { backgroundColor: Colors.pending + '22', borderColor: Colors.pending + '44' }]}>
              <FontAwesome6 name="clock" size={10} color={Colors.pending} />
              <Text style={[styles.chipText, { color: Colors.pending }]}>{t('merchant.notVerified')}</Text>
            </View>
          )}
        </View>
      )}

      {/* Quick actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/account/merchant/links')}>
          <View style={[styles.actionIcon, { backgroundColor: Colors.primary + '22' }]}>
            <FontAwesome6 name="link" size={16} color={Colors.primary} />
          </View>
          <Text style={styles.actionLabel}>{t('merchant.paymentLinks')}</Text>
          {stats ? (
            <Text style={styles.actionSub}>{stats.active_links_count} {t('merchant.activeLinks')}</Text>
          ) : null}
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/account/merchant/payments')}>
          <View style={[styles.actionIcon, { backgroundColor: Colors.success + '22' }]}>
            <FontAwesome6 name="money-bill-wave" size={16} color={Colors.success} />
          </View>
          <Text style={styles.actionLabel}>{t('merchant.paymentsReceived')}</Text>
          {stats ? (
            <Text style={styles.actionSub}>{formatXof(stats.total_received)}</Text>
          ) : null}
        </TouchableOpacity>
      </View>

      {/* Last 5 payments */}
      {lastPayments.length > 0 && (
        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>{t('merchant.paymentsReceived')}</Text>
          {lastPayments.map((p) => (
            <View key={p.id} style={styles.paymentRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.paymentName}>{p.payer_name || p.payer_phone || '---'}</Text>
                <Text style={styles.paymentDate}>{formatDate(p.created_at)}</Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.paymentAmount}>{formatXof(p.amount)}</Text>
                <View style={[styles.statusBadge, { backgroundColor: statusColor(p.status) + '22' }]}>
                  <Text style={[styles.statusText, { color: statusColor(p.status) }]}>
                    {t(`merchant.${p.status}`)}
                  </Text>
                </View>
              </View>
            </View>
          ))}
          <TouchableOpacity
            style={styles.addEntryBtn}
            onPress={() => router.push('/account/merchant/payments')}
          >
            <Text style={styles.addEntryBtnText}>{t('merchant.paymentsReceived')}</Text>
            <FontAwesome6 name="arrow-right" size={12} color={Colors.primary} />
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  const content = (
    <>
      {!isDesktop && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('merchant.title')}</Text>
        </View>
      )}
      {isDesktop && <Text style={styles.title}>{t('merchant.title')}</Text>}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : isMerchant ? dashboard : registrationForm}
    </>
  );

  if (isDesktop) {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: 0 }]} keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
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
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
              {content}
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
        <CustomAlert />
      </ImageBackground>
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
    marginBottom: Spacing.md,
  },
  registerHeader: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    gap: Spacing.sm,
  },
  registerTitle: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    textAlign: 'center',
  },
  registerSub: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    gap: Spacing.xs,
  },
  statLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  statValue: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  commissionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  commissionText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  verifiedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.success + '22',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.success + '44',
  },
  chipText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    textAlign: 'center',
  },
  actionSub: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  paymentName: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  paymentDate: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginTop: 2,
  },
  paymentAmount: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
    color: Colors.text,
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
  addEntryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingVertical: Spacing.xs,
    alignSelf: 'flex-start',
  },
  addEntryBtnText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
});
