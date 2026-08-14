import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ResponsiveModal } from './ResponsiveModal';
import { PinPad } from './PinPad';
import { Button } from './Button';
import { usePinStore } from '../stores/pinStore';
import { verifyPin, authenticateWithBiometric } from '../services/secureAuthService';
import { verifyWebauthn } from '../services/webauthnService';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

interface Props {
  visible: boolean;
  /** Titre de la demande — ce que l'utilisateur s'apprête à faire. */
  title?: string;
  onClose: () => void;
  onSuccess: () => void;
}

const MAX_ATTEMPTS = 5;

/**
 * Confirmation par le verrou de l'appareil : biométrie, clé WebAuthn ou code.
 *
 * C'est la même preuve que celle qui ouvre l'app, redemandée devant un geste
 * sensible (données d'une carte, entrée dans la messagerie). Le mot de passe du
 * compte n'a pas sa place ici : beaucoup de comptes n'en ont pas — la connexion
 * se fait par code reçu par mail — et le verrou local est ce que l'utilisateur
 * a déjà en mémoire.
 *
 * Cette fenêtre suppose un verrou DÉJÀ configuré ; l'appelant s'en assure
 * (cf. `requireLocalLock`), sans quoi il n'y aurait rien à vérifier.
 */
export function LocalAuthModal({ visible, title, onClose, onSuccess }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const { lockMethod } = usePinStore();

  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [resetTrigger, setResetTrigger] = useState(false);
  const autoTried = useRef(false);

  // Rien ne survit à une fermeture : la fenêtre suivante repart de zéro.
  useEffect(() => {
    if (!visible) {
      setError(null);
      setAttempts(0);
      autoTried.current = false;
    }
  }, [visible]);

  // L'invite système EST la fenêtre : on la lance d'emblée, biométrie native
  // comme WebAuthn, pour éviter un appui inutile. Les navigateurs qui exigent
  // un geste utilisateur (Safari/iOS) rejettent l'appel WebAuthn sans rien
  // afficher — on retombe alors sur le bouton, sans message d'erreur.
  useEffect(() => {
    if (!visible || autoTried.current) return;
    if (lockMethod === 'biometric') {
      autoTried.current = true;
      runBiometric();
      return;
    }
    if (lockMethod === 'webauthn') {
      autoTried.current = true;
      verifyWebauthn().then((ok) => {
        if (ok) onSuccess();
      });
    }
  }, [visible, lockMethod]);

  const runBiometric = async () => {
    setError(null);
    const ok = await authenticateWithBiometric();
    ok ? onSuccess() : setError(t('auth.pin.biometricFailedShort'));
  };

  const runWebauthn = async () => {
    setError(null);
    const ok = await verifyWebauthn();
    ok ? onSuccess() : setError(t('auth.pin.biometricFailedShort'));
  };

  const runPin = async (pin: string) => {
    if (await verifyPin(pin)) {
      setError(null);
      onSuccess();
      return;
    }
    // Contrairement à l'écran de déverrouillage, un échec répété ne déconnecte
    // pas : on referme, la session reste ouverte, le geste est simplement refusé.
    const next = attempts + 1;
    setAttempts(next);
    setResetTrigger((v) => !v);
    if (next >= MAX_ATTEMPTS) {
      onClose();
      return;
    }
    setError(t('auth.pin.incorrectPin', { remaining: MAX_ATTEMPTS - next }));
  };

  const heading = title ?? t('security.confirmTitle');

  return (
    <ResponsiveModal visible={visible} onClose={onClose}>
      <View style={styles.container}>
        <View style={styles.head}>
          <Text style={styles.title}>{heading}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {lockMethod === 'pin' ? (
          <PinPad
            onComplete={runPin}
            error={error}
            reset={resetTrigger}
            label={t('security.confirmPinLabel')}
          />
        ) : (
          <View style={styles.bioBlock}>
            <View style={styles.bioIcon}>
              <FontAwesome6
                name={Platform.OS === 'web' ? 'fingerprint' : 'face-grin'}
                size={26}
                color={Colors.primary}
                iconStyle="solid"
              />
            </View>
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Button
              title={error ? t('security.confirmRetry') : t('auth.pin.tapToUnlock')}
              onPress={lockMethod === 'webauthn' ? runWebauthn : runBiometric}
              icon="unlock"
            />
            <Button
              title={t('common.cancel')}
              onPress={onClose}
              variant="outline"
              style={styles.cancelBtn}
              textStyle={styles.cancelText}
            />
          </View>
        )}
      </View>
    </ResponsiveModal>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.text },
  bioBlock: { gap: Spacing.md, alignItems: 'stretch' },
  bioIcon: {
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary + '18',
  },
  error: { fontSize: FontSize.sm, color: Colors.error, textAlign: 'center' },
  // Action secondaire : même forme que le bouton principal, teinte neutre.
  cancelBtn: { borderColor: Colors.surfaceBorder },
  cancelText: { color: Colors.textMuted },
});
