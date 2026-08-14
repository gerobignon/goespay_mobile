import React, { useState, useEffect, useRef } from 'react';
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
import {
  isWebauthnAvailable,
  registerWebauthn,
  clearWebauthn,
} from '../../src/services/webauthnService';
import { Input } from '../../src/components/Input';
import { OtpInput } from '../../src/components/OtpInput';
import { Button } from '../../src/components/Button';
import { PinPad } from '../../src/components/PinPad';
import { ResponsiveModal } from '../../src/components/ResponsiveModal';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts } from '../../src/constants/theme';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { showAlert } from '../../src/stores/alertStore';
import { CustomAlert } from '../../src/components/CustomAlert';
import SettingsRow from '../../src/components/SettingsRow';
import { LocalAuthModal } from '../../src/components/LocalAuthModal';
import { useMessagingLock } from '../../src/hooks/useMessagingLock';
import { useMessagingAccess } from '../../src/hooks/useMessagingAccess';
import { useTheme } from '../../src/components/ThemeProvider';
import { useTranslation } from 'react-i18next';
import { useResponsive } from '../../src/hooks/useResponsive';
import { getApiErrorMessage } from '../../src/utils/apiError';

export default function SecurityScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { user, refreshProfile } = useAuthStore();
  const { setMethod } = usePinStore();
  const { t } = useTranslation();
  const canMessage = useMessagingAccess();
  const messagingLock = useMessagingLock();

  const [bioAvailable, setBioAvailable] = useState(false);
  const [webauthnAvailable, setWebauthnAvailable] = useState(false);
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

  // Méthode de connexion : code reçu par email (défaut) ou mot de passe.
  const hasPassword = user?.has_password !== false;
  const loginMethod = user?.login_method ?? 'otp';
  const [loginMethodLoading, setLoginMethodLoading] = useState(false);

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
  const twoFaSubmittingRef = useRef(false);
  const [twoFaRecoveryCodes, setTwoFaRecoveryCodes] = useState<string[]>([]);

  useEffect(() => {
    isBiometricAvailable().then(setBioAvailable);
    isWebauthnAvailable().then(setWebauthnAvailable);
    getLockMethod().then(setCurrentLockMethod);
    authService.get2faStatus().then((s) => setTwoFaEnabled(s.enabled)).catch(() => {});
  }, []);

  // Web : Face ID / Touch ID / Hello / clé de sécurité via WebAuthn — le
  // pendant de la biométrie native. L'enregistrement DOIT partir d'un geste
  // utilisateur, on l'appelle donc directement depuis le onPress.
  const handleEnableWebauthn = async () => {
    const registered = await registerWebauthn(user?.id ?? 'user', user?.email ?? 'GoesPay');
    if (!registered) {
      showAlert(t('common.error'), t('account.webauthnError'));
      return;
    }
    await clearPin();
    await setLockMethod('webauthn');
    await setMethod('webauthn');
    setCurrentLockMethod('webauthn');
    showAlert(t('common.success'), t('account.webauthnEnabled'));
  };

  const handleDisableWebauthn = async () => {
    await clearWebauthn();
    await setLockMethod(null);
    await setMethod(null);
    setCurrentLockMethod(null);
    showAlert(t('common.success'), t('account.webauthnDisabled'));
  };

  const handleWebauthnRow = () => {
    if (currentLockMethod === 'webauthn') {
      showAlert(t('account.webauthn'), '', [
        { text: t('account.pinDisable'), style: 'destructive', onPress: handleDisableWebauthn },
        { text: t('common.cancel') },
      ]);
      return;
    }
    handleEnableWebauthn();
  };

  const handleSwitchToBio = async () => {
    await setLockMethod('biometric');
    await clearPin();
    await setMethod('biometric');
    setCurrentLockMethod('biometric');
    showAlert(t('common.success'), t('account.biometricEnabled'));
  };

  // Le verrou est obligatoire sur natif, optionnel sur web : là seulement on
  // propose de le retirer.
  const handleDisablePin = async () => {
    await clearPin();
    await setLockMethod(null);
    await setMethod(null);
    setCurrentLockMethod(null);
    showAlert(t('common.success'), t('account.pinDisabled'));
  };

  const handlePinRow = () => {
    if (Platform.OS === 'web' && currentLockMethod === 'pin') {
      showAlert(t('account.pin'), '', [
        { text: t('account.pinChange'), onPress: handleSwitchToPin },
        { text: t('account.pinDisable'), style: 'destructive', onPress: handleDisablePin },
      ]);
      return;
    }
    handleSwitchToPin();
  };

  const handleSwitchToPin = () => {
    // Un compte qui se connecte par code email n'a pas de mot de passe à
    // redonner : sa session est déjà la preuve, on va droit au PIN.
    setPinStep(user?.has_password === false ? 'enter' : 'password');
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
      await authService.verifyIdentity({ password: pinPasswordCheck });
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

  const applyLoginMethod = async (method: 'otp' | 'password') => {
    if (loginMethodLoading || method === loginMethod) return;
    // Choisir le mot de passe suppose d'en avoir un : sinon on l'ouvre d'abord.
    if (method === 'password' && !hasPassword) {
      setPwModalVisible(true);
      return;
    }
    setLoginMethodLoading(true);
    try {
      await authService.setLoginMethod(method);
      await refreshProfile();
    } catch (error: any) {
      showAlert(t('common.error'), getApiErrorMessage(error, t, t('account.loginMethodError')));
    } finally {
      setLoginMethodLoading(false);
    }
  };

  const handleLoginMethodRow = () => {
    showAlert(t('account.loginMethod'), '', [
      { text: t('account.loginMethodOtp'), onPress: () => applyLoginMethod('otp') },
      { text: t('account.loginMethodPassword'), onPress: () => applyLoginMethod('password') },
    ]);
  };

  const handleChangePassword = async () => {
    // Premier mot de passe d'un compte « code email » : rien à confirmer,
    // il n'en a pas encore.
    if (hasPassword && !currentPassword.trim()) {
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
      showAlert(t('common.success'), hasPassword ? t('account.passwordChanged') : t('account.passwordCreated'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwModalVisible(false);
      await refreshProfile();
    } catch (error: any) {
      showAlert(
        t('common.error'),
        getApiErrorMessage(error, t, t('account.changePasswordError'))
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
    if (twoFaSubmittingRef.current) return;
    if (twoFaCode.length !== 6) {
      showAlert(t('common.error'), t('account.twoFaEnter6digits'));
      return;
    }
    setTwoFaLoading(true);
    twoFaSubmittingRef.current = true;
    try {
      const res = await authService.confirm2fa(twoFaCode);
      setTwoFaEnabled(true);
      setTwoFaCode('');
      setTwoFaRecoveryCodes(res.recovery_codes ?? []);
      setTwoFaStep('recovery');
    } catch (e: any) {
      showAlert(t('common.error'), e?.response?.data?.error || t('account.twoFaCodeIncorrect'));
    } finally {
      twoFaSubmittingRef.current = false;
      setTwoFaLoading(false);
    }
  };

  /** Envoie un code par email pour prouver son identité (compte sans mot de passe). */
  const handleSendIdentityCode = async () => {
    setTwoFaLoading(true);
    try {
      await authService.requestIdentityCode();
      showAlert(t('auth.login.codeSentTitle'), t('auth.login.codeSentMessage', { email: user?.email ?? '' }));
    } catch (error: any) {
      showAlert(t('common.error'), getApiErrorMessage(error, t, t('auth.login.codeSendError')));
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleDisable2fa = async () => {
    if (!twoFaDisablePassword.trim()) {
      showAlert(t('common.error'), hasPassword ? t('account.twoFaEnterPassword') : t('account.twoFaEnterCode'));
      return;
    }
    setTwoFaLoading(true);
    try {
      await authService.disable2fa(hasPassword ? { password: twoFaDisablePassword } : { code: twoFaDisablePassword });
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

  const content = (
    <>
      {!isDesktop && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('account.security')}</Text>
        </View>
      )}
      {isDesktop && <Text style={styles.title}>{t('account.security')}</Text>}

      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>
          <FontAwesome6 name="shield-halved" size={14} color={Colors.secondary} /> {t('account.security')}
        </Text>

        {/* PIN */}
        <SettingsRow
          icon="hashtag"
          iconColor={currentLockMethod === 'pin' ? Colors.primary : Colors.textMuted}
          label={t('account.pin')}
          description={
            currentLockMethod === 'pin'
              ? Platform.OS === 'web'
                ? t('account.pinActiveWeb')
                : t('account.pinActive')
              : t('account.pinInactive')
          }
          onPress={handlePinRow}
          trailing={currentLockMethod === 'pin' ? (
            <FontAwesome6 name="circle-check" size={16} color={Colors.primary} />
          ) : undefined}
        />

        {/* Face ID / Touch ID / Hello / clé de sécurité (web) */}
        {webauthnAvailable && (
          <SettingsRow
            icon="fingerprint"
            iconColor={currentLockMethod === 'webauthn' ? Colors.secondary : Colors.textMuted}
            label={t('account.webauthn')}
            description={currentLockMethod === 'webauthn' ? t('account.pinActiveWeb') : t('account.pinInactive')}
            onPress={handleWebauthnRow}
            trailing={currentLockMethod === 'webauthn' ? (
              <FontAwesome6 name="circle-check" size={16} color={Colors.secondary} />
            ) : undefined}
          />
        )}

        {/* Biométrie */}
        {bioAvailable && (
          <SettingsRow
            icon="fingerprint"
            iconColor={currentLockMethod === 'biometric' ? Colors.secondary : Colors.textMuted}
            label={t('account.biometric')}
            description={currentLockMethod === 'biometric' ? t('account.biometricActive') : t('account.biometricInactive')}
            onPress={handleSwitchToBio}
            trailing={currentLockMethod === 'biometric' ? (
              <FontAwesome6 name="circle-check" size={16} color={Colors.secondary} />
            ) : undefined}
          />
        )}

        {/* Verrou de la messagerie (optionnel) */}
        {canMessage && (
          <SettingsRow
            icon="comments"
            iconColor={messagingLock.enabled ? Colors.secondary : Colors.textMuted}
            label={t('account.messagesLock')}
            description={messagingLock.enabled ? t('account.messagesLockActive') : t('account.messagesLockInactive')}
            onPress={messagingLock.toggle}
            trailing={messagingLock.enabled ? (
              <FontAwesome6 name="circle-check" size={16} color={Colors.secondary} />
            ) : undefined}
          />
        )}

        {/* Méthode de connexion */}
        <SettingsRow
          icon={loginMethod === 'password' ? 'key' : 'envelope'}
          iconColor={Colors.secondary}
          label={t('account.loginMethod')}
          description={loginMethod === 'password' ? t('account.loginMethodPassword') : t('account.loginMethodOtp')}
          onPress={handleLoginMethodRow}
          trailing={<FontAwesome6 name="chevron-right" size={14} color={Colors.textMuted} />}
        />

        {/* Mot de passe */}
        <SettingsRow
          icon="lock"
          label={t('account.password')}
          description={hasPassword ? t('account.changePassword') : t('account.setPassword')}
          onPress={() => setPwModalVisible(true)}
          trailing={<FontAwesome6 name="chevron-right" size={14} color={Colors.textMuted} />}
        />

        {/* 2FA */}
        <SettingsRow
          icon="mobile-screen"
          iconColor={twoFaEnabled ? Colors.success : Colors.textMuted}
          label={t('account.twoFa')}
          description={twoFaEnabled ? t('account.twoFaActive') : t('account.twoFaInactive')}
          onPress={() => {
            if (twoFaEnabled) {
              setTwoFaStep('disable');
              setTwoFaModalVisible(true);
            } else {
              handleEnable2fa();
            }
          }}
          trailing={twoFaEnabled ? (
            <FontAwesome6 name="circle-check" size={16} color={Colors.success} />
          ) : undefined}
        />
      </View>
    </>
  );

  const modals = (
    <>
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
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Spacing.xl }}>
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
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Spacing.xl }}>
              <Text style={styles.twoFaInstruction}>
                {hasPassword ? t('account.twoFaDisableHint') : t('account.twoFaDisableHintCode')}
              </Text>
              {hasPassword ? (
                <Input
                  label={t('account.password')}
                  value={twoFaDisablePassword}
                  onChangeText={setTwoFaDisablePassword}
                  secureTextEntry
                  placeholder="••••••••"
                />
              ) : (
                <>
                  <OtpInput value={twoFaDisablePassword} onChange={setTwoFaDisablePassword} onComplete={handleDisable2fa} />
                  <Button
                    title={t('auth.login.sendCode')}
                    onPress={handleSendIdentityCode}
                    variant="outline"
                    style={{ marginTop: Spacing.md }}
                  />
                </>
              )}
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
            <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: Spacing.xl }}>
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
            <Text style={styles.modalTitle}>{hasPassword ? t('account.changePasswordTitle') : t('account.setPasswordTitle')}</Text>
            <TouchableOpacity onPress={handleClosePwModal}>
              <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {hasPassword && (
              <Input
                label={t('account.currentPassword')}
                placeholder="••••••••"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
              />
            )}
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
              title={hasPassword ? t('account.changePasswordSubmit') : t('account.setPasswordSubmit')}
              onPress={handleChangePassword}
              icon="lock"
              loading={pwLoading}
              style={{ marginTop: Spacing.sm }}
            />
          </ScrollView>
        </View>
      </ResponsiveModal>

      {/* Lever le verrou de la messagerie demande la même preuve que l'ouvrir. */}
      <LocalAuthModal
        visible={messagingLock.askConfirm}
        title={t('security.messagesLockDisableTitle')}
        onSuccess={messagingLock.confirmDisable}
        onClose={messagingLock.cancelConfirm}
      />
    </>
  );

  if (isDesktop) {
    return (
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: 0 }]} keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
        {modals}
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
        {modals}
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
