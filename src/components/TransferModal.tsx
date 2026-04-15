import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  PanResponder,
  Dimensions,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Input } from './Input';
import { Button } from './Button';
import { walletService } from '../services/walletService';
import { useWalletStore } from '../stores/walletStore';
import { useAuthStore } from '../stores/authStore';
import { OPERATORS } from '../constants/config';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { showAlert } from '../stores/alertStore';
import { CustomAlert } from './CustomAlert';

interface TransferModalProps {
  visible: boolean;
  onClose: () => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DEFAULT_H = SCREEN_HEIGHT * 0.92;
const MIN_H = SCREEN_HEIGHT * 0.3;
const MAX_H = SCREEN_HEIGHT * 0.92;

export function TransferModal({ visible, onClose }: TransferModalProps) {
  const insets = useSafeAreaInsets();
  const sheetHeight = useRef(new Animated.Value(DEFAULT_H)).current;
  const lastHeight = useRef(DEFAULT_H);

  useEffect(() => {
    if (visible) {
      sheetHeight.setValue(DEFAULT_H);
      lastHeight.current = DEFAULT_H;
    }
  }, [visible]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, { dy }) => {
        const newH = lastHeight.current - dy;
        sheetHeight.setValue(Math.max(MIN_H, Math.min(MAX_H, newH)));
      },
      onPanResponderRelease: (_, { dy }) => {
        const clampedH = Math.max(MIN_H, Math.min(MAX_H, lastHeight.current - dy));
        lastHeight.current = clampedH;
        Animated.spring(sheetHeight, { toValue: clampedH, useNativeDriver: false, bounciness: 4 }).start();
      },
    })
  ).current;

  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const fetchBalance = useWalletStore((s) => s.fetchBalance);
  const user = useAuthStore((s) => s.user);

  const displayOperators = OPERATORS.filter((op) => op.withdraw);

  // Calcul frais en live (même logique que le web)
  const numAmount = parseFloat(amount) || 0;
  const selectedOp = OPERATORS.find((op) => op.id === operator);
  const feeRate = selectedOp?.country === 'CM' ? 0.1 : 0.05;
  const fees = useMemo(() => Math.round(numAmount * feeRate), [numAmount, feeRate]);
  const total = numAmount + fees;

  const fmt = (n: number) => n.toLocaleString('fr-FR').replace(/\s/g, '.').replace(/,/g, '.');

  const showFees = numAmount > 0 && operator;

  const handleClose = () => {
    // Afficher confirmation seulement si l'utilisateur a tapé du texte (montant ou téléphone)
    const hasUserInput = !!amount.trim() || !!phone.trim();
    if (hasUserInput) {
      showAlert(
        'Annuler le transfert ?',
        'Les informations saisies seront perdues.',
        [
          { text: 'Continuer la saisie' },
          { text: 'Quitter', onPress: onClose },
        ],
      );
    } else {
      onClose();
    }
  };

  const handlePressEnvoyer = () => {
    if (user?.validate !== 1) {
      showAlert('KYC requis', 'Vous devez compléter la vérification KYC avant de pouvoir faire des transactions.');
      return;
    }
    setConfirmed(false);
    setConfirmVisible(true);
  };

  const handleTransfer = async () => {
    setConfirmVisible(false);
    setLoading(true);
    try {
      const result = await walletService.transfer({
        amount: numAmount,
        moyen: operator,
        tel: phone.trim(),
      });
      await fetchBalance();
      const msg = result?.message
        ? `${result.message}\nMontant envoyé: ${result.amount_sent} XOF\nFrais: ${result.fees} XOF`
        : 'Transfert effectué avec succès.';
      showAlert('Succès', msg, [{ text: 'OK', onPress: onClose }]);
      setAmount('');
      setOperator('');
      setPhone('');
    } catch (error: any) {
      const msg = error?.response?.data?.error
        || error?.response?.data?.message
        || (error?.code === 'ECONNABORTED' ? 'La requête a expiré. Connexion lente ou service indisponible, réessayez.' : null)
        || 'Erreur lors du transfert.';
      showAlert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <KeyboardAvoidingView style={[styles.overlay, { paddingTop: insets.top }]} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.sheet, { height: sheetHeight, paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
              <View style={styles.handleContainer} {...panResponder.panHandlers}>
                <View style={styles.handle} />
              </View>
          <View style={styles.header}>
            <Text style={styles.title}>Transfert d'argent</Text>
            <TouchableOpacity onPress={handleClose}>
              <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Spacing.xl }}>
            {user?.validate !== 1 && (
              <View style={styles.kycBanner}>
                <FontAwesome6 name="triangle-exclamation" size={14} color={Colors.warning} style={{ marginRight: 8 }} />
                <Text style={styles.kycBannerText}>Vérification KYC requise pour effectuer des transactions.</Text>
              </View>
            )}
            <Text style={styles.operatorLabel}>Choisir l'opérateur</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.operatorScroll}
              contentContainerStyle={styles.operatorScrollContent}
            >
              {displayOperators.map((op) => (
                <TouchableOpacity
                  key={op.id}
                  style={[styles.operatorCard, operator === op.id && styles.operatorSelected]}
                  onPress={() => setOperator(op.id)}
                >
                  <Image source={op.logo} style={styles.operatorLogo} resizeMode="contain" />
                  <Text style={styles.operatorFlag}>{op.flag}</Text>
                  <Text style={[styles.operatorName, operator === op.id && styles.operatorNameSelected]}>
                    {op.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Input
              label="Montant (XOF)"
              placeholder="Ex: 10000"
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
              keyboardType="numeric"
            />

            {/* Frais en live */}
            {showFees ? (
              <View style={styles.feesBox}>
                <View style={styles.feesRow}>
                  <Text style={styles.feesLabel}>Frais ({(feeRate * 100).toFixed(0)}%)</Text>
                  <Text style={[styles.feesValue, { color: Colors.error }]}>+ {fmt(fees)} XOF</Text>
                </View>
                <View style={[styles.feesRow, styles.feesTotalRow]}>
                  <Text style={styles.feesTotalLabel}>Total débité</Text>
                  <Text style={styles.feesTotalValue}>{fmt(total)} XOF</Text>
                </View>
              </View>
            ) : null}

            <Input
              label="Numéro du destinataire"
              placeholder="Ex: 77 123 45 67"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
            />

            <Button
              title="Envoyer"
              onPress={handlePressEnvoyer}
              icon="paper-plane"
              loading={loading}
              disabled={!amount || !operator || !phone}
              style={{ marginTop: Spacing.lg }}
            />
          </ScrollView>
            </Animated.View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      {/* Modal de confirmation */}
      <Modal visible={confirmVisible} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>Confirmer le transfert</Text>
            <Text style={styles.confirmSubtitle}>Veuillez vérifier les informations avant d'envoyer</Text>

            <Text style={styles.confirmAmountLabel}>Montant envoyé</Text>
            <Text style={styles.confirmAmount}>{fmt(numAmount)}</Text>
            <Text style={styles.confirmAmountCurrency}>XOF</Text>

            <Text style={styles.confirmPhoneLabel}>Destinataire</Text>
            <Text style={styles.confirmPhone}>{phone || '—'}</Text>

            {selectedOp && (
              <View style={styles.confirmOpRow}>
                <Image source={selectedOp.logo} style={styles.confirmOpLogo} resizeMode="contain" />
                <Text style={styles.confirmOpName}>{selectedOp.flag} {selectedOp.name}</Text>
              </View>
            )}

            <View style={styles.confirmFeesBox}>
              <View style={styles.feesRow}>
                <Text style={styles.feesLabel}>Frais ({(feeRate * 100).toFixed(0)}%)</Text>
                <Text style={[styles.feesValue, { color: Colors.error }]}>+ {fmt(fees)} XOF</Text>
              </View>
              <View style={[styles.feesRow, styles.feesTotalRow]}>
                <Text style={styles.feesTotalLabel}>Total débité</Text>
                <Text style={styles.feesTotalValue}>{fmt(total)} XOF</Text>
              </View>
            </View>

            {/* Checkbox confirmation */}
            <TouchableOpacity style={styles.checkRow} onPress={() => setConfirmed((v) => !v)}>
              <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
                {confirmed && <FontAwesome6 name="check" size={10} color={Colors.white} />}
              </View>
              <Text style={styles.checkLabel}>Je confirme que les informations sont correctes</Text>
            </TouchableOpacity>

            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmVisible(false)}>
                <Text style={styles.cancelBtnText}>Modifier</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, !confirmed && styles.confirmBtnDisabled]}
                onPress={confirmed ? handleTransfer : undefined}
              >
                <FontAwesome6 name="paper-plane" size={14} color={Colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.confirmBtnText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <CustomAlert />
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  handleContainer: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: Spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  kycBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.warning + '20',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginBottom: Spacing.md,
  },
  kycBannerText: {
    flex: 1,
    color: Colors.warning,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
  },
  operatorLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    marginBottom: Spacing.sm,
  },
  operatorScroll: {
    marginBottom: Spacing.md,
    marginHorizontal: -Spacing.lg,
  },
  operatorScrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  operatorCard: {
    width: 90,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
    gap: Spacing.xs,
  },
  operatorSelected: {
    borderColor: Colors.secondary,
    backgroundColor: 'rgba(244,178,40,0.1)',
  },
  operatorLogo: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
  },
  operatorName: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
  },
  operatorFlag: {
    fontSize: 22,
    textAlign: 'center',
  },
  operatorNameSelected: {
    color: Colors.secondary,
  },
  // Frais live
  feesBox: {
    backgroundColor: Colors.secondary + '18',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.secondary + '40',
  },
  feesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feesLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
  },
  feesValue: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  feesTotalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: Spacing.xs,
    marginTop: Spacing.xs,
  },
  feesTotalLabel: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
  },
  feesTotalValue: {
    color: Colors.secondary,
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
  },
  // Modal confirmation
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  confirmSheet: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '100%',
    alignItems: 'center',
  },
  confirmTitle: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.secondary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  confirmSubtitle: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  confirmAmountLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  confirmAmount: {
    fontSize: 56,
    fontFamily: Fonts.bold,
    color: Colors.text,
    lineHeight: 64,
  },
  confirmAmountCurrency: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    letterSpacing: 2,
    marginBottom: Spacing.lg,
  },
  confirmPhoneLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  confirmPhone: {
    fontSize: 32,
    fontFamily: Fonts.bold,
    color: Colors.secondary,
    marginBottom: Spacing.md,
  },
  confirmOpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  confirmOpLogo: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.sm,
  },
  confirmOpName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
  },
  confirmFeesBox: {
    width: '100%',
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
    width: '100%',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: Colors.error,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: Colors.success,
    borderColor: Colors.success,
  },
  checkLabel: {
    flex: 1,
    color: Colors.error,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: Spacing.md,
    width: '100%',
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.text,
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.md,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.secondary,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.4,
  },
  confirmBtnText: {
    color: Colors.white,
    fontFamily: Fonts.bold,
    fontSize: FontSize.md,
  },
});
