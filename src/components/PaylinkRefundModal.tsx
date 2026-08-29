import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts, withAlpha } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useFormatXof } from '../utils/format';

interface Props {
  visible: boolean;
  /** Numéro du payeur, destinataire du remboursement. */
  phone: string;
  /** Plafond renvoyable (XOF) : net encaissé moins ce qui a déjà été remboursé. */
  max: number;
  loading: boolean;
  onClose: () => void;
  onSubmit: (amount: number) => void;
}

/**
 * Confirmation d'un remboursement de paiement par lien.
 *
 * Le montant est pré-rempli au maximum renvoyable et reste modifiable : un
 * litige se règle souvent sur une partie de la somme. Le remboursement part
 * comme un envoi ordinaire, donc les frais d'envoi s'ajoutent au débit.
 */
export default function PaylinkRefundModal({ visible, phone, max, loading, onClose, onSubmit }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const fmtXof = useFormatXof();
  const [value, setValue] = useState(String(Math.round(max)));

  // Réarmer à chaque ouverture : le plafond baisse après un remboursement partiel.
  useEffect(() => {
    if (visible) setValue(String(Math.round(max)));
  }, [visible, max]);

  const amount = parseFloat(value.replace(',', '.'));
  const invalid = !Number.isFinite(amount) || amount <= 0 || amount > max;

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.content, { paddingBottom: Spacing.lg + insets.bottom }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('transaction.refund')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <FontAwesome6 name="xmark" size={18} color={Colors.text} />
            </TouchableOpacity>
          </View>

          <View style={styles.target}>
            <FontAwesome6 name="mobile-screen-button" size={14} color={Colors.textMuted} />
            <Text style={styles.targetText}>{phone}</Text>
          </View>

          <Text style={styles.label}>{t('transaction.refundAmount')}</Text>
          <TextInput
            style={styles.input}
            value={value}
            onChangeText={setValue}
            keyboardType="numeric"
            inputMode="numeric"
            selectionColor={Colors.secondary}
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.hint}>{t('transaction.refundMax', { amount: fmtXof(max) })}</Text>

          <TouchableOpacity
            style={[styles.submitBtn, (loading || invalid) && { opacity: 0.5 }]}
            onPress={() => onSubmit(amount)}
            disabled={loading || invalid}
            activeOpacity={0.7}
          >
            <FontAwesome6 name="rotate-left" size={14} color={Colors.white} />
            <Text style={styles.submitText}>
              {loading ? t('common.sending') : t('transaction.refundConfirm')}
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    content: {
      backgroundColor: Colors.background,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      padding: Spacing.lg,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: Spacing.md,
    },
    title: {
      fontSize: FontSize.lg,
      fontFamily: Fonts.bold,
      color: Colors.text,
    },
    target: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      backgroundColor: withAlpha(Colors.textMuted, 0.08),
      borderRadius: BorderRadius.md,
      paddingVertical: Spacing.sm,
      paddingHorizontal: Spacing.md,
      marginBottom: Spacing.md,
    },
    targetText: {
      color: Colors.text,
      fontSize: FontSize.md,
      fontFamily: Fonts.semiBold,
    },
    label: {
      color: Colors.textSecondary,
      fontSize: FontSize.sm,
      fontFamily: Fonts.medium,
      marginBottom: Spacing.xs,
    },
    input: {
      backgroundColor: Colors.inputBg,
      borderRadius: BorderRadius.md,
      borderWidth: 1,
      borderColor: Colors.border,
      color: Colors.text,
      fontSize: FontSize.lg,
      fontFamily: Fonts.bold,
      padding: Spacing.md,
    },
    hint: {
      color: Colors.textMuted,
      fontSize: FontSize.sm,
      marginTop: Spacing.xs,
      marginBottom: Spacing.md,
    },
    submitBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
      backgroundColor: Colors.primary,
      paddingVertical: Spacing.md,
      borderRadius: BorderRadius.md,
    },
    submitText: {
      color: Colors.white,
      fontSize: FontSize.md,
      fontFamily: Fonts.bold,
    },
  });
