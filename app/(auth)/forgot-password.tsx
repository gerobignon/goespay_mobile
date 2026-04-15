import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  ImageBackground,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { Input } from '../../src/components/Input';
import { OtpInput } from '../../src/components/OtpInput';
import { Button } from '../../src/components/Button';
import { authService } from '../../src/services/authService';
import { Colors, Spacing, FontSize, Fonts } from '../../src/constants/theme';
import { showAlert } from '../../src/stores/alertStore';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const passwordRef = useRef(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Auto-submit when all fields are valid on step 2
  useEffect(() => {
    if (step === 2 && code.length === 6 && password && passwordConfirmation && password === passwordConfirmation && !loading) {
      handleResetPassword();
    }
  }, [step, code, password, passwordConfirmation, loading]);

  const handleSendCode = async () => {
    if (!email.trim()) {
      showAlert('Erreur', 'Veuillez entrer votre email.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      showAlert('Erreur', 'Veuillez entrer une adresse email valide.');
      return;
    }
    setLoading(true);
    try {
      await authService.forgotPassword(email.trim());
      setStep(2);
    } catch (error: any) {
      const message =
        error?.response?.data?.message || "Erreur lors de l'envoi.";
      showAlert('Erreur', message);
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!code.trim() || !password || !passwordConfirmation) {
      showAlert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    if (password !== passwordConfirmation) {
      showAlert('Erreur', 'Les mots de passe ne correspondent pas.');
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
      const message =
        error?.response?.data?.message || 'Code invalide ou expiré.';
      showAlert('Erreur', message);
    } finally {
      setLoading(false);
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
            <Text style={styles.subtitle}>Mot de passe oublié</Text>
          </View>

          <View style={styles.formCard}>
            {done ? (
              <>
                <Text style={styles.message}>
                  Votre mot de passe a été réinitialisé avec succès.
                </Text>
                <Button
                  title="Se connecter"
                  icon="right-to-bracket"
                  onPress={() => router.replace('/(auth)/login')}
                  style={{ marginTop: Spacing.md }}
                />
              </>
            ) : step === 1 ? (
              <>
                <Text style={styles.hint}>
                  Entrez votre adresse email pour recevoir un code de
                  réinitialisation à 6 chiffres.
                </Text>
                <Input
                  label="Email"
                  placeholder="votre@email.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                />
                <Button
                  title="Envoyer le code"
                  onPress={handleSendCode}
                  icon="paper-plane"
                  loading={loading}
                  style={{ marginTop: Spacing.sm }}
                />
                <View style={styles.links}>
                  <Link href="/(auth)/login" style={styles.link}>
                    Retour à la connexion
                  </Link>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.hint}>
                  Un code à 6 chiffres a été envoyé à{' '}
                  <Text style={styles.email}>{email}</Text>. Entrez-le
                  ci-dessous avec votre nouveau mot de passe.
                </Text>
                  value={code} 
                  onChange={setCode} 
                  onComplete={() => passwordRef.current?.focus()} 
                />
                <Input
                  ref={passwordRef}put value={code} onChange={setCode} />
                <Input
                  label="Nouveau mot de passe"
                  placeholder="••••••••"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <Input
                  label="Confirmer le mot de passe"
                  placeholder="••••••••"
                  value={passwordConfirmation}
                  onChangeText={setPasswordConfirmation}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <Button
                  title="Réinitialiser"
                  onPress={handleResetPassword}
                  icon="lock"
                  loading={loading}
                  style={{ marginTop: Spacing.sm }}
                />
                <View style={styles.links}>
                  <Text
                    style={styles.link}
                    onPress={() => setStep(1)}
                  >
                    Renvoyer un code
                  </Text>
                  <Link href="/(auth)/login" asChild>
                    <Text style={styles.linkPrimary}>Retour à la connexion</Text>
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
    color: Colors.secondary,
    fontFamily: Fonts.semiBold,
  },
  links: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  link: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
  },
  linkPrimary: {
    color: Colors.secondary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
});
