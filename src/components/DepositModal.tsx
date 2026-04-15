import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  Linking,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
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

interface DepositModalProps {
  visible: boolean;
  onClose: () => void;
}

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DEFAULT_H = SCREEN_HEIGHT * 0.92;
const MIN_H = SCREEN_HEIGHT * 0.3;
const MAX_H = SCREEN_HEIGHT * 0.92;

export function DepositModal({ visible, onClose }: DepositModalProps) {
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
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [pollingState, setPollingState] = useState<'idle' | 'pending' | 'success' | 'failed' | 'timeout'>('idle');
  const [pollingMessage, setPollingMessage] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fetchBalance = useWalletStore((s) => s.fetchBalance);
  const user = useAuthStore((s) => s.user);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
  }, []);

  const startPolling = useCallback((depositId: number) => {
    let attempts = 0;
    const MAX_ATTEMPTS = 30; // 2,5 min max
    pollingRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await walletService.getDepositStatus(depositId);
        if (res.statut === 'success') {
          stopPolling();
          setPollingState('success');
          fetchBalance().catch(() => {});
        } else if (res.statut === 'fail') {
          stopPolling();
          setPollingState('failed');
          setPollingMessage('Le paiement a échoué. Veuillez réessayer.');
        } else if (attempts >= MAX_ATTEMPTS) {
          stopPolling();
          setPollingState('timeout');
          setPollingMessage('');
        }
      } catch {
        // ignore les erreurs réseau temporaires
      }
    }, 5000);
  }, [fetchBalance, stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Filter operators by user's country (admins and unvalidated users see all)
  const userCountry = user?.country ?? '';
  const isAdmin = user?.group === 'admin';
  const isKycValidated = user?.validate === 1;
  const mobileMoneyCountries = ['BJ', 'BF', 'CI', 'TG', 'SN', 'ML', 'CM'];
  const showCard = isAdmin || !isKycValidated || !mobileMoneyCountries.includes(userCountry);
  const filteredOperators = (isAdmin || !isKycValidated)
    ? [...OPERATORS]
    : [
        ...OPERATORS.filter((op) => op.country === userCountry),
        ...(showCard ? OPERATORS.filter((op) => op.id === 'card') : []),
      ];
  const displayOperators = filteredOperators.length > 0 ? filteredOperators : OPERATORS;

  const needsOtp = operator === 'orange-money-burkina';
  const isCard = operator === 'card';

  const handleClose = () => {
    // Afficher confirmation seulement si l'utilisateur a tapé du texte (montant, téléphone ou OTP)
    const hasUserInput = !!amount.trim() || !!phone.trim() || !!otp.trim();
    if (hasUserInput) {
      showAlert(
        'Annuler le dépôt ?',
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

  const handleDeposit = async () => {
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount < 1000) {
      showAlert('Erreur', 'Le montant minimum est de 1000 XOF.');
      return;
    }
    if (!operator) {
      showAlert('Erreur', 'Veuillez sélectionner un opérateur.');
      return;
    }
    if (!isCard && !phone.trim()) {
      showAlert('Erreur', 'Veuillez entrer votre numéro de téléphone.');
      return;
    }
    setLoading(true);
    try {
      const payload: any = { amount: numAmount, moyen: operator };
      if (!isCard) payload.tel = phone.trim();
      if (needsOtp && otp) payload.otp = otp;
      const result = await walletService.deposit(payload);
      console.log('[Deposit] result:', JSON.stringify(result));

      const redirectUrl = result?.checkout_url || result?.url;
      if (redirectUrl) {
        Linking.openURL(redirectUrl).catch(() => {});
      }

      if (result?.deposit_id) {
        setPollingState('pending');
        setPollingMessage(redirectUrl
          ? 'En attente de confirmation de paiement…'
          : 'Vérifiez votre téléphone et confirmez le paiement…'
        );
        startPolling(result.deposit_id);
      } else {
        await fetchBalance();
        showAlert('Succès', result?.message || 'Votre dépôt a été initié.', [{ text: 'OK', onPress: onClose }]);
      }
      setAmount('');
      setOperator('');
      setPhone('');
      setOtp('');
    } catch (error: any) {
      console.log('[Deposit] error:', error?.response?.status, JSON.stringify(error?.response?.data));
      const msg = error?.response?.data?.error
        || error?.response?.data?.message
        || (error?.response?.data?.errors ? Object.values(error.response.data.errors).flat().join('\n') : null)
        || 'Erreur lors du dépôt.';
      showAlert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <KeyboardAvoidingView
          style={[styles.overlay, { paddingTop: insets.top }]}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback>
            <Animated.View style={[styles.sheet, { height: sheetHeight, paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
              <View style={styles.handleContainer} {...panResponder.panHandlers}>
                <View style={styles.handle} />
              </View>
              <View style={styles.header}>
                <Text style={styles.title}>Dépôt Mobile Money</Text>
                <TouchableOpacity onPress={handleClose}>
                  <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

          {pollingState === 'pending' && (
            <View style={styles.pollingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.pollingTitle}>Traitement en cours…</Text>
              <Text style={styles.pollingMessage}>{pollingMessage}</Text>
              <Button title="Vérifier plus tard" onPress={() => { stopPolling(); setPollingState('idle'); onClose(); }} style={{ marginTop: Spacing.lg }} />
            </View>
          )}

          {pollingState === 'success' && (
            <View style={styles.pollingContainer}>
              <FontAwesome6 name="circle-check" size={64} color={Colors.success} />
              <Text style={[styles.pollingTitle, { color: Colors.success }]}>Paiement confirmé !</Text>
              <Text style={styles.pollingMessage}>Votre solde a été mis à jour.</Text>
              <Button title="Fermer" onPress={() => { setPollingState('idle'); onClose(); }} style={{ marginTop: Spacing.lg }} />
            </View>
          )}

          {pollingState === 'failed' && (
            <View style={styles.pollingContainer}>
              <FontAwesome6 name="circle-xmark" size={64} color={Colors.error ?? Colors.danger ?? '#e53935'} />
              <Text style={[styles.pollingTitle, { color: Colors.error ?? Colors.danger ?? '#e53935' }]}>Paiement échoué</Text>
              <Text style={styles.pollingMessage}>{pollingMessage}</Text>
              <Button title="Réessayer" onPress={() => setPollingState('idle')} style={{ marginTop: Spacing.lg }} />
            </View>
          )}

          {pollingState === 'timeout' && (
            <View style={styles.pollingContainer}>
              <FontAwesome6 name="clock" size={64} color={Colors.warning ?? '#F4B228'} />
              <Text style={[styles.pollingTitle, { color: Colors.warning ?? '#F4B228' }]}>Traitement en cours</Text>
              <Text style={styles.pollingMessage}>{'Le paiement prend plus de temps que prévu.\nVérifiez votre historique dans quelques minutes.'}</Text>
              <Button title="Voir l'historique" onPress={() => { setPollingState('idle'); onClose(); }} style={{ marginTop: Spacing.lg }} />
              <Button title="Réessayer" onPress={() => setPollingState('idle')} style={{ marginTop: Spacing.sm }} />
            </View>
          )}

          {pollingState === 'idle' && <ScrollView showsVerticalScrollIndicator={false}>
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
                  style={[
                    styles.operatorCard,
                    operator === op.id && styles.operatorSelected,
                  ]}
                  onPress={() => setOperator(op.id)}
                >
                  <Image source={op.logo} style={styles.operatorLogo} resizeMode="contain" />
                  <Text style={styles.operatorFlag}>{op.flag}</Text>
                  <Text
                    style={[
                      styles.operatorName,
                      operator === op.id && styles.operatorNameSelected,
                    ]}
                  >
                    {op.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Input
              label="Montant (XOF)"
              placeholder="Min. 1000"
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
              keyboardType="numeric"
            />

            {!isCard && (
              <Input
                label="Numéro de téléphone"
                placeholder="Ex: 97000000"
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            )}

            {!isCard && needsOtp && (
              <Input
                label="Code OTP (Orange Burkina)"
                placeholder="Ex: 123456"
                value={otp}
                onChangeText={setOtp}
                keyboardType="numeric"
              />
            )}

            <Button
              title="Déposer"
              onPress={user?.validate !== 1 ? () => showAlert('KYC requis', 'Vous devez compléter la vérification KYC avant de pouvoir faire des transactions.') : handleDeposit}
              icon="arrow-down"
              loading={loading}
              disabled={!amount || !operator || (!isCard && !phone)}
              style={{ marginTop: Spacing.lg }}
            />
          </ScrollView>}
            </Animated.View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
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
  pollingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  pollingTitle: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
    textAlign: 'center',
  },
  pollingMessage: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
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
});
