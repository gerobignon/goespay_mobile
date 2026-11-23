import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { ScreenBackground } from '../../components/ScreenBackground';
import { Card } from '../../components/Card';
import { TransactionDetailRow } from '../../components/TransactionDetailRow';
import TransactionHero from '../../components/TransactionHero';
import ClaimNoteModal from '../../components/ClaimNoteModal';
import ActionButtonRow from '../../components/ActionButtonRow';
import { formatDate, useFormatXof, useCurrencyCode } from '../../utils/format';
import { downloadInvoice } from '../../utils/invoice';
import { getStatusIcon } from '../../utils/transactionStatus';
import { getTransactionStatus } from '../../constants/config';
import { Colors, Spacing, FontSize, Fonts } from '../../constants/theme';
import type { ColorPalette } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { showAlert } from '../../stores/alertStore';
import type { Transaction } from '../../types';
import { cryptoService } from '../service';
import { CRYPTO_TYPE, normalizeCryptoStatus } from '../kind';

/**
 * Detail of a crypto buy or sell.
 *
 * Full screen on mobile (route `/transaction/crypto/<id>`), body only inside
 * the desktop detail modal (`embedded`).
 */
export default function TransactionView({ id, embedded = false }: { id: number; embedded?: boolean }) {
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
    let cancelled = false;
    setLoading(true);
    cryptoService
      .getTransaction(id)
      .then((data) => { if (!cancelled) setTx(data); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  const handleClaim = async () => {
    if (claimMessage.trim().length < 10) {
      showAlert('Erreur', 'Veuillez décrire votre problème (minimum 10 caractères).');
      return;
    }
    setClaimLoading(true);
    try {
      await cryptoService.submitClaim({ transaction_id: id, message: claimMessage.trim() });
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
      <View style={embedded ? styles.loaderEmbedded : styles.loader}>
        <ActivityIndicator size="large" color={Colors.secondary} />
      </View>
    );
  }

  if (!tx) {
    return (
      <View style={embedded ? styles.loaderEmbedded : styles.loader}>
        <Text style={{ color: Colors.textMuted }}>Transaction introuvable</Text>
      </View>
    );
  }

  const norm = normalizeCryptoStatus(tx.statut);
  const statusInfo = getTransactionStatus(t)[norm] ?? { label: String(tx.statut), color: Colors.textMuted };
  const statusIcon = getStatusIcon(norm);
  const isBuy = tx.mode === 'Buy';
  const cryptoCode = tx.currency_src ?? '-';
  const providerReference = tx.provider === 'nowpayments' ? t('transaction.npReference') : t('transaction.cpReference');

  const body = (
    <>
      <ActionButtonRow
        actions={[
          ...(norm === 'success' ? [{
            key: 'invoice', icon: 'file-invoice-dollar', label: t('transaction.viewInvoice'),
            color: Colors.confirmAction, loading: invoiceLoading,
            onPress: async () => {
              setInvoiceLoading(true);
              try { await downloadInvoice(CRYPTO_TYPE, tx.id); } catch { showAlert('Erreur', 'Impossible de générer le reçu.'); }
              finally { setInvoiceLoading(false); }
            },
          }] : []),
          ...(norm !== 'success' ? [{
            key: 'claim', icon: 'triangle-exclamation', label: t('transaction.claim'),
            color: Colors.error, onPress: () => setClaimVisible(true),
          }] : []),
        ]}
      />

      <Card>
        <TransactionHero
          statut={tx.statut}
          type={CRYPTO_TYPE}
          amount={fmtXof(tx.amount, { withCode: false })}
          sign={isBuy ? '-' : '+'}
          amountColor={isBuy ? Colors.error : undefined}
          currencyCode={currencyCode}
        />

        <TransactionDetailRow label="Transaction ID" value={`#${tx.id}`} mono />
        <TransactionDetailRow label={t('transaction.type')} value={isBuy ? t('transaction.buyType') : t('transaction.sellType')} badge badgeColor={Colors.secondary} badgeIcon="bitcoin-sign" />
        <TransactionDetailRow label={t('transaction.status')} value={statusInfo.label} badge badgeColor={statusInfo.color} badgeIcon={statusIcon} />
        <TransactionDetailRow label={t('transaction.currency')} value={cryptoCode} badge badgeColor={Colors.secondary} />
        {tx.dollar != null && (
          <TransactionDetailRow label={t('transaction.amount')} value={`${tx.dollar} ${cryptoCode}`} mono />
        )}
        <TransactionDetailRow label={t('transaction.address')} value={tx.address ?? '-'} copyable mono />
        {tx.tx_id && (
          <TransactionDetailRow label={providerReference} value={tx.tx_id} copyable mono />
        )}
        {tx.cp_id && tx.cp_id !== tx.tx_id && (
          <TransactionDetailRow label={providerReference} value={tx.cp_id} copyable mono />
        )}
        {tx.cp_hash && <TransactionDetailRow label={t('transaction.txHash')} value={tx.cp_hash} copyable mono />}
        {norm === 'success' && (
          <>
            <TransactionDetailRow label={t('transaction.balanceBefore')} value={tx.avant != null ? fmtXof(tx.avant) : '-'} mono />
            <TransactionDetailRow label={t('transaction.balanceAfter')} value={tx.apres != null ? fmtXof(tx.apres) : '-'} mono color={statusInfo.color} />
          </>
        )}
        <TransactionDetailRow label={t('transaction.date')} value={formatDate(tx.created_at)} />
        {tx.updated_at && tx.updated_at !== tx.created_at && (
          <TransactionDetailRow label={t('transaction.updatedAt')} value={formatDate(tx.updated_at)} />
        )}
      </Card>

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
    </>
  );

  if (embedded) return body;

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/history')}>
            <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('transaction.cryptoDetail')}</Text>
        </View>
        {body}
      </ScrollView>
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
  loaderEmbedded: {
    paddingVertical: Spacing.xxl * 2,
    alignItems: 'center',
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
