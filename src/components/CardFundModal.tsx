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
  /** Dossier KYC à compléter (ex. BVN nigérian) : l'écran parent renvoie au KYC. */
  onIneligible?: (e: any) => void;
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
export function CardFundModal({ visible, card, direction, onClose, onDone, onIneligible }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const fmtXof = useFormatXof();
  const fetchBalance = useWalletStore((s) => s.fetchBalance);
  const walletBalance = useWalletStore((s) => s.balance);

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
        .catch((e) => {
          setQuote(null);
          if (e?.response?.data?.missing?.length && onIneligible) {
            onClose();
            onIneligible(e);
            return;
          }
          setError(getApiErrorMessage(e, t, t('cards.quoteError')));
        });
    }, 450);
    return () => {
      if (quoteTimer.current) clearTimeout(quoteTimer.current);
    };
  }, [amount, visible, card, direction, step, t]);

  const submit = async () => {
    // Deuxième appui avant le re-render : la garde d'état ne suffit pas.
    if (!card || !quote || busy) return;
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
      if (e?.response?.data?.missing?.length && onIneligible) {
        onClose();
        onIneligible(e);
        return;
      }
      setError(getApiErrorMessage(e, t, isFund ? t('cards.fundError') : t('cards.withdrawError')));
      setStep('failed');
      fetchBalance().catch(() => {});
    } finally {
      setBusy(false);
    }
  };

  const title = isFund ? t('cards.topUp') : t('cards.withdraw');

  /**
   * Solde disponible, dit de la même façon dans les deux sens : le wallet
   * finance la recharge, la carte finance le retour vers le wallet. Il passe au
   * rouge dès que l'opération le dépasse, et le bouton se ferme avec lui — le
   * serveur refusait déjà, mais après coup.
   */
  const typedUsd = parseFloat(amount.replace(',', '.')) || 0;
  const available = isFund ? walletBalance : (card?.balance ?? 0);
  const needed = isFund ? (quote?.total_xof ?? 0) : typedUsd;
  const exceeds = needed > available;
  const availableLabel = isFund
    ? fmtXof(walletBalance, { decimals: 2 })
    : `${(card?.balance ?? 0).toFixed(2)} ${card?.currency ?? 'USD'}`;

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
            <View style={styles.balanceRow}>
              <FontAwesome6
                name={isFund ? 'wallet' : 'credit-card'}
                size={12}
                color={exceeds ? Colors.error : Colors.textMuted}
                iconStyle="solid"
              />
              <Text style={[styles.balanceText, exceeds && styles.over]}>
                {t('cards.availableBalance')} :{' '}
              </Text>
              <Text style={[styles.balanceAmount, exceeds && styles.over]}>{availableLabel}</Text>
            </View>

            <Input
              label={t('cards.amountUsd')}
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="10"
            />

            {exceeds && <Text style={styles.error}>{t('cards.insufficientBalance')}</Text>}

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
              disabled={!quote || busy || exceeds}
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
  // Même rangée que sur l'envoi d'argent : icône, libellé, montant en gras.
  balanceRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
  balanceText: { fontSize: FontSize.sm, color: Colors.textMuted },
  balanceAmount: { fontSize: FontSize.sm, fontFamily: Fonts.bold, color: Colors.secondary },
  over: { color: Colors.error },
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
