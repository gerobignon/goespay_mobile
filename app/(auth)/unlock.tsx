import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  useWindowDimensions,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { PinPad } from '../../src/components/PinPad';
import { usePinStore } from '../../src/stores/pinStore';
import {
  verifyPin,
  authenticateWithBiometric,
  isBiometricAvailable,
  getCredentials,
  clearAllSecureData,
} from '../../src/services/secureAuthService';
import { Image } from 'react-native';
import { useAuthStore } from '../../src/stores/authStore';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts } from '../../src/constants/theme';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useTheme } from '../../src/components/ThemeProvider';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher';

export default function UnlockScreen() {
  const router = useRouter();
  const { lockMethod, unlock } = usePinStore();
  const { logout } = useAuthStore();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { height } = useWindowDimensions();
  const isSmallScreen = height <= 720;
  const { t } = useTranslation();

  const [error, setError] = useState<string | null>(null);
  const [resetTrigger, setResetTrigger] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(setBioAvailable);
  }, []);

  // Tenter la biométrie automatiquement au montage si c'est la méthode configurée
  useEffect(() => {
    if (lockMethod === 'biometric') {
      handleBiometric();
    }
  }, [lockMethod]);

  const handleBiometric = async () => {
    const success = await authenticateWithBiometric();
    if (success) {
      unlock();
      router.replace('/(tabs)');
    } else {
      setError(t('auth.pin.biometricFailedShort'));
    }
  };

  const handlePin = async (pin: string) => {
    const valid = await verifyPin(pin);
    if (valid) {
      setError(null);
      unlock();
      router.replace('/(tabs)');
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      if (newAttempts >= 5) {
        // 5 erreurs → déconnexion complète
        await clearAllSecureData();
        await logout();
        router.replace('/(auth)/login');
        return;
      }
      setError(t('auth.pin.incorrectPin', { remaining: 5 - newAttempts }));
      setResetTrigger((v) => !v);
    }
  };

  const handleLogout = async () => {
    await clearAllSecureData();
    await logout();
    router.replace('/(auth)/login');
  };

  return (
    <ImageBackground
      source={isDark ? require('../../assets/bg_page.jpg') : require('../../assets/bg_page_light.jpg')}
      style={styles.bg}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <LanguageSwitcher />
      <ScrollView
        contentContainerStyle={[styles.container, isSmallScreen && styles.containerSmall]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={require('../../assets/logo_min.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>
          {lockMethod === 'biometric' ? t('auth.pin.unlockBiometric', 'Déverrouillez avec Face ID / Touch ID') : t('auth.pin.enterPin', 'Entrez votre PIN')}
        </Text>

        {lockMethod === 'pin' && (
          <PinPad
            length={4}
            onComplete={handlePin}
            error={error}
            reset={resetTrigger}
            onBiometric={bioAvailable && lockMethod === 'pin' ? undefined : undefined}
          />
        )}

        {lockMethod === 'biometric' && (
          <View style={styles.bioContainer}>
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <TouchableOpacity style={styles.bioBtn} onPress={handleBiometric}>
              <FontAwesome6 name="fingerprint" size={48} color={Colors.secondary} />
              <Text style={styles.bioText}>{t('auth.pin.tapToUnlock', 'Appuyer pour déverrouiller')}</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>{t('account.logout')}</Text>
        </TouchableOpacity>
      </ScrollView>
      </SafeAreaView>
    </ImageBackground>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  bg: { flex: 1 },
  container: {
    flexGrow: 1,
    padding: Spacing.xl,
    paddingTop: 100,
    alignItems: 'center',
    gap: Spacing.xl,
  },
  containerSmall: {
    paddingTop: Spacing.lg,
    gap: Spacing.md,
  },
  logo: {
    width: 220,
    height: 63,
    alignSelf: 'center',
    marginBottom: Spacing.sm,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
  },
  bioContainer: {
    alignItems: 'center',
    gap: Spacing.lg,
  },
  bioBtn: {
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.xl,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  bioText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
  },
  error: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  logoutBtn: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  logoutText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
    textDecoration: 'underline',
  } as any,
});
