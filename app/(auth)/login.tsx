import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  TouchableOpacity,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { GlassCard } from '../../src/components/GlassCard';
import { useAuthStore } from '../../src/stores/authStore';
import { saveCredentials } from '../../src/services/secureAuthService';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts } from '../../src/constants/theme';
import { showAlert } from '../../src/stores/alertStore';
import { authService } from '../../src/services/authService';
import { OtpInput } from '../../src/components/OtpInput';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher';

/**
 * Étapes de connexion. Par défaut on saisit son email et on reçoit un code à
 * 6 chiffres ('email' → 'code'). Le mot de passe reste possible pour les comptes
 * qui l'ont choisi ('password'). La 2FA TOTP, quand elle est active, s'ajoute
 * par-dessus l'une comme l'autre ('2fa').
 */
type Step = 'email' | 'code' | 'password' | '2fa';

export default function LoginScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const submittingRef = useRef(false);
  const loginWithToken = useAuthStore((s) => s.loginWithToken);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  /** Un compte non vérifié n'a rien à faire ici : on l'envoie sur l'activation. */
  const handleActivationRedirect = (error: any): boolean => {
    if (error?.response?.status === 403 && error?.response?.data?.requires_activation) {
      showAlert(
        t('auth.login.emailNotVerified', 'Email non vérifié'),
        t('auth.login.verifyEmail', 'Veuillez vérifier votre adresse email pour activer votre compte.'),
        [{
          text: t('auth.login.verify', 'Vérifier'),
          onPress: () => router.push({ pathname: '/(auth)/activation', params: { email: error.response.data.email || email.trim() } }),
        }]
      );
      return true;
    }
    return false;
  };

  const errorMessage = (error: any, fallback: string) =>
    error?.response?.data?.message || error?.response?.data?.error || fallback;

  /** Une session ouverte (avec ou sans 2FA) : on entre dans l'app. */
  const openSession = async (response: { token?: string; user?: any; two_factor_required?: boolean; temp_token?: string }) => {
    if (response.two_factor_required && response.temp_token) {
      setTempToken(response.temp_token);
      setStep('2fa');
      return;
    }
    await loginWithToken(response.token!, response.user!, true);
  };

  const handleRequestCode = async (silent = false) => {
    if (!emailValid) {
      showAlert(t('common.error'), t('auth.login.invalidEmail', "L'adresse email n'est pas valide."));
      return;
    }
    setLoading(true);
    try {
      await authService.requestLoginCode(email.trim());
      setCode('');
      setStep('code');
      if (!silent) {
        showAlert(t('auth.login.codeSentTitle'), t('auth.login.codeSentMessage', { email: email.trim() }));
      }
    } catch (error: any) {
      if (handleActivationRedirect(error)) return;
      showAlert(t('common.error'), errorMessage(error, t('auth.login.codeSendError')));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (submittingRef.current) return;
    if (code.length !== 6) {
      showAlert(t('common.error'), t('auth.login.enter6digits', 'Entrez un code à 6 chiffres.'));
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    try {
      await openSession(await authService.verifyLoginCode(email.trim(), code));
    } catch (error: any) {
      if (handleActivationRedirect(error)) return;
      setCode('');
      showAlert(t('common.error'), errorMessage(error, t('auth.login.incorrectCode', 'Code incorrect.')));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (!emailValid || !password.trim()) {
      showAlert(t('common.error'), t('auth.login.fillAllFields', 'Veuillez remplir tous les champs.'));
      return;
    }
    setLoading(true);
    try {
      const response = await authService.login({ email: email.trim(), password });
      await openSession(response);
      await saveCredentials(email.trim(), password);
    } catch (error: any) {
      if (handleActivationRedirect(error)) return;
      // Le compte a choisi le code par email : on l'y emmène directement.
      if (error?.response?.data?.otp_required) {
        setPassword('');
        setLoading(false);
        await handleRequestCode();
        return;
      }
      showAlert(t('auth.login.loginError', 'Erreur de connexion'), errorMessage(error, t('auth.login.incorrectCredentials')));
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2fa = async () => {
    if (submittingRef.current) return;
    if (twoFaCode.length !== 6) {
      showAlert(t('common.error'), t('auth.login.enter6digits', 'Entrez un code à 6 chiffres.'));
      return;
    }
    submittingRef.current = true;
    setLoading(true);
    try {
      const response = await authService.verify2faLogin(tempToken, twoFaCode);
      await loginWithToken(response.token!, response.user!, true);
      if (password) await saveCredentials(email.trim(), password);
    } catch (error: any) {
      showAlert(t('common.error'), errorMessage(error, t('auth.login.incorrectCode', 'Code incorrect.')));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const backToEmail = () => {
    setStep('email');
    setCode('');
    setTwoFaCode('');
    setTempToken('');
    setPassword('');
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
            <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>
          </View>

          <GlassCard>
            {step === 'email' && (
              <>
                <Input
                  label={t('auth.login.email')}
                  placeholder={t('auth.login.emailPlaceholder')}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />

                <Button
                  title={t('auth.login.sendCode')}
                  onPress={() => handleRequestCode()}
                  icon="envelope"
                  loading={loading}
                  style={{ marginTop: Spacing.sm }}
                />

                <TouchableOpacity onPress={() => setStep('password')} style={styles.switchLink}>
                  <Text style={styles.link}>{t('auth.login.usePassword')}</Text>
                </TouchableOpacity>

                <View style={[styles.links, { justifyContent: 'center' }]}>
                  <Link href="/(auth)/register" style={styles.link}>
                    {t('auth.login.createAccount')}
                  </Link>
                </View>
              </>
            )}

            {step === 'code' && (
              <>
                <Text style={styles.stepTitle}>{t('auth.login.codeTitle')}</Text>
                <Text style={styles.stepHint}>{t('auth.login.codeHint', { email: email.trim() })}</Text>
                <OtpInput value={code} onChange={setCode} onComplete={handleVerifyCode} />
                <Button
                  title={t('auth.login.submit')}
                  onPress={handleVerifyCode}
                  icon="right-to-bracket"
                  loading={loading}
                  style={{ marginTop: Spacing.md }}
                />
                <TouchableOpacity onPress={() => handleRequestCode(true)} style={styles.switchLink}>
                  <Text style={styles.link}>{t('auth.login.resendCode')}</Text>
                </TouchableOpacity>
                <Button
                  title={t('common.cancel')}
                  onPress={backToEmail}
                  variant="outline"
                  style={{ marginTop: Spacing.sm }}
                />
              </>
            )}

            {step === 'password' && (
              <>
                <Input
                  label={t('auth.login.email')}
                  placeholder={t('auth.login.emailPlaceholder')}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />

                <Input
                  label={t('auth.login.password')}
                  placeholder={t('auth.login.passwordPlaceholder')}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                />

                <Button
                  title={t('auth.login.submit')}
                  onPress={handlePasswordLogin}
                  icon="right-to-bracket"
                  loading={loading}
                  style={{ marginTop: Spacing.sm }}
                />

                <TouchableOpacity onPress={() => setStep('email')} style={styles.switchLink}>
                  <Text style={styles.link}>{t('auth.login.useCode')}</Text>
                </TouchableOpacity>

                <View style={styles.links}>
                  <Link href="/(auth)/forgot-password" style={styles.link}>
                    {t('auth.login.forgotPassword')}
                  </Link>
                  <Link href="/(auth)/register" style={styles.link}>
                    {t('auth.login.createAccount')}
                  </Link>
                </View>
              </>
            )}

            {step === '2fa' && (
              <>
                <Text style={styles.stepTitle}>{t('auth.login.twoFaTitle')}</Text>
                <Text style={styles.stepHint}>{t('auth.login.twoFaHint')}</Text>
                <OtpInput value={twoFaCode} onChange={setTwoFaCode} onComplete={handleVerify2fa} />
                <Button
                  title={t('auth.login.twoFaVerify')}
                  onPress={handleVerify2fa}
                  icon="shield-halved"
                  loading={loading}
                  style={{ marginTop: Spacing.md }}
                />
                <Button
                  title={t('common.cancel')}
                  onPress={backToEmail}
                  variant="outline"
                  style={{ marginTop: Spacing.sm }}
                />
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
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  logoGlow: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    top: 20,
    backgroundColor: Colors.secondary + '22',
    ...(Platform.OS === 'web' ? ({ filter: 'blur(50px)' } as any) : {}),
  },
  logo: {
    width: 200,
    height: 200,
  },
  subtitle: {
    fontSize: FontSize.lg,
    color: Colors.text,
    fontFamily: Fonts.semiBold,
    marginTop: -Spacing.sm,
  },
  stepTitle: {
    color: Colors.text,
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.lg,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  stepHint: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  switchLink: {
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
  },
  link: {
    color: Colors.secondary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
});
