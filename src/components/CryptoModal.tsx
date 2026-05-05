import React, { useEffect, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Modal,
  Platform,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  ImageSourcePropType,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Input } from './Input';
import { ResponsiveModal } from './ResponsiveModal';
import { Button } from './Button';
import { CryptoSellDetailsModal } from './CryptoSellDetailsModal';
import { useAuthStore } from '../stores/authStore';
import { useWalletStore } from '../stores/walletStore';
import { useCryptoStore, CryptoRate } from '../stores/cryptoStore';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useResponsive } from '../hooks/useResponsive';
import api from '../services/api';
import { showAlert } from '../stores/alertStore';
import { CustomAlert } from './CustomAlert';
import { walletService } from '../services/walletService';
import type { SavedWallet } from '../types';
import { useTranslation } from 'react-i18next';

import { useConfigStore } from '../stores/configStore';
import { useCurrencyStore } from '../stores/currencyStore';
import { useFormatXof, useCurrencyCode } from '../utils/format';
import { AdminDisabledBanner } from './AdminDisabledBanner';

interface CryptoModalProps {
  visible: boolean;
  onClose: () => void;
  buyEnabled?: boolean;
  sellEnabled?: boolean;
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

export function CryptoModal({ visible, onClose, buyEnabled = true, sellEnabled = true }: CryptoModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const { isDesktop } = useResponsive();

  const user = useAuthStore((s) => s.user);
  const isAdmin = user?.group === 'admin';
  // L'admin peut toujours utiliser le service même s'il est désactivé : on affiche un bandeau d'avertissement.
  const buyAvailable = buyEnabled || isAdmin;
  const sellAvailable = sellEnabled || isAdmin;
  const fetchBalance = useWalletStore((s) => s.fetchBalance);
  const rates = useCryptoStore((s) => s.rates);
  const cryptoLoading = useCryptoStore((s) => s.loading);
  const cryptoError = useCryptoStore((s) => s.error);
  const fetchRates = useCryptoStore((s) => s.fetchRates);
  const stablecoinCodes = useConfigStore((s) => s.stablecoin_codes);
  const cryptoBuyMinDefault = useConfigStore((s) => s.crypto_buy_min_default);
  const cryptoBuyMinBtc = useConfigStore((s) => s.crypto_buy_min_btc);
  const userCurrency = useCurrencyCode();
  const convertToXof = useCurrencyStore((s) => s.convertToXof);
  const convertFromXof = useCurrencyStore((s) => s.convertFromXof);
  const formatFromXof = useCurrencyStore((s) => s.formatFromXof);
  const fmtXof = useFormatXof();

  const [tab, setTab] = useState<Tab>('buy');
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [amount, setAmount] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [sellDetailsVisible, setSellDetailsVisible] = useState(false);
  const [sellDetailsData, setSellDetailsData] = useState<any>(null);
  const [savedWallets, setSavedWallets] = useState<SavedWallet[]>([]);
  const [savedWalletsLoadError, setSavedWalletsLoadError] = useState<string | null>(null);
  const [saveWalletModalVisible, setSaveWalletModalVisible] = useState(false);
  const [saveWalletName, setSaveWalletName] = useState('');
  const [saveWalletCurrency, setSaveWalletCurrency] = useState('');
  const [saveWalletLoading, setSaveWalletLoading] = useState(false);

  const country = user?.country ?? '';
  const isSellBlocked = SELL_BLOCKED_COUNTRIES.includes(country);

  const loadSavedWallets = async () => {
    try {
      const data = await walletService.getSavedWallets();
      setSavedWallets(data);
      setSavedWalletsLoadError(null);
    } catch (error: any) {
      setSavedWalletsLoadError(t('cryptoModal.walletsLoadError'));
    }
  };

  useEffect(() => {
    if (visible) {
      fetchRates(rates.length === 0);
      setSelectedCurrency('');
      setAmount('');
      setWalletAddress('');
      setTab(buyAvailable ? 'buy' : 'sell');
      loadSavedWallets();
    }
  }, [visible]);

  // Auto-select unique active currency: when the API returns only one rate, preselect it.
  useEffect(() => {
    if (!visible) return;
    if (selectedCurrency) return;
    if (rates.length === 1 && rates[0]?.code) {
      setSelectedCurrency(rates[0].code);
    }
  }, [visible, rates, selectedCurrency]);

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
  const normalizedWalletAddress = walletAddress.trim();
  const normalizedCurrency = normalizeCurrencyCode(selectedCurrency || '');
  const walletsForSelectedCurrency = savedWallets.filter(
    (w) => !selectedCurrency || normalizeCurrencyCode(w.currency) === normalizedCurrency,
  );
  const existingSelectedWallet = savedWallets.find(
    (w) => normalizeCurrencyCode(w.currency) === normalizedCurrency && w.address === normalizedWalletAddress,
  );

  // Auto-fill only when currency or tab changes — NOT when user manually clears the address
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (tab !== 'buy') return;
    if (walletAddress.trim()) return;
    if (!selectedCurrency) return;
    const first = walletsForSelectedCurrency[0];
    if (first?.address) setWalletAddress(first.address);
  }, [tab, selectedCurrency]);

  const saveCurrentWallet = async () => {
    const address = walletAddress.trim();
    if (!address) return;

    const currencyForSave = normalizeCurrencyCode(selectedCurrency || '');
    const existing = savedWallets.find((item) => normalizeCurrencyCode(item.currency) === currencyForSave && item.address === address);
    if (existing) return;

    setSaveWalletName('');
    setSaveWalletCurrency(selectedCurrency || '');
    setSaveWalletModalVisible(true);
  };

  const confirmSaveCurrentWallet = async () => {
    const address = walletAddress.trim();
    const currencyToSave = normalizeCurrencyCode(saveWalletCurrency || '');
    if (!currencyToSave || !address) {
      showAlert(t('common.error'), t('cryptoModal.selectCurrencyFirst'));
      return;
    }

    const existing = savedWallets.find((item) => normalizeCurrencyCode(item.currency) === currencyToSave && item.address === address);
    if (existing) {
      setSaveWalletModalVisible(false);
      return;
    }

    setSaveWalletLoading(true);
    try {
      const created = await walletService.createSavedWallet({
        currency: currencyToSave,
        address,
        name: saveWalletName.trim(),
      });
      setSavedWallets((prev) => [created, ...prev]);
      setSaveWalletModalVisible(false);
      setSaveWalletName('');
      showAlert(t('common.success'), t('cryptoModal.walletSaved'));
    } catch (error: any) {
      showAlert(t('common.error'), error?.response?.data?.error || error?.response?.data?.message || t('cryptoModal.walletSaveError'));
    } finally {
      setSaveWalletLoading(false);
    }
  };

  const removeCurrentWallet = async () => {
    const address = walletAddress.trim();
    const existing = savedWallets.find((item) => normalizeCurrencyCode(item.currency) === normalizedCurrency && item.address === address);
    if (!existing) return;
    showAlert(
      t('cryptoModal.deleteWallet'),
      t('cryptoModal.deleteWalletMsg'),
      [
        { text: t('common.cancel') },
        {
          text: t('common.delete'),
          onPress: async () => {
            try {
              await walletService.deleteSavedWallet(existing.id);
              setSavedWallets((prev) => prev.filter((item) => item.id !== existing.id));
            } catch (error: any) {
              showAlert(t('common.error'), error?.response?.data?.error || error?.response?.data?.message || t('account.walletDeleteError'));
            }
          },
        },
      ],
    );
  };

  const computeConversion = (): string => {
    const numAmountRaw = parseFloat(amount);
    if (!selectedRate || !numAmountRaw || isNaN(numAmountRaw)) return '';

    const stablecoins = stablecoinCodes;
    const bubuy = stablecoins.includes(selectedCurrency) ? 1 : Number(selectedRate.live_rate);

    if (tab === 'buy') {
      // User gives display currency → converti en XOF puis formule
      const rate = getBuyRate(selectedRate);
      if (!rate) return '';
      if (!Number.isFinite(bubuy) || bubuy <= 0) return t('cryptoModal.loadingRate');
      const giveXof = userCurrency === 'XOF' ? numAmountRaw : convertToXof(numAmountRaw);
      // bubuy (live_rate) = USD par unité crypto. rate = XOF par USD. Donc crypto = (XOF/rate)/bubuy.
      const cryptoAmount = (giveXof / rate) / bubuy;
      return `${t('cryptoModal.youWillReceive')}${cryptoAmount.toFixed(8)} ${getCurrencyName(selectedCurrency)}`;
    } else {
      // User gives crypto, receives XOF → on affiche dans la devise utilisateur
      const rate = getSellRate(selectedRate);
      if (!rate) return '';
      if (!Number.isFinite(bubuy) || bubuy <= 0) return t('cryptoModal.loadingRate');
      // XOF reçu = (crypto * USD/crypto) * XOF/USD
      const xofAmount = (numAmountRaw * rate) * bubuy;
      const xofRounded = Math.round(xofAmount);
      // Affichage dans la devise utilisateur (≈ XOF si différente), comme pour l'achat
      if (userCurrency === 'XOF') {
        return `${t('cryptoModal.youWillReceive')}${fmtXof(xofRounded)}`;
      }
      const userAmount = formatFromXof(xofRounded);
      return `${t('cryptoModal.youWillReceive')}${userAmount} (≈ ${fmtXof(xofRounded)})`;
    }
  };

  function normalizeCurrencyCode(code: string): string {
    return formatCurrencyCode((code || '').trim().toUpperCase());
  }

  function resolveRateCodeFromWalletCurrency(walletCurrency: string): string {
    const normalized = normalizeCurrencyCode(walletCurrency);
    const matchedRate = rates.find((rate) => normalizeCurrencyCode(rate.code) === normalized);
    return matchedRate?.code || '';
  }

  function formatCurrencyCode(code: string): string {
    return (code || '').trim().toUpperCase();
  }

  function getCurrencyName(code: string): string {
    if (!code) return '';
    const normalized = formatCurrencyCode(code);
    const rate = rates.find((r) => formatCurrencyCode(r.code) === normalized);
    return rate?.name?.trim() || normalized;
  }

  const handlePressSubmit = () => {
    if (user?.validate !== 1) {
      showAlert(t('cryptoModal.kycRequired'), t('cryptoModal.kycRequiredMsg'));
      return;
    }

    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      showAlert(t('common.error'), t('cryptoModal.invalidAmount'));
      return;
    }
    if (!selectedCurrency) {
      showAlert(t('common.error'), t('cryptoModal.selectCrypto'));
      return;
    }
    if (tab === 'buy' && !walletAddress.trim()) {
      showAlert(t('common.error'), t('cryptoModal.enterWalletAddress'));
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
        const normalizedCurrency = formatCurrencyCode(selectedCurrency || '').trim();
        const normalizedAddress = walletAddress.trim();
        const giveXof = userCurrency === 'XOF' ? numAmount : convertToXof(numAmount);
        const response = await api.post('/crypto/buy', {
          currency: selectedCurrency,
          give: giveXof,
          address: normalizedAddress,
        });
        if (normalizedCurrency && normalizedAddress) {
          const existing = savedWallets.find((item) => item.currency === normalizedCurrency && item.address === normalizedAddress);
          if (!existing) {
            const created = await walletService.createSavedWallet({
              currency: normalizedCurrency,
              address: normalizedAddress,
              name: '',
            });
            setSavedWallets((prev) => [created, ...prev]);
          }
        }
        const result = response.data;
        await fetchBalance();

        if (result?.state === 1) {
          showAlert(t('common.success'), result?.message || t('cryptoModal.txCompleted'), [
            { text: 'OK', onPress: onClose },
          ]);
        } else {
          showAlert(t('cryptoModal.processing'), result?.message || t('cryptoModal.buyProcessing'), [
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
          showAlert(t('cryptoModal.pending'), result?.message || t('cryptoModal.completePayment'), [
            { text: 'OK', onPress: onClose },
          ]);
        } else {
          showAlert(t('common.success'), result?.message || t('cryptoModal.sellInitiated'), [
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
        t('cryptoModal.cryptoError');
      showAlert(t('common.error'), msg);
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
        t('cryptoModal.cancelTransaction'),
        t('cryptoModal.infoLost'),
        [
          { text: t('common.continue') },
          { text: t('common.quit'), onPress: onClose },
        ],
      );
    } else {
      onClose();
    }
  };

  return (
    <ResponsiveModal visible={visible} onClose={handleClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: Platform.OS === 'web' ? undefined : 1 }}
        enabled={Platform.OS !== 'web'}
      >
          <View style={[styles.sheet, { flex: Platform.OS === 'web' ? undefined : 1, paddingBottom: Math.max(insets.bottom, Spacing.lg), paddingTop: Spacing.lg }]}>
              <View style={styles.header}>
                <Text style={styles.title}>{t('transaction.crypto')}</Text>
                <TouchableOpacity onPress={handleClose}>
                  <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {buyAvailable && (
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
                {t('cryptoModal.buy')}
              </Text>
            </TouchableOpacity>
            )}
            {sellAvailable && (
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
                {t('cryptoModal.sell')}
              </Text>
            </TouchableOpacity>
            )}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            {isAdmin && !buyEnabled && !sellEnabled && (
              <AdminDisabledBanner message={t('admin.bannerCryptoBoth')} />
            )}
            {isAdmin && !buyEnabled && sellEnabled && (
              <AdminDisabledBanner message={t('admin.bannerCryptoBuy')} />
            )}
            {isAdmin && buyEnabled && !sellEnabled && (
              <AdminDisabledBanner message={t('admin.bannerCryptoSell')} />
            )}
            {user?.validate !== 1 && (
              <View style={styles.kycBanner}>
                <FontAwesome6 name="triangle-exclamation" size={14} color={Colors.warning} style={{ marginRight: 8 }} />
                <Text style={styles.kycBannerText}>{t('cryptoModal.kycBanner')}</Text>
              </View>
            )}
            {/* Sell blocked for certain countries */}
            {tab === 'sell' && isSellBlocked ? (
              <View style={styles.blockedContainer}>
                <FontAwesome6 name="triangle-exclamation" size={48} color={Colors.error} />
                <Text style={styles.blockedText}>
                  {t('cryptoModal.sellBlocked')}
                </Text>
                <Text style={styles.blockedSubText}>
                  {t('cryptoModal.sellBlockedSub')}
                </Text>
              </View>
            ) : cryptoLoading && rates.length === 0 ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={Colors.secondary} />
                <Text style={styles.loadingText}>{t('cryptoModal.loadingRates')}</Text>
              </View>
            ) : cryptoError && rates.length === 0 ? (
              <View style={styles.loadingContainer}>
                <FontAwesome6 name="triangle-exclamation" size={32} color={Colors.error} />
                <Text style={styles.loadingText}>
                  {cryptoError === 'NO_ACTIVE_CRYPTO'
                    ? t('cryptoModal.noActiveCrypto')
                    : t('cryptoModal.loadRatesError')}
                </Text>
                {cryptoError !== 'NO_ACTIVE_CRYPTO' && (
                  <Button
                    title={t('cryptoModal.retry')}
                    onPress={() => fetchRates(true)}
                    icon="rotate-right"
                    style={{ marginTop: Spacing.md }}
                  />
                )}
              </View>
            ) : (
              <>
                {/* Currency selection */}
                <Text style={styles.fieldLabel}>{t('cryptoModal.cryptocurrency')}</Text>
                {isDesktop ? (
                  <View style={styles.currencyChipGrid}>
                    {rates.map((item) => (
                      <TouchableOpacity
                        key={item.code}
                        style={[
                          styles.currencyChip,
                          selectedCurrency === item.code && styles.currencyChipSelected,
                        ]}
                        onPress={() => setSelectedCurrency(item.code)}
                      >
                        {CRYPTO_IMAGES[item.code] ? (
                          <Image source={CRYPTO_IMAGES[item.code]} style={styles.currencyChipLogo} resizeMode="contain" />
                        ) : (
                          <Text style={styles.currencyIcon}>{getCryptoIcon(item.code)}</Text>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text
                            style={[
                              styles.currencyChipCode,
                              selectedCurrency === item.code && styles.currencyChipCodeSelected,
                            ]}
                            numberOfLines={1}
                          >
                            {getCurrencyName(item.code)}
                          </Text>
                          <Text style={styles.currencyChipRate} numberOfLines={1}>
                            {tab === 'buy'
                              ? fmtXof(getBuyRate(item))
                              : fmtXof(getSellRate(item))}
                          </Text>
                        </View>
                        {selectedCurrency === item.code && (
                          <FontAwesome6 name="circle-check" size={14} color={Colors.secondary} />
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
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
                          {getCurrencyName(item.code)}
                        </Text>
                        <Text style={styles.currencyRate}>
                          {tab === 'buy'
                            ? fmtXof(getBuyRate(item))
                            : fmtXof(getSellRate(item))}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                )}

                {/* Amount */}
                <Input
                  label={tab === 'buy' ? t('cryptoModal.amountToPay', { currency: userCurrency }) : t('cryptoModal.amountIn', { currency: getCurrencyName(selectedCurrency) || 'crypto' })}
                  placeholder={tab === 'buy' ? `Min. ${fmtXof(selectedCurrency === 'BTC' ? cryptoBuyMinBtc : cryptoBuyMinDefault)}` : t('cryptoModal.exCryptoAmount')}
                  value={amount}
                  onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
                  keyboardType="numeric"
                />

                {/* Conversion preview */}
                {conversion ? (
                  <View style={styles.conversionBox}>
                    <FontAwesome6 name="arrows-rotate" size={14} color={Colors.primary} />
                    <Text style={styles.conversionText}>{conversion}</Text>
                    {conversion.includes(t('cryptoModal.loadingRate')) && (
                      <TouchableOpacity onPress={() => fetchRates(true)} style={styles.reloadBtn}>
                        <FontAwesome6 name="rotate-right" size={14} color={Colors.white} />
                      </TouchableOpacity>
                    )}
                  </View>
                ) : null}

                {/* Wallet address for buy */}
                {tab === 'buy' && (
                  <>
                    <Input
                      label={t('cryptoModal.walletAddressLabel')}
                      placeholder={t('cryptoModal.walletAddressPlaceholder')}
                      value={walletAddress}
                      onChangeText={setWalletAddress}
                      autoCapitalize="none"
                    />

                    {!!normalizedWalletAddress && (
                      <Button
                        variant="secondary"
                        icon="bookmark"
                        title={t('account.addWallet')}
                        onPress={saveCurrentWallet}
                        style={styles.saveBtnSmall}
                        textStyle={styles.saveBtnText}
                      />
                    )}

                    {walletsForSelectedCurrency.length > 0 && (
                      <View style={styles.savedBlock}>
                        <Text style={styles.savedLabel}>{t('account.savedWallets')}</Text>
                        <View style={styles.savedList}>
                          {walletsForSelectedCurrency.map((item) => {
                            const selected = !!walletAddress.trim() && walletAddress.trim() === item.address.trim();
                            return (
                              <TouchableOpacity
                                key={item.id}
                                style={[styles.savedChip, selected && styles.savedChipSelected]}
                                onPress={() => {
                                  if (selected) {
                                    setWalletAddress('');
                                    return;
                                  }

                                  setWalletAddress(item.address);
                                  if (!selectedCurrency) {
                                    const resolved = resolveRateCodeFromWalletCurrency(item.currency);
                                    if (resolved) setSelectedCurrency(resolved);
                                  }
                                }}
                              >
                                <Text style={[styles.savedChipText, selected && styles.savedChipTextSelected]} numberOfLines={1}>
                                  {item.name?.trim() ? `${item.name} · ` : ''}{getCurrencyName(item.currency)}: {item.address}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </View>
                    )}

                    {savedWalletsLoadError && walletsForSelectedCurrency.length === 0 && (
                      <Text style={styles.savedErrorText}>{savedWalletsLoadError}</Text>
                    )}

                    <View style={styles.savedActionsRow}>
                      {!!existingSelectedWallet && (
                        <TouchableOpacity style={styles.savedActionBtn} onPress={removeCurrentWallet}>
                          <FontAwesome6 name="trash" size={12} color={Colors.error} />
                          <Text style={[styles.savedActionText, { color: Colors.error }]}>{t('common.delete')}</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </>
                )}

                {/* Submit */}
                <Button
                  title={tab === 'buy' ? t('cryptoModal.buy') : t('cryptoModal.sell')}
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
          </View>
      </KeyboardAvoidingView>

      {/* Modal de confirmation */}
      <Modal visible={confirmVisible} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>
              {tab === 'buy' ? t('cryptoModal.confirmBuy') : t('cryptoModal.confirmSell')}
            </Text>
            <Text style={styles.confirmSubtitle}>{t('cryptoModal.confirmSubtitle')}</Text>

            {/* Crypto icon + name */}
            {selectedRate && (
              <View style={styles.confirmCryptoRow}>
                {CRYPTO_IMAGES[selectedCurrency] ? (
                  <Image source={CRYPTO_IMAGES[selectedCurrency]} style={styles.confirmCryptoLogo} resizeMode="contain" />
                ) : null}
                <Text style={styles.confirmCryptoName}>{getCurrencyName(selectedCurrency)}</Text>
              </View>
            )}

            {tab === 'buy' ? (
              <>
                <Text style={styles.confirmAmountLabel}>{t('cryptoModal.amountToPayLabel')}</Text>
                <Text style={styles.confirmAmount}>{parseFloat(amount || '0').toLocaleString('fr-FR').replace(/\s/g, '.')}</Text>
                <Text style={styles.confirmAmountCurrency}>{userCurrency}</Text>
              </>
            ) : (
              <>
                <Text style={styles.confirmAmountLabel}>{t('cryptoModal.amountToSellLabel')}</Text>
                <Text style={styles.confirmAmount}>{amount}</Text>
                <Text style={styles.confirmAmountCurrency}>{getCurrencyName(selectedCurrency)}</Text>
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
                <Text style={styles.confirmDetailLabel}>{t('cryptoModal.receivingAddress')}</Text>
                <Text style={styles.confirmDetailValue} numberOfLines={2}>{walletAddress}</Text>
              </View>
            ) : null}

            {/* Rate info */}
            {selectedRate && (
              <View style={styles.confirmDetailBox}>
                <Text style={styles.confirmDetailLabel}>{t('cryptoModal.appliedRate')}</Text>
                <Text style={styles.confirmDetailValue}>
                  $1 = {fmtXof(tab === 'buy' ? getBuyRate(selectedRate) : getSellRate(selectedRate))}
                </Text>
              </View>
            )}

            {/* Checkbox confirmation */}
            <TouchableOpacity style={styles.checkRow} onPress={() => setConfirmed((v) => !v)}>
              <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
                {confirmed && <FontAwesome6 name="check" size={10} color={Colors.white} />}
              </View>
              <Text style={styles.checkLabel}>{t('cryptoModal.confirmCorrect')}</Text>
            </TouchableOpacity>

            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmVisible(false)}>
                <Text style={styles.cancelBtnText}>{t('cryptoModal.edit')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, !confirmed && styles.confirmBtnDisabled]}
                onPress={confirmed ? handleConfirm : undefined}
              >
                <FontAwesome6 name={tab === 'buy' ? 'coins' : 'circle-dollar-to-slot'} size={14} color={Colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.confirmBtnText}>{t('cryptoModal.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {saveWalletModalVisible && (
        <View style={styles.confirmOverlay}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={() => setSaveWalletModalVisible(false)} activeOpacity={1} />
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>{t('account.addWallet')}</Text>
            <Text style={styles.confirmSubtitle}>{t('cryptoModal.saveWalletSubtitle')}</Text>

            {/* Sélecteur de monnaie */}
            <Text style={styles.saveWalletLabel}>{t('cryptoModal.selectCurrency')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.saveWalletCurrencyScroll} contentContainerStyle={{ gap: Spacing.xs, paddingVertical: Spacing.xs }}>
              {rates.map((item) => {
                const code = normalizeCurrencyCode(item.code);
                const isSelected = normalizeCurrencyCode(saveWalletCurrency) === code;
                return (
                  <TouchableOpacity
                    key={item.code}
                    style={[styles.saveWalletChip, isSelected && styles.saveWalletChipSelected]}
                    onPress={() => setSaveWalletCurrency(item.code)}
                  >
                    {CRYPTO_IMAGES[item.code] ? (
                      <Image source={CRYPTO_IMAGES[item.code]} style={{ width: 16, height: 16 }} resizeMode="contain" />
                    ) : null}
                    <Text style={[styles.saveWalletChipText, isSelected && styles.saveWalletChipTextSelected]}>
                      {getCurrencyName(item.code)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <Input
              label={t('cryptoModal.nameLabel')}
              placeholder={t('cryptoModal.namePlaceholder')}
              value={saveWalletName}
              onChangeText={setSaveWalletName}
              containerStyle={{ width: '100%' }}
            />
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSaveWalletModalVisible(false)}>
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirmSaveCurrentWallet} disabled={saveWalletLoading}>
                <FontAwesome6 name="floppy-disk" size={14} color={Colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.confirmBtnText}>{saveWalletLoading ? t('common.saving') : t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

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
    </ResponsiveModal>
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

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
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
  sheet: {
    backgroundColor: Colors.background,
    padding: Spacing.lg,
    overflow: 'hidden',
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
  currencyGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  currencyChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  currencyChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    minWidth: 150,
    flex: 1,
  },
  currencyChipSelected: {
    borderColor: Colors.secondary,
    backgroundColor: 'rgba(244,178,40,0.12)',
  },
  currencyChipLogo: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  currencyChipCode: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  currencyChipCodeSelected: {
    color: Colors.secondary,
  },
  currencyChipRate: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  currencyCard: {
    width: 90,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
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
  savedBlock: {
    marginBottom: Spacing.md,
  },
  savedLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    marginBottom: Spacing.xs,
  },
  savedList: {
    gap: Spacing.xs,
  },
  savedChip: {
    backgroundColor: Colors.inputBg,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
  },
  savedChipSelected: {
    borderColor: Colors.secondary,
    backgroundColor: 'rgba(244,178,40,0.12)',
  },
  savedChipText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
  },
  savedChipTextSelected: {
    color: Colors.secondary,
  },
  savedActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
  },
  savedActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  savedActionBtnBelowInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
  },
  savedActionText: {
    color: Colors.secondary,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
  },
  saveBtnSmall: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    minHeight: 28,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  saveBtnText: {
    fontSize: FontSize.xs,
  },
  savedErrorText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    marginBottom: Spacing.sm,
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
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
    zIndex: 999,
  },
  confirmSheet: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '100%',
    maxWidth: 480,
    alignItems: 'center',
  },
  saveWalletLabel: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
    alignSelf: 'flex-start',
    marginBottom: Spacing.xs,
  },
  saveWalletCurrencyScroll: {
    width: '100%',
    marginBottom: Spacing.md,
  },
  saveWalletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.pill,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.inputBg,
  },
  saveWalletChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  saveWalletChipText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
  },
  saveWalletChipTextSelected: {
    color: Colors.white,
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
