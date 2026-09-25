import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { GlassCard } from '../../src/components/GlassCard';
import { useAuthStore } from '../../src/stores/authStore';
import { saveCredentials } from '../../src/services/secureAuthService';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { LinkButton } from '../../src/components/LinkButton';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts } from '../../src/constants/theme';
import { showAlert } from '../../src/stores/alertStore';
import { authService } from '../../src/services/authService';
import { OtpInput } from '../../src/components/OtpInput';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher';
import { isAccountMissing, accountMissingEmail } from '../../src/utils/accountMissing';
import { savePendingLoginCode, readPendingLoginCode, clearPendingLoginCode } from '../../src/utils/pendingLoginCode';
import { readPendingActivation } from '../../src/utils/pendingActivation';

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
  // Tant qu'on ne sait pas si un code est en attente, on n'affiche pas l'étape
  // email : elle clignoterait avant de céder la place à la saisie du code.
  const [restoring, setRestoring] = useState(true);

  // Retour depuis la messagerie après une relance de l'app : on reprend sur la
  // saisie du code déjà envoyé au lieu de repartir de l'email. Voir
  // src/utils/pendingLoginCode.ts.
  // Même chose pour une inscription dont l'adresse n'est pas encore vérifiée :
  // on retourne sur l'activation, qui ouvrira la session toute seule.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const activation = await readPendingActivation();
      if (cancelled) return;
      if (activation) {
        router.replace({ pathname: '/(auth)/activation', params: { email: activation.email } });
        return;
      }
      const pendingEmail = await readPendingLoginCode();
      if (cancelled) return;
      if (pendingEmail) {
        setEmail(pendingEmail);
        setStep('code');
      }
      setRestoring(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  /**
   * Adresse sans compte : on ne fait pas attendre un code qui ne viendra jamais,
   * on emmène directement sur l'inscription, adresse déjà remplie.
   */
  const handleMissingAccount = (error: any): boolean => {
    if (!isAccountMissing(error)) return false;
    clearPendingLoginCode();
    router.push({
      pathname: '/(auth)/register',
      params: { email: accountMissingEmail(error, email) },
    });
    return true;
  };

  const errorMessage = (error: any, fallback: string) =>
    error?.response?.data?.message || error?.response?.data?.error || fallback;

  /** Une session ouverte (avec ou sans 2FA) : on entre dans l'app. */
  const openSession = async (response: { token?: string; user?: any; two_factor_required?: boolean; temp_token?: string }) => {
    // Le code email est consommé : plus rien à reprendre.
    clearPendingLoginCode();
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
      await savePendingLoginCode(email.trim());
      setCode('');
      setStep('code');
      if (!silent) {
        showAlert(t('auth.login.codeSentTitle'), t('auth.login.codeSentMessage', { email: email.trim() }));
      }
    } catch (error: any) {
      if (handleActivationRedirect(error)) return;
      if (handleMissingAccount(error)) return;
      // Le compte se connecte par mot de passe et ne reçoit aucun code : on l'y
      // emmène directement, symétrique de otp_required plus bas.
      if (error?.response?.data?.password_required) {
        clearPendingLoginCode();
        setStep('password');
        return;
      }
      showAlert(t('common.error'), errorMessage(error, t('auth.login.codeSendError')));
    } finally {
      setLoading(false);
    }
  };

  /**
   * Code déjà reçu (il reste valable 30 minutes et le serveur renvoie le même
   * tant qu'il n'a pas servi) : on va droit à la saisie, sans nouvel envoi.
   */
  const goToCodeEntry = async () => {
    if (!emailValid) {
      showAlert(t('common.error'), t('auth.login.invalidEmail', "L'adresse email n'est pas valide."));
      return;
    }
    await savePendingLoginCode(email.trim());
    setCode('');
    setStep('code');
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
      if (handleMissingAccount(error)) return;
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
      await saveCredentials(email.trim());
    } catch (error: any) {
      if (handleActivationRedirect(error)) return;
      if (handleMissingAccount(error)) return;
      // Choisir « utiliser mon mot de passe » connecte bel et bien par mot de
      // passe : aucun code ne part. Le serveur ne renvoie otp_required que pour
      // un compte qui n'a AUCUN mot de passe, dont le code par email est la
      // seule porte : on l'y emmène, en lui envoyant son code.
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
      await saveCredentials(email.trim());
    } catch (error: any) {
      showAlert(t('common.error'), errorMessage(error, t('auth.login.incorrectCode', 'Code incorrect.')));
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const backToEmail = () => {
    clearPendingLoginCode();
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
            {Platform.OS === 'web' && <View style={styles.logoGlow} />}
            <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>
          </View>

          {!restoring && <GlassCard>
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

                <View style={styles.actions}>
                  <LinkButton
                    title={t('auth.login.haveCode')}
                    onPress={goToCodeEntry}
                    icon="hashtag"
                  />
                  <LinkButton
                    title={t('auth.login.usePassword')}
                    onPress={() => setStep('password')}
                    icon="key"
                  />
                  <LinkButton
                    title={t('auth.login.createAccount')}
                    href="/(auth)/register"
                    icon="user-plus"
                    tone="brand"
                  />
                </View>
              </>
            )}

            {step === 'code' && (
              <>
                <Text style={styles.stepTitle}>{t('auth.login.codeTitle')}</Text>
                <Text style={styles.stepHint}>{t('auth.login.codeHint', { email: email.trim() })}</Text>
                <Text style={styles.stepHint}>{t('auth.login.alreadyHaveCode')}</Text>
                <OtpInput value={code} onChange={setCode} onComplete={handleVerifyCode} />
                <Button
                  title={t('auth.login.submit')}
                  onPress={handleVerifyCode}
                  icon="right-to-bracket"
                  loading={loading}
                  style={{ marginTop: Spacing.md }}
                />
                <LinkButton
                  title={t('auth.login.resendCode')}
                  onPress={() => handleRequestCode(true)}
                  icon="rotate-right"
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

                <View style={styles.actions}>
                  <LinkButton
                    title={t('auth.login.useCode')}
                    onPress={() => setStep('email')}
                    icon="envelope"
                  />
                  <LinkButton
                    title={t('auth.login.createAccount')}
                    href="/(auth)/register"
                    icon="user-plus"
                    tone="brand"
                  />
                  <View style={styles.quietRow}>
                    <LinkButton
                      title={t('auth.login.forgotPassword')}
                      href="/(auth)/forgot-password"
                      variant="quiet"
                    />
                  </View>
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
          </GlassCard>}
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
  // Bloc des actions secondaires sous le bouton principal.
  actions: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  quietRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    columnGap: Spacing.md,
  },
});
