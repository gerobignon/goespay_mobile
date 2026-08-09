import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

import { useThemedStyles } from '../hooks/useThemedStyles';
import { useTheme } from './ThemeProvider';
import { BorderRadius, FontSize, Fonts, Spacing, withAlpha, type ColorPalette } from '../constants/theme';

/**
 * Visite guidée : un voile sombre sur tout l'écran sauf la zone commentée, et
 * une bulle qui avance pas à pas. Elle se déclenche une seule fois par écran
 * (clé AsyncStorage), et peut être relancée à la demande.
 */

export type CoachStep = {
  /** Identifiant de la zone à éclairer ; absent = bulle centrée (intro/fin). */
  target?: string;
  title: string;
  text: string;
  icon?: string;
};

type Rect = { x: number; y: number; width: number; height: number };

const storageKey = (key: string) => `coachmarks_seen_${key}`;

/** Efface la mémoire d'un guide : le prochain affichage de l'écran le rejoue. */
export const resetCoachmarks = (key: string) => AsyncStorage.removeItem(storageKey(key));

export type CoachmarksApi = {
  visible: boolean;
  /** À appeler quand l'écran prend le focus : ouvre le guide s'il n'a jamais été vu. */
  check: () => void;
  start: () => void;
  finish: () => void;
  register: (id: string, node: View | null) => void;
  nodes: React.MutableRefObject<Record<string, View | null>>;
};

export function useCoachmarks(key: string): CoachmarksApi {
  const [visible, setVisible] = useState(false);
  const nodes = useRef<Record<string, View | null>>({});
  const checking = useRef(false);

  const check = useCallback(() => {
    if (checking.current) return;
    checking.current = true;
    AsyncStorage.getItem(storageKey(key))
      .then((seen) => {
        // Le layout doit être posé avant de mesurer les cibles.
        if (!seen) setTimeout(() => setVisible(true), 700);
      })
      .catch(() => {})
      .finally(() => {
        checking.current = false;
      });
  }, [key]);

  const finish = useCallback(() => {
    setVisible(false);
    AsyncStorage.setItem(storageKey(key), '1').catch(() => {});
  }, [key]);

  const register = useCallback((id: string, node: View | null) => {
    nodes.current[id] = node;
  }, []);

  return { visible, check, start: () => setVisible(true), finish, register, nodes };
}

/** Enveloppe une zone à éclairer. La View est neutre : elle épouse son contenu. */
export function TourSpot({
  id,
  tour,
  style,
  children,
}: {
  id: string;
  tour: CoachmarksApi;
  style?: any;
  children: React.ReactNode;
}) {
  return (
    <View collapsable={false} ref={(n) => tour.register(id, n)} style={style}>
      {children}
    </View>
  );
}

export function Coachmarks({
  tour,
  steps,
  /** Décale la liste pour amener une cible hors écran dans la vue. */
  onScrollBy,
}: {
  tour: CoachmarksApi;
  steps: CoachStep[];
  onScrollBy?: (delta: number) => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { t } = useTranslation();
  const { width, height } = useWindowDimensions();

  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);

  const step = steps[index];
  const isLast = index === steps.length - 1;

  useEffect(() => {
    if (tour.visible) setIndex(0);
  }, [tour.visible]);

  /** Mesure la cible ; la fait défiler dans la vue si elle est hors écran. */
  const measure = useCallback(
    (attempt = 0) => {
      if (!step?.target) {
        setRect(null);
        return;
      }
      const node = tour.nodes.current[step.target];
      if (!node) {
        setRect(null);
        return;
      }
      node.measureInWindow((x, y, w, h) => {
        if ((!w || !h) && attempt < 4) {
          setTimeout(() => measure(attempt + 1), 140);
          return;
        }
        const tooHigh = y < 70;
        const tooLow = y + h > height - 260;
        if (onScrollBy && (tooHigh || tooLow) && attempt < 3) {
          onScrollBy(y - height * 0.32);
          setTimeout(() => measure(attempt + 1), 320);
          return;
        }
        setRect({ x, y, width: w, height: h });
      });
    },
    [step, height, onScrollBy, tour.nodes],
  );

  useEffect(() => {
    if (tour.visible) measure();
  }, [tour.visible, index, measure]);

  if (!tour.visible || !step) return null;

  const pad = 8;
  const hole = rect
    ? {
        x: Math.max(rect.x - pad, 0),
        y: Math.max(rect.y - pad, 0),
        width: rect.width + pad * 2,
        height: rect.height + pad * 2,
      }
    : null;

  // La bulle se place du côté où il reste de la place, sinon au centre.
  const below = hole ? hole.y + hole.height < height * 0.5 : false;
  const bubblePos = hole
    ? below
      ? { top: hole.y + hole.height + Spacing.md }
      : { bottom: height - hole.y + Spacing.md }
    : { top: height * 0.32 };

  return (
    // Guide obligatoire : ni croix, ni tap hors zone, ni retour Android — la
    // seule sortie est le dernier « C'est parti ».
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={() => {}}>
      <View style={StyleSheet.absoluteFill}>
        {/* Voile en quatre panneaux : la zone commentée reste à nu. */}
        {hole ? (
          <>
            <View style={[styles.veil, { top: 0, left: 0, right: 0, height: hole.y }]} />
            <View
              style={[styles.veil, { top: hole.y + hole.height, left: 0, right: 0, bottom: 0 }]}
            />
            <View style={[styles.veil, { top: hole.y, left: 0, width: hole.x, height: hole.height }]} />
            <View
              style={[
                styles.veil,
                { top: hole.y, left: hole.x + hole.width, right: 0, height: hole.height },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.ring,
                {
                  top: hole.y,
                  left: hole.x,
                  width: hole.width,
                  height: hole.height,
                  borderColor: colors.primary,
                },
              ]}
            />
          </>
        ) : (
          <View style={[styles.veil, StyleSheet.absoluteFillObject]} />
        )}

        <View style={[styles.bubbleWrap, bubblePos, { width }]} pointerEvents="box-none">
          <View style={[styles.bubble, { maxWidth: Math.min(width - Spacing.lg * 2, 420) }]}>
            <View style={styles.head}>
              <View style={[styles.icon, { backgroundColor: withAlpha(colors.primary, 0.14) }]}>
                <FontAwesome6 name={(step.icon || 'lightbulb') as any} size={14} color={colors.primary} />
              </View>
              <Text style={styles.title}>{step.title}</Text>
              <Text style={styles.counter}>
                {index + 1}/{steps.length}
              </Text>
            </View>

            <Text style={styles.text}>{step.text}</Text>

            <View style={styles.footer}>
              <View style={styles.dots}>
                {steps.map((s, i) => (
                  <View
                    key={i}
                    style={[
                      styles.dot,
                      {
                        backgroundColor: i === index ? colors.primary : colors.border,
                        width: i === index ? 16 : 6,
                      },
                    ]}
                  />
                ))}
              </View>
              <View style={styles.actions}>
                {index > 0 && (
                  <TouchableOpacity style={styles.ghostBtn} onPress={() => setIndex(index - 1)}>
                    <Text style={styles.ghostText}>{t('common.previous', 'Précédent')}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.nextBtn, { backgroundColor: colors.primary }]}
                  onPress={() => (isLast ? tour.finish() : setIndex(index + 1))}
                >
                  <Text style={styles.nextText}>
                    {isLast ? t('common.gotIt', 'C’est parti') : t('common.next', 'Suivant')}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    veil: {
      position: 'absolute',
      backgroundColor: 'rgba(0,0,0,0.74)',
    },
    ring: {
      position: 'absolute',
      borderWidth: 2,
      borderRadius: BorderRadius.lg,
    },
    bubbleWrap: {
      position: 'absolute',
      left: 0,
      alignItems: 'center',
      paddingHorizontal: Spacing.lg,
    },
    bubble: {
      width: '100%',
      backgroundColor: Colors.surface,
      borderRadius: BorderRadius.xl,
      borderWidth: 1,
      borderColor: Colors.border,
      padding: Spacing.md,
      gap: Spacing.sm,
      ...Platform.select({
        web: { boxShadow: '0 10px 30px rgba(0,0,0,0.25)' } as any,
        default: {
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 },
          elevation: 8,
        },
      }),
    },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    icon: {
      width: 28,
      height: 28,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      flex: 1,
      fontFamily: Fonts.bold,
      fontSize: FontSize.md,
      color: Colors.text,
    },
    counter: {
      fontFamily: Fonts.semiBold,
      fontSize: FontSize.sm,
      color: Colors.textMuted,
    },
    text: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.md,
      lineHeight: FontSize.md * 1.45,
      color: Colors.textSecondary,
    },
    footer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.sm,
      marginTop: Spacing.xs,
    },
    dots: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
    },
    dot: {
      height: 6,
      borderRadius: 3,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    ghostBtn: {
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.pill,
      borderWidth: 1,
      borderColor: Colors.border,
    },
    ghostText: {
      fontFamily: Fonts.semiBold,
      fontSize: FontSize.sm,
      color: Colors.text,
    },
    nextBtn: {
      paddingHorizontal: Spacing.lg,
      paddingVertical: Spacing.sm,
      borderRadius: BorderRadius.pill,
    },
    nextText: {
      fontFamily: Fonts.semiBold,
      fontSize: FontSize.sm,
      color: '#fff',
    },
  });
