import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Linking,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { ResponsiveModal } from './ResponsiveModal';
import { FontAwesome6 } from '@expo/vector-icons';
import { Input } from './Input';
import { Button } from './Button';
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

interface DepositModalProps {
  visible: boolean;
  onClose: () => void;
  prefill?: { amount?: string; operator?: string; phone?: string };
}

export function DepositModal({ visible, onClose, prefill }: DepositModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const { isDesktop } = useResponsive();

  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [pollingState, setPollingState] = useState<'idle' | 'pending' | 'success' | 'failed' | 'timeout'>('idle');
  const [pollingMessage, setPollingMessage] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingDepositIdRef = useRef<number | null>(null);
  const consecutiveErrorsRef = useRef(0);
  const fetchBalance = useWalletStore((s) => s.fetchBalance);
  const user = useAuthStore((s) => s.user);
  // Garde une trace si l'utilisateur a vidé/modifié le champ téléphone manuellement
  const phoneUserEditedRef = useRef(false);
  // Numéros enregistrés (type deposit)
  const [savedPhones, setSavedPhones] = useState<SavedPhone[]>([]);
  const [savedPhonesLoadError, setSavedPhonesLoadError] = useState<string | null>(null);
  const [savePhoneModalVisible, setSavePhoneModalVisible] = useState(false);
  const [savePhoneName, setSavePhoneName] = useState('');
  const [savePhoneOperator, setSavePhoneOperator] = useState('');
  const [savePhoneLoading, setSavePhoneLoading] = useState(false);

  // Réinitialise les champs à chaque ouverture et pré-remplit le téléphone profil
  useEffect(() => {
    if (!visible) return;
    setAmount(prefill?.amount ?? '');
    setOperator(prefill?.operator ?? '');
    setOtp('');
    setPollingState('idle');
    setPollingMessage('');
    setSavedPhones([]);
    setSavedPhonesLoadError(null);
    setSavePhoneModalVisible(false);
    setSavePhoneName('');
    setSavePhoneOperator('');
    phoneUserEditedRef.current = false;
    const defaultPhone = prefill?.phone ?? (user?.phone ?? '').trim();
    setPhone(defaultPhone);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    pollingDepositIdRef.current = null;
    consecutiveErrorsRef.current = 0;
  }, []);

  // Vérification unique du statut (utilisée par le polling et au retour foreground)
  const checkStatus = useCallback(async (depositId: number): Promise<boolean> => {
    try {
      const res = await walletService.getDepositStatus(depositId);
      try { console.log(`[Deposit Polling] statut="${res.statut}"`, JSON.stringify(res)); } catch {}
      consecutiveErrorsRef.current = 0;
      if (res.statut === 'success') {
        stopPolling();
        setPollingState('success');
        fetchBalance().catch(() => {});
        return true;
      } else if (res.statut === 'fail' || res.statut === 'failed') {
        stopPolling();
        setPollingState('failed');
        setPollingMessage(t('depositModal.paymentFailed'));
        return true;
      }
    } catch (err: any) {
      consecutiveErrorsRef.current++;
      console.log(`[Deposit Polling] error (${consecutiveErrorsRef.current}):`, err?.response?.status, err?.message);
      // Après 5 erreurs consécutives → timeout
      if (consecutiveErrorsRef.current >= 5) {
        stopPolling();
        setPollingState('timeout');
        setPollingMessage('');
        return true;
      }
    }
    return false;
  }, [fetchBalance, stopPolling]);

  const startPolling = useCallback((depositId: number) => {
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // 5 min max (toutes les 5s)
    setPollingState('pending');
    pollingDepositIdRef.current = depositId;
    consecutiveErrorsRef.current = 0;

    const poll = async () => {
      attempts++;
      console.log(`[Deposit Polling] attempt ${attempts}/${MAX_ATTEMPTS} for deposit #${depositId}`);
      const resolved = await checkStatus(depositId);
      if (resolved) return;
      if (attempts >= MAX_ATTEMPTS) {
        stopPolling();
        setPollingState('timeout');
        setPollingMessage('');
      }
    };

    // Poll immédiatement, puis toutes les 5s
    poll();
    pollingRef.current = setInterval(poll, 5000);
  }, [checkStatus, stopPolling]);

  // Quand l'app revient au premier plan, vérifier immédiatement le statut
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && pollingDepositIdRef.current && pollingState === 'pending') {
        console.log('[Deposit] App foregrounded, checking status immediately');
        checkStatus(pollingDepositIdRef.current);
      }
    });
    return () => sub.remove();
  }, [checkStatus, pollingState]);

  // Sur web : vérifier au retour sur l'onglet (setInterval throttled quand onglet inactif)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && pollingDepositIdRef.current && pollingState === 'pending') {
        console.log('[Deposit] Tab visible, checking status immediately');
        checkStatus(pollingDepositIdRef.current);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [checkStatus, pollingState]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Filter operators by user's country (admins and unvalidated users see all)
  const userCountry = user?.country ?? '';
  const isAdmin = user?.group === 'admin';
  const isKycValidated = user?.validate === 1;
  const mobileMoneyCountries = ['BJ', 'BF', 'CI', 'TG', 'SN', 'ML', 'CM'];
  const showCard = isAdmin || !isKycValidated || !mobileMoneyCountries.includes(userCountry);
  const filteredOperators = (isAdmin || !isKycValidated)
    ? [...OPERATORS]
    : [
        ...OPERATORS.filter((op) => op.country === userCountry),
        ...(showCard ? OPERATORS.filter((op) => op.id === 'card') : []),
      ];
  const displayOperators = filteredOperators.length > 0 ? filteredOperators : OPERATORS;

  const needsOtp = operator === 'orange-money-burkina';
  const isCard = operator === 'card';

  const normalizedPhone = phone.replace(/\s+/g, '').trim();

  // Charge les numéros enregistrés pour cet opérateur dès qu'un opérateur non-card est sélectionné
  useEffect(() => {
    if (!visible || operator === 'card') {
      setSavedPhones([]);
      return;
    }
    walletService.getSavedPhones({ type: 'deposit' }).then((data) => {
      setSavedPhones(data);
      setSavedPhonesLoadError(null);
    }).catch((error: any) => {
      console.log('[DepositSavedPhones] load error:', error?.response?.status, error?.message);
      setSavedPhonesLoadError(t('account.phonesLoadError'));
    });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveCurrentPhone = () => {
    if (!normalizedPhone) return;
    const existing = savedPhones.find((item) => item.tel.replace(/\s+/g, '') === normalizedPhone);
    if (existing) return;
    setSavePhoneName('');
    setSavePhoneOperator(operator);
    setSavePhoneModalVisible(true);
  };

  const removeCurrentPhone = () => {
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
    if (!normalizedPhone || !savePhoneOperator) {
      showAlert(t('common.error'), t('depositModal.selectOperator'));
      return;
    }
    const existing = savedPhones.find((item) => item.tel.replace(/\s+/g, '') === normalizedPhone);
    if (existing) { setSavePhoneModalVisible(false); return; }
    setSavePhoneLoading(true);
    try {
      const created = await walletService.createSavedPhone({
        tel: normalizedPhone,
        name: savePhoneName.trim(),
        type: 'deposit',
        operator: savePhoneOperator,
      });
      setSavedPhones((prev) => [created, ...prev]);
      setPhone(normalizedPhone);
      setSavePhoneModalVisible(false);
      setSavePhoneName('');
      showAlert(t('common.success'), t('depositModal.phoneSaved'));
    } catch (error: any) {
      showAlert(t('common.error'), error?.response?.data?.error || error?.response?.data?.message || t('depositModal.phoneSaveError'));
    } finally {
      setSavePhoneLoading(false);
    }
  };

  const handleClose = () => {
    // Afficher confirmation seulement si l'utilisateur a tapé du texte (montant, téléphone ou OTP)
    const hasUserInput = !!amount.trim() || !!phone.trim() || !!otp.trim();
    if (hasUserInput) {
      showAlert(
        t('depositModal.cancelDeposit'),
        t('depositModal.infoLost'),
        [
          { text: t('common.continue') },
          { text: t('common.quit'), onPress: onClose },
        ],
      );
    } else {
      onClose();
    }
  };

  const handleDeposit = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 1000) {
      showAlert(t('common.error'), t('depositModal.minAmount'));
      return;
    }
    if (!operator) {
      showAlert(t('common.error'), t('depositModal.selectOperator'));
      return;
    }
    if (!isCard && !phone.trim()) {
      showAlert(t('common.error'), t('account.enterPhoneNumber'));
      return;
    }
    setLoading(true);
    try {
      const payload: any = { amount: numAmount, moyen: operator };
      if (!isCard) payload.tel = phone.trim();
      if (needsOtp && otp) payload.otp = otp;
      const result = await walletService.deposit(payload);
      try { console.log('[Deposit] result:', JSON.stringify(result)); } catch {}

      const redirectUrl = result?.checkout_url || result?.url;
      if (redirectUrl) {
        Linking.openURL(redirectUrl).catch(() => {});
      }

      if (result?.deposit_id) {
        setPollingMessage(redirectUrl
          ? t('depositModal.waitingConfirmation')
          : t('depositModal.checkPhone')
        );
        startPolling(result.deposit_id);
      } else {
        await fetchBalance();
        showAlert(t('common.success'), result?.message || 'Votre dépôt a été initié.', [{ text: 'OK', onPress: onClose }]);
      }
      setAmount('');
      setOperator('');
      setPhone('');
      setOtp('');
    } catch (error: any) {
      try { console.log('[Deposit] error:', error?.response?.status, JSON.stringify(error?.response?.data)); } catch {}
      const msg = error?.response?.data?.error
        || error?.response?.data?.message
        || (error?.response?.data?.errors ? Object.values(error.response.data.errors).flat().join('\n') : null)
        || t('depositModal.depositError');
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
                <Text style={styles.title}>{t('depositModal.title')}</Text>
                <TouchableOpacity onPress={handleClose}>
                  <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

          {pollingState === 'pending' && (
            <View style={styles.pollingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.pollingTitle}>{t('depositModal.processing')}</Text>
              <Text style={styles.pollingMessage}>{pollingMessage}</Text>
              <Button title={t('depositModal.checkLater')} onPress={() => { stopPolling(); setPollingState('idle'); onClose(); }} style={{ marginTop: Spacing.lg }} />
            </View>
          )}

          {pollingState === 'success' && (
            <View style={styles.pollingContainer}>
              <FontAwesome6 name="circle-check" size={64} color={Colors.success} />
              <Text style={[styles.pollingTitle, { color: Colors.success }]}>{t('depositModal.paymentConfirmed')}</Text>
              <Text style={styles.pollingMessage}>{t('depositModal.balanceUpdated')}</Text>
              <Button title={t('common.close')} onPress={() => { setPollingState('idle'); onClose(); }} style={{ marginTop: Spacing.lg }} />
            </View>
          )}

          {pollingState === 'failed' && (
            <View style={styles.pollingContainer}>
              <FontAwesome6 name="circle-xmark" size={64} color={Colors.error ?? '#e53935'} />
              <Text style={[styles.pollingTitle, { color: Colors.error ?? '#e53935' }]}>{t('depositModal.paymentFailed2')}</Text>
              <Text style={styles.pollingMessage}>{pollingMessage}</Text>
              <Button title={t('common.retry')} onPress={() => setPollingState('idle')} style={{ marginTop: Spacing.lg }} />
            </View>
          )}

          {pollingState === 'timeout' && (
            <View style={styles.pollingContainer}>
              <FontAwesome6 name="clock" size={64} color={Colors.warning ?? '#F4B228'} />
              <Text style={[styles.pollingTitle, { color: Colors.warning ?? '#F4B228' }]}>{t('depositModal.processingTitle')}</Text>
              <Text style={styles.pollingMessage}>{t('depositModal.pollingTimeout')}</Text>
              <Button title={t('depositModal.viewHistory')} onPress={() => { setPollingState('idle'); onClose(); }} style={{ marginTop: Spacing.lg }} />
              <Button title={t('common.retry')} onPress={() => setPollingState('idle')} style={{ marginTop: Spacing.sm }} />
            </View>
          )}

          {pollingState === 'idle' && <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            {user?.validate !== 1 && (
              <View style={styles.kycBanner}>
                <FontAwesome6 name="triangle-exclamation" size={14} color={Colors.warning} style={{ marginRight: 8 }} />
                <Text style={styles.kycBannerText}>{t('depositModal.kycRequired')}</Text>
              </View>
            )}
            <Text style={styles.operatorLabel}>{t('depositModal.chooseOperator')}</Text>
            {isDesktop ? (
              <View style={styles.operatorChipGrid}>
                {displayOperators.map((op) => (
                  <TouchableOpacity
                    key={op.id}
                    style={[
                      styles.operatorChip,
                      operator === op.id && styles.operatorChipSelected,
                    ]}
                    onPress={() => setOperator(op.id)}
                  >
                    <Image source={op.logo} style={styles.operatorChipLogo} resizeMode="contain" />
                    <Text
                      style={[
                        styles.operatorChipText,
                        operator === op.id && styles.operatorChipTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {op.flag} {op.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.operatorScroll}
                contentContainerStyle={styles.operatorScrollContent}
              >
                {displayOperators.map((op) => (
                  <TouchableOpacity
                    key={op.id}
                    style={[
                      styles.operatorCard,
                      operator === op.id && styles.operatorSelected,
                    ]}
                    onPress={() => setOperator(op.id)}
                  >
                    <Image source={op.logo} style={styles.operatorLogo} resizeMode="contain" />
                    <Text style={styles.operatorFlag}>{op.flag}</Text>
                    <Text
                      style={[
                        styles.operatorName,
                        operator === op.id && styles.operatorNameSelected,
                      ]}
                    >
                      {op.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            <Input
              label={t('depositModal.amountLabel')}
              placeholder={t('depositModal.minDeposit')}
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
              keyboardType="numeric"
            />

            {!isCard && (
              <Input
                label={t('depositModal.phoneLabel')}
                placeholder={t('depositModal.phoneNumber')}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            )}

            {!isCard && !!normalizedPhone && !savedPhones.some((item) => item.tel.replace(/\s+/g, '') === normalizedPhone) && (
              <Button
                variant="secondary"
                icon="bookmark"
                title={t('depositModal.saveThisNumber')}
                onPress={saveCurrentPhone}
                style={styles.saveBtnSmall}
                textStyle={styles.saveBtnText}
              />
            )}
            {!isCard && savedPhones.some((item) => item.tel.replace(/\s+/g, '') === normalizedPhone) && (
              <TouchableOpacity style={styles.savedActionBtn} onPress={removeCurrentPhone}>
                <FontAwesome6 name="trash" size={12} color={Colors.error} />
                <Text style={[styles.savedActionText, { color: Colors.error }]}>{t('common.delete')}</Text>
              </TouchableOpacity>
            )}

            {!isCard && savedPhones.length > 0 && (
              <View style={styles.savedBlock}>
                <Text style={styles.savedLabel}>{t('depositModal.savedNumbers')}</Text>
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

            {!isCard && savedPhonesLoadError && savedPhones.length === 0 && (
              <Text style={styles.savedErrorText}>{savedPhonesLoadError}</Text>
            )}

            {!isCard && needsOtp && (
              <Input
                label={t('depositModal.otpLabel')}
                placeholder={t('depositModal.refPlaceholder')}
                value={otp}
                onChangeText={setOtp}
                keyboardType="numeric"
              />
            )}

            <Button
              title={t('depositModal.deposit')}
              onPress={user?.validate !== 1 ? () => showAlert(t('depositModal.kycRequired3'), t('depositModal.kycRequired2')) : handleDeposit}
              icon="arrow-down"
              loading={loading}
              disabled={!amount || !operator || (!isCard && !phone)}
              style={{ marginTop: Spacing.lg }}
            />
          </ScrollView>}
          </View>
      </KeyboardAvoidingView>
      <CustomAlert />

      <Modal visible={savePhoneModalVisible} transparent animationType="fade" onRequestClose={() => setSavePhoneModalVisible(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>{t('depositModal.saveThisNumber')}</Text>
            <Text style={styles.confirmSubtitle}>{t('depositModal.saveNumberHint')}</Text>
            <Input
              label={t('depositModal.nameLabel')}
              placeholder={t('depositModal.savePhoneLabel')}
              value={savePhoneName}
              onChangeText={setSavePhoneName}
              containerStyle={{ alignSelf: 'stretch' }}
            />
            <Text style={styles.saveOpLabel}>{t('depositModal.paymentMethod')}</Text>
            {isDesktop ? (
              <View style={styles.saveOpGrid}>
                {OPERATORS.filter((op) => op.id !== 'card').map((op) => (
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
                {OPERATORS.filter((op) => op.id !== 'card').map((op) => (
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
                {savePhoneLoading
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.confirmBtnText}>{t('common.save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  pollingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  pollingTitle: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
    textAlign: 'center',
  },
  pollingMessage: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
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
  operatorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  operatorChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  operatorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  operatorChipSelected: {
    borderColor: Colors.secondary,
    backgroundColor: 'rgba(244,178,40,0.12)',
  },
  operatorChipLogo: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  operatorChipText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium ?? Fonts.regular,
    color: Colors.text,
    flexShrink: 1,
  },
  operatorChipTextSelected: {
    color: Colors.secondary,
    fontFamily: Fonts.semiBold,
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
  // Numéros enregistrés
  savedBlock: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
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
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.pill ?? 20,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border ?? '#E0E0E0',
  },
  savedChipSelected: {
    backgroundColor: Colors.secondary + '20',
    borderColor: Colors.secondary,
  },
  savedChipText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontFamily: Fonts.medium ?? Fonts.regular,
  },
  savedChipTextSelected: {
    color: Colors.secondary,
    fontFamily: Fonts.semiBold,
  },
  savedErrorText: {
    fontSize: FontSize.xs,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  savedActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  savedActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  savedActionText: {
    fontSize: FontSize.xs,
    color: Colors.secondary,
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
  // Modal confirmation / save name
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  confirmSheet: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl ?? BorderRadius.lg,
    padding: Spacing.lg,
    width: '100%',
    gap: Spacing.sm,
  },
  confirmTitle: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 2,
  },
  confirmSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  confirmBtnText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.white,
  },
  confirmBtnDisabled: {
    opacity: 0.45,
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
    borderColor: 'transparent',
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
