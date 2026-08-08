import React from 'react';
import { View, Text, Image, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import type { VirtualCard } from '../services/cardService';
import { CardBrandLogo } from './CardBrandLogo';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

/** Proportions réelles d'une carte bancaire (85,6 × 54 mm). */
const CARD_RATIO = 1.586;

/**
 * Teintes possibles d'une carte.
 *
 * Deux cartes du même réseau doivent se distinguer AU PREMIER COUP D'ŒIL : dans
 * une liste, le porteur reconnaît sa carte à sa couleur bien avant de lire ses
 * quatre derniers chiffres. La teinte est dérivée de l'identifiant, donc stable
 * dans le temps et cohérente entre l'accueil et l'écran cartes.
 */
const PALETTES: Array<[string, string]> = [
  ['#2b5cff', '#0b1f5c'],   // bleu GoesPay
  ['#7b3fe4', '#2a1259'],   // violet
  ['#0f9b8e', '#06342f'],   // teal
  ['#e0623f', '#4a1a10'],   // cuivre
  ['#3f5bd9', '#101a3d'],   // indigo
  ['#c2367f', '#3d0f28'],   // magenta
];

/** Champ copiable depuis la carte. L'expiration n'est pas un secret. */
export type CardCopyField = 'pan' | 'cvv' | 'expiry';

interface Props {
  /** Carte réelle. Absente = aperçu commercial (aucune donnée personnelle). */
  card?: VirtualCard | null;
  /** Nom à graver sur la carte. */
  holder?: string;
  /**
   * Copie d'un champ depuis la carte. Fournie, elle rend le numéro, le
   * cryptogramme et l'expiration tapables. Absente (accueil), la carte reste une
   * simple vignette.
   */
  onCopy?: (field: CardCopyField) => void;
  /** Champ dont la copie vient d'aboutir : coche brève à la place de l'icône. */
  copiedField?: CardCopyField | null;
  /** Largeur maximale ; réduire donne un aperçu (accueil) plutôt qu'une fiche. */
  maxWidth?: number;
}

/**
 * Représentation visuelle d'une carte.
 *
 * N'affiche JAMAIS de donnée sensible : le numéro montré est celui, déjà masqué,
 * que renvoie le serveur, et le cryptogramme n'est qu'un gabarit de points. Les
 * valeurs réelles ne transitent que par la fenêtre de révélation ou la copie
 * directe, toutes deux derrière une ré-authentification serveur.
 */
/** Largeur de référence : celle de la fiche pleine, sur l'écran Cartes. */
const REFERENCE_WIDTH = 380;

export function VirtualCardVisual({ card, holder, onCopy, copiedField, maxWidth = 380 }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();

  const brand = (card?.brand || 'VISA').toUpperCase();

  // La copie n'a de sens que sur une carte réelle et utilisable.
  const copyable = !!onCopy && !!card && card.status === 'active';

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

  // Gelée ou morte, la carte perd sa couleur : l'état prime sur l'identité.
  const palette: [string, string] = dead
    ? ['#4b5563', '#1f2937']
    : frozen
      ? ['#64748b', '#334155']
      : PALETTES[(card?.id ?? 0) % PALETTES.length];

  // Une carte réduite doit réduire son contenu avec elle : les tailles de
  // texte étaient fixes, si bien qu'un aperçu à 300 px portait le lettrage
  // d'une carte de 380 — numéro et libellés paraissaient énormes.
  const k = Math.min(1, maxWidth / REFERENCE_WIDTH);
  const scaled = (value: number) => Math.round(value * k);

  return (
    <View style={[styles.wrap, { maxWidth }]}>
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
            style={[styles.logo, { width: scaled(112), height: scaled(34) }]}
            resizeMode="contain"
          />
        </View>

        {/* Le numéro complet n'est jamais affiché ici : le toucher le copie, la
            ré-authentification se jouant dans la fenêtre appelante. */}
        <TouchableOpacity
          style={styles.panRow}
          onPress={() => onCopy?.('pan')}
          disabled={!copyable}
          activeOpacity={0.7}
          accessibilityRole={copyable ? 'button' : undefined}
          accessibilityLabel={copyable ? t('cards.copyNumber') : undefined}
        >
          <Text style={[styles.pan, { fontSize: scaled(22), letterSpacing: scaled(3) }]}>{digits}</Text>
          {copyable && (
            <FontAwesome6
              name={copiedField === 'pan' ? 'check' : 'copy'}
              size={scaled(14)}
              color={copiedField === 'pan' ? '#7ee2a8' : 'rgba(255,255,255,0.75)'}
            />
          )}
        </TouchableOpacity>

        <View style={styles.bottom}>
          <View style={styles.bottomLeft}>
            <Text style={[styles.smallLabel, { fontSize: scaled(9) }]}>{t('cards.holder')}</Text>
            <Text style={[styles.holder, { fontSize: scaled(FontSize.sm) }]} numberOfLines={1}>
              {(holder || 'VOTRE NOM').toUpperCase()}
            </Text>
          </View>

          <TouchableOpacity
            onPress={() => onCopy?.('expiry')}
            disabled={!copyable}
            activeOpacity={0.7}
          >
            <Text style={[styles.smallLabel, { fontSize: scaled(9) }]}>{t('cards.expiry')}</Text>
            <Text style={[styles.expiry, { fontSize: scaled(FontSize.sm) }]}>{expiry}</Text>
          </TouchableOpacity>

          {/* Cryptogramme : un gabarit de points, jamais la valeur. Il figure sur
              la carte parce que le porteur le cherche là — le toucher le copie. */}
          <TouchableOpacity
            style={styles.cvvBlock}
            onPress={() => onCopy?.('cvv')}
            disabled={!copyable}
            activeOpacity={0.7}
            accessibilityRole={copyable ? 'button' : undefined}
            accessibilityLabel={copyable ? t('cards.copyCvv') : undefined}
          >
            <Text style={[styles.smallLabel, { fontSize: scaled(9) }]}>{t('cards.cvv')}</Text>
            <View style={styles.cvvRow}>
              <Text style={[styles.expiry, { fontSize: scaled(FontSize.sm) }]}>•••</Text>
              {copyable && (
                <FontAwesome6
                  name={copiedField === 'cvv' ? 'check' : 'copy'}
                  size={scaled(11)}
                  color={copiedField === 'cvv' ? '#7ee2a8' : 'rgba(255,255,255,0.75)'}
                />
              )}
            </View>
          </TouchableOpacity>

          <CardBrandLogo brand={brand} height={scaled(26)} />
        </View>
      </LinearGradient>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  wrap: { width: '100%', alignSelf: 'center' },
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
    height: 30,
    width: 112,
  },
  panRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
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
  cvvBlock: { alignItems: 'flex-start' },
  cvvRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
});
