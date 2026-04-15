import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
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
import { Colors, Spacing, FontSize, Fonts } from '../../src/constants/theme';

export default function UnlockScreen() {
  const router = useRouter();
  const { lockMethod, unlock } = usePinStore();
  const { logout } = useAuthStore();

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
      setError('Biométrie échouée. Réessayez.');
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
      setError(`PIN incorrect. ${5 - newAttempts} essai(s) restant(s).`);
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
      source={require('../../assets/bg_page.jpg')}
      style={styles.bg}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <View style={styles.container}>
        <Image
          source={require('../../assets/logo_min.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>
          {lockMethod === 'biometric' ? 'Déverrouillez avec Face ID / Touch ID' : 'Entrez votre PIN'}
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
              <Text style={styles.bioText}>Appuyer pour déverrouiller</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Se déconnecter</Text>
        </TouchableOpacity>
      </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  bg: { flex: 1 },
  container: {
    flex: 1,
    padding: Spacing.xl,
    paddingTop: 100,
    alignItems: 'center',
    gap: Spacing.xl,
  },
  logo: {
    width: 200,
    height: 56,
    alignSelf: 'center',
    marginBottom: Spacing.md,
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
    marginTop: 'auto',
    paddingVertical: Spacing.sm,
  },
  logoutText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
    textDecoration: 'underline',
  } as any,
});
