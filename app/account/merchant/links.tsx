import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ImageBackground,
  Modal,
  KeyboardAvoidingView,
  ActivityIndicator,
  Share,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
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
import { merchantService } from '../../../src/services/merchantService';
import { useFormatXof } from '../../../src/utils/format';
import type { PaymentLink } from '../../../src/types';

export default function MerchantLinksScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const formatXof = useFormatXof();

  const { links, fetchLinks } = useMerchantStore();

  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isFixedAmount, setIsFixedAmount] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    amount: '',
    max_uses: '',
    redirect_url: '',
  });

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchLinks();
      setLoading(false);
    })();
  }, []);

  const resetForm = () => {
    setForm({ title: '', description: '', amount: '', max_uses: '', redirect_url: '' });
    setIsFixedAmount(false);
    setModalOpen(false);
  };

  const handleCreate = async () => {
    if (!form.title.trim()) {
      showAlert(t('common.error'), t('merchant.linkTitle'));
      return;
    }
    setSaving(true);
    try {
      await merchantService.createLink({
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        amount: isFixedAmount && form.amount ? parseFloat(form.amount) : undefined,
        max_uses: form.max_uses ? parseInt(form.max_uses, 10) : undefined,
        redirect_url: form.redirect_url.trim() || undefined,
      });
      showAlert(t('common.success'), t('merchant.linkCreated'));
      resetForm();
      await fetchLinks();
    } catch (error: any) {
      showAlert(
        t('common.error'),
        error?.response?.data?.error || error?.response?.data?.message || t('common.error'),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async (url: string) => {
    await Clipboard.setStringAsync(url);
    showAlert(t('common.success'), t('merchant.linkCopied'));
  };

  const handleShare = async (link: PaymentLink) => {
    try {
      await Share.share({ message: link.pay_url, title: link.title });
    } catch {
      // user cancelled
    }
  };

  const handleToggleStatus = async (link: PaymentLink) => {
    const newStatus = link.status === 'active' ? 'disabled' : 'active';
    try {
      await merchantService.updateLink(link.id, { status: newStatus });
      await fetchLinks();
    } catch (error: any) {
      showAlert(t('common.error'), error?.response?.data?.error || t('common.error'));
    }
  };

  const handleDelete = (link: PaymentLink) => {
    showAlert(
      t('merchant.deleteLinkConfirm'),
      t('merchant.deleteLinkMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await merchantService.deleteLink(link.id);
              showAlert(t('common.success'), t('merchant.linkDeleted'));
              await fetchLinks();
            } catch (error: any) {
              showAlert(t('common.error'), error?.response?.data?.error || t('common.error'));
            }
          },
        },
      ],
    );
  };

  const statusColor = (status: PaymentLink['status']) => {
    switch (status) {
      case 'active': return Colors.success;
      case 'disabled': return Colors.textMuted;
      case 'expired': return Colors.error;
    }
  };

  const statusLabel = (status: PaymentLink['status']) => {
    switch (status) {
      case 'active': return t('merchant.active');
      case 'disabled': return t('merchant.disabled');
      case 'expired': return t('merchant.expired');
    }
  };

  const content = (
    <>
      {!isDesktop && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('merchant.paymentLinks')}</Text>
        </View>
      )}
      {isDesktop && <Text style={styles.title}>{t('merchant.paymentLinks')}</Text>}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <View style={styles.formCard}>
          {links.length > 0 ? links.map((link) => (
            <View key={link.id} style={styles.linkRow}>
              <View style={{ flex: 1 }}>
                <View style={styles.linkTopRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.linkTitle}>{link.title}</Text>
                    <Text style={styles.linkSub}>
                      {link.amount ? formatXof(link.amount) : t('merchant.freeAmount')}
                      {' \u00B7 '}
                      {link.uses_count}{link.max_uses ? `/${link.max_uses}` : ''} {t('merchant.uses')}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusColor(link.status) + '22' }]}>
                    <Text style={[styles.statusText, { color: statusColor(link.status) }]}>
                      {statusLabel(link.status)}
                    </Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.linkActions}>
                  <TouchableOpacity style={styles.inlineIconBtn} onPress={() => handleCopy(link.pay_url)}>
                    <FontAwesome6 name="copy" size={13} color={Colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.inlineIconBtn} onPress={() => handleShare(link)}>
                    <FontAwesome6 name="share-nodes" size={13} color={Colors.primary} />
                  </TouchableOpacity>
                  {link.status !== 'expired' && (
                    <TouchableOpacity style={styles.inlineIconBtn} onPress={() => handleToggleStatus(link)}>
                      <FontAwesome6
                        name={link.status === 'active' ? 'toggle-on' : 'toggle-off'}
                        size={16}
                        color={link.status === 'active' ? Colors.success : Colors.textMuted}
                      />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity style={styles.inlineIconBtn} onPress={() => handleDelete(link)}>
                    <FontAwesome6 name="trash" size={13} color={Colors.error} />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )) : (
            <Text style={styles.emptyText}>{t('merchant.noLinks')}</Text>
          )}

          <TouchableOpacity style={styles.addEntryBtn} onPress={() => { resetForm(); setModalOpen(true); }}>
            <FontAwesome6 name="plus" size={12} color={Colors.primary} />
            <Text style={styles.addEntryBtnText}>{t('merchant.createLink')}</Text>
          </TouchableOpacity>
        </View>
      )}
    </>
  );

  const createModal = (
    <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={resetForm}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.formModalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={resetForm} />
        <View style={styles.formModalContainer}>
          <View style={styles.formModalHeader}>
            <Text style={styles.formModalTitle}>{t('merchant.createLink')}</Text>
            <TouchableOpacity onPress={resetForm} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FontAwesome6 name="xmark" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Input
              label={`${t('merchant.linkTitle')} *`}
              value={form.title}
              onChangeText={(v) => setForm((p) => ({ ...p, title: v }))}
              placeholder={t('merchant.linkTitlePlaceholder')}
            />
            <Input
              label={t('merchant.linkDescription')}
              value={form.description}
              onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
              placeholder={t('merchant.linkDescriptionPlaceholder')}
            />

            {/* Amount toggle */}
            <View style={styles.amountToggleRow}>
              <Text style={styles.fieldLabel}>{t('merchant.amount')}</Text>
              <View style={styles.amountSwitch}>
                <Text style={[styles.amountSwitchLabel, !isFixedAmount && { color: Colors.primary }]}>
                  {t('merchant.freeAmount')}
                </Text>
                <Switch
                  value={isFixedAmount}
                  onValueChange={setIsFixedAmount}
                  trackColor={{ false: Colors.border, true: Colors.primary + '66' }}
                  thumbColor={isFixedAmount ? Colors.primary : Colors.textMuted}
                />
                <Text style={[styles.amountSwitchLabel, isFixedAmount && { color: Colors.primary }]}>
                  {t('merchant.fixedAmount')}
                </Text>
              </View>
            </View>

            {isFixedAmount && (
              <Input
                label={t('merchant.amount')}
                value={form.amount}
                onChangeText={(v) => setForm((p) => ({ ...p, amount: v }))}
                placeholder={t('merchant.amountPlaceholder')}
                keyboardType="numeric"
              />
            )}

            <Input
              label={t('merchant.maxUses')}
              value={form.max_uses}
              onChangeText={(v) => setForm((p) => ({ ...p, max_uses: v }))}
              keyboardType="numeric"
              placeholder="10"
            />
            <Input
              label={t('merchant.redirectUrl')}
              value={form.redirect_url}
              onChangeText={(v) => setForm((p) => ({ ...p, redirect_url: v }))}
              placeholder="https://..."
              keyboardType="url"
              autoCapitalize="none"
            />

            <View style={styles.managementActions}>
              <Button
                title={saving ? t('merchant.creating') : t('merchant.createLink')}
                onPress={handleCreate}
                loading={saving}
                disabled={saving}
                style={{ flex: 1 }}
              />
              <Button title={t('common.cancel')} variant="outline" onPress={resetForm} style={{ flex: 1 }} />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  if (isDesktop) {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: 0 }]} keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
        {createModal}
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
        {createModal}
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
  },
  linkRow: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: Spacing.sm,
  },
  linkTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  linkTitle: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  linkSub: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statusText: {
    fontSize: 10,
    fontFamily: Fonts.semiBold,
  },
  linkActions: {
    flexDirection: 'row',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  inlineIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.inputBg,
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
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
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
  fieldLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  amountToggleRow: {
    marginBottom: Spacing.sm,
  },
  amountSwitch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  amountSwitchLabel: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  managementActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
});
