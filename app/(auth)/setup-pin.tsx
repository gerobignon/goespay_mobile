import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { PinPad } from '../../src/components/PinPad';
import { usePinStore } from '../../src/stores/pinStore';
import {
  savePin,
  setLockMethod,
  isBiometricAvailable,
  authenticateWithBiometric,
} from '../../src/services/secureAuthService';
import { Image } from 'react-native';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts } from '../../src/constants/theme';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useTheme } from '../../src/components/ThemeProvider';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../src/components/LanguageSwitcher';

type Step = 'choose' | 'enter-pin' | 'confirm-pin' | 'done';

export default function SetupPinScreen() {
  const router = useRouter();
  const { setMethod, unlock } = usePinStore();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { t } = useTranslation();

  const [step, setStep] = useState<Step>('choose');
  const [firstPin, setFirstPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [resetTrigger, setResetTrigger] = useState(false);
  const [bioAvailable, setBioAvailable] = useState(false);

  useEffect(() => {
    isBiometricAvailable().then(setBioAvailable);
  }, []);

  const handleChoosePin = () => setStep('enter-pin');

  const handleChooseBiometric = async () => {
    const success = await authenticateWithBiometric();
    if (success) {
      await setLockMethod('biometric');
      await setMethod('biometric');
      unlock();
      router.replace('/(tabs)');
    } else {
      setError(t('auth.pin.biometricFailed'));
    }
  };

  const handleFirstPin = (pin: string) => {
    setFirstPin(pin);
    setError(null);
    setResetTrigger((v) => !v); // vide le clavier avant la confirmation
    setStep('confirm-pin');
  };

  const handleConfirmPin = async (pin: string) => {
    if (pin !== firstPin) {
      setError(t('auth.pin.pinMismatch'));
      setResetTrigger((v) => !v);
      setStep('enter-pin');
      setFirstPin('');
      return;
    }
    await savePin(pin);
    await setLockMethod('pin');
    await setMethod('pin');
    unlock();
    router.replace('/(tabs)');
  };

  const triggerReset = () => {
    setResetTrigger((v) => !v);
    setError(null);
  };

  return (
    <ImageBackground
      source={isDark ? require('../../assets/bg_page.jpg') : require('../../assets/bg_page_light.jpg')}
      style={styles.bg}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <LanguageSwitcher />
      <ScrollView contentContainerStyle={styles.container}>
        <Image
          source={require('../../assets/logo_min.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        {step === 'choose' && (
          <View style={styles.content}>
            <Text style={styles.title}>{t('auth.pin.secureAccount', 'Sécurisez votre compte')}</Text>
            <Text style={styles.subtitle}>
              {t('auth.pin.chooseMethod', "Choisissez comment vous souhaitez déverrouiller l'application. Cette étape est obligatoire.")}
            </Text>

            <TouchableOpacity style={styles.option} onPress={handleChoosePin}>
              <View style={styles.optionIcon}>
                <FontAwesome6 name="hashtag" size={22} color={Colors.primary} />
              </View>
              <View style={styles.optionText}>
                <Text style={styles.optionTitle}>{t('account.pin', 'Code PIN')}</Text>
                <Text style={styles.optionDesc}>{t('auth.pin.pinDesc', '4 chiffres à saisir à chaque ouverture')}</Text>
              </View>
              <FontAwesome6 name="chevron-right" size={14} color={Colors.textMuted} />
            </TouchableOpacity>

            {bioAvailable && (
              <TouchableOpacity style={styles.option} onPress={handleChooseBiometric}>
                <View style={styles.optionIcon}>
                  <FontAwesome6 name="fingerprint" size={22} color={Colors.secondary} />
                </View>
                <View style={styles.optionText}>
                  <Text style={styles.optionTitle}>{t('account.biometric')}</Text>
                  <Text style={styles.optionDesc}>{t('auth.pin.biometricDesc', 'Déverrouillage biométrique rapide')}</Text>
                </View>
                <FontAwesome6 name="chevron-right" size={14} color={Colors.textMuted} />
              </TouchableOpacity>
            )}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </View>
        )}

        {step === 'enter-pin' && (
          <View style={styles.content}>
            <Text style={styles.title}>{t('auth.pin.choosePin', 'Choisissez un PIN')}</Text>
            <PinPad
              length={4}
              onComplete={handleFirstPin}
              error={error}
              label={t('auth.pin.enter4digits', 'Entrez votre PIN à 4 chiffres')}
              reset={resetTrigger}
            />
            <TouchableOpacity onPress={() => { setStep('choose'); setError(null); }}>
              <Text style={styles.back}>← {t('common.back')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {step === 'confirm-pin' && (
          <View style={styles.content}>
            <Text style={styles.title}>{t('auth.pin.confirmTitle')}</Text>
            <PinPad
              length={4}
              onComplete={handleConfirmPin}
              error={error}
              label={t('auth.pin.confirmPin', 'Confirmez votre PIN')}
              reset={resetTrigger}
            />
            <TouchableOpacity onPress={() => { setStep('enter-pin'); setError(null); triggerReset(); }}>
              <Text style={styles.back}>← {t('common.back')}</Text>
            </TouchableOpacity>
          </View>
        )}
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
    paddingTop: 80,
    alignItems: 'center',
    gap: Spacing.xl,
  },
  logo: {
    width: 200,
    height: 56,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  content: {
    width: '100%',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    textAlign: 'center',
    lineHeight: 22,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
    borderRadius: 14,
    padding: Spacing.md,
    width: '100%',
    gap: Spacing.md,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1 },
  optionTitle: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
  },
  optionDesc: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    marginTop: 2,
  },
  error: {
    color: Colors.error,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  back: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
    marginTop: Spacing.sm,
  },
});
