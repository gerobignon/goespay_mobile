import React, { useState, useMemo, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Modal,
  Platform,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Input } from './Input';
import { Button } from './Button';
import { ResponsiveModal } from './ResponsiveModal';
import { walletService } from '../services/walletService';
import { useWalletStore } from '../stores/walletStore';
import { useAuthStore } from '../stores/authStore';
import { OPERATORS } from '../constants/config';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useResponsive } from '../hooks/useResponsive';
import { showAlert } from '../stores/alertStore';
import { CustomAlert } from './CustomAlert';
import type { SavedPhone } from '../types';
import { useTranslation } from 'react-i18next';

interface TransferModalProps {
  visible: boolean;
  onClose: () => void;
}

export function TransferModal({ visible, onClose }: TransferModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const { isDesktop } = useResponsive();

  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [savedPhones, setSavedPhones] = useState<SavedPhone[]>([]);
  const [savedPhonesLoadError, setSavedPhonesLoadError] = useState<string | null>(null);
  const [savePhoneModalVisible, setSavePhoneModalVisible] = useState(false);
  const [savePhoneName, setSavePhoneName] = useState('');
  const [savePhoneOperator, setSavePhoneOperator] = useState('');
  const [savePhoneLoading, setSavePhoneLoading] = useState(false);
  const fetchBalance = useWalletStore((s) => s.fetchBalance);
  const balance = useWalletStore((s) => s.balance);
  const user = useAuthStore((s) => s.user);

  const displayOperators = OPERATORS.filter((op) => op.withdraw);

  // Calcul frais en live (même logique que le web)
  const numAmount = parseFloat(amount) || 0;
  const selectedOp = OPERATORS.find((op) => op.id === operator);
  const feeRate = selectedOp?.country === 'CM' ? 0.1 : 0.05;
  const fees = useMemo(() => Math.round(numAmount * feeRate), [numAmount, feeRate]);
  const total = numAmount + fees;

  const fmt = (n: number) => n.toLocaleString('fr-FR').replace(/\s/g, '.').replace(/,/g, '.');

  const showFees = numAmount > 0 && operator;

  const normalizedPhone = phone.replace(/\s+/g, '').trim();

  const loadSavedPhones = async () => {
    try {
      const data = await walletService.getSavedPhones({ type: 'transfer' });
      setSavedPhones(data);
      setSavedPhonesLoadError(null);
    } catch (error: any) {
      console.log('[SavedPhones] load error:', error?.response?.status, error?.message);
      setSavedPhonesLoadError(t('account.phonesLoadError'));
    }
  };

  useEffect(() => {
    if (!visible) return;
    loadSavedPhones();
  }, [visible]);

  const saveCurrentPhone = async () => {
    if (!normalizedPhone) return;

    const existing = savedPhones.find((item) => item.tel.replace(/\s+/g, '') === normalizedPhone);
    if (existing) return;

    setSavePhoneName('');
    setSavePhoneOperator(operator);
    setSavePhoneModalVisible(true);
  };

  const removeCurrentPhone = async () => {
    const existing = savedPhones.find((item) => item.tel.replace(/\s+/g, '') === normalizedPhone);
    if (!existing) return;
    showAlert(
      t('account.deletePhoneConfirm'),
      t('account.deletePhoneMsg'),
      [
        { text: t('common.cancel') },
        {
          text: t('common.delete'),
          onPress: async () => {
            try {
              await walletService.deleteSavedPhone(existing.id);
              setSavedPhones((prev) => prev.filter((item) => item.id !== existing.id));
            } catch (error: any) {
              showAlert(t('common.error'), error?.response?.data?.error || error?.response?.data?.message || t('account.phoneDeleteError'));
            }
          },
        },
      ],
    );
  };

  const confirmSaveCurrentPhone = async () => {
    if (!normalizedPhone) return;
    if (!savePhoneOperator) {
      showAlert(t('common.error'), t('depositModal.selectOperator'));
      return;
    }
    const existing = savedPhones.find((item) => item.tel.replace(/\s+/g, '') === normalizedPhone);
    if (existing) {
      setSavePhoneModalVisible(false);
      return;
    }

    setSavePhoneLoading(true);
    try {
      const created = await walletService.createSavedPhone({
        tel: normalizedPhone,
        name: savePhoneName.trim(),
        type: 'transfer',
        operator: savePhoneOperator,
      });
      setSavedPhones((prev) => [created, ...prev]);
      setPhone(normalizedPhone);
      setSavePhoneModalVisible(false);
      setSavePhoneName('');
      showAlert(t('common.success'), t('transferModal.phoneSaved'));
    } catch (error: any) {
      showAlert(t('common.error'), error?.response?.data?.error || error?.response?.data?.message || t('transferModal.phoneSaveError'));
    } finally {
      setSavePhoneLoading(false);
    }
  };

  const handleClose = () => {
    const hasUserInput = !!amount.trim() || !!phone.trim();
    if (hasUserInput) {
      showAlert(
        t('transferModal.cancelTransfer'),
        t('transferModal.infoLost'),
        [
          { text: t('common.continue') },
          { text: t('common.quit'), onPress: onClose },
        ],
      );
    } else {
      onClose();
    }
  };

  const handlePressEnvoyer = () => {
    if (user?.validate !== 1) {
      showAlert(t('depositModal.kycRequired3'), t('depositModal.kycRequired2'));
      return;
    }
    setConfirmed(false);
    setConfirmVisible(true);
  };

  const handleTransfer = async () => {
    setConfirmVisible(false);
    setLoading(true);
    try {
      const result = await walletService.transfer({
        amount: numAmount,
        moyen: operator,
        tel: normalizedPhone,
      });
      const existing = savedPhones.find((item) => item.tel.replace(/\s+/g, '') === normalizedPhone);
      if (!existing && normalizedPhone) {
        const created = await walletService.createSavedPhone({ tel: normalizedPhone, name: '', type: 'transfer' });
        setSavedPhones((prev) => [created, ...prev]);
      }
      await fetchBalance();
      const msg = result?.message
        ? `${result.message}\n${t('transferModal.amountSentDetail')}: ${result.amount_sent} XOF\n${t('transferModal.feesDetail')}: ${result.fees} XOF`
        : t('transferModal.transferSuccess');
      showAlert(t('common.success'), msg, [{ text: 'OK', onPress: onClose }]);
      setAmount('');
      setOperator('');
      setPhone('');
    } catch (error: any) {
      const msg = error?.response?.data?.error
        || error?.response?.data?.message
        || (error?.code === 'ECONNABORTED' ? t('transferModal.requestTimeout') : null)
        || t('transferModal.transferError');
      showAlert(t('common.error'), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveModal visible={visible} onClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: Platform.OS === 'web' ? undefined : 1 }}
        enabled={Platform.OS !== 'web'}
      >
          <View style={[styles.sheet, { flex: Platform.OS === 'web' ? undefined : 1, paddingBottom: Math.max(insets.bottom, Spacing.lg), paddingTop: Spacing.lg }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('transferModal.title2')}</Text>
            <TouchableOpacity onPress={handleClose}>
              <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ paddingBottom: Spacing.xl }}>
            {user?.validate !== 1 && (
              <View style={styles.kycBanner}>
                <FontAwesome6 name="triangle-exclamation" size={14} color={Colors.warning} style={{ marginRight: 8 }} />
                <Text style={styles.kycBannerText}>{t('transferModal.kycRequired')}</Text>
              </View>
            )}
            <Text style={styles.operatorLabel}>{t('transferModal.chooseOperator')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.operatorScroll}
              contentContainerStyle={styles.operatorScrollContent}
            >
              {displayOperators.map((op) => (
                <TouchableOpacity
                  key={op.id}
                  style={[styles.operatorCard, operator === op.id && styles.operatorSelected]}
                  onPress={() => setOperator(op.id)}
                >
                  <Image source={op.logo} style={styles.operatorLogo} resizeMode="contain" />
                  <Text style={styles.operatorFlag}>{op.flag}</Text>
                  <Text style={[styles.operatorName, operator === op.id && styles.operatorNameSelected]}>
                    {op.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.balanceRow}>
              <FontAwesome6 name="wallet" size={12} color={Colors.textMuted} />
              <Text style={styles.balanceText}>{t('transferModal.availableBalance')} : </Text>
              <Text style={styles.balanceAmount}>{fmt(balance ?? 0)} XOF</Text>
            </View>

            <Input
              label={t('transferModal.amountLabel')}
              placeholder={t('transferModal.amountPlaceholder')}
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
              keyboardType="numeric"
            />

            {/* Frais en live */}
            {showFees ? (
              <View style={styles.feesBox}>
                <View style={styles.feesRow}>
                  <Text style={styles.feesLabel}>{t('transferModal.fees')} ({(feeRate * 100).toFixed(0)}%)</Text>
                  <Text style={[styles.feesValue, { color: Colors.error }]}>+ {fmt(fees)} XOF</Text>
                </View>
                <View style={[styles.feesRow, styles.feesTotalRow]}>
                  <Text style={styles.feesTotalLabel}>{t('transferModal.totalDebited')}</Text>
                  <Text style={styles.feesTotalValue}>{fmt(total)} XOF</Text>
                </View>
              </View>
            ) : null}

            <Input
              label={t('transferModal.phoneLabel')}
              placeholder={t('transferModal.phonePlaceholder')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <View style={styles.savedActionsRow}>
              {!!normalizedPhone && !savedPhones.some((item) => item.tel.replace(/\s+/g, '') === normalizedPhone) && (
                <Button
                  variant="secondary"
                  icon="bookmark"
                  title={t('transferModal.saveThisNumber')}
                  onPress={saveCurrentPhone}
                  style={styles.saveBtnSmall}
                  textStyle={styles.saveBtnText}
                />
              )}
              {savedPhones.some((item) => item.tel.replace(/\s+/g, '') === normalizedPhone) && (
                <TouchableOpacity style={styles.savedActionBtn} onPress={removeCurrentPhone}>
                  <FontAwesome6 name="trash" size={12} color={Colors.error} />
                  <Text style={[styles.savedActionText, { color: Colors.error }]}>{t('common.delete')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {savedPhones.length > 0 && (
              <View style={styles.savedBlock}>
                <Text style={styles.savedLabel}>{t('transferModal.savedNumbers')}</Text>
                <View style={styles.savedList}>
                  {savedPhones.map((item) => {
                    const normalizedItemTel = item.tel.replace(/\s+/g, '').trim();
                    const selected = !!normalizedPhone && normalizedPhone === normalizedItemTel;
                    return (
                      <TouchableOpacity
                        key={item.id}
                        style={[styles.savedChip, selected && styles.savedChipSelected]}
                        onPress={() => setPhone(selected ? '' : item.tel)}
                      >
                        <Text style={[styles.savedChipText, selected && styles.savedChipTextSelected]}>
                          {item.name?.trim() ? `${item.name} · ${item.tel}` : item.tel}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {savedPhonesLoadError && savedPhones.length === 0 && (
              <Text style={styles.savedErrorText}>{savedPhonesLoadError}</Text>
            )}

            <Button
              title={t('common.send')}
              onPress={handlePressEnvoyer}
              icon="paper-plane"
              loading={loading}
              disabled={!amount || !operator || !phone}
              style={{ marginTop: Spacing.lg }}
            />
          </ScrollView>
          </View>
      </KeyboardAvoidingView>

      {/* Modal de confirmation */}
      <Modal visible={confirmVisible} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>{t('transferModal.confirmTitle')}</Text>
            <Text style={styles.confirmSubtitle}>{t('transferModal.confirmHint')}</Text>

            <Text style={styles.confirmAmountLabel}>{t('transferModal.amountSent')}</Text>
            <Text style={styles.confirmAmount}>{fmt(numAmount)}</Text>
            <Text style={styles.confirmAmountCurrency}>XOF</Text>

            <Text style={styles.confirmPhoneLabel}>{t('transferModal.recipient')}</Text>
            <Text style={styles.confirmPhone}>{phone || '—'}</Text>

            {selectedOp && (
              <View style={styles.confirmOpRow}>
                <Image source={selectedOp.logo} style={styles.confirmOpLogo} resizeMode="contain" />
                <Text style={styles.confirmOpName}>{selectedOp.flag} {selectedOp.name}</Text>
              </View>
            )}

            <View style={styles.confirmFeesBox}>
              <View style={styles.feesRow}>
                <Text style={styles.feesLabel}>{t('transferModal.fees')} ({(feeRate * 100).toFixed(0)}%)</Text>
                <Text style={[styles.feesValue, { color: Colors.error }]}>+ {fmt(fees)} XOF</Text>
              </View>
              <View style={[styles.feesRow, styles.feesTotalRow]}>
                <Text style={styles.feesTotalLabel}>{t('transferModal.totalDebited')}</Text>
                <Text style={styles.feesTotalValue}>{fmt(total)} XOF</Text>
              </View>
            </View>

            {/* Checkbox confirmation */}
            <TouchableOpacity style={styles.checkRow} onPress={() => setConfirmed((v) => !v)}>
              <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
                {confirmed && <FontAwesome6 name="check" size={10} color={Colors.white} />}
              </View>
              <Text style={styles.checkLabel}>{t('transferModal.checkConfirm')}</Text>
            </TouchableOpacity>

            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmVisible(false)}>
                <Text style={styles.cancelBtnText}>{t('transferModal.modify')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, !confirmed && styles.confirmBtnDisabled]}
                onPress={confirmed ? handleTransfer : undefined}
              >
                <FontAwesome6 name="paper-plane" size={14} color={Colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.confirmBtnText}>{t('transferModal.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={savePhoneModalVisible} transparent animationType="fade" onRequestClose={() => setSavePhoneModalVisible(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>{t('transferModal.saveThisNumber')}</Text>
            <Text style={styles.confirmSubtitle}>{t('transferModal.saveNumberHint')}</Text>
            <Input
              label={t('transferModal.nameLabel')}
              placeholder={t('transferModal.labelPlaceholder')}
              value={savePhoneName}
              onChangeText={setSavePhoneName}
              containerStyle={{ alignSelf: 'stretch' }}
            />
            <Text style={styles.saveOpLabel}>{t('transferModal.operatorRequired')}</Text>
            {isDesktop ? (
              <View style={styles.saveOpGrid}>
                {OPERATORS.filter((op) => op.withdraw).map((op) => (
                  <TouchableOpacity
                    key={op.id}
                    style={[styles.saveOpChip, savePhoneOperator === op.id && styles.saveOpChipSelected]}
                    onPress={() => setSavePhoneOperator(op.id)}
                  >
                    <Image source={op.logo} style={styles.saveOpLogo} resizeMode="contain" />
                    <Text style={[styles.saveOpChipText, savePhoneOperator === op.id && styles.saveOpChipTextSelected]} numberOfLines={2}>
                      {op.flag} {op.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.saveOpScroll} contentContainerStyle={styles.saveOpScrollContent}>
                {OPERATORS.filter((op) => op.withdraw).map((op) => (
                  <TouchableOpacity
                    key={op.id}
                    style={[styles.saveOpChip, savePhoneOperator === op.id && styles.saveOpChipSelected]}
                    onPress={() => setSavePhoneOperator(op.id)}
                  >
                    <Image source={op.logo} style={styles.saveOpLogo} resizeMode="contain" />
                    <Text style={[styles.saveOpChipText, savePhoneOperator === op.id && styles.saveOpChipTextSelected]} numberOfLines={2}>
                      {op.flag} {op.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSavePhoneModalVisible(false)}>
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, !savePhoneOperator && styles.confirmBtnDisabled]} onPress={confirmSaveCurrentPhone} disabled={savePhoneLoading || !savePhoneOperator}>
                <FontAwesome6 name="floppy-disk" size={14} color={Colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.confirmBtnText}>{savePhoneLoading ? t('common.saving') : t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <CustomAlert />
    </ResponsiveModal>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  sheet: {
    backgroundColor: Colors.background,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  kycBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '20',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  kycBannerText: {
    flex: 1,
    color: Colors.warning,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
  },
  operatorLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    marginBottom: Spacing.sm,
  },
  operatorScroll: {
    marginBottom: Spacing.md,
    marginHorizontal: -Spacing.lg,
  },
  operatorScrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  operatorCard: {
    width: 90,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
    gap: Spacing.xs,
  },
  operatorSelected: {
    borderColor: Colors.secondary,
    backgroundColor: 'rgba(244,178,40,0.1)',
  },
  operatorLogo: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
  },
  operatorName: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
  },
  operatorFlag: {
    fontSize: 22,
    textAlign: 'center',
  },
  operatorNameSelected: {
    color: Colors.secondary,
  },
  savedBlock: {
    marginBottom: Spacing.md,
  },
  savedLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    marginBottom: Spacing.xs,
  },
  savedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  savedChip: {
    backgroundColor: Colors.inputBg,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
  },
  savedChipSelected: {
    borderColor: Colors.secondary,
    backgroundColor: 'rgba(244,178,40,0.12)',
  },
  savedChipText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
  },
  savedChipTextSelected: {
    color: Colors.secondary,
  },
  savedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
  },
  savedActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  savedActionText: {
    color: Colors.secondary,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
  },
  saveBtnSmall: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    minHeight: 28,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  saveBtnText: {
    fontSize: FontSize.xs,
  },
  savedErrorText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    marginBottom: Spacing.sm,
  },
  // Solde disponible
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  balanceText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  balanceAmount: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
    color: Colors.secondary,
  },
  // Frais live
  feesBox: {
    backgroundColor: Colors.secondary + '18',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.secondary + '40',
  },
  feesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feesLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
  },
  feesValue: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  feesTotalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs,
    marginTop: Spacing.xs,
  },
  feesTotalLabel: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
  },
  feesTotalValue: {
    color: Colors.secondary,
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
  },
  // Modal confirmation
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  confirmSheet: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.secondary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  confirmSubtitle: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  confirmAmountLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  confirmAmount: {
    fontSize: 56,
    fontFamily: Fonts.bold,
    color: Colors.text,
    lineHeight: 64,
  },
  confirmAmountCurrency: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    letterSpacing: 2,
    marginBottom: Spacing.lg,
  },
  confirmPhoneLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  confirmPhone: {
    fontSize: 32,
    fontFamily: Fonts.bold,
    color: Colors.secondary,
    marginBottom: Spacing.md,
  },
  confirmOpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  confirmOpLogo: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
  },
  confirmOpName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
  },
  confirmFeesBox: {
    width: '100%',
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    width: '100%',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  checkLabel: {
    flex: 1,
    color: Colors.error,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.text,
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.md,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmBtnText: {
    color: Colors.white,
    fontFamily: Fonts.bold,
    fontSize: FontSize.md,
  },
  // Sélecteur opérateur dans le modal de sauvegarde
  saveOpLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  saveOpScroll: {
    marginHorizontal: -Spacing.lg,
    marginBottom: Spacing.xs,
  },
  saveOpScrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  saveOpGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  saveOpChip: {
    width: 80,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.inputBg,
    borderWidth: 2,
    borderColor: Colors.border,
    gap: 4,
  },
  saveOpChipSelected: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.secondary + '18',
  },
  saveOpLogo: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
  },
  saveOpChipText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontFamily: Fonts.medium ?? Fonts.regular,
    textAlign: 'center',
  },
  saveOpChipTextSelected: {
    color: Colors.secondary,
    fontFamily: Fonts.semiBold,
  },
});
