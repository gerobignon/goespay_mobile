import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ResponsiveModal } from './ResponsiveModal';
import { Button } from './Button';
import type { VirtualCard } from '../services/cardService';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts, BorderRadius } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

interface Props {
  visible: boolean;
  card: VirtualCard | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * Fermeture définitive d'une carte.
 *
 * Le geste est irréversible et coûte le prix d'une nouvelle carte : il ne peut
 * pas se jouer sur une alerte à deux boutons, où « Résilier » se tape aussi vite
 * que « Annuler » — des clients l'ont fait sans savoir ce que le mot désignait.
 * D'où la fenêtre dédiée : ce que la fermeture entraîne, énoncé avant, une case
 * à cocher qui débloque le bouton, et le verrou de l'appareil derrière (posé par
 * l'appelant, comme pour l'affichage du numéro).
 */
export function CardTerminateModal({ visible, card, busy = false, onClose, onConfirm }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const [understood, setUnderstood] = useState(false);

  // La case ne survit pas à une fermeture : la fenêtre suivante repart de zéro.
  useEffect(() => {
    if (!visible) setUnderstood(false);
  }, [visible]);

  const hasBalance = !!card && card.balance > 0;

  const consequences = [
    { icon: 'ban', text: t('cards.terminateConsequencePayments') },
    { icon: 'rotate-left', text: t('cards.terminateConsequenceFinal') },
  ];

  return (
    <ResponsiveModal visible={visible} onClose={onClose} disableBackdropClose={busy}>
      <View style={styles.container}>
        <View style={styles.head}>
          <Text style={styles.title}>{t('cards.terminateTitle')}</Text>
          {!busy && (
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {!!card && (
          <Text style={styles.cardLine}>
            {card.brand} •••• {card.last4}
          </Text>
        )}

        <View style={styles.list}>
          {consequences.map((row) => (
            <View key={row.icon} style={styles.row}>
              <FontAwesome6 name={row.icon} size={13} color={Colors.error} iconStyle="solid" />
              <Text style={styles.rowText}>{row.text}</Text>
            </View>
          ))}
          {hasBalance && (
            <View style={styles.row}>
              <FontAwesome6 name="arrow-right-arrow-left" size={13} color={Colors.textMuted} iconStyle="solid" />
              <Text style={styles.rowText}>
                {t('cards.terminateBalanceBack', { amount: `${card!.balance.toFixed(2)} ${card!.currency}` })}
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={styles.check}
          onPress={() => setUnderstood((v) => !v)}
          activeOpacity={0.7}
          disabled={busy}
        >
          <View style={[styles.box, understood && styles.boxOn]}>
            {understood && <FontAwesome6 name="check" size={11} color={Colors.white} iconStyle="solid" />}
          </View>
          <Text style={styles.checkText}>{t('cards.terminateAcknowledge')}</Text>
        </TouchableOpacity>

        <View style={styles.buttons}>
          <Button
            title={t('common.cancel')}
            onPress={onClose}
            variant="outline"
            disabled={busy}
            style={styles.flexBtn}
          />
          <Button
            title={t('cards.terminateConfirm')}
            onPress={onConfirm}
            disabled={!understood || busy}
            loading={busy}
            style={[styles.flexBtn, styles.dangerBtn]}
          />
        </View>
      </View>
    </ResponsiveModal>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.text },
  cardLine: { fontSize: FontSize.sm, color: Colors.textMuted, fontFamily: Fonts.medium },
  list: {
    backgroundColor: Colors.error + '10',
    borderWidth: 1,
    borderColor: Colors.error + '33',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  rowText: { flex: 1, fontSize: FontSize.sm, color: Colors.text, lineHeight: 20 },
  check: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: Spacing.xs },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: Colors.error, borderColor: Colors.error },
  checkText: { flex: 1, fontSize: FontSize.sm, color: Colors.text },
  buttons: { flexDirection: 'row', gap: Spacing.md },
  flexBtn: { flex: 1 },
  dangerBtn: { backgroundColor: Colors.error },
});
