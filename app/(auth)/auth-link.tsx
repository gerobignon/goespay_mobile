import React, { useEffect, useRef, useState } from 'react';
import { Text, StyleSheet, ScrollView, ActivityIndicator, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { ScreenBackground } from '../../src/components/ScreenBackground';
import { GlassCard } from '../../src/components/GlassCard';
import { OtpInput } from '../../src/components/OtpInput';
import { Button } from '../../src/components/Button';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts } from '../../src/constants/theme';
import { authService } from '../../src/services/authService';
import { useAuthStore } from '../../src/stores/authStore';
import { showAlert } from '../../src/stores/alertStore';
import { clearPendingLoginCode } from '../../src/utils/pendingLoginCode';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useTranslation } from 'react-i18next';

/**
 * Arrivée du lien de connexion reçu par email
 * (https://app.goespay.io/auth-link?t=…). Sur téléphone, les App Links
 * (Android) et Universal Links (iOS) ouvrent l'app installée sur cette route ;
 * sinon c'est la PWA qui l'affiche. La session s'ouvre sur l'appareil où le
 * lien a été cliqué, jamais ailleurs.
 */
type Phase = 'checking' | '2fa' | 'invalid';

export default function AuthLinkScreen() {
  const { t: token } = useLocalSearchParams<{ t?: string }>();
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const loginWithToken = useAuthStore((s) => s.loginWithToken);
  const [phase, setPhase] = useState<Phase>('checking');
  const [error, setError] = useState('');
  const [tempToken, setTempToken] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [loading, setLoading] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    // Le lien ne sert qu'une fois : un second rendu ne doit pas le rejouer.
    if (startedRef.current) return;
    startedRef.current = true;
    if (!token || typeof token !== 'string') {
      setPhase('invalid');
      return;
    }
    (async () => {
      try {
        const response = await authService.verifyLoginLink(token);
        await clearPendingLoginCode();
        if (response.two_factor_required && response.temp_token) {
          setTempToken(response.temp_token);
          setPhase('2fa');
          return;
        }
        // La mise en page racine emmène dans l'app dès que la session existe.
        await loginWithToken(response.token!, response.user!, true);
      } catch (e: any) {
        setError(e?.response?.data?.error || '');
        setPhase('invalid');
      }
    })();
  }, [token, loginWithToken]);

  const handleVerify2fa = async () => {
    if (loading || twoFaCode.length !== 6) return;
    setLoading(true);
    try {
      const response = await authService.verify2faLogin(tempToken, twoFaCode);
      await loginWithToken(response.token!, response.user!, true);
    } catch (e: any) {
      setTwoFaCode('');
      showAlert(t('common.error'), e?.response?.data?.error || t('auth.login.incorrectCode', 'Code incorrect.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenBackground edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <GlassCard style={{ alignItems: 'center' }}>
          {phase === 'checking' && (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={Colors.secondary} />
              <Text style={styles.message}>{t('auth.link.checking')}</Text>
            </View>
          )}

          {phase === '2fa' && (
            <View style={styles.form}>
              <Text style={styles.title}>{t('auth.login.twoFaTitle')}</Text>
              <Text style={styles.message}>{t('auth.login.twoFaHint')}</Text>
              <OtpInput value={twoFaCode} onChange={setTwoFaCode} onComplete={handleVerify2fa} />
              <Button
                title={t('auth.login.twoFaVerify')}
                onPress={handleVerify2fa}
                loading={loading}
                disabled={twoFaCode.length !== 6}
                icon="check"
              />
            </View>
          )}

          {phase === 'invalid' && (
            <View style={styles.center}>
              <FontAwesome6 name="link-slash" size={48} color={Colors.secondary} style={{ marginBottom: Spacing.md }} />
              <Text style={styles.title}>{t('auth.link.invalidTitle')}</Text>
              <Text style={styles.message}>{error || t('auth.link.invalidMessage')}</Text>
              <Button
                title={t('auth.forgotPassword.backToLogin')}
                onPress={() => router.replace('/(auth)/login')}
                icon="right-to-bracket"
              />
            </View>
          )}
        </GlassCard>
      </ScrollView>
    </ScreenBackground>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  center: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.md,
  },
  form: {
    width: '100%',
    gap: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
    textAlign: 'center',
  },
  message: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
