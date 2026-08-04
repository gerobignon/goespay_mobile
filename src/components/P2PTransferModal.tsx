import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Input } from './Input';
import { Button } from './Button';
import { ResponsiveModal } from './ResponsiveModal';
import { KycBanner } from './KycBanner';
import { BlockedBanner } from './BlockedBanner';
import { AdminDisabledBanner } from './AdminDisabledBanner';
import { useConfigStore } from '../stores/configStore';
import { walletService, type P2PRecipient } from '../services/walletService';
import { useWalletStore } from '../stores/walletStore';
import { useAuthStore } from '../stores/authStore';
import { useFormatXof } from '../utils/format';
import { getApiErrorMessage } from '../utils/apiError';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts, withAlpha } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

interface P2PTransferModalProps {
  visible: boolean;
  onClose: () => void;
}

/** Drapeau emoji depuis un code pays ISO-2. '' si invalide. */
const isoToFlag = (cc: string): string => {
  const c = (cc || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
};

const initialsOf = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase() || '?';

/**
 * Transfert compte à compte : identifiant du destinataire → montant → confirmation.
 * Interne au wallet (instantané, sans frais). Le serveur refuse les destinataires
 * hors zone monétaire de l'émetteur — l'app affiche simplement son message.
 */
export function P2PTransferModal({ visible, onClose }: P2PTransferModalProps) {
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const fmtXof = useFormatXof();

  const user = useAuthStore((s) => s.user);
  const balance = useWalletStore((s) => s.balance);
  const fetchBalance = useWalletStore((s) => s.fetchBalance);

  const [step, setStep] = useState<'identify' | 'amount' | 'confirm' | 'done'>('identify');
  const [identifier, setIdentifier] = useState('');
  const [recipient, setRecipient] = useState<P2PRecipient | null>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ amount: number; balance_after: number; reference: string } | null>(null);

  const kycOk = user?.validate === 1;
  const isAdmin = user?.group === 'admin';
  // Le transfert compte à compte suit les conditions d'accès de l'envoi.
  const p2pEnabled = useConfigStore((s) => s.p2p_enabled);
  const p2pBlocked = useConfigStore((s) => s.p2p_blocked);
  const p2pBlockMessage = useConfigStore((s) => s.p2p_block_message);
  const numericAmount = Number(amount.replace(/[^0-9.]/g, '')) || 0;

  useEffect(() => {
    if (!visible) return;
    setStep('identify');
    setIdentifier('');
    setRecipient(null);
    setAmount('');
    setError(null);
    setResult(null);
  }, [visible]);

  const handleClose = () => {
    if (loading) return;
    onClose();
  };

  const lookup = async () => {
    if (!identifier.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const found = await walletService.lookupP2PRecipient(identifier.trim());
      setRecipient(found);
      setStep('amount');
    } catch (e: any) {
      setError(getApiErrorMessage(e, t, t('p2p.lookupFailed')));
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    if (!recipient) return;
    setLoading(true);
    setError(null);
    try {
      const res = await walletService.sendP2P({ recipient_id: recipient.id, amount: numericAmount });
      setResult({ amount: res.amount, balance_after: res.balance_after, reference: res.reference });
      setStep('done');
      fetchBalance().catch(() => {});
    } catch (e: any) {
      setError(getApiErrorMessage(e, t, t('p2p.sendFailed')));
      setStep('amount');
    } finally {
      setLoading(false);
    }
  };

  const recipientCard = recipient && (
    <View style={styles.recipientCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{initialsOf(recipient.name)}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.recipientName} numberOfLines={1}>{recipient.name}</Text>
        <Text style={styles.recipientMeta}>
          {isoToFlag(recipient.country)} {recipient.country} · {recipient.currency}
        </Text>
      </View>
      {step !== 'done' && (
        <TouchableOpacity onPress={() => { setStep('identify'); setRecipient(null); setError(null); }} hitSlop={8}>
          <FontAwesome6 name="pen" size={14} color={Colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <ResponsiveModal visible={visible} onClose={handleClose} disableBackdropClose={loading}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        enabled={Platform.OS !== 'web'}
      >
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('p2p.title')}</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={8}>
              <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: Spacing.lg }} showsVerticalScrollIndicator={false}>
            {!kycOk && <KycBanner status={(user?.validate as 0 | 2) ?? 0} />}
            {/* Mêmes barrages que l'envoi : blocage ciblé du client, puis
                coupure globale (l'admin passe outre mais voit l'état). */}
            {!isAdmin && p2pBlocked && (
              <BlockedBanner message={p2pBlockMessage} fallback={t('blocked.transferDefault')} />
            )}
            {isAdmin && !p2pEnabled && (
              <AdminDisabledBanner message={t('admin.bannerTransfer')} />
            )}

            {!!error && (
              <View style={styles.errorBox}>
                <FontAwesome6 name="circle-exclamation" size={14} color={Colors.error} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            {step === 'identify' && (
              <>
                <Input
                  label={t('p2p.identifierLabel')}
                  placeholder={t('p2p.identifierPlaceholder')}
                  value={identifier}
                  onChangeText={setIdentifier}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onSubmitEditing={lookup}
                  returnKeyType="search"
                />
                <Button
                  title={t('common.next')}
                  onPress={lookup}
                  loading={loading}
                  disabled={!identifier.trim() || !kycOk}
                />
              </>
            )}

            {(step === 'amount' || step === 'confirm') && (
              <>
                {recipientCard}

                {step === 'amount' ? (
                  <>
                    <Input
                      label={t('p2p.amountLabel')}
                      placeholder="0"
                      value={amount}
                      onChangeText={setAmount}
                      keyboardType="numeric"
                    />
                    <Text style={styles.balanceHint}>
                      {t('p2p.available')} : {fmtXof(balance)}
                    </Text>
                    <Button
                      title={t('common.next')}
                      onPress={() => { setError(null); setStep('confirm'); }}
                      disabled={numericAmount <= 0 || numericAmount > balance || !kycOk}
                    />
                  </>
                ) : (
                  <>
                    <View style={styles.summary}>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>{t('p2p.amountLabel')}</Text>
                        <Text style={styles.summaryValue}>{fmtXof(numericAmount)}</Text>
                      </View>
                      <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>{t('p2p.fees')}</Text>
                        <Text style={styles.summaryValue}>{fmtXof(0)}</Text>
                      </View>
                      <View style={[styles.summaryRow, styles.summaryTotal]}>
                        <Text style={styles.summaryTotalLabel}>{t('p2p.debited')}</Text>
                        <Text style={styles.summaryTotalValue}>{fmtXof(numericAmount)}</Text>
                      </View>
                    </View>
                    <Button title={t('p2p.confirm')} onPress={send} loading={loading} icon="paper-plane" />
                    <Button
                      title={t('common.back')}
                      variant="outline"
                      onPress={() => setStep('amount')}
                      style={{ marginTop: Spacing.sm }}
                    />
                  </>
                )}
              </>
            )}

            {step === 'done' && result && (
              <View style={styles.doneBox}>
                <FontAwesome6 name="circle-check" size={64} color={Colors.success} />
                <Text style={styles.doneTitle}>{t('p2p.doneTitle')}</Text>
                <Text style={styles.doneAmount}>{fmtXof(result.amount)}</Text>
                {recipientCard}
                <View style={styles.summary}>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>{t('p2p.newBalance')}</Text>
                    <Text style={styles.summaryValue}>{fmtXof(result.balance_after)}</Text>
                  </View>
                  <View style={styles.summaryRow}>
                    <Text style={styles.summaryLabel}>{t('p2p.reference')}</Text>
                    <Text style={styles.summaryValue} numberOfLines={1}>{result.reference}</Text>
                  </View>
                </View>
                <Button title={t('common.close')} onPress={handleClose} style={{ marginTop: Spacing.md, alignSelf: 'stretch' }} />
              </View>
            )}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </ResponsiveModal>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    sheet: {
      flex: 1,
      backgroundColor: Colors.background,
      paddingHorizontal: Spacing.lg,
      paddingTop: Spacing.lg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.lg,
    },
    title: {
      fontSize: FontSize.lg,
      fontFamily: Fonts.bold,
      color: Colors.text,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: withAlpha(Colors.error, 0.1),
      borderRadius: BorderRadius.md,
      padding: Spacing.md,
      marginBottom: Spacing.md,
    },
    errorText: {
      flex: 1,
      color: Colors.error,
      fontSize: FontSize.sm,
      fontFamily: Fonts.semiBold,
    },
    recipientCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      backgroundColor: Colors.card,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.lg,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: withAlpha(Colors.primary, 0.15),
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      color: Colors.primary,
      fontFamily: Fonts.bold,
      fontSize: FontSize.md,
    },
    recipientName: {
      color: Colors.text,
      fontFamily: Fonts.bold,
      fontSize: FontSize.md,
    },
    recipientMeta: {
      color: Colors.textMuted,
      fontFamily: Fonts.regular,
      fontSize: FontSize.sm,
      marginTop: 2,
    },
    balanceHint: {
      color: Colors.textMuted,
      fontSize: FontSize.sm,
      fontFamily: Fonts.semiBold,
      marginBottom: Spacing.md,
    },
    summary: {
      backgroundColor: Colors.card,
      borderRadius: BorderRadius.lg,
      padding: Spacing.md,
      marginBottom: Spacing.lg,
      alignSelf: 'stretch',
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.xs,
    },
    summaryLabel: {
      color: Colors.textMuted,
      fontSize: FontSize.sm,
      fontFamily: Fonts.semiBold,
    },
    summaryValue: {
      color: Colors.text,
      fontSize: FontSize.sm,
      fontFamily: Fonts.bold,
      flexShrink: 1,
      textAlign: 'right',
    },
    summaryTotal: {
      borderTopWidth: 1,
      borderTopColor: Colors.border,
      marginTop: Spacing.xs,
      paddingTop: Spacing.sm,
    },
    summaryTotalLabel: {
      color: Colors.text,
      fontSize: FontSize.md,
      fontFamily: Fonts.bold,
    },
    summaryTotalValue: {
      color: Colors.primary,
      fontSize: FontSize.md,
      fontFamily: Fonts.bold,
    },
    doneBox: {
      alignItems: 'center',
      paddingTop: Spacing.lg,
    },
    doneTitle: {
      color: Colors.success,
      fontSize: FontSize.lg,
      fontFamily: Fonts.bold,
      marginTop: Spacing.md,
    },
    doneAmount: {
      color: Colors.text,
      fontSize: FontSize.xxl,
      fontFamily: Fonts.bold,
      marginVertical: Spacing.md,
    },
  });
