import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BorderRadius, FontSize, Fonts, Spacing, withAlpha, type ColorPalette } from '../../constants/theme';
import { useThemedStyles } from '../../hooks/useThemedStyles';
import { useKeyboardInset } from '../../hooks/useKeyboardInset';
import { useColors } from '../ThemeProvider';
import { useWalletStore } from '../../stores/walletStore';
import { formatAmount } from '../../utils/format';
import { ChatAvatar } from './ChatAvatar';
import type { PeerCard } from '../../types';

interface SendMoneySheetProps {
  visible: boolean;
  peer: PeerCard | null;
  sending?: boolean;
  onClose: () => void;
  onSend: (amount: number, note: string) => void;
}

/**
 * Envoyer de l'argent depuis la conversation.
 *
 * Deux temps, comme le transfert P2P ordinaire : le montant, puis une
 * confirmation qui redit à qui et combien. On ne déplace pas d'argent sur un
 * seul geste — surtout dans un fil, où l'on tape vite.
 *
 * Le destinataire n'est pas à choisir : c'est la personne en face. Cet écran
 * n'a donc pas l'étape d'identification du modal P2P.
 */
export function SendMoneySheet({ visible, peer, sending, onClose, onSend }: SendMoneySheetProps) {
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const balance = useWalletStore((s) => s.balance);
  const { keyboard, viewportHeight } = useKeyboardInset();

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [confirming, setConfirming] = useState(false);

  const value = Number(String(amount).replace(/[^\d]/g, '')) || 0;
  const enough = balance == null || value <= balance;
  const canGo = value > 0 && enough && !sending;

  const close = () => {
    setAmount('');
    setNote('');
    setConfirming(false);
    onClose();
  };

  /**
   * Place à laisser au clavier — la feuille est ancrée en bas, elle passait
   * dessous dès l'ouverture (le montant est en `autoFocus`).
   *
   * Web : le clavier virtuel ne réduit PAS le document, seulement le viewport
   * visible ; le modal reste donc plein écran et son bas est masqué. On cale le
   * fond sur la hauteur réellement visible — même remède que l'écran de
   * conversation (`app/messages/[id].tsx`).
   *
   * Natif : le clavier a une hauteur mesurable, le fond la lui réserve.
   */
  const isWeb = Platform.OS === 'web';
  const backdropStyle =
    isWeb && viewportHeight
      ? ({ height: viewportHeight } as any)
      : keyboard > 0
        ? { paddingBottom: keyboard }
        : null;

  // Clavier ouvert, la zone du home indicator est couverte : lui réserver la
  // marge en plus ferait flotter la feuille au-dessus du clavier.
  const bottomPad = keyboard > 0 ? Spacing.md : Math.max(insets.bottom, Spacing.md);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <Pressable style={[styles.backdrop, backdropStyle]} onPress={close}>
        <Pressable style={[styles.sheet, { paddingBottom: bottomPad }]} onPress={() => {}}>
          <View style={styles.head}>
            <Text style={styles.title}>
              {confirming ? t('messages.confirmSend', 'Confirmer l’envoi') : t('messages.sendMoney', 'Envoyer de l’argent')}
            </Text>
            <TouchableOpacity onPress={confirming ? () => setConfirming(false) : close} hitSlop={12}>
              <FontAwesome6 name={confirming ? 'arrow-left' : 'xmark'} size={18} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Le corps défile : clavier ouvert sur un petit écran, la feuille
              dépassait la place restante et le bouton se retrouvait hors champ. */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
          <View style={styles.peer}>
            <ChatAvatar name={peer?.name || ''} uri={peer?.avatar} size={40} />
            <View style={styles.peerBody}>
              <Text style={styles.peerName} numberOfLines={1}>{peer?.name}</Text>
              <Text style={styles.peerMeta}>
                {t('messages.balanceIs', 'Solde')} : {balance != null ? formatAmount(balance) : '—'} XOF
              </Text>
            </View>
          </View>

          {!confirming ? (
            <>
              <View style={[styles.amountBox, !enough && { borderColor: colors.error }]}>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={(v) => setAmount(v.replace(/[^\d]/g, ''))}
                  placeholder="0"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="number-pad"
                  autoFocus
                />
                <Text style={styles.currency}>XOF</Text>
              </View>

              {!enough && (
                <Text style={[styles.warn, { color: colors.error }]}>
                  {t('messages.notEnough', 'Solde insuffisant.')}
                </Text>
              )}

              <TextInput
                style={styles.note}
                value={note}
                onChangeText={setNote}
                placeholder={t('messages.sendNote', 'Un mot avec l’envoi (facultatif)')}
                placeholderTextColor={colors.textMuted}
                maxLength={140}
              />

              <TouchableOpacity
                style={[styles.cta, { backgroundColor: canGo ? colors.primary : withAlpha(colors.textMuted, 0.25) }]}
                onPress={() => setConfirming(true)}
                disabled={!canGo}
              >
                <Text style={styles.ctaText}>{t('common.next', 'Continuer')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.recap}>
                <Text style={styles.recapAmount}>{formatAmount(value)} XOF</Text>
                <Text style={styles.recapTo}>
                  {t('messages.toPerson', 'à')} {peer?.name}
                </Text>
                {!!note && <Text style={styles.recapNote}>« {note} »</Text>}
              </View>

              <TouchableOpacity
                style={[styles.cta, { backgroundColor: colors.primary }, sending && { opacity: 0.7 }]}
                onPress={() => onSend(value, note)}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Text style={styles.ctaText}>{t('p2p.confirm', 'Confirmer')}</Text>
                )}
              </TouchableOpacity>
            </>
          )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const createStyles = (Colors: ColorPalette) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: Colors.cardSolid,
      borderTopLeftRadius: BorderRadius.xl,
      borderTopRightRadius: BorderRadius.xl,
      paddingHorizontal: Spacing.md,
      paddingTop: Spacing.md,
      alignSelf: 'center',
      width: '100%',
      maxWidth: 520,
      // Le fond ne dépasse jamais la place laissée par le clavier : la feuille
      // s'y limite, et c'est son corps qui défile.
      maxHeight: '100%',
    },
    // `flexShrink` sans `flexGrow` : la liste se réduit quand la place manque,
    // mais ne tire pas la feuille en plein écran quand elle est courte.
    body: { flexGrow: 0, flexShrink: 1 },
    bodyContent: { paddingBottom: Spacing.xs },
    head: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: Spacing.md,
      paddingHorizontal: Spacing.sm,
      paddingBottom: Spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: Colors.border,
    },
    title: { flex: 1, fontFamily: Fonts.bold, fontSize: FontSize.md, color: Colors.text },
    peer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
      paddingVertical: Spacing.md,
    },
    peerBody: { flex: 1, minWidth: 0 },
    peerName: { fontFamily: Fonts.semiBold, fontSize: FontSize.md, color: Colors.text },
    peerMeta: { fontFamily: Fonts.regular, fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 1 },
    amountBox: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: BorderRadius.lg,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm,
    },
    amountInput: {
      flex: 1,
      fontFamily: Fonts.bold,
      fontSize: FontSize.xxl,
      color: Colors.text,
      paddingVertical: Spacing.xs,
    },
    currency: { fontFamily: Fonts.semiBold, fontSize: FontSize.md, color: Colors.textMuted },
    warn: { fontFamily: Fonts.medium, fontSize: FontSize.sm, marginTop: Spacing.xs },
    note: {
      marginTop: Spacing.md,
      borderWidth: 1,
      borderColor: Colors.border,
      borderRadius: BorderRadius.md,
      paddingHorizontal: Spacing.md,
      paddingVertical: Spacing.sm + 2,
      fontFamily: Fonts.regular,
      fontSize: FontSize.md,
      color: Colors.text,
    },
    recap: { alignItems: 'center', paddingVertical: Spacing.lg, gap: 4 },
    recapAmount: { fontFamily: Fonts.bold, fontSize: FontSize.xxl, color: Colors.text },
    recapTo: { fontFamily: Fonts.regular, fontSize: FontSize.md, color: Colors.textMuted },
    recapNote: {
      fontFamily: Fonts.regular,
      fontSize: FontSize.sm,
      color: Colors.textSecondary,
      fontStyle: 'italic',
      marginTop: Spacing.xs,
    },
    cta: {
      marginTop: Spacing.md,
      borderRadius: BorderRadius.pill,
      paddingVertical: Spacing.md,
      alignItems: 'center',
    },
    ctaText: { fontFamily: Fonts.bold, fontSize: FontSize.md, color: '#fff' },
  });
