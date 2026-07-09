import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  Switch,
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

export default function LoginScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [twoFaRequired, setTwoFaRequired] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const twoFaSubmittingRef = useRef(false);
  const login = useAuthStore((s) => s.login);
  const loginWithToken = useAuthStore((s) => s.loginWithToken);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert(t('common.error'), t('auth.login.fillAllFields', 'Veuillez remplir tous les champs.'));
      return;
    }
    setLoading(true);
    try {
      const response = await authService.login({ email: email.trim(), password });
      if (response.two_factor_required && response.temp_token) {
        setTwoFaRequired(true);
        setTempToken(response.temp_token);
        setLoading(false);
        return;
      }
      // Login direct (sans 2FA) — utiliser le token reçu directement
      await loginWithToken(response.token!, response.user!, rememberMe);
      await saveCredentials(email.trim(), password);
    } catch (error: any) {
      if (__DEV__) {
      }
      // If account requires email activation, redirect to activation screen
      if (error?.response?.status === 403 && error?.response?.data?.requires_activation) {
        showAlert(
          t('auth.login.emailNotVerified', 'Email non vérifié'),
          t('auth.login.verifyEmail', 'Veuillez vérifier votre adresse email pour activer votre compte.'),
          [{ text: t('auth.login.verify', 'Vérifier'), onPress: () => router.push({ pathname: '/(auth)/activation', params: { email: error.response.data.email } }) }]
        );
        return;
      }
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        t('auth.login.incorrectCredentials');
      showAlert(t('auth.login.loginError', 'Erreur de connexion'), message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2fa = async () => {
    if (twoFaSubmittingRef.current) return; // bloquer les appels simultanés
    if (twoFaCode.length !== 6) {
      showAlert(t('common.error'), t('auth.login.enter6digits', 'Entrez un code à 6 chiffres.'));
      return;
    }
    twoFaSubmittingRef.current = true;
    setTwoFaLoading(true);
    try {
      const response = await authService.verify2faLogin(tempToken, twoFaCode);
      await loginWithToken(response.token!, response.user!, rememberMe);
      await saveCredentials(email.trim(), password);
    } catch (error: any) {
      showAlert(t('common.error'), error?.response?.data?.error || t('auth.login.incorrectCode', 'Code incorrect.'));
    } finally {
      twoFaSubmittingRef.current = false;
      setTwoFaLoading(false);
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
            <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>
          </View>

          <GlassCard>
            {twoFaRequired ? (
              <>
                <Text style={{ color: Colors.text, fontFamily: Fonts.semiBold, fontSize: FontSize.lg, marginBottom: Spacing.sm, textAlign: 'center' }}>
                  {t('auth.login.twoFaTitle')}
                </Text>
                <Text style={{ color: Colors.textMuted, fontSize: FontSize.sm, marginBottom: Spacing.md, textAlign: 'center' }}>
                  {t('auth.login.twoFaHint')}
                </Text>
                <OtpInput value={twoFaCode} onChange={setTwoFaCode} onComplete={handleVerify2fa} />
                <Button
                  title={t('auth.login.twoFaVerify')}
                  onPress={handleVerify2fa}
                  icon="shield-halved"
                  loading={twoFaLoading}
                  style={{ marginTop: Spacing.md }}
                />
                <Button
                  title={t('common.cancel')}
                  onPress={() => { setTwoFaRequired(false); setTempToken(''); setTwoFaCode(''); }}
                  variant="outline"
                  style={{ marginTop: Spacing.sm }}
                />
              </>
            ) : (
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

            <View style={styles.rememberRow}>
              <Text style={styles.rememberText}>{t('auth.login.rememberMe')}</Text>
              <Switch
                value={rememberMe}
                onValueChange={setRememberMe}
                trackColor={{ false: Colors.border, true: Colors.secondary }}
                thumbColor={Colors.white}
              />
            </View>

            <Button
              title={t('auth.login.submit')}
              onPress={handleLogin}
              icon="right-to-bracket"
              loading={loading}
              style={{ marginTop: Spacing.sm }}
            />

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
  links: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.lg,
  },
  rememberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  rememberText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  link: {
    color: Colors.secondary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
});
