import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
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
  Linking,
  ActivityIndicator,
  AppState,
} from 'react-native';
import { ResponsiveModal } from './ResponsiveModal';
import { FontAwesome6 } from '@expo/vector-icons';
import { Input } from './Input';
import { Button } from './Button';
import { walletService } from '../services/walletService';
import api from '../services/api';
import { useWalletStore } from '../stores/walletStore';
import { useAuthStore } from '../stores/authStore';
import { OPERATORS, FINCRA_ZONES, operatorServesCountry } from '../constants/config';
import { useCatalogStore } from '../stores/catalogStore';
import { ALL_COUNTRIES } from '../constants/countries';
import { useCorridorStore } from '../stores/corridorStore';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useResponsive } from '../hooks/useResponsive';
import { showAlert } from '../stores/alertStore';
import { CustomAlert } from './CustomAlert';
import type { SavedPhone } from '../types';
import { useTranslation } from 'react-i18next';

import { useConfigStore } from '../stores/configStore';
import { useCurrencyStore } from '../stores/currencyStore';
import { useCryptoStore } from '../stores/cryptoStore';
import { useFormatXof, useCurrencyCode } from '../utils/format';
import { useFincraRate } from '../stores/fincraRateStore';
import { getApiErrorMessage } from '../utils/apiError';
import { formatFincraPhone, resolveFincraZone, type FincraCollectionRail } from '../utils/fincraPhone';
import { AdminDisabledBanner } from './AdminDisabledBanner';
import { TransactionAlertBanner } from './TransactionAlertBanner';
import { GatewayBadge } from './GatewayBadge';
import { CountryPickerStep } from './CountryPickerStep';
import { OperatorLogo } from './OperatorLogo';
import { pickCryptoSource } from '../utils/cryptoLogos';

interface DepositModalProps {
  visible: boolean;
  onClose: () => void;
  prefill?: { amount?: string; operator?: string; phone?: string };
  /** Affiche le groupe « Crypto-monnaies » (vente) dans le dépôt. */
  cryptoEnabled?: boolean;
  /** Lance le flux de vente crypto (crédite le wallet) pour la crypto choisie. */
  onSellCrypto?: (currency?: string) => void;
}

export function DepositModal({ visible, onClose, prefill, cryptoEnabled = false, onSellCrypto }: DepositModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const { isDesktop, isWide } = useResponsive();

  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  // Sous-pays Fincra : pour XOF/XAF, l'utilisateur choisit son pays (et son
  // indicatif téléphonique) dans la zone. Reset à null quand l'op change.
  const [fincraZoneCountry, setFincraZoneCountry] = useState<string | null>(null);
  // « Autres » : sous-liste des zones internationales (Fincra) + carte, pour les
  // pays non couverts par un moyen local.
  const [othersOpen, setOthersOpen] = useState(false);
  // « Crypto-monnaies » : sous-liste des cryptos actives (vente → crédite le wallet).
  const [cryptoOpen, setCryptoOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [pollingState, setPollingState] = useState<'idle' | 'pending' | 'success' | 'failed' | 'timeout'>('idle');
  const [pollingMessage, setPollingMessage] = useState('');
  // Si Safari bloque window.open malgré le user-gesture (cas connu avec RN Web),
  // on expose un vrai <a target="_blank"> dans la modal — cliquable manuellement.
  const [manualPaymentUrl, setManualPaymentUrl] = useState<string | null>(null);
  // Fincra direct-charge bank_transfer : virtual account à afficher en attendant le virement.
  const [bankTransferInfo, setBankTransferInfo] = useState<{
    bankName: string;
    accountNumber: string;
    accountName: string;
    amountNet: number;       // Montant demandé par l'utilisateur (crédité au wallet)
    fee: number;             // Frais Fincra
    vat: number;             // TVA
    amountExpected: number;  // Total à virer = net + fee + vat (+ taxes éventuelles)
    currency: string;
  } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingDepositIdRef = useRef<number | null>(null);
  const pollingRefRef = useRef<string | null>(null);
  const consecutiveErrorsRef = useRef(0);
  const fetchBalance = useWalletStore((s) => s.fetchBalance);
  const user = useAuthStore((s) => s.user);
  const depositMin = useConfigStore((s) => s.deposit_min);
  const depositMax = useConfigStore((s) => s.deposit_max);
  const cryptoRates = useCryptoStore((s) => s.rates);
  const fetchCryptoRates = useCryptoStore((s) => s.fetchRates);
  const userCurrency = useCurrencyCode();
  const convertToXof = useCurrencyStore((s) => s.convertToXof);
  const currencyRates = useCurrencyStore((s) => s.rates);
  const fmtXof = useFormatXof();
  // Garde une trace si l'utilisateur a vidé/modifié le champ téléphone manuellement
  const phoneUserEditedRef = useRef(false);
  // Numéros enregistrés (type deposit)
  const [savedPhones, setSavedPhones] = useState<SavedPhone[]>([]);
  const [savedPhonesLoadError, setSavedPhonesLoadError] = useState<string | null>(null);
  const [savePhoneModalVisible, setSavePhoneModalVisible] = useState(false);
  const [savePhoneName, setSavePhoneName] = useState('');
  const [savePhoneOperator, setSavePhoneOperator] = useState('');
  const [savePhoneLoading, setSavePhoneLoading] = useState(false);

  // Réinitialise les champs à chaque ouverture et pré-remplit le téléphone profil
  useEffect(() => {
    if (!visible) return;
    setAmount(prefill?.amount ?? '');
    setOperator(prefill?.operator ?? '');
    setSelectedCountry(null);
    setFincraZoneCountry(null);
    setOthersOpen(false);
    setCryptoOpen(false);
    setOtp('');
    setPollingState('idle');
    setPollingMessage('');
    setManualPaymentUrl(null);
    setBankTransferInfo(null);
    setCopiedField(null);
    setSavedPhones([]);
    setSavedPhonesLoadError(null);
    setSavePhoneModalVisible(false);
    setSavePhoneName('');
    setSavePhoneOperator('');
    phoneUserEditedRef.current = false;
    const defaultPhone = prefill?.phone ?? (user?.phone ?? '').trim();
    setPhone(defaultPhone);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset le sous-pays Fincra à chaque changement d'opérateur.
  useEffect(() => { setFincraZoneCountry(null); }, [operator]);

  // Charge les taux crypto quand on ouvre le groupe « Crypto-monnaies ».
  useEffect(() => { if (cryptoOpen) fetchCryptoRates(cryptoRates.length === 0); }, [cryptoOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    pollingDepositIdRef.current = null;
    pollingRefRef.current = null;
    consecutiveErrorsRef.current = 0;
  }, []);

  // Vérification unique du statut (utilisée par le polling et au retour foreground)
  const checkStatus = useCallback(async (depositId: number): Promise<boolean> => {
    try {
      // Fincra : check directement auprès de Fincra via la référence
      const fincraRef = pollingRefRef.current;
      if (fincraRef && fincraRef.startsWith('FCD-')) {
        const fRes = await walletService.getFincraDepositStatus(fincraRef);
        consecutiveErrorsRef.current = 0;
        if (fRes.status === 'success') {
          stopPolling(); setPollingState('success'); fetchBalance().catch(() => {}); return true;
        } else if (fRes.status === 'fail') {
          stopPolling(); setPollingState('failed'); return true;
        }
        return false;
      }
      const res = await walletService.getDepositStatus(depositId);
      consecutiveErrorsRef.current = 0;
      if (res.statut === 'success') {
        stopPolling();
        setPollingState('success');
        fetchBalance().catch(() => {});
        return true;
      } else if (res.statut === 'fail' || res.statut === 'failed') {
        stopPolling();
        setPollingState('failed');
        setPollingMessage(t('depositModal.paymentFailed'));
        return true;
      }
    } catch (err: any) {
      consecutiveErrorsRef.current++;
      // Après 5 erreurs consécutives → timeout
      if (consecutiveErrorsRef.current >= 5) {
        stopPolling();
        setPollingState('timeout');
        setPollingMessage('');
        return true;
      }
    }
    return false;
  }, [fetchBalance, stopPolling]);

  const startPolling = useCallback((depositId: number) => {
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // 5 min max (toutes les 5s)
    setPollingState('pending');
    pollingDepositIdRef.current = depositId;
    consecutiveErrorsRef.current = 0;

    const poll = async () => {
      attempts++;
      const resolved = await checkStatus(depositId);
      if (resolved) return;
      if (attempts >= MAX_ATTEMPTS) {
        stopPolling();
        setPollingState('timeout');
        setPollingMessage('');
      }
    };

    // Poll immédiatement, puis toutes les 5s
    poll();
    pollingRef.current = setInterval(poll, 5000);
  }, [checkStatus, stopPolling]);

  // Quand l'app revient au premier plan, vérifier immédiatement le statut
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && pollingDepositIdRef.current && pollingState === 'pending') {
        checkStatus(pollingDepositIdRef.current);
      }
    });
    return () => sub.remove();
  }, [checkStatus, pollingState]);

  // Sur web : vérifier au retour sur l'onglet (setInterval throttled quand onglet inactif)
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && pollingDepositIdRef.current && pollingState === 'pending') {
        checkStatus(pollingDepositIdRef.current);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [checkStatus, pollingState]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  // Filter operators by user's country (admins and unvalidated users see all)
  const userCountry = user?.country ?? '';
  const isAdmin = user?.group === 'admin';
  const isKycValidated = user?.validate === 1;
  const afribapayEnabled = useConfigStore((s) => s.afribapay_enabled);
  const depositEnabled = useConfigStore((s) => s.deposit_enabled);
  // Admin bypass : voit toutes les passerelles, y compris désactivées (bandeau rouge en haut).
  // Fincra USD/EUR/GBP : payout-only (SWIFT/SEPA) — Fincra ne supporte pas le checkout
  // pour ces devises. On les exclut du DepositModal pour éviter un 500 backend.
  // Corridors server-driven (aggregator_routing) : masquage payin temps réel.
  const corridorsLoaded = useCorridorStore((s) => s.isLoaded);
  const isCodeEnabled = useCorridorStore((s) => s.isCodeEnabled);
  // Référentiel serveur (P3) : opérateurs construits depuis /catalog (admin Marchés).
  // Fallback sur la liste statique config.ts tant que le catalogue n'est pas chargé.
  const catalogOperators = useCatalogStore((s) => s.operators);
  const catalogZones = useCatalogStore((s) => s.zones);
  const catalogDial = useCatalogStore((s) => s.dialByCode);
  const OPERATORS_SRC: any[] = catalogOperators.length ? catalogOperators : (OPERATORS as any);

  // Plus de dédup statique PayDunya : la visibilité d'un moyen dépend UNIQUEMENT
  // de son corridor activé dans le routing admin (isCodeEnabled). L'admin n'active
  // qu'un seul agrégateur par (pays, réseau), donc un seul moyen visible par opérateur.
  // Fallback statique tant que les corridors ne sont pas chargés (évite un écran vide).
  const operatorsBase = OPERATORS_SRC.filter((op) => {
    if (!corridorsLoaded && !afribapayEnabled && !isAdmin && (op as any).afribapay) return false;
    return true;
  });
  // "Has mobile money for country" : on accepte op.country === userCountry OU
  // op.countries[] inclut userCountry (zones Fincra XOF/XAF).
  const hasMomoForCountry = operatorsBase.some((op) => op.id !== 'card' && operatorServesCountry(op as any, userCountry || ''));
  const showCard = isAdmin || !isKycValidated || !hasMomoForCountry;
  const filteredOperators = (isAdmin || !isKycValidated)
    ? [...operatorsBase]
    : [
        ...operatorsBase.filter(
          (op) => operatorServesCountry(op as any, userCountry || '') && (isAdmin || isCodeEnabled(op.id, 'payin'))
        ),
        ...(showCard ? operatorsBase.filter((op) => op.id === 'card') : []),
      ];
  const displayOperators = filteredOperators.length > 0 ? filteredOperators : operatorsBase;

  // Étape pays uniquement en mode admin (les utilisateurs réguliers ont déjà une liste filtrée par pays).
  const useCountryStep = isAdmin;

  // « Autres » regroupe les rails NON rattachés à un pays unique :
  // - Carte bancaire générique (KKiapay)
  // - Zones multi-pays Fincra (UEMOA/XOF, CEMAC/XAF)
  // - Devises internationales Fincra (EUR/USD/GBP)
  const ZONE_CURRENCIES = ['XOF', 'XAF', 'EUR', 'USD', 'GBP'];
  const isZoneFincra = (op: any) => !!op.fincra && ZONE_CURRENCIES.includes(op.currency);
  const isOtherOp = (op: any) => op.id === 'card' || isZoneFincra(op);
  // Libellé enrichi affiché dans « Autres » pour distinguer les rails zone/devise
  // (ex: deux "Mobile Money" → "Mobile Money (UEMOA · XOF)" vs "Mobile Money (CEMAC · XAF)").
  const operatorOthersLabel = (op: any): string => {
    if (!op?.fincra) return op?.name ?? '';
    const cur = op.currency as string;
    const zoneTag = cur === 'XOF' ? 'UEMOA · XOF'
                  : cur === 'XAF' ? 'CEMAC · XAF'
                  : cur;
    // On n'ajoute la devise dans le nom que si pas déjà présente.
    return (op.name as string).includes(cur) ? op.name : `${op.name} (${zoneTag})`;
  };
  const otherOps = operatorsBase.filter(isOtherOp);

  const baseForStep = useCountryStep
    ? (selectedCountry ? displayOperators.filter((op) => operatorServesCountry(op as any, selectedCountry)) : [])
    : displayOperators;
  // La liste du pays inclut les Fincra de zone (XOF/XAF) qui servent ce pays —
  // visibles directement (Mobile Money + Carte) quand leur corridor est actif
  // dans le routing. Ils restent AUSSI listés sous « Autres » (zone). Seule la
  // carte générique (PayDunya INTL) est réservée à « Autres ».
  const primaryOps = baseForStep.filter((op) => op.id !== 'card');
  const operatorsForStep = othersOpen ? otherOps : primaryOps;
  // Entrée « Autres » : accessible uniquement depuis le picker pays initial.
  // Une fois un pays sélectionné, on n'affiche QUE ses opérateurs (pas de bouton
  // "Autres" qui sortirait du contexte pays).
  const showOthersEntry = otherOps.length > 0 && !selectedCountry && (showCard || primaryOps.length === 0);

  const needsOtp = ['orange-money-burkina', 'orange-money-ci', 'orange-money-senegal', 'orange-gn'].includes(operator);
  const selectedOp = OPERATORS_SRC.find((op) => op.id === operator);
  const isFincra = !!(selectedOp as any)?.fincra;
  // Routing Fincra : le rail est désormais porté directement par l'opérateur
  // (cf. OPERATORS dans config.ts). 1 opérateur = 1 rail, plus de sélecteur.
  const fincraCurrency = isFincra ? ((selectedOp as any)?.currency || 'XOF') : '';
  const fincraMethod: FincraCollectionRail | null = isFincra
    ? ((selectedOp as any)?.rail as FincraCollectionRail) ?? null
    : null;
  const isFincraBT = fincraMethod === 'bank_transfer';
  const isFincraMM = fincraMethod === 'mobile_money';
  const isFincraCH = fincraMethod === 'checkout';
  // Pour Fincra MM en zone XOF/XAF, le sous-pays est nécessaire pour l'indicatif.
  // Mais si le pays est DÉJÀ connu (étape pays admin, ou pays de l'utilisateur),
  // on le déduit du contexte et on n'affiche plus la liste de sous-pays.
  // Sous-pays + indicatifs depuis le catalogue Marchés (fallback config statique).
  const fincraZoneList = isFincraMM ? (catalogZones[fincraCurrency] ?? FINCRA_ZONES[fincraCurrency]) : undefined;
  const contextCountry = ((useCountryStep ? selectedCountry : user?.country) || '').toUpperCase();
  const zoneHasContext = !!fincraZoneList?.some((c) => c.code === contextCountry);
  const fincraDialCode = isFincraMM
    ? ((fincraZoneCountry && catalogDial[fincraZoneCountry]) || resolveFincraZone(fincraCurrency, fincraZoneCountry).dialCode)
    : undefined;
  // Indicatif générique (PayDunya / AfribaPay…) : dérivé du pays de l'opérateur
  // (sinon du contexte). Affiché en prefix du champ téléphone pour que
  // l'utilisateur ne le ressaisisse pas. Catalogue Marchés > liste statique.
  const phonePrefix = useMemo(() => {
    if (isFincraMM) return fincraDialCode ? `+${fincraDialCode}` : undefined;
    const code = (((selectedOp as any)?.country as string) || contextCountry || '').toUpperCase();
    if (!code) return undefined;
    const fromCatalog = catalogDial[code];
    if (fromCatalog) return `+${fromCatalog}`;
    const c = ALL_COUNTRIES.find((x) => x.code === code);
    return c ? `+${c.phone}` : undefined;
  }, [isFincraMM, fincraDialCode, selectedOp, contextCountry, catalogDial]);
  // Auto-sélectionne le sous-pays Fincra depuis le contexte (pays déjà connu).
  useEffect(() => {
    if (isFincraMM && zoneHasContext && fincraZoneCountry !== contextCountry) {
      setFincraZoneCountry(contextCountry);
    }
  }, [isFincraMM, zoneHasContext, contextCountry, fincraZoneCountry]);
  // isCard : flows hosted (vraie carte PayDunya + Fincra forex checkout).
  // Fincra MM utilise le champ téléphone, Fincra BT n'a besoin de rien.
  const isCard = operator === 'card' || isFincraCH;
  // Champ téléphone : affiché sauf pour les flows hosted ET Fincra BT (qui n'en a pas besoin).
  const showPhoneField = !isCard && !isFincraBT;

  const normalizedPhone = phone.replace(/\s+/g, '').trim();

  // L'utilisateur saisit dans la devise de son compte (XOF, GHS, NGN…). On
  // convertit ce montant vers la devise Fincra (NGN, GHS…) pour ce que Fincra
  // encaisse réellement. wallet_fincra reste crédité en XOF.
  //
  // Cas spécial : si userCurrency === fincraCurrency (ex : compte GHS + opérateur
  // Fincra Ghana), le montant saisi EST déjà le montant à payer côté Fincra —
  // aucune double-conversion (qui causerait une perte sur la triangulation).
  const numAmountDisplayLive = parseFloat(amount) || 0;
  const numAmountXofLive = userCurrency === 'XOF'
    ? Math.round(numAmountDisplayLive)
    : convertToXof(numAmountDisplayLive);
  const fincraRate = useFincraRate(fincraCurrency, isFincra);
  // Montant à encaisser côté Fincra (devise Fincra).
  const fincraChargeAmount =
    isFincra && numAmountDisplayLive > 0
      ? (userCurrency === fincraCurrency
          ? numAmountDisplayLive
          : fincraCurrency === 'XOF'
              ? numAmountXofLive
              : (fincraRate.rate && fincraRate.rate > 0
                  ? Math.round((numAmountXofLive / fincraRate.rate) * 100) / 100
                  : null))
      : null;
  const fincraRateBlocking =
    isFincra && fincraCurrency !== 'XOF' && userCurrency !== fincraCurrency && numAmountDisplayLive > 0
    && (fincraRate.loading || fincraRate.error || fincraRate.rate === null);
  // Flux classiques : pour un user non-XOF, si le taux global manque, la
  // conversion retomberait silencieusement en 1:1 (montant erroné). On bloque.
  const classicRateBlocking =
    !isFincra && userCurrency !== 'XOF' && !((currencyRates[userCurrency] ?? 0) > 0);

  // Charge les numéros enregistrés pour cet opérateur dès qu'un opérateur non-card est sélectionné
  useEffect(() => {
    if (!visible || operator === 'card') {
      setSavedPhones([]);
      return;
    }
    walletService.getSavedPhones({ type: 'deposit' }).then((data) => {
      setSavedPhones(data);
      setSavedPhonesLoadError(null);
    }).catch((error: any) => {
      setSavedPhonesLoadError(t('account.phonesLoadError'));
    });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveCurrentPhone = () => {
    if (!normalizedPhone) return;
    const existing = savedPhones.find((item) => item.tel.replace(/\s+/g, '') === normalizedPhone);
    if (existing) return;
    setSavePhoneName('');
    setSavePhoneOperator(operator);
    setSavePhoneModalVisible(true);
  };

  const removeCurrentPhone = () => {
    const existing = savedPhones.find((item) => item.tel.replace(/\s+/g, '') === normalizedPhone);
    if (!existing) return;
    showAlert(
      t('account.deletePhoneConfirm'),
      t('account.deletePhoneMsg'),
      [
        { text: t('common.cancel') },
        {
          text: t('common.delete'),
          onPress: async () => {
            try {
              await walletService.deleteSavedPhone(existing.id);
              setSavedPhones((prev) => prev.filter((item) => item.id !== existing.id));
            } catch (error: any) {
              showAlert(t('common.error'), error?.response?.data?.error || error?.response?.data?.message || t('account.phoneDeleteError'));
            }
          },
        },
      ],
    );
  };

  const confirmSaveCurrentPhone = async () => {
    if (!normalizedPhone || !savePhoneOperator) {
      showAlert(t('common.error'), t('depositModal.selectOperator'));
      return;
    }
    const existing = savedPhones.find((item) => item.tel.replace(/\s+/g, '') === normalizedPhone);
    if (existing) { setSavePhoneModalVisible(false); return; }
    setSavePhoneLoading(true);
    try {
      const created = await walletService.createSavedPhone({
        tel: normalizedPhone,
        name: savePhoneName.trim(),
        type: 'deposit',
        operator: savePhoneOperator,
      });
      setSavedPhones((prev) => [created, ...prev]);
      setPhone(normalizedPhone);
      setSavePhoneModalVisible(false);
      setSavePhoneName('');
      showAlert(t('common.success'), t('depositModal.phoneSaved'));
    } catch (error: any) {
      showAlert(t('common.error'), error?.response?.data?.error || error?.response?.data?.message || t('depositModal.phoneSaveError'));
    } finally {
      setSavePhoneLoading(false);
    }
  };

  const handleClose = () => {
    // Afficher confirmation seulement si l'utilisateur a tapé du texte (montant, téléphone ou OTP)
    const hasUserInput = !!amount.trim() || !!phone.trim() || !!otp.trim();
    if (hasUserInput) {
      showAlert(
        t('depositModal.cancelDeposit'),
        t('depositModal.infoLost'),
        [
          { text: t('common.continue') },
          { text: t('common.quit'), onPress: onClose },
        ],
      );
    } else {
      onClose();
    }
  };

  const handleDeposit = async () => {
    const numAmountDisplay = parseFloat(amount);
    // Montant XOF (devise du compte) saisi par l'utilisateur.
    const numAmountXof = userCurrency === 'XOF'
      ? Math.round(numAmountDisplay || 0)
      : convertToXof(numAmountDisplay || 0);
    // Pour Fincra, on transmet le montant dans la devise Fincra (XOF converti
    // via le taux Fincra) : c'est ce que Fincra encaisse. Sinon, XOF.
    const numAmount = isFincra ? (fincraChargeAmount ?? 0) : numAmountXof;
    if (!numAmountXof || (!isFincra && numAmountXof < depositMin)) {
      showAlert(
        t('common.error'),
        `${t('depositModal.minAmount')} ${fmtXof(depositMin)}`
      );
      return;
    }
    if (depositMax > 0 && numAmountXof > depositMax) {
      showAlert(
        t('common.error'),
        `${t('depositModal.maxAmount')} ${fmtXof(depositMax)}`
      );
      return;
    }
    if (fincraRateBlocking || classicRateBlocking || (isFincra && !numAmount)) {
      showAlert(t('common.error'), t('common.rateUnavailable'));
      return;
    }
    if (!operator) {
      showAlert(t('common.error'), t('depositModal.selectOperator'));
      return;
    }
    if (showPhoneField && !phone.trim()) {
      showAlert(t('common.error'), t('account.enterPhoneNumber'));
      return;
    }
    setLoading(true);
    setBankTransferInfo(null);
    setManualPaymentUrl(null);
    // Pré-ouvre le popup AVANT le await — les browsers bloquent window.open
    // hors d'un gesture utilisateur. Seuls les flows hosted (vraie card + Fincra checkout)
    // ont besoin d'une nouvelle fenêtre. Fincra BT/MM affichent les infos in-modal.
    let cardWindow: Window | null = null;
    if (isCard && Platform.OS === 'web' && typeof window !== 'undefined') {
      cardWindow = window.open('about:blank', '_blank');
    }
    try {
      let result: any;
      if (isFincra) {
        const fincraPayload: any = {
          amount: numAmount,
          currency: fincraCurrency,
          method: fincraMethod,
        };
        if (isFincraMM) {
          // Operator par défaut le plus utilisé du pays. Pourra évoluer en
          // sélecteur dédié si besoin (MTN/Vodafone/AirtelTigo pour Ghana).
          const defaultOp = fincraCurrency === 'GHS' ? 'MTN'
                          : fincraCurrency === 'KES' ? 'MPESA'
                          : fincraCurrency === 'UGX' ? 'MTN'
                          : fincraCurrency === 'ZMW' ? 'MTN'
                          : fincraCurrency === 'TZS' ? 'AIRTEL'
                          : fincraCurrency === 'EGP' ? 'AIRTEL'
                          : fincraCurrency === 'XOF' ? 'MTN'
                          : fincraCurrency === 'XAF' ? 'MTN'
                          : null;
          // Fincra Direct Charge MM exige l'indicatif AVEC `+` (ex: +233700000000).
          fincraPayload.operator = defaultOp;
          fincraPayload.phone    = formatFincraPhone(phone, fincraDialCode || '', true);
        }
        const { data } = await api.post('/deposit/fincra', fincraPayload);
        result = { deposit_id: data.deposit_id, reference: data.reference };
        if (isFincraCH) {
          result.checkout_url = data.payment_url;
        } else if (isFincraBT) {
          const va = data?.data?.virtualAccount || {};
          const amt = Number(data?.data?.amount ?? numAmount);
          const fee = Number(data?.data?.fee ?? 0);
          const vat = Number(data?.data?.vat ?? 0);
          const emtl = Number(data?.data?.electronicMoneyTransferLevy ?? 0);
          const total = Number(data?.data?.amountExpected ?? (amt + fee + vat + emtl));
          setBankTransferInfo({
            bankName:       va.bankName       ?? '',
            accountNumber:  va.accountNumber  ?? '',
            accountName:    va.accountName    ?? '',
            amountNet:      amt,
            fee:            fee + emtl,
            vat:            vat,
            amountExpected: total,
            currency:       fincraCurrency,
          });
        }
      } else {
        const payload: any = { amount: numAmount, moyen: operator };
        if (!isCard) payload.tel = phone.trim();
        if (needsOtp && otp) payload.otp = otp;
        result = await walletService.deposit(payload);
      }

      const redirectUrl = result?.checkout_url || result?.url;
      if (redirectUrl) {
        if (cardWindow && !cardWindow.closed) {
          cardWindow.location.href = redirectUrl;
        } else if (Platform.OS === 'web' && typeof window !== 'undefined') {
          const opened = window.open(redirectUrl, '_blank');
          if (!opened) setManualPaymentUrl(redirectUrl);
        } else {
          Linking.openURL(redirectUrl).catch(() => {});
        }
      } else if (cardWindow && !cardWindow.closed) {
        cardWindow.close();
      }

      if (result?.deposit_id) {
        pollingRefRef.current = result.reference ?? null;
        const msg = isFincraBT ? t('depositModal.bankTransferInstructions')
                  : isFincraMM ? t('depositModal.checkPhone')
                  : redirectUrl ? t('depositModal.waitingConfirmation')
                  : t('depositModal.checkPhone');
        setPollingMessage(msg);
        startPolling(result.deposit_id);
      } else {
        await fetchBalance();
        showAlert(t('common.success'), result?.message || 'Votre dépôt a été initié.', [{ text: 'OK', onPress: onClose }]);
      }
      setAmount('');
      setPhone('');
      setOtp('');
    } catch (error: any) {
      if (cardWindow && !cardWindow.closed) cardWindow.close();
      showAlert(t('common.error'), getApiErrorMessage(error, t, t('depositModal.depositError')));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveModal visible={visible} onClose={handleClose} disableBackdropClose={pollingState === 'pending' || loading}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        enabled={Platform.OS !== 'web'}
      >
          <View style={[styles.sheet, { flex: 1, paddingBottom: Math.max(insets.bottom, Spacing.lg), paddingTop: Spacing.lg }]}>
              <View style={styles.header}>
                <Text style={styles.title}>{t('depositModal.title')}</Text>
                <TouchableOpacity onPress={handleClose}>
                  <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>

          {pollingState === 'pending' && (
            <View style={styles.pollingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.pollingTitle}>{t('depositModal.processing')}</Text>
              <Text style={styles.pollingMessage}>{pollingMessage}</Text>
              {bankTransferInfo && (
                <View style={styles.btBox}>
                  <Text style={styles.btTitle}>{t('depositModal.bankTransferTitle')}</Text>
                  {[
                    { key: 'bank',    label: t('depositModal.bankName'),    value: bankTransferInfo.bankName },
                    { key: 'account', label: t('depositModal.accountNumber'), value: bankTransferInfo.accountNumber, copy: true, strong: true },
                    { key: 'name',    label: t('depositModal.beneficiary'), value: bankTransferInfo.accountName },
                    { key: 'net',     label: t('depositModal.amountNet'),   value: `${bankTransferInfo.amountNet} ${bankTransferInfo.currency}` },
                    ...(bankTransferInfo.fee > 0 ? [{ key: 'fee', label: t('depositModal.fincraFees'), value: `${(bankTransferInfo.fee + bankTransferInfo.vat).toFixed(2)} ${bankTransferInfo.currency}` }] : []),
                    { key: 'amount',  label: t('depositModal.amountExact'), value: `${bankTransferInfo.amountExpected} ${bankTransferInfo.currency}`, copy: true, strong: true },
                  ].filter((row) => !!row.value).map((row) => (
                    <View key={row.key} style={styles.btRow}>
                      <Text style={styles.btLabel}>{row.label}</Text>
                      <View style={styles.btValueWrap}>
                        <Text style={[styles.btValue, row.strong && styles.btValueStrong]} selectable>{row.value}</Text>
                        {row.copy && Platform.OS === 'web' && (
                          <TouchableOpacity
                            onPress={() => {
                              try {
                                (navigator as any)?.clipboard?.writeText(String(row.value));
                                setCopiedField(row.key);
                                setTimeout(() => setCopiedField((c) => c === row.key ? null : c), 1500);
                              } catch (_) {}
                            }}
                            style={styles.btCopyBtn}
                          >
                            <FontAwesome6 name={copiedField === row.key ? 'check' : 'copy'} size={12} color={Colors.primary} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                  <Text style={styles.btHelp}>{t('depositModal.bankTransferAutoCredit')}</Text>
                </View>
              )}
              {manualPaymentUrl && Platform.OS === 'web' ? (
                <a
                  href={manualPaymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setManualPaymentUrl(null)}
                  style={{
                    marginTop: Spacing.lg,
                    padding: '12px 20px',
                    background: Colors.primary,
                    color: '#fff',
                    borderRadius: BorderRadius.md,
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontFamily: Fonts.semiBold,
                    display: 'inline-block',
                  } as any}
                >
                  {t('depositModal.openPaymentPage')}
                </a>
              ) : (
                <Button title={t('depositModal.checkLater')} onPress={() => { stopPolling(); setPollingState('idle'); onClose(); }} style={{ marginTop: Spacing.lg }} />
              )}
            </View>
          )}

          {pollingState === 'success' && (
            <View style={styles.pollingContainer}>
              <FontAwesome6 name="circle-check" size={64} color={Colors.success} />
              <Text style={[styles.pollingTitle, { color: Colors.success }]}>{t('depositModal.paymentConfirmed')}</Text>
              <Text style={styles.pollingMessage}>{t('depositModal.balanceUpdated')}</Text>
              <Button title={t('common.close')} onPress={() => { setPollingState('idle'); setBankTransferInfo(null); setOperator(''); fetchBalance(); useWalletStore.getState().fetchTransactions(1); onClose(); }} style={{ marginTop: Spacing.lg }} />
            </View>
          )}

          {pollingState === 'failed' && (
            <View style={styles.pollingContainer}>
              <FontAwesome6 name="circle-xmark" size={64} color={Colors.error ?? '#e53935'} />
              <Text style={[styles.pollingTitle, { color: Colors.error ?? '#e53935' }]}>{t('depositModal.paymentFailed2')}</Text>
              <Text style={styles.pollingMessage}>{pollingMessage}</Text>
              <Button title={t('common.retry')} onPress={() => setPollingState('idle')} style={{ marginTop: Spacing.lg }} />
            </View>
          )}

          {pollingState === 'timeout' && (
            <View style={styles.pollingContainer}>
              <FontAwesome6 name="clock" size={64} color={Colors.warning ?? '#F4B228'} />
              <Text style={[styles.pollingTitle, { color: Colors.warning ?? '#F4B228' }]}>{t('depositModal.processingTitle')}</Text>
              <Text style={styles.pollingMessage}>{t('depositModal.pollingTimeout')}</Text>
              <Button title={t('depositModal.viewHistory')} onPress={() => { setPollingState('idle'); onClose(); }} style={{ marginTop: Spacing.lg }} />
              <Button title={t('common.retry')} onPress={() => setPollingState('idle')} style={{ marginTop: Spacing.sm }} />
            </View>
          )}

          {pollingState === 'idle' && <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
            <TransactionAlertBanner type="deposit" />
            {isAdmin && !depositEnabled && (
              <AdminDisabledBanner message={t('admin.bannerDeposit')} />
            )}
            {isAdmin && depositEnabled && !afribapayEnabled && (
              <AdminDisabledBanner message={t('admin.bannerAfribapay')} />
            )}
            {user?.validate !== 1 && (
              <View style={styles.kycBanner}>
                <FontAwesome6 name="triangle-exclamation" size={14} color={Colors.warning} style={{ marginRight: 8 }} />
                <Text style={styles.kycBannerText}>{t('depositModal.kycRequired')}</Text>
              </View>
            )}
            {useCountryStep && !selectedCountry && !othersOpen && !cryptoOpen ? (
              <CountryPickerStep
                operators={displayOperators.filter((op) => !isZoneFincra(op))}
                showCardTile={showOthersEntry}
                cardLabel={t('depositModal.others')}
                onSelectCountry={(code) => { setSelectedCountry(code); setOperator(''); }}
                onSelectCard={() => { setOthersOpen(true); setOperator(''); }}
                showCryptoTile={cryptoEnabled}
                cryptoLabel={t('depositModal.cryptoGroup')}
                onSelectCrypto={() => { setCryptoOpen(true); setOperator(''); }}
                label={t('depositModal.chooseCountry')}
              />
            ) : cryptoOpen ? (
              <>
                <Text style={styles.operatorLabel}>{t('depositModal.cryptoGroup')}</Text>
                <TouchableOpacity
                  onPress={() => { setCryptoOpen(false); setOperator(''); }}
                  style={styles.changeCountryBtn}
                >
                  <FontAwesome6 name="arrow-left" size={12} color={Colors.secondary} />
                  <Text style={styles.changeCountryText}>{t('depositModal.changeCountry')}</Text>
                </TouchableOpacity>
                {cryptoRates.length === 0 ? (
                  <Text style={styles.hintText}>{t('common.loading')}</Text>
                ) : (
                  <View style={styles.operatorChipGrid}>
                    {cryptoRates.map((c) => {
                      // Source unifiée : utilise pickCryptoSource() (même logique
                      // que CryptoModal) avec mapping local par variante (BNB.BSC,
                      // USDT.TRC20…) en fallback.
                      const source = pickCryptoSource(c);
                      return (
                        <TouchableOpacity
                          key={c.code}
                          style={styles.operatorChip}
                          onPress={() => onSellCrypto?.(c.code)}
                        >
                          {source ? (
                            <Image source={source as any} style={styles.operatorChipLogo} resizeMode="contain" />
                          ) : (
                            <FontAwesome6 name="bitcoin-sign" size={16} color={Colors.text} />
                          )}
                          <Text style={styles.operatorChipText} numberOfLines={1}>{c.name || c.code}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.operatorLabel}>{othersOpen ? t('depositModal.others') : t('depositModal.chooseOperator')}</Text>
                {(othersOpen || (useCountryStep && selectedCountry)) && (() => {
                  // Pays sélectionné : on l'affiche en chip à côté du bouton Changer
                  // pour que l'utilisateur ait toujours le contexte sous les yeux.
                  const selCountryEntry = selectedCountry
                    ? ALL_COUNTRIES.find((c) => c.code === selectedCountry)
                    : null;
                  const selFlag = selCountryEntry && /^[A-Z]{2}$/.test(selectedCountry || '')
                    ? String.fromCodePoint(...[...(selectedCountry || '')].map((ch) => 127397 + ch.charCodeAt(0)))
                    : '';
                  const selName = selCountryEntry
                    ? t(`countries.${selectedCountry}`, { defaultValue: selCountryEntry.name })
                    : '';
                  return (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap', marginBottom: Spacing.xs }}>
                      <TouchableOpacity
                        onPress={() => { if (othersOpen) { setOthersOpen(false); } else { setSelectedCountry(null); } setOperator(''); }}
                        style={styles.changeCountryBtn}
                      >
                        <FontAwesome6 name="arrow-left" size={12} color={Colors.secondary} />
                        <Text style={styles.changeCountryText}>{t('depositModal.changeCountry')}</Text>
                      </TouchableOpacity>
                      {!othersOpen && selectedCountry && (
                        <View style={styles.selectedCountryChip}>
                          {!!selFlag && <Text style={styles.selectedCountryFlag}>{selFlag}</Text>}
                          <Text style={styles.selectedCountryName} numberOfLines={1}>{selName}</Text>
                        </View>
                      )}
                    </View>
                  );
                })()}
                {isDesktop ? (
              <View style={styles.operatorChipGrid}>
                {operatorsForStep.map((op) => (
                  <TouchableOpacity
                    key={op.id}
                    style={[
                      styles.operatorChip,
                      operator === op.id && styles.operatorChipSelected,
                    ]}
                    onPress={() => setOperator(op.id)}
                  >
                    <OperatorLogo op={op as any} size={24} style={styles.operatorChipLogo as any} />
                    <Text
                      style={[
                        styles.operatorChipText,
                        operator === op.id && styles.operatorChipTextSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {othersOpen ? operatorOthersLabel(op) : op.name}
                    </Text>
                    <GatewayBadge op={op} visible={isAdmin} size={14} />
                  </TouchableOpacity>
                ))}
                {showOthersEntry && !othersOpen && (
                  <TouchableOpacity
                    key="__others"
                    style={styles.operatorChip}
                    onPress={() => { setOthersOpen(true); setOperator(''); }}
                  >
                    <FontAwesome6 name="ellipsis" size={18} color={Colors.text} />
                    <Text style={styles.operatorChipText} numberOfLines={1}>{t('depositModal.others')}</Text>
                  </TouchableOpacity>
                )}
                {cryptoEnabled && (
                  <TouchableOpacity
                    key="__crypto"
                    style={styles.operatorChip}
                    onPress={() => { setCryptoOpen(true); setOperator(''); }}
                  >
                    <FontAwesome6 name="bitcoin-sign" size={16} color={Colors.text} />
                    <Text style={styles.operatorChipText} numberOfLines={1}>{t('depositModal.cryptoGroup')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.operatorScroll}
                contentContainerStyle={styles.operatorScrollContent}
              >
                {operatorsForStep.map((op) => (
                  <TouchableOpacity
                    key={op.id}
                    style={[
                      styles.operatorCard,
                      operator === op.id && styles.operatorSelected,
                    ]}
                    onPress={() => setOperator(op.id)}
                  >
                    <OperatorLogo op={op as any} size={32} style={styles.operatorLogo as any} />
                    <Text
                      style={[
                        styles.operatorName,
                        operator === op.id && styles.operatorNameSelected,
                      ]}
                    >
                      {othersOpen ? operatorOthersLabel(op) : op.name}
                    </Text>
                    <GatewayBadge op={op} visible={isAdmin} size={16} />
                  </TouchableOpacity>
                ))}
                {showOthersEntry && !othersOpen && (
                  <TouchableOpacity
                    key="__others"
                    style={styles.operatorCard}
                    onPress={() => { setOthersOpen(true); setOperator(''); }}
                  >
                    <FontAwesome6 name="ellipsis" size={22} color={Colors.text} />
                    <Text style={styles.operatorName}>{t('depositModal.others')}</Text>
                  </TouchableOpacity>
                )}
                {cryptoEnabled && (
                  <TouchableOpacity
                    key="__crypto"
                    style={styles.operatorCard}
                    onPress={() => { setCryptoOpen(true); setOperator(''); }}
                  >
                    <FontAwesome6 name="bitcoin-sign" size={22} color={Colors.text} />
                    <Text style={styles.operatorName}>{t('depositModal.cryptoGroup')}</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
                )}
              </>
            )}

            {!!operator && (
              <>
                <Input
                  label={t('depositModal.amountLabel', { currency: userCurrency })}
                  placeholder={`${t('depositModal.minDeposit')} ${fmtXof(depositMin)}`}
                  value={amount}
                  onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
                  keyboardType="decimal-pad"
                />

                {/* Montant à payer côté Fincra (devise Fincra). XOF→XOF ou
                    userCurrency === fincraCurrency : pas d'affichage redondant. */}
                {isFincra && fincraCurrency !== 'XOF' && userCurrency !== fincraCurrency && numAmountDisplayLive > 0 && (
                  fincraRate.loading ? (
                    <View style={styles.fincraConvBox}>
                      <ActivityIndicator size="small" color={Colors.primary} />
                      <Text style={[styles.fincraConvLabel, styles.fincraConvMuted]}>{t('transferModal.rateLoading')}</Text>
                    </View>
                  ) : (fincraRate.error || fincraChargeAmount === null) ? (
                    <View style={[styles.fincraConvBox, styles.fincraConvError]}>
                      <FontAwesome6 name="triangle-exclamation" size={13} color={Colors.error} iconStyle="solid" />
                      <Text style={[styles.fincraConvLabel, styles.fincraConvErrorText]}>{t('common.rateUnavailable')}</Text>
                    </View>
                  ) : (
                    <View style={styles.fincraConvBox}>
                      <FontAwesome6 name="arrow-right-arrow-left" size={13} color={Colors.primary} iconStyle="solid" />
                      <Text style={styles.fincraConvLabel}>{t('depositModal.fincraToPay')}</Text>
                      <Text style={styles.fincraConvAmount}>
                        ≈ {(fincraChargeAmount ?? 0).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} {fincraCurrency}
                      </Text>
                    </View>
                  )
                )}

                {classicRateBlocking && (
                  <View style={{ marginBottom: 8 }}>
                    <Text style={[styles.hintText, { color: Colors.error }]}>{t('common.rateUnavailable')}</Text>
                  </View>
                )}

                {isFincraBT && (
                  <View style={styles.hintBox}>
                    <FontAwesome6 name="circle-info" size={14} color={Colors.primary} />
                    <Text style={styles.hintText}>{t('depositModal.bankTransferHint')}</Text>
                  </View>
                )}
                {isFincraMM && (
                  <View style={styles.hintBox}>
                    <FontAwesome6 name="circle-info" size={14} color={Colors.primary} />
                    <Text style={styles.hintText}>{t('depositModal.mobileMoneyHint')}</Text>
                  </View>
                )}

                {showPhoneField && fincraZoneList && !zoneHasContext && (
                  <View style={{ gap: Spacing.xs }}>
                    <Text style={styles.zoneLabel}>{t('depositModal.chooseCountry')}</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={{ gap: Spacing.xs, paddingVertical: 2 }}
                    >
                      {fincraZoneList.map((c) => (
                        <TouchableOpacity
                          key={c.code}
                          onPress={() => setFincraZoneCountry(c.code)}
                          style={[styles.zoneChip, fincraZoneCountry === c.code && styles.zoneChipSelected]}
                        >
                          <Text style={styles.zoneChipFlag}>{c.flag}</Text>
                          <Text style={[styles.zoneChipText, fincraZoneCountry === c.code && styles.zoneChipTextSelected]}>
                            {c.name} +{c.phone}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}

                {showPhoneField && (
                  <Input
                    label={t('depositModal.phoneLabel')}
                    placeholder={isFincraMM
                      ? '770000000'
                      : t('depositModal.phoneNumber')}
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                    prefix={phonePrefix}
                  />
                )}

                {showPhoneField && !!normalizedPhone && !savedPhones.some((item) => item.tel.replace(/\s+/g, '') === normalizedPhone) && (
                  <Button
                    variant="secondary"
                    icon="bookmark"
                    title={t('depositModal.saveThisNumber')}
                    onPress={saveCurrentPhone}
                    style={styles.saveBtnSmall}
                    textStyle={styles.saveBtnText}
                  />
                )}
                {showPhoneField && savedPhones.some((item) => item.tel.replace(/\s+/g, '') === normalizedPhone) && (
                  <TouchableOpacity style={styles.savedActionBtn} onPress={removeCurrentPhone}>
                    <FontAwesome6 name="trash" size={12} color={Colors.error} />
                    <Text style={[styles.savedActionText, { color: Colors.error }]}>{t('common.delete')}</Text>
                  </TouchableOpacity>
                )}

                {showPhoneField && savedPhones.length > 0 && (
                  <View style={styles.savedBlock}>
                    <Text style={styles.savedLabel}>{t('depositModal.savedNumbers')}</Text>
                    <View style={styles.savedList}>
                      {savedPhones.map((item) => {
                        const normalizedItemTel = item.tel.replace(/\s+/g, '').trim();
                        const selected = !!normalizedPhone && normalizedPhone === normalizedItemTel;
                        return (
                          <TouchableOpacity
                            key={item.id}
                            style={[styles.savedChip, selected && styles.savedChipSelected]}
                            onPress={() => setPhone(selected ? '' : item.tel)}
                          >
                            <Text style={[styles.savedChipText, selected && styles.savedChipTextSelected]}>
                              {item.name?.trim() ? `${item.name} · ${item.tel}` : item.tel}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                )}

                {showPhoneField && savedPhonesLoadError && savedPhones.length === 0 && (
                  <Text style={styles.savedErrorText}>{savedPhonesLoadError}</Text>
                )}

                {showPhoneField && needsOtp && (
                  <Input
                    label={t('depositModal.otpLabel', { operator: OPERATORS_SRC.find((op) => op.id === operator)?.name ?? '' })}
                    placeholder={t('depositModal.refPlaceholder')}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="numeric"
                  />
                )}

                <Button
                  title={t('depositModal.deposit')}
                  onPress={user?.validate !== 1 ? () => showAlert(t('depositModal.kycRequired3'), t('depositModal.kycRequired2')) : handleDeposit}
                  icon="arrow-down"
                  loading={loading}
                  disabled={!amount || fincraRateBlocking || classicRateBlocking || (showPhoneField && !phone) || (!!fincraZoneList && !fincraZoneCountry)}
                  style={{ marginTop: Spacing.lg }}
                />
              </>
            )}
          </ScrollView>}
          </View>
      </KeyboardAvoidingView>
      <CustomAlert />

      <Modal visible={savePhoneModalVisible} transparent animationType="fade" onRequestClose={() => setSavePhoneModalVisible(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>{t('depositModal.saveThisNumber')}</Text>
            <Text style={styles.confirmSubtitle}>{t('depositModal.saveNumberHint')}</Text>
            <Input
              label={t('depositModal.nameLabel')}
              placeholder={t('depositModal.savePhoneLabel')}
              value={savePhoneName}
              onChangeText={setSavePhoneName}
              containerStyle={{ alignSelf: 'stretch' }}
            />
            <Text style={styles.saveOpLabel}>{t('depositModal.paymentMethod')}</Text>
            {isDesktop ? (
              <View style={styles.saveOpGrid}>
                {OPERATORS_SRC.filter((op) => op.id !== 'card').map((op) => (
                  <TouchableOpacity
                    key={op.id}
                    style={[styles.saveOpChip, savePhoneOperator === op.id && styles.saveOpChipSelected]}
                    onPress={() => setSavePhoneOperator(op.id)}
                  >
                    <Image source={op.logo} style={styles.saveOpLogo} resizeMode="contain" />
                    <Text style={[styles.saveOpChipText, savePhoneOperator === op.id && styles.saveOpChipTextSelected]} numberOfLines={2}>
                      {op.flag} {op.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.saveOpScroll} contentContainerStyle={styles.saveOpScrollContent}>
                {OPERATORS_SRC.filter((op) => op.id !== 'card').map((op) => (
                  <TouchableOpacity
                    key={op.id}
                    style={[styles.saveOpChip, savePhoneOperator === op.id && styles.saveOpChipSelected]}
                    onPress={() => setSavePhoneOperator(op.id)}
                  >
                    <Image source={op.logo} style={styles.saveOpLogo} resizeMode="contain" />
                    <Text style={[styles.saveOpChipText, savePhoneOperator === op.id && styles.saveOpChipTextSelected]} numberOfLines={2}>
                      {op.flag} {op.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSavePhoneModalVisible(false)}>
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, !savePhoneOperator && styles.confirmBtnDisabled]} onPress={confirmSaveCurrentPhone} disabled={savePhoneLoading || !savePhoneOperator}>
                {savePhoneLoading
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.confirmBtnText}>{t('common.save')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ResponsiveModal>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  sheet: {
    backgroundColor: Colors.background,
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
  btBox: {
    width: '100%',
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  btTitle: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  btRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  btLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
  },
  btValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    maxWidth: '65%',
  },
  btValue: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontFamily: Fonts.semiBold,
    textAlign: 'right',
  },
  btValueStrong: {
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
    color: Colors.primary,
  },
  btCopyBtn: {
    padding: 6,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.primary + '15',
  },
  btHelp: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.xs,
    backgroundColor: Colors.primary + '10',
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.sm,
  },
  hintText: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.text,
    fontFamily: Fonts.regular,
    lineHeight: 16,
  },
  fincraConvBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary + '14',
    borderWidth: 1,
    borderColor: Colors.primary + '2E',
    borderRadius: BorderRadius.md,
    paddingVertical: 11,
    paddingHorizontal: Spacing.sm,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  fincraConvLabel: {
    flex: 1,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontFamily: Fonts.semiBold,
  },
  fincraConvAmount: {
    fontSize: FontSize.md,
    color: Colors.primary,
    fontFamily: Fonts.bold,
  },
  fincraConvError: {
    backgroundColor: Colors.error + '12',
    borderColor: Colors.error + '33',
  },
  fincraConvErrorText: {
    color: Colors.error,
    fontFamily: Fonts.semiBold,
  },
  fincraConvMuted: {
    color: Colors.textMuted,
    fontFamily: Fonts.medium,
  },
  zoneLabel: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    marginTop: Spacing.sm,
  },
  zoneChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 8,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.inputBg,
  },
  zoneChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '15',
  },
  zoneChipFlag: {
    fontSize: 16,
  },
  zoneChipText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  zoneChipTextSelected: {
    color: Colors.primary,
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
  changeCountryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: Spacing.sm,
  },
  changeCountryText: {
    color: Colors.secondary,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
  },
  selectedCountryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.primary + '15',
    marginBottom: Spacing.sm,
  },
  selectedCountryFlag: {
    fontSize: 14,
  },
  selectedCountryName: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    color: Colors.primary,
  },
  operatorScroll: {
    marginBottom: Spacing.md,
    marginHorizontal: -Spacing.lg,
  },
  operatorScrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  operatorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  operatorChipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  operatorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 7,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  operatorChipSelected: {
    borderColor: Colors.secondary,
    backgroundColor: 'rgba(244,178,40,0.12)',
  },
  operatorChipLogo: {
    width: 26,
    height: 26,
    borderRadius: 13,
  },
  operatorChipText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium ?? Fonts.regular,
    color: Colors.text,
    flexShrink: 1,
  },
  operatorChipTextSelected: {
    color: Colors.secondary,
    fontFamily: Fonts.semiBold,
  },
  operatorCard: {
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
  // Numéros enregistrés
  savedBlock: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  savedLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    marginBottom: Spacing.xs,
  },
  savedList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  savedChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.pill ?? 20,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border ?? '#E0E0E0',
  },
  savedChipSelected: {
    backgroundColor: Colors.secondary + '20',
    borderColor: Colors.secondary,
  },
  savedChipText: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    fontFamily: Fonts.medium ?? Fonts.regular,
  },
  savedChipTextSelected: {
    color: Colors.secondary,
    fontFamily: Fonts.semiBold,
  },
  savedErrorText: {
    fontSize: FontSize.xs,
    color: Colors.error,
    marginTop: Spacing.xs,
  },
  savedActionsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  savedActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
  },
  savedActionText: {
    fontSize: FontSize.xs,
    color: Colors.secondary,
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
  // Modal confirmation / save name
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  confirmSheet: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl ?? BorderRadius.lg,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 480,
    gap: Spacing.sm,
  },
  confirmTitle: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginBottom: 2,
  },
  confirmSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.xs,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  confirmBtnText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.white,
  },
  confirmBtnDisabled: {
    opacity: 0.45,
  },
  // Sélecteur opérateur dans le modal de sauvegarde
  saveOpLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  saveOpScroll: {
    marginHorizontal: -Spacing.lg,
    marginBottom: Spacing.xs,
  },
  saveOpScrollContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.xs,
  },
  saveOpGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  saveOpChip: {
    width: 80,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.inputBg,
    borderWidth: 2,
    borderColor: 'transparent',
    gap: 4,
  },
  saveOpChipSelected: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.secondary + '18',
  },
  saveOpLogo: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.sm,
  },
  saveOpChipText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontFamily: Fonts.medium ?? Fonts.regular,
    textAlign: 'center',
  },
  saveOpChipTextSelected: {
    color: Colors.secondary,
    fontFamily: Fonts.semiBold,
  },
});
