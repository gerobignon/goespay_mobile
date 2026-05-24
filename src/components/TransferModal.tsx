import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
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
  ActivityIndicator,
  AppState,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Input } from './Input';
import { Button } from './Button';
import { ResponsiveModal } from './ResponsiveModal';
import { walletService } from '../services/walletService';
import { useWalletStore } from '../stores/walletStore';
import { useAuthStore } from '../stores/authStore';
import { OPERATORS, isAfribapayDuplicate } from '../constants/config';
import { ALL_COUNTRIES } from '../constants/countries';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useResponsive } from '../hooks/useResponsive';
import { showAlert } from '../stores/alertStore';
import { CustomAlert } from './CustomAlert';
import type { SavedPhone } from '../types';
import { useTranslation } from 'react-i18next';

import { useConfigStore } from '../stores/configStore';
import { useCurrencyStore } from '../stores/currencyStore';
import { useFormatXof, useCurrencyCode } from '../utils/format';
import { AdminDisabledBanner } from './AdminDisabledBanner';
import { TransactionAlertBanner } from './TransactionAlertBanner';
import { GatewayBadge } from './GatewayBadge';
import { CountryPickerStep } from './CountryPickerStep';

interface TransferModalProps {
  visible: boolean;
  onClose: () => void;
}

export function TransferModal({ visible, onClose }: TransferModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const { isDesktop, isWide } = useResponsive();

  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
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
  const [pollingState, setPollingState] = useState<'idle' | 'pending' | 'success' | 'failed' | 'timeout'>('idle');
  const [pendingDetails, setPendingDetails] = useState<{ amount_sent: number; fees: number; phone: string } | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingTransferIdRef = useRef<number | null>(null);
  const consecutiveErrorsRef = useRef(0);
  const fetchBalance = useWalletStore((s) => s.fetchBalance);
  const balance = useWalletStore((s) => s.balance);
  const user = useAuthStore((s) => s.user);
  const countryFees = useConfigStore((s) => s.country_fees);
  const transferFeeDefault = useConfigStore((s) => s.transfer_fee_default);
  const transferMin = useConfigStore((s) => s.transfer_min);
  const transferMinWorld = useConfigStore((s) => s.transfer_min_world);
  const transferMinNg = useConfigStore((s) => s.transfer_min_ng);
  const afribapayEnabled = useConfigStore((s) => s.afribapay_enabled);
  const transferEnabled = useConfigStore((s) => s.transfer_enabled);
  const isAdmin = user?.group === 'admin';
  const userCurrency = useCurrencyCode();
  const convertToXof = useCurrencyStore((s) => s.convertToXof);
  const fmtXof = useFormatXof();

  // Admin bypass : voit toutes les passerelles, y compris désactivées (bandeau rouge en haut).
  const displayOperators = OPERATORS.filter(
    (op) => op.withdraw && !isAfribapayDuplicate(op) && (afribapayEnabled || isAdmin || !(op as any).afribapay)
  );

  const operatorsForStep = selectedCountry
    ? displayOperators.filter((op) => op.country === selectedCountry)
    : [];

  // L'utilisateur saisit en devise d'affichage. La conversion en XOF se fait
  // ici (canonique) pour les frais, validations et l'envoi backend.
  const numAmountDisplay = parseFloat(amount) || 0;
  const numAmount = userCurrency === 'XOF'
    ? Math.round(numAmountDisplay)
    : convertToXof(numAmountDisplay);
  const selectedOp = OPERATORS.find((op) => op.id === operator);
  const userCountry = user?.country?.toUpperCase();
  const feeConfig = (userCountry && countryFees[userCountry]) || transferFeeDefault;
  const fees = useMemo(
    () => Math.round(feeConfig.fixed + numAmount * feeConfig.percent / 100),
    [numAmount, feeConfig.fixed, feeConfig.percent]
  );
  const total = numAmount + fees;
  const feeLabel = feeConfig.fixed > 0
    ? `${fmtXof(feeConfig.fixed, { approx: false })} + ${feeConfig.percent}%`
    : `${feeConfig.percent}%`;

  const fmt = (n: number) => n.toLocaleString('fr-FR').replace(/\s/g, '.');

  const showFees = numAmount > 0 && operator;

  const dialCode = useMemo(() => {
    if (!selectedCountry) return '';
    const c = ALL_COUNTRIES.find((c) => c.code === selectedCountry);
    return c ? `+${c.phone}` : '';
  }, [selectedCountry]);

  const normalizedPhone = phone.replace(/\s+/g, '').trim();

  const loadSavedPhones = async () => {
    try {
      const data = await walletService.getSavedPhones({ type: 'transfer' });
      setSavedPhones(data);
      setSavedPhonesLoadError(null);
    } catch (error: any) {
      setSavedPhonesLoadError(t('account.phonesLoadError'));
    }
  };

  useEffect(() => {
    if (!visible) return;
    loadSavedPhones();
    setSelectedCountry(null);
    setOperator('');
    setPollingState('idle');
    setPendingDetails(null);
  }, [visible]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    pollingTransferIdRef.current = null;
    consecutiveErrorsRef.current = 0;
  }, []);

  const checkStatus = useCallback(async (transferId: number): Promise<boolean> => {
    try {
      const res = await walletService.getTransferStatus(transferId);
      consecutiveErrorsRef.current = 0;
      if (res.statut === 'success') {
        stopPolling();
        setPollingState('success');
        fetchBalance().catch(() => {});
        return true;
      } else if (res.statut === 'fail' || res.statut === 'failed') {
        stopPolling();
        setPollingState('failed');
        fetchBalance().catch(() => {});
        return true;
      }
    } catch {
      consecutiveErrorsRef.current++;
      if (consecutiveErrorsRef.current >= 5) {
        stopPolling();
        setPollingState('timeout');
        return true;
      }
    }
    return false;
  }, [fetchBalance, stopPolling]);

  const startPolling = useCallback((transferId: number) => {
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // 5 min max (toutes les 5s)
    setPollingState('pending');
    pollingTransferIdRef.current = transferId;
    consecutiveErrorsRef.current = 0;

    const poll = async () => {
      attempts++;
      const resolved = await checkStatus(transferId);
      if (resolved) return;
      if (attempts >= MAX_ATTEMPTS) {
        stopPolling();
        setPollingState('timeout');
      }
    };

    poll();
    pollingRef.current = setInterval(poll, 5000);
  }, [checkStatus, stopPolling]);

  // Vérification immédiate au retour foreground (mobile) ou onglet visible (web)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && pollingTransferIdRef.current && pollingState === 'pending') {
        checkStatus(pollingTransferIdRef.current);
      }
    });
    return () => sub.remove();
  }, [checkStatus, pollingState]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && pollingTransferIdRef.current && pollingState === 'pending') {
        checkStatus(pollingTransferIdRef.current);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [checkStatus, pollingState]);

  useEffect(() => () => stopPolling(), [stopPolling]);

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
    if (pollingState !== 'idle') {
      stopPolling();
      setPollingState('idle');
      onClose();
      return;
    }
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
      setAmount('');
      setOperator('');
      setPhone('');

      if (result?.transfer_id) {
        setPendingDetails({
          amount_sent: Number(result.amount_sent) || numAmount,
          fees: Number(result.fees) || fees,
          phone: normalizedPhone,
        });
        startPolling(result.transfer_id);
      } else {
        // Fallback rétrocompat si le backend ne renvoie pas encore transfer_id
        const msg = result?.message
          ? `${result.message}\n${t('transferModal.amountSentDetail')}: ${fmtXof(Number(result.amount_sent))}\n${t('transferModal.feesDetail')}: ${fmtXof(Number(result.fees))}`
          : t('transferModal.transferSuccess');
        showAlert(t('common.success'), msg, [{ text: 'OK', onPress: onClose }]);
      }
    } catch (error: any) {
      // Le transfert peut avoir abouti côté serveur même si la requête a échoué
      // (timeout passerelle, réponse mal formée, etc.). On rafraîchit le solde
      // pour refléter l'état réel et on invite l'utilisateur à vérifier l'historique.
      try { await fetchBalance(); } catch {}
      const isTimeout = error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '');
      const serverMsg = error?.response?.data?.error || error?.response?.data?.message;
      const msg = serverMsg
        || (isTimeout ? t('transferModal.requestTimeout') : t('transferModal.transferError'));
      showAlert(t('common.error'), msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveModal visible={visible} onClose={handleClose} disableBackdropClose={pollingState === 'pending' || loading}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        enabled={Platform.OS !== 'web'}
      >
          <View style={[styles.sheet, { flex: 1, paddingBottom: Math.max(insets.bottom, Spacing.lg), paddingTop: Spacing.lg }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('transferModal.title2')}</Text>
            <TouchableOpacity onPress={handleClose}>
              <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {pollingState === 'pending' && (
            <View style={styles.pollingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.pollingTitle}>{t('transferModal.processingTitle')}</Text>
              <Text style={styles.pollingMessage}>{t('transferModal.waitingConfirmation')}</Text>
              <Button title={t('transferModal.checkLater')} onPress={() => { stopPolling(); setPollingState('idle'); onClose(); }} style={{ marginTop: Spacing.lg }} />
            </View>
          )}

          {pollingState === 'success' && (
            <View style={styles.pollingContainer}>
              <FontAwesome6 name="circle-check" size={64} color={Colors.success} />
              <Text style={[styles.pollingTitle, { color: Colors.success }]}>{t('transferModal.transferConfirmed')}</Text>
              <Text style={styles.pollingMessage}>{t('transferModal.transferConfirmedMsg')}</Text>
              {pendingDetails && (
                <View style={[styles.feesBox, { width: '100%' }]}>
                  {!!pendingDetails.phone && (
                    <View style={styles.feesRow}>
                      <Text style={styles.feesLabel}>{t('transferModal.recipient')}</Text>
                      <Text style={styles.feesValue}>{pendingDetails.phone}</Text>
                    </View>
                  )}
                  <View style={styles.feesRow}>
                    <Text style={styles.feesLabel}>{t('transferModal.amountSentDetail')}</Text>
                    <Text style={styles.feesValue}>{fmtXof(pendingDetails.amount_sent)}</Text>
                  </View>
                  <View style={styles.feesRow}>
                    <Text style={styles.feesLabel}>{t('transferModal.feesDetail')}</Text>
                    <Text style={styles.feesValue}>{fmtXof(pendingDetails.fees)}</Text>
                  </View>
                  <View style={[styles.feesRow, styles.feesTotalRow]}>
                    <Text style={styles.feesTotalLabel}>{t('transferModal.totalDebited')}</Text>
                    <Text style={styles.feesTotalValue}>{fmtXof(pendingDetails.amount_sent + pendingDetails.fees)}</Text>
                  </View>
                </View>
              )}
              <Button title={t('common.close')} onPress={() => { setPollingState('idle'); setPendingDetails(null); onClose(); }} style={{ marginTop: Spacing.lg }} />
            </View>
          )}

          {pollingState === 'failed' && (
            <View style={styles.pollingContainer}>
              <FontAwesome6 name="circle-xmark" size={64} color={Colors.error ?? '#e53935'} />
              <Text style={[styles.pollingTitle, { color: Colors.error ?? '#e53935' }]}>{t('transferModal.transferFailedTitle')}</Text>
              <Text style={styles.pollingMessage}>{t('transferModal.transferFailedMsg')}</Text>
              <Button title={t('common.close')} onPress={() => { setPollingState('idle'); onClose(); }} style={{ marginTop: Spacing.lg }} />
            </View>
          )}

          {pollingState === 'timeout' && (
            <View style={styles.pollingContainer}>
              <FontAwesome6 name="clock" size={64} color={Colors.warning ?? '#F4B228'} />
              <Text style={[styles.pollingTitle, { color: Colors.warning ?? '#F4B228' }]}>{t('transferModal.processingTitle')}</Text>
              <Text style={styles.pollingMessage}>{t('transferModal.pollingTimeout')}</Text>
              <Button title={t('transferModal.viewHistory')} onPress={() => { setPollingState('idle'); onClose(); }} style={{ marginTop: Spacing.lg }} />
            </View>
          )}

          {pollingState === 'idle' && <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ paddingBottom: Spacing.xl }}>
            <TransactionAlertBanner type="transfer" />
            {isAdmin && !transferEnabled && (
              <AdminDisabledBanner message={t('admin.bannerTransfer')} />
            )}
            {isAdmin && transferEnabled && !afribapayEnabled && (
              <AdminDisabledBanner message={t('admin.bannerAfribapay')} />
            )}
            {user?.validate !== 1 && (
              <View style={styles.kycBanner}>
                <FontAwesome6 name="triangle-exclamation" size={14} color={Colors.warning} style={{ marginRight: 8 }} />
                <Text style={styles.kycBannerText}>{t('transferModal.kycRequired')}</Text>
              </View>
            )}
            {!selectedCountry ? (
              <CountryPickerStep
                operators={displayOperators}
                onSelectCountry={(code) => { setSelectedCountry(code); setOperator(''); }}
                label={t('transferModal.chooseCountry')}
              />
            ) : (
              <>
                <Text style={styles.operatorLabel}>{t('transferModal.chooseOperator')}</Text>
                <TouchableOpacity
                  onPress={() => { setSelectedCountry(null); setOperator(''); }}
                  style={styles.changeCountryBtn}
                >
                  <FontAwesome6 name="arrow-left" size={12} color={Colors.secondary} />
                  <Text style={styles.changeCountryText}>{t('transferModal.changeCountry')}</Text>
                </TouchableOpacity>
                {isDesktop ? (
              <View style={styles.operatorChipGrid}>
                {operatorsForStep.map((op) => (
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
                    <GatewayBadge op={op} visible={isAdmin} size={14} />
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
                {operatorsForStep.map((op) => (
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
                    <GatewayBadge op={op} visible={isAdmin} size={16} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
                )}
              </>
            )}

            <View style={styles.balanceRow}>
              <FontAwesome6 name="wallet" size={12} color={Colors.textMuted} />
              <Text style={styles.balanceText}>{t('transferModal.availableBalance')} : </Text>
              <Text style={styles.balanceAmount}>{fmtXof(balance ?? 0)}</Text>
            </View>

            <Input
              label={t('transferModal.amountLabel', { currency: userCurrency })}
              placeholder={`Min. ${fmtXof(
                (user?.country ?? '').toUpperCase() === 'NG'
                  ? transferMinNg
                  : (userCountry && countryFees[userCountry] ? transferMin : transferMinWorld)
              )}`}
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
              keyboardType="decimal-pad"
            />

            {/* Frais en live */}
            {showFees ? (
              <View style={styles.feesBox}>
                <View style={styles.feesRow}>
                  <Text style={styles.feesLabel}>{t('transferModal.fees')} ({feeLabel})</Text>
                  <Text style={[styles.feesValue, { color: Colors.error }]}>+ {fmtXof(fees)}</Text>
                </View>
                <View style={[styles.feesRow, styles.feesTotalRow]}>
                  <Text style={styles.feesTotalLabel}>{t('transferModal.totalDebited')}</Text>
                  <Text style={styles.feesTotalValue}>{fmtXof(total)}</Text>
                </View>
              </View>
            ) : null}

            <Input
              label={t('transferModal.phoneLabel')}
              placeholder={t('transferModal.phonePlaceholder')}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              prefix={dialCode || undefined}
            />
            {dialCode ? (
              <Text style={styles.phoneHint}>{t('transferModal.phoneHint')}</Text>
            ) : null}

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
          </ScrollView>}
          </View>
      </KeyboardAvoidingView>

      {/* Modal de confirmation */}
      <Modal visible={confirmVisible} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>{t('transferModal.confirmTitle')}</Text>
            <Text style={styles.confirmSubtitle}>{t('transferModal.confirmHint')}</Text>

            <Text style={styles.confirmAmountLabel}>{t('transferModal.amountSent')}</Text>
            <Text style={styles.confirmAmount}>{fmtXof(numAmount, { withCode: false })}</Text>
            <Text style={styles.confirmAmountCurrency}>{userCurrency}</Text>

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
                <Text style={styles.feesLabel}>{t('transferModal.fees')} ({feeLabel})</Text>
                <Text style={[styles.feesValue, { color: Colors.error }]}>+ {fmtXof(fees)}</Text>
              </View>
              <View style={[styles.feesRow, styles.feesTotalRow]}>
                <Text style={styles.feesTotalLabel}>{t('transferModal.totalDebited')}</Text>
                <Text style={styles.feesTotalValue}>{fmtXof(total)}</Text>
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
                {displayOperators.map((op) => (
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
                {displayOperators.map((op) => (
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
  changeCountryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: Spacing.sm,
  },
  changeCountryText: {
    color: Colors.secondary,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
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
  phoneHint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
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
    maxWidth: 480,
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
