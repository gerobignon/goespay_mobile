import React, { useState, useRef, useEffect } from 'react';
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
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { authService } from '../../src/services/authService';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts } from '../../src/constants/theme';
import { showAlert } from '../../src/stores/alertStore';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useTheme } from '../../src/components/ThemeProvider';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher';

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string }>();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [surname, setSurname] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [parrainCode, setParrainCode] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (params.ref && typeof params.ref === 'string') {
      setParrainCode(params.ref);
    }
  }, [params.ref]);

  const surnameRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const passwordConfirmationRef = useRef<TextInput>(null);
  const parrainRef = useRef<TextInput>(null);

  const fieldRefs: Record<string, React.RefObject<TextInput | null>> = {
    surname: surnameRef,
    name: nameRef,
    email: emailRef,
    password: passwordRef,
    password_confirmation: passwordConfirmationRef,
    parrain_code: parrainRef,
  };

  const handleRegister = async () => {
    setFieldErrors({});
    if (!surname.trim() || !name.trim() || !email.trim() || !password.trim()) {
      showAlert(t('common.error'), t('auth.register.fillAllFields', 'Veuillez remplir tous les champs.'));
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setFieldErrors({ email: t('auth.register.invalidEmail', "L'adresse email n'est pas valide.") });
      emailRef.current?.focus();
      return;
    }
    if (password !== passwordConfirmation) {
      setFieldErrors({ password_confirmation: t('auth.register.passwordMismatch', 'Les mots de passe ne correspondent pas.') });
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
        parrain_code: parrainCode.trim() || undefined,
        hp_field: '',
      } as any);
      showAlert(
        t('auth.register.successTitle', 'Inscription réussie'),
        t('auth.register.successMessage', 'Un code de vérification a été envoyé à votre adresse email.'),
        [{ text: 'OK', onPress: () => router.replace({ pathname: '/(auth)/activation', params: { email: email.trim() } }) }]
      );
    } catch (error: any) {
      const data = error?.response?.data;
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
        showAlert(t('common.error'), message);
      }
    } finally {
      setLoading(false);
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
            <Text style={styles.subtitle}>{t('auth.register.title')}</Text>
          </View>

          <View style={styles.formCard}>
            <Input
              ref={surnameRef}
              label={t('auth.register.surname')}
              placeholder={t('auth.register.surnamePlaceholder')}
              value={surname}
              onChangeText={(v) => { setSurname(v); setFieldErrors((e) => ({ ...e, surname: '' })); }}
              autoCapitalize="words"
              error={fieldErrors.surname}
            />

            <Input
              ref={nameRef}
              label={t('auth.register.name')}
              placeholder={t('auth.register.namePlaceholder')}
              value={name}
              onChangeText={(v) => { setName(v); setFieldErrors((e) => ({ ...e, name: '' })); }}
              autoCapitalize="words"
              error={fieldErrors.name}
            />

            <Input
              ref={emailRef}
              label={t('auth.register.email')}
              placeholder={t('auth.register.emailPlaceholder')}
              value={email}
              onChangeText={(v) => { setEmail(v); setFieldErrors((e) => ({ ...e, email: '' })); }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              error={fieldErrors.email}
            />

            <Input
              ref={passwordRef}
              label={t('auth.register.password')}
              placeholder={t('auth.register.passwordPlaceholder')}
              value={password}
              onChangeText={(v) => { setPassword(v); setFieldErrors((e) => ({ ...e, password: '' })); }}
              secureTextEntry
              autoComplete="new-password"
              error={fieldErrors.password}
            />

            <Input
              ref={passwordConfirmationRef}
              label={t('auth.register.confirmPassword')}
              placeholder="••••••••"
              value={passwordConfirmation}
              onChangeText={(v) => { setPasswordConfirmation(v); setFieldErrors((e) => ({ ...e, password_confirmation: '' })); }}
              secureTextEntry
              error={fieldErrors.password_confirmation}
            />

            <Input
              ref={parrainRef}
              label={t('auth.register.parrainCode')}
              placeholder={t('auth.register.parrainCodePlaceholder')}
              value={parrainCode}
              onChangeText={(v) => { setParrainCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5)); setFieldErrors((e) => ({ ...e, parrain_code: '' })); }}
              autoCapitalize="characters"
              maxLength={5}
              error={fieldErrors.parrain_code}
            />

            <Button
              title={t('auth.register.submit')}
              onPress={handleRegister}
              icon="user-plus"
              loading={loading}
              style={{ marginTop: Spacing.sm }}
            />

            <View style={styles.links}>
              <Link href="/(auth)/login" style={styles.link}>
                {t('auth.register.alreadyAccount')}
              </Link>
            </View>
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
  },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  logoContainer: {
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
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  link: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
});
