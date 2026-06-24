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
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts, Shadow } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useResponsive } from '../hooks/useResponsive';
import { CustomAlert } from './CustomAlert';
import { useTranslation } from 'react-i18next';
import { useFormatXof } from '../utils/format';
import { useCryptoStore } from '../stores/cryptoStore';

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

const buildQrUrl = (data: string, size = 320) =>
  `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(data)}&size=${size}x${size}&margin=8&qzone=1`;

export function CryptoSellDetailsModal({ visible, onClose, data }: CryptoSellDetailsModalProps) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const { isDesktop } = useResponsive();
  const { t } = useTranslation();
  const fmtXof = useFormatXof();
  const cryptoRates = useCryptoStore((s) => s.rates);
  const formatCode = (code: string): string => {
    if (!code) return '';
    const norm = code.trim().toUpperCase();
    const rate = cryptoRates.find((r) => (r.code || '').trim().toUpperCase() === norm);
    return rate?.name?.trim() || norm;
  };
  const [timeLeft, setTimeLeft] = useState<{ hours: number; minutes: number; seconds: number } | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const detail = data?.detail ?? {};
  const address = data?.deposit_address || detail?.address || '';
  const providedQr = detail?.qrcode_url || '';
  // Si le provider ne renvoie pas de qrcode_url (NowPayments), on en génère un
  // localement via l'API publique qrserver à partir de l'adresse.
  const qrcodeUrl = providedQr || (address ? buildQrUrl(address) : '');
  const confirmsNeeded = detail?.confirms_needed ?? 0;
  const timeout = detail?.timeout ?? 0;
  const depositAmount = data?.deposit_amount ?? detail?.amount ?? 0;
  const currency = data?.currency ?? '';
  const xofAmount = data?.xof_amount ?? 0;

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

  const sheetWrapperStyle = isDesktop
    ? [styles.sheetWrapperDesktop]
    : [styles.sheetWrapperMobile];

  const sheetStyle = isDesktop
    ? [styles.sheetDesktop]
    : [styles.sheetMobile, { paddingBottom: Math.max(insets.bottom, Spacing.lg) }];

  return (
    <Modal visible={visible} animationType={isDesktop ? 'fade' : 'slide'} transparent onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <KeyboardAvoidingView style={[styles.overlay, isDesktop && styles.overlayDesktop]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableWithoutFeedback>
            <View style={sheetWrapperStyle}>
              <View style={sheetStyle}>

                {/* Header */}
                <View style={styles.header}>
                  <View style={styles.headerLeft}>
                    <View style={styles.headerIcon}>
                      <FontAwesome6 name="paper-plane" size={16} color={Colors.primary} solid />
                    </View>
                    <View>
                      <Text style={styles.title}>{t('cryptoSellDetails.title')}</Text>
                      <Text style={styles.subtitle}>{t('cryptoSellDetails.subtitle')}</Text>
                    </View>
                  </View>
                  <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <FontAwesome6 name="xmark" size={18} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                  {/* Carte montant */}
                  <View style={styles.amountCard}>
                    <Text style={styles.amountLabel}>{t('cryptoSellDetails.sendExactly')}</Text>
                    <View style={styles.amountRow}>
                      <Text style={styles.depositAmount}>{depositAmount}</Text>
                      <View style={styles.currencyBadge}>
                        <Text style={styles.currencyBadgeText}>{formatCode(currency)}</Text>
                      </View>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.receiveRow}>
                      <FontAwesome6 name="arrow-down" size={11} color={Colors.secondary} />
                      <Text style={styles.receiveLabel}>{t('cryptoModal.youWillReceive')}</Text>
                      <Text style={styles.receiveAmount}>{fmtXof(xofAmount)}</Text>
                    </View>
                  </View>

                  {/* Avertissement */}
                  <View style={styles.warningBox}>
                    <View style={styles.warningIconWrap}>
                      <FontAwesome6 name="triangle-exclamation" size={13} color={Colors.error} solid />
                    </View>
                    <Text style={styles.warningText}>
                      {t('cryptoSellDetails.warning')}
                    </Text>
                  </View>

                  {/* QR centré + adresse en dessous (mobile et desktop) */}
                  <View style={styles.qrAddressBlock}>
                    {!!qrcodeUrl && (
                      <View style={styles.qrSection}>
                        <View style={styles.qrWrapper}>
                          <Image source={{ uri: qrcodeUrl }} style={styles.qrCode} resizeMode="contain" />
                        </View>
                        <Text style={styles.qrCaption}>{t('cryptoSellDetails.scanQr')}</Text>
                      </View>
                    )}

                    <View style={styles.addressSection}>
                      <Text style={styles.fieldLabel}>{t('cryptoSellDetails.depositAddress')}</Text>
                      <TouchableOpacity style={[styles.addressBox, isCopied && styles.addressBoxCopied]} onPress={handleCopy} activeOpacity={0.7}>
                        <Text style={styles.addressText} selectable>{address}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.copyBtn, isCopied && styles.copyBtnCopied]} onPress={handleCopy} activeOpacity={0.8}>
                        <FontAwesome6 name={isCopied ? 'check' : 'copy'} size={13} color={Colors.white} solid />
                        <Text style={styles.copyBtnText}>
                          {isCopied ? t('common.addressCopied') : t('common.tapToCopy')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Badges info */}
                  {(confirmsNeeded > 0 || !!timeLeft) && (
                    <View style={styles.infoRow}>
                      {confirmsNeeded > 0 && (
                        <View style={styles.infoPill}>
                          <FontAwesome6 name="circle-check" size={14} color={Colors.primary} solid />
                          <View style={styles.infoPillContent}>
                            <Text style={styles.infoPillLabel}>{t('cryptoSellDetails.confirmsNeeded')}</Text>
                            <Text style={styles.infoPillValue}>{confirmsNeeded}</Text>
                          </View>
                        </View>
                      )}
                      {!!timeLeft && (
                        <View style={[styles.infoPill, styles.infoPillWarning]}>
                          <FontAwesome6 name="clock" size={14} color={Colors.warning} solid />
                          <View style={styles.infoPillContent}>
                            <Text style={styles.infoPillLabel}>{t('cryptoSellDetails.validity')}</Text>
                            <Text style={[styles.infoPillValue, { color: Colors.secondary }]}>
                              {pad(timeLeft.hours)}:{pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}

                  {/* Note */}
                  <View style={styles.noteBox}>
                    <FontAwesome6 name="circle-info" size={13} color={Colors.textMuted} />
                    <Text style={styles.noteText}>
                      {t('cryptoSellDetails.creditNote')}
                    </Text>
                  </View>

                </ScrollView>
              </View>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>
      <CustomAlert />
    </Modal>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  overlayDesktop: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  sheetWrapperMobile: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheetWrapperDesktop: {
    width: '100%',
    maxWidth: 720,
    maxHeight: '90%',
  },
  sheetMobile: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    maxHeight: '92%',
  },
  sheetDesktop: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.lg,
    ...Shadow.card,
  },
  scrollContent: {
    paddingBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginTop: 1,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },

  amountCard: {
    backgroundColor: Colors.primary + '08',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.primary + '20',
    marginBottom: Spacing.sm,
  },
  amountLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    letterSpacing: 1,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  depositAmount: {
    fontSize: 32,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    lineHeight: 38,
  },
  currencyBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.sm,
  },
  currencyBadgeText: {
    color: Colors.white,
    fontFamily: Fonts.bold,
    fontSize: FontSize.sm,
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.sm,
  },
  receiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  receiveLabel: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  receiveAmount: {
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
    color: Colors.secondary,
  },

  warningBox: {
    alignItems: 'center',
    backgroundColor: Colors.error + '10',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.error + '40',
    gap: 6,
  },
  warningIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.error + '18',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  warningText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    color: Colors.error,
    lineHeight: 18,
    textAlign: 'center',
  },

  qrAddressBlock: {
    marginBottom: Spacing.md,
    alignItems: 'center',
  },
  qrSection: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  qrWrapper: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  qrCode: { width: 180, height: 180 },
  qrCaption: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
    marginTop: Spacing.xs,
  },

  addressSection: {
    width: '100%',
    maxWidth: 520,
  },
  fieldLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    textAlign: 'center',
  },
  addressBox: {
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  addressBoxCopied: {
    borderColor: Colors.success,
    backgroundColor: Colors.success + '10',
  },
  addressText: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    lineHeight: 20,
    textAlign: 'center',
  },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  copyBtnCopied: {
    backgroundColor: Colors.success,
  },
  copyBtnText: {
    color: Colors.white,
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.sm,
  },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  infoPill: {
    flex: 1,
    maxWidth: 220,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    backgroundColor: Colors.primary + '08',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  infoPillWarning: {
    borderColor: Colors.warning + '60',
    backgroundColor: Colors.warning + '10',
  },
  infoPillLabel: { fontSize: FontSize.xs, color: Colors.textMuted, fontFamily: Fonts.regular, textAlign: 'center' },
  infoPillValue: { fontSize: FontSize.md, color: Colors.primary, fontFamily: Fonts.bold, marginTop: 1, textAlign: 'center' },
  infoPillContent: { alignItems: 'center' },

  noteBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  noteText: { fontSize: FontSize.xs, color: Colors.textMuted, fontFamily: Fonts.regular, lineHeight: 18, textAlign: 'center', flexShrink: 1 },
});
