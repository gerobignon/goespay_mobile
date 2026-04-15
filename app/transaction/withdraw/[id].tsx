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
import { showAlert } from '../../../src/stores/alertStore';
import { CustomAlert } from '../../../src/components/CustomAlert';
import { walletService } from '../../../src/services/walletService';
import { Card } from '../../../src/components/Card';
import { TransactionDetailRow } from '../../../src/components/TransactionDetailRow';
import { TRANSACTION_STATUS } from '../../../src/constants/config';
import { formatCurrency, formatDate } from '../../../src/utils/format';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../../../src/constants/theme';
import type { Transaction } from '../../../src/types';

export default function WithdrawDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [loading, setLoading] = useState(true);

  const [claimVisible, setClaimVisible] = useState(false);
  const [claimMessage, setClaimMessage] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);

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

  const status = TRANSACTION_STATUS[tx.statut] ?? { label: tx.statut, color: Colors.textMuted };

  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/history')}>
            <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Détail du retrait</Text>
        </View>

        {/* Action button */}
        <View style={styles.actionRow}>
          {tx.statut !== 'success' && (
          <TouchableOpacity
            style={styles.claimBtn}
            onPress={() => setClaimVisible(true)}
            activeOpacity={0.7}
          >
            <FontAwesome6 name="triangle-exclamation" size={12} color={Colors.white} />
            <Text style={styles.claimBtnText}>Réclamation</Text>
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

          <Text style={styles.amount}>-{formatCurrency(tx.amount_sent ?? tx.amount)}</Text>
          <Text style={styles.currency}>XOF</Text>

          <TransactionDetailRow label="Transaction ID" value={`#${tx.id}`} mono />
          <TransactionDetailRow label="Type" value="Retrait" badge badgeColor={Colors.error} badgeIcon="arrow-up" />
          <TransactionDetailRow
            label="Statut"
            value={status.label}
            badge
            badgeColor={status.color}
            badgeIcon={tx.statut === 'success' ? 'circle-check' : tx.statut === 'wait' ? 'clock' : 'circle-xmark'}
          />
          <TransactionDetailRow label="Montant total" value={`${formatCurrency(tx.amount)} XOF`} mono />
          {tx.amount_sent != null && tx.amount_sent !== tx.amount && (
            <TransactionDetailRow label="Frais" value={`${formatCurrency(tx.amount - tx.amount_sent)} XOF`} mono color={Colors.error} />
          )}
          <TransactionDetailRow label="Mode" value={tx.mode ?? '—'} badge badgeColor={Colors.secondary} />
          <TransactionDetailRow label="Destinataire" value={tx.phone ?? '—'} copyable mono />
          <TransactionDetailRow label="Référence" value={tx.reference ?? '—'} copyable mono />
          <TransactionDetailRow
            label="Solde avant"
            value={tx.avant != null ? `${formatCurrency(tx.avant)} XOF` : '—'}
            mono
          />
          <TransactionDetailRow
            label="Solde après"
            value={tx.apres != null ? `${formatCurrency(tx.apres)} XOF` : '—'}
            mono
            color={status.color}
          />
          <TransactionDetailRow label="Date du retrait" value={formatDate(tx.created_at)} />
          {tx.updated_at && tx.updated_at !== tx.created_at && (
            <TransactionDetailRow label="Date de validation" value={formatDate(tx.updated_at)} />
          )}
        </Card>
      </ScrollView>

      {/* Claim Modal */}
      <Modal visible={claimVisible} transparent animationType="slide">
        <CustomAlert />
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Faire une réclamation</Text>
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
                {claimLoading ? 'Envoi...' : 'Envoyer'}
              </Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
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
    color: Colors.error,
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
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.pill,
  },
  claimBtnText: {
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
