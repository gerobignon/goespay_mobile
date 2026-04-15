import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform, ScrollView, ImageBackground } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, Fonts } from '../../src/constants/theme';
import { Input } from '../../src/components/Input';
import { OtpInput } from '../../src/components/OtpInput';
import { Button } from '../../src/components/Button';
import { authService } from '../../src/services/authService';
import { showAlert } from '../../src/stores/alertStore';

export default function ActivationScreen() {
  const { email } = useLocalSearchParams<{ email: string }>();
  const router = useRouter();
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
        'Compte activé',
        'Votre adresse email a été vérifiée. Vous pouvez maintenant vous connecter.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Code de vérification incorrect.';
      showAlert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await authService.resendVerification(currentEmail);
      showAlert('Envoyé', 'Un nouveau code a été envoyé à votre adresse email.');
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Erreur lors de l\'envoi.';
      showAlert('Erreur', msg);
    } finally {
      setResending(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail.trim() || !/\S+@\S+\.\S+/.test(newEmail)) {
      showAlert('Erreur', 'Veuillez entrer une adresse email valide.');
      return;
    }
    setChangingEmail(true);
    try {
      await authService.changeEmail(currentEmail, newEmail.trim());
      setCurrentEmail(newEmail.trim());
      setNewEmail('');
      setShowChangeEmail(false);
      setCode('');
      showAlert('Succès', `Adresse email modifiée. Un nouveau code a été envoyé à ${newEmail.trim()}.`);
    } catch (error: any) {
      const msg = error?.response?.data?.error || 'Erreur lors du changement d\'email.';
      showAlert('Erreur', msg);
    } finally {
      setChangingEmail(false);
    }
  };

  return (
    <ImageBackground source={require('../../assets/bg_page.jpg')} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center' }} keyboardShouldPersistTaps="handled">
      <FontAwesome6
        name="envelope-circle-check"
        size={64}
        color={Colors.secondary}
        style={{ marginBottom: Spacing.lg }}
      />
      <Text style={styles.title}>Vérification email</Text>
      <Text style={styles.message}>
        Un code de vérification a été envoyé à{'\n'}
        <Text style={styles.emailText}>{currentEmail}</Text>
      </Text>

      <View style={styles.form}>
        <OtpInput value={code} onChange={setCode} onComplete={handleVerify} />
        <Button
          title="Vérifier"
          onPress={handleVerify}
          loading={loading}
          disabled={code.length !== 6}
          icon="check"
        />
      </View>

      <TouchableOpacity onPress={handleResend} disabled={resending} style={styles.resendBtn}>
        <Text style={styles.resendText}>
          {resending ? 'Envoi en cours...' : 'Renvoyer le code'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setShowChangeEmail(!showChangeEmail)} style={styles.resendBtn}>
        <Text style={styles.changeEmailText}>Changer l'adresse email</Text>
      </TouchableOpacity>

      {showChangeEmail && (
        <View style={styles.changeEmailForm}>
          <Input
            label="Nouvelle adresse email"
            placeholder="nouvelle@email.com"
            value={newEmail}
            onChangeText={setNewEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Button
            title="Confirmer le changement"
            onPress={handleChangeEmail}
            loading={changingEmail}
            icon="envelope"
          />
        </View>
      )}

      <Link href="/(auth)/login" style={styles.link}>
        Retour à la connexion
      </Link>
    </ScrollView>
    </KeyboardAvoidingView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.lg,
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
