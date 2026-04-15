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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { authService } from '../../src/services/authService';
import { Colors, Spacing, FontSize, Fonts } from '../../src/constants/theme';
import { showAlert } from '../../src/stores/alertStore';

export default function RegisterScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [surname, setSurname] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const surnameRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const passwordConfirmationRef = useRef<TextInput>(null);

  const fieldRefs: Record<string, React.RefObject<TextInput>> = {
    surname: surnameRef,
    name: nameRef,
    email: emailRef,
    password: passwordRef,
    password_confirmation: passwordConfirmationRef,
  };

  const handleRegister = async () => {
    setFieldErrors({});
    if (!surname.trim() || !name.trim() || !email.trim() || !password.trim()) {
      showAlert('Erreur', 'Veuillez remplir tous les champs.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setFieldErrors({ email: "L'adresse email n'est pas valide." });
      emailRef.current?.focus();
      return;
    }
    if (password !== passwordConfirmation) {
      setFieldErrors({ password_confirmation: 'Les mots de passe ne correspondent pas.' });
      passwordConfirmationRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      await authService.register({
        surname: surname.trim(),
        name: name.trim(),
        email: email.trim(),
        password,
        password_confirmation: passwordConfirmation,
      });
      showAlert(
        'Inscription réussie',
        'Un code de vérification a été envoyé à votre adresse email.',
        [{ text: 'OK', onPress: () => router.replace({ pathname: '/(auth)/activation', params: { email: email.trim() } }) }]
      );
    } catch (error: any) {
      const data = error?.response?.data;
      if (__DEV__) console.log('[Register error]', JSON.stringify(data));
      const errors = data?.errors;
      if (errors && typeof errors === 'object' && Object.keys(errors).length > 0) {
        const mapped: Record<string, string> = {};
        for (const [field, messages] of Object.entries(errors)) {
          mapped[field] = Array.isArray(messages) ? (messages[0] as string) : String(messages);
        }
        setFieldErrors(mapped);
        const firstField = Object.keys(mapped).find((k) => fieldRefs[k]);
        if (firstField) fieldRefs[firstField]?.current?.focus();
      } else {
        const message =
          data?.message ||
          data?.error ||
          "Erreur lors de l'inscription.";
        showAlert('Erreur', message);
      }
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
            <Text style={styles.subtitle}>Créer votre compte</Text>
          </View>

          <View style={styles.formCard}>
            <Input
              ref={surnameRef}
              label="Nom"
              placeholder="Votre nom"
              value={surname}
              onChangeText={(v) => { setSurname(v); setFieldErrors((e) => ({ ...e, surname: '' })); }}
              autoCapitalize="words"
              error={fieldErrors.surname}
            />

            <Input
              ref={nameRef}
              label="Prénom"
              placeholder="Votre prénom"
              value={name}
              onChangeText={(v) => { setName(v); setFieldErrors((e) => ({ ...e, name: '' })); }}
              autoCapitalize="words"
              error={fieldErrors.name}
            />

            <Input
              ref={emailRef}
              label="Email"
              placeholder="votre@email.com"
              value={email}
              onChangeText={(v) => { setEmail(v); setFieldErrors((e) => ({ ...e, email: '' })); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={fieldErrors.email}
            />

            <Input
              ref={passwordRef}
              label="Mot de passe"
              placeholder="••••••••"
              value={password}
              onChangeText={(v) => { setPassword(v); setFieldErrors((e) => ({ ...e, password: '' })); }}
              secureTextEntry
              autoComplete="new-password"
              error={fieldErrors.password}
            />

            <Input
              ref={passwordConfirmationRef}
              label="Confirmer le mot de passe"
              placeholder="••••••••"
              value={passwordConfirmation}
              onChangeText={(v) => { setPasswordConfirmation(v); setFieldErrors((e) => ({ ...e, password_confirmation: '' })); }}
              secureTextEntry
              error={fieldErrors.password_confirmation}
            />

            <Button
              title="S'inscrire"
              onPress={handleRegister}
              icon="user-plus"
              loading={loading}
              style={{ marginTop: Spacing.sm }}
            />

            <View style={styles.links}>
              <Link href="/(auth)/login" style={styles.link}>
                Déjà un compte ? Se connecter
              </Link>
            </View>
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
  links: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  link: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
});
