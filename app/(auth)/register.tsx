import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  TextInput,
} from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { GlassCard } from '../../src/components/GlassCard';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { authService } from '../../src/services/authService';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts } from '../../src/constants/theme';
import { showAlert } from '../../src/stores/alertStore';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher';

export default function RegisterScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ ref?: string }>();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [surname, setSurname] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
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
  const parrainRef = useRef<TextInput>(null);

  const fieldRefs: Record<string, React.RefObject<TextInput | null>> = {
    surname: surnameRef,
    name: nameRef,
    email: emailRef,
    parrain_code: parrainRef,
  };

  const handleRegister = async () => {
    setFieldErrors({});
    if (!surname.trim() || !name.trim() || !email.trim()) {
      showAlert(t('common.error'), t('auth.register.fillAllFields', 'Veuillez remplir tous les champs.'));
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setFieldErrors({ email: t('auth.register.invalidEmail', "L'adresse email n'est pas valide.") });
      emailRef.current?.focus();
      return;
    }

    setLoading(true);
    try {
      // Pas de mot de passe à l'inscription : la connexion se fait par code
      // reçu par email, et un mot de passe se définit plus tard si on le veut.
      await authService.register({
        surname: surname.trim(),
        name: name.trim(),
        email: email.trim(),
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
            <Text style={styles.subtitle}>{t('auth.register.title')}</Text>
          </View>

          <GlassCard>
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
              ref={parrainRef}
              label={t('auth.register.parrainCode')}
              placeholder={t('auth.register.parrainCodePlaceholder')}
              value={parrainCode}
              onChangeText={(v) => { setParrainCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 32)); setFieldErrors((e) => ({ ...e, parrain_code: '' })); }}
              autoCapitalize="characters"
              maxLength={32}
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
    marginBottom: Spacing.md,
  },
  logoGlow: {
    position: 'absolute',
    width: 160,
    height: 160,
    borderRadius: 80,
    top: 4,
    backgroundColor: Colors.secondary + '22',
    ...(Platform.OS === 'web' ? ({ filter: 'blur(45px)' } as any) : {}),
  },
  logo: {
    width: 150,
    height: 150,
  },
  subtitle: {
    fontSize: FontSize.lg,
    color: Colors.text,
    fontFamily: Fonts.semiBold,
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
