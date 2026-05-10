import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { ResponsiveModal } from './ResponsiveModal';
import { Card } from './Card';
import { TransactionDetailRow } from './TransactionDetailRow';
import { CustomAlert } from './CustomAlert';
import { walletService } from '../services/walletService';
import { showAlert } from '../stores/alertStore';
import { TRANSACTION_STATUS, getTransactionStatus } from '../constants/config';
import { formatCurrency, formatDate, useFormatXof, useCurrencyCode } from '../utils/format';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { downloadInvoice } from '../utils/invoice';
import type { Transaction } from '../types';

const CRYPTO_STATUS_STATIC: Record<string | number, { color: string; icon: string }> = {
  1: { color: '#3176FE', icon: 'circle-check' },
  0: { color: '#ff295b', icon: 'circle-xmark' },
  success: { color: '#3176FE', icon: 'circle-check' },
  failed: { color: '#ff295b', icon: 'circle-xmark' },
  fail: { color: '#ff295b', icon: 'circle-xmark' },
};
const CRYPTO_DEFAULT_STATIC = { color: '#F4B228', icon: 'clock' };

function getCryptoStatus(statut: string | number, t: (key: string) => string): { label: string; color: string; icon: string } {
  const entry = CRYPTO_STATUS_STATIC[statut] ?? CRYPTO_DEFAULT_STATIC;
  const labelMap: Record<string | number, string> = {
    1: t('transaction.statusSuccess'), 0: t('transaction.statusFailed'),
    success: t('transaction.statusSuccess'), failed: t('transaction.statusFailed'), fail: t('transaction.statusFailed'),
  };
  return { ...entry, label: labelMap[statut] ?? t('transaction.statusWait') };
}

export type TxType = 'deposit' | 'withdraw' | 'transfer' | 'crypto';

interface Props {
  txId: number | null;
  txType: TxType | null;
  onClose: () => void;
}

export function TransactionDetailModal({ txId, txType, onClose }: Props) {
  const visible = txId !== null && txType !== null;
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const fmtXof = useFormatXof();
  const currencyCode = useCurrencyCode();

  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(false);

  // Claim form state (inline, no nested modal)
  const [showClaim, setShowClaim] = useState(false);
  const [claimMessage, setClaimMessage] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);

  // Note form state (deposit only)
  const [showNote, setShowNote] = useState(false);
  const [noteMessage, setNoteMessage] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  useEffect(() => {
    if (!visible) {
      setTx(null);
      setShowClaim(false);
      setShowNote(false);
      setClaimMessage('');
      setNoteMessage('');
      return;
    }
    setLoading(true);
    const load = async () => {
      try {
        const data =
          txType === 'crypto'
            ? await walletService.getCryptoTransaction(txId!)
            : await walletService.getTransaction(txId!, txType!);
        setTx(data);
      } catch {
        showAlert('Erreur', 'Impossible de charger la transaction.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [txId, txType]);

  const handleClaim = async () => {
    if (claimMessage.trim().length < 10) {
      showAlert('Erreur', 'Veuillez décrire votre problème (minimum 10 caractères).');
      return;
    }
    setClaimLoading(true);
    try {
      if (txType === 'crypto') {
        await walletService.submitClaimCrypto({ transaction_id: txId!, message: claimMessage.trim() });
      } else {
        await walletService.submitClaim({ transaction_id: txId!, type: txType!, message: claimMessage.trim() });
      }
      showAlert('Réclamation envoyée', 'Vous recevrez une réponse sous 24h.');
      setShowClaim(false);
      setClaimMessage('');
    } catch (error: any) {
      showAlert('Erreur', error?.response?.data?.error || "Erreur lors de l'envoi.");
    } finally {
      setClaimLoading(false);
    }
  };

  const handleNote = async () => {
    if (!noteMessage.trim()) {
      showAlert('Erreur', 'Veuillez entrer une note.');
      return;
    }
    setNoteLoading(true);
    try {
      await walletService.addNote({ transaction_id: txId!, message: noteMessage.trim() });
      showAlert('Succès', 'Note ajoutée.');
      setShowNote(false);
      setNoteMessage('');
      const data = await walletService.getTransaction(txId!, 'deposit');
      setTx(data);
    } catch (error: any) {
      showAlert('Erreur', error?.response?.data?.error || "Erreur lors de l'ajout.");
    } finally {
      setNoteLoading(false);
    }
  };

  const handleDownloadInvoice = async (type: 'deposit' | 'withdraw' | 'crypto', id: number) => {
    setInvoiceLoading(true);
    try {
      await downloadInvoice(type, id);
    } catch {
      showAlert('Erreur', 'Impossible de générer la facture.');
    } finally {
      setInvoiceLoading(false);
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Colors.secondary} />
        </View>
      );
    }
    if (!tx) return null;

    // ── Deposit ──────────────────────────────────────────────────────────────
    if (txType === 'deposit') {
      const status = getTransactionStatus(t)[tx.statut] ?? { label: tx.statut, color: Colors.textMuted };
      return (
        <>
          <View style={styles.actionRow}>
            {tx.statut === 'success' && (
              <TouchableOpacity
                style={[styles.invoiceBtn, invoiceLoading && { opacity: 0.6 }]}
                onPress={() => handleDownloadInvoice('deposit', tx.id)}
                disabled={invoiceLoading}
                activeOpacity={0.7}
              >
                <FontAwesome6 name="file-invoice-dollar" size={12} color={Colors.white} />
                <Text style={styles.invoiceBtnText}>{t('transaction.viewInvoice')}</Text>
              </TouchableOpacity>
            )}
            {tx.statut !== 'success' && (
              <TouchableOpacity style={styles.claimBtn} onPress={() => setShowClaim(!showClaim)} activeOpacity={0.7}>
                <FontAwesome6 name="triangle-exclamation" size={12} color={Colors.white} />
                <Text style={styles.claimBtnText}>{t('transaction.claim')}</Text>
              </TouchableOpacity>
            )}
            {!tx.note && (
              <TouchableOpacity style={styles.noteBtn} onPress={() => setShowNote(!showNote)} activeOpacity={0.7}>
                <FontAwesome6 name="comment-dots" size={12} color={Colors.white} />
                <Text style={styles.noteBtnText}>{t('transaction.addNote')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {showClaim && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={styles.inlineForm}>
                <Text style={styles.inlineFormTitle}>{t('transaction.addClaim')}</Text>
                <Text style={styles.inlineFormHint}>{t('transaction.claimHint')}</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder={t('transaction.describeProblem')}
                  placeholderTextColor={Colors.textMuted}
                  value={claimMessage}
                  onChangeText={setClaimMessage}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  selectionColor={Colors.secondary}
                />
                <View style={styles.formRow}>
                  <TouchableOpacity style={styles.formCancelBtn} onPress={() => setShowClaim(false)}>
                  <Text style={styles.formCancelText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.formSubmitBtn, claimLoading && { opacity: 0.6 }]}
                    onPress={handleClaim}
                    disabled={claimLoading}
                    activeOpacity={0.7}
                  >
                    <FontAwesome6 name="paper-plane" size={13} color={Colors.white} />
                    <Text style={styles.formSubmitText}>{claimLoading ? t('common.sending') : t('common.send')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          )}

          {showNote && (
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
              <View style={styles.inlineForm}>
                <Text style={styles.inlineFormTitle}>{t('transaction.addNote')}</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder={t('transaction.yourNote')}
                  placeholderTextColor={Colors.textMuted}
                  value={noteMessage}
                  onChangeText={setNoteMessage}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  selectionColor={Colors.secondary}
                />
                <View style={styles.formRow}>
                  <TouchableOpacity style={styles.formCancelBtn} onPress={() => setShowNote(false)}>
                  <Text style={styles.formCancelText}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.formSubmitBtn, noteLoading && { opacity: 0.6 }]}
                    onPress={handleNote}
                    disabled={noteLoading}
                    activeOpacity={0.7}
                  >
                    <FontAwesome6 name="comment-dots" size={13} color={Colors.white} />
                    <Text style={styles.formSubmitText}>{noteLoading ? t('common.sending') : t('common.add')}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </KeyboardAvoidingView>
          )}

          <Card>
            <View style={styles.statusRow}>
              <View style={[styles.statusBadge, { backgroundColor: status.color + '22' }]}>
                <FontAwesome6
                  name={tx.statut === 'success' ? 'circle-check' : tx.statut === 'wait' ? 'clock' : 'circle-xmark'}
                  size={14} color={status.color} style={{ marginRight: 6 }}
                />
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>
            <Text style={[styles.amount, { color: Colors.secondary }]}>+{fmtXof(tx.amount, { withCode: false })}</Text>
            <Text style={styles.currency}>{currencyCode}</Text>
            <TransactionDetailRow label="Transaction ID" value={`#${tx.id}`} mono />
            <TransactionDetailRow label={t('transaction.type')} value={t('transaction.deposit')} badge badgeColor="#3ecf8e" badgeIcon="arrow-down" />
            <TransactionDetailRow label={t('transaction.status')} value={status.label} badge badgeColor={status.color} badgeIcon={tx.statut === 'success' ? 'circle-check' : tx.statut === 'wait' ? 'clock' : 'circle-xmark'} />
            <TransactionDetailRow label={t('transaction.operator')} value={tx.mode ?? '—'} badge badgeColor={Colors.secondary} />
            <TransactionDetailRow label={t('transaction.reference')} value={tx.reference ?? '—'} copyable mono />
            <TransactionDetailRow label={t('transaction.balanceBefore')} value={tx.avant != null ? fmtXof(tx.avant) : '—'} mono />
            <TransactionDetailRow label={t('transaction.balanceAfter')} value={tx.apres != null ? fmtXof(tx.apres) : '—'} mono color={status.color} />
            {tx.note && <TransactionDetailRow label={t('transaction.note')} value={tx.note} />}
            <TransactionDetailRow label={t('transaction.date')} value={formatDate(tx.created_at)} />
            {tx.updated_at && tx.updated_at !== tx.created_at && (
              <TransactionDetailRow label={t('transaction.date')} value={formatDate(tx.updated_at)} />
            )}
          </Card>
        </>
      );
    }

    // ── Withdraw ─────────────────────────────────────────────────────────────
    if (txType === 'withdraw') {
      const status = getTransactionStatus(t)[tx.statut] ?? { label: tx.statut, color: Colors.textMuted };
      return (
        <>
          <View style={styles.actionRow}>
            {tx.statut === 'success' && (
              <TouchableOpacity
                style={[styles.invoiceBtn, invoiceLoading && { opacity: 0.6 }]}
                onPress={() => handleDownloadInvoice('withdraw', tx.id)}
                disabled={invoiceLoading}
                activeOpacity={0.7}
              >
                <FontAwesome6 name="file-invoice-dollar" size={12} color={Colors.white} />
                <Text style={styles.invoiceBtnText}>{t('transaction.viewInvoice')}</Text>
              </TouchableOpacity>
            )}
            {tx.statut !== 'success' && (
              <TouchableOpacity style={styles.claimBtn} onPress={() => setShowClaim(!showClaim)} activeOpacity={0.7}>
                <FontAwesome6 name="triangle-exclamation" size={12} color={Colors.white} />
                <Text style={styles.claimBtnText}>{t('transaction.claim')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {showClaim && (
            <View style={styles.inlineForm}>
              <Text style={styles.inlineFormTitle}>{t('transaction.addClaim')}</Text>
              <Text style={styles.inlineFormHint}>{t('transaction.claimHintShort')}</Text>
              <TextInput
                style={styles.formInput}
                placeholder={t('transaction.describeProblem')}
                placeholderTextColor={Colors.textMuted}
                value={claimMessage}
                onChangeText={setClaimMessage}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                selectionColor={Colors.secondary}
              />
              <View style={styles.formRow}>
                <TouchableOpacity style={styles.formCancelBtn} onPress={() => setShowClaim(false)}>
                  <Text style={styles.formCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.formSubmitBtn, claimLoading && { opacity: 0.6 }]} onPress={handleClaim} disabled={claimLoading} activeOpacity={0.7}>
                  <FontAwesome6 name="paper-plane" size={13} color={Colors.white} />
                  <Text style={styles.formSubmitText}>{claimLoading ? t('common.sending') : t('common.send')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Card>
            <View style={styles.statusRow}>
              <View style={[styles.statusBadge, { backgroundColor: status.color + '22' }]}>
                <FontAwesome6 name={tx.statut === 'success' ? 'circle-check' : tx.statut === 'wait' ? 'clock' : 'circle-xmark'} size={14} color={status.color} style={{ marginRight: 6 }} />
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>
            <Text style={[styles.amount, { color: Colors.error }]}>-{fmtXof(tx.amount_sent ?? tx.amount, { withCode: false })}</Text>
            <Text style={styles.currency}>{currencyCode}</Text>
            <TransactionDetailRow label="Transaction ID" value={`#${tx.id}`} mono />
            <TransactionDetailRow label={t('transaction.type')} value={t('transaction.withdraw')} badge badgeColor={Colors.error} badgeIcon="arrow-up" />
            <TransactionDetailRow label={t('transaction.status')} value={status.label} badge badgeColor={status.color} badgeIcon={tx.statut === 'success' ? 'circle-check' : tx.statut === 'wait' ? 'clock' : 'circle-xmark'} />
            <TransactionDetailRow label={t('transaction.total')} value={fmtXof(tx.amount)} mono />
            {tx.amount_sent != null && tx.amount_sent !== tx.amount && (
              <TransactionDetailRow label={t('transaction.fees')} value={fmtXof(tx.amount - tx.amount_sent)} mono color={Colors.error} />
            )}
            <TransactionDetailRow label={t('transaction.operator')} value={tx.mode ?? '—'} badge badgeColor={Colors.secondary} />
            <TransactionDetailRow label={t('transaction.receiver')} value={tx.phone ?? '—'} copyable mono />
            <TransactionDetailRow label={t('transaction.reference')} value={tx.reference ?? '—'} copyable mono />
            <TransactionDetailRow label={t('transaction.balanceBefore')} value={tx.avant != null ? fmtXof(tx.avant) : '—'} mono />
            <TransactionDetailRow label={t('transaction.balanceAfter')} value={tx.apres != null ? fmtXof(tx.apres) : '—'} mono color={status.color} />
            <TransactionDetailRow label={t('transaction.date')} value={formatDate(tx.created_at)} />
            {tx.updated_at && tx.updated_at !== tx.created_at && (
              <TransactionDetailRow label={t('transaction.date')} value={formatDate(tx.updated_at)} />
            )}
          </Card>
        </>
      );
    }

    // ── Transfer ─────────────────────────────────────────────────────────────
    if (txType === 'transfer') {
      const status = getTransactionStatus(t)[tx.statut] ?? { label: tx.statut, color: Colors.textMuted };
      return (
        <>
          <View style={styles.actionRow}>
            {tx.statut !== 'success' && (
              <TouchableOpacity style={styles.claimBtn} onPress={() => setShowClaim(!showClaim)} activeOpacity={0.7}>
                <FontAwesome6 name="triangle-exclamation" size={12} color={Colors.white} />
                <Text style={styles.claimBtnText}>{t('transaction.claim')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {showClaim && (
            <View style={styles.inlineForm}>
              <Text style={styles.inlineFormTitle}>{t('transaction.addClaim')}</Text>
              <Text style={styles.inlineFormHint}>{t('transaction.claimHintShort')}</Text>
              <TextInput
                style={styles.formInput}
                placeholder={t('transaction.describeProblem')}
                placeholderTextColor={Colors.textMuted}
                value={claimMessage}
                onChangeText={setClaimMessage}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                selectionColor={Colors.secondary}
              />
              <View style={styles.formRow}>
                <TouchableOpacity style={styles.formCancelBtn} onPress={() => setShowClaim(false)}>
                  <Text style={styles.formCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.formSubmitBtn, claimLoading && { opacity: 0.6 }]} onPress={handleClaim} disabled={claimLoading} activeOpacity={0.7}>
                  <FontAwesome6 name="paper-plane" size={13} color={Colors.white} />
                  <Text style={styles.formSubmitText}>{claimLoading ? t('common.sending') : t('common.send')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Card>
            <View style={styles.statusRow}>
              <View style={[styles.statusBadge, { backgroundColor: status.color + '22' }]}>
                <FontAwesome6 name={tx.statut === 'success' ? 'circle-check' : tx.statut === 'wait' ? 'clock' : 'circle-xmark'} size={14} color={status.color} style={{ marginRight: 6 }} />
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>
            <Text style={[styles.amount, { color: Colors.secondary }]}>-{fmtXof(tx.amount, { withCode: false })}</Text>
            <Text style={styles.currency}>{currencyCode}</Text>
            <TransactionDetailRow label="Transaction ID" value={`#${tx.id}`} mono />
            <TransactionDetailRow label={t('transaction.type')} value={t('transaction.transfer')} badge badgeColor={Colors.secondary} badgeIcon="right-left" />
            <TransactionDetailRow label={t('transaction.status')} value={status.label} badge badgeColor={status.color} badgeIcon={tx.statut === 'success' ? 'circle-check' : tx.statut === 'wait' ? 'clock' : 'circle-xmark'} />
            <TransactionDetailRow label={t('transaction.receiver')} value={tx.receiver_name ?? '—'} />
            <TransactionDetailRow label="Email" value={tx.receiver_email ?? '—'} copyable />
            <TransactionDetailRow label={t('transaction.reference')} value={tx.reference ?? '—'} copyable mono />
            <TransactionDetailRow label={t('transaction.balanceBefore')} value={tx.avant != null ? fmtXof(tx.avant) : '—'} mono />
            <TransactionDetailRow label={t('transaction.balanceAfter')} value={tx.apres != null ? fmtXof(tx.apres) : '—'} mono color={status.color} />
            <TransactionDetailRow label={t('transaction.date')} value={formatDate(tx.created_at)} />
            {tx.updated_at && tx.updated_at !== tx.created_at && (
              <TransactionDetailRow label={t('transaction.date')} value={formatDate(tx.updated_at)} />
            )}
          </Card>
        </>
      );
    }

    // ── Crypto ────────────────────────────────────────────────────────────────
    if (txType === 'crypto') {
      const status = getCryptoStatus(tx.statut, t);
      const isBuy = tx.mode === 'Buy';
      const cryptoCode = tx.currency_src ?? '—';
      return (
        <>
          <View style={styles.actionRow}>
            {(tx.statut === 'success' || tx.statut === 1) && (
              <TouchableOpacity
                style={[styles.invoiceBtn, invoiceLoading && { opacity: 0.6 }]}
                onPress={() => handleDownloadInvoice('crypto', tx.id)}
                disabled={invoiceLoading}
                activeOpacity={0.7}
              >
                <FontAwesome6 name="file-invoice-dollar" size={12} color={Colors.white} />
                <Text style={styles.invoiceBtnText}>{t('transaction.viewInvoice')}</Text>
              </TouchableOpacity>
            )}
            {tx.statut !== 'success' && tx.statut !== 1 && (
              <TouchableOpacity style={styles.claimBtn} onPress={() => setShowClaim(!showClaim)} activeOpacity={0.7}>
                <FontAwesome6 name="triangle-exclamation" size={12} color={Colors.white} />
                <Text style={styles.claimBtnText}>{t('transaction.claim')}</Text>
              </TouchableOpacity>
            )}
          </View>

          {showClaim && (
            <View style={styles.inlineForm}>
              <Text style={styles.inlineFormTitle}>{t('transaction.addClaim')}</Text>
              <Text style={[styles.inlineFormHint, { color: '#F4B228' }]}>⚠️ Vérifiez votre portefeuille et l'adresse avant toute réclamation.</Text>
              <TextInput
                style={styles.formInput}
                placeholder={t('transaction.describeProblem')}
                placeholderTextColor={Colors.textMuted}
                value={claimMessage}
                onChangeText={setClaimMessage}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                selectionColor={Colors.secondary}
              />
              <View style={styles.formRow}>
                <TouchableOpacity style={styles.formCancelBtn} onPress={() => setShowClaim(false)}>
                  <Text style={styles.formCancelText}>{t('common.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.formSubmitBtn, claimLoading && { opacity: 0.6 }]} onPress={handleClaim} disabled={claimLoading} activeOpacity={0.7}>
                  <FontAwesome6 name="paper-plane" size={13} color={Colors.white} />
                  <Text style={styles.formSubmitText}>{claimLoading ? t('common.sending') : t('common.send')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <Card>
            <View style={styles.statusRow}>
              <View style={[styles.statusBadge, { backgroundColor: status.color + '30' }]}>
                <FontAwesome6 name={status.icon as any} size={14} color={status.color} style={{ marginRight: 6 }} />
                <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              </View>
            </View>
            <Text style={[styles.amount, { color: Colors.error }]}>{isBuy ? '-' : '+'}{fmtXof(tx.amount, { withCode: false })}</Text>
            <Text style={styles.currency}>{currencyCode}</Text>
            <TransactionDetailRow label="Transaction ID" value={`#${tx.id}`} mono />
            <TransactionDetailRow label={t('transaction.type')} value={isBuy ? t('transaction.buyType') : t('transaction.sellType')} badge badgeColor={Colors.secondary} badgeIcon="bitcoin-sign" />
            <TransactionDetailRow label={t('transaction.status')} value={status.label} badge badgeColor={status.color} badgeIcon={status.icon} />
            <TransactionDetailRow label={t('transaction.currency')} value={cryptoCode} badge badgeColor={Colors.secondary} />
            {tx.dollar != null && (
              <TransactionDetailRow label={t('transaction.amount')} value={`${tx.dollar} ${cryptoCode}`} mono />
            )}
            <TransactionDetailRow label={t('transaction.address')} value={tx.address ?? '—'} copyable mono />
            {tx.tx_id && (
              <TransactionDetailRow
                label={tx.provider === 'nowpayments' ? t('transaction.npReference') : t('transaction.cpReference')}
                value={tx.tx_id}
                copyable
                mono
              />
            )}
            {tx.cp_id && tx.cp_id !== tx.tx_id && (
              <TransactionDetailRow
                label={tx.provider === 'nowpayments' ? t('transaction.npReference') : t('transaction.cpReference')}
                value={tx.cp_id}
                copyable
                mono
              />
            )}
            {tx.cp_hash && <TransactionDetailRow label={t('transaction.txHash')} value={tx.cp_hash} copyable mono />}
            <TransactionDetailRow label={t('transaction.balanceBefore')} value={tx.avant != null ? fmtXof(tx.avant) : '—'} mono />
            <TransactionDetailRow label={t('transaction.balanceAfter')} value={tx.apres != null ? fmtXof(tx.apres) : '—'} mono color={status.color} />
            <TransactionDetailRow label={t('transaction.date')} value={formatDate(tx.created_at)} />
            {tx.updated_at && tx.updated_at !== tx.created_at && (
              <TransactionDetailRow label={t('transaction.date')} value={formatDate(tx.updated_at)} />
            )}
          </Card>
        </>
      );
    }

    return null;
  };

  const titleMap: Record<TxType, string> = {
    deposit: t('transaction.depositDetail'),
    withdraw: t('transaction.withdrawDetail'),
    transfer: t('transaction.transferDetail'),
    crypto: t('transaction.cryptoDetail'),
  };

  return (
    <ResponsiveModal visible={visible} onClose={onClose}>
      <CustomAlert />
      <View style={styles.root}>
        {/* Modal header */}
        <View style={styles.header}>
          <Text style={styles.title}>{txType ? titleMap[txType] : ''}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <FontAwesome6 name="xmark" size={18} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {renderContent()}
          <View style={{ height: Spacing.xl }} />
        </ScrollView>
      </View>
    </ResponsiveModal>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: Spacing.lg,
  },
  loaderWrap: {
    paddingVertical: Spacing.xxl * 2,
    alignItems: 'center',
  },
  statusRow: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xs + 2,
    borderRadius: 50,
  },
  statusText: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.md,
  },
  amount: {
    fontSize: FontSize.hero,
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  currency: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    textAlign: 'center',
    letterSpacing: 2,
    marginBottom: Spacing.lg,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.pill,
  },
  claimBtnText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
  },
  invoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: '#198754',
    borderRadius: BorderRadius.pill,
  },
  invoiceBtnText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
  },
  noteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.pill,
  },
  noteBtnText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
  },
  inlineForm: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.sm,
  },
  inlineFormTitle: {
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  inlineFormHint: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  formInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    minHeight: 100,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  formRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    justifyContent: 'flex-end',
  },
  formCancelBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.inputBg,
  },
  formCancelText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
  },
  formSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.pill,
  },
  formSubmitText: {
    color: Colors.white,
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
  },
});
