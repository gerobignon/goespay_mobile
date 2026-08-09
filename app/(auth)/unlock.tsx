import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  ScrollView,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { GlassCard } from '../../src/components/GlassCard';
import { FontAwesome6 } from '@expo/vector-icons';
import { PinPad } from '../../src/components/PinPad';
import { Input } from '../../src/components/Input';
import { OtpInput } from '../../src/components/OtpInput';
import { usePinStore } from '../../src/stores/pinStore';
import {
  verifyPin,
  authenticateWithBiometric,
  isBiometricAvailable,
  getCredentials,
  clearAllSecureData,
} from '../../src/services/secureAuthService';
import { verifyWebauthn } from '../../src/services/webauthnService';
import { authService } from '../../src/services/authService';
import { Image } from 'react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts } from '../../src/constants/theme';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher';
import { showAlert } from '../../src/stores/alertStore';
import { getApiErrorMessage } from '../../src/utils/apiError';

export default function UnlockScreen() {
  const router = useRouter();
  const { lockMethod, unlock, clearPin } = usePinStore();
  const { logout, user } = useAuthStore();
  const styles = useThemedStyles(createStyles);
  const { height } = useWindowDimensions();
  const isSmallScreen = height <= 720;
  const { t } = useTranslation();

  const [error, setError] = useState<string | null>(null);
  const [resetTrigger, setResetTrigger] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [bioAvailable, setBioAvailable] = useState(false);
  const [resetModalVisible, setResetModalVisible] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [resetCodeSent, setResetCodeSent] = useState(false);

  // Un compte créé par la nouvelle inscription n'a pas de mot de passe : sa
  // preuve d'identité est un code envoyé par email (même mécanique que la 2FA).
  // On ne peut pas se contenter de la session ouverte — c'est précisément ce
  // que le verrou protège.
  const usesCodeProof = user?.has_password === false;

  useEffect(() => {
    isBiometricAvailable().then(setBioAvailable);
  }, []);

  // Tenter la biométrie automatiquement au montage si c'est la méthode
  // configurée. Pas pour WebAuthn : Safari/iOS exige un geste utilisateur,
  // une invite automatique serait rejetée — l'utilisateur appuie sur la carte.
  useEffect(() => {
    if (lockMethod === 'biometric') {
      handleBiometric();
    }
  }, [lockMethod]);

  const handleBiometric = async () => {
    const success = await authenticateWithBiometric();
    if (success) {
      unlock();
      router.replace('/(tabs)');
    } else {
      setError(t('auth.pin.biometricFailedShort'));
    }
  };

  const handleWebauthn = async () => {
    setError(null);
    const success = await verifyWebauthn();
    if (success) {
      unlock();
      router.replace('/(tabs)');
    } else {
      setError(t('auth.pin.biometricFailedShort'));
    }
  };

  const handlePin = async (pin: string) => {
    const valid = await verifyPin(pin);
    if (valid) {
      setError(null);
      unlock();
      router.replace('/(tabs)');
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 5) {
        // 5 erreurs → déconnexion complète
        await clearAllSecureData();
        await logout();
        router.replace('/(auth)/login');
        return;
      }
      setError(t('auth.pin.incorrectPin', { remaining: 5 - newAttempts }));
      setResetTrigger((v) => !v);
    }
  };

  const handleOpenResetModal = async () => {
    setResetModalVisible(true);
    if (!usesCodeProof || resetCodeSent) return;
    try {
      await authService.requestIdentityCode();
      setResetCodeSent(true);
    } catch (err: any) {
      showAlert(t('common.error'), getApiErrorMessage(err, t, t('auth.login.codeSendError')));
    }
  };

  const handleForgotPin = async () => {
    if (!resetPassword.trim()) {
      setResetPasswordError(usesCodeProof ? t('auth.login.enter6digits') : t('account.pinPasswordError'));
      return;
    }
    setResetLoading(true);
    setResetPasswordError(null);
    try {
      await authService.verifyIdentity(
        usesCodeProof ? { code: resetPassword } : { password: resetPassword },
      );
      await authService.resetPin();
      await clearPin();
      setResetModalVisible(false);
      // Sur web le verrou est optionnel : après réinitialisation on rend la
      // main à l'app, l'utilisateur reconfigure un PIN s'il le veut depuis
      // Réglages › Sécurité. Sur natif il reste obligatoire.
      router.replace(Platform.OS === 'web' ? '/(tabs)' : '/(auth)/setup-pin');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 401 || status === 422) {
        setResetPasswordError(
          usesCodeProof ? t('auth.login.incorrectCode') : t('account.pinPasswordIncorrect'),
        );
      } else {
        showAlert(t('common.error'), err.response?.data?.message || 'Erreur lors de la réinitialisation du PIN');
      }
    } finally {
      setResetLoading(false);
    }
  };

  const handleCloseResetModal = () => {
    setResetModalVisible(false);
    setResetPassword('');
    setResetPasswordError(null);
    setResetCodeSent(false);
  };

  const handleLogout = async () => {
    await clearAllSecureData();
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <ScreenBackground edges={['top', 'bottom']}>
      <LanguageSwitcher />
      <ScrollView
        contentContainerStyle={[styles.container, isSmallScreen && styles.containerSmall]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={require('../../assets/logo_min.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <GlassCard style={{ alignItems: 'center', gap: Spacing.lg }}>
        <Text style={styles.title}>
          {lockMethod === 'biometric'
            ? t('auth.pin.unlockBiometric', 'Déverrouillez avec Face ID / Touch ID')
            : lockMethod === 'webauthn'
              ? t('auth.pin.unlockWebauthn')
              : t('auth.pin.enterPin', 'Entrez votre PIN')}
        </Text>

        {lockMethod === 'pin' && (
          <PinPad
            length={4}
            onComplete={handlePin}
            error={error}
            reset={resetTrigger}
            onBiometric={bioAvailable && lockMethod === 'pin' ? undefined : undefined}
          />
        )}

        {(lockMethod === 'biometric' || lockMethod === 'webauthn') && (
          <View style={styles.bioContainer}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity
              style={styles.bioBtn}
              onPress={lockMethod === 'webauthn' ? handleWebauthn : handleBiometric}
            >
              <FontAwesome6 name="fingerprint" size={48} color={Colors.secondary} />
              <Text style={styles.bioText}>{t('auth.pin.tapToUnlock', 'Appuyer pour déverrouiller')}</Text>
            </TouchableOpacity>
          </View>
        )}
        </GlassCard>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity onPress={handleOpenResetModal} style={styles.forgotBtn}>
            <Text style={styles.forgotText}>
              <FontAwesome6 name="key" size={14} style={styles.forgotIcon} />
              {'  '}
              {lockMethod === 'webauthn' ? t('auth.pin.cantUnlock') : t('auth.pin.forgotPin', 'PIN oublié ?')}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>{t('account.logout')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal de confirmation PIN oublié */}
      <Modal
        visible={resetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseResetModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>🔄 {t('auth.pin.resetPin', 'Réinitialiser le PIN')}</Text>
            <Text style={styles.modalMessage}>
              {t('auth.pin.resetWarning', 'Cette action vous reconectera à votre compte. Vous devrez configurer un nouveau PIN.')}
            </Text>

            {usesCodeProof ? (
              <>
                <Text style={styles.modalMessage}>
                  {t('auth.login.codeHint', { email: user?.email })}
                </Text>
                <OtpInput
                  value={resetPassword}
                  onChange={(v) => { setResetPassword(v); setResetPasswordError(null); }}
                  onComplete={handleForgotPin}
                />
                {resetPasswordError ? <Text style={styles.error}>{resetPasswordError}</Text> : null}
              </>
            ) : (
              <Input
                label={t('account.currentPassword')}
                value={resetPassword}
                onChangeText={(v) => { setResetPassword(v); setResetPasswordError(null); }}
                secureTextEntry
                placeholder="••••••••"
                error={resetPasswordError || undefined}
              />
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalBtn, styles.cancelBtn]}
                onPress={handleCloseResetModal}
                disabled={resetLoading}
              >
                <Text style={styles.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalBtn, styles.confirmBtn]}
                onPress={handleForgotPin}
                disabled={resetLoading}
              >
                {resetLoading ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <Text style={styles.confirmText}>{t('common.confirm')}</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScreenBackground>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  bg: { flex: 1 },
  container: {
    flexGrow: 1,
    padding: Spacing.xl,
    paddingTop: 100,
    alignItems: 'center',
    gap: Spacing.xl,
  },
  containerSmall: {
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  logo: {
    width: 220,
    height: 63,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
  },
  bioContainer: {
    alignItems: 'center',
    gap: Spacing.lg,
  },
  bioBtn: {
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  bioText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
  },
  error: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  buttonsContainer: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
    alignItems: 'center',
  },
  forgotBtn: {
    paddingVertical: Spacing.sm,
  },
  forgotText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
    textDecoration: 'underline',
  } as any,
  // Même couleur que le libellé, mais sans le soulignement.
  forgotIcon: {
    color: Colors.primary,
  },
  logoutBtn: {
    paddingVertical: Spacing.sm,
  },
  logoutText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
    textDecoration: 'underline',
  } as any,
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    gap: Spacing.md,
    minWidth: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  modalMessage: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtn: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  confirmBtn: {
    backgroundColor: Colors.primary,
  },
  cancelText: {
    color: Colors.text,
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.sm,
  },
  confirmText: {
    color: 'white',
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.sm,
  },
});
