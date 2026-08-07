import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, ActivityIndicator, AppState } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ResponsiveModal } from './ResponsiveModal';
import { Input } from './Input';
import { Button } from './Button';
import { cardService, type CardSecrets, type VirtualCard } from '../services/cardService';
import { isBiometricAvailable, authenticateWithBiometric } from '../services/secureAuthService';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { showAlert } from '../stores/alertStore';
import { getApiErrorMessage } from '../utils/apiError';

/** Le numéro reste affiché ce nombre de secondes, puis se masque tout seul. */
const AUTO_HIDE_SECONDS = 60;

interface Props {
  visible: boolean;
  card: VirtualCard | null;
  onClose: () => void;
}

/**
 * Affichage du numéro complet et du CVV.
 *
 * Deux barrières distinctes :
 *  · locale (biométrie ou code de l'app) — confort, elle n'atteste rien côté serveur ;
 *  · serveur (mot de passe du compte ou code de double authentification) — la seule
 *    qui compte réellement, exigée par la route.
 *
 * Rien n'est conservé : les secrets vivent dans l'état du composant, disparaissent
 * à la fermeture, au passage en arrière-plan et après une minute. Aucun stockage,
 * aucun cache — sur le web, le stockage de l'app n'est pas chiffré.
 */
export function CardSecretsModal({ visible, card, onClose }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [secrets, setSecrets] = useState<CardSecrets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(AUTO_HIDE_SECONDS);
  const [copied, setCopied] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const forget = () => {
    setSecrets(null);
    setPassword('');
    setError(null);
    setCountdown(AUTO_HIDE_SECONDS);
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  // Fermeture, changement de carte : on oublie immédiatement.
  useEffect(() => {
    if (!visible) forget();
  }, [visible]);

  // Passage en arrière-plan : le numéro ne doit pas survivre dans le sélecteur
  // d'applications.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') forget();
    });
    return () => sub.remove();
  }, []);

  // Auto-masquage.
  useEffect(() => {
    if (!secrets) return;
    timer.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          forget();
          return AUTO_HIDE_SECONDS;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [secrets]);

  const reveal = async () => {
    if (!card) return;
    setError(null);

    // Barrière locale d'abord, quand l'appareil la propose. Un échec ne bloque
    // pas : le serveur reste seul juge.
    if (Platform.OS !== 'web') {
      try {
        if (await isBiometricAvailable()) {
          const ok = await authenticateWithBiometric();
          if (!ok) {
            setError(t('cards.revealDenied'));
            return;
          }
        }
      } catch (_) {
        // Biométrie indisponible : on continue, le serveur tranchera.
      }
    }

    if (!password.trim()) {
      setError(t('cards.passwordRequired'));
      return;
    }

    setLoading(true);
    try {
      const res = await cardService.secrets(card.id, { password: password.trim() });
      setSecrets(res);
      setPassword('');
      setCountdown(AUTO_HIDE_SECONDS);
    } catch (e: any) {
      setError(getApiErrorMessage(e, t, t('cards.revealError')));
    } finally {
      setLoading(false);
    }
  };

  const copy = async (key: string, value: string) => {
    try {
      await Clipboard.setStringAsync(value);
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    } catch (_) {}
  };

  const groupPan = (pan: string) => pan.replace(/(.{4})/g, '$1 ').trim();

  return (
    <ResponsiveModal visible={visible} onClose={onClose} disableBackdropClose={loading}>
      <View style={styles.container}>
        <View style={styles.head}>
          <Text style={styles.title}>{t('cards.cardDetails')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        {!secrets ? (
          <>
            <Input
              label={t('cards.password')}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              editable={!loading}
            />
            {Platform.OS === 'web' && <Text style={styles.webNote}>{t('cards.webSecurityNote')}</Text>}
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Button
              title={t('cards.reveal')}
              onPress={reveal}
              loading={loading}
              disabled={loading}
              icon="eye"
            />
          </>
        ) : (
          <>
            <View style={styles.row}>
              <Text style={styles.label}>{t('cards.cardNumber')}</Text>
              <TouchableOpacity style={styles.valueRow} onPress={() => copy('pan', secrets.pan)}>
                <Text style={styles.mono}>{groupPan(secrets.pan)}</Text>
                <FontAwesome6
                  name={copied === 'pan' ? 'check' : 'copy'}
                  size={14}
                  color={copied === 'pan' ? Colors.success : Colors.textMuted}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.split}>
              <View style={styles.half}>
                <Text style={styles.label}>{t('cards.expiry')}</Text>
                <Text style={styles.mono}>
                  {secrets.expiry_month}/{String(secrets.expiry_year).slice(-2)}
                </Text>
              </View>
              <View style={styles.half}>
                <Text style={styles.label}>{t('cards.cvv')}</Text>
                <TouchableOpacity style={styles.valueRow} onPress={() => copy('cvv', secrets.cvv)}>
                  <Text style={styles.mono}>{secrets.cvv}</Text>
                  <FontAwesome6
                    name={copied === 'cvv' ? 'check' : 'copy'}
                    size={14}
                    color={copied === 'cvv' ? Colors.success : Colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.row}>
              <Text style={styles.label}>{t('cards.holder')}</Text>
              <Text style={styles.value}>{secrets.holder}</Text>
            </View>

            {!!secrets.billing_address && (
              <View style={styles.row}>
                <Text style={styles.label}>{t('cards.billingAddress')}</Text>
                <Text style={styles.value}>
                  {[
                    secrets.billing_address.street,
                    secrets.billing_address.city,
                    secrets.billing_address.state,
                    secrets.billing_address.postal_code,
                    secrets.billing_address.country,
                  ].filter(Boolean).join(', ')}
                </Text>
              </View>
            )}

            <Text style={styles.countdown}>{t('cards.autoHide', { seconds: countdown })}</Text>
            <Button title={t('cards.hide')} onPress={forget} variant="outline" icon="eye-slash" />
          </>
        )}
      </View>
    </ResponsiveModal>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.text },
  row: { gap: 4 },
  split: { flexDirection: 'row', gap: Spacing.md },
  half: { flex: 1, gap: 4 },
  label: { fontSize: FontSize.sm, color: Colors.textMuted },
  value: { fontSize: FontSize.md, color: Colors.text, fontFamily: Fonts.medium },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  mono: {
    fontSize: FontSize.lg,
    color: Colors.text,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    letterSpacing: 1,
  },
  countdown: { fontSize: FontSize.sm, color: Colors.textMuted, textAlign: 'center' },
  webNote: { fontSize: FontSize.sm, color: Colors.warning },
  error: { fontSize: FontSize.sm, color: Colors.error },
});
