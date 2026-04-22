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
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { walletService } from '../../src/services/walletService';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../../src/constants/theme';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { showAlert } from '../../src/stores/alertStore';
import { CustomAlert } from '../../src/components/CustomAlert';
import { useTheme } from '../../src/components/ThemeProvider';
import { useTranslation } from 'react-i18next';
import { useResponsive } from '../../src/hooks/useResponsive';
import type { SavedWallet } from '../../src/types';

const CRYPTO_CURRENCIES = [
  { id: 'BTC',        label: 'Bitcoin',    logo: require('../../assets/crypto/btc.png') },
  { id: 'ETH',        label: 'Ethereum',   logo: require('../../assets/crypto/eth.png') },
  { id: 'TRX',        label: 'TRON',       logo: require('../../assets/crypto/trx.png') },
  { id: 'USDT',       label: 'USDT',       logo: require('../../assets/crypto/usdt.png') },
  { id: 'USDT.TRC20', label: 'USDT TRC20', logo: require('../../assets/crypto/usdt.png') },
  { id: 'LTC',        label: 'Litecoin',   logo: require('../../assets/crypto/ltc.png') },
  { id: 'BNB.BSC',    label: 'BNB',        logo: require('../../assets/crypto/bnb.png') },
  { id: 'BUSD.BEP20', label: 'BUSD',       logo: require('../../assets/crypto/busd.png') },
];

export default function WalletsScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const [savedWallets, setSavedWallets] = useState<SavedWallet[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [walletSaving, setWalletSaving] = useState(false);
  const [walletModalOpen, setWalletModalOpen] = useState(false);
  const [walletForm, setWalletForm] = useState({ id: 0, name: '', currency: '', address: '' });

  useEffect(() => {
    walletService.getSavedWallets()
      .then((data) => { setSavedWallets(data); setLoadError(null); })
      .catch((error) => {
        setLoadError(t('account.walletsLoadError'));
      });
  }, []);

  const resetWalletForm = () => {
    setWalletForm({ id: 0, name: '', currency: '', address: '' });
    setWalletModalOpen(false);
  };

  const handleSaveWalletEntry = async () => {
    const currency = walletForm.currency.trim().toUpperCase();
    const address = walletForm.address.trim();
    if (!currency || !address) {
      showAlert(t('common.error'), t('account.enterCurrencyAndAddress'));
      return;
    }
    setWalletSaving(true);
    try {
      if (walletForm.id) {
        const updated = await walletService.updateSavedWallet(walletForm.id, {
          name: walletForm.name.trim(),
          currency,
          address,
        });
        setSavedWallets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        showAlert(t('common.success'), t('account.walletUpdated'));
      } else {
        const created = await walletService.createSavedWallet({
          name: walletForm.name.trim(),
          currency,
          address,
        });
        setSavedWallets((prev) => [created, ...prev]);
        showAlert(t('common.success'), t('account.walletAdded'));
      }
      resetWalletForm();
    } catch (error: any) {
      showAlert(t('common.error'), error?.response?.data?.error || error?.response?.data?.message || t('account.walletSaveError'));
    } finally {
      setWalletSaving(false);
    }
  };

  const handleDeleteWalletEntry = (id: number) => {
    showAlert(
      t('account.deleteWalletConfirm', 'Supprimer cette adresse ?'),
      t('account.deleteConfirmMessage', 'Cette action est définitive.'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              await walletService.deleteSavedWallet(id);
              setSavedWallets((prev) => prev.filter((item) => item.id !== id));
              if (walletForm.id === id) resetWalletForm();
            } catch (error: any) {
              showAlert(t('common.error'), error?.response?.data?.error || t('account.walletDeleteError'));
            }
          },
        },
      ]
    );
  };

  const content = (
    <>
      {!isDesktop && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('account.savedWallets')}</Text>
        </View>
      )}
      {isDesktop && <Text style={styles.title}>{t('account.savedWallets')}</Text>}

      <View style={styles.formCard}>
        {savedWallets.length > 0 ? savedWallets.map((item) => (
          <View key={item.id} style={styles.savedEntryRow}>
            <View style={{ flex: 1 }}>
              <View style={styles.savedEntryTopRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.savedEntryTitle}>{item.name?.trim() || t('common.noLabel')}</Text>
                  <Text style={styles.savedEntrySub}>{item.currency} · {item.address}</Text>
                </View>
                <TouchableOpacity
                  style={styles.inlineIconBtn}
                  onPress={() => {
                    setWalletForm({ id: item.id, name: item.name || '', currency: item.currency, address: item.address });
                    setWalletModalOpen(true);
                  }}
                >
                  <FontAwesome6 name="pen" size={14} color={Colors.secondary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.inlineIconBtn} onPress={() => handleDeleteWalletEntry(item.id)}>
                  <FontAwesome6 name="trash" size={14} color={Colors.error} />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )) : (
          <Text style={styles.emptyText}>{t('account.noWallets')}</Text>
        )}

        {loadError ? <Text style={styles.emptyText}>{loadError}</Text> : null}

        <TouchableOpacity style={styles.addEntryBtn} onPress={() => { resetWalletForm(); setWalletModalOpen(true); }}>
          <FontAwesome6 name="plus" size={12} color={Colors.primary} />
          <Text style={styles.addEntryBtnText}>{t('account.addWallet')}</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  const walletModal = (
    <Modal visible={walletModalOpen} transparent animationType="fade" onRequestClose={resetWalletForm}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.formModalOverlay}>
        <TouchableOpacity style={StyleSheet.absoluteFillObject} activeOpacity={1} onPress={resetWalletForm} />
        <View style={styles.formModalContainer}>
          <View style={styles.formModalHeader}>
            <Text style={styles.formModalTitle}>{walletForm.id ? t('account.editWallet') : t('account.addWallet')}</Text>
            <TouchableOpacity onPress={resetWalletForm} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FontAwesome6 name="xmark" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <Input
              label={t('account.label')}
              value={walletForm.name}
              onChangeText={(value) => setWalletForm((prev) => ({ ...prev, name: value }))}
              placeholder={t('account.walletLabelPlaceholder')}
            />
            <Text style={styles.managementFieldLabel}>{`${t('account.currency')} *`}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.xs, marginBottom: Spacing.sm }}>
              {CRYPTO_CURRENCIES.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.opChipSm, walletForm.currency === c.id && styles.opChipSmSelected]}
                  onPress={() => setWalletForm((prev) => ({ ...prev, currency: c.id }))}
                >
                  <Image source={c.logo} style={styles.opChipSmLogo} resizeMode="contain" />
                  <Text style={[styles.opChipSmText, walletForm.currency === c.id && styles.opChipSmTextSelected]} numberOfLines={2}>
                    {c.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Input
              label={t('account.walletAddress')}
              value={walletForm.address}
              onChangeText={(value) => setWalletForm((prev) => ({ ...prev, address: value }))}
              placeholder={t('account.walletAddressPlaceholder')}
              autoCapitalize="none"
            />
            <View style={styles.managementActions}>
              <Button title={walletForm.id ? t('account.update') : t('common.add')} onPress={handleSaveWalletEntry} loading={walletSaving} style={{ flex: 1 }} />
              <Button title={t('common.cancel')} variant="outline" onPress={resetWalletForm} style={{ flex: 1 }} />
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
        {walletModal}
        <CustomAlert />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={isDark ? require('../../assets/bg_page.jpg') : require('../../assets/bg_page_light.jpg')}
        style={styles.background}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {content}
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
        {walletModal}
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
  formCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  savedEntryRow: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: Spacing.sm,
  },
  savedEntryTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  savedEntryTitle: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  savedEntrySub: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    marginTop: 2,
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
  managementFieldLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    marginBottom: Spacing.xs,
    marginTop: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  opChipSm: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    width: 72,
  },
  opChipSmSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '18',
  },
  opChipSmLogo: {
    width: 32,
    height: 32,
    marginBottom: 2,
  },
  opChipSmText: {
    fontSize: 10,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  opChipSmTextSelected: {
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
  },
  managementActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
});
