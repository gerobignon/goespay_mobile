import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useAuthStore } from '../stores/authStore';
import { affiliationService } from '../services/affiliationService';
import { useFormatXof } from '../utils/format';
import { ResponsiveModal } from './ResponsiveModal';
import { Reveal } from './anim';
import type { WelcomeBonus } from '../types';

/**
 * Carte « bonus de bienvenue » affichée au-dessus du solde à l'accueil :
 *   - KYC non soumis (validate=0) → incite à faire le KYC pour recevoir le bonus ;
 *   - KYC soumis (validate=2) → teaser « bonus à venir après validation » ;
 *   - bonus attribué mais bloqué (validate=1, state=blocked) → « en cours ».
 * Un bouton ouvre un modal détaillant les 2 conditions et leur progression.
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

  useEffect(() => {
    let alive = true;
    if (validate == null) {
      setBonus(null);
      return;
    }
    affiliationService
      .getWelcomeBonus()
      .then((b) => { if (alive) setBonus(b); })
      .catch(() => {});
    return () => { alive = false; };
  }, [validate]);

  const notSubmitted = validate === 0;
  const pending = validate === 2;
  const blocked = bonus?.state === 'blocked';
  // Masquée seulement quand le bonus est déjà débloqué (ou user absent).
  if (!notSubmitted && !pending && !blocked) return null;

  const amount = bonus?.amount ?? 5000;
  const amountLabel = fmtXof(amount);

  const renderProgress = (label: string, current: number, target: number, valueText: string) => {
    const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;
    const done = current >= target;
    return (
      <View style={styles.progressBlock}>
        <View style={styles.progressHead}>
          <Text style={styles.progressLabel}>{label}</Text>
          <Text style={[styles.progressValue, done && { color: Colors.success }]}>{valueText}</Text>
        </View>
        <View style={styles.track}>
          <View style={[styles.fill, { width: `${pct}%`, backgroundColor: done ? Colors.success : Colors.warning }]} />
        </View>
      </View>
    );
  };

  return (
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
        <ScrollView contentContainerStyle={styles.modalContent} showsVerticalScrollIndicator={false}>
          <View style={styles.modalHeader}>
            <View style={styles.modalIcon}>
              <FontAwesome6 name="gift" size={22} color={Colors.warning} />
            </View>
            <Text style={styles.modalTitle}>{t('welcomeBonus.modalTitle', 'Bonus de bienvenue')}</Text>
            <TouchableOpacity onPress={() => setModal(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.modalAmount}>{amountLabel}</Text>

          <Text style={styles.modalText}>
            {t('welcomeBonus.how', { amount: amountLabel, defaultValue: `Dès la validation de votre KYC, ${amountLabel} sont crédités (bloqués) sur votre solde. Ils se débloquent automatiquement quand les 2 conditions ci-dessous sont réunies.` })}
          </Text>

          {validate !== 1 && (
            <View style={styles.note}>
              <FontAwesome6 name="circle-info" size={13} color={Colors.info} />
              <Text style={styles.noteText}>{t('welcomeBonus.pendingNote', 'Le bonus démarre après la validation de votre KYC.')}</Text>
            </View>
          )}

          <View style={styles.conditions}>
            {renderProgress(
              t('welcomeBonus.condVolume', 'Volume de transactions sortantes'),
              bonus?.volume.current ?? 0,
              bonus?.volume.target ?? 250000,
              `${fmtXof(bonus?.volume.current ?? 0, { withCode: false })} / ${fmtXof(bonus?.volume.target ?? 250000, { withCode: false })}`,
            )}
            {renderProgress(
              t('welcomeBonus.condFilleuls', 'Filleuls actifs (KYC + 1 transaction)'),
              bonus?.filleuls.current ?? 0,
              bonus?.filleuls.target ?? 5,
              `${bonus?.filleuls.current ?? 0} / ${bonus?.filleuls.target ?? 5}`,
            )}
          </View>

          <TouchableOpacity style={styles.closeBtn} onPress={() => setModal(false)} activeOpacity={0.85}>
            <Text style={styles.closeBtnText}>{t('welcomeBonus.close', 'Fermer')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </ResponsiveModal>
    </>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: 18,
    marginTop: Spacing.md,
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
    borderRadius: BorderRadius.pill ?? 999,
  },
  ctaText: {
    color: '#B45309',
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
  },
  // ── Modal ──
  modalContent: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  modalIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.warning + '22',
  },
  modalTitle: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
  },
  modalAmount: {
    color: Colors.warning,
    fontSize: FontSize.xxl ?? 30,
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  modalText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
    lineHeight: 20,
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
  conditions: {
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  progressBlock: {},
  progressHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  progressLabel: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSize.xs,
    fontFamily: Fonts.medium,
  },
  progressValue: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.inputBg,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
  closeBtn: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.warning,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
  },
});
