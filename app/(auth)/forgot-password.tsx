import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { GlassCard } from '../../src/components/GlassCard';
import { Input } from '../../src/components/Input';
import { OtpInput } from '../../src/components/OtpInput';
import { Button } from '../../src/components/Button';
import { LinkButton } from '../../src/components/LinkButton';
import { authService } from '../../src/services/authService';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts } from '../../src/constants/theme';
import { showAlert } from '../../src/stores/alertStore';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher';
import { isAccountMissing, accountMissingEmail } from '../../src/utils/accountMissing';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const passwordRef = useRef<TextInput>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handleSendCode = async () => {
    if (!email.trim()) {
      showAlert(t('common.error'), t('auth.forgotPassword.enterEmail', 'Veuillez entrer votre email.'));
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showAlert(t('common.error'), t('auth.forgotPassword.invalidEmail', 'Veuillez entrer une adresse email valide.'));
      return;
    }
    setLoading(true);
    try {
      await authService.forgotPassword(email.trim());
      setStep(2);
    } catch (error: any) {
      // Adresse sans compte : il n'y a pas de mot de passe à réinitialiser,
      // direction l'inscription, adresse déjà remplie.
      if (isAccountMissing(error)) {
        router.push({
          pathname: '/(auth)/register',
          params: { email: accountMissingEmail(error, email) },
        });
        return;
      }
      const message =
        error?.response?.data?.message || t('auth.forgotPassword.sendError', "Erreur lors de l'envoi.");
      showAlert(t('common.error'), message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (loading || done) return;
    if (!code.trim() || !password || !passwordConfirmation) {
      showAlert(t('common.error'), t('auth.forgotPassword.fillAllFields', 'Veuillez remplir tous les champs.'));
      return;
    }
    if (password !== passwordConfirmation) {
      showAlert(t('common.error'), t('auth.forgotPassword.passwordMismatch', 'Les mots de passe ne correspondent pas.'));
      return;
    }
    setLoading(true);
    try {
      await authService.resetPassword({
        email: email.trim(),
        code: code.trim(),
        password,
        password_confirmation: passwordConfirmation,
      });
      setDone(true);
    } catch (error: any) {
      const data = error?.response?.data;
      const message =
        data?.error || data?.message || t('auth.forgotPassword.invalidCode');
      showAlert(t('common.error'), message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenBackground edges={['top', 'bottom']}>
        <LanguageSwitcher />
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.logoContainer}>
              <View style={styles.logoGlow} />
              <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
              <Text style={styles.subtitle}>{t('auth.forgotPassword.title')}</Text>
            </View>

            <GlassCard>
              {done ? (
                <>
                  <Text style={styles.message}>
                    {t('auth.forgotPassword.successMessage', 'Votre mot de passe a été réinitialisé avec succès.')}
                  </Text>
                  <Button
                    title={t('auth.login.submit')}
                    icon="right-to-bracket"
                    onPress={() => router.replace('/(auth)/login')}
                    style={{ marginTop: Spacing.md }}
                  />
                </>
              ) : step === 1 ? (
                <>
                  <Text style={styles.hint}>
                    {t('auth.forgotPassword.hint')}
                  </Text>
                  <Input
                    label={t('auth.forgotPassword.email')}
                    placeholder={t('auth.forgotPassword.emailPlaceholder')}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                  />
                  <Button
                    title={t('auth.forgotPassword.submit')}
                    onPress={handleSendCode}
                    icon="paper-plane"
                    loading={loading}
                    style={{ marginTop: Spacing.sm }}
                  />
                  <LinkButton
                    title={t('auth.forgotPassword.backToLogin')}
                    href="/(auth)/login"
                    icon="arrow-left"
                    style={{ marginTop: Spacing.md }}
                  />
                </>
              ) : (
                <>
                  <Text style={styles.hint}>
                    {t('auth.forgotPassword.codeSentTo', 'Un code à 6 chiffres a été envoyé à')}{' '}
                    <Text style={styles.email}>{email}</Text>. {t('auth.forgotPassword.enterCodeBelow', 'Entrez-le ci-dessous avec votre nouveau mot de passe.')}
                  </Text>
                  <OtpInput
                    value={code}
                    onChange={setCode}
                    onComplete={() => passwordRef.current?.focus()}
                  />
                  <Input
                    ref={passwordRef}
                    label={t('auth.forgotPassword.newPassword')}
                    placeholder="••••••••"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                  <Input
                    label={t('auth.forgotPassword.confirmPassword')}
                    placeholder="••••••••"
                    value={passwordConfirmation}
                    onChangeText={setPasswordConfirmation}
                    secureTextEntry
                    autoCapitalize="none"
                  />
                  <Button
                    title={t('auth.forgotPassword.resetSubmit')}
                    onPress={handleResetPassword}
                    icon="lock"
                    loading={loading}
                    style={{ marginTop: Spacing.sm }}
                  />
                  <View style={styles.links}>
                    <LinkButton
                      title={t('auth.forgotPassword.resendCode')}
                      onPress={() => setStep(1)}
                      icon="rotate-right"
                    />
                    <LinkButton
                      title={t('auth.forgotPassword.backToLogin')}
                      href="/(auth)/login"
                      variant="quiet"
                    />
                  </View>
                </>
              )}
            </GlassCard>
          </ScrollView>
        </KeyboardAvoidingView>
    </ScreenBackground>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logoGlow: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: 10,
    backgroundColor: Colors.secondary + '22',
    ...(Platform.OS === 'web' ? ({ filter: 'blur(48px)' } as any) : {}),
  },
  logo: {
    width: 180,
    height: 180,
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: FontSize.lg,
    color: Colors.text,
    fontFamily: Fonts.semiBold,
  },
  hint: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
    lineHeight: 20,
  },
  message: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  email: {
    color: Colors.link,
    fontFamily: Fonts.semiBold,
  },
  links: {
    alignItems: 'center',
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
});
