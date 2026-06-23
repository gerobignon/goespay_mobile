import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Modal,
  Platform,
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  ActivityIndicator,
  AppState,
  FlatList,
} from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Input } from './Input';
import { Button } from './Button';
import { ResponsiveModal } from './ResponsiveModal';
import { walletService, type FincraRail, type SavedBank } from '../services/walletService';
import { useWalletStore } from '../stores/walletStore';
import { useAuthStore } from '../stores/authStore';
import { OPERATORS, FINCRA_ZONES, operatorServesCountry } from '../constants/config';
import { useCatalogStore } from '../stores/catalogStore';
import { useCorridorStore } from '../stores/corridorStore';
import { CorridorUnavailableBanner } from './CorridorUnavailableBanner';
import { ALL_COUNTRIES } from '../constants/countries';
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
import { formatFincraPhone, resolveFincraZone } from '../utils/fincraPhone';
import { AdminDisabledBanner } from './AdminDisabledBanner';
import { TransactionAlertBanner } from './TransactionAlertBanner';
import { GatewayBadge } from './GatewayBadge';
import { CountryPickerStep } from './CountryPickerStep';
import FincraConversionHint from './FincraConversionHint';
import { OperatorLogo } from './OperatorLogo';
import { pickCryptoSource } from '../utils/cryptoLogos';
import { noConnectionMessage } from '../utils/apiError';

interface TransferModalProps {
  visible: boolean;
  onClose: () => void;
  /** Affiche le groupe « Crypto-monnaies » (achat) dans le retrait. */
  cryptoEnabled?: boolean;
  /** Lance le flux d'achat crypto (débite le wallet) pour la crypto choisie. */
  onBuyCrypto?: (currency?: string) => void;
  /** Téléphone bénéficiaire pré-rempli (depuis la home : tap sur un avatar). */
  prefillPhone?: string;
  /** Bénéficiaire bancaire pré-rempli (virement) — depuis la home / le menu compte. */
  prefillBank?: SavedBank | null;
}

export function TransferModal({ visible, onClose, cryptoEnabled = false, onBuyCrypto, prefillPhone, prefillBank }: TransferModalProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const { isDesktop, isWide } = useResponsive();

  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  // « Crypto-monnaies » : sous-liste des cryptos actives (achat → débite le wallet).
  const [cryptoOpen, setCryptoOpen] = useState(false);
  // « Autres » : rails internationaux Fincra (zones XOF/XAF + USD/EUR/GBP) en payout.
  const [othersOpen, setOthersOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [savedPhones, setSavedPhones] = useState<SavedPhone[]>([]);
  const [savedPhonesLoadError, setSavedPhonesLoadError] = useState<string | null>(null);
  const [savePhoneModalVisible, setSavePhoneModalVisible] = useState(false);
  const [savePhoneName, setSavePhoneName] = useState('');
  const [savePhoneOperator, setSavePhoneOperator] = useState('');
  const [savePhoneLoading, setSavePhoneLoading] = useState(false);
  // Bénéficiaires bancaires enregistrés (virement)
  const [savedBanks, setSavedBanks] = useState<SavedBank[]>([]);
  const [bankPickerSavedVisible, setBankPickerSavedVisible] = useState(false);
  const [saveBankModalVisible, setSaveBankModalVisible] = useState(false);
  const [saveBankName, setSaveBankName] = useState('');
  const [saveBankLoading, setSaveBankLoading] = useState(false);
  const [pollingState, setPollingState] = useState<'idle' | 'pending' | 'success' | 'failed' | 'timeout'>('idle');
  const [pendingDetails, setPendingDetails] = useState<{ amount_sent: number; fees: number; phone: string; debit_xof?: number } | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollingTransferIdRef = useRef<number | null>(null);
  const pollingFincraRefRef = useRef<string | null>(null);
  const consecutiveErrorsRef = useRef(0);
  // Wire Klasha : réf KLW- comme un payout normal → ce flag route le polling vers
  // /transfer/klasha/wire/status (statut lu par la transactionReference Klasha).
  const pollingIsWireRef = useRef(false);

  // Sous-pays Fincra (XOF/XAF) pour le mobile_money payout.
  const [fincraZoneCountry, setFincraZoneCountry] = useState<string | null>(null);
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankCode, setBankCode] = useState('');
  const [bankCountry, setBankCountry] = useState('');
  const [iban, setIban] = useState('');
  const [bic, setBic] = useState('');
  const [swiftCode, setSwiftCode] = useState('');
  // Champs additionnels du wire international Klasha (process Klasha : la création
  // de bénéficiaire exige adresses + routing en plus des IBAN/SWIFT).
  const [bankAddress, setBankAddress] = useState('');
  const [beneficiaryAddress, setBeneficiaryAddress] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');

  // Picker de banques + résolution de compte (Fincra bank_transfer)
  const [fincraBanks, setFincraBanks] = useState<{ code: string; name: string; swiftCode?: string }[]>([]);
  const [bankSwiftCode, setBankSwiftCode] = useState('');
  const [banksLoading, setBanksLoading] = useState(false);
  const [bankPickerVisible, setBankPickerVisible] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  const [resolving, setResolving] = useState(false);
  const [resolvedHolder, setResolvedHolder] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const fetchBalance = useWalletStore((s) => s.fetchBalance);
  const balance = useWalletStore((s) => s.balance);
  const cryptoRates = useCryptoStore((s) => s.rates);
  const fetchCryptoRates = useCryptoStore((s) => s.fetchRates);
  const user = useAuthStore((s) => s.user);
  const countryFees = useConfigStore((s) => s.country_fees);
  const outgoingFees = useConfigStore((s) => s.outgoing_fees);
  const intlRails = useConfigStore((s) => s.intl_rails);
  const transferMin = useConfigStore((s) => s.transfer_min);
  const transferMinWorld = useConfigStore((s) => s.transfer_min_world);
  const transferMinNg = useConfigStore((s) => s.transfer_min_ng);
  const afribapayEnabled = useConfigStore((s) => s.afribapay_enabled);
  const transferEnabled = useConfigStore((s) => s.transfer_enabled);
  const isAdmin = user?.group === 'admin';
  const userCurrency = useCurrencyCode();
  const convertToXof = useCurrencyStore((s) => s.convertToXof);
  const currencyRates = useCurrencyStore((s) => s.rates);
  const fmtXof = useFormatXof();

  // Corridors server-driven (aggregator_routing) : masquage temps réel + badge.
  const corridorsLoaded = useCorridorStore((s) => s.isLoaded);
  const isCodeEnabled = useCorridorStore((s) => s.isCodeEnabled);
  const isPayoutAvailable = useCorridorStore((s) => s.isPayoutAvailable);
  const audienceFor = useCorridorStore((s) => s.audienceFor);
  // Moyen réservé VIP : masqué aux non-VIP (le backend bloque déjà la transaction).
  const isVip = isAdmin || user?.group === 'vip';
  const audienceOk = (id: string) => isVip || audienceFor(id) !== 'vip';

  // Référentiel serveur (P3) : opérateurs depuis /catalog (admin Marchés), fallback config.ts.
  const catalogOperators = useCatalogStore((s) => s.operators);
  const catalogZones = useCatalogStore((s) => s.zones);
  const catalogDial = useCatalogStore((s) => s.dialByCode);
  const OPERATORS_SRC: any[] = catalogOperators.length ? catalogOperators : (OPERATORS as any);

  // Plus de dédup statique PayDunya : la visibilité dépend UNIQUEMENT du corridor
  // payout activé dans le routing admin (isCodeEnabled). Un seul agrégateur actif
  // par (pays, réseau) → un seul moyen visible par opérateur.
  // Base = corridors CAPABLES de payout (supportsPayout, ≠ état activé) ; le filtre
  // activé/désactivé est appliqué ensuite par corridor (isAdmin || isCodeEnabled).
  // Ainsi l'admin voit aussi les corridors désactivés. Fallback statique : op.withdraw.
  const canPayout = (op: any) => ((op as any).supportsPayout ?? op.withdraw);
  const displayOperators = OPERATORS_SRC.filter(
    (op) => canPayout(op) && (!corridorsLoaded ? (afribapayEnabled || isAdmin || !(op as any).afribapay) : true)
  );

  // « Autres » : rails Fincra de zone (XOF/XAF) + internationaux (USD/EUR/GBP) en
  // payout. Conforme au dépôt : les Fincra de zone restent AUSSI visibles par pays.
  const ZONE_CURRENCIES = ['XOF', 'XAF', 'EUR', 'USD', 'GBP'];
  // Opérateurs MM Fincra par pays (fincraOperator présent) → affichés par pays
  // comme le softpay, pas sous « Autres ».
  const isZoneFincra = (op: any) => !!op.fincra && ZONE_CURRENCIES.includes(op.currency) && !op.fincraOperator;
  // Groupe « International » : piloté par /config.intl_rails (calculé serveur —
  // dim 3 par pays listé, ou dim 2 pour les pays non listés).
  const otherOps = displayOperators.filter(
    (op) => isZoneFincra(op) && (isAdmin || (intlRails?.payout ?? []).includes(op.id))
  );
  const operatorOthersLabel = (op: any): string => {
    if (!op?.fincra) return op?.name ?? '';
    const cur = op.currency as string;
    const zoneTag = cur === 'XOF' ? 'UEMOA · XOF' : cur === 'XAF' ? 'CEMAC · XAF' : cur;
    return (op.name as string).includes(cur) ? op.name : `${op.name} (${zoneTag})`;
  };
  // Nom affiché : suffixe la devise (USD, GBP…) sur les rails Fincra virement/carte
  // (libellés génériques) pour les distinguer dans la liste.
  const opName = (op: any): string => {
    const bankCard = !!op?.fincra && ['bank_transfer', 'SWIFT', 'SEPA', 'checkout'].includes(op?.rail);
    return (bankCard && op.currency && !String(op.name).includes(op.currency))
      ? `${op.name} (${op.currency})`
      : (op?.name ?? '');
  };

  const operatorsForStep = othersOpen
    ? otherOps
    : selectedCountry
      ? displayOperators.filter(
          (op) =>
            operatorServesCountry(op as any, selectedCountry) &&
            (isAdmin || isCodeEnabled(op.id, 'payout')) &&
            audienceOk(op.id)
        )
      : [];
  // Entrée « International » au niveau du picker pays (rails internationaux).
  // Toujours visible : un transfert peut partir vers n'importe quelle devise
  // (EUR/USD/GBP/etc.) quel que soit le pays de l'envoyeur.
  const showOthersEntry = otherOps.length > 0 && !selectedCountry;

  // Pays sélectionné mais aucun corridor payout actif → badge "indisponible".
  const showCorridorBanner =
    !isAdmin && corridorsLoaded && !!selectedCountry && !isPayoutAvailable(selectedCountry);

  const selectedOp = OPERATORS_SRC.find((op) => op.id === operator);
  const isFincraOp = !!(selectedOp as any)?.fincra;
  // Klasha réutilise l'UI Fincra ; ce flag route les appels API vers /payout/klasha.
  const isKlashaOp = !!(selectedOp as any)?.klasha;
  const fincraCurrency = isFincraOp ? ((selectedOp as any)?.currency as string) || 'XOF' : '';
  // Le rail est porté directement par l'opérateur Fincra (cf. config.ts).
  // Plus de sélecteur dynamique ; chaque opérateur Fincra = 1 rail.
  const fincraRail: FincraRail | '' = isFincraOp ? (((selectedOp as any)?.rail as FincraRail) || '') : '';
  // Sous-pays Fincra (XOF/XAF). Si le pays est déjà connu (pays sélectionné, ou
  // pays de l'utilisateur), on le déduit du contexte et on masque la liste.
  // Opérateur MM par pays (catalogue serveur) : pays figé = op.country (pas de picker).
  const fincraMmCountry = ((selectedOp as any)?.fincraOperator ? ((selectedOp as any)?.country || '') : '').toUpperCase();
  const fincraZoneList = (isFincraOp && fincraRail === 'mobile_money' && !fincraMmCountry)
    ? (catalogZones[fincraCurrency] ?? FINCRA_ZONES[fincraCurrency]) : undefined;
  const contextCountry = ((selectedCountry || user?.country) || '').toUpperCase();
  const zoneHasContext = !!fincraZoneList?.some((c) => c.code === contextCountry);
  const fincraDialCode = (isFincraOp && fincraRail === 'mobile_money')
    ? (fincraMmCountry
        ? (catalogDial[fincraMmCountry] || resolveFincraZone(fincraCurrency, fincraMmCountry).dialCode)
        : ((fincraZoneCountry && catalogDial[fincraZoneCountry]) || resolveFincraZone(fincraCurrency, fincraZoneCountry).dialCode))
    : undefined;

  // L'utilisateur saisit toujours dans la devise de son compte (XOF). La
  // conversion en XOF canonique sert aux frais, validations, contrôle de solde.
  const numAmountDisplay = parseFloat(amount) || 0;
  const numAmountXof = userCurrency === 'XOF'
    ? Math.round(numAmountDisplay)
    : convertToXof(numAmountDisplay);
  const userCountry = user?.country?.toUpperCase();
  // Frais = A→B : source = pays du user, destination = pays de l'opérateur visé
  // (= corridor.country_code côté backend). On affiche le frais résolu par le
  // backend (outgoing_fees, indexé par destination) → identique à l'exécution.
  const destCountry = (fincraMmCountry || fincraZoneCountry || (selectedOp as any)?.country || '').toUpperCase();
  // AUCUN fallback : on prend UNIQUEMENT le frais résolu par le backend pour cette
  // destination (outgoing_fees, calculé via PricingResolver). Si la clé manque, on
  // ne devine pas (ce serait un frais ≠ de celui débité) → on bloque l'envoi.
  const feeConfig = (destCountry && outgoingFees[destCountry]) || null;
  // Frais GoesPay appliqués AUSSI aux retraits Fincra (débités en XOF, comme les
  // retraits classiques). Base = valeur XOF envoyée.
  // Pas d'arrondi : le backend calcule fixed + montant×percent/100 sans arrondir
  // (PricingResolver::feeAmount). Arrondir ici ferait diverger l'annoncé du débité.
  const fees = useMemo(
    () => feeConfig ? feeConfig.fixed + numAmountXof * feeConfig.percent / 100 : 0,
    [numAmountXof, feeConfig]
  );
  const total = numAmountXof + fees;
  const feeLabel = !feeConfig ? ''
    : feeConfig.fixed > 0
      ? `${fmtXof(feeConfig.fixed, { approx: false })} + ${feeConfig.percent}%`
      : `${feeConfig.percent}%`;

  const fmt = (n: number) => n.toLocaleString('fr-FR').replace(/\s/g, '.');
  const fmtFincra = (n: number) =>
    `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${fincraCurrency}`;

  // wallet_fincra est en XOF : on débite exactement le montant XOF saisi.
  // On convertit ce XOF vers la devise Fincra pour le montant réellement envoyé
  // au bénéficiaire (NGN, GHS…), via les taux Fincra (isolés).
  //
  // Cas spécial : si userCurrency === fincraCurrency (ex : compte GHS + opérateur
  // Fincra Ghana), le montant saisi EST déjà le montant à envoyer chez Fincra —
  // aucune double-conversion (qui causerait une perte sur la triangulation).
  const fincraRate = useFincraRate(fincraCurrency, isFincraOp, isKlashaOp);
  const fincraSendAmount =
    isFincraOp && numAmountDisplay > 0
      ? (userCurrency === fincraCurrency
          ? numAmountDisplay
          : fincraCurrency === 'XOF'
              ? numAmountXof
              : (fincraRate.rate && fincraRate.rate > 0
                  ? Math.round((numAmountXof / fincraRate.rate) * 100) / 100
                  : null))
      : null;
  // Le débit XOF du wallet : en cas de short-circuit (userCurrency===fincraCurrency),
  // on aligne sur le taux Fincra pour rester cohérent ; sinon on garde la
  // conversion currencyStore (numAmountXof) déjà utilisée par les flux classiques.
  const fincraDebitXof = isFincraOp
    ? (userCurrency === fincraCurrency && fincraRate.rate && fincraRate.rate > 0
        ? Math.round(numAmountDisplay * fincraRate.rate)
        : numAmountXof)
    : null;
  // Montant transmis au backend : Fincra = devise Fincra ; sinon XOF.
  const numAmount = isFincraOp ? (fincraSendAmount ?? 0) : numAmountXof;
  // Bloque l'envoi tant que le taux Fincra n'est pas résolu (chargement / erreur).
  // Quand userCurrency === fincraCurrency, on n'a pas besoin du taux pour calculer
  // le montant envoyé — mais on garde le blocage si le taux est nécessaire pour
  // afficher fincraDebitXof correctement (sinon on tomberait sur numAmountXof).
  const fincraRateBlocking =
    isFincraOp && fincraCurrency !== 'XOF' && userCurrency !== fincraCurrency && numAmountDisplay > 0
    && (fincraRate.loading || fincraRate.error || fincraRate.rate === null);
  // Flux classiques : user non-XOF sans taux global → conversion 1:1 erronée.
  const classicRateBlocking =
    !isFincraOp && userCurrency !== 'XOF' && !((currencyRates[userCurrency] ?? 0) > 0);

  // Frais indisponibles : un moyen est choisi + un montant saisi mais le backend
  // n'a pas fourni de frais pour cette destination → on bloque (pas de devinette).
  const feeUnavailable = !!operator && numAmountXof > 0 && !feeConfig;
  const showFees = numAmountXof > 0 && operator && !!feeConfig;
  // Débit total XOF d'un retrait Fincra = coût Fincra (XOF) + frais GoesPay.
  const fincraTotalDebitXof = fincraDebitXof !== null ? fincraDebitXof + fees : null;

  const dialCode = useMemo(() => {
    if (!selectedCountry) return '';
    // Catalogue Marchés en priorité (admin peut éditer l'indicatif), sinon liste statique.
    const fromCatalog = catalogDial[selectedCountry];
    if (fromCatalog) return `+${fromCatalog}`;
    const c = ALL_COUNTRIES.find((c) => c.code === selectedCountry);
    return c ? `+${c.phone}` : '';
  }, [selectedCountry, catalogDial]);

  const normalizedPhone = phone.replace(/\s+/g, '').trim();

  const loadSavedPhones = async () => {
    try {
      const data = await walletService.getSavedPhones({ type: 'transfer' });
      setSavedPhones(data);
      setSavedPhonesLoadError(null);
    } catch (error: any) {
      setSavedPhonesLoadError(t('account.phonesLoadError'));
    }
  };

  const loadSavedBanks = async () => {
    try { setSavedBanks(await walletService.getSavedBanks()); } catch { /* silencieux */ }
  };

  // Applique un bénéficiaire bancaire enregistré : sélectionne le rail virement
  // de sa devise puis remplit les champs.
  const applyBankBeneficiary = (b: SavedBank) => {
    const cur = (b.currency || '').toUpperCase();
    const op = OPERATORS_SRC.find((o: any) => o.fincra && String(o.id).endsWith('-bt') && (o.currency || '').toUpperCase() === cur);
    if (op) {
      setOthersOpen(true);
      setSelectedCountry((op as any).country || null);
      setOperator((op as any).id);
    }
    setBankAccountHolder(b.account_holder || '');
    setBankAccountNumber(b.account_number || '');
    setBankName(b.bank_name || '');
    setBankCode(b.bank_code || '');
    setBankSwiftCode(b.swift_code || '');
    // BIC (SEPA) et code SWIFT sont stockés dans swift_code → on réhydrate les
    // deux champs selon le rail pour que la validation et l'envoi les retrouvent.
    setBic(b.swift_code || '');
    setSwiftCode(b.swift_code || '');
    setIban(b.iban || '');
    setBankCountry(b.country || '');
  };

  // Snapshot des valeurs initiales pour détecter une réelle modification au close.
  const initialFormRef = useRef({ amount: '', phone: '' });

  useEffect(() => {
    if (!visible) return;
    loadSavedPhones();
    loadSavedBanks();
    setBankPickerSavedVisible(false);
    setSaveBankModalVisible(false);
    setSaveBankName('');
    setSelectedCountry(null);
    setOperator('');
    setCryptoOpen(false);
    setOthersOpen(false);
    setFincraZoneCountry(null);
    setBankAccountHolder('');
    setBankAccountNumber('');
    setBankName('');
    setBankCode('');
    setBankSwiftCode('');
    setBankCountry('');
    setIban('');
    setBic('');
    setSwiftCode('');
    setResolvedHolder(null);
    setResolveError(null);
    setResolving(false);
    setBankPickerVisible(false);
    setBankSearchQuery('');
    setPollingState('idle');
    setPendingDetails(null);
    // Pré-remplir le téléphone si fourni par l'appelant (tap sur un bénéficiaire
    // depuis la home). Sinon on garde la valeur courante.
    if (prefillPhone) setPhone(prefillPhone);
    if (prefillBank) applyBankBeneficiary(prefillBank);
    // amount et phone ne sont PAS réinitialisés à l'ouverture (rétrocompat) ;
    // on capture leur valeur initiale comme baseline pour le dirty-check.
    initialFormRef.current = { amount, phone: prefillPhone ?? phone };
  }, [visible]);

  // Reset le sous-pays Fincra à chaque changement d'opérateur.
  useEffect(() => { setFincraZoneCountry(null); }, [operator]);

  // Auto-sélectionne le sous-pays Fincra depuis le contexte (pays déjà connu).
  useEffect(() => {
    if (fincraRail === 'mobile_money' && zoneHasContext && fincraZoneCountry !== contextCountry) {
      setFincraZoneCountry(contextCountry);
    }
  }, [fincraRail, zoneHasContext, contextCountry, fincraZoneCountry]);

  // Charge les taux crypto quand on ouvre le groupe « Crypto-monnaies ».
  useEffect(() => { if (cryptoOpen) fetchCryptoRates(cryptoRates.length === 0); }, [cryptoOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Charge la liste des banques Fincra quand on entre en rail bank_transfer.
  // Cache local : on garde la liste tant que la devise ne change pas.
  const fincraCountry = useMemo(() => {
    // Mapping minimal devise → pays (ISO-2) pour l'endpoint /core/banks.
    const map: Record<string, string> = {
      NGN: 'NG', GHS: 'GH', KES: 'KE', UGX: 'UG', ZMW: 'ZM', TZS: 'TZ',
      XOF: 'SN', XAF: 'CM', ZAR: 'ZA', EGP: 'EG',
    };
    return map[fincraCurrency] || 'NG';
  }, [fincraCurrency]);

  useEffect(() => {
    if (!isFincraOp || fincraRail !== 'bank_transfer' || !fincraCurrency) return;
    let cancelled = false;
    setBanksLoading(true);
    (isKlashaOp ? walletService.getKlashaBanks(fincraCurrency) : walletService.getFincraBanks(fincraCurrency, fincraCountry))
      .then((res) => { if (!cancelled) setFincraBanks(res.banks || []); })
      .catch(() => { if (!cancelled) setFincraBanks([]); })
      .finally(() => { if (!cancelled) setBanksLoading(false); });
    return () => { cancelled = true; };
  }, [isFincraOp, isKlashaOp, fincraRail, fincraCurrency, fincraCountry]);

  // Résolution automatique du compte bénéficiaire (debounce 600ms).
  // Sandbox Fincra renvoie data:null → on signale "non vérifié" sans bloquer.
  // Fincra ne supporte la résolution que pour NGN (NUBAN) et GHS (bank_account + bankSwiftCode).
  const resolveSupported = isFincraOp && fincraRail === 'bank_transfer' && ['NGN', 'GHS'].includes(fincraCurrency);
  useEffect(() => {
    if (!resolveSupported) {
      setResolvedHolder(null); setResolveError(null); setResolving(false);
      return;
    }
    const num = bankAccountNumber.trim();
    const hasBankRef = fincraCurrency === 'NGN'
      ? !!bankCode.trim()
      : !!bankSwiftCode.trim();
    if (!num || !hasBankRef || num.length < 8) {
      setResolvedHolder(null); setResolveError(null); return;
    }
    setResolving(true);
    setResolveError(null);
    const handle = setTimeout(async () => {
      try {
        const payload = fincraCurrency === 'NGN'
          ? { accountNumber: num, bankCode: bankCode.trim(), type: 'nuban' as const, currency: 'NGN' }
          : { accountNumber: num, bankSwiftCode: bankSwiftCode.trim(), type: 'bank_account' as const, currency: fincraCurrency };
        const res = isKlashaOp
          ? await walletService.resolveKlashaAccount({
              accountNumber: (payload as any).accountNumber,
              bankCode: (payload as any).bankCode ?? (payload as any).bankSwiftCode ?? '',
              currency: (payload as any).currency,
            })
          : await walletService.resolveFincraAccount(payload);
        if (res.resolved && res.accountName) {
          setResolvedHolder(res.accountName);
          setBankAccountHolder(res.accountName);
        } else {
          setResolvedHolder(null);
          setResolveError('not_verified');
        }
      } catch (e: any) {
        setResolvedHolder(null);
        setResolveError(e?.response?.data?.error || 'resolve_failed');
      } finally {
        setResolving(false);
      }
    }, 600);
    return () => clearTimeout(handle);
  }, [resolveSupported, bankAccountNumber, bankCode, bankSwiftCode, fincraCurrency]);

  const filteredBanks = useMemo(() => {
    const q = bankSearchQuery.trim().toLowerCase();
    if (!q) return fincraBanks;
    return fincraBanks.filter((b) =>
      b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q)
    );
  }, [fincraBanks, bankSearchQuery]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    pollingTransferIdRef.current = null;
    pollingFincraRefRef.current = null;
    pollingIsWireRef.current = false;
    consecutiveErrorsRef.current = 0;
  }, []);

  const checkStatus = useCallback(async (opts: { transferId?: number; fincraRef?: string; isWire?: boolean }): Promise<boolean> => {
    try {
      const res = opts.fincraRef
        ? (opts.isWire
            ? await walletService.getKlashaWireStatus(opts.fincraRef)
            : opts.fincraRef.startsWith('KLW-')
              ? await walletService.getKlashaPayoutStatus(opts.fincraRef)
              : await walletService.getFincraPayoutStatus(opts.fincraRef))
        : await walletService.getTransferStatus(opts.transferId!);
      consecutiveErrorsRef.current = 0;
      if (res.statut === 'success') {
        stopPolling();
        setPollingState('success');
        fetchBalance().catch(() => {});
        return true;
      } else if (res.statut === 'fail' || res.statut === 'failed') {
        stopPolling();
        setPollingState('failed');
        fetchBalance().catch(() => {});
        return true;
      }
    } catch {
      consecutiveErrorsRef.current++;
      if (consecutiveErrorsRef.current >= 5) {
        stopPolling();
        setPollingState('timeout');
        return true;
      }
    }
    return false;
  }, [fetchBalance, stopPolling]);

  const startPolling = useCallback((opts: { transferId?: number; fincraRef?: string; isWire?: boolean }) => {
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // 5 min max (toutes les 5s)
    setPollingState('pending');
    pollingTransferIdRef.current = opts.transferId ?? null;
    pollingFincraRefRef.current = opts.fincraRef ?? null;
    pollingIsWireRef.current = !!opts.isWire;
    consecutiveErrorsRef.current = 0;

    const poll = async () => {
      attempts++;
      const resolved = await checkStatus(opts);
      if (resolved) return;
      if (attempts >= MAX_ATTEMPTS) {
        stopPolling();
        setPollingState('timeout');
      }
    };

    poll();
    pollingRef.current = setInterval(poll, 5000);
  }, [checkStatus, stopPolling]);

  // Vérification immédiate au retour foreground (mobile) ou onglet visible (web)
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active' && pollingState === 'pending') {
        if (pollingFincraRefRef.current) checkStatus({ fincraRef: pollingFincraRefRef.current, isWire: pollingIsWireRef.current });
        else if (pollingTransferIdRef.current) checkStatus({ transferId: pollingTransferIdRef.current });
      }
    });
    return () => sub.remove();
  }, [checkStatus, pollingState]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && pollingState === 'pending') {
        if (pollingFincraRefRef.current) checkStatus({ fincraRef: pollingFincraRefRef.current, isWire: pollingIsWireRef.current });
        else if (pollingTransferIdRef.current) checkStatus({ transferId: pollingTransferIdRef.current });
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [checkStatus, pollingState]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const saveCurrentPhone = async () => {
    if (!normalizedPhone) return;

    const existing = savedPhones.find((item) => item.tel.replace(/\s+/g, '') === normalizedPhone);
    if (existing) return;

    setSavePhoneName('');
    setSavePhoneOperator(operator);
    setSavePhoneModalVisible(true);
  };

  const removeCurrentPhone = async () => {
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
    if (!normalizedPhone) return;
    if (!savePhoneOperator) {
      showAlert(t('common.error'), t('depositModal.selectOperator'));
      return;
    }
    const existing = savedPhones.find((item) => item.tel.replace(/\s+/g, '') === normalizedPhone);
    if (existing) {
      setSavePhoneModalVisible(false);
      return;
    }

    setSavePhoneLoading(true);
    try {
      const created = await walletService.createSavedPhone({
        tel: normalizedPhone,
        name: savePhoneName.trim(),
        type: 'transfer',
        operator: savePhoneOperator,
      });
      setSavedPhones((prev) => [created, ...prev]);
      setPhone(normalizedPhone);
      setSavePhoneModalVisible(false);
      setSavePhoneName('');
      showAlert(t('common.success'), t('transferModal.phoneSaved'));
    } catch (error: any) {
      showAlert(t('common.error'), error?.response?.data?.error || error?.response?.data?.message || t('transferModal.phoneSaveError'));
    } finally {
      setSavePhoneLoading(false);
    }
  };

  // Enregistre le bénéficiaire bancaire courant (duo banque/compte + nom).
  const confirmSaveCurrentBank = async () => {
    const acct = (bankAccountNumber.trim() || iban.trim());
    if (!acct) { showAlert(t('common.error'), t('transferModal.bankAccountRequired')); return; }
    setSaveBankLoading(true);
    try {
      const created = await walletService.createSavedBank({
        name: saveBankName.trim() || (bankAccountHolder.trim() || bankName.trim()),
        account_holder: bankAccountHolder.trim(),
        account_number: bankAccountNumber.trim(),
        bank_code: bankCode.trim(),
        bank_name: bankName.trim(),
        currency: fincraCurrency,
        country: bankCountry.trim() || undefined,
        swift_code: (bankSwiftCode.trim() || swiftCode.trim() || bic.trim()) || undefined,
        iban: iban.trim() || undefined,
        rail: fincraRail || undefined,
      });
      setSavedBanks((prev) => [created, ...prev]);
      setSaveBankModalVisible(false);
      setSaveBankName('');
      showAlert(t('common.success'), t('transferModal.bankSaved'));
    } catch (error: any) {
      showAlert(t('common.error'), error?.response?.data?.error || error?.response?.data?.message || t('transferModal.bankSaveError'));
    } finally {
      setSaveBankLoading(false);
    }
  };

  const handleClose = () => {
    if (pollingState !== 'idle') {
      stopPolling();
      setPollingState('idle');
      onClose();
      return;
    }
    // Dirty-check : on confirme uniquement si l'utilisateur a réellement édité.
    const init = initialFormRef.current;
    const isDirty =
      amount !== init.amount ||
      phone !== init.phone ||
      !!operator.trim() ||
      selectedCountry !== null ||
      fincraZoneCountry !== null ||
      !!bankAccountHolder.trim() ||
      !!bankAccountNumber.trim() ||
      !!bankName.trim() ||
      !!bankCode.trim() ||
      !!bankSwiftCode.trim() ||
      !!iban.trim() ||
      !!bic.trim() ||
      !!swiftCode.trim();
    if (isDirty) {
      showAlert(
        t('transferModal.cancelTransfer'),
        t('transferModal.infoLost'),
        [
          { text: t('common.continue') },
          { text: t('common.quit'), onPress: onClose },
        ],
      );
    } else {
      onClose();
    }
  };

  const handlePressEnvoyer = () => {
    if (user?.validate !== 1) {
      showAlert(t('depositModal.kycRequired3'), t('depositModal.kycRequired2'));
      return;
    }
    if (classicRateBlocking) {
      showAlert(t('common.error'), t('common.rateUnavailable'));
      return;
    }
    if (feeUnavailable) {
      showAlert(t('common.error'), t('transferModal.feeUnavailable'));
      return;
    }
    // Fincra : le solde est en XOF, on compare au montant XOF saisi (débité).
    if (isFincraOp) {
      if (fincraRateBlocking || fincraSendAmount === null || fincraDebitXof === null) {
        showAlert(t('common.error'), t('common.rateUnavailable'));
        return;
      }
      if ((fincraTotalDebitXof ?? fincraDebitXof) > balance) {
        showAlert(t('common.error'), t('transferModal.insufficientBalance'));
        return;
      }
      // SEPA : Fincra exige IBAN + nom du bénéficiaire + BIC. On bloque avant
      // l'envoi pour éviter le 422 « beneficiary.bankCode is not allowed to be empty ».
      if (fincraRail === 'SEPA') {
        const code = bic.trim() || bankSwiftCode.trim();
        if (!iban.trim() || !bankAccountHolder.trim() || !code) {
          showAlert(t('common.error'), t('transferModal.bankFieldsRequired'));
          return;
        }
      }
      // SWIFT : pas d'IBAN hors Europe (Chine, USA… = n° de compte local) → on
      // accepte compte OU IBAN. Le PAYS de la banque (ISO-2) est OBLIGATOIRE :
      // Fincra l'exige et il n'est pas dérivable sans IBAN → sinon 422 Fincra.
      if (fincraRail === 'SWIFT') {
        const code = swiftCode.trim() || bankSwiftCode.trim();
        const account = bankAccountNumber.trim() || iban.trim();
        if (!account || !bankAccountHolder.trim() || !code) {
          showAlert(t('common.error'), t('transferModal.bankFieldsRequired'));
          return;
        }
        if (!/^[A-Z]{2}$/.test(bankCountry.trim().toUpperCase())) {
          showAlert(t('common.error'), t('transferModal.bankCountryRequired'));
          return;
        }
      }
    }
    setConfirmed(false);
    setConfirmVisible(true);
  };

  const handleTransfer = async () => {
    setConfirmVisible(false);
    setLoading(true);
    try {
      if (isFincraOp) {
        // ── Wire international Klasha (USD/EUR/GBP) : process Klasha distinct
        // (bénéficiaire → quote → initiate côté backend). Bénéficiaire avec le jeu
        // de champs Klasha (≠ payout MM/bank). Réf KLW-, polling wire dédié. ──
        if (isKlashaOp && fincraRail === 'wire') {
          const isoCountry = bankCountry.trim().toUpperCase();
          // Klasha Wire attend `country` = nom complet (« China ») et `countryCode`
          // = ISO-2 (« CN »). On résout le nom via ALL_COUNTRIES (repli = code).
          const countryName = ALL_COUNTRIES.find((c) => c.code === isoCountry)?.name || isoCountry;
          const result = await walletService.klashaWire({
            amount: numAmount,
            currency: fincraCurrency,
            amount_xof: fincraDebitXof ?? numAmountXof,
            beneficiary: {
              beneficiaryName: bankAccountHolder.trim(),
              accountNumber: bankAccountNumber.trim() || iban.trim(),
              bankName: bankName.trim(),
              swiftCode: swiftCode.trim() || bic.trim(),
              country: countryName,
              countryCode: isoCountry,
              iban: iban.trim() || undefined,
              routingNumber: routingNumber.trim() || undefined,
              bankAddress: bankAddress.trim() || undefined,
              beneficiaryAddress: beneficiaryAddress.trim() || undefined,
              phone: (user as any)?.phone || undefined,
              email: (user as any)?.email || undefined,
            },
          });
          await fetchBalance();
          setAmount('');
          setPendingDetails({
            amount_sent: numAmount,
            fees: Number(result.fees) || 0,
            phone: bankAccountNumber || iban,
            debit_xof: fincraTotalDebitXof ?? fincraDebitXof ?? 0,
          });
          startPolling({ fincraRef: result.reference, isWire: true });
          return;
        }

        const beneficiary = fincraRail !== 'mobile_money' ? {
          accountHolderName: bankAccountHolder.trim(),
          firstName: bankAccountHolder.trim().split(' ').slice(0, -1).join(' ') || bankAccountHolder.trim(),
          lastName: bankAccountHolder.trim().split(' ').slice(-1).join(' ') || '',
          accountNumber: bankAccountNumber.trim() || iban.trim(),
          bankName: bankName.trim(),
          // Fincra exige un bankCode NON vide. Virements locaux (NGN/GHS) : code
          // banque du sélecteur. SEPA : le BIC. SWIFT : le code SWIFT. Sans ça,
          // Fincra renvoie 422 « beneficiary.bankCode is not allowed to be empty ».
          bankCode: bankCode.trim()
            || (fincraRail === 'SEPA' ? (bic.trim() || bankSwiftCode.trim()) : '')
            || (fincraRail === 'SWIFT' ? (swiftCode.trim() || bankSwiftCode.trim()) : ''),
          // bankSwiftCode : sélectionné via le picker pour GHS/KES/etc., ou saisi
          // manuellement pour SWIFT/SEPA via le champ dédié.
          bankSwiftCode: (bankSwiftCode.trim() || swiftCode.trim() || bic.trim()) || undefined,
          // country (bénéficiaire) requis par Fincra pour UGX/ZMW/TZS — on
          // l'envoie systématiquement pour les rails bancaires (= pays de la
          // devise Fincra), sauf SWIFT/SEPA où l'utilisateur peut le surcharger
          // via bankCountry.
          country: fincraRail === 'bank_transfer'
            ? fincraCountry
            : (bankCountry.trim() || undefined),
          bankCountry: bankCountry.trim() || undefined,
          iban: iban.trim() || undefined,
          bic: bic.trim() || undefined,
          swiftCode: swiftCode.trim() || undefined,
          type: 'individual' as const,
        } : undefined;

        // Fincra payout MM exige le phone SANS `+` (ex: 256770000000) et le
        // pays du BÉNÉFICIAIRE (ISO-2 dérivé de la devise ou du sous-pays).
        const rz = resolveFincraZone(fincraCurrency, fincraZoneCountry || fincraMmCountry);
        // Indicatif & pays bénéficiaire : opérateur par pays (catalogue) > sous-pays > zone.
        const dialCode = fincraDialCode || rz.dialCode;
        const countryIso2 = fincraMmCountry || fincraZoneCountry || rz.countryIso2;
        // Opérateur Fincra (ORANGE…) porté par la tuile ; fallback offline (config.ts).
        const mmOperator = (selectedOp as any)?.fincraOperator
          || (fincraCurrency === 'GHS' ? 'MTN'
            : fincraCurrency === 'KES' ? 'SAFARICOM'
            : fincraCurrency === 'TZS' ? 'AIRTEL'
            : fincraCurrency === 'ZMW' ? 'MTN'
            : 'ORANGE');
        const phoneForFincra = fincraRail === 'mobile_money'
          ? formatFincraPhone(normalizedPhone, dialCode, false)
          : undefined;

        const result = await (isKlashaOp ? walletService.klashaPayout : walletService.fincraPayout)({
          amount: numAmount,
          // XOF saisi par l'utilisateur = base du débit wallet (le backend débite
          // amount_xof + frais, sans round-trip via le taux → débit = devis montré).
          amount_xof: fincraDebitXof ?? numAmountXof,
          currency: fincraCurrency,
          rail: fincraRail as FincraRail,
          phone: phoneForFincra,
          operator: fincraRail === 'mobile_money' ? mmOperator : undefined,
          country: fincraRail === 'mobile_money' ? countryIso2 : undefined,
          accountHolderName: fincraRail === 'mobile_money'
            ? `${user?.name ?? ''} ${user?.surname ?? ''}`.trim() || undefined
            : undefined,
          beneficiary,
        } as any);

        await fetchBalance();
        setAmount('');
        // Garde la sélection Fincra pour permettre un second envoi rapide.
        // debit_xof : montant réellement débité du wallet (XOF). Utilisé dans
        // le success screen pour afficher le total en devise utilisateur, pas
        // en devise Fincra (NGN, GHS…) qui n'est pas la devise du wallet.
        setPendingDetails({
          // `result.amount_sent` est en XOF (débit), pas en devise Fincra → on
          // affiche `numAmount` (= montant Fincra livré, déjà confirmé au form),
          // sinon le succès montrerait le XOF formaté en NGN/GHS (contradiction).
          amount_sent: numAmount,
          fees: Number(result.fees) || 0,
          phone: fincraRail === 'mobile_money' ? normalizedPhone : (bankAccountNumber || iban),
          debit_xof: fincraTotalDebitXof ?? fincraDebitXof ?? 0,
        });
        startPolling({ fincraRef: result.reference });
        return;
      }

      const result = await walletService.transfer({
        amount: numAmount,
        moyen: operator,
        tel: normalizedPhone,
      });
      const existing = savedPhones.find((item) => item.tel.replace(/\s+/g, '') === normalizedPhone);
      if (!existing && normalizedPhone) {
        const created = await walletService.createSavedPhone({ tel: normalizedPhone, name: '', type: 'transfer' });
        setSavedPhones((prev) => [created, ...prev]);
      }
      await fetchBalance();
      setAmount('');
      setOperator('');
      setPhone('');

      if (result?.transfer_id) {
        setPendingDetails({
          amount_sent: Number(result.amount_sent) || numAmount,
          fees: Number(result.fees) || fees,
          phone: normalizedPhone,
        });
        startPolling({ transferId: result.transfer_id });
      } else {
        // Fallback rétrocompat si le backend ne renvoie pas encore transfer_id
        const msg = result?.message
          ? `${result.message}\n${t('transferModal.amountSentDetail')}: ${fmtXof(Number(result.amount_sent))}\n${t('transferModal.feesDetail')}: ${fmtXof(Number(result.fees))}`
          : t('transferModal.transferSuccess');
        showAlert(t('common.success'), msg, [{ text: 'OK', onPress: onClose }]);
      }
    } catch (error: any) {
      // Le transfert peut avoir abouti côté serveur même si la requête a échoué
      // (timeout passerelle, réponse mal formée, etc.). On rafraîchit le solde
      // pour refléter l'état réel et on invite l'utilisateur à vérifier l'historique.
      try { await fetchBalance(); } catch {}
      const data = error?.response?.data;
      const serverMsg = data?.error || data?.message
        || (data?.errors && typeof data.errors === 'object'
            ? Object.values(data.errors).flat().filter(Boolean).join('\n')
            : null);
      const isTimeout = error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '');
      // Sur timeout, le transfert a pu aboutir côté serveur → message dédié.
      const base = (serverMsg && typeof serverMsg === 'string' && serverMsg.trim())
        ? serverMsg
        : isTimeout ? t('transferModal.requestTimeout')
        : !error?.response ? noConnectionMessage(t)
        : error?.response?.status >= 500 ? t('common.serverError')
        : t('transferModal.transferError');
      showAlert(t('common.error'), base);
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
            <Text style={styles.title}>{t('transferModal.title2')}</Text>
            <TouchableOpacity onPress={handleClose}>
              <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {pollingState === 'pending' && (
            <View style={styles.pollingContainer}>
              <ActivityIndicator size="large" color={Colors.primary} />
              <Text style={styles.pollingTitle}>{t('transferModal.processingTitle')}</Text>
              <Text style={styles.pollingMessage}>{t('transferModal.waitingConfirmation')}</Text>
              <Button title={t('transferModal.checkLater')} onPress={() => { stopPolling(); setPollingState('idle'); onClose(); }} style={{ marginTop: Spacing.lg }} />
            </View>
          )}

          {pollingState === 'success' && (
            <View style={styles.pollingContainer}>
              <FontAwesome6 name="circle-check" size={64} color={Colors.success} />
              <Text style={[styles.pollingTitle, { color: Colors.success }]}>{t('transferModal.transferConfirmed')}</Text>
              <Text style={styles.pollingMessage}>{t('transferModal.transferConfirmedMsg')}</Text>
              {pendingDetails && (
                <View style={[styles.feesBox, { width: '100%' }]}>
                  {!!pendingDetails.phone && (
                    <View style={styles.feesRow}>
                      <Text style={styles.feesLabel}>{t('transferModal.recipient')}</Text>
                      <Text style={styles.feesValue}>{pendingDetails.phone}</Text>
                    </View>
                  )}
                  <View style={styles.feesRow}>
                    <Text style={styles.feesLabel}>{t('transferModal.amountSentDetail')}</Text>
                    <Text style={styles.feesValue}>
                      {isFincraOp ? fmtFincra(pendingDetails.amount_sent) : fmtXof(pendingDetails.amount_sent)}
                    </Text>
                  </View>
                  {!isFincraOp && (
                    <View style={styles.feesRow}>
                      <Text style={styles.feesLabel}>{t('transferModal.feesDetail')}</Text>
                      <Text style={styles.feesValue}>{fmtXof(pendingDetails.fees)}</Text>
                    </View>
                  )}
                  <View style={[styles.feesRow, styles.feesTotalRow]}>
                    <Text style={styles.feesTotalLabel}>{t('transferModal.totalDebited')}</Text>
                    <Text style={styles.feesTotalValue}>
                      {isFincraOp
                        ? fmtXof(pendingDetails.debit_xof ?? 0)
                        : fmtXof(pendingDetails.amount_sent + pendingDetails.fees)}
                    </Text>
                  </View>
                </View>
              )}
              <Button title={t('common.close')} onPress={() => { setPollingState('idle'); setPendingDetails(null); onClose(); }} style={{ marginTop: Spacing.lg }} />
            </View>
          )}

          {pollingState === 'failed' && (
            <View style={styles.pollingContainer}>
              <FontAwesome6 name="circle-xmark" size={64} color={Colors.error ?? '#e53935'} />
              <Text style={[styles.pollingTitle, { color: Colors.error ?? '#e53935' }]}>{t('transferModal.transferFailedTitle')}</Text>
              <Text style={styles.pollingMessage}>{t('transferModal.transferFailedMsg')}</Text>
              <Button title={t('common.close')} onPress={() => { setPollingState('idle'); onClose(); }} style={{ marginTop: Spacing.lg }} />
            </View>
          )}

          {pollingState === 'timeout' && (
            <View style={styles.pollingContainer}>
              <FontAwesome6 name="clock" size={64} color={Colors.warning ?? '#F4B228'} />
              <Text style={[styles.pollingTitle, { color: Colors.warning ?? '#F4B228' }]}>{t('transferModal.processingTitle')}</Text>
              <Text style={styles.pollingMessage}>{t('transferModal.pollingTimeout')}</Text>
              <Button title={t('transferModal.viewHistory')} onPress={() => { setPollingState('idle'); onClose(); }} style={{ marginTop: Spacing.lg }} />
            </View>
          )}

          {pollingState === 'idle' && <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" contentContainerStyle={{ paddingBottom: Spacing.xl }}>
            <TransactionAlertBanner type="transfer" />
            {isAdmin && !transferEnabled && (
              <AdminDisabledBanner message={t('admin.bannerTransfer')} />
            )}
            {isAdmin && transferEnabled && !afribapayEnabled && (
              <AdminDisabledBanner message={t('admin.bannerAfribapay')} />
            )}
            {user?.validate !== 1 && (
              <View style={styles.kycBanner}>
                <FontAwesome6 name="triangle-exclamation" size={14} color={Colors.warning} style={{ marginRight: 8 }} />
                <Text style={styles.kycBannerText}>{t('transferModal.kycRequired')}</Text>
              </View>
            )}
            {!selectedCountry && !cryptoOpen && !othersOpen ? (
              <CountryPickerStep
                operators={displayOperators.filter((op) => !isZoneFincra(op))}
                onSelectCountry={(code) => { setSelectedCountry(code); setOperator(''); }}
                showCardTile={showOthersEntry}
                cardLabel={t('depositModal.others')}
                onSelectCard={() => { setOthersOpen(true); setOperator(''); }}
                showCryptoTile={cryptoEnabled}
                cryptoLabel={t('depositModal.cryptoGroup')}
                onSelectCrypto={() => { setCryptoOpen(true); setOperator(''); }}
                label={t('transferModal.chooseCountry')}
              />
            ) : othersOpen ? (
              <>
                <Text style={styles.operatorLabel}>{t('depositModal.others')}</Text>
                <TouchableOpacity
                  onPress={() => { setOthersOpen(false); setOperator(''); }}
                  style={styles.changeCountryBtn}
                >
                  <FontAwesome6 name="arrow-left" size={12} color={Colors.secondary} />
                  <Text style={styles.changeCountryText}>{t('transferModal.changeCountry')}</Text>
                </TouchableOpacity>
                <View style={styles.operatorListVertical}>
                  {(operator ? operatorsForStep.filter((op) => op.id === operator) : operatorsForStep).map((op) => (
                    <TouchableOpacity
                      key={op.id}
                      style={[styles.operatorRow, operator === op.id && styles.operatorRowSelected]}
                      onPress={() => setOperator(operator === op.id ? '' : op.id)}
                    >
                      <Image source={op.logo} style={styles.operatorRowLogo} resizeMode="contain" />
                      <Text
                        style={[styles.operatorRowName, operator === op.id && styles.operatorRowNameSelected]}
                        numberOfLines={1}
                      >
                        {op.flag ? `${op.flag} ` : ''}{operatorOthersLabel(op)}
                      </Text>
                      <GatewayBadge op={op} visible={isAdmin} size={16} />
                      {operator === op.id && (
                        <FontAwesome6 name="xmark" size={14} color={Colors.secondary} />
                      )}
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : cryptoOpen ? (
              <>
                <Text style={styles.operatorLabel}>{t('depositModal.cryptoGroup')}</Text>
                <TouchableOpacity
                  onPress={() => { setCryptoOpen(false); setOperator(''); }}
                  style={styles.changeCountryBtn}
                >
                  <FontAwesome6 name="arrow-left" size={12} color={Colors.secondary} />
                  <Text style={styles.changeCountryText}>{t('transferModal.changeCountry')}</Text>
                </TouchableOpacity>
                {cryptoRates.length === 0 ? (
                  <Text style={styles.phoneHint}>{t('common.loading')}</Text>
                ) : (
                  <View style={styles.operatorListVertical}>
                    {cryptoRates.map((c) => {
                      const source = pickCryptoSource(c);
                      return (
                        <TouchableOpacity
                          key={c.code}
                          style={styles.operatorRow}
                          onPress={() => onBuyCrypto?.(c.code)}
                        >
                          {source ? (
                            <Image source={source as any} style={styles.operatorRowLogo} resizeMode="contain" />
                          ) : (
                            <FontAwesome6 name="bitcoin-sign" size={20} color={Colors.text} style={{ width: 32, textAlign: 'center' }} />
                          )}
                          <Text style={styles.operatorRowName} numberOfLines={1}>{c.name || c.code}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            ) : (
              <>
                <Text style={styles.operatorLabel}>{t('transferModal.chooseOperator')}</Text>
                <TouchableOpacity
                  onPress={() => { setSelectedCountry(null); setOperator(''); }}
                  style={styles.changeCountryBtn}
                >
                  <FontAwesome6 name="arrow-left" size={12} color={Colors.secondary} />
                  <Text style={styles.changeCountryText}>{t('transferModal.changeCountry')}</Text>
                </TouchableOpacity>
                {showCorridorBanner && (
                  <CorridorUnavailableBanner
                    country={selectedCountry}
                    countryName={ALL_COUNTRIES.find((c) => c.code === selectedCountry)?.name || selectedCountry}
                    message={t('corridor.unavailable', { country: ALL_COUNTRIES.find((c) => c.code === selectedCountry)?.name || selectedCountry })}
                    notifyLabel={t('corridor.notifyMe')}
                    notifiedLabel={t('corridor.notified')}
                  />
                )}
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
                      {op.flag ? `${op.flag} ` : ''}{opName(op)}
                    </Text>
                    <GatewayBadge op={op} visible={isAdmin} size={14} />
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              // Mobile : liste verticale. Une fois un opérateur choisi, on masque
              // les autres et on ne garde que la ligne sélectionnée (avec un X
              // pour revenir au choix). Le formulaire s'affiche juste en-dessous.
              <View style={styles.operatorListVertical}>
                {(operator ? operatorsForStep.filter((op) => op.id === operator) : operatorsForStep).map((op) => (
                  <TouchableOpacity
                    key={op.id}
                    style={[styles.operatorRow, operator === op.id && styles.operatorRowSelected]}
                    onPress={() => setOperator(operator === op.id ? '' : op.id)}
                  >
                    <OperatorLogo op={op as any} size={32} style={styles.operatorRowLogo as any} />
                    <Text
                      style={[styles.operatorRowName, operator === op.id && styles.operatorRowNameSelected]}
                      numberOfLines={1}
                    >
                      {op.flag ? `${op.flag} ` : ''}{opName(op)}
                    </Text>
                    <GatewayBadge op={op} visible={isAdmin} size={16} />
                    {operator === op.id && (
                      <FontAwesome6 name="xmark" size={14} color={Colors.secondary} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
                )}
              </>
            )}

            {/* Le reste du form n'apparaît qu'après le choix d'un opérateur. */}
            {operator ? (
            <>
            <View style={styles.balanceRow}>
              <FontAwesome6 name="wallet" size={12} color={Colors.textMuted} />
              <Text style={styles.balanceText}>{t('transferModal.availableBalance')} : </Text>
              <Text style={styles.balanceAmount}>
                {fmtXof(balance ?? 0)}
              </Text>
            </View>

            {/* Montant + suite. Pour Fincra, le rail est porté par l'opérateur lui-même
                (cf. config.ts), plus de sélecteur intermédiaire. */}
            {(!isFincraOp || !!fincraRail) && (
            <>
            <Input
              label={t('transferModal.amountLabel', { currency: userCurrency })}
              placeholder={`Min. ${fmtXof(
                (user?.country ?? '').toUpperCase() === 'NG'
                  ? transferMinNg
                  : (userCountry && countryFees[userCountry] ? transferMin : transferMinWorld)
              )}`}
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
              keyboardType="decimal-pad"
            />

            {/* Montant reçu par le bénéficiaire (devise Fincra). XOF→XOF ou
                userCurrency === fincraCurrency : pas d'affichage redondant. */}
            {isFincraOp && fincraCurrency !== 'XOF' && userCurrency !== fincraCurrency && numAmountDisplay > 0 && (
              <FincraConversionHint
                loading={fincraRate.loading}
                error={fincraRate.error || fincraSendAmount === null}
                label={t('transferModal.fincraReceives')}
                amount={fincraSendAmount}
                currency={fincraCurrency}
              />
            )}

            {classicRateBlocking && (
              <View style={{ marginTop: -Spacing.xs, marginBottom: Spacing.sm }}>
                <Text style={[styles.phoneHint, { color: Colors.error }]}>{t('common.rateUnavailable')}</Text>
              </View>
            )}

            {feeUnavailable && (
              <View style={{ marginTop: -Spacing.xs, marginBottom: Spacing.sm }}>
                <Text style={[styles.phoneHint, { color: Colors.error }]}>{t('transferModal.feeUnavailable')}</Text>
              </View>
            )}

            {/* Frais en live (jamais affichés pour Fincra : pas de frais côté GoesPay) */}
            {showFees ? (
              <View style={styles.feesBox}>
                <View style={styles.feesRow}>
                  <Text style={styles.feesLabel}>{t('transferModal.fees')} ({feeLabel})</Text>
                  <Text style={[styles.feesValue, { color: Colors.error }]}>+ {fmtXof(fees)}</Text>
                </View>
                <View style={[styles.feesRow, styles.feesTotalRow]}>
                  <Text style={styles.feesTotalLabel}>{t('transferModal.totalDebited')}</Text>
                  <Text style={styles.feesTotalValue}>{fmtXof(total)}</Text>
                </View>
              </View>
            ) : null}

            {/* Sélecteur de sous-pays Fincra XOF/XAF — masqué si le pays est déjà connu. */}
            {fincraZoneList && !zoneHasContext && (
              <View style={{ gap: Spacing.xs }}>
                <Text style={styles.zoneLabel}>{t('transferModal.chooseCountry')}</Text>
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

            {/* Champ téléphone — visible pour les flux PayDunya/AfribaPay et pour Fincra mobile_money */}
            {(!isFincraOp || fincraRail === 'mobile_money') && (
              <>
                <Input
                  label={t('transferModal.phoneLabel')}
                  placeholder={isFincraOp && fincraRail === 'mobile_money'
                    ? '770000000'
                    : t('transferModal.phonePlaceholder')}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  prefix={isFincraOp && fincraRail === 'mobile_money'
                    ? (fincraDialCode ? `+${fincraDialCode}` : undefined)
                    : (dialCode || undefined)}
                />
                {dialCode ? (
                  <Text style={styles.phoneHint}>{t('transferModal.phoneHint')}</Text>
                ) : null}
              </>
            )}

            {/* Champs bénéficiaire bancaire (Fincra bank_transfer / SWIFT / SEPA) */}
            {isFincraOp && fincraRail && fincraRail !== 'mobile_money' && (
              <View style={{ gap: Spacing.xs }}>
                {fincraRail !== 'bank_transfer' && (
                  <Input
                    label="Nom du bénéficiaire"
                    placeholder="Prénom NOM"
                    value={bankAccountHolder}
                    onChangeText={setBankAccountHolder}
                  />
                )}
                {(fincraRail === 'bank_transfer') && (
                  <>
                    <Text style={styles.fieldLabel}>Banque</Text>
                    <TouchableOpacity
                      style={styles.bankPickerBtn}
                      onPress={() => setBankPickerVisible(true)}
                    >
                      <FontAwesome6 name="building-columns" size={14} color={Colors.textMuted} iconStyle="solid" />
                      <Text style={[styles.bankPickerText, !bankName && styles.bankPickerPlaceholder]} numberOfLines={1}>
                        {banksLoading
                          ? 'Chargement des banques…'
                          : (bankName || 'Sélectionner une banque')}
                      </Text>
                      <FontAwesome6 name="chevron-down" size={12} color={Colors.textMuted} />
                    </TouchableOpacity>
                    <Input
                      label="Numéro de compte"
                      placeholder="ex: 0123456789"
                      value={bankAccountNumber}
                      onChangeText={setBankAccountNumber}
                      keyboardType="numeric"
                    />
                    {/* Carte du bénéficiaire — affichée dès que numéro + banque sont saisis */}
                    {!!bankAccountNumber && !!bankCode && (
                      <View style={[
                        styles.beneficiaryCard,
                        resolvedHolder && styles.beneficiaryCardOk,
                        !resolving && !resolvedHolder && resolveError && styles.beneficiaryCardWarn,
                      ]}>
                        {resolving && (
                          <View style={styles.beneficiaryRow}>
                            <ActivityIndicator size="small" color={Colors.textMuted} />
                            <Text style={styles.beneficiaryHint}>Vérification du compte…</Text>
                          </View>
                        )}

                        {!resolving && resolvedHolder && (
                          <>
                            <View style={styles.beneficiaryRow}>
                              <FontAwesome6 name="circle-check" size={14} color={Colors.success} iconStyle="solid" />
                              <Text style={styles.beneficiaryHintOk}>Compte vérifié</Text>
                            </View>
                            <Text style={styles.beneficiaryName} numberOfLines={2}>{resolvedHolder}</Text>
                            <Text style={styles.beneficiarySubLine}>{bankName} · {bankAccountNumber}</Text>
                          </>
                        )}

                        {!resolving && !resolvedHolder && resolveError && (
                          <>
                            <View style={styles.beneficiaryRow}>
                              <FontAwesome6 name="triangle-exclamation" size={14} color={Colors.warning} iconStyle="solid" />
                              <Text style={styles.beneficiaryHintWarn}>
                                Compte non vérifié — saisissez le nom manuellement
                              </Text>
                            </View>
                            <Input
                              label=""
                              placeholder="Nom complet du bénéficiaire"
                              value={bankAccountHolder}
                              onChangeText={setBankAccountHolder}
                              containerStyle={{ marginTop: Spacing.xs }}
                            />
                          </>
                        )}
                      </View>
                    )}
                  </>
                )}
                {fincraRail === 'SWIFT' && (
                  <>
                    <Input
                      label="IBAN / Numéro de compte"
                      placeholder="ex: DE89 3704 0044 0532 0130 00"
                      value={iban}
                      onChangeText={setIban}
                      autoCapitalize="characters"
                    />
                    <Input
                      label="Code SWIFT / BIC"
                      placeholder="ex: DEUTDEFF"
                      value={swiftCode}
                      onChangeText={setSwiftCode}
                      autoCapitalize="characters"
                    />
                    <Input
                      label="Banque"
                      placeholder="ex: Deutsche Bank"
                      value={bankName}
                      onChangeText={setBankName}
                    />
                    <Input
                      label="Pays de la banque (code ISO) *"
                      placeholder="ex: CN (Chine), US, GB, DE"
                      value={bankCountry}
                      onChangeText={(v) => setBankCountry(v.toUpperCase().slice(0, 2))}
                      autoCapitalize="characters"
                    />
                  </>
                )}
                {fincraRail === 'SEPA' && (
                  <>
                    <Input
                      label="IBAN"
                      placeholder="ex: FR14 2004 1010 0505 0001 3M02 606"
                      value={iban}
                      onChangeText={setIban}
                      autoCapitalize="characters"
                    />
                    <Input
                      label="BIC"
                      placeholder="ex: BNPAFRPP"
                      value={bic}
                      onChangeText={setBic}
                      autoCapitalize="characters"
                    />
                    <Input
                      label="Banque (optionnel)"
                      placeholder="ex: BNP Paribas"
                      value={bankName}
                      onChangeText={setBankName}
                    />
                  </>
                )}
                {fincraRail === 'wire' && (
                  <>
                    <Input
                      label="Numéro de compte"
                      placeholder="N° de compte du bénéficiaire"
                      value={bankAccountNumber}
                      onChangeText={setBankAccountNumber}
                      autoCapitalize="characters"
                    />
                    <Input
                      label="IBAN (si applicable)"
                      placeholder="ex: DE89 3704 0044 0532 0130 00"
                      value={iban}
                      onChangeText={setIban}
                      autoCapitalize="characters"
                    />
                    <Input
                      label="Code SWIFT / BIC"
                      placeholder="ex: CHASUS33"
                      value={swiftCode}
                      onChangeText={setSwiftCode}
                      autoCapitalize="characters"
                    />
                    <Input
                      label="Numéro de routage (USA uniquement)"
                      placeholder="ex: 021000021"
                      value={routingNumber}
                      onChangeText={setRoutingNumber}
                      keyboardType="numeric"
                    />
                    <Input
                      label="Banque"
                      placeholder="ex: JPMorgan Chase"
                      value={bankName}
                      onChangeText={setBankName}
                    />
                    <Input
                      label="Adresse de la banque"
                      placeholder="Rue, ville, pays de la banque"
                      value={bankAddress}
                      onChangeText={setBankAddress}
                    />
                    <Input
                      label="Adresse du bénéficiaire"
                      placeholder="Adresse complète du bénéficiaire"
                      value={beneficiaryAddress}
                      onChangeText={setBeneficiaryAddress}
                    />
                    <Input
                      label="Pays de la banque (code ISO)"
                      placeholder="ex: US, GB, DE"
                      value={bankCountry}
                      onChangeText={(v) => setBankCountry(v.toUpperCase().slice(0, 2))}
                      autoCapitalize="characters"
                    />
                  </>
                )}
              </View>
            )}

            <View style={styles.savedActionsRow}>
              {(!isFincraOp || fincraRail === 'mobile_money') && !!normalizedPhone && !savedPhones.some((item) => item.tel.replace(/\s+/g, '') === normalizedPhone) && (
                <Button
                  variant="secondary"
                  icon="bookmark"
                  title={t('transferModal.saveThisNumber')}
                  onPress={saveCurrentPhone}
                  style={styles.saveBtnSmall}
                  textStyle={styles.saveBtnText}
                />
              )}
              {savedPhones.some((item) => item.tel.replace(/\s+/g, '') === normalizedPhone) && (
                <TouchableOpacity style={styles.savedActionBtn} onPress={removeCurrentPhone}>
                  <FontAwesome6 name="trash" size={12} color={Colors.error} />
                  <Text style={[styles.savedActionText, { color: Colors.error }]}>{t('common.delete')}</Text>
                </TouchableOpacity>
              )}
              {isFincraOp && fincraRail && fincraRail !== 'mobile_money' && !!(bankAccountNumber.trim() || iban.trim()) && (
                <Button
                  variant="secondary"
                  icon="bookmark"
                  title={t('transferModal.saveThisBank')}
                  onPress={() => { setSaveBankName(bankAccountHolder.trim() || bankName.trim()); setSaveBankModalVisible(true); }}
                  style={styles.saveBtnSmall}
                  textStyle={styles.saveBtnText}
                />
              )}
            </View>

            {(!isFincraOp || fincraRail === 'mobile_money') && savedPhones.length > 0 && (
              <View style={styles.savedBlock}>
                <Text style={styles.savedLabel}>{t('transferModal.savedNumbers')}</Text>
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

            {(!isFincraOp || fincraRail === 'mobile_money') && savedPhonesLoadError && savedPhones.length === 0 && (
              <Text style={styles.savedErrorText}>{savedPhonesLoadError}</Text>
            )}

            {isFincraOp && fincraRail && fincraRail !== 'mobile_money' && savedBanks.filter((b) => (b.currency || '').toUpperCase() === fincraCurrency).length > 0 && (
              <View style={styles.savedBlock}>
                <Text style={styles.savedLabel}>{t('transferModal.savedBanks')}</Text>
                <View style={styles.savedList}>
                  {savedBanks.filter((b) => (b.currency || '').toUpperCase() === fincraCurrency).map((b) => {
                    const selected = !!(bankAccountNumber || iban) && (b.account_number || b.iban || '') === (bankAccountNumber || iban);
                    const label = (b.name?.trim() || b.account_holder?.trim() || b.bank_name?.trim() || '—');
                    const sub = [b.bank_name, b.account_number || b.iban].filter(Boolean).join(' · ');
                    return (
                      <TouchableOpacity
                        key={b.id}
                        style={[styles.savedChip, selected && styles.savedChipSelected]}
                        onPress={() => applyBankBeneficiary(b)}
                      >
                        <Text style={[styles.savedChipText, selected && styles.savedChipTextSelected]} numberOfLines={1}>
                          {sub ? `${label} · ${sub}` : label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            <Button
              title={t('common.send')}
              onPress={handlePressEnvoyer}
              icon="paper-plane"
              loading={loading}
              disabled={
                !amount || !operator
                || fincraRateBlocking || classicRateBlocking || feeUnavailable
                || (isFincraOp
                    ? !fincraRail
                      || (fincraRail === 'mobile_money' && !phone)
                      || (fincraRail === 'bank_transfer' && (!bankAccountHolder || !bankAccountNumber || !bankCode))
                      || (fincraRail === 'SWIFT' && (!bankAccountHolder || !iban || !swiftCode || !bankCountry))
                      || (fincraRail === 'SEPA' && (!bankAccountHolder || !iban))
                      || (fincraRail === 'wire' && (!bankAccountHolder || (!bankAccountNumber && !iban) || !bankName || !swiftCode || !bankCountry))
                    : !phone)
              }
              style={{ marginTop: Spacing.lg }}
            />
            </>
            )}
            </>
            ) : null}
          </ScrollView>}
          </View>
      </KeyboardAvoidingView>

      {/* Modal de confirmation — design refondu (cards segmentées, typo douce) */}
      <Modal visible={confirmVisible} transparent animationType="fade">
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmSheet}>
            {/* Header */}
            <View style={styles.confirmHeader}>
              <Text style={styles.confirmTitle}>{t('transferModal.confirmTitle')}</Text>
              <Text style={styles.confirmSubtitle}>{t('transferModal.confirmHint')}</Text>
            </View>

            {/* Card montant */}
            <View style={styles.confirmCard}>
              <Text style={styles.confirmCardLabel}>{t('transferModal.amountSent')}</Text>
              <View style={styles.confirmAmountRow}>
                <Text style={styles.confirmAmount}>{fmtXof(numAmountXof, { withCode: false })}</Text>
                <Text style={styles.confirmAmountCurrency}>{userCurrency}</Text>
              </View>
            </View>

            {/* Card destinataire */}
            <View style={styles.confirmCard}>
              <Text style={styles.confirmCardLabel}>{t('transferModal.recipient')}</Text>
              {(() => {
                // Décomposition propre des champs destinataire selon le rail.
                const isMM = !isFincraOp || fincraRail === 'mobile_money';
                const primary = isMM
                  ? (phone || '—')
                  : (bankAccountHolder || bankAccountNumber || iban || '—');
                const secondaryParts: string[] = [];
                if (!isMM) {
                  if (bankAccountHolder && (bankAccountNumber || iban)) {
                    secondaryParts.push(bankAccountNumber || iban);
                  }
                  if (bankName.trim()) secondaryParts.push(bankName.trim());
                }
                return (
                  <>
                    <Text style={styles.confirmPrimary} numberOfLines={2}>{primary}</Text>
                    {secondaryParts.length > 0 && (
                      <Text style={styles.confirmSecondary}>{secondaryParts.join(' · ')}</Text>
                    )}
                  </>
                );
              })()}

              {/* Chip méthode (logo + nom + rail) — discret */}
              {selectedOp && (
                <View style={styles.confirmMethodChip}>
                  <Image source={selectedOp.logo} style={styles.confirmMethodLogo} resizeMode="contain" />
                  <Text style={styles.confirmMethodText} numberOfLines={1}>
                    {selectedOp.flag} {selectedOp.name}
                    {isFincraOp && fincraRail
                      ? ` · ${fincraRail === 'mobile_money' ? 'Mobile Money' : fincraRail === 'bank_transfer' ? 'Virement bancaire' : fincraRail === 'wire' ? 'Virement international' : fincraRail}`
                      : ''}
                  </Text>
                </View>
              )}
            </View>

            {/* Card breakdown */}
            <View style={styles.confirmCard}>
              {isFincraOp && fincraCurrency !== 'XOF' && (
                <View style={styles.confirmBreakdownRow}>
                  <Text style={styles.confirmBreakdownLabel}>{t('transferModal.fincraReceives')}</Text>
                  <Text style={styles.confirmBreakdownValue}>{fmtFincra(numAmount)}</Text>
                </View>
              )}
              {fees > 0 && (
                <View style={styles.confirmBreakdownRow}>
                  <Text style={styles.confirmBreakdownLabel}>{t('transferModal.fees')} ({feeLabel})</Text>
                  <Text style={[styles.confirmBreakdownValue, styles.confirmBreakdownValueFee]}>+ {fmtXof(fees)}</Text>
                </View>
              )}
              <View style={styles.confirmBreakdownDivider} />
              <View style={styles.confirmBreakdownRow}>
                <Text style={styles.confirmBreakdownTotalLabel}>{t('transferModal.totalDebited')}</Text>
                <Text style={styles.confirmBreakdownTotalValue}>
                  {isFincraOp
                    ? (fincraTotalDebitXof !== null ? fmtXof(fincraTotalDebitXof) : fmtFincra(numAmount))
                    : fmtXof(total)}
                </Text>
              </View>
            </View>

            {/* Checkbox confirmation */}
            <TouchableOpacity style={styles.checkRow} onPress={() => setConfirmed((v) => !v)} activeOpacity={0.7}>
              <View style={[styles.checkbox, confirmed && styles.checkboxChecked]}>
                {confirmed && <FontAwesome6 name="check" size={11} color={Colors.white} />}
              </View>
              <Text style={[styles.checkLabel, confirmed && styles.checkLabelChecked]}>
                {t('transferModal.checkConfirm')}
              </Text>
            </TouchableOpacity>

            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setConfirmVisible(false)}>
                <Text style={styles.cancelBtnText}>{t('transferModal.modify')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, !confirmed && styles.confirmBtnDisabled]}
                onPress={confirmed ? handleTransfer : undefined}
              >
                <FontAwesome6 name="paper-plane" size={13} color={Colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.confirmBtnText}>{t('transferModal.confirm')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={savePhoneModalVisible} transparent animationType="fade" onRequestClose={() => setSavePhoneModalVisible(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>{t('transferModal.saveThisNumber')}</Text>
            <Text style={styles.confirmSubtitle}>{t('transferModal.saveNumberHint')}</Text>
            <Input
              label={t('transferModal.nameLabel')}
              placeholder={t('transferModal.labelPlaceholder')}
              value={savePhoneName}
              onChangeText={setSavePhoneName}
              containerStyle={{ alignSelf: 'stretch' }}
            />
            <Text style={styles.saveOpLabel}>{t('transferModal.operatorRequired')}</Text>
            <ScrollView style={styles.saveOpList} nestedScrollEnabled showsVerticalScrollIndicator={false}>
              {displayOperators.map((op) => {
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
                <FontAwesome6 name="floppy-disk" size={14} color={Colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.confirmBtnText}>{savePhoneLoading ? t('common.saving') : t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Enregistrer le bénéficiaire bancaire courant */}
      <Modal visible={saveBankModalVisible} transparent animationType="fade" onRequestClose={() => setSaveBankModalVisible(false)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmSheet}>
            <Text style={styles.confirmTitle}>{t('transferModal.saveThisBank')}</Text>
            <Text style={styles.confirmSubtitle}>{t('transferModal.saveBankHint')}</Text>
            <Input
              label={t('transferModal.nameLabel')}
              placeholder={t('transferModal.labelPlaceholder')}
              value={saveBankName}
              onChangeText={setSaveBankName}
              containerStyle={{ alignSelf: 'stretch' }}
            />
            <Text style={styles.beneficiarySubLine}>
              {[bankName, bankAccountNumber || iban, fincraCurrency].filter(Boolean).join(' · ')}
            </Text>
            <View style={styles.confirmBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setSaveBankModalVisible(false)}>
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={confirmSaveCurrentBank} disabled={saveBankLoading}>
                <FontAwesome6 name="floppy-disk" size={14} color={Colors.white} style={{ marginRight: 6 }} />
                <Text style={styles.confirmBtnText}>{saveBankLoading ? t('common.saving') : t('common.save')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Picker de banques Fincra — modal de recherche */}
      <Modal visible={bankPickerVisible} transparent animationType="fade" onRequestClose={() => setBankPickerVisible(false)}>
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmSheet, styles.bankPickerSheet]}>
            <View style={styles.bankPickerHeader}>
              <Text style={styles.confirmTitle}>Choisir une banque</Text>
              <TouchableOpacity onPress={() => setBankPickerVisible(false)}>
                <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.bankSearchRow}>
              <FontAwesome6 name="magnifying-glass" size={14} color={Colors.textMuted} />
              <TextInput
                style={styles.bankSearchInput}
                placeholder="Rechercher (nom ou code)"
                placeholderTextColor={Colors.textMuted}
                value={bankSearchQuery}
                onChangeText={setBankSearchQuery}
                autoFocus
              />
            </View>
            {banksLoading ? (
              <View style={{ padding: Spacing.lg, alignItems: 'center' }}>
                <ActivityIndicator color={Colors.secondary} />
              </View>
            ) : (
              <FlatList
                data={filteredBanks}
                keyExtractor={(item, idx) => `${item.code}-${idx}`}
                keyboardShouldPersistTaps="handled"
                style={styles.bankList}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.bankRow, bankCode === item.code && styles.bankRowSelected]}
                    onPress={() => {
                      setBankCode(item.code);
                      setBankName(item.name);
                      setBankSwiftCode(item.swiftCode ?? '');
                      setBankPickerVisible(false);
                      setBankSearchQuery('');
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.bankRowName} numberOfLines={1}>{item.name}</Text>
                      <Text style={styles.bankRowCode}>Code {item.code}</Text>
                    </View>
                    {bankCode === item.code && (
                      <FontAwesome6 name="check" size={14} color={Colors.secondary} />
                    )}
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.bankListEmpty}>Aucune banque trouvée.</Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>

      <CustomAlert />
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
    borderColor: Colors.border,
    gap: Spacing.xs,
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  savedChip: {
    backgroundColor: Colors.inputBg,
    borderColor: Colors.border,
    borderWidth: 1,
    borderRadius: BorderRadius.pill,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
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
  phoneHint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
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
  // Solde disponible
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  balanceText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  balanceAmount: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
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
    backgroundColor: 'rgba(15,23,42,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  confirmSheet: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    width: '100%',
    maxWidth: 460,
    gap: Spacing.sm,
  },
  confirmHeader: {
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  confirmTitle: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
    textAlign: 'center',
  },
  confirmSubtitle: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 2,
  },
  // Card générique — un container par section (montant / destinataire / breakdown).
  confirmCard: {
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
    alignItems: 'center',
  },
  confirmCardLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    textAlign: 'center',
  },
  confirmAmountRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    justifyContent: 'center',
  },
  confirmAmount: {
    fontSize: 36,
    lineHeight: 40,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  confirmAmountCurrency: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    marginBottom: 4,
  },
  confirmPrimary: {
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
    marginTop: 2,
    textAlign: 'center',
  },
  confirmSecondary: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
  },
  confirmMethodChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'center',
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.background,
    marginTop: Spacing.xs,
  },
  confirmMethodLogo: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  confirmMethodText: {
    color: Colors.text,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    flexShrink: 1,
  },
  confirmBreakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    width: '100%',
  },
  confirmBreakdownLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    flexShrink: 1,
  },
  confirmBreakdownValue: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  confirmBreakdownValueFee: {
    color: Colors.warning ?? '#F59E0B',
  },
  confirmBreakdownDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: 4,
    width: '100%',
  },
  confirmBreakdownTotalLabel: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
  },
  confirmBreakdownTotalValue: {
    color: Colors.secondary,
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    width: '100%',
    paddingVertical: Spacing.xs,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  checkboxChecked: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  checkLabel: {
    flex: 1,
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
  },
  checkLabelChecked: {
    color: Colors.text,
    fontFamily: Fonts.semiBold,
  },
  confirmBtns: {
    flexDirection: 'row',
    gap: Spacing.sm,
    width: '100%',
    marginTop: Spacing.xs,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: Colors.text,
    fontFamily: Fonts.semiBold,
    fontSize: FontSize.sm,
  },
  confirmBtn: {
    flex: 2,
    paddingVertical: 13,
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
    fontSize: FontSize.sm,
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
    borderColor: Colors.border,
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
  railRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: 4,
  },
  railChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.pill,
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  railChipSelected: {
    borderColor: Colors.secondary,
    backgroundColor: 'rgba(244,178,40,0.12)',
  },
  railChipText: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontFamily: Fonts.semiBold,
  },
  railChipTextSelected: {
    color: Colors.secondary,
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
  fieldLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    marginBottom: 6,
  },
  bankPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.inputBg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
  },
  bankPickerText: {
    flex: 1,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  bankPickerPlaceholder: {
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
  },
  bankPickerSheet: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '80%',
    alignItems: 'stretch',
    padding: Spacing.lg,
  },
  bankPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  bankSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.sm,
  },
  bankSearchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    padding: 0,
  },
  bankList: {
    maxHeight: 420,
  },
  bankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  bankRowSelected: {
    backgroundColor: 'rgba(244,178,40,0.10)',
  },
  bankRowName: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  bankRowCode: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    marginTop: 2,
  },
  bankListEmpty: {
    textAlign: 'center',
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
    paddingVertical: Spacing.lg,
  },
  beneficiaryCard: {
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 6,
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  beneficiaryCardOk: {
    borderColor: Colors.success,
    backgroundColor: (Colors.success || '#1f8a4c') + '14',
  },
  beneficiaryCardWarn: {
    borderColor: Colors.warning,
    backgroundColor: (Colors.warning || '#F4B228') + '14',
  },
  beneficiaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  beneficiaryHint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
  },
  beneficiaryHintOk: {
    color: Colors.success,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    letterSpacing: 0.5,
  },
  beneficiaryHintWarn: {
    color: Colors.warning,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    flex: 1,
  },
  beneficiaryName: {
    color: Colors.text,
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    lineHeight: 28,
  },
  beneficiarySubLine: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
  },
});
