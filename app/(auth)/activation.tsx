import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { GlassCard } from '../../src/components/GlassCard';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts } from '../../src/constants/theme';
import { Input } from '../../src/components/Input';
import { OtpInput } from '../../src/components/OtpInput';
import { Button } from '../../src/components/Button';
import { authService } from '../../src/services/authService';
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

  const handleVerify = async () => {
    if (!code.trim() || code.trim().length !== 6) {
      showAlert('Erreur', 'Veuillez entrer le code à 6 chiffres.');
      return;
    }
    setLoading(true);
    try {
      await authService.verifyEmail(currentEmail, code.trim());
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

      <TouchableOpacity onPress={handleResend} disabled={resending} style={styles.resendBtn}>
        <Text style={styles.resendText}>
          {resending ? t('auth.activation.sending', 'Envoi en cours...') : t('auth.forgotPassword.resendCode')}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setShowChangeEmail(!showChangeEmail)} style={styles.resendBtn}>
        <Text style={styles.changeEmailText}>{t('auth.activation.changeEmail', "Changer l'adresse email")}</Text>
      </TouchableOpacity>

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

      <Link href="/(auth)/login" style={styles.link}>
        {t('auth.forgotPassword.backToLogin')}
      </Link>
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
    color: Colors.secondary,
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
  form: {
    width: '100%',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  resendBtn: {
    paddingVertical: Spacing.sm,
  },
  resendText: {
    color: Colors.secondary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  changeEmailText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    textDecorationLine: 'underline',
  },
  changeEmailForm: {
    width: '100%',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  link: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    marginTop: Spacing.lg,
  },
});
