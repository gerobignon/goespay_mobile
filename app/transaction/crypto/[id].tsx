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
import { walletService } from '../../../src/services/walletService';
import { Card } from '../../../src/components/Card';
import { formatCurrency, formatDate, useFormatXof, useCurrencyCode } from '../../../src/utils/format';
import { shareReceipt } from '../../../src/utils/receipt';
import { downloadInvoice } from '../../../src/utils/invoice';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../../../src/constants/theme';
import type { ColorPalette } from '../../../src/constants/theme';
import { useThemedStyles } from '../../../src/hooks/useThemedStyles';
import { TransactionDetailRow } from '../../../src/components/TransactionDetailRow';
import TransactionHero from '../../../src/components/TransactionHero';
import ClaimNoteModal from '../../../src/components/ClaimNoteModal';
import ActionButtonRow from '../../../src/components/ActionButtonRow';
import { getTransactionStatus } from '../../../src/constants/config';
import { normalizeStatut, getStatusIcon } from '../../../src/utils/transactionStatus';
import { useTranslation } from 'react-i18next';
import { showAlert } from '../../../src/stores/alertStore';
import { CustomAlert } from '../../../src/components/CustomAlert';
import type { Transaction } from '../../../src/types';

export default function CryptoDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const fmtXof = useFormatXof();
  const currencyCode = useCurrencyCode();
  const styles = useThemedStyles(createStyles);
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);
  const [claimVisible, setClaimVisible] = useState(false);
  const [claimMessage, setClaimMessage] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await walletService.getCryptoTransaction(parseInt(id, 10));
        setTx(data);
      } catch (err: any) {
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
      await walletService.submitClaimCrypto({
        transaction_id: parseInt(id, 10),
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

  const norm = normalizeStatut(tx.statut, 'crypto');
  const statusInfo = getTransactionStatus(t)[norm] ?? { label: String(tx.statut), color: Colors.textMuted };
  const statusIcon = getStatusIcon(norm);
  const isBuy = tx.mode === 'Buy';
  const cryptoCode = tx.currency_src ?? '—';
  const xofAmount = tx.amount;
  const cryptoAmount = tx.dollar;

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/history')}>
            <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('transaction.cryptoDetail')}</Text>
        </View>

        {/* Action button */}
        <ActionButtonRow
          actions={[
            ...((tx.statut === 'success' || tx.statut === 1) ? [{
              key: 'invoice', icon: 'file-invoice-dollar', label: t('transaction.viewInvoice'),
              color: Colors.confirmAction, loading: invoiceLoading,
              onPress: async () => {
                setInvoiceLoading(true);
                try { await downloadInvoice('crypto', tx.id); } catch { showAlert('Erreur', 'Impossible de générer le reçu.'); }
                finally { setInvoiceLoading(false); }
              },
            }] : []),
            ...((tx.statut !== 'success' && tx.statut !== 1) ? [{
              key: 'claim', icon: 'triangle-exclamation', label: t('transaction.claim'),
              color: Colors.error, onPress: () => setClaimVisible(true),
            }] : []),
          ]}
        />

        <Card>
          <TransactionHero
            statut={tx.statut}
            type="crypto"
            amount={fmtXof(xofAmount, { withCode: false })}
            sign={isBuy ? '-' : '+'}
            amountColor={isBuy ? Colors.error : undefined}
            currencyCode={currencyCode}
          />

          <TransactionDetailRow label="Transaction ID" value={`#${tx.id}`} mono />
          <TransactionDetailRow label={t('transaction.type')} value={isBuy ? t('transaction.buyType') : t('transaction.sellType')} badge badgeColor={Colors.secondary} badgeIcon="bitcoin-sign" />
          <TransactionDetailRow label={t('transaction.status')} value={statusInfo.label} badge badgeColor={statusInfo.color} badgeIcon={statusIcon} />
          <TransactionDetailRow label={t('transaction.currency')} value={cryptoCode} badge badgeColor={Colors.secondary} />
          {cryptoAmount != null && (
            <TransactionDetailRow label={t('transaction.amount')} value={`${cryptoAmount} ${cryptoCode}`} mono />
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
          {tx.statut === 'success' && (
            <>
              <TransactionDetailRow label={t('transaction.balanceBefore')} value={tx.avant != null ? fmtXof(tx.avant) : '—'} mono />
              <TransactionDetailRow label={t('transaction.balanceAfter')} value={tx.apres != null ? fmtXof(tx.apres) : '—'} mono color={statusInfo.color} />
            </>
          )}
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
        warning={t('transaction.claimCryptoWarning')}
      />
      <CustomAlert />
    </ScreenBackground>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  scroll: { padding: Spacing.lg, paddingTop: Spacing.xxl },
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
