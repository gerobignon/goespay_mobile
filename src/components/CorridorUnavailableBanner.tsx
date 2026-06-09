import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { corridorService } from '../services/corridorService';

interface Props {
  country: string;           // ISO-2 du pays indisponible
  countryName?: string;      // libellé affiché
  message?: string;          // texte du badge (défaut FR)
  notifyLabel?: string;      // libellé bouton
  notifiedLabel?: string;    // libellé après inscription
}

/**
 * Badge "corridor temporairement indisponible" + bouton "Me notifier".
 * S'affiche quand aucun réseau payout d'un pays n'est actif (corridorStore).
 * Le bouton inscrit l'utilisateur à la liste d'attente (notification mail).
 */
export function CorridorUnavailableBanner({
  country,
  countryName,
  message,
  notifyLabel = 'Me notifier',
  notifiedLabel = 'Vous serez notifié',
}: Props) {
  const styles = useThemedStyles(createStyles);
  const [state, setState] = useState<'idle' | 'loading' | 'done'>('idle');

  const label = countryName || country;
  const text =
    message ||
    `Les transferts vers ${label} sont temporairement indisponibles. Nous vous notifierons dès leur rétablissement.`;

  const onNotify = async () => {
    if (state !== 'idle') return;
    setState('loading');
    try {
      await corridorService.joinWaitlist(country);
      setState('done');
    } catch {
      setState('idle');
    }
  };

  return (
    <View style={styles.banner}>
      <FontAwesome6 name="circle-info" size={14} color="#fff" style={{ marginRight: 8, marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.text}>{text}</Text>
        <TouchableOpacity
          style={[styles.btn, state !== 'idle' && styles.btnDone]}
          onPress={onNotify}
          disabled={state !== 'idle'}
          activeOpacity={0.8}
        >
          {state === 'loading' ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <FontAwesome6
                name={state === 'done' ? 'check' : 'bell'}
                size={12}
                color="#fff"
                style={{ marginRight: 6 }}
              />
              <Text style={styles.btnText}>{state === 'done' ? notifiedLabel : notifyLabel}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: Colors.pending,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  text: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    lineHeight: 18,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(0,0,0,0.18)',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    marginTop: Spacing.sm,
  },
  btnDone: {
    opacity: 0.75,
  },
  btnText: {
    color: '#fff',
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
  },
});
