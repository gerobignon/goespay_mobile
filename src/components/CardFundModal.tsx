import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ResponsiveModal } from './ResponsiveModal';
import { Input } from './Input';
import { Button } from './Button';
import { cardService, type CardQuote, type VirtualCard } from '../services/cardService';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts, BorderRadius } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useFormatXof } from '../utils/format';
import { useWalletStore } from '../stores/walletStore';
import { getApiErrorMessage } from '../utils/apiError';

type Direction = 'fund' | 'withdraw';
type Step = 'form' | 'confirm' | 'sending' | 'success' | 'failed' | 'unknown';

interface Props {
  visible: boolean;
  card: VirtualCard | null;
  direction: Direction;
  onClose: () => void;
  onDone: (card?: VirtualCard) => void;
}

/**
 * Recharge d'une carte depuis le wallet, et opération inverse.
 *
 * Le client raisonne en dollars — c'est la devise de la carte et celle du minimum
 * imposé par l'émetteur. Le total en francs est calculé par le serveur et affiché
 * avant confirmation, pour que le montant débité soit exactement celui annoncé.
 *
 * L'état `unknown` traduit un délai d'attente dépassé : l'opération a peut-être
 * abouti. On ne présente jamais ce cas comme un échec — le rapprochement serveur
 * tranchera, et le solde du wallet est rétabli si la recharge n'a pas eu lieu.
 */
export function CardFundModal({ visible, card, direction, onClose, onDone }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const fmtXof = useFormatXof();
  const fetchBalance = useWalletStore((s) => s.fetchBalance);

  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<Step>('form');
  const [quote, setQuote] = useState<CardQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isFund = direction === 'fund';

  useEffect(() => {
    if (!visible) {
      setAmount('');
      setStep('form');
      setQuote(null);
      setError(null);
      setBusy(false);
    }
  }, [visible]);

  // Devis rafraîchi à la frappe, avec une pause pour ne pas appeler à chaque touche.
  useEffect(() => {
    if (!visible || !card || step !== 'form') return;
    const value = parseFloat(amount.replace(',', '.'));
    if (!value || value <= 0) {
      setQuote(null);
      return;
    }
    if (quoteTimer.current) clearTimeout(quoteTimer.current);
    quoteTimer.current = setTimeout(() => {
      cardService.quote(card.id, value, direction)
        .then((q) => { setQuote(q); setError(null); })
        .catch((e) => { setQuote(null); setError(getApiErrorMessage(e, t, t('cards.quoteError'))); });
    }, 450);
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current);
    };
  }, [amount, visible, card, direction, step, t]);

  const submit = async () => {
    if (!card || !quote) return;
    setBusy(true);
    setStep('sending');
    setError(null);

    try {
      const res = isFund
        ? await cardService.fund(card.id, quote.amount_usd)
        : await cardService.withdraw(card.id, quote.amount_usd);

      // Le serveur répond « wait » quand l'issue lui est inconnue.
      if (res.status === 'wait') {
        setStep('unknown');
      } else {
        setStep('success');
        onDone(res.card);
      }
      fetchBalance().catch(() => {});
    } catch (e: any) {
      setError(getApiErrorMessage(e, t, isFund ? t('cards.fundError') : t('cards.withdrawError')));
      setStep('failed');
      fetchBalance().catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const title = isFund ? t('cards.topUp') : t('cards.withdraw');

  return (
    <ResponsiveModal visible={visible} onClose={onClose} disableBackdropClose={step === 'sending'}>
      <View style={styles.container}>
        <View style={styles.head}>
          <Text style={styles.title}>{title}</Text>
          {step !== 'sending' && (
            <TouchableOpacity onPress={onClose} hitSlop={10}>
              <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>

        {step === 'form' && (
          <>
            <Input
              label={t('cards.amountUsd')}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="10"
            />

            {!isFund && !!card && (
              <Text style={styles.hint}>{t('cards.available', { amount: `${card.balance} USD` })}</Text>
            )}

            {!!quote && (
              <View style={styles.quote}>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>{t('cards.rate')}</Text>
                  <Text style={styles.quoteValue}>1 USD = {fmtXof(quote.rate)}</Text>
                </View>
                <View style={styles.quoteRow}>
                  <Text style={styles.quoteLabel}>{isFund ? t('cards.amountXof') : t('cards.received')}</Text>
                  <Text style={styles.quoteValue}>{fmtXof(quote.amount_xof)}</Text>
                </View>
                {quote.fee_xof > 0 && (
                  <View style={styles.quoteRow}>
                    <Text style={styles.quoteLabel}>{t('cards.fees')}</Text>
                    <Text style={styles.quoteValue}>{fmtXof(quote.fee_xof)}</Text>
                  </View>
                )}
                <View style={[styles.quoteRow, styles.quoteTotal]}>
                  <Text style={styles.totalLabel}>{isFund ? t('cards.totalDebited') : t('cards.totalCredited')}</Text>
                  <Text style={styles.totalValue}>{fmtXof(quote.total_xof)}</Text>
                </View>
              </View>
            )}

            {!!error && <Text style={styles.error}>{error}</Text>}

            <Button
              title={title}
              onPress={submit}
              disabled={!quote || busy}
              loading={busy}
              icon={isFund ? 'arrow-up' : 'arrow-down'}
            />
          </>
        )}

        {step === 'sending' && (
          <View style={styles.state}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.stateText}>{t('cards.processing')}</Text>
          </View>
        )}

        {step === 'success' && (
          <View style={styles.state}>
            <FontAwesome6 name="circle-check" size={64} color={Colors.success} />
            <Text style={styles.stateText}>{isFund ? t('cards.fundDone') : t('cards.withdrawDone')}</Text>
            <Button title={t('common.close')} onPress={onClose} />
          </View>
        )}

        {step === 'unknown' && (
          <View style={styles.state}>
            <FontAwesome6 name="clock" size={64} color={Colors.pending} />
            <Text style={styles.stateText}>{t('cards.pendingConfirm')}</Text>
            <Button title={t('common.close')} onPress={onClose} />
          </View>
        )}

        {step === 'failed' && (
          <View style={styles.state}>
            <FontAwesome6 name="circle-xmark" size={64} color={Colors.error} />
            <Text style={styles.stateText}>{error ?? t('common.error')}</Text>
            <Button title={t('common.retry')} onPress={() => setStep('form')} variant="outline" />
          </View>
        )}
      </View>
    </ResponsiveModal>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: { padding: Spacing.lg, gap: Spacing.md },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: FontSize.lg, fontFamily: Fonts.bold, color: Colors.text },
  hint: { fontSize: FontSize.sm, color: Colors.textMuted },
  quote: {
    backgroundColor: Colors.card,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  quoteRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  quoteLabel: { fontSize: FontSize.sm, color: Colors.textMuted },
  quoteValue: { fontSize: FontSize.sm, color: Colors.text, fontFamily: Fonts.medium },
  quoteTotal: { borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: Spacing.sm },
  totalLabel: { fontSize: FontSize.md, color: Colors.text, fontFamily: Fonts.semiBold },
  totalValue: { fontSize: FontSize.md, color: Colors.primary, fontFamily: Fonts.bold },
  state: { alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.xl },
  stateText: { fontSize: FontSize.md, color: Colors.text, textAlign: 'center' },
  error: { fontSize: FontSize.sm, color: Colors.error },
});
