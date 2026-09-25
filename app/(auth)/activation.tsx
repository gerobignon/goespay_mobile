import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, AppState } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { GlassCard } from '../../src/components/GlassCard';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts } from '../../src/constants/theme';
import { Input } from '../../src/components/Input';
import { OtpInput } from '../../src/components/OtpInput';
import { Button } from '../../src/components/Button';
import { LinkButton } from '../../src/components/LinkButton';
import { authService } from '../../src/services/authService';
import { useAuthStore } from '../../src/stores/authStore';
import { readPendingActivation, clearPendingActivation } from '../../src/utils/pendingActivation';
import type { LoginResponse } from '../../src/types';
import { showAlert } from '../../src/stores/alertStore';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher';

export default function ActivationScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [showChangeEmail, setShowChangeEmail] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [changingEmail, setChangingEmail] = useState(false);
  const [currentEmail, setCurrentEmail] = useState(email || '');
  const loginWithToken = useAuthStore((s) => s.loginWithToken);
  // Jeton remis à l'inscription par ce même appareil : il ouvre la session dès
  // que l'adresse est vérifiée, par le code ou par le lien de l'email.
  const [signupToken, setSignupToken] = useState<string | null>(null);
  const openingRef = useRef(false);

  useEffect(() => {
    readPendingActivation().then((pending) => {
      if (!pending) return;
      if (!email) setCurrentEmail(pending.email);
      if (!email || pending.email.toLowerCase() === email.toLowerCase()) {
        setSignupToken(pending.signupToken);
      }
    });
  }, [email]);

  /**
   * Adresse vérifiée : on entre dans l'app comme après une connexion. Une 2FA
   * ne peut pas exister sur un compte qui vient d'être créé ; si la réponse en
   * réclame une, on passe par l'écran de connexion qui sait la demander.
   */
  const openSession = useCallback(async (response: LoginResponse) => {
    if (openingRef.current) return;
    openingRef.current = true;
    await clearPendingActivation();
    if (response.token && response.user) {
      await loginWithToken(response.token, response.user, true);
      return;
    }
    router.replace('/(auth)/login');
  }, [loginWithToken, router]);

  // Lien cliqué dans l'email (sur ce téléphone ou ailleurs) : on le détecte en
  // interrogeant le serveur à intervalle régulier et au retour dans l'app.
  useEffect(() => {
    if (!signupToken) return;
    let stopped = false;
    const check = async () => {
      if (stopped || openingRef.current) return;
      try {
        const response = await authService.activationStatus(signupToken);
        if (!stopped && response.activated !== false && (response.token || response.two_factor_required)) {
          await openSession(response);
        }
      } catch (error: any) {
        // Jeton inconnu ou expiré : plus rien à attendre, le code reste possible.
        if (error?.response?.status === 422) {
          stopped = true;
          setSignupToken(null);
          clearPendingActivation();
        }
      }
    };
    const timer = setInterval(check, 4000);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    check();
    return () => {
      stopped = true;
      clearInterval(timer);
      sub.remove();
    };
  }, [signupToken, openSession]);

  const handleVerify = async () => {
    if (!code.trim() || code.trim().length !== 6) {
      showAlert(t('common.error'), t('auth.login.enter6digits', 'Entrez un code à 6 chiffres.'));
      return;
    }
    if (openingRef.current) return;
    setLoading(true);
    try {
      const response = await authService.verifyEmail(currentEmail, code.trim(), signupToken);
      if (response.token || response.two_factor_required) {
        await openSession(response);
        return;
      }
      // Serveur sans ouverture de session (ou compte déjà actif) : connexion classique.
      await clearPendingActivation();
      showAlert(
        t('auth.activation.activated', 'Compte activé'),
        t('auth.activation.activatedMessage', 'Votre adresse email a été vérifiée. Vous pouvez maintenant vous connecter.'),
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (error: any) {
      const msg = error?.response?.data?.error || t('auth.activation.invalidCode');
      showAlert(t('common.error'), msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await authService.resendVerification(currentEmail);
      showAlert(t('auth.activation.sent', 'Envoyé'), t('auth.activation.newCodeSent', 'Un nouveau code a été envoyé à votre adresse email.'));
    } catch (error: any) {
      const msg = error?.response?.data?.error || t('auth.activation.sendError');
      showAlert(t('common.error'), msg);
    } finally {
      setResending(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim() || !/\S+@\S+\.\S+/.test(newEmail)) {
      showAlert(t('common.error'), t('auth.activation.invalidEmail', 'Veuillez entrer une adresse email valide.'));
      return;
    }
    setChangingEmail(true);
    try {
      await authService.changeEmail(currentEmail, newEmail.trim());
      setCurrentEmail(newEmail.trim());
      setNewEmail('');
      setShowChangeEmail(false);
      setCode('');
      showAlert(t('common.success'), t('auth.activation.emailChanged', `Adresse email modifiée. Un nouveau code a été envoyé à ${newEmail.trim()}.`));
    } catch (error: any) {
      const msg = error?.response?.data?.error || t('auth.activation.emailChangeError');
      showAlert(t('common.error'), msg);
    } finally {
      setChangingEmail(false);
    }
  };

  return (
    <ScreenBackground edges={['top', 'bottom']}>
      <LanguageSwitcher />
      <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg }} keyboardShouldPersistTaps="handled">
      <GlassCard style={{ alignItems: 'center' }}>
      <FontAwesome6
        name="envelope-circle-check"
        size={64}
        color={Colors.secondary}
        style={{ marginBottom: Spacing.lg }}
      />
      <Text style={styles.title}>{t('auth.activation.title', 'Vérification email')}</Text>
      <Text style={styles.message}>
        {t('auth.activation.codeSentTo', 'Un code de vérification a été envoyé à')}{' '}
        <Text style={styles.emailText}>{currentEmail}</Text>
      </Text>
      <Text style={styles.hint}>{t('auth.activation.linkOrSpam')}</Text>
      <Text style={styles.hint}>{t('auth.login.alreadyHaveCode')}</Text>

      <View style={styles.form}>
        <OtpInput value={code} onChange={setCode} onComplete={handleVerify} />
        <Button
          title={t('auth.activation.verify', 'Vérifier')}
          onPress={handleVerify}
          loading={loading}
          disabled={code.length !== 6}
          icon="check"
        />
      </View>

      <View style={styles.actions}>
        <LinkButton
          title={resending ? t('auth.activation.sending', 'Envoi en cours...') : t('auth.forgotPassword.resendCode')}
          onPress={handleResend}
          disabled={resending}
          icon="rotate-right"
        />
        <LinkButton
          title={t('auth.activation.changeEmail', "Changer l'adresse email")}
          onPress={() => setShowChangeEmail(!showChangeEmail)}
          variant="quiet"
        />
      </View>

      {showChangeEmail && (
        <View style={styles.changeEmailForm}>
          <Input
            label={t('auth.activation.newEmail', 'Nouvelle adresse email')}
            placeholder="nouvelle@email.com"
            value={newEmail}
            onChangeText={setNewEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Button
            title={t('auth.activation.confirmChange', 'Confirmer le changement')}
            onPress={handleChangeEmail}
            loading={changingEmail}
            icon="envelope"
          />
        </View>
      )}

      <LinkButton
        title={t('auth.forgotPassword.backToLogin')}
        onPress={async () => {
          // Choix explicite de quitter l'activation : la connexion ne doit pas
          // nous y renvoyer (voir la reprise dans login.tsx).
          await clearPendingActivation();
          router.replace('/(auth)/login');
        }}
        variant="quiet"
        style={{ marginTop: Spacing.sm }}
      />
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
  title: {
    fontSize: FontSize.xxl,
    fontFamily: Fonts.bold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  message: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  emailText: {
    color: Colors.text,
    fontFamily: Fonts.bold,
  },
  hint: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.lg,
  },
  form: {
    width: '100%',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  // Actions secondaires empilées sous le formulaire de vérification.
  actions: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  changeEmailForm: {
    width: '100%',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
});
