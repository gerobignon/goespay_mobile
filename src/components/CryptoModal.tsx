import React, { useEffect, useState, useRef } from 'react';
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
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ImageSourcePropType,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Input } from './Input';
import { Button } from './Button';
import { CryptoSellDetailsModal } from './CryptoSellDetailsModal';
import { useAuthStore } from '../stores/authStore';
import { useWalletStore } from '../stores/walletStore';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import api from '../services/api';
import { showAlert } from '../stores/alertStore';
import { CustomAlert } from './CustomAlert';

interface CryptoModalProps {
  visible: boolean;
  onClose: () => void;
}

interface CryptoRate {
  code: string;
  name: string;
  buy_rate: number;
  sell_rate: number;
  buy_rate_ng?: number;
  sell_rate_ng?: number;
  buy_rate_cm?: number;
  sell_rate_cm?: number;
  buy_rate_ga?: number;
  sell_rate_ga?: number;
  live_rate?: number;
  img?: string;
}

type Tab = 'buy' | 'sell';

const SELL_BLOCKED_COUNTRIES = ['BF', 'NE', 'ML', 'CM', 'NG'];

const CRYPTO_IMAGES: Record<string, ImageSourcePropType> = {
  BTC: require('../../assets/crypto/btc.png'),
  ETH: require('../../assets/crypto/eth.png'),
  TRX: require('../../assets/crypto/trx.png'),
  'BNB.BSC': require('../../assets/crypto/bnb.png'),
  BNB: require('../../assets/crypto/bnb.png'),
  'USDT.TRC20': require('../../assets/crypto/usdt.png'),
  USDT: require('../../assets/crypto/usdt.png'),
  'BUSD.BEP20': require('../../assets/crypto/busd.png'),
  BUSD: require('../../assets/crypto/busd.png'),
  LTC: require('../../assets/crypto/ltc.png'),
  LTCT: require('../../assets/crypto/ltc.png'),
};

const SCREEN_HEIGHT = Dimensions.get('window').height;
const DEFAULT_H = SCREEN_HEIGHT * 0.92;
const MIN_H = SCREEN_HEIGHT * 0.3;
const MAX_H = SCREEN_HEIGHT * 0.92;

export function CryptoModal({ visible, onClose }: CryptoModalProps) {
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

  const user = useAuthStore((s) => s.user);
  const fetchBalance = useWalletStore((s) => s.fetchBalance);

  const [tab, setTab] = useState<Tab>('buy');
  const [rates, setRates] = useState<CryptoRate[]>([]);
  const [loadingRates, setLoadingRates] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [amount, setAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [sellDetailsVisible, setSellDetailsVisible] = useState(false);
  const [sellDetailsData, setSellDetailsData] = useState<any>(null);

  const country = user?.country ?? '';
  const isSellBlocked = SELL_BLOCKED_COUNTRIES.includes(country);

  useEffect(() => {
    if (visible) {
      fetchRates();
      setSelectedCurrency('');
      setAmount('');
      setWalletAddress('');
      setTab('buy');
    }
  }, [visible]);

  const fetchRates = async (retry = 0) => {
    setLoadingRates(true);
    try {
      const response = await api.get('/crypto/rates');
      const body = response.data;
      const list = body.data ?? body.list ?? body.rates ?? body;
      if (Array.isArray(list)) {
        setRates(list);
        // Si des taux live manquent, retenter une fois après 3s
        const stablecoins = ['PM', 'PAYEER', 'USDT.TRC20', 'BUSD.BEP20', 'USDT', 'BUSD'];
        const hasNullRate = list.some((r: CryptoRate) => !stablecoins.includes(r.code) && !r.live_rate);
        if (hasNullRate && retry < 2) {
          setTimeout(() => fetchRates(retry + 1), 3000);
        }
      }
    } catch (error: any) {
      console.log('[Crypto] fetchRates error:', error?.response?.status, error?.message);
      if (retry < 2) {
        setTimeout(() => fetchRates(retry + 1), 3000);
      }
    } finally {
      setLoadingRates(false);
    }
  };

  const getBuyRate = (item: CryptoRate): number => {
    if (country === 'NG' && item.buy_rate_ng) return item.buy_rate_ng;
    if (country === 'CM' && item.buy_rate_cm) return item.buy_rate_cm;
    if (country === 'GA' && item.buy_rate_ga) return item.buy_rate_ga;
    return item.buy_rate;
  };

  const getSellRate = (item: CryptoRate): number => {
    if (country === 'NG' && item.sell_rate_ng) return item.sell_rate_ng;
    if (country === 'CM' && item.sell_rate_cm) return item.sell_rate_cm;
    if (country === 'GA' && item.sell_rate_ga) return item.sell_rate_ga;
    return item.sell_rate;
  };

  const selectedRate = rates.find((r) => r.code === selectedCurrency);

  const computeConversion = (): string => {
    const numAmount = parseFloat(amount);
    if (!selectedRate || !numAmount || isNaN(numAmount)) return '';

    const stablecoins = ['PM', 'PAYEER', 'USDT.TRC20', 'BUSD.BEP20', 'USDT', 'BUSD'];
    const bubuy = stablecoins.includes(selectedCurrency) ? 1 : Number(selectedRate.live_rate);

    if (tab === 'buy') {
      // User gives XOF, receives crypto
      // Formula: (give / buy_rate) * bubuy  (buy_rate = XOF per $1, bubuy = crypto per $1)
      const rate = getBuyRate(selectedRate);
      if (!rate) return '';
      if (!Number.isFinite(bubuy) || bubuy <= 0) return 'Chargement du taux en cours…';
      const cryptoAmount = (numAmount / rate) * bubuy;
      return `Vous recevrez ≈ ${cryptoAmount.toFixed(8)} ${formatCurrencyCode(selectedCurrency)}`;
    } else {
      // User gives crypto, receives XOF
      // Formula: (crypto * sell_rate) / bubuy  (sell_rate = XOF per $1, bubuy = crypto per $1)
      const rate = getSellRate(selectedRate);
      if (!rate) return '';
      if (!Number.isFinite(bubuy) || bubuy <= 0) return 'Chargement du taux en cours…';
      const xofAmount = (numAmount * rate) / bubuy;
      return `Vous recevrez ≈ ${Math.round(xofAmount).toLocaleString('fr-FR')} XOF`;
    }
  };

  const formatCurrencyCode = (code: string): string => {
    if (code === 'BNB.BSC') return 'BNB';
    if (code === 'USDT.TRC20') return 'USDT';
    if (code === 'BUSD.BEP20') return 'BUSD';
    return code;
  };

  const handlePressSubmit = () => {
    if (user?.validate !== 1) {
      showAlert('KYC requis', 'Vous devez compléter la vérification KYC avant de pouvoir faire des transactions crypto.');
      return;
    }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      showAlert('Erreur', 'Veuillez entrer un montant valide.');
      return;
    }
    if (!selectedCurrency) {
      showAlert('Erreur', 'Veuillez sélectionner une crypto-monnaie.');
      return;
    }
    if (tab === 'buy' && !walletAddress.trim()) {
      showAlert('Erreur', 'Veuillez entrer votre adresse de portefeuille.');
      return;
    }

    setConfirmed(false);
    setConfirmVisible(true);
  };

  const handleConfirm = async () => {
    setConfirmVisible(false);
    const numAmount = parseFloat(amount);
    if (!numAmount || isNaN(numAmount)) return;
    setLoading(true);
    try {
      if (tab === 'buy') {
        const response = await api.post('/crypto/buy', {
          currency: selectedCurrency,
          give: numAmount,
          address: walletAddress.trim(),
        });
        const result = response.data;
        await fetchBalance();

        if (result?.state === 1) {
          showAlert('Succès', result?.message || 'Transaction complétée. Vous recevrez vos coins sous peu.', [
            { text: 'OK', onPress: onClose },
          ]);
        } else {
          showAlert('En cours', result?.message || 'Votre achat crypto est en cours de traitement.', [
            { text: 'OK', onPress: onClose },
          ]);
        }
      } else {
        const response = await api.post('/crypto/sell', {
          sell_currency: selectedCurrency,
          sell_give: numAmount,
        });
        const result = response.data;

        if (result?.status === 'deposit_required' && result?.deposit_address) {
          // Afficher le modal avec les détails de transfert
          setSellDetailsData(result);
          setSellDetailsVisible(true);
          setAmount('');
          setSelectedCurrency('');
          setWalletAddress('');
        } else if (result?.status === 'checkout') {
          showAlert('En attente', result?.message || 'Veuillez compléter le paiement.', [
            { text: 'OK', onPress: onClose },
          ]);
        } else {
          showAlert('Succès', result?.message || 'Votre vente crypto a été initiée.', [
            { text: 'OK', onPress: onClose },
          ]);
        }
      }
    } catch (error: any) {
      const msg =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        (error?.response?.data?.errors
          ? Object.values(error.response.data.errors).flat().join('\n')
          : null) ||
        'Erreur lors de la transaction crypto.';
      showAlert('Erreur', msg);
    } finally {
      setLoading(false);
    }
  };

  const conversion = computeConversion();

  const handleClose = () => {
    // Afficher confirmation seulement si l'utilisateur a tapé du texte (montant ou adresse wallet)
    const hasUserInput = !!amount.trim() || !!walletAddress.trim();
    if (hasUserInput) {
      showAlert(
        'Annuler la transaction ?',
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
                <Text style={styles.title}>Crypto</Text>
                <TouchableOpacity onPress={handleClose}>
                  <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            <TouchableOpacity
              style={[styles.tab, tab === 'buy' && styles.tabActive]}
              onPress={() => {
                setTab('buy');
                setSelectedCurrency('');
                setAmount('');
              }}
            >
              <FontAwesome6
                name="coins"
                size={14}
                color={tab === 'buy' ? Colors.white : Colors.textMuted}
              />
              <Text style={[styles.tabText, tab === 'buy' && styles.tabTextActive]}>
                Acheter
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, tab === 'sell' && styles.tabActive]}
              onPress={() => {
                setTab('sell');
                setSelectedCurrency('');
                setAmount('');
              }}
            >
              <FontAwesome6
                name="circle-dollar-to-slot"
                size={14}
                color={tab === 'sell' ? Colors.white : Colors.textMuted}
              />
              <Text style={[styles.tabText, tab === 'sell' && styles.tabTextActive]}>
                Vendre
              </Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {user?.validate !== 1 && (
              <View style={styles.kycBanner}>
                <FontAwesome6 name="triangle-exclamation" size={14} color={Colors.warning} style={{ marginRight: 8 }} />
                <Text style={styles.kycBannerText}>Vérification KYC requise pour effectuer des transactions.</Text>
              </View>
            )}
            {/* Sell blocked for certain countries */}
            {tab === 'sell' && isSellBlocked ? (
              <View style={styles.blockedContainer}>
                <FontAwesome6 name="triangle-exclamation" size={48} color={Colors.error} />
                <Text style={styles.blockedText}>
                  La vente de crypto n'est pas disponible dans votre pays pour le moment.
                </Text>
                <Text style={styles.blockedSubText}>
                  Vous pouvez utiliser un compte dans un pays éligible ou contacter le support.
                </Text>
              </View>
            ) : loadingRates ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.secondary} />
                <Text style={styles.loadingText}>Chargement des taux...</Text>
              </View>
            ) : (
              <>
                {/* Currency selection */}
                <Text style={styles.fieldLabel}>Crypto-monnaie</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.currencyScroll}
                  contentContainerStyle={styles.currencyScrollContent}
                >
                  {rates.map((item) => (
                    <TouchableOpacity
                      key={item.code}
                      style={[
                        styles.currencyCard,
                        selectedCurrency === item.code && styles.currencySelected,
                      ]}
                      onPress={() => setSelectedCurrency(item.code)}
                    >
                      {CRYPTO_IMAGES[item.code] ? (
                        <Image source={CRYPTO_IMAGES[item.code]} style={styles.currencyLogo} resizeMode="contain" />
                      ) : (
                        <Text style={styles.currencyIcon}>{getCryptoIcon(item.code)}</Text>
                      )}
                      <Text
                        style={[
                          styles.currencyName,
                          selectedCurrency === item.code && styles.currencyNameSelected,
                        ]}
                        numberOfLines={1}
                      >
                        {formatCurrencyCode(item.code)}
                      </Text>
                      <Text style={styles.currencyRate}>
                        {tab === 'buy'
                          ? `${getBuyRate(item).toLocaleString('fr-FR')} XOF`
                          : `${getSellRate(item).toLocaleString('fr-FR')} XOF`}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Amount */}
                <Input
                  label={tab === 'buy' ? 'Montant à payer (XOF)' : `Montant en ${formatCurrencyCode(selectedCurrency) || 'crypto'}`}
                  placeholder={tab === 'buy' ? 'Ex: 50000' : 'Ex: 0.001'}
                  value={amount}
                  onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
                  keyboardType="numeric"
                />

                {/* Conversion preview */}
                {conversion ? (
                  <View style={styles.conversionBox}>
                    <FontAwesome6 name="arrows-rotate" size={14} color={Colors.primary} />
                    <Text style={styles.conversionText}>{conversion}</Text>
                    {conversion.includes('Chargement') && (
                      <TouchableOpacity onPress={() => fetchRates()} style={styles.reloadBtn}>
                        <FontAwesome6 name="rotate-right" size={14} color={Colors.white} />
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null}

                {/* Wallet address for buy */}
                {tab === 'buy' && (
                  <Input
                    label="Adresse du portefeuille"
                    placeholder="Adresse crypto de réception"
                    value={walletAddress}
                    onChangeText={setWalletAddress}
                    autoCapitalize="none"
                  />
                )}

                {/* Submit */}
                <Button
                  title={tab === 'buy' ? 'Acheter' : 'Vendre'}
                  onPress={handlePressSubmit}
                  icon={tab === 'buy' ? 'coins' : 'circle-dollar-to-slot'}
                  loading={loading}
                  disabled={
                    !amount ||
                    !selectedCurrency ||
                    (tab === 'buy' && !walletAddress.trim())
                  }
                  style={{ marginTop: Spacing.lg }}
                />
              </>
            )}
          </ScrollView>
            </Animated.View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
      </TouchableWithoutFeedback>

      {/* Modal de confirmation */}
      <Modal visible={confirmVisible} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>
              {tab === 'buy' ? 'Confirmer l\'achat' : 'Confirmer la vente'}
            </Text>
            <Text style={styles.confirmSubtitle}>Veuillez bien vérifier les informations avant de continuer. Toute erreur entraînera une perte définitive des fonds.</Text>

            {/* Crypto icon + name */}
            {selectedRate && (
              <View style={styles.confirmCryptoRow}>
                {CRYPTO_IMAGES[selectedCurrency] ? (
                  <Image source={CRYPTO_IMAGES[selectedCurrency]} style={styles.confirmCryptoLogo} resizeMode="contain" />
                ) : null}
                <Text style={styles.confirmCryptoName}>{formatCurrencyCode(selectedCurrency)}</Text>
              </View>
            )}

            {tab === 'buy' ? (
              <>
                <Text style={styles.confirmAmountLabel}>Montant à payer</Text>
                <Text style={styles.confirmAmount}>{parseFloat(amount || '0').toLocaleString('fr-FR').replace(/\s/g, '.')}</Text>
                <Text style={styles.confirmAmountCurrency}>XOF</Text>
              </>
            ) : (
              <>
                <Text style={styles.confirmAmountLabel}>Montant à vendre</Text>
                <Text style={styles.confirmAmount}>{amount}</Text>
                <Text style={styles.confirmAmountCurrency}>{formatCurrencyCode(selectedCurrency)}</Text>
              </>
            )}

            {/* Conversion */}
            {conversion ? (
              <View style={styles.confirmConversionBox}>
                <FontAwesome6 name="arrows-rotate" size={14} color={Colors.primary} />
                <Text style={styles.confirmConversionText}>{conversion}</Text>
              </View>
            ) : null}

            {/* Wallet address for buy */}
            {tab === 'buy' && walletAddress ? (
              <View style={styles.confirmDetailBox}>
                <Text style={styles.confirmDetailLabel}>Adresse de réception</Text>
                <Text style={styles.confirmDetailValue} numberOfLines={2}>{walletAddress}</Text>
              </View>
            ) : null}

            {/* Rate info */}
            {selectedRate && (
              <View style={styles.confirmDetailBox}>
                <Text style={styles.confirmDetailLabel}>Taux appliqué</Text>
                <Text style={styles.confirmDetailValue}>
                  $1 = {(tab === 'buy' ? getBuyRate(selectedRate) : getSellRate(selectedRate)).toLocaleString('fr-FR')} XOF
                </Text>
              </View>
            )}

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
                onPress={confirmed ? handleConfirm : undefined}
              >
                <FontAwesome6 name={tab === 'buy' ? 'coins' : 'circle-dollar-to-slot'} size={14} color={Colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.confirmBtnText}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <CryptoSellDetailsModal
        visible={sellDetailsVisible}
        onClose={() => {
          setSellDetailsVisible(false);
          setSellDetailsData(null);
          onClose();
        }}
        data={sellDetailsData}
      />

      <CustomAlert />
    </Modal>
  );
}

function getCryptoIcon(code: string): string {
  switch (code) {
    case 'BTC':
      return '₿';
    case 'ETH':
      return 'Ξ';
    case 'BNB.BSC':
    case 'BNB':
      return '◆';
    case 'TRX':
      return '◈';
    case 'LTC':
      return 'Ł';
    case 'USDT.TRC20':
    case 'USDT':
      return '₮';
    default:
      return '🪙';
  }
}

const styles = StyleSheet.create({
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
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    padding: 4,
    marginBottom: Spacing.lg,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
  },
  tabActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.white,
  },
  fieldLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    marginBottom: Spacing.sm,
  },
  currencyScroll: {
    marginBottom: Spacing.md,
    marginHorizontal: -Spacing.lg,
  },
  currencyScrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  currencyCard: {
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
  currencySelected: {
    borderColor: Colors.secondary,
    backgroundColor: 'rgba(244,178,40,0.1)',
  },
  currencyLogo: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
  },
  currencyIcon: {
    fontSize: 28,
    textAlign: 'center',
  },
  currencyName: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
  },
  currencyNameSelected: {
    color: Colors.secondary,
  },
  currencyRate: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    textAlign: 'center',
  },
  conversionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary + '20',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  conversionText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
    flex: 1,
  },
  reloadBtn: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  blockedContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  blockedText: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.semiBold,
    color: Colors.error,
    textAlign: 'center',
  },
  blockedSubText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
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
  confirmCryptoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  confirmCryptoLogo: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
  },
  confirmCryptoName: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  confirmAmountLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  confirmAmount: {
    fontSize: 48,
    fontFamily: Fonts.bold,
    color: Colors.text,
    lineHeight: 56,
  },
  confirmAmountCurrency: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    letterSpacing: 2,
    marginBottom: Spacing.md,
  },
  confirmConversionBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary + '20',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    width: '100%',
  },
  confirmConversionText: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
    flex: 1,
  },
  confirmDetailBox: {
    width: '100%',
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  confirmDetailLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    marginBottom: 2,
  },
  confirmDetailValue: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
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
