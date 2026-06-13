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
import { formatCurrency, formatDate, useFormatXof, useCurrencyCode } from '../../../src/utils/format';
import { shareReceipt } from '../../../src/utils/receipt';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../../../src/constants/theme';
import type { ColorPalette } from '../../../src/constants/theme';
import { useThemedStyles } from '../../../src/hooks/useThemedStyles';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Transaction } from '../../../src/types';

export default function TransferDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useTranslation();
  const fmtXof = useFormatXof();
  const currencyCode = useCurrencyCode();
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);

  // Claim modal
  const [claimVisible, setClaimVisible] = useState(false);
  const [claimMessage, setClaimMessage] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [invoiceLoading, setInvoiceLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await walletService.getTransaction(parseInt(id, 10), 'transfer');
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
        type: 'transfer',
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
          <Text style={styles.title}>{t('transaction.transferDetail')}</Text>
        </View>

        {/* Action button */}
        <View style={styles.actionRow}>
          {tx.statut === 'success' && (
            <TouchableOpacity
              style={[styles.invoiceBtn, invoiceLoading && { opacity: 0.6 }]}
              onPress={async () => {
                setInvoiceLoading(true);
                try { await shareReceipt(tx, 'transfer'); } catch { showAlert('Erreur', 'Impossible de générer le reçu.'); }
                finally { setInvoiceLoading(false); }
              }}
              activeOpacity={0.7}
              disabled={invoiceLoading}
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

          <Text style={styles.amount}>-{fmtXof(tx.amount, { withCode: false })}</Text>
          <Text style={styles.currency}>{currencyCode}</Text>

          <TransactionDetailRow label="Transaction ID" value={`#${tx.id}`} mono />
          <TransactionDetailRow label={t('transaction.type')} value={t('transaction.transfer')} badge badgeColor={Colors.secondary} badgeIcon="right-left" />
          <TransactionDetailRow
            label={t('transaction.status')}
            value={status.label}
            badge
            badgeColor={status.color}
            badgeIcon={tx.statut === 'success' ? 'circle-check' : tx.statut === 'wait' ? 'clock' : 'circle-xmark'}
          />
          <TransactionDetailRow label={t('transaction.receiver')} value={tx.receiver_name ?? '—'} />
          <TransactionDetailRow label="Email" value={tx.receiver_email ?? '—'} copyable />
          <TransactionDetailRow label={t('transaction.reference')} value={tx.reference ?? '—'} copyable mono />
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
          <TransactionDetailRow label={t('transaction.date')} value={formatDate(tx.created_at)} />
          {tx.updated_at && tx.updated_at !== tx.created_at && (
            <TransactionDetailRow label={t('transaction.updatedAt')} value={formatDate(tx.updated_at)} />
          )}
        </Card>
      </ScrollView>

      {/* Claim Modal */}
      <Modal visible={claimVisible} transparent animationType="slide" statusBarTranslucent>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior="padding">
          <View style={[styles.modalContent, { paddingBottom: Spacing.lg + insets.bottom }]}>
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
    flex: 1,
    minWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.error,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  claimBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  invoiceBtn: {
    flex: 1,
    minWidth: 160,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.confirmAction,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  invoiceBtnText: {
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.sm,
    color: Colors.white,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.lg,
    borderTopRightRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.lg,
    maxHeight: '90%',
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
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    color: Colors.text,
    minHeight: 100,
    marginBottom: Spacing.md,
    fontFamily: Fonts.regular,
  },
  modalSubmitBtn: {
    backgroundColor: Colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  modalSubmitText: {
    fontFamily: Fonts.bold,
    fontSize: FontSize.md,
    color: Colors.white,
  },
});
