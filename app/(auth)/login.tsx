import React, { useState } from 'react';
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
import { Colors, Spacing, FontSize, Fonts } from '../../src/constants/theme';
import { showAlert } from '../../src/stores/alertStore';
import { authService } from '../../src/services/authService';
import { OtpInput } from '../../src/components/OtpInput';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [twoFaRequired, setTwoFaRequired] = useState(false);
  const [tempToken, setTempToken] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const loginWithToken = useAuthStore((s) => s.loginWithToken);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert('Erreur', 'Veuillez remplir tous les champs.');
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
          'Email non vérifié',
          'Veuillez vérifier votre adresse email pour activer votre compte.',
          [{ text: 'Vérifier', onPress: () => router.push({ pathname: '/(auth)/activation', params: { email: error.response.data.email } }) }]
        );
        return;
      }
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        'Identifiants incorrects.';
      showAlert('Erreur de connexion', message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2fa = async () => {
    if (twoFaCode.length !== 6) {
      showAlert('Erreur', 'Entrez un code à 6 chiffres.');
      return;
    }
    setTwoFaLoading(true);
    try {
      const response = await authService.verify2faLogin(tempToken, twoFaCode);
      await loginWithToken(response.token!, response.user!, rememberMe);
      await saveCredentials(email.trim(), password);
    } catch (error: any) {
      showAlert('Erreur', error?.response?.data?.error || 'Code incorrect.');
    } finally {
      setTwoFaLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require('../../assets/bg_page.jpg')}
      style={styles.background}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
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
            <Text style={styles.subtitle}>Votre wallet Mobile Money</Text>
          </View>

          <View style={styles.formCard}>
            {twoFaRequired ? (
              <>
                <Text style={{ color: Colors.text, fontFamily: Fonts.semiBold, fontSize: FontSize.lg, marginBottom: Spacing.sm, textAlign: 'center' }}>
                  Double authentification
                </Text>
                <Text style={{ color: Colors.textMuted, fontSize: FontSize.sm, marginBottom: Spacing.md, textAlign: 'center' }}>
                  Entrez le code à 6 chiffres de votre application d'authentification.
                </Text>
                <OtpInput value={twoFaCode} onChange={setTwoFaCode} onComplete={handleVerify2fa} />
                <Button
                  title="Vérifier"
                  onPress={handleVerify2fa}
                  icon="shield-halved"
                  loading={twoFaLoading}
                  style={{ marginTop: Spacing.md }}
                />
                <Button
                  title="Annuler"
                  onPress={() => { setTwoFaRequired(false); setTempToken(''); setTwoFaCode(''); }}
                  variant="outline"
                  style={{ marginTop: Spacing.sm }}
                />
              </>
            ) : (
              <>
            <Input
              label="Email"
              placeholder="votre@email.com"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
            />

            <Input
              label="Mot de passe"
              placeholder="••••••••"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="password"
            />

            <View style={styles.rememberRow}>
              <Text style={styles.rememberText}>Se souvenir de moi</Text>
              <Switch
                value={rememberMe}
                onValueChange={setRememberMe}
                trackColor={{ false: Colors.border, true: Colors.secondary }}
                thumbColor={Colors.white}
              />
            </View>

            <Button
              title="Se connecter"
              onPress={handleLogin}
              icon="right-to-bracket"
              loading={loading}
              style={{ marginTop: Spacing.sm }}
            />

            <View style={styles.links}>
              <Link href="/(auth)/forgot-password" style={styles.link}>
                Mot de passe oublié ?
              </Link>
              <Link href="/(auth)/register" style={styles.link}>
                Créer un compte
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

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
    // backgroundColor: 'rgba(23,30,43,0.9)',
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.lg,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logo: {
    width: 180,
    height: 180,
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: FontSize.lg,
    color: 'rgba(255,255,255,0.8)',
    fontFamily: Fonts.semiBold,
  },
  formCard: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
