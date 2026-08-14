import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ResponsiveModal } from './ResponsiveModal';
import { Input } from './Input';
import { Button } from './Button';
import { CardBrandLogo } from './CardBrandLogo';
import { cardService, type CardQuote, type CardPricing, type VirtualCard } from '../services/cardService';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts, BorderRadius } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useFormatXof } from '../utils/format';
import { getApiErrorMessage } from '../utils/apiError';

/** Repli si le serveur ne renvoie pas le minimum (vieille version d'API). */
const FALLBACK_MIN_USD = 2;

/** Montants de la carte : toujours deux décimales, la devise collée au montant. */
const fmtUsd = (amount: number) => `${amount.toFixed(2)} USD`;

export type CardBrand = 'VISA' | 'MASTERCARD';

interface Props {
  visible: boolean;
  pricing?: CardPricing | null;
  onClose: () => void;
  onOrdered: (card: VirtualCard) => void;
  /** Erreur d'éligibilité (KYC à compléter) : traitée par l'écran appelant. */
  onIneligible: (error: any) => void;
}

/**
 * Commande d'une carte : réseau, puis préfinancement.
 *
 * Les deux décisions sont réunies ici plutôt que posées sur l'écran, parce
 * qu'elles n'engagent que le moment de la commande — un sélecteur de réseau
 * affiché en permanence sous une carte existante laisse croire qu'on peut
 * changer le réseau de CELLE-CI, ce qui est impossible : il est gravé à
 * l'émission.
 *
 * Le préfinancement n'est pas optionnel : l'émetteur refuse toute création en
 * dessous de son minimum, et une carte demandée à zéro revenait en échec.
 */
export function CardOrderModal({ visible, pricing, onClose, onOrdered, onIneligible }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const fmtXof = useFormatXof();

  const minUsd = pricing?.min_issue ?? FALLBACK_MIN_USD;

  const [brand, setBrand] = useState<CardBrand>('VISA');
  const [amount, setAmount] = useState(String(minUsd));
  const [quote, setQuote] = useState<CardQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!visible) {
      setBrand('VISA');
      setAmount(String(minUsd));
      setQuote(null);
      setError(null);
      setOrdering(false);
    }
  }, [visible, minUsd]);

  const value = parseFloat(amount.replace(',', '.'));
  const belowMin = !value || value < minUsd;

  // Devis rafraîchi à la frappe : le client voit en francs ce qui sera débité.
  useEffect(() => {
    if (!visible || belowMin) {
      setQuote(null);
      return;
    }
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    setQuoting(true);
    quoteTimer.current = setTimeout(() => {
      cardService.issueQuote(value)
        .then((q) => { setQuote(q); setError(null); })
        .catch((e) => { setQuote(null); setError(getApiErrorMessage(e, t, t('cards.quoteError'))); })
        .finally(() => setQuoting(false));
    }, 450);
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current);
    };
  }, [visible, value, belowMin, t]);

  const submit = async () => {
    if (belowMin) return;
    setOrdering(true);
    setError(null);
    try {
      const card = await cardService.issue({ brand, initial_amount_usd: value });
      onOrdered(card);
      onClose();
    } catch (e: any) {
      // Dossier KYC à compléter : l'écran sait où renvoyer le client.
      if (e?.response?.data?.missing?.length) {
        onClose();
        onIneligible(e);
        return;
      }
      setError(getApiErrorMessage(e, t, t('cards.issueError')));
    } finally {
      setOrdering(false);
    }
  };

  return (
    <ResponsiveModal visible={visible} onClose={onClose} disableBackdropClose={ordering}>
      <View style={styles.container}>
        <View style={styles.head}>
          <Text style={styles.title}>{t('cards.orderTitle')}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={10} disabled={ordering}>
            <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
          </TouchableOpacity>
        </View>

        <View>
          <Text style={styles.label}>{t('cards.network')}</Text>
          <View style={styles.brandRow}>
            {(['VISA', 'MASTERCARD'] as const).map((b) => (
              <TouchableOpacity
                key={b}
                style={[styles.brandChoice, brand === b && styles.brandChoiceOn]}
                onPress={() => setBrand(b)}
                disabled={ordering}
                activeOpacity={0.8}
              >
                <View style={styles.brandLogo}>
                  <CardBrandLogo brand={b} height={18} />
                </View>
                <FontAwesome6
                  name={brand === b ? 'circle-dot' : 'circle'}
                  size={14}
                  color={brand === b ? Colors.primary : Colors.textMuted}
                />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <Input
          label={t('cards.initialAmount', { min: minUsd })}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          editable={!ordering}
        />

        {quoting && !quote ? (
          <ActivityIndicator size="small" color={Colors.primary} />
        ) : quote ? (
          /* Le détail reste ENTIÈREMENT en USD — c'est la devise de la carte et
             celle des tarifs. Mélanger les deux devises dans la même liste
             donnait un total dont aucune ligne affichée ne rendait compte : le
             montant chargé apparaissait en dollars, les frais en francs, et la
             somme en francs. Une seule conversion, en bas, avec son taux. */
          <View style={styles.quote}>
            <View style={styles.quoteRow}>
              <Text style={styles.quoteLabel}>{t('cards.loadedOnCard')}</Text>
              <Text style={styles.quoteValue}>{fmtUsd(quote.amount_usd)}</Text>
            </View>
            {/* Frais détaillés : le client doit distinguer ce qu'il paie pour
                avoir la carte de ce qu'il paie pour la charger. */}
            {!!quote.issue_fee_usd && quote.issue_fee_usd > 0 && (
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>{t('cards.issueFee')}</Text>
                <Text style={styles.quoteValue}>{fmtUsd(quote.issue_fee_usd)}</Text>
              </View>
            )}
            {!!quote.fee_usd && quote.fee_usd > 0 && (
              <View style={styles.quoteRow}>
                <Text style={styles.quoteLabel}>{t('cards.topUpFee')}</Text>
                <Text style={styles.quoteValue}>{fmtUsd(quote.fee_usd)}</Text>
              </View>
            )}
            <View style={[styles.quoteRow, styles.totalRow]}>
              <Text style={styles.quoteLabel}>{t('cards.debited')}</Text>
              <Text style={styles.quoteTotal}>{fmtXof(quote.total_xof)}</Text>
            </View>
            <Text style={styles.rateNote}>1 USD = {fmtXof(quote.rate)}</Text>
          </View>
        ) : null}

        {!!error && <Text style={styles.error}>{error}</Text>}

        {/* Règle des paiements refusés : elle se lit AVANT de commander, pas
            après le premier refus facturé. */}
        <View style={styles.warn}>
          <FontAwesome6 name="triangle-exclamation" size={13} color={Colors.warning} iconStyle="solid" />
          <Text style={styles.warnText}>{t('cards.declineWarning')}</Text>
        </View>

        <Button
          title={t('cards.order')}
          onPress={submit}
          loading={ordering}
          disabled={ordering || belowMin || !quote}
          icon="credit-card"
        />
      </View>
    </ResponsiveModal>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.text },
  label: { fontSize: FontSize.sm, color: Colors.textMuted, marginBottom: 6 },
  brandRow: { flexDirection: 'row', gap: Spacing.sm },
  brandChoice: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
  },
  brandChoiceOn: { borderColor: Colors.primary, backgroundColor: Colors.primary + '14' },
  // Le logotype Visa est blanc : sans fond sombre il disparaît en thème clair.
  brandLogo: {
    backgroundColor: '#0b1f5c',
    borderRadius: BorderRadius.sm,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  quote: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 6,
  },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quoteLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  quoteValue: { fontSize: FontSize.sm, color: Colors.text, fontFamily: Fonts.medium },
  // Le trait sépare le détail en dollars du seul montant en francs : c'est là
  // que la conversion a lieu, et elle doit se voir.
  totalRow: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm, marginTop: 2 },
  quoteTotal: { fontSize: FontSize.md, color: Colors.text, fontFamily: Fonts.bold },
  rateNote: { fontSize: FontSize.xs, color: Colors.textMuted, textAlign: 'right' },
  error: { fontSize: FontSize.sm, color: Colors.error },
  warn: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: Colors.warning + '1a',
    borderWidth: 1,
    borderColor: Colors.warning + '55',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  warnText: { flex: 1, fontSize: FontSize.sm, lineHeight: 19, color: Colors.text, fontFamily: Fonts.regular },
});
