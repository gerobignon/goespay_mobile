import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Image,
  Clipboard,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { CustomAlert } from './CustomAlert';

interface CryptoSellDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  data?: {
    transaction_id?: string;
    deposit_address?: string;
    deposit_amount?: number;
    currency?: string;
    xof_amount?: number;
    detail?: {
      amount?: number;
      qrcode_url?: string;
      confirms_needed?: number;
      timeout?: number;
      address?: string;
    };
    status?: string;
  };
}

export function CryptoSellDetailsModal({ visible, onClose, data }: CryptoSellDetailsModalProps) {
  const insets = useSafeAreaInsets();
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const detail = data?.detail ?? {};
  const address = data?.deposit_address || detail?.address || '';
  const qrcodeUrl = detail?.qrcode_url || '';
  const confirmsNeeded = detail?.confirms_needed ?? 0;
  const timeout = detail?.timeout ?? 0;
  const depositAmount = data?.deposit_amount ?? detail?.amount ?? 0;
  const currency = data?.currency ?? '';
  const xofAmount = data?.xof_amount ?? 0;

  const formatCode = (code: string) => {
    if (code === 'BNB.BSC') return 'BNB';
    if (code === 'USDT.TRC20') return 'USDT';
    if (code === 'BUSD.BEP20') return 'BUSD';
    return code;
  };

  const pad = (n: number) => String(n).padStart(2, '0');

  useEffect(() => {
    if (!visible || !timeout) { setTimeLeft(null); return; }
    let remaining = timeout;
    const toHms = (v: number) => ({ hours: Math.floor(v / 3600), minutes: Math.floor((v % 3600) / 60), seconds: v % 60 });
    setTimeLeft(toHms(remaining));
    const interval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) { setTimeLeft(toHms(0)); clearInterval(interval); return; }
      setTimeLeft(toHms(remaining));
    }, 1000);
    return () => clearInterval(interval);
  }, [visible, timeout]);

  const handleCopy = () => {
    if (!address) return;
    Clipboard.setString(address);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <KeyboardAvoidingView style={styles.overlay} behavior="padding">
          <TouchableWithoutFeedback>
            <View style={[styles.sheet, { flex: 1, paddingBottom: Math.max(insets.bottom, Spacing.lg), paddingTop: insets.top }]}>

              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>Infos de transfert</Text>
                <TouchableOpacity onPress={onClose}>
                  <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>

                {/* Montant à envoyer */}
                <Text style={styles.sectionLabel}>ENVOYER EXACTEMENT</Text>
                <Text style={styles.depositAmount}>
                  {depositAmount} {formatCode(currency)}
                </Text>
                <Text style={styles.warningText}>
                  {'⚠️  Tout autre montant entraîne une perte définitive'}
                </Text>
                <Text style={styles.receiveText}>
                  {'Vous recevrez ≈ '}{Math.round(xofAmount).toLocaleString('fr-FR')}{' XOF'}
                </Text>

                {/* QR */}
                {!!qrcodeUrl && (
                  <View style={styles.qrSection}>
                    <View style={[styles.qrWrapper, isCopied && { borderColor: Colors.success, borderWidth: 2 }]}>
                      <Image source={{ uri: qrcodeUrl }} style={styles.qrCode} />
                    </View>
                  </View>
                )}

                {/* Adresse cliquable */}
                <TouchableOpacity style={[styles.addressBox, isCopied && { borderColor: Colors.success }]} onPress={handleCopy} activeOpacity={0.7}>
                  <Text style={styles.fieldLabel}>Adresse de dépôt</Text>
                  <Text style={styles.addressText}>{address}</Text>
                  <Text style={[styles.tapToCopy, isCopied && { color: Colors.success }]}>
                    {isCopied ? '✓  Adresse copiée !' : 'Appuyer pour copier'}
                  </Text>
                </TouchableOpacity>

                {/* Badges info */}
                {(confirmsNeeded > 0 || !!timeLeft) && (
                  <View style={styles.infoRow}>
                    {confirmsNeeded > 0 && (
                      <View style={styles.infoPill}>
                        <Text style={styles.infoPillLabel}>Confirmations requises</Text>
                        <Text style={styles.infoPillValue}>{confirmsNeeded}</Text>
                      </View>
                    )}
                    {!!timeLeft && (
                      <View style={[styles.infoPill, { borderColor: Colors.warning }]}>
                        <Text style={styles.infoPillLabel}>Validité</Text>
                        <Text style={[styles.infoPillValue, { color: Colors.secondary }]}>
                          {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Note */}
                <View style={styles.noteBox}>
                  <Text style={styles.noteText}>
                    {'⏱  Après toutes les confirmations réseau, le crédit peut prendre jusqu\'à 30 minutes.'}
                  </Text>
                </View>

              </ScrollView>
            </View>
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
  sectionLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  depositAmount: {
    fontSize: FontSize.xxl,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  warningText: {
    fontSize: FontSize.sm,
    color: Colors.error,
    fontFamily: Fonts.semiBold,
    marginBottom: 4,
    textAlign: 'center',
  },
  receiveText: {
    fontSize: FontSize.lg,
    color: Colors.secondary,
    fontFamily: Fonts.bold,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  qrSection: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  qrWrapper: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: 8,
  },
  qrCode: { width: 150, height: 150 },
  addressBox: {
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  addressText: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
    lineHeight: 20,
  },
  tapToCopy: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  infoPill: {
    flex: 1,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
  },
  infoPillLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontFamily: Fonts.regular, marginBottom: 2 },
  infoPillValue: { fontSize: FontSize.md, color: Colors.primary, fontFamily: Fonts.bold },
  noteBox: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  noteText: { fontSize: FontSize.xs, color: Colors.textMuted, fontFamily: Fonts.regular, lineHeight: 18 },
});
