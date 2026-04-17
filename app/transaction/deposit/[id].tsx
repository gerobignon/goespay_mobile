import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenBackground } from '../../../src/components/ScreenBackground';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { showAlert } from '../../../src/stores/alertStore';
import { CustomAlert } from '../../../src/components/CustomAlert';
import { walletService } from '../../../src/services/walletService';
import { Card } from '../../../src/components/Card';
import { TransactionDetailRow } from '../../../src/components/TransactionDetailRow';
import { TRANSACTION_STATUS, getTransactionStatus } from '../../../src/constants/config';
import { formatCurrency, formatDate } from '../../../src/utils/format';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../../../src/constants/theme';
import type { ColorPalette } from '../../../src/constants/theme';
import { useThemedStyles } from '../../../src/hooks/useThemedStyles';
import type { Transaction } from '../../../src/types';

import { DepositModal } from '../../../src/components/DepositModal';

export default function DepositDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const styles = useThemedStyles(createStyles);
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);

  const [retryVisible, setRetryVisible] = useState(false);

  // Claim modal
  const [claimVisible, setClaimVisible] = useState(false);
  const [claimMessage, setClaimMessage] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);

  // Note modal
  const [noteVisible, setNoteVisible] = useState(false);
  const [noteMessage, setNoteMessage] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await walletService.getTransaction(parseInt(id, 10), 'deposit');
        setTx(data);
      } catch {
        // handle error
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const handleClaim = async () => {
    if (claimMessage.trim().length < 10) {
      showAlert('Erreur', 'Veuillez décrire votre problème (minimum 10 caractères).');
      return;
    }
    setClaimLoading(true);
    try {
      await walletService.submitClaim({
        transaction_id: parseInt(id, 10),
        type: 'deposit',
        message: claimMessage.trim(),
      });
      showAlert('Réclamation envoyée', 'Vous recevrez une réponse sous 24h.');
      setClaimVisible(false);
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
      await walletService.addNote({
        transaction_id: parseInt(id, 10),
        message: noteMessage.trim(),
      });
      showAlert('Succès', 'Note ajoutée.');
      setNoteVisible(false);
      setNoteMessage('');
      // Refresh transaction
      const data = await walletService.getTransaction(parseInt(id, 10), 'deposit');
      setTx(data);
    } catch (error: any) {
      showAlert('Erreur', error?.response?.data?.error || "Erreur lors de l'ajout.");
    } finally {
      setNoteLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={Colors.secondary} />
      </View>
    );
  }

  if (!tx) {
    return (
      <View style={styles.loader}>
        <Text style={{ color: Colors.textMuted }}>Transaction introuvable</Text>
      </View>
    );
  }

  const status = getTransactionStatus(t)[tx.statut] ?? { label: tx.statut, color: Colors.textMuted };

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/history')}>
            <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('transaction.depositDetail')}</Text>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {tx.statut === 'failed' && (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => setRetryVisible(true)}
              activeOpacity={0.7}
            >
              <FontAwesome6 name="rotate-right" size={12} color={Colors.white} />
              <Text style={styles.retryBtnText}>{t('common.retry', 'Réessayer')}</Text>
            </TouchableOpacity>
          )}
          {tx.statut === 'success' && tx.reference && (
            <TouchableOpacity
              style={styles.invoiceBtn}
              onPress={() => Linking.openURL(`https://paydunya.com/checkout/receipt/pdf/${tx.reference}.pdf`)}
              activeOpacity={0.7}
            >
              <FontAwesome6 name="file-invoice-dollar" size={12} color={Colors.white} />
              <Text style={styles.invoiceBtnText}>{t('transaction.viewInvoice')}</Text>
            </TouchableOpacity>
          )}
          {tx.statut !== 'success' && (
          <TouchableOpacity
            style={styles.claimBtn}
            onPress={() => setClaimVisible(true)}
            activeOpacity={0.7}
          >
            <FontAwesome6 name="triangle-exclamation" size={12} color={Colors.white} />
            <Text style={styles.claimBtnText}>{t('transaction.claim')}</Text>
          </TouchableOpacity>
          )}
          {!tx.note && (
            <TouchableOpacity
              style={styles.noteBtn}
              onPress={() => setNoteVisible(true)}
              activeOpacity={0.7}
            >
              <FontAwesome6 name="comment-dots" size={12} color={Colors.white} />
              <Text style={styles.noteBtnText}>{t('transaction.addNote')}</Text>
            </TouchableOpacity>
          )}
        </View>

        <Card>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: status.color + '22' }]}>
              <FontAwesome6
                name={tx.statut === 'success' ? 'circle-check' : tx.statut === 'wait' ? 'clock' : 'circle-xmark'}
                size={14}
                color={status.color}
                style={{ marginRight: 6 }}
              />
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
          </View>

          <Text style={styles.amount}>+{formatCurrency(tx.amount)}</Text>
          <Text style={styles.currency}>XOF</Text>

          <TransactionDetailRow label="Transaction ID" value={`#${tx.id}`} mono />
          <TransactionDetailRow label={t('transaction.type')} value={t('transaction.deposit')} badge badgeColor="#3ecf8e" badgeIcon="arrow-down" />
          <TransactionDetailRow
            label={t('transaction.status')}
            value={status.label}
            badge
            badgeColor={status.color}
            badgeIcon={tx.statut === 'success' ? 'circle-check' : tx.statut === 'wait' ? 'clock' : 'circle-xmark'}
          />
          <TransactionDetailRow label={t('transaction.operator')} value={tx.mode ?? '—'} badge badgeColor={Colors.secondary} />
          <TransactionDetailRow label={t('transaction.reference')} value={tx.reference ?? '—'} copyable mono />
          <TransactionDetailRow
            label={t('transaction.balanceBefore')}
            value={tx.avant != null ? `${formatCurrency(tx.avant)} XOF` : '—'}
            mono
          />
          <TransactionDetailRow
            label={t('transaction.balanceAfter')}
            value={tx.apres != null ? `${formatCurrency(tx.apres)} XOF` : '—'}
            mono
            color={status.color}
          />
          {tx.note && <TransactionDetailRow label={t('transaction.note')} value={tx.note} />}
          <TransactionDetailRow label={t('transaction.date')} value={formatDate(tx.created_at)} />
          {tx.updated_at && tx.updated_at !== tx.created_at && (
            <TransactionDetailRow label={t('transaction.date')} value={formatDate(tx.updated_at)} />
          )}
        </Card>
      </ScrollView>

      {/* Claim Modal */}
      <Modal visible={claimVisible} transparent animationType="slide">
        <CustomAlert />
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('transaction.addClaim')}</Text>
              <TouchableOpacity onPress={() => setClaimVisible(false)}>
                <FontAwesome6 name="xmark" size={18} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalHint}>
              Soyez aussi clair que possible. Réclamez uniquement en cas de débit injustifié.
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Décrivez votre problème..."
              placeholderTextColor={Colors.textMuted}
              value={claimMessage}
              onChangeText={setClaimMessage}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              selectionColor={Colors.secondary}
            />
            <TouchableOpacity
              style={[styles.modalSubmitBtn, claimLoading && { opacity: 0.6 }]}
              onPress={handleClaim}
              disabled={claimLoading}
              activeOpacity={0.7}
            >
              <FontAwesome6 name="paper-plane" size={14} color={Colors.white} />
              <Text style={styles.modalSubmitText}>
                {claimLoading ? t('common.sending') : t('common.send')}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Note Modal */}
      <Modal visible={noteVisible} transparent animationType="slide">
        <CustomAlert />
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('transaction.addNote')}</Text>
              <TouchableOpacity onPress={() => setNoteVisible(false)}>
                <FontAwesome6 name="xmark" size={18} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Votre note..."
              placeholderTextColor={Colors.textMuted}
              value={noteMessage}
              onChangeText={setNoteMessage}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              selectionColor={Colors.secondary}
            />
            <TouchableOpacity
              style={[styles.modalSubmitBtn, noteLoading && { opacity: 0.6 }]}
              onPress={handleNote}
              disabled={noteLoading}
              activeOpacity={0.7}
            >
              <FontAwesome6 name="comment-dots" size={14} color={Colors.white} />
              <Text style={styles.modalSubmitText}>
                {noteLoading ? t('common.sending') : t('common.add')}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <DepositModal
        visible={retryVisible}
        onClose={() => setRetryVisible(false)}
        prefill={{
          amount: tx ? String(tx.amount) : '',
          operator: tx?.mode ?? '',
          phone: tx?.phone ?? '',
        }}
      />
    </ScreenBackground>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  scroll: {
    padding: Spacing.lg,
    paddingTop: Spacing.xxl,
  },
  loader: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
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
    color: Colors.secondary,
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
    marginBottom: Spacing.lg,
  },
  claimBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.error,
    borderRadius: BorderRadius.pill,
  },
  claimBtnText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontFamily: Fonts.bold,
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.pill,
  },
  retryBtnText: {
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
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  modalHint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    lineHeight: 18,
    marginBottom: Spacing.md,
  },
  modalInput: {
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    padding: Spacing.md,
    minHeight: 120,
    marginBottom: Spacing.md,
  },
  modalSubmitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  modalSubmitText: {
    color: Colors.white,
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
  },
});
