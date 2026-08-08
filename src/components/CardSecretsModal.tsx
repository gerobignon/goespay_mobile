import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ResponsiveModal } from './ResponsiveModal';
import { Input } from './Input';
import { Button } from './Button';
import { cardService, type CardSecrets, type VirtualCard } from '../services/cardService';
import { isBiometricAvailable, authenticateWithBiometric } from '../services/secureAuthService';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { getApiErrorMessage } from '../utils/apiError';

interface Props {
  visible: boolean;
  card: VirtualCard | null;
  onClose: () => void;
  /** Secrets délivrés par le serveur : l'appelant les affiche sur la carte. */
  onRevealed: (secrets: CardSecrets) => void;
}

/**
 * Ré-authentification avant d'afficher les données d'une carte.
 *
 * Deux barrières distinctes :
 *  · locale (biométrie ou code de l'app) — confort, elle n'atteste rien côté serveur ;
 *  · serveur (mot de passe du compte) — la seule qui compte réellement, exigée par la route.
 *
 * Cette fenêtre ne montre aucune donnée : elle obtient les secrets et les remet à
 * l'écran appelant, qui les affiche sur la carte elle-même et les oublie au bout
 * d'une minute. Rien n'est stocké — sur le web, le stockage de l'app n'est pas
 * chiffré.
 */
export function CardSecretsModal({ visible, card, onClose, onRevealed }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rien ne survit à une fermeture.
  useEffect(() => {
    if (!visible) {
      setPassword('');
      setError(null);
    }
  }, [visible]);

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
      setPassword('');
      onRevealed(res);
      onClose();
    } catch (e: any) {
      setError(getApiErrorMessage(e, t, t('cards.revealError')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveModal visible={visible} onClose={onClose} disableBackdropClose={loading}>
      <View style={styles.container}>
        <View style={styles.head}>
          <Text style={styles.title}>{t('cards.cardDetails')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10}>
            <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

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
      </View>
    </ResponsiveModal>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.text },
  webNote: { fontSize: FontSize.sm, color: Colors.warning },
  error: { fontSize: FontSize.sm, color: Colors.error },
});
