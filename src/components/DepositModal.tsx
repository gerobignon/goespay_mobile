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
import FincraConversionHint from './FincraConversionHint';
import { OperatorLogo } from './OperatorLogo';
import { pickCryptoSource } from '../utils/cryptoLogos';

// Combinaison USSD Orange Money pour générer le code OTP de paiement, par
// opérateur (Softpay orange-money-* ET AfribaPay orange-*-afp). Codes officiels
// AfribaPay (/v1/countries → ussd_code). « montant » = montant saisi.
const ORANGE_OTP_USSD: Record<string, string> = {
  'orange-money-ci':      '#144*82#',
  'orange-ci-afp':        '#144*82#',
  'orange-money-burkina': '*144*4*6*montant#',
  'orange-bf-afp':        '*144*4*6*montant#',
  'orange-money-senegal': '#144*391#',
  'orange-sn-afp':        '#144*391#',
  'orange-gn':            '*144*4*2*1#',
  // Klasha MoMo (device-poll) : Orange CI/SN valident sur le téléphone via le même USSD.
  'klasha-mm-ci-orange':  '#144*82#',
  'klasha-mm-sn-orange':  '#144*391#',
};

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
  const intlRails = useConfigStore((s) => s.intl_rails);
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
  // Étape OTP Fincra MM (opérateurs en auth_model=OTP, ex. Orange Sénégal) : la
  // charge est créée, on collecte l'OTP (généré via USSD) puis on l'autorise.
  const [fincraOtpStep, setFincraOtpStep] = useState<{ chargeId: string; depositId: number; reference: string | null; message: string } | null>(null);
  const [fincraOtpInput, setFincraOtpInput] = useState('');
  const [savePhoneOperator, setSavePhoneOperator] = useState('');
  const [savePhoneLoading, setSavePhoneLoading] = useState(false);

  // Snapshot des valeurs initiales (post-prefill / post-reset) pour détecter
  // si l'utilisateur a réellement modifié le formulaire avant fermeture.
  const initialFormRef = useRef({ amount: '', phone: '', operator: '' });

  // Réinitialise les champs à chaque ouverture et pré-remplit le téléphone profil
  useEffect(() => {
    if (!visible) return;
    const initAmount = prefill?.amount ?? '';
    const initOperator = prefill?.operator ?? '';
    const defaultPhone = prefill?.phone ?? (user?.phone ?? '').trim();
    setAmount(initAmount);
    setOperator(initOperator);
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
    setFincraOtpStep(null);
    setFincraOtpInput('');
    setSavedPhones([]);
    setSavedPhonesLoadError(null);
    setSavePhoneModalVisible(false);
    setSavePhoneName('');
    setSavePhoneOperator('');
    phoneUserEditedRef.current = false;
    setPhone(defaultPhone);
    initialFormRef.current = { amount: initAmount, phone: defaultPhone, operator: initOperator };
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset le sous-pays Fincra à chaque changement d'opérateur.
  useEffect(() => { setFincraZoneCountry(null); }, [operator]);

  // Charge les taux crypto quand on ouvre le groupe « Crypto-monnaies ».
  // Charge les taux crypto à l'ouverture du groupe (admin) OU dès l'ouverture du
  // modal quand la crypto est active (clients : cryptos listées directement).
  useEffect(() => { if (cryptoOpen || (visible && cryptoEnabled)) fetchCryptoRates(cryptoRates.length === 0); }, [cryptoOpen, visible, cryptoEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (fincraRef && (fincraRef.startsWith('FCD-') || fincraRef.startsWith('KLD-'))) {
        const fRes = fincraRef.startsWith('KLD-')
          ? await walletService.getKlashaDepositStatus(fincraRef)
          : await walletService.getFincraDepositStatus(fincraRef);
        consecutiveErrorsRef.current = 0;
        if (fRes.status === 'success') {
          stopPolling(); setPollingState('success'); fetchBalance().catch(() => {}); return true;
        } else if (fRes.status === 'fail') {
          stopPolling(); setPollingState('failed');
          setPollingMessage(fRes.user_error || t('depositModal.paymentFailed'));
          return true;
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
        setPollingMessage(res.user_error || t('depositModal.paymentFailed'));
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
  const audienceFor = useCorridorStore((s) => s.audienceFor);
  // Moyen réservé VIP : masqué aux non-VIP (le backend bloque déjà la transaction).
  const isVip = isAdmin || user?.group === 'vip';
  const audienceOk = (id: string) => isVip || audienceFor(id) !== 'vip';
  // Référentiel serveur (P3) : opérateurs construits depuis /catalog (admin Marchés).
  // Fallback sur la liste statique config.ts tant que le catalogue n'est pas chargé.
  const catalogOperators = useCatalogStore((s) => s.operators);
  const catalogCountries = useCatalogStore((s) => s.countries);
  const catalogZones = useCatalogStore((s) => s.zones);
  const catalogDial = useCatalogStore((s) => s.dialByCode);
  const OPERATORS_SRC: any[] = catalogOperators.length ? catalogOperators : (OPERATORS as any);
  // Le pays de l'utilisateur figure-t-il dans le catalogue Marchés (actif) ?
  // Détermine si le groupe « International » doit être proposé : oui seulement
  // si le pays user N'est PAS listé (sinon il a des moyens locaux dédiés).
  const userCountryListed = !!userCountry && catalogCountries.some((c) => c.code === userCountry);

  // Plus de dédup statique PayDunya : la visibilité d'un moyen dépend UNIQUEMENT
  // de son corridor activé dans le routing admin (isCodeEnabled). L'admin n'active
  // qu'un seul agrégateur par (pays, réseau), donc un seul moyen visible par opérateur.
  // Fallback statique tant que les corridors ne sont pas chargés (évite un écran vide).
  // Reconnaît la carte PayDunya : 'card' (legacy/INTL) OU 'card-<cc>' (per-country
  // → admin opt-in). Affecte filtrage opérateurs + UI dépôt (pas de champ phone, etc.).
  const isCardOp = (op: any) => !!op?.id && (op.id === 'card' || (typeof op.id === 'string' && op.id.startsWith('card-')));
  const operatorsBase = OPERATORS_SRC.filter((op) => {
    if (!corridorsLoaded && !afribapayEnabled && !isAdmin && (op as any).afribapay) return false;
    return true;
  });
  // "Has mobile money for country" : on accepte op.country === userCountry OU
  // op.countries[] inclut userCountry (zones Fincra XOF/XAF).
  const hasMomoForCountry = operatorsBase.some((op) => !isCardOp(op) && operatorServesCountry(op as any, userCountry || ''));
  const showCard = isAdmin || !isKycValidated || !hasMomoForCountry;
  const filteredOperators = (isAdmin || !isKycValidated)
    ? [...operatorsBase]
    : [
        ...operatorsBase.filter(
          (op) => operatorServesCountry(op as any, userCountry || '') && (isAdmin || isCodeEnabled(op.id, 'payin')) && audienceOk(op.id)
        ),
        // Fallback carte : SEULEMENT l'INTL 'card'. Les per-country card-<cc>
        // passent par le filtre normal (operatorServesCountry + isCodeEnabled).
        ...(showCard ? operatorsBase.filter((op) => op.id === 'card') : []),
      ];
  // Fallback « anti-écran-vide » UNIQUEMENT tant que les corridors ne sont pas
  // chargés. Une fois chargés, un filtre vide (pays non listé / aucun payin actif)
  // ne doit PAS déverser toute la liste : on laisse l'audience International
  // (clientFlattenOthers) prendre le relais, sinon état vide propre.
  const displayOperators = filteredOperators.length > 0
    ? filteredOperators
    : (corridorsLoaded ? [] : operatorsBase);

  // Étape pays uniquement en mode admin (les utilisateurs réguliers ont déjà une liste filtrée par pays).
  const useCountryStep = isAdmin;

  // « Autres » regroupe les rails NON rattachés à un pays unique :
  // - Carte bancaire générique (KKiapay)
  // - Zones multi-pays Fincra (UEMOA/XOF, CEMAC/XAF)
  // - Devises internationales Fincra (EUR/USD/GBP)
  const ZONE_CURRENCIES = ['XOF', 'XAF', 'EUR', 'USD', 'GBP'];
  // Les opérateurs MM Fincra par pays (fincraOperator présent) s'affichent comme
  // le softpay (par pays) — PAS sous « Autres ». Seuls les rails sans pays unique
  // (cartes génériques, virements internationaux EUR/USD/GBP) restent en « Autres ».
  // Fincra Checkout (rail=checkout, page hébergée) = tuile directe par pays, PAS
  // « Autres » (sinon les checkout XOF/XAF/EUR… seraient enfouis sous Autres).
  const isZoneFincra = (op: any) => !!op.fincra && ZONE_CURRENCIES.includes(op.currency) && !op.fincraOperator && op.rail !== 'checkout';
  // « Autres » : seulement carte INTL + zones Fincra (rails non attachés à un pays).
  // Les card-<cc> per-country s'affichent dans la liste normale du pays.
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
  // Nom affiché : pour les rails Fincra carte/virement (libellés génériques
  // « Carte bancaire » / « Virement bancaire »), suffixe la devise (USD, GBP…)
  // pour les distinguer dans la liste.
  const opName = (op: any): string => {
    const bankCard = !!op?.fincra && (isCardOp(op) || ['bank_transfer', 'SWIFT', 'SEPA', 'checkout'].includes(op?.rail));
    return (bankCard && op.currency && !String(op.name).includes(op.currency))
      ? `${op.name} (${op.currency})`
      : (op?.name ?? '');
  };
  // Groupe « International » : gaté par l'audience International (intl_payin),
  // indépendante des toggles pays. Un rail n'y apparaît que si l'admin l'a activé
  // pour l'International (fiche Marchés → card « International »).
  // Groupe « International » : piloté par /config.intl_rails (calculé serveur —
  // dim 3 par pays listé, ou dim 2 pour les pays non listés). Couvre donc aussi
  // les users de pays listés (un Béninois peut envoyer en USD si activé pour BJ).
  const otherOps = operatorsBase.filter(isOtherOp).filter(
    (op) => isAdmin || (intlRails?.payin ?? []).includes(op.id)
  );

  const baseForStep = useCountryStep
    ? (selectedCountry ? displayOperators.filter((op) => operatorServesCountry(op as any, selectedCountry)) : [])
    : displayOperators;
  // La liste du pays inclut les Fincra de zone (XOF/XAF) qui servent ce pays —
  // visibles directement (Mobile Money + Carte) quand leur corridor est actif
  // dans le routing. Ils restent AUSSI listés sous « Autres » (zone). Seule la
  // carte générique INTL (PayDunya) est réservée à « Autres » ; la carte
  // per-country (card-<cc>) reste dans la liste primaire du pays.
  const primaryOps = baseForStep.filter((op) => op.id !== 'card');
  // Client d'un pays NON listé dans Marchés : aucun moyen local → on liste
  // DIRECTEMENT les moyens internationaux actifs (au lieu de l'obliger à ouvrir
  // « Autres »). L'admin garde le regroupement « Autres » pour ses tests.
  const clientFlattenOthers = !isAdmin && primaryOps.length === 0 && otherOps.length > 0;
  // Côté client : on liste les cryptos actives DIRECTEMENT (pas de groupe
  // « Crypto-monnaies »). L'admin garde le groupe pour ses tests.
  const flattenCrypto = !isAdmin && cryptoEnabled;
  const operatorsForStep = othersOpen ? otherOps : (clientFlattenOthers ? otherOps : primaryOps);
  // Entrée « International » : visible dès qu'il y a des rails internationaux pour
  // ce user (y compris pays listés — dim 3), au niveau du picker, hors flatten.
  const showOthersEntry = otherOps.length > 0 && !selectedCountry && !clientFlattenOthers;

  // Opérateurs exigeant un code OTP saisi dans l'app (généré via USSD côté client) :
  // - Softpay/PayDunya : orange-money-* (BF/CI/SN)
  // - AfribaPay : Orange CI/BF/SN/GN exigent l'OTP (cf. doc AfribaPay « PAYIN with OTP »).
  //   ML/CM/CD Orange n'en demandent pas ; Wave passe par provider_link (redirect).
  const needsOtp = [
    'orange-money-burkina', 'orange-money-ci', 'orange-money-senegal',
    'orange-gn', 'orange-ci-afp', 'orange-bf-afp', 'orange-sn-afp',
  ].includes(operator);
  const selectedOp = OPERATORS_SRC.find((op) => op.id === operator);
  const isFincra = !!(selectedOp as any)?.fincra;
  // Klasha réutilise l'UI Fincra ; ce flag route les appels API vers /deposit/klasha.
  const isKlasha = !!(selectedOp as any)?.klasha;
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
  // Opérateur MM par pays (catalogue serveur) : pays figé = op.country, pas de
  // sélecteur de sous-pays. Les anciennes tuiles de zone (offline/config.ts) gardent
  // le picker.
  const fincraMmCountry = ((selectedOp as any)?.fincraOperator ? ((selectedOp as any)?.country || '') : '').toUpperCase();
  const fincraZoneList = (isFincraMM && !fincraMmCountry) ? (catalogZones[fincraCurrency] ?? FINCRA_ZONES[fincraCurrency]) : undefined;
  const contextCountry = ((useCountryStep ? selectedCountry : user?.country) || '').toUpperCase();
  const zoneHasContext = !!fincraZoneList?.some((c) => c.code === contextCountry);
  const fincraDialCode = isFincraMM
    ? (fincraMmCountry
        ? (catalogDial[fincraMmCountry] || resolveFincraZone(fincraCurrency, fincraMmCountry).dialCode)
        : ((fincraZoneCountry && catalogDial[fincraZoneCountry]) || resolveFincraZone(fincraCurrency, fincraZoneCountry).dialCode))
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
  // Reconnaît 'card' (INTL) ET 'card-<cc>' (carte PayDunya par pays).
  const isCard = (!!operator && (operator === 'card' || operator.startsWith('card-'))) || isFincraCH;
  // Téléphone UNIQUEMENT pour le mobile money (seul moyen encaissé via un numéro).
  // Détection POSITIVE par réseau/rail → jamais de champ sur une carte / virement /
  // checkout, quelle que soit la forme du code (card, card-<cc>, fincra-checkout-<cc>…).
  const opNet  = String((selectedOp as any)?.network || '').toLowerCase();
  const opRail = String((selectedOp as any)?.rail || '').toLowerCase();
  const isCardLike = isCardOp(selectedOp)
    || ['card', 'bank', 'checkout'].includes(opNet)
    || ['checkout', 'bank_transfer', 'swift', 'sepa'].includes(opRail);
  const showPhoneField = isFincraMM || (!isFincra && !!selectedOp && !isCardLike);

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
  const fincraRate = useFincraRate(fincraCurrency, isFincra, isKlasha);
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

  // Combinaison USSD à composer pour générer le code OTP, par opérateur Orange
  // (source : AfribaPay /v1/countries → ussd_code). « montant » = montant local
  // facturé (XOF pour la zone UEMOA). Affichée au-dessus du champ OTP.
  const otpUssd: string | null = (() => {
    const raw = ORANGE_OTP_USSD[operator];
    if (!raw) return null;
    return numAmountXofLive > 0 ? raw.replace('montant', String(numAmountXofLive)) : raw;
  })();

  // Charge les numéros enregistrés pour cet opérateur dès qu'un opérateur non-card est sélectionné
  useEffect(() => {
    if (!visible || isCard) {
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
    // Confirmation seulement si l'utilisateur a réellement modifié le formulaire
    // (vs valeurs initiales : prefill, téléphone profil par défaut). Sélection
    // d'un pays ou d'un opérateur, saisie d'OTP ou changement d'un champ comptent.
    const init = initialFormRef.current;
    const isDirty =
      amount !== init.amount ||
      phone !== init.phone ||
      operator !== init.operator ||
      !!otp.trim() ||
      selectedCountry !== null ||
      fincraZoneCountry !== null;
    if (isDirty) {
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
          // Code corridor (id opérateur) → gating serveur exact (distingue notamment
          // Fincra Checkout `fincra-checkout-<cc>` de la carte `fincra-<cur>-card`).
          code: (selectedOp as any)?.id,
        };
        if (isFincraMM) {
          const op = selectedOp as any;
          // Opérateur porté par la tuile (corridor fincra-mm-<pays>-<op>) ; fallback
          // pour l'ancien catalogue/offline (config.ts) où fincraOperator est absent.
          const fallbackOp = fincraCurrency === 'GHS' ? 'MTN'
                          : fincraCurrency === 'KES' ? 'SAFARICOM'
                          : fincraCurrency === 'TZS' ? 'AIRTEL'
                          : fincraCurrency === 'ZMW' ? 'MTN'
                          : 'ORANGE';
          // Pays bénéficiaire (Fincra valide l'opérateur par pays).
          const mmCountry = op?.country || fincraZoneCountry || contextCountry;
          // Fincra Direct Charge MM exige l'indicatif AVEC `+` (ex: +233700000000).
          fincraPayload.operator = op?.fincraOperator || fallbackOp;
          fincraPayload.country  = mmCountry;
          fincraPayload.phone    = formatFincraPhone(phone, fincraDialCode || '', true);
        }
        const { data } = await api.post(isKlasha ? '/deposit/klasha' : '/deposit/fincra', fincraPayload, { timeout: 70000 });
        result = { deposit_id: data.deposit_id, reference: data.reference };
        if (isFincraCH) {
          result.checkout_url = data.payment_url;
        } else if (isFincraMM && data.auth_model === 'redirect' && data.payment_url) {
          // Wave & co : Fincra renvoie un lien à ouvrir (comme un checkout).
          result.checkout_url = data.payment_url;
        } else if (isFincraMM && data.auth_model === 'otp' && (data.charge_id || data.reference)) {
          // Orange Sénégal & co (Fincra : charge_id) / Klasha MoMo (reference) : OTP requis.
          result.fincraOtp = { chargeId: data.charge_id || data.reference, message: data.message || '' };
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

      // Étape OTP Fincra MM : on suspend le flux, on affiche le champ OTP, et on
      // autorisera la charge à la soumission (submitFincraOtp).
      if (result?.fincraOtp) {
        if (cardWindow && !cardWindow.closed) cardWindow.close();
        setFincraOtpStep({
          chargeId: result.fincraOtp.chargeId,
          depositId: result.deposit_id,
          reference: result.reference ?? null,
          message: result.fincraOtp.message || '',
        });
        setFincraOtpInput('');
        setLoading(false);
        return;
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
        showAlert(t('common.success'), result?.message || 'Votre recharge a été initiée.', [{ text: 'OK', onPress: onClose }]);
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

  // Soumet l'OTP saisi pour autoriser la charge MM Fincra (Orange SN…), puis
  // bascule sur le polling du statut comme un dépôt MM classique.
  const submitFincraOtp = async () => {
    if (!fincraOtpStep || !fincraOtpInput.trim()) return;
    setLoading(true);
    try {
      if (isKlasha) {
        await walletService.authorizeKlashaDeposit({ reference: fincraOtpStep.chargeId, otp: fincraOtpInput.trim(), currency: fincraCurrency, type: 'mobilemoney' });
      } else {
        await walletService.authorizeFincraDeposit({ charge_id: fincraOtpStep.chargeId, otp: fincraOtpInput.trim() });
      }
      pollingRefRef.current = fincraOtpStep.reference;
      setPollingMessage(t('depositModal.waitingConfirmation'));
      startPolling(fincraOtpStep.depositId);
      setFincraOtpStep(null);
      setFincraOtpInput('');
      setAmount('');
      setPhone('');
    } catch (error: any) {
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
                      {op.flag ? `${op.flag} ` : ''}{othersOpen ? operatorOthersLabel(op) : opName(op)}
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
                {cryptoEnabled && (flattenCrypto
                  ? cryptoRates.map((c) => {
                      const source = pickCryptoSource(c);
                      return (
                        <TouchableOpacity key={`crypto-${c.code}`} style={styles.operatorChip} onPress={() => onSellCrypto?.(c.code)}>
                          {source ? (
                            <Image source={source as any} style={styles.operatorChipLogo} resizeMode="contain" />
                          ) : (
                            <FontAwesome6 name="bitcoin-sign" size={16} color={Colors.text} />
                          )}
                          <Text style={styles.operatorChipText} numberOfLines={1}>{c.name || c.code}</Text>
                        </TouchableOpacity>
                      );
                    })
                  : (
                    <TouchableOpacity
                      key="__crypto"
                      style={styles.operatorChip}
                      onPress={() => { setCryptoOpen(true); setOperator(''); }}
                    >
                      <FontAwesome6 name="bitcoin-sign" size={16} color={Colors.text} />
                      <Text style={styles.operatorChipText} numberOfLines={1}>{t('depositModal.cryptoGroup')}</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            ) : (
              // Mobile : liste verticale. Une fois un opérateur choisi, on masque
              // les autres et on ne garde que la ligne sélectionnée (avec un X
              // pour revenir au choix). Le formulaire s'affiche juste en-dessous.
              <View style={styles.operatorListVertical}>
                {(operator ? operatorsForStep.filter((op) => op.id === operator) : operatorsForStep).map((op) => (
                  <TouchableOpacity
                    key={op.id}
                    style={[
                      styles.operatorRow,
                      operator === op.id && styles.operatorRowSelected,
                    ]}
                    onPress={() => setOperator(operator === op.id ? '' : op.id)}
                  >
                    <OperatorLogo op={op as any} size={32} style={styles.operatorRowLogo as any} />
                    <Text
                      style={[
                        styles.operatorRowName,
                        operator === op.id && styles.operatorRowNameSelected,
                      ]}
                      numberOfLines={1}
                    >
                      {op.flag ? `${op.flag} ` : ''}{othersOpen ? operatorOthersLabel(op) : opName(op)}
                    </Text>
                    <GatewayBadge op={op} visible={isAdmin} size={16} />
                    {operator === op.id && (
                      <FontAwesome6 name="xmark" size={14} color={Colors.secondary} />
                    )}
                  </TouchableOpacity>
                ))}
                {!operator && showOthersEntry && !othersOpen && (
                  <TouchableOpacity
                    key="__others"
                    style={styles.operatorRow}
                    onPress={() => { setOthersOpen(true); setOperator(''); }}
                  >
                    <FontAwesome6 name="ellipsis" size={20} color={Colors.text} style={{ width: 32, textAlign: 'center' }} />
                    <Text style={styles.operatorRowName}>{t('depositModal.others')}</Text>
                  </TouchableOpacity>
                )}
                {!operator && cryptoEnabled && (flattenCrypto
                  ? cryptoRates.map((c) => {
                      const source = pickCryptoSource(c);
                      return (
                        <TouchableOpacity key={`crypto-${c.code}`} style={styles.operatorRow} onPress={() => onSellCrypto?.(c.code)}>
                          {source ? (
                            <Image source={source as any} style={styles.operatorRowLogo as any} resizeMode="contain" />
                          ) : (
                            <FontAwesome6 name="bitcoin-sign" size={20} color={Colors.text} style={{ width: 32, textAlign: 'center' }} />
                          )}
                          <Text style={styles.operatorRowName} numberOfLines={1}>{c.name || c.code}</Text>
                        </TouchableOpacity>
                      );
                    })
                  : (
                    <TouchableOpacity
                      key="__crypto"
                      style={styles.operatorRow}
                      onPress={() => { setCryptoOpen(true); setOperator(''); }}
                    >
                      <FontAwesome6 name="bitcoin-sign" size={20} color={Colors.text} style={{ width: 32, textAlign: 'center' }} />
                      <Text style={styles.operatorRowName}>{t('depositModal.cryptoGroup')}</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
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
                  <FincraConversionHint
                    loading={fincraRate.loading}
                    error={fincraRate.error || fincraChargeAmount === null}
                    label={t('depositModal.fincraToPay')}
                    amount={fincraChargeAmount}
                    currency={fincraCurrency}
                  />
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
                  <>
                    <View style={styles.hintBox}>
                      <FontAwesome6 name="circle-info" size={14} color={Colors.primary} />
                      {otpUssd ? (
                        <View style={{ flex: 1 }}>
                          <Text style={styles.hintText}>{t('depositModal.otpHintUssd')}</Text>
                          <Text style={styles.ussdCode} selectable>{otpUssd}</Text>
                        </View>
                      ) : (
                        <Text style={styles.hintText}>{t('depositModal.otpHint')}</Text>
                      )}
                    </View>
                    <Input
                      label={t('depositModal.otpLabel', { operator: OPERATORS_SRC.find((op) => op.id === operator)?.name ?? '' })}
                      placeholder={t('depositModal.refPlaceholder')}
                      value={otp}
                      onChangeText={setOtp}
                      keyboardType="numeric"
                    />
                  </>
                )}

                {/* Klasha MoMo = validation sur le téléphone (device-poll, pas d'OTP
                    in-app) : on affiche juste le code USSD à composer pour valider,
                    comme AfribaPay Orange. */}
                {showPhoneField && isKlasha && isFincraMM && otpUssd && (
                  <View style={styles.hintBox}>
                    <FontAwesome6 name="circle-info" size={14} color={Colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hintText}>{t('depositModal.otpHintUssd')}</Text>
                      <Text style={styles.ussdCode} selectable>{otpUssd}</Text>
                    </View>
                  </View>
                )}

                <Button
                  title={t('depositModal.deposit')}
                  onPress={user?.validate !== 1 ? () => showAlert(t('depositModal.kycRequired3'), t('depositModal.kycRequired2')) : handleDeposit}
                  icon="arrow-down"
                  loading={loading}
                  disabled={!amount || fincraRateBlocking || classicRateBlocking || (showPhoneField && !phone) || (showPhoneField && needsOtp && !otp.trim()) || (!!fincraZoneList && !fincraZoneCountry)}
                  style={{ marginTop: Spacing.lg }}
                />
              </>
            )}
          </ScrollView>}
          </View>
      </KeyboardAvoidingView>
      <CustomAlert />

      {/* Étape OTP Fincra MM (Orange Sénégal & co) : saisie + validation de l'OTP */}
      <Modal visible={!!fincraOtpStep} transparent animationType="fade" onRequestClose={() => { if (!loading) { setFincraOtpStep(null); setFincraOtpInput(''); } }}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>{t('depositModal.otpLabel', { operator: selectedOp?.name ?? '' })}</Text>
            <Text style={styles.confirmSubtitle}>
              {fincraOtpStep?.message?.trim() ? fincraOtpStep.message : t('depositModal.otpHint')}
            </Text>
            <Input
              label=""
              placeholder={t('depositModal.refPlaceholder')}
              value={fincraOtpInput}
              onChangeText={setFincraOtpInput}
              keyboardType="numeric"
              containerStyle={{ alignSelf: 'stretch' }}
            />
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => { if (!loading) { setFincraOtpStep(null); setFincraOtpInput(''); } }}>
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.confirmBtn, !fincraOtpInput.trim() && styles.confirmBtnDisabled]} onPress={submitFincraOtp} disabled={loading || !fincraOtpInput.trim()}>
                {loading
                  ? <ActivityIndicator size="small" color={Colors.white} />
                  : <Text style={styles.confirmBtnText}>{t('common.validate')}</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
            <ScrollView style={styles.saveOpList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {displayOperators.filter((op) => !isCardOp(op)).map((op) => {
                const sel = savePhoneOperator === op.id;
                return (
                  <TouchableOpacity
                    key={op.id}
                    style={[styles.saveOpRow, sel && styles.saveOpRowSelected]}
                    onPress={() => setSavePhoneOperator(op.id)}
                  >
                    <OperatorLogo op={op as any} size={26} />
                    <Text style={[styles.saveOpRowText, sel && styles.saveOpRowTextSelected]} numberOfLines={1}>
                      {op.flag ? `${op.flag} ` : ''}{op.name}
                    </Text>
                    {sel && <FontAwesome6 name="circle-check" size={16} color={Colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
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
  ussdCode: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.primary,
    letterSpacing: 1,
    marginTop: 4,
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
  // Liste verticale (mobile) : un opérateur par ligne pleine largeur, devient
  // l'unique élément visible une fois sélectionné.
  operatorListVertical: {
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  operatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.inputBg,
    borderWidth: 2,
    borderColor: Colors.border,
  },
  operatorRowSelected: {
    borderColor: Colors.secondary,
    backgroundColor: 'rgba(244,178,40,0.1)',
  },
  operatorRowLogo: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.md,
  },
  operatorRowName: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  operatorRowNameSelected: {
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
  // Liste opérateurs (modal sauvegarde) — rangées logo + drapeau + nom.
  saveOpList: {
    maxHeight: 240,
    marginBottom: Spacing.sm,
  },
  saveOpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.inputBg,
    marginBottom: Spacing.xs,
  },
  saveOpRowSelected: {
    borderColor: Colors.secondary,
    backgroundColor: Colors.secondary + '12',
  },
  saveOpRowText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  saveOpRowTextSelected: {
    color: Colors.secondary,
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
