import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AuthImage } from './AuthImage';
import { ImageLightbox } from './ImageLightbox';
import { showAlert } from '../stores/alertStore';
import { shareAuthImage } from '../utils/shareAuthImage';
import { Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import type { ColorPalette } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

/**
 * Capture du virement jointe par l'admin à un envoi Chine manuel. Servie par
 * l'API sous jeton (AuthImage), agrandie en plein écran au toucher, partageable
 * depuis la visionneuse.
 */
export function TransferProof({ uri, reference }: { uri?: string | null; reference?: string | null }) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const [open, setOpen] = useState(false);
  if (!uri) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{t('transaction.transferProof')}</Text>
      <TouchableOpacity onPress={() => setOpen(true)} activeOpacity={0.8}>
        <AuthImage uri={uri} style={styles.image} resizeMode="cover" />
      </TouchableOpacity>
      <ImageLightbox
        uri={open ? uri : null}
        onClose={() => setOpen(false)}
        onShare={async () => {
          try {
            await shareAuthImage(uri, `goespay-${(reference || 'virement').toLowerCase()}`, t('transaction.transferProof'));
          } catch {
            showAlert(t('common.error'), t('transaction.transferProofShareError'));
          }
        }}
      />
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  wrap: {
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  label: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
    color: Colors.textMuted,
  },
  image: {
    width: '100%',
    height: 220,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
  },
});
