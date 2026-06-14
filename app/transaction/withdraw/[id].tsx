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
import { OperatorLogo } from '../../../src/components/OperatorLogo';
import { resolveOperatorDisplay } from '../../../src/utils/operatorDisplay';
import TransactionHero from '../../../src/components/TransactionHero';
import ClaimNoteModal from '../../../src/components/ClaimNoteModal';
import ActionButtonRow from '../../../src/components/ActionButtonRow';
import { TRANSACTION_STATUS, getTransactionStatus } from '../../../src/constants/config';
import { formatCurrency, formatDate, useFormatXof, useCurrencyCode } from '../../../src/utils/format';
import { shareReceipt } from '../../../src/utils/receipt';
import { downloadInvoice } from '../../../src/utils/invoice';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../../../src/constants/theme';
import type { ColorPalette } from '../../../src/constants/theme';
import { useThemedStyles } from '../../../src/hooks/useThemedStyles';
import type { Transaction } from '../../../src/types';

export default function WithdrawDetailScreen() {
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
        const data = await walletService.getTransaction(parseInt(id, 10), 'withdraw');
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
        type: 'withdraw',
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

  const status = getTransactionStatus(t)[tx.statut] ?? { label: tx.statut, color: Colors.textMuted };

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/history')}>
            <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('transaction.withdrawDetail')}</Text>
        </View>

        {/* Action button */}
        <ActionButtonRow
          actions={[
            ...(tx.statut === 'success' ? [{
              key: 'invoice', icon: 'file-invoice-dollar', label: t('transaction.viewInvoice'),
              color: Colors.confirmAction, loading: invoiceLoading,
              onPress: async () => {
                setInvoiceLoading(true);
                try { await downloadInvoice('withdraw', tx.id); } catch { showAlert('Erreur', 'Impossible de générer le reçu.'); }
                finally { setInvoiceLoading(false); }
              },
            }] : []),
            ...(tx.statut !== 'success' ? [{
              key: 'claim', icon: 'triangle-exclamation', label: t('transaction.claim'),
              color: Colors.error, onPress: () => setClaimVisible(true),
            }] : []),
          ]}
        />

        <Card>
          {(() => {
            // Valeurs EXACTES (pas d'arrondi) dans le détail.
            const exact = (n: number) => Number(n).toLocaleString('fr-FR', { maximumFractionDigits: 2 });
            const exactXof = (n?: number | null) => (n == null ? '—' : `${exact(n)} XOF`);
            // Fincra = devise destinataire ≠ XOF, détecté via currency_dest OU le mode.
            const isFincraTx =
              (!!tx.currency_dest && tx.currency_dest !== 'XOF') ||
              !!(tx.mode && tx.mode.startsWith('fincra-'));
            // Frais en XOF : explicite (fee_xof). Fallback classique XOF→XOF uniquement.
            const feeXof =
              tx.fee_xof != null
                ? tx.fee_xof
                : (!isFincraTx && tx.amount_sent != null && tx.amount_sent !== tx.amount
                    ? tx.amount - tx.amount_sent
                    : null);
            const opView = resolveOperatorDisplay(tx.mode, tx.currency_dest);
            const meta = (tx as any).meta || {};
            return (
              <>
                <TransactionHero
                  statut={tx.statut}
                  /* Titre = XOF débité du wallet (JAMAIS le montant livré en NGN). */
                  amount={exact(tx.amount)}
                  sign="-"
                  amountColor={Colors.error}
                  currencyCode={currencyCode}
                />

                <TransactionDetailRow label="Transaction ID" value={`#${tx.id}`} mono />
                <TransactionDetailRow label={t('transaction.type')} value={t('transaction.withdraw')} badge badgeColor={Colors.error} badgeIcon="arrow-up" />
                <TransactionDetailRow
                  label={t('transaction.status')}
                  value={status.label}
                  badge
                  badgeColor={status.color}
                  badgeIcon={tx.statut === 'success' ? 'circle-check' : tx.statut === 'wait' ? 'clock' : 'circle-xmark'}
                />
                {isFincraTx && tx.currency_dest && tx.amount_sent != null && (
                  <TransactionDetailRow
                    label={t('transferModal.fincraReceives')}
                    value={`${exact(tx.amount_sent)} ${tx.currency_dest}`}
                    mono
                  />
                )}
                <TransactionDetailRow label={t('transaction.total')} value={exactXof(tx.amount)} mono />
                {feeXof != null && feeXof !== 0 && (
                  <TransactionDetailRow label={t('transaction.fees')} value={exactXof(feeXof)} mono color={Colors.error} />
                )}
                <TransactionDetailRow
                  label={t('transaction.operator')}
                  value={opView?.name ?? tx.mode ?? '—'}
                  valueNode={
                    opView ? (
                      <View style={styles.opValue}>
                        {opView.op ? <OperatorLogo op={opView.op} size={20} /> : null}
                        <Text style={styles.opName} numberOfLines={1}>
                          {opView.flag ? `${opView.flag} ` : ''}{opView.name}
                        </Text>
                      </View>
                    ) : undefined
                  }
                />
                {/* Virement bancaire : bénéficiaire (nom de compte) + banque. */}
                {meta.account_name ? (
                  <TransactionDetailRow label={t('transaction.accountName')} value={meta.account_name} mono />
                ) : null}
                {meta.bank ? (
                  <TransactionDetailRow label={t('transaction.bank')} value={meta.bank} mono />
                ) : null}
                <TransactionDetailRow
                  label={isFincraTx && tx.currency_dest ? t('transaction.accountNumber') : t('transaction.receiver')}
                  value={tx.phone ?? '—'}
                  copyable
                  mono
                />
                <TransactionDetailRow label={t('transaction.reference')} value={tx.reference ?? '—'} copyable mono />
                {tx.statut === 'success' && (
                  <>
                    <TransactionDetailRow label={t('transaction.balanceBefore')} value={exactXof(tx.avant)} mono />
                    <TransactionDetailRow label={t('transaction.balanceAfter')} value={exactXof(tx.apres)} mono color={status.color} />
                  </>
                )}
                <TransactionDetailRow label={t('transaction.date')} value={formatDate(tx.created_at)} />
                {tx.updated_at && tx.updated_at !== tx.created_at && (
                  <TransactionDetailRow label={t('transaction.updatedAt')} value={formatDate(tx.updated_at)} />
                )}
              </>
            );
          })()}
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
  opValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  opName: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
});
