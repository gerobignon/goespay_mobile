import React from 'react';
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

interface Props {
  visible: boolean;
  /** 'claim' shows the warning hint + send action; 'note' is a plain note. */
  mode: 'claim' | 'note';
  value: string;
  onChangeText: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
  /** Optional caution box shown above the hint (e.g. crypto address warning). */
  warning?: string;
}

/**
 * Bottom-sheet form for filing a claim or adding a note on a transaction.
 * Replaces the duplicated claim/note Modal in every transaction detail screen.
 */
export default function ClaimNoteModal({ visible, mode, value, onChangeText, onClose, onSubmit, loading, warning }: Props) {
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const isClaim = mode === 'claim';

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.content, { paddingBottom: Spacing.lg + insets.bottom }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{isClaim ? t('transaction.addClaim') : t('transaction.addNote')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={8}>
              <FontAwesome6 name="xmark" size={18} color={Colors.text} />
            </TouchableOpacity>
          </View>

          {warning ? <Text style={styles.warning}>{warning}</Text> : null}

          {isClaim && <Text style={styles.hint}>{t('transaction.claimHint')}</Text>}

          <TextInput
            style={styles.input}
            placeholder={isClaim ? t('transaction.describeProblem') : t('transaction.yourNote')}
            placeholderTextColor={Colors.textMuted}
            value={value}
            onChangeText={onChangeText}
            multiline
            numberOfLines={isClaim ? 5 : 4}
            textAlignVertical="top"
            selectionColor={Colors.secondary}
          />

          <TouchableOpacity
            style={[styles.submitBtn, loading && { opacity: 0.6 }]}
            onPress={onSubmit}
            disabled={loading}
            activeOpacity={0.7}
          >
            <FontAwesome6 name={isClaim ? 'paper-plane' : 'comment-dots'} size={14} color={Colors.white} />
            <Text style={styles.submitText}>
              {loading ? t('common.sending') : isClaim ? t('common.send') : t('common.add')}
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
    warning: {
      fontSize: FontSize.sm,
      fontFamily: Fonts.semiBold,
      color: Colors.pending,
      backgroundColor: withAlpha(Colors.pending, 0.07),
      padding: Spacing.sm,
      borderRadius: BorderRadius.sm,
      marginBottom: Spacing.sm,
    },
    hint: {
      color: Colors.textMuted,
      fontSize: FontSize.xs,
      lineHeight: 18,
      marginBottom: Spacing.md,
    },
    input: {
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
