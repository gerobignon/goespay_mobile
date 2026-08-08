import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BorderRadius, FontSize, Fonts, Spacing, withAlpha, type ColorPalette } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useColors } from '../ThemeProvider';

/**
 * Carte promotionnelle d'une annonce du canal.
 *
 * Dessinée nativement et non rendue depuis du HTML : le fil n'a pas de moteur
 * de rendu, et une promotion vit de son visuel, de son accent de couleur et
 * d'un bouton qui ouvre un écran de l'application — trois choses qu'un
 * paragraphe mis en forme ne peut pas porter.
 *
 * Tout est facultatif sauf le titre. Le serveur a déjà borné les longueurs et
 * vérifié la destination du bouton : ici on affiche, on ne filtre plus.
 */

/** Destinations autorisées, telles que les nomme le serveur. */
const ROUTES: Record<string, string> = {
  home: '/(tabs)',
  deposit: '/(tabs)',
  transfer: '/(tabs)',
  history: '/(tabs)/history',
  affiliation: '/(tabs)/affiliation',
  kyc: '/kyc',
  messages: '/(tabs)/support',
  cards: '/account',
};

interface Props {
  meta: Record<string, any>;
}

export function PromoCard({ meta }: Props) {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const router = useRouter();

  const title = String(meta?.title || '');
  if (!title) return null;

  const bullets: string[] = Array.isArray(meta?.bullets) ? meta.bullets.map(String) : [];
  const image = String(meta?.image || '');
  const badge = String(meta?.badge || '');
  const subtitle = String(meta?.subtitle || '');
  const ctaLabel = String(meta?.cta_label || '');
  const ctaTarget = String(meta?.cta_target || '');

  const openCta = () => {
    if (!ctaTarget) return;
    if (/^https?:\/\//i.test(ctaTarget)) {
      Linking.openURL(ctaTarget).catch(() => {});
      return;
    }
    const route = ROUTES[ctaTarget];
    if (route) router.push(route as any);
  };

  return (
    <View style={styles.card}>
      {!!image && <Image source={{ uri: image }} style={styles.image} resizeMode="cover" />}

      <LinearGradient
        // Bleu → doré : `primary → info` étaient deux bleus voisins, le
        // dégradé ne se voyait pas.
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.head}
      >
        {!!badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge.toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </LinearGradient>

      {(bullets.length > 0 || !!ctaLabel) && (
        <View style={styles.body}>
          {bullets.map((line, i) => (
            <View key={i} style={styles.bullet}>
              <FontAwesome6 name="circle-check" size={14} color={colors.secondary} style={{ marginTop: 3 }} />
              <Text style={styles.bulletText}>{line}</Text>
            </View>
          ))}

          {!!ctaLabel && (
            <TouchableOpacity
              style={[styles.cta, { backgroundColor: colors.primary }]}
              onPress={openCta}
              activeOpacity={0.85}
            >
              <Text style={styles.ctaText}>{ctaLabel}</Text>
              <FontAwesome6 name="arrow-right" size={12} color={colors.white} />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    card: {
      borderRadius: BorderRadius.xl,
      overflow: 'hidden',
      backgroundColor: Colors.cardSolid,
      borderWidth: 1,
      borderColor: Colors.border,
      // Hors bulle : la carte prend la largeur du fil. À 268 px fixes, une
      // consigne tenait sur trois lignes de deux mots.
      width: '100%',
      maxWidth: 460,
      alignSelf: 'center',
    },
    image: { width: '100%', height: 168, backgroundColor: withAlpha(Colors.text, 0.06) },
    head: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.lg },
    badge: {
      alignSelf: 'flex-start',
      backgroundColor: 'rgba(255,255,255,0.24)',
      borderRadius: BorderRadius.pill,
      paddingHorizontal: Spacing.sm,
      paddingVertical: 2,
      marginBottom: Spacing.xs,
    },
    badgeText: {
      fontFamily: Fonts.bold,
      fontSize: 10,
      letterSpacing: 0.8,
      color: '#fff',
    },
    title: { fontFamily: Fonts.bold, fontSize: FontSize.xl, color: '#fff', lineHeight: 30 },
    subtitle: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.md,
      color: 'rgba(255,255,255,0.92)',
      marginTop: 4,
    },
    body: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.lg },
    bullet: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: Spacing.md,
      marginBottom: Spacing.sm,
    },
    bulletText: {
      flex: 1,
      fontFamily: Fonts.medium,
      fontSize: FontSize.md,
      color: Colors.text,
      lineHeight: 22,
    },
    cta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      borderRadius: BorderRadius.pill,
      paddingVertical: Spacing.md,
      marginTop: Spacing.md,
    },
    ctaText: { fontFamily: Fonts.bold, fontSize: FontSize.md, color: '#fff' },
  });
