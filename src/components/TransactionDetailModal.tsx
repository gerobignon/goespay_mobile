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
import { OperatorLogo } from './OperatorLogo';
import { CustomAlert } from './CustomAlert';
import { walletService } from '../services/walletService';
import { showAlert } from '../stores/alertStore';
import { useCatalogStore } from '../stores/catalogStore';
import { TRANSACTION_STATUS, getTransactionStatus, OPERATORS } from '../constants/config';
import { formatCurrency, formatDate, useFormatXof, useCurrencyCode } from '../utils/format';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { downloadInvoice } from '../utils/invoice';
import { normalizeStatut, getStatusIcon } from '../utils/transactionStatus';
import type { Transaction } from '../types';

function getCryptoStatus(statut: string | number, t: (key: string) => string): { label: string; color: string; icon: string } {
  const norm = normalizeStatut(statut, 'crypto');
  const info = getTransactionStatus(t)[norm] ?? { label: String(statut), color: Colors.textMuted };
  return { label: info.label, color: info.color, icon: getStatusIcon(norm) };
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
  const catalogOps = useCatalogStore((s) => s.operators);

  // Résout le moyen (tx.mode) en { nom, drapeau, op } pour un affichage conforme
  // à la liste dépôt/retrait (logo + drapeau du pays). Fallback propre pour les
  // codes Fincra basés sur le rail (fincra-bank_transfer → « Virement bancaire »).
  const resolveOperatorView = (mode?: string | null) => {
    if (!mode) return null;
    const found =
      catalogOps.find((o) => o.id === mode) ||
      (OPERATORS as unknown as any[]).find((o) => o.id === mode);
    if (found) return { name: String(found.name), flag: String(found.flag || ''), op: found as any };
    const m = mode.match(/^fincra-(bank_transfer|bank|mobile_money|mm|checkout|card)$/i);
    if (m) {
      const r = m[1].toLowerCase();
      const rail = r === 'bank' ? 'bank_transfer' : r === 'card' ? 'checkout' : r === 'mm' ? 'mobile_money' : r;
      const name = rail === 'bank_transfer' ? t('transaction.railBank')
                 : rail === 'checkout'      ? t('transaction.railCard')
                 :                            t('transaction.railMobileMoney');
      return { name, flag: '', op: { fincra: true, rail } as any };
    }
    return { name: mode, flag: '', op: null as any };
  };

  // Hero résumé (statut + montant) — bloc teinté selon le statut, partagé par
  // les 4 types de transaction pour un rendu homogène.
  const Hero = ({ statusColor, statusIcon, statusLabel, sign, amount, amountColor }: {
    statusColor: string; statusIcon: string; statusLabel: string;
    sign: string; amount: string; amountColor: string;
  }) => (
    <View style={[styles.hero, { backgroundColor: statusColor + '12' }]}>
      <View style={[styles.statusBadge, { backgroundColor: statusColor + '26' }]}>
        <FontAwesome6 name={statusIcon as any} size={12} color={statusColor} style={{ marginRight: 6 }} />
        <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
      </View>
      <Text style={[styles.amount, { color: amountColor }]}>{sign}{amount}</Text>
      <Text style={styles.currency}>{currencyCode}</Text>
    </View>
  );

  const OperatorValue = ({ mode }: { mode?: string | null }) => {
    const info = resolveOperatorView(mode);
    if (!info) return <Text style={styles.opName}>—</Text>;
    return (
      <View style={styles.opValue}>
        {info.op ? <OperatorLogo op={info.op} size={20} /> : null}
        <Text style={styles.opName} numberOfLines={1}>
          {info.flag ? `${info.flag} ` : ''}{info.name}
        </Text>
      </View>
    );
  };

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

          <Card style={styles.flatCard}>
            <Hero
              statusColor={status.color}
              statusIcon={getStatusIcon(normalizeStatut(tx.statut))}
              statusLabel={status.label}
              sign="+"
              amount={fmtXof(tx.amount, { withCode: false })}
              amountColor={Colors.secondary}
            />
            <TransactionDetailRow label="Transaction ID" value={`#${tx.id}`} mono />
            <TransactionDetailRow label={t('transaction.type')} value={t('transaction.deposit')} badge badgeColor={Colors.positive} badgeIcon="arrow-down" />
            <TransactionDetailRow label={t('transaction.status')} value={status.label} badge badgeColor={status.color} badgeIcon={getStatusIcon(normalizeStatut(tx.statut))} />
            <TransactionDetailRow label={t('transaction.operator')} value={tx.mode ?? '—'} valueNode={<OperatorValue mode={tx.mode} />} />
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

          <Card style={styles.flatCard}>
            <Hero
              statusColor={status.color}
              statusIcon={getStatusIcon(normalizeStatut(tx.statut))}
              statusLabel={status.label}
              sign="-"
              amount={fmtXof(tx.amount_sent ?? tx.amount, { withCode: false })}
              amountColor={Colors.error}
            />
            <TransactionDetailRow label="Transaction ID" value={`#${tx.id}`} mono />
            <TransactionDetailRow label={t('transaction.type')} value={t('transaction.withdraw')} badge badgeColor={Colors.error} badgeIcon="arrow-up" />
            <TransactionDetailRow label={t('transaction.status')} value={status.label} badge badgeColor={status.color} badgeIcon={getStatusIcon(normalizeStatut(tx.statut))} />
            <TransactionDetailRow label={t('transaction.total')} value={fmtXof(tx.amount)} mono />
            {tx.amount_sent != null && tx.amount_sent !== tx.amount && (
              <TransactionDetailRow label={t('transaction.fees')} value={fmtXof(tx.amount - tx.amount_sent)} mono color={Colors.error} />
            )}
            <TransactionDetailRow label={t('transaction.operator')} value={tx.mode ?? '—'} valueNode={<OperatorValue mode={tx.mode} />} />
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

          <Card style={styles.flatCard}>
            <Hero
              statusColor={status.color}
              statusIcon={getStatusIcon(normalizeStatut(tx.statut))}
              statusLabel={status.label}
              sign="-"
              amount={fmtXof(tx.amount, { withCode: false })}
              amountColor={Colors.secondary}
            />
            <TransactionDetailRow label="Transaction ID" value={`#${tx.id}`} mono />
            <TransactionDetailRow label={t('transaction.type')} value={t('transaction.transfer')} badge badgeColor={Colors.secondary} badgeIcon="right-left" />
            <TransactionDetailRow label={t('transaction.status')} value={status.label} badge badgeColor={status.color} badgeIcon={getStatusIcon(normalizeStatut(tx.statut))} />
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

          <Card style={styles.flatCard}>
            <Hero
              statusColor={status.color}
              statusIcon={status.icon}
              statusLabel={status.label}
              sign={isBuy ? '-' : '+'}
              amount={fmtXof(tx.amount, { withCode: false })}
              amountColor={isBuy ? Colors.error : Colors.secondary}
            />
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
  flatCard: {
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  hero: {
    alignItems: 'center',
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.xs,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 1,
    borderRadius: 50,
    marginBottom: Spacing.xs,
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
  opValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
    justifyContent: 'flex-end',
  },
  opName: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    textAlign: 'right',
    flexShrink: 1,
  },
  currency: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    textAlign: 'center',
    letterSpacing: 2,
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
    backgroundColor: Colors.confirmAction,
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
