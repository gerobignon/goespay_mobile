import React from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from 'react-i18next';
import type { VirtualCard } from '../services/cardService';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

/** Proportions réelles d'une carte bancaire (85,6 × 54 mm). */
const CARD_RATIO = 1.586;

interface Props {
  /** Carte réelle. Absente = aperçu commercial (aucune donnée personnelle). */
  card?: VirtualCard | null;
  /** Nom à graver sur la carte. */
  holder?: string;
}

/**
 * Représentation visuelle d'une carte.
 *
 * N'affiche JAMAIS de donnée sensible : le numéro montré est celui, déjà masqué,
 * que renvoie le serveur. Le numéro complet et le cryptogramme vivent uniquement
 * dans la fenêtre de révélation, après ré-authentification.
 */
export function VirtualCardVisual({ card, holder }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  const brand = (card?.brand || 'VISA').toUpperCase();
  const isMastercard = brand === 'MASTERCARD';

  // Un PAN masqué arrive sous la forme « 465189******2455 » : on le regroupe par
  // quatre pour retrouver la lecture d'une vraie carte.
  const digits = card?.masked_pan
    ? card.masked_pan.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim()
    : '•••• •••• •••• ••••';

  const expiry = card?.expiry_month
    ? `${card.expiry_month}/${String(card.expiry_year).slice(-2)}`
    : '••/••';

  const frozen = card?.status === 'frozen';
  const dead = card?.status === 'terminated' || card?.status === 'failed';

  const palette: [string, string] = dead
    ? ['#4b5563', '#1f2937']
    : frozen
      ? ['#64748b', '#334155']
      : ['#2b5cff', '#0b1f5c'];

  return (
    <View style={styles.wrap}>
      <LinearGradient colors={palette} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.card}>
        {/* Reflets décoratifs : deux disques très diffus, sans image à charger. */}
        <View style={styles.glowTop} />
        <View style={styles.glowBottom} />

        <View style={styles.top}>
          <View style={styles.chip}>
            <View style={styles.chipLine} />
            <View style={styles.chipLine} />
          </View>
          <Image
            source={require('../../assets/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text style={styles.pan}>{digits}</Text>

        <View style={styles.bottom}>
          <View style={styles.bottomLeft}>
            <Text style={styles.smallLabel}>{t('cards.holder')}</Text>
            <Text style={styles.holder} numberOfLines={1}>
              {(holder || 'VOTRE NOM').toUpperCase()}
            </Text>
          </View>

          <View>
            <Text style={styles.smallLabel}>{t('cards.expiry')}</Text>
            <Text style={styles.expiry}>{expiry}</Text>
          </View>

          {isMastercard ? (
            <View style={styles.mcWrap}>
              <View style={[styles.mcCircle, { backgroundColor: '#EB001B' }]} />
              <View style={[styles.mcCircle, styles.mcCircleRight, { backgroundColor: '#F79E1B' }]} />
            </View>
          ) : (
            <Text style={styles.visa}>VISA</Text>
          )}
        </View>
      </LinearGradient>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  wrap: { width: '100%', maxWidth: 380, alignSelf: 'center' },
  card: {
    width: '100%',
    aspectRatio: CARD_RATIO,
    borderRadius: 18,
    padding: Spacing.md,
    justifyContent: 'space-between',
    overflow: 'hidden',
    ...Platform.select({
      web: { boxShadow: '0 18px 40px rgba(11,31,92,0.35)' } as any,
      default: {
        shadowColor: '#0b1f5c',
        shadowOpacity: 0.35,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 12 },
        elevation: 8,
      },
    }),
  },
  glowTop: {
    position: 'absolute',
    top: -70,
    right: -40,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: 'rgba(255,255,255,0.13)',
  },
  glowBottom: {
    position: 'absolute',
    bottom: -90,
    left: -50,
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: {
    width: 42,
    height: 32,
    borderRadius: 6,
    backgroundColor: '#e8c162',
    paddingVertical: 6,
    paddingHorizontal: 8,
    justifyContent: 'space-between',
  },
  chipLine: { height: 1.5, backgroundColor: 'rgba(0,0,0,0.28)', borderRadius: 1 },
  // Ratio du logo ≈ 3,73 : la largeur suit la hauteur pour éviter toute déformation.
  logo: {
    height: 22,
    width: 82,
  },
  pan: {
    color: '#ffffff',
    fontSize: 22,
    letterSpacing: 2.5,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: Spacing.sm },
  bottomLeft: { flex: 1, minWidth: 0 },
  smallLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 9,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  holder: { color: '#ffffff', fontSize: FontSize.sm, fontFamily: Fonts.medium, letterSpacing: 1 },
  expiry: { color: '#ffffff', fontSize: FontSize.sm, fontFamily: Fonts.medium, letterSpacing: 1 },
  visa: {
    color: '#ffffff',
    fontSize: 26,
    fontFamily: Fonts.bold,
    fontStyle: 'italic',
    letterSpacing: -0.5,
  },
  mcWrap: { flexDirection: 'row', alignItems: 'center', width: 46, height: 28 },
  mcCircle: { width: 28, height: 28, borderRadius: 14, opacity: 0.9 },
  mcCircleRight: { marginLeft: -14 },
});
