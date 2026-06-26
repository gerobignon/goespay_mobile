import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
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
import TransactionHero from '../../../src/components/TransactionHero';
import ClaimNoteModal from '../../../src/components/ClaimNoteModal';
import ActionButtonRow from '../../../src/components/ActionButtonRow';
import { TRANSACTION_STATUS, getTransactionStatus } from '../../../src/constants/config';
import { formatCurrency, formatDate, useFormatXof, useCurrencyCode } from '../../../src/utils/format';
import { shareReceipt } from '../../../src/utils/receipt';
import { downloadInvoice } from '../../../src/utils/invoice';
import { resolveOperatorDisplay } from '../../../src/utils/operatorDisplay';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../../../src/constants/theme';
import type { ColorPalette } from '../../../src/constants/theme';
import { useThemedStyles } from '../../../src/hooks/useThemedStyles';
import type { Transaction } from '../../../src/types';

import { DepositModal } from '../../../src/components/DepositModal';

export default function DepositDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const fmtXof = useFormatXof();
  const currencyCode = useCurrencyCode();
  const styles = useThemedStyles(createStyles);
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);

  const [retryVisible, setRetryVisible] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

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
        <ActionButtonRow
          actions={[
            ...(tx.statut === 'failed' ? [{
              key: 'retry', icon: 'rotate-right', label: t('common.retry', 'Réessayer'),
              color: Colors.primary, onPress: () => setRetryVisible(true),
            }] : []),
            ...(tx.statut === 'success' ? [{
              key: 'invoice', icon: 'file-invoice-dollar', label: t('transaction.viewInvoice'),
              color: Colors.confirmAction, loading: invoiceLoading,
              onPress: async () => {
                setInvoiceLoading(true);
                try { await downloadInvoice('deposit', tx.id); } catch { showAlert('Erreur', 'Impossible de générer le reçu.'); }
                finally { setInvoiceLoading(false); }
              },
            }] : []),
            ...(tx.statut !== 'success' ? [{
              key: 'claim', icon: 'triangle-exclamation', label: t('transaction.claim'),
              color: Colors.error, onPress: () => setClaimVisible(true),
            }] : []),
            ...(!tx.note ? [{
              key: 'note', icon: 'comment-dots', label: t('transaction.addNote'),
              color: Colors.primary, onPress: () => setNoteVisible(true),
            }] : []),
          ]}
        />

        <Card>
          <TransactionHero
            statut={tx.statut}
            amount={fmtXof(tx.amount, { withCode: false })}
            sign="+"
            currencyCode={currencyCode}
          />

          <TransactionDetailRow label="Transaction ID" value={`#${tx.id}`} mono />
          <TransactionDetailRow label={t('transaction.type')} value={t('transaction.deposit')} badge badgeColor={Colors.positive} badgeIcon="arrow-down" />
          <TransactionDetailRow
            label={t('transaction.status')}
            value={status.label}
            badge
            badgeColor={status.color}
            badgeIcon={tx.statut === 'success' ? 'circle-check' : tx.statut === 'wait' ? 'clock' : 'circle-xmark'}
          />
          <TransactionDetailRow label={t('transaction.operator')} value={resolveOperatorDisplay(tx.mode, tx.currency_dest)?.name ?? tx.mode ?? '—'} badge badgeColor={Colors.secondary} />
          <TransactionDetailRow label={t('transaction.reference')} value={tx.reference ?? '—'} copyable mono />
          {!!tx.real && (
            <TransactionDetailRow label={t('transaction.providerRef')} value={String(tx.real)} copyable mono />
          )}
          {tx.statut === 'success' && (
            <>
              <TransactionDetailRow
                label={t('transaction.balanceBefore')}
                value={tx.avant != null ? fmtXof(tx.avant) : '—'}
                mono
              />
              <TransactionDetailRow
                label={t('transaction.balanceAfter')}
                value={tx.apres != null ? fmtXof(tx.apres) : '—'}
                mono
                color={status.color}
              />
            </>
          )}
          {tx.note && <TransactionDetailRow label={t('transaction.note')} value={tx.note} />}
          <TransactionDetailRow label={t('transaction.date')} value={formatDate(tx.created_at)} />
          {tx.updated_at && tx.updated_at !== tx.created_at && (
            <TransactionDetailRow label={t('transaction.updatedAt')} value={formatDate(tx.updated_at)} />
          )}
        </Card>
      </ScrollView>

      <ClaimNoteModal
        visible={claimVisible}
        mode="claim"
        value={claimMessage}
        onChangeText={setClaimMessage}
        onClose={() => setClaimVisible(false)}
        onSubmit={handleClaim}
        loading={claimLoading}
      />

      <ClaimNoteModal
        visible={noteVisible}
        mode="note"
        value={noteMessage}
        onChangeText={setNoteMessage}
        onClose={() => setNoteVisible(false)}
        onSubmit={handleNote}
        loading={noteLoading}
      />

      <DepositModal
        visible={retryVisible}
        onClose={() => setRetryVisible(false)}
        prefill={{
          amount: tx ? String(tx.amount) : '',
          operator: tx?.mode ?? '',
          phone: tx?.phone ?? '',
        }}
      />
      <CustomAlert />
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
});
