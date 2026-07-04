import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useAuthStore } from '../stores/authStore';
import { affiliationService } from '../services/affiliationService';
import { useFormatXof } from '../utils/format';
import { ResponsiveModal } from './ResponsiveModal';
import { WelcomeBonusCelebration } from './WelcomeBonusCelebration';
import { Reveal } from './anim';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WelcomeBonus } from '../types';

const celebratedKey = (userId: number | string) => `welcome_bonus_celebrated_${userId}`;

const HERO_GRADIENT = ['#FBBF24', '#F59E0B', '#B45309'] as const;
const CTA_GRADIENT = ['#F59E0B', '#D97706'] as const;
const DONE_GRADIENT = ['#10B981', '#34D399'] as const;
const BAR_GRADIENT = ['#F59E0B', '#FBBF24'] as const;

/**
 * Carte « bonus de bienvenue » affichée au-dessus du solde à l'accueil :
 *   - KYC non soumis (validate=0) → incite à faire le KYC pour recevoir le bonus ;
 *   - KYC soumis (validate=2) → teaser « bonus à venir après validation » ;
 *   - bonus attribué mais bloqué (validate=1, state=blocked) → « en cours ».
 * Le bouton ouvre un modal premium détaillant montant + conditions/progression.
 * Masquée uniquement quand le bonus est déjà débloqué.
 */
export function WelcomeBonusCard() {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const fmtXof = useFormatXof();
  const user = useAuthStore((s) => s.user);
  const validate = user?.validate;

  const [bonus, setBonus] = useState<WelcomeBonus | null>(null);
  const [modal, setModal] = useState(false);
  const [celebrate, setCelebrate] = useState(false);

  // Refetch à chaque focus de l'accueil (pas seulement au montage) : le déblocage
  // peut survenir pendant que l'user navigue (ex. l'écran affiliation déclenche
  // checkUnlock) → en revenant sur l'accueil, la célébration se joue « en ligne ».
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (validate == null) {
        setBonus(null);
        return;
      }
      affiliationService
        .getWelcomeBonus()
        .then(async (b) => {
          if (!alive) return;
          setBonus(b);
          // Bonus fraîchement crédité → célébration UNE fois (persistée par user).
          // Si l'user était hors-ligne au déblocage, ça se joue à sa 1re connexion.
          if (b?.state === 'unlocked' && user?.id != null) {
            const seen = await AsyncStorage.getItem(celebratedKey(user.id));
            if (!seen && alive) setCelebrate(true);
          }
        })
        .catch(() => {});
      return () => { alive = false; };
    }, [validate, user?.id]),
  );

  const dismissCelebration = async () => {
    setCelebrate(false);
    if (user?.id != null) {
      await AsyncStorage.setItem(celebratedKey(user.id), '1');
    }
  };

  const notSubmitted = validate === 0;
  const pending = validate === 2;
  const blocked = bonus?.state === 'blocked';
  const showCard = notSubmitted || pending || blocked;

  const amount = bonus?.amount ?? 5000;
  const amountLabel = fmtXof(amount);
  const notValidatedYet = validate !== 1;

  const volCur = bonus?.volume.current ?? 0;
  const volTgt = bonus?.volume.target ?? 250000;
  const filCur = bonus?.filleuls.current ?? 0;
  const filTgt = bonus?.filleuls.target ?? 5;

  const renderCond = (icon: string, label: string, current: number, target: number, valueText: string) => {
    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    const done = current >= target;
    return (
      <View style={styles.condCard}>
        <View style={styles.condTop}>
          <View style={[styles.condIcon, done && styles.condIconDone]}>
            <FontAwesome6 name={(done ? 'check' : icon) as any} size={12} color={done ? '#FFFFFF' : '#B45309'} />
          </View>
          <Text style={styles.condLabel} numberOfLines={2}>{label}</Text>
          <Text style={[styles.condValue, done && styles.condValueDone]}>{valueText}</Text>
        </View>
        <View style={styles.track}>
          <LinearGradient
            colors={done ? DONE_GRADIENT : BAR_GRADIENT}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.fill, { width: `${pct}%` }]}
          />
        </View>
      </View>
    );
  };

  return (
    <>
      {showCard && (
      <>
      <Reveal offset={14}>
        <LinearGradient
          colors={['#F59E0B', '#D97706', '#B45309']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View style={styles.iconCircle}>
            <FontAwesome6 name="gift" size={20} color="#FFFFFF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{t('welcomeBonus.teaserTitle', { amount: amountLabel, defaultValue: `${amountLabel} vous attendent ✨` })}</Text>
            <Text style={styles.sub}>
              {notSubmitted
                ? t('welcomeBonus.notSubmittedSub', 'Terminez votre KYC pour recevoir votre bonus de bienvenue.')
                : pending
                  ? t('welcomeBonus.pendingSub', 'Votre bonus de bienvenue arrive après validation de votre KYC.')
                  : t('welcomeBonus.blockedSub', 'Remplissez 2 conditions pour débloquer votre bonus.')}
            </Text>
            <TouchableOpacity style={styles.cta} onPress={() => setModal(true)} activeOpacity={0.85}>
              <FontAwesome6 name="list-check" size={12} color="#B45309" />
              <Text style={styles.ctaText}>{t('welcomeBonus.seeConditions', 'Voir les conditions')}</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Reveal>

      <ResponsiveModal visible={modal} onClose={() => setModal(false)}>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
          {/* ── HERO ── */}
          <LinearGradient colors={HERO_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
            <Text style={[styles.spark, styles.spark1]}>✨</Text>
            <Text style={[styles.spark, styles.spark2]}>✦</Text>
            <Text style={[styles.spark, styles.spark3]}>✨</Text>
            <Text style={[styles.spark, styles.spark4]}>✦</Text>

            <TouchableOpacity style={styles.heroClose} onPress={() => setModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <FontAwesome6 name="xmark" size={16} color="#FFFFFF" />
            </TouchableOpacity>

            <View style={styles.heroGlow}>
              <View style={styles.heroBadge}>
                <FontAwesome6 name="gift" size={26} color="#B45309" />
              </View>
            </View>

            <View style={styles.exclusivePill}>
              <FontAwesome6 name="crown" size={9} color="#FFFFFF" />
              <Text style={styles.exclusiveText}>{t('welcomeBonus.exclusive', 'Offre exclusive')}</Text>
            </View>

            <Text style={styles.heroAmount}>{amountLabel}</Text>
            <Text style={styles.heroTagline}>{t('welcomeBonus.modalTitle', 'Bonus de bienvenue')}</Text>
          </LinearGradient>

          {/* ── BODY ── */}
          <View style={styles.body}>
            <Text style={styles.how}>
              {t('welcomeBonus.how', { amount: amountLabel, defaultValue: `Dès la validation de votre KYC, ${amountLabel} sont crédités (bloqués) sur votre solde. Ils se débloquent automatiquement quand les 2 conditions ci-dessous sont réunies.` })}
            </Text>

            {notValidatedYet && (
              <View style={styles.note}>
                <FontAwesome6 name="circle-info" size={13} color={Colors.info} />
                <Text style={styles.noteText}>{t('welcomeBonus.pendingNote', 'Le bonus démarre après la validation de votre KYC.')}</Text>
              </View>
            )}

            <Text style={styles.condHead}>{t('welcomeBonus.conditionsHead', 'Conditions de déblocage')}</Text>

            {renderCond(
              'arrow-trend-up',
              t('welcomeBonus.condVolume', 'Volume de transactions sortantes'),
              volCur, volTgt,
              `${fmtXof(volCur, { withCode: false })} / ${fmtXof(volTgt, { withCode: false })}`,
            )}
            {renderCond(
              'user-group',
              t('welcomeBonus.condFilleuls', 'Filleuls actifs (KYC + 1 transaction)'),
              filCur, filTgt,
              `${filCur} / ${filTgt}`,
            )}

            <TouchableOpacity activeOpacity={0.9} onPress={() => setModal(false)} style={styles.ctaBtnWrap}>
              <LinearGradient colors={CTA_GRADIENT} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ctaBtn}>
                <Text style={styles.ctaBtnText}>{t('welcomeBonus.close', 'Fermer')}</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </ResponsiveModal>
      </>
      )}

      <WelcomeBonusCelebration visible={celebrate} amountLabel={amountLabel} onClose={dismissCelebration} />
    </>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  // ── Carte accueil ──
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: 18,
    marginBottom: Spacing.md,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
  },
  sub: {
    color: 'rgba(255,255,255,0.92)',
    fontSize: FontSize.xs,
    fontFamily: Fonts.medium,
    marginTop: 2,
    marginBottom: Spacing.sm,
  },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: Spacing.md,
    paddingVertical: 7,
    borderRadius: BorderRadius.pill,
  },
  ctaText: {
    color: '#B45309',
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
  },

  // ── Modal ──
  scroll: {
    paddingBottom: Spacing.xl,
  },
  hero: {
    alignItems: 'center',
    paddingTop: Spacing.xl + Spacing.md,
    paddingBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    overflow: 'hidden',
  },
  spark: {
    position: 'absolute',
    color: 'rgba(255,255,255,0.85)',
  },
  spark1: { top: 18, left: 26, fontSize: 16 },
  spark2: { top: 44, right: 40, fontSize: 11 },
  spark3: { bottom: 30, left: 44, fontSize: 12 },
  spark4: { top: 90, left: 18, fontSize: 9 },
  heroClose: {
    position: 'absolute',
    top: Spacing.md,
    right: Spacing.md,
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  heroGlow: {
    width: 78,
    height: 78,
    borderRadius: 39,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: Spacing.md,
  },
  heroBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  exclusivePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: BorderRadius.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
  },
  exclusiveText: {
    color: '#FFFFFF',
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  heroAmount: {
    color: '#FFFFFF',
    fontSize: 44,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
    marginTop: Spacing.md,
    textShadowColor: 'rgba(120,53,15,0.4)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  heroTagline: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.5,
    marginTop: 2,
  },
  body: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  how: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
    lineHeight: 20,
    textAlign: 'center',
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: (Colors.info ?? '#3b82f6') + '18',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  noteText: {
    flex: 1,
    color: Colors.info ?? '#3b82f6',
    fontSize: FontSize.xs,
    fontFamily: Fonts.medium,
  },
  condHead: {
    color: Colors.text,
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: Spacing.xs,
  },
  condCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  condTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  condIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FDE68A',
  },
  condIconDone: {
    backgroundColor: '#10B981',
  },
  condLabel: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
  },
  condValue: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
  },
  condValueDone: {
    color: '#10B981',
  },
  track: {
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.inputBg,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 5,
  },
  ctaBtnWrap: {
    marginTop: Spacing.sm,
    borderRadius: BorderRadius.pill,
    overflow: 'hidden',
  },
  ctaBtn: {
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  ctaBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
});
