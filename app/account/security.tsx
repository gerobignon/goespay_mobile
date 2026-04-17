import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ImageBackground,
  Clipboard,
  Image,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { usePinStore } from '../../src/stores/pinStore';
import { authService } from '../../src/services/authService';
import {
  isBiometricAvailable,
  clearPin,
  savePin,
  setLockMethod,
  getLockMethod,
  type LockMethod,
} from '../../src/services/secureAuthService';
import { Input } from '../../src/components/Input';
import { OtpInput } from '../../src/components/OtpInput';
import { Button } from '../../src/components/Button';
import { PinPad } from '../../src/components/PinPad';
import { ResponsiveModal } from '../../src/components/ResponsiveModal';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts } from '../../src/constants/theme';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { showAlert } from '../../src/stores/alertStore';
import { CustomAlert } from '../../src/components/CustomAlert';
import { useTheme } from '../../src/components/ThemeProvider';
import { useTranslation } from 'react-i18next';

export default function SecurityScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { user } = useAuthStore();
  const { setMethod } = usePinStore();
  const { t } = useTranslation();

  const [bioAvailable, setBioAvailable] = useState(false);
  const [currentLockMethod, setCurrentLockMethod] = useState<LockMethod>(null);

  // PIN modal
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinStep, setPinStep] = useState<'password' | 'enter' | 'confirm'>('password');
  const [pinPasswordCheck, setPinPasswordCheck] = useState('');
  const [pinPasswordError, setPinPasswordError] = useState<string | null>(null);
  const [pinPasswordLoading, setPinPasswordLoading] = useState(false);
  const [firstPin, setFirstPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinReset, setPinReset] = useState(false);

  // Password modal
  const [pwModalVisible, setPwModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwLoading, setPwLoading] = useState(false);

  // 2FA
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaModalVisible, setTwoFaModalVisible] = useState(false);
  const [twoFaStep, setTwoFaStep] = useState<'qr' | 'code' | 'disable' | 'recovery'>('qr');
  const [twoFaSecret, setTwoFaSecret] = useState('');
  const [twoFaQrUrl, setTwoFaQrUrl] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaDisablePassword, setTwoFaDisablePassword] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaRecoveryCodes, setTwoFaRecoveryCodes] = useState<string[]>([]);

  useEffect(() => {
    isBiometricAvailable().then(setBioAvailable);
    getLockMethod().then(setCurrentLockMethod);
    authService.get2faStatus().then((s) => setTwoFaEnabled(s.enabled)).catch(() => {});
  }, []);

  const handleSwitchToBio = async () => {
    await setLockMethod('biometric');
    await clearPin();
    await setMethod('biometric');
    setCurrentLockMethod('biometric');
    showAlert(t('common.success'), t('account.biometricEnabled'));
  };

  const handleSwitchToPin = () => {
    setPinStep('password');
    setPinPasswordCheck('');
    setPinPasswordError(null);
    setFirstPin('');
    setPinError(null);
    setPinModalVisible(true);
  };

  const handlePinPasswordCheck = async () => {
    if (!pinPasswordCheck.trim()) {
      setPinPasswordError(t('account.pinPasswordError'));
      return;
    }
    setPinPasswordLoading(true);
    try {
      await authService.login({ email: user!.email, password: pinPasswordCheck });
      setPinPasswordError(null);
      setPinStep('enter');
    } catch {
      setPinPasswordError(t('account.pinPasswordIncorrect'));
    } finally {
      setPinPasswordLoading(false);
    }
  };

  const handlePinFirst = (pin: string) => {
    setFirstPin(pin);
    setPinError(null);
    setPinReset((v) => !v);
    setPinStep('confirm');
  };

  const handlePinConfirm = async (pin: string) => {
    if (pin !== firstPin) {
      setPinError(t('account.pinMismatch'));
      setPinReset((v) => !v);
      setPinStep('enter');
      setFirstPin('');
      return;
    }
    await savePin(pin);
    await setLockMethod('pin');
    await setMethod('pin');
    setCurrentLockMethod('pin');
    setPinModalVisible(false);
    showAlert(t('common.success'), t('account.pinConfigured'));
  };

  const handleClosePwModal = () => {
    const hasData = !!currentPassword || !!newPassword || !!confirmPassword;
    if (hasData) {
      showAlert(t('account.cancelChange'), t('account.infoLost'), [
        { text: t('common.continue') },
        {
          text: t('common.quit'), onPress: () => {
            setPwModalVisible(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
          }
        },
      ]);
    } else {
      setPwModalVisible(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      showAlert(t('common.error'), t('account.enterCurrentPassword'));
      return;
    }
    if (newPassword.length < 6) {
      showAlert(t('common.error'), t('account.passwordMinLength'));
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert(t('common.error'), t('account.passwordMismatch'));
      return;
    }
    setPwLoading(true);
    try {
      await authService.changePassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      showAlert(t('common.success'), t('account.passwordChanged'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwModalVisible(false);
    } catch (error: any) {
      showAlert(
        t('common.error'),
        error?.response?.data?.error || error?.response?.data?.message || t('account.changePasswordError')
      );
    } finally {
      setPwLoading(false);
    }
  };

  const handleEnable2fa = async () => {
    setTwoFaLoading(true);
    try {
      const data = await authService.enable2fa();
      setTwoFaSecret(data.secret);
      setTwoFaQrUrl(data.qr_url || data.qr_svg || '');
      setTwoFaStep('qr');
      setTwoFaModalVisible(true);
    } catch (e: any) {
      showAlert(t('common.error'), e?.response?.data?.error || t('account.twoFaEnableError'));
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleConfirm2fa = async () => {
    if (twoFaCode.length !== 6) {
      showAlert(t('common.error'), t('account.twoFaEnter6digits'));
      return;
    }
    setTwoFaLoading(true);
    try {
      const res = await authService.confirm2fa(twoFaCode);
      setTwoFaEnabled(true);
      setTwoFaCode('');
      setTwoFaRecoveryCodes(res.recovery_codes ?? []);
      setTwoFaStep('recovery');
    } catch (e: any) {
      showAlert(t('common.error'), e?.response?.data?.error || t('account.twoFaCodeIncorrect'));
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleDisable2fa = async () => {
    if (!twoFaDisablePassword.trim()) {
      showAlert(t('common.error'), t('account.twoFaEnterPassword'));
      return;
    }
    setTwoFaLoading(true);
    try {
      await authService.disable2fa(twoFaDisablePassword);
      setTwoFaEnabled(false);
      setTwoFaModalVisible(false);
      setTwoFaDisablePassword('');
      showAlert(t('common.success'), t('account.twoFaDisabled'));
    } catch (e: any) {
      showAlert(t('common.error'), e?.response?.data?.error || t('account.twoFaPasswordIncorrect'));
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleCloseTwoFaModal = () => {
    const hasData = !!twoFaCode || !!twoFaDisablePassword;
    if (hasData) {
      showAlert(t('account.cancelConfig'), t('account.infoLost'), [
        { text: t('common.continue') },
        {
          text: t('common.quit'), onPress: () => {
            setTwoFaModalVisible(false);
            setTwoFaCode('');
            setTwoFaDisablePassword('');
          }
        },
      ]);
    } else {
      setTwoFaModalVisible(false);
      setTwoFaCode('');
      setTwoFaDisablePassword('');
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={isDark ? require('../../assets/bg_page.jpg') : require('../../assets/bg_page_light.jpg')}
        style={styles.background}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            {/* Header */}
            <View style={styles.header}>
              <TouchableOpacity onPress={() => router.back()}>
                <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
              </TouchableOpacity>
              <Text style={styles.title}>{t('account.security')}</Text>
            </View>

            <View style={styles.formCard}>
              <Text style={styles.sectionTitle}>
                <FontAwesome6 name="shield-halved" size={14} color={Colors.secondary} /> {t('account.security')}
              </Text>

              {/* PIN */}
              <TouchableOpacity style={styles.securityRow} onPress={handleSwitchToPin}>
                <View style={styles.securityIcon}>
                  <FontAwesome6 name="hashtag" size={16} color={currentLockMethod === 'pin' ? Colors.primary : Colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.securityLabel}>{t('account.pin')}</Text>
                  <Text style={styles.securityDesc}>
                    {currentLockMethod === 'pin' ? t('account.pinActive') : t('account.pinInactive')}
                  </Text>
                </View>
                {currentLockMethod === 'pin' && (
                  <FontAwesome6 name="circle-check" size={16} color={Colors.primary} />
                )}
              </TouchableOpacity>

              {/* Biométrie */}
              {bioAvailable && (
                <TouchableOpacity style={styles.securityRow} onPress={handleSwitchToBio}>
                  <View style={styles.securityIcon}>
                    <FontAwesome6 name="fingerprint" size={16} color={currentLockMethod === 'biometric' ? Colors.secondary : Colors.textMuted} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.securityLabel}>{t('account.biometric')}</Text>
                    <Text style={styles.securityDesc}>
                      {currentLockMethod === 'biometric' ? t('account.biometricActive') : t('account.biometricInactive')}
                    </Text>
                  </View>
                  {currentLockMethod === 'biometric' && (
                    <FontAwesome6 name="circle-check" size={16} color={Colors.secondary} />
                  )}
                </TouchableOpacity>
              )}

              {/* Mot de passe */}
              <TouchableOpacity style={styles.securityRow} onPress={() => setPwModalVisible(true)}>
                <View style={styles.securityIcon}>
                  <FontAwesome6 name="lock" size={16} color={Colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.securityLabel}>{t('account.password')}</Text>
                  <Text style={styles.securityDesc}>{t('account.changePassword')}</Text>
                </View>
                <FontAwesome6 name="chevron-right" size={14} color={Colors.textMuted} />
              </TouchableOpacity>

              {/* 2FA */}
              <TouchableOpacity
                style={styles.securityRow}
                onPress={() => {
                  if (twoFaEnabled) {
                    setTwoFaStep('disable');
                    setTwoFaModalVisible(true);
                  } else {
                    handleEnable2fa();
                  }
                }}
              >
                <View style={styles.securityIcon}>
                  <FontAwesome6 name="mobile-screen" size={16} color={twoFaEnabled ? Colors.success : Colors.textMuted} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.securityLabel}>{t('account.twoFa')}</Text>
                  <Text style={styles.securityDesc}>
                    {twoFaEnabled ? t('account.twoFaActive') : t('account.twoFaInactive')}
                  </Text>
                </View>
                {twoFaEnabled && (
                  <FontAwesome6 name="circle-check" size={16} color={Colors.success} />
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>

        {/* Modal 2FA */}
        <ResponsiveModal visible={twoFaModalVisible} onClose={handleCloseTwoFaModal}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {twoFaStep === 'disable' ? t('account.twoFaDisableTitle') : twoFaStep === 'recovery' ? t('account.twoFaRecoveryTitle') : t('account.twoFaTitle')}
              </Text>
              <TouchableOpacity onPress={handleCloseTwoFaModal}>
                <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {twoFaStep === 'qr' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.twoFaInstruction}>
                  {t('account.twoFaStep1')}{' '}{t('account.twoFaStep2')}
                </Text>
                {twoFaQrUrl ? (
                  <View style={{ alignSelf: 'center', marginVertical: Spacing.md, backgroundColor: '#ffffff', borderRadius: 12, padding: 10 }}>
                    {Platform.OS === 'web' ? (
                      <img
                        src={
                          twoFaQrUrl.startsWith('<svg') || twoFaQrUrl.startsWith('<SVG')
                            ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(twoFaQrUrl)}`
                            : twoFaQrUrl
                        }
                        width={150}
                        height={150}
                        style={{ borderRadius: 4, display: 'block' } as any}
                      />
                    ) : (
                      <Image source={{ uri: twoFaQrUrl }} style={{ width: 150, height: 150, borderRadius: 4 }} />
                    )}
                  </View>
                ) : null}
                <Text style={styles.twoFaInstruction}>{t('account.twoFaManualSecret')}</Text>
                <TouchableOpacity
                  style={styles.secretBox}
                  onPress={() => {
                    Clipboard.setString(twoFaSecret);
                    showAlert(t('common.copied'), t('account.secretCopied'));
                  }}
                >
                  <Text style={styles.secretText}>{twoFaSecret}</Text>
                  <Text style={styles.secretHint}>{t('account.twoFaCopySecret')}</Text>
                </TouchableOpacity>
                <Text style={[styles.twoFaInstruction, { marginTop: Spacing.md }]}>
                  {t('account.twoFaStep4')}
                </Text>
                <OtpInput value={twoFaCode} onChange={setTwoFaCode} onComplete={handleConfirm2fa} />
                <Button
                  title={t('common.confirm')}
                  onPress={handleConfirm2fa}
                  loading={twoFaLoading}
                  style={{ marginTop: Spacing.sm }}
                />
              </ScrollView>
            )}

            {twoFaStep === 'disable' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.twoFaInstruction}>{t('account.twoFaDisableHint')}</Text>
                <Input
                  label={t('account.password')}
                  value={twoFaDisablePassword}
                  onChangeText={setTwoFaDisablePassword}
                  secureTextEntry
                  placeholder="••••••••"
                />
                <Button
                  title={t('account.twoFaDisableSubmit')}
                  onPress={handleDisable2fa}
                  loading={twoFaLoading}
                  variant="outline"
                  style={{ marginTop: Spacing.sm }}
                />
              </ScrollView>
            )}

            {twoFaStep === 'recovery' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.twoFaInstruction, { color: Colors.warning ?? Colors.secondary, fontFamily: Fonts.bold }]}>
                  {t('account.twoFaRecoveryWarning')}
                </Text>
                <Text style={styles.twoFaInstruction}>{t('account.twoFaRecoveryHint')}</Text>
                <View style={styles.secretBox}>
                  {twoFaRecoveryCodes.map((code, i) => (
                    <Text key={i} style={[styles.secretText, { marginVertical: 2 }]}>{code}</Text>
                  ))}
                </View>
                <Button
                  title={t('account.twoFaRecoveryCopy')}
                  onPress={() => {
                    Clipboard.setString(twoFaRecoveryCodes.join('\n'));
                    showAlert(t('common.copied'), t('account.recoveryCopied'));
                  }}
                  style={{ marginTop: Spacing.md }}
                />
                <Button
                  title={t('account.twoFaRecoveryDone')}
                  onPress={() => setTwoFaModalVisible(false)}
                  variant="outline"
                  style={{ marginTop: Spacing.sm }}
                />
              </ScrollView>
            )}
          </View>
        </ResponsiveModal>

        {/* Modal PIN */}
        <ResponsiveModal visible={pinModalVisible} onClose={() => setPinModalVisible(false)}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {pinStep === 'password' ? t('account.pinModalConfirmIdentity') : pinStep === 'enter' ? t('account.pinModalNewPin') : t('account.pinModalConfirmPin')}
              </Text>
              <TouchableOpacity onPress={() => setPinModalVisible(false)}>
                <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {pinStep === 'password' && (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.twoFaInstruction}>
                  {t('account.pinModalPasswordHint', 'Entrez votre mot de passe pour modifier votre PIN.')}
                </Text>
                <Input
                  label={t('account.currentPassword')}
                  value={pinPasswordCheck}
                  onChangeText={setPinPasswordCheck}
                  secureTextEntry
                  placeholder="••••••••"
                  error={pinPasswordError || undefined}
                />
                <Button
                  title={t('common.next')}
                  onPress={handlePinPasswordCheck}
                  loading={pinPasswordLoading}
                  style={{ marginTop: Spacing.sm }}
                />
              </ScrollView>
            )}

            {(pinStep === 'enter' || pinStep === 'confirm') && (
              <View style={{ alignItems: 'center', paddingTop: Spacing.md }}>
                <PinPad
                  length={4}
                  onComplete={pinStep === 'enter' ? handlePinFirst : handlePinConfirm}
                  error={pinError}
                  reset={pinReset}
                  label={pinStep === 'enter' ? t('account.pinModalChoose4') : t('account.pinModalConfirmYourPin')}
                />
              </View>
            )}
          </View>
        </ResponsiveModal>

        {/* Modal mot de passe */}
        <ResponsiveModal visible={pwModalVisible} onClose={handleClosePwModal}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('account.changePasswordTitle')}</Text>
              <TouchableOpacity onPress={handleClosePwModal}>
                <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Input
                label={t('account.currentPassword')}
                placeholder="••••••••"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
              />
              <Input
                label={t('account.newPassword')}
                placeholder={t('account.passwordMinPlaceholder')}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              <Input
                label={t('account.confirmNewPassword')}
                placeholder="••••••••"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
              <Button
                title={t('account.changePasswordSubmit')}
                onPress={handleChangePassword}
                icon="lock"
                loading={pwLoading}
                style={{ marginTop: Spacing.sm }}
              />
            </ScrollView>
          </View>
        </ResponsiveModal>

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
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  securityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityLabel: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: Fonts.medium,
  },
  securityDesc: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    marginTop: 1,
  },
  modalSheet: {
    flex: Platform.OS === 'web' ? undefined : 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  twoFaInstruction: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  secretBox: {
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secretText: {
    color: Colors.secondary,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    letterSpacing: 2,
    textAlign: 'center',
  },
  secretHint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    marginTop: 4,
  },
});
