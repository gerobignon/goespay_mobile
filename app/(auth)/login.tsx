import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  ImageBackground,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { saveCredentials } from '../../src/services/secureAuthService';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts } from '../../src/constants/theme';
import { showAlert } from '../../src/stores/alertStore';
import { authService } from '../../src/services/authService';
import { OtpInput } from '../../src/components/OtpInput';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useTheme } from '../../src/components/ThemeProvider';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher';

export default function LoginScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
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
        console.log('Login error status:', error?.response?.status);
        console.log('Login error data:', JSON.stringify(error?.response?.data));
        console.log('Login error URL:', error?.config?.url);
        console.log('Login error body:', error?.config?.data);
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
    <ImageBackground
      source={isDark ? require('../../assets/bg_page.jpg') : require('../../assets/bg_page_light.jpg')}
      style={styles.background}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
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
            <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
            <Text style={styles.subtitle}>{t('auth.login.subtitle')}</Text>
          </View>

          <View style={styles.formCard}>
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
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
    // backgroundColor: 'rgba(23,30,43,0.9)',
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logo: {
    width: 240,
    height: 240,
  },
  subtitle: {
    fontSize: FontSize.lg,
    color: Colors.text,
    fontFamily: Fonts.semiBold,
  },
  formCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    maxWidth: 460,
    width: '100%',
    alignSelf: 'center',
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
