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
import { useRouter } from 'expo-router';
import { Input } from './Input';
import { Button } from './Button';
import { ResponsiveModal } from './ResponsiveModal';
import { walletService, type FincraRail, type SavedBank } from '../services/walletService';
import { useWalletStore } from '../stores/walletStore';
import { useAuthStore } from '../stores/authStore';
import { OPERATORS, FINCRA_ZONES, operatorServesCountry, walletZone } from '../constants/config';
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
import { useCryptoStore } from '../stores/cryptoStore';
import { useFormatXof } from '../utils/format';
import { useFincraRate } from '../stores/fincraRateStore';
import { formatFincraPhone, resolveFincraZone } from '../utils/fincraPhone';
import { AdminDisabledBanner } from './AdminDisabledBanner';
import { BlockedBanner } from './BlockedBanner';
import { TransactionAlertBanner } from './TransactionAlertBanner';
import { GatewayBadge } from './GatewayBadge';
import { CountryPickerStep } from './CountryPickerStep';
import FincraConversionHint from './FincraConversionHint';
import { OperatorLogo } from './OperatorLogo';
import { pickCryptoSource } from '../utils/cryptoLogos';
import { noConnectionMessage } from '../utils/apiError';

// Zone SEPA (ISO-2) — pays destinataires proposés pour un virement SEPA (EUR).
const SEPA_COUNTRIES = [
  'AT', 'BE', 'CY', 'DE', 'EE', 'ES', 'FI', 'FR', 'GR', 'IE', 'IT', 'LT', 'LU',
  'LV', 'MT', 'NL', 'PT', 'SI', 'SK', 'BG', 'CH', 'CZ', 'DK', 'GB', 'HR', 'HU',
  'IS', 'LI', 'NO', 'PL', 'RO', 'SE', 'MC', 'SM', 'AD',
];

// Drapeau emoji depuis un code pays ISO-2 (indicateurs régionaux). '' si invalide.
const isoToFlag = (cc: string): string => {
  const c = (cc || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
};

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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const { isDesktop, isWide } = useResponsive();

  const [amount, setAmount] = useState('');
  const [operator, setOperator] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  // « Crypto-monnaies » : sous-liste des cryptos actives (achat → débite le wallet).
  const [cryptoOpen, setCryptoOpen] = useState(false);
  // « Autres » : rails internationaux Fincra (zones XOF/XAF + USD/EUR/GBP) en payout.
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
  const pollingAggRefRef = useRef<string | null>(null);
  const consecutiveErrorsRef = useRef(0);
  // Wire Klasha : réf KLW- comme un payout normal → ce flag route le polling vers
  // /transfer/klasha/wire/status (statut lu par la transactionReference Klasha).
  const pollingIsWireRef = useRef(false);

  // Sous-pays Fincra (XOF/XAF) pour le mobile_money payout.
  const [aggZoneCountry, setAggZoneCountry] = useState<string | null>(null);
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

  // Klasha bank payout — champs requis par devise : GHS→branchCode, KES→serviceCode,
  // ZAR→mobileNumber/recipientAddress/recipientEmail.
  const [bankBranchCode, setBankBranchCode] = useState('');
  const [bankServiceCode, setBankServiceCode] = useState('');
  const [bankMobileNumber, setBankMobileNumber] = useState('');
  const [bankRecipientAddress, setBankRecipientAddress] = useState('');
  const [bankRecipientEmail, setBankRecipientEmail] = useState('');

  // CNY (Chine) — bénéficiaire C2C. L'EXPÉDITEUR (le user) est auto-rempli côté
  // backend depuis le profil KYC → aucune saisie expéditeur ici. Le service
  // (virement / UnionPay / Alipay) est porté par la TUILE choisie (cnyService dérivé).
  const [cnyFirstName, setCnyFirstName] = useState('');   // prénom bénéficiaire
  const [cnyLastName, setCnyLastName] = useState('');     // nom bénéficiaire
  const [cnyIdNumber, setCnyIdNumber] = useState('');     // pièce bénéficiaire (BANK_ACCOUNT/WALLET)
  const [cnyMobile, setCnyMobile] = useState('');         // tel bénéficiaire (BANK_ACCOUNT)
  const [cnyRelationship, setCnyRelationship] = useState('SELF'); // relation (BANK_ACCOUNT/WALLET)
  // UnionPay (BANK_CARD)
  const [cnyCardNumber, setCnyCardNumber] = useState('');
  const [cnyCardHolder, setCnyCardHolder] = useState('');
  // Alipay (WALLET)
  const [cnyWalletAccount, setCnyWalletAccount] = useState('');           // email ou mobile
  const [cnyWalletAccountId, setCnyWalletAccountId] = useState<'MOBILE' | 'EMAIL'>('MOBILE');

  // Picker de banques + résolution de compte (Fincra bank_transfer)
  const [aggBanks, setAggBanks] = useState<{ code: string; name: string; swiftCode?: string }[]>([]);
  const [bankSwiftCode, setBankSwiftCode] = useState('');
  const [banksLoading, setBanksLoading] = useState(false);
  const [bankPickerVisible, setBankPickerVisible] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState('');
  // Sélecteur de pays destinataire (SWIFT/SEPA) — pilote la liste de banques.
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const [countrySearchQuery, setCountrySearchQuery] = useState('');
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
  const transferMin = useConfigStore((s) => s.transfer_min);
  const transferMinWorld = useConfigStore((s) => s.transfer_min_world);
  const transferMinNg = useConfigStore((s) => s.transfer_min_ng);
  const afribapayEnabled = useConfigStore((s) => s.afribapay_enabled);
  const transferEnabled = useConfigStore((s) => s.transfer_enabled);
  // Blocage ciblé de CE user (admin → détail user) : bandeau + message perso.
  const transferBlocked = useConfigStore((s) => s.transfer_blocked);
  const transferBlockMessage = useConfigStore((s) => s.transfer_block_message);
  const isAdmin = user?.group === 'admin';
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

  // Rails Fincra de zone (XOF/XAF) + internationaux (EUR/USD/GBP) : exposés PAR PAYS
  // de destination (chacun sous son/ses pays) — plus de groupe « International » séparé.
  const ZONE_CURRENCIES = ['XOF', 'XAF', 'EUR', 'USD', 'GBP'];
  // Opérateurs MM Fincra par pays (fincraOperator présent) → affichés par pays comme le softpay.
  const isZoneFincra = (op: any) => !!op.fincra && ZONE_CURRENCIES.includes(op.currency) && !op.fincraOperator;
  // Nom affiché : suffixe la devise (USD, GBP…) sur les rails Fincra virement/carte
  // (libellés génériques) pour les distinguer dans la liste.
  const opName = (op: any): string => {
    const bankCard = !!op?.fincra && ['bank_transfer', 'SWIFT', 'SEPA', 'checkout'].includes(op?.rail);
    return (bankCard && op.currency && !String(op.name).includes(op.currency))
      ? `${op.name} (${op.currency})`
      : (op?.name ?? '');
  };

  const operatorsForStep = selectedCountry
    ? displayOperators.filter(
        (op) =>
          operatorServesCountry(op as any, selectedCountry) &&
          (isAdmin || isCodeEnabled(op.id, 'payout')) &&
          audienceOk(op.id)
      )
    : [];

  // Rails de zone/internationaux : exposés sous CHACUN de leurs pays membres (EUR →
  // tous les pays SEPA, USD → US, GBP → GB, zones XOF/XAF → leurs pays). Le picker
  // (CountryPickerStep) crée une tuile par pays présent dans op.countries.
  const pickerOperators = displayOperators.map((op) => {
    if (!isZoneFincra(op)) return op;
    const members = (((op as any).countries as string[] | undefined) ?? [op.country])
      .map((c) => String(c).toUpperCase());
    return { ...op, countries: members };
  });

  // Pays sélectionné mais AUCUN moyen payout servi → badge « indisponible ». Basé sur
  // operatorsForStep (robuste) et non sur payout_countries seul : un pays de zone
  // (DE/IT…) servi par un rail de zone n'affiche pas de bannière parasite même si
  // payout_countries ne le liste pas encore individuellement.
  const showCorridorBanner =
    !isAdmin && corridorsLoaded && !!selectedCountry
    && !isPayoutAvailable(selectedCountry) && operatorsForStep.length === 0;

  const selectedOp = OPERATORS_SRC.find((op) => op.id === operator);
  const isAggOp = !!(selectedOp as any)?.fincra;
  // Klasha réutilise l'UI Fincra ; ce flag route les appels API vers /payout/klasha.
  const isKlashaOp = !!(selectedOp as any)?.klasha;
  // Service Chine porté par la tuile sélectionnée (klasha-cny-bt/card/wallet/wechat).
  const cnyService: 'BANK_ACCOUNT' | 'BANK_CARD' | 'WALLET' = ((selectedOp as any)?.cnyService) ?? 'BANK_ACCOUNT';
  // Wallet chinois : Alipay (défaut) ou WeChat — porte le serviceCode + le libellé.
  const cnyServiceCode: 'ALIPAY' | 'WECHAT' = ((selectedOp as any)?.cnyServiceCode) ?? 'ALIPAY';
  const cnyWalletLabel = cnyServiceCode === 'WECHAT' ? 'WeChat' : 'Alipay';
  // WeChat = téléphone uniquement (pas d'email) → force MOBILE.
  useEffect(() => {
    if (cnyServiceCode === 'WECHAT') setCnyWalletAccountId('MOBILE');
  }, [cnyServiceCode]);
  const aggCurrency = isAggOp ? ((selectedOp as any)?.currency as string) || 'XOF' : '';
  // Le rail est porté directement par l'opérateur Fincra (cf. config.ts).
  // Plus de sélecteur dynamique ; chaque opérateur Fincra = 1 rail.
  const aggRail: FincraRail | '' = isAggOp ? (((selectedOp as any)?.rail as FincraRail) || '') : '';
  // Chine : Klasha exige tout le senderAddress (date de naissance + province/état +
  // code postal) en plus de l'identité. Si l'un manque dans le profil KYC, on bloque
  // tout le formulaire de retrait et on demande de compléter le KYC.
  const chinaKycGate = isKlashaOp && aggRail === 'cny'
    && (!(user as any)?.birthdate || !(user as any)?.state || !(user as any)?.postcode);
  // Sous-pays Fincra (XOF/XAF). Si le pays est déjà connu (pays sélectionné, ou
  // pays de l'utilisateur), on le déduit du contexte et on masque la liste.
  // Opérateur MM par pays (catalogue serveur) : pays figé = op.country (pas de picker).
  const aggMmCountry = ((selectedOp as any)?.fincraOperator ? ((selectedOp as any)?.country || '') : '').toUpperCase();
  const aggZoneList = (isAggOp && aggRail === 'mobile_money' && !aggMmCountry)
    ? (catalogZones[aggCurrency] ?? FINCRA_ZONES[aggCurrency]) : undefined;
  const contextCountry = ((selectedCountry || user?.country) || '').toUpperCase();
  const zoneHasContext = !!aggZoneList?.some((c) => c.code === contextCountry);
  const aggDialCode = (isAggOp && aggRail === 'mobile_money')
    ? (aggMmCountry
        ? (catalogDial[aggMmCountry] || resolveFincraZone(aggCurrency, aggMmCountry).dialCode)
        : ((aggZoneCountry && catalogDial[aggZoneCountry]) || resolveFincraZone(aggCurrency, aggZoneCountry).dialCode))
    : undefined;

  // Multi-devise d'affichage retiré : le solde est en XOF et l'envoi se saisit
  // en XOF débité. Cette valeur sert aux frais, validations et contrôle de solde.
  const numAmountXof = parseFloat(amount) || 0;
  const userCountry = user?.country?.toUpperCase();
  // Frais = A→B : source = pays du user, destination = pays de l'opérateur visé
  // (= corridor.country_code côté backend). On affiche le frais résolu par le
  // backend (outgoing_fees, indexé par destination) → identique à l'exécution.
  const destCountry = (aggMmCountry || aggZoneCountry || (selectedOp as any)?.country || '').toUpperCase();
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

  const fmt = (n: number) => n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }).replace(/\s/g, '.');
  const fmtAgg = (n: number) =>
    `${n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} ${aggCurrency}`;

  // wallet est en XOF : on débite exactement le montant XOF saisi. On convertit
  // ce XOF vers la devise Fincra pour le montant réellement envoyé au bénéficiaire
  // (NGN, GHS…), via les taux Fincra isolés. aggRate.rate = valeur XOF d'1
  // unité étrangère → montant reçu = XOF débité ÷ taux.
  // Zone de cotation = zone CFA du user (XAF pour la CEMAC, XOF sinon) : Fincra/
  // Klasha cotent cur↔XAF ≠ cur↔XOF. Dépôt ET envoi passent par ce même hook.
  const aggRate = useFincraRate(aggCurrency, isAggOp, isKlashaOp, false, walletZone(userCountry));
  const aggSendAmount =
    isAggOp && numAmountXof > 0
      ? (aggCurrency === 'XOF'
          ? numAmountXof
          : (aggRate.rate && aggRate.rate > 0
              ? numAmountXof / aggRate.rate
              : null))
      : null;
  // Le débit XOF du wallet = exactement le montant XOF saisi.
  const aggDebitXof = isAggOp ? numAmountXof : null;
  // Montant transmis au backend : Fincra = devise Fincra ; sinon XOF.
  const numAmount = isAggOp ? (aggSendAmount ?? 0) : numAmountXof;
  // Bloque l'envoi tant que le taux Fincra (devise étrangère) n'est pas résolu.
  const aggRateBlocking =
    isAggOp && aggCurrency !== 'XOF' && numAmountXof > 0
    && (aggRate.loading || aggRate.error || aggRate.rate === null);

  // Frais indisponibles : un moyen est choisi + un montant saisi mais le backend
  // n'a pas fourni de frais pour cette destination → on bloque (pas de devinette).
  const feeUnavailable = !!operator && numAmountXof > 0 && !feeConfig;
  const showFees = numAmountXof > 0 && operator && !!feeConfig;
  // Débit total XOF d'un retrait Fincra = coût Fincra (XOF) + frais GoesPay.
  const aggTotalDebitXof = aggDebitXof !== null ? aggDebitXof + fees : null;

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
    setAggZoneCountry(null);
    setBankAccountHolder('');
    setBankAccountNumber('');
    setBankName('');
    setBankCode('');
    setBankSwiftCode('');
    setBankCountry('');
    setIban('');
    setBic('');
    setSwiftCode('');
    setAggBanks([]);
    // Klasha bank — champs requis par devise (GHS/KES/ZAR).
    setBankBranchCode('');
    setBankServiceCode('');
    setBankMobileNumber('');
    setBankRecipientAddress('');
    setBankRecipientEmail('');
    // CNY (Chine) : purge le bénéficiaire (PII) à chaque ouverture → pas de
    // ré-soumission silencieuse de l'ancien bénéficiaire. (Expéditeur = profil KYC.)
    setCnyFirstName('');
    setCnyLastName('');
    setCnyIdNumber('');
    setCnyMobile('');
    setCnyRelationship('SELF');
    setCnyCardNumber('');
    setCnyCardHolder('');
    setCnyWalletAccount('');
    setCnyWalletAccountId('MOBILE');
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
  useEffect(() => { setAggZoneCountry(null); }, [operator]);

  // Auto-sélectionne le sous-pays Fincra depuis le contexte (pays déjà connu).
  useEffect(() => {
    if (aggRail === 'mobile_money' && zoneHasContext && aggZoneCountry !== contextCountry) {
      setAggZoneCountry(contextCountry);
    }
  }, [aggRail, zoneHasContext, contextCountry, aggZoneCountry]);

  // Charge les taux crypto quand on ouvre le groupe « Crypto-monnaies ».
  useEffect(() => { if (cryptoOpen) fetchCryptoRates(cryptoRates.length === 0); }, [cryptoOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Charge la liste des banques Fincra quand on entre en rail bank_transfer.
  // Cache local : on garde la liste tant que la devise ne change pas.
  const aggCountry = useMemo(() => {
    // Mapping minimal devise → pays (ISO-2) pour l'endpoint /core/banks.
    const map: Record<string, string> = {
      NGN: 'NG', GHS: 'GH', KES: 'KE', UGX: 'UG', ZMW: 'ZM', TZS: 'TZ',
      XOF: 'SN', XAF: 'CM', ZAR: 'ZA', EGP: 'EG',
    };
    return map[aggCurrency] || 'NG';
  }, [aggCurrency]);

  useEffect(() => {
    if (!isAggOp || aggRail !== 'bank_transfer' || !aggCurrency) return;
    let cancelled = false;
    setBanksLoading(true);
    (isKlashaOp ? walletService.getKlashaBanks(aggCurrency) : walletService.getFincraBanks(aggCurrency, aggCountry))
      .then((res) => { if (!cancelled) setAggBanks(res.banks || []); })
      .catch(() => { if (!cancelled) setAggBanks([]); })
      .finally(() => { if (!cancelled) setBanksLoading(false); });
    return () => { cancelled = true; };
  }, [isAggOp, isKlashaOp, aggRail, aggCurrency, aggCountry]);

  // CNY (Chine) : charge la liste des banques (CNAPS) et la réutilise dans le
  // même picker que les virements bancaires (aggBanks → bankCode/bankName).
  useEffect(() => {
    if (!isKlashaOp || aggRail !== 'cny') return;
    let cancelled = false;
    setBanksLoading(true);
    walletService.getKlashaChinaBanks()
      .then((banks) => { if (!cancelled) setAggBanks(banks); })
      .catch(() => { if (!cancelled) setAggBanks([]); })
      .finally(() => { if (!cancelled) setBanksLoading(false); });
    return () => { cancelled = true; };
  }, [isKlashaOp, aggRail]);

  // SWIFT / SEPA (Fincra) : charge la liste des banques du PAYS destinataire choisi
  // dans le picker → auto-remplit le BIC. Repli sur la saisie manuelle si la liste
  // revient vide (Fincra ne liste pas toujours les banques d'un pays donné).
  useEffect(() => {
    if (!isAggOp || (aggRail !== 'SWIFT' && aggRail !== 'SEPA')) return;
    const cc = bankCountry.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(cc)) { setAggBanks([]); return; }
    let cancelled = false;
    setBanksLoading(true);
    walletService.getFincraBanks(aggCurrency, cc)
      .then((res) => { if (!cancelled) setAggBanks(res.banks || []); })
      .catch(() => { if (!cancelled) setAggBanks([]); })
      .finally(() => { if (!cancelled) setBanksLoading(false); });
    return () => { cancelled = true; };
  }, [isAggOp, aggRail, aggCurrency, bankCountry]);

  // Résolution automatique du compte bénéficiaire (debounce 600ms).
  // Sandbox Fincra renvoie data:null → on signale "non vérifié" sans bloquer.
  // Fincra ne supporte la résolution que pour NGN (NUBAN) et GHS (bank_account + bankSwiftCode).
  const resolveSupported = isAggOp && aggRail === 'bank_transfer' && ['NGN', 'GHS'].includes(aggCurrency);
  useEffect(() => {
    if (!resolveSupported) {
      setResolvedHolder(null); setResolveError(null); setResolving(false);
      return;
    }
    const num = bankAccountNumber.trim();
    const hasBankRef = aggCurrency === 'NGN'
      ? !!bankCode.trim()
      : !!bankSwiftCode.trim();
    if (!num || !hasBankRef || num.length < 8) {
      setResolvedHolder(null); setResolveError(null); return;
    }
    setResolving(true);
    setResolveError(null);
    const handle = setTimeout(async () => {
      try {
        const payload = aggCurrency === 'NGN'
          ? { accountNumber: num, bankCode: bankCode.trim(), type: 'nuban' as const, currency: 'NGN' }
          : { accountNumber: num, bankSwiftCode: bankSwiftCode.trim(), type: 'bank_account' as const, currency: aggCurrency };
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
  }, [resolveSupported, bankAccountNumber, bankCode, bankSwiftCode, aggCurrency]);

  const filteredBanks = useMemo(() => {
    const q = bankSearchQuery.trim().toLowerCase();
    if (!q) return aggBanks;
    return aggBanks.filter((b) =>
      b.name.toLowerCase().includes(q) || b.code.toLowerCase().includes(q)
    );
  }, [aggBanks, bankSearchQuery]);

  // Pays destinataires du sélecteur SWIFT/SEPA : SEPA = zone SEPA, SWIFT = tous.
  const filteredCountries = useMemo(() => {
    const base = aggRail === 'SEPA'
      ? ALL_COUNTRIES.filter((c) => SEPA_COUNTRIES.includes(c.code))
      : ALL_COUNTRIES;
    const q = countrySearchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((c) =>
      c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [aggRail, countrySearchQuery]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    pollingTransferIdRef.current = null;
    pollingAggRefRef.current = null;
    pollingIsWireRef.current = false;
    consecutiveErrorsRef.current = 0;
  }, []);

  const checkStatus = useCallback(async (opts: { transferId?: number; aggRef?: string; isWire?: boolean }): Promise<boolean> => {
    try {
      const res = opts.aggRef
        ? (opts.aggRef.startsWith('KLC-')
            ? await walletService.getKlashaCnyStatus(opts.aggRef)
            : opts.isWire
              ? await walletService.getKlashaWireStatus(opts.aggRef)
              : opts.aggRef.startsWith('KLW-')
                ? await walletService.getKlashaPayoutStatus(opts.aggRef)
                : await walletService.getFincraPayoutStatus(opts.aggRef))
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

  const startPolling = useCallback((opts: { transferId?: number; aggRef?: string; isWire?: boolean }) => {
    let attempts = 0;
    const MAX_ATTEMPTS = 60; // 5 min max (toutes les 5s)
    setPollingState('pending');
    pollingTransferIdRef.current = opts.transferId ?? null;
    pollingAggRefRef.current = opts.aggRef ?? null;
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
        if (pollingAggRefRef.current) checkStatus({ aggRef: pollingAggRefRef.current, isWire: pollingIsWireRef.current });
        else if (pollingTransferIdRef.current) checkStatus({ transferId: pollingTransferIdRef.current });
      }
    });
    return () => sub.remove();
  }, [checkStatus, pollingState]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && pollingState === 'pending') {
        if (pollingAggRefRef.current) checkStatus({ aggRef: pollingAggRefRef.current, isWire: pollingIsWireRef.current });
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
        currency: aggCurrency,
        country: bankCountry.trim() || undefined,
        swift_code: (bankSwiftCode.trim() || swiftCode.trim() || bic.trim()) || undefined,
        iban: iban.trim() || undefined,
        rail: aggRail || undefined,
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
      aggZoneCountry !== null ||
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
    if (aggRateBlocking) {
      showAlert(t('common.error'), t('common.rateUnavailable'));
      return;
    }
    if (feeUnavailable) {
      showAlert(t('common.error'), t('transferModal.feeUnavailable'));
      return;
    }
    // Fincra : le solde est en XOF, on compare au montant XOF saisi (débité).
    if (isAggOp) {
      if (aggRateBlocking || aggSendAmount === null || aggDebitXof === null) {
        showAlert(t('common.error'), t('common.rateUnavailable'));
        return;
      }
      if ((aggTotalDebitXof ?? aggDebitXof) > balance) {
        showAlert(t('common.error'), t('transferModal.insufficientBalance'));
        return;
      }
      // SEPA : Fincra exige IBAN + nom du bénéficiaire + BIC. On bloque avant
      // l'envoi pour éviter le 422 « beneficiary.bankCode is not allowed to be empty ».
      if (aggRail === 'SEPA') {
        const code = bic.trim() || bankSwiftCode.trim();
        if (!iban.trim() || !bankAccountHolder.trim() || !code) {
          showAlert(t('common.error'), t('transferModal.bankFieldsRequired'));
          return;
        }
      }
      // SWIFT : pas d'IBAN hors Europe (Chine, USA… = n° de compte local) → on
      // accepte compte OU IBAN. Le PAYS de la banque (ISO-2) est OBLIGATOIRE :
      // Fincra l'exige et il n'est pas dérivable sans IBAN → sinon 422 Fincra.
      if (aggRail === 'SWIFT') {
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
      // CNY (Chine, C2C) : champs bénéficiaire requis selon la méthode
      // (l'expéditeur vient du profil KYC, côté backend).
      if (aggRail === 'cny') {
        // Bénéficiaire requis (noms) commun ; le reste dépend du service.
        const namesOk = !!cnyFirstName.trim() && !!cnyLastName.trim();
        let ok = namesOk;
        if (cnyService === 'BANK_ACCOUNT') {
          ok = namesOk && !!cnyIdNumber.trim() && !!cnyMobile.trim()
            && !!bankCode.trim() && !!bankName.trim()
            && !!bankAccountNumber.trim() && !!bankAccountHolder.trim();
        } else if (cnyService === 'BANK_CARD') {
          ok = namesOk && !!bankCode.trim() && !!bankName.trim()
            && !!cnyCardNumber.trim() && !!cnyCardHolder.trim();
        } else {
          // WALLET (Alipay / WeChat) : nom + compte seulement.
          ok = namesOk && !!cnyWalletAccount.trim();
        }
        if (!ok) {
          showAlert(t('common.error'), t('transferModal.cnyFieldsRequired'));
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
      if (isAggOp) {
        // ── Wire international Klasha (USD/EUR/GBP) : process Klasha distinct
        // (bénéficiaire → quote → initiate côté backend). Bénéficiaire avec le jeu
        // de champs Klasha (≠ payout MM/bank). Réf KLW-, polling wire dédié. ──
        if (isKlashaOp && aggRail === 'wire') {
          const isoCountry = bankCountry.trim().toUpperCase();
          // Klasha Wire attend `country` = nom complet (« China ») et `countryCode`
          // = ISO-2 (« CN »). On résout le nom via ALL_COUNTRIES (repli = code).
          const countryName = ALL_COUNTRIES.find((c) => c.code === isoCountry)?.name || isoCountry;
          const result = await walletService.klashaWire({
            amount: numAmount,
            currency: aggCurrency,
            amount_xof: aggDebitXof ?? numAmountXof,
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
            debit_xof: aggTotalDebitXof ?? aggDebitXof ?? 0,
          });
          startPolling({ aggRef: result.reference, isWire: true });
          return;
        }

        // ── Payout CNY (Chine) Klasha : process C2C (quote → initiate côté backend).
        // 3 services : virement (BANK_ACCOUNT), UnionPay (BANK_CARD), Alipay (WALLET).
        // L'expéditeur (le user) est auto-rempli côté backend depuis le profil KYC.
        // Réf KLC-, polling CNY dédié. ──
        if (isKlashaOp && aggRail === 'cny') {
          const ben: any = {
            receiverFirstName: cnyFirstName.trim(),
            receiverLastName: cnyLastName.trim(),
          };
          if (cnyService === 'BANK_ACCOUNT') {
            ben.receiverIdNumber = cnyIdNumber.trim();
            ben.receiverMobileNumber = cnyMobile.trim();
            ben.receiverRelationship = cnyRelationship;
            ben.bankCode = bankCode.trim();
            ben.bankName = bankName.trim();
            ben.accountNumber = bankAccountNumber.trim();
            ben.accountName = bankAccountHolder.trim();
          } else if (cnyService === 'BANK_CARD') {
            ben.bankCode = bankCode.trim();
            ben.bankName = bankName.trim();
            ben.cardNumber = cnyCardNumber.trim();
            ben.cardHolderName = cnyCardHolder.trim();
          } else {
            // WALLET (Alipay / WeChat) — compte + accountId seulement.
            ben.accountNumber = cnyWalletAccount.trim();
            ben.accountId = cnyWalletAccountId;
          }
          const result = await walletService.klashaCny({
            amount: numAmount,
            amount_xof: aggDebitXof ?? numAmountXof,
            service: cnyService,
            // Wallet : ALIPAY | WECHAT (ignoré par le backend hors WALLET).
            serviceCode: cnyService === 'WALLET' ? cnyServiceCode : undefined,
            beneficiary: ben,
          });
          await fetchBalance();
          setAmount('');
          // Purge le bénéficiaire (PII) après envoi → pas de réutilisation silencieuse.
          setCnyFirstName(''); setCnyLastName(''); setCnyIdNumber(''); setCnyMobile('');
          setCnyCardNumber(''); setCnyCardHolder(''); setCnyWalletAccount('');
          setBankCode(''); setBankName(''); setBankAccountNumber(''); setBankAccountHolder('');
          setPendingDetails({
            amount_sent: numAmount,
            fees: Number(result.fees) || 0,
            phone: bankAccountNumber || cnyCardNumber || cnyWalletAccount,
            debit_xof: aggTotalDebitXof ?? aggDebitXof ?? 0,
          });
          startPolling({ aggRef: result.reference });
          return;
        }

        const beneficiary = aggRail !== 'mobile_money' ? {
          accountHolderName: bankAccountHolder.trim(),
          firstName: bankAccountHolder.trim().split(' ').slice(0, -1).join(' ') || bankAccountHolder.trim(),
          lastName: bankAccountHolder.trim().split(' ').slice(-1).join(' ') || '',
          accountNumber: bankAccountNumber.trim() || iban.trim(),
          bankName: bankName.trim(),
          // Fincra exige un bankCode NON vide. Virements locaux (NGN/GHS) : code
          // banque du sélecteur. SEPA : le BIC. SWIFT : le code SWIFT. Sans ça,
          // Fincra renvoie 422 « beneficiary.bankCode is not allowed to be empty ».
          bankCode: bankCode.trim()
            || (aggRail === 'SEPA' ? (bic.trim() || bankSwiftCode.trim()) : '')
            || (aggRail === 'SWIFT' ? (swiftCode.trim() || bankSwiftCode.trim()) : ''),
          // bankSwiftCode : sélectionné via le picker pour GHS/KES/etc., ou saisi
          // manuellement pour SWIFT/SEPA via le champ dédié.
          bankSwiftCode: (bankSwiftCode.trim() || swiftCode.trim() || bic.trim()) || undefined,
          // country (bénéficiaire) requis par Fincra pour UGX/ZMW/TZS — on
          // l'envoie systématiquement pour les rails bancaires (= pays de la
          // devise Fincra), sauf SWIFT/SEPA où l'utilisateur peut le surcharger
          // via bankCountry.
          country: aggRail === 'bank_transfer'
            ? aggCountry
            : (bankCountry.trim() || undefined),
          bankCountry: bankCountry.trim() || undefined,
          iban: iban.trim() || undefined,
          bic: bic.trim() || undefined,
          swiftCode: swiftCode.trim() || undefined,
          type: 'individual' as const,
          // Klasha bank payout : champs requis par devise (GHS branchCode, KES
          // serviceCode, ZAR mobileNumber/recipientAddress/recipientEmail).
          // NON envoyés pour Fincra (schéma strict → « not allowed »).
          ...(isKlashaOp && aggRail === 'bank_transfer' ? {
            branchCode: bankBranchCode.trim() || undefined,
            serviceCode: bankServiceCode.trim() || undefined,
            mobileNumber: bankMobileNumber.trim() || undefined,
            recipientAddress: bankRecipientAddress.trim() || undefined,
            recipientEmail: bankRecipientEmail.trim() || undefined,
          } : {}),
        } : undefined;

        // Fincra payout MM exige le phone SANS `+` (ex: 256770000000) et le
        // pays du BÉNÉFICIAIRE (ISO-2 dérivé de la devise ou du sous-pays).
        const rz = resolveFincraZone(aggCurrency, aggZoneCountry || aggMmCountry);
        // Indicatif & pays bénéficiaire : opérateur par pays (catalogue) > sous-pays > zone.
        const dialCode = aggDialCode || rz.dialCode;
        const countryIso2 = aggMmCountry || aggZoneCountry || rz.countryIso2;
        // Opérateur Fincra (ORANGE…) porté par la tuile ; fallback offline (config.ts).
        const mmOperator = (selectedOp as any)?.fincraOperator
          || (aggCurrency === 'GHS' ? 'MTN'
            : aggCurrency === 'KES' ? 'SAFARICOM'
            : aggCurrency === 'TZS' ? 'AIRTEL'
            : aggCurrency === 'ZMW' ? 'MTN'
            : 'ORANGE');
        const phoneForFincra = aggRail === 'mobile_money'
          ? formatFincraPhone(normalizedPhone, dialCode, false)
          : undefined;

        const result = await (isKlashaOp ? walletService.klashaPayout : walletService.fincraPayout)({
          amount: numAmount,
          // XOF saisi par l'utilisateur = base du débit wallet (le backend débite
          // amount_xof + frais, sans round-trip via le taux → débit = devis montré).
          amount_xof: aggDebitXof ?? numAmountXof,
          currency: aggCurrency,
          rail: aggRail as FincraRail,
          phone: phoneForFincra,
          operator: aggRail === 'mobile_money' ? mmOperator : undefined,
          country: aggRail === 'mobile_money' ? countryIso2 : undefined,
          accountHolderName: aggRail === 'mobile_money'
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
          phone: aggRail === 'mobile_money' ? normalizedPhone : (bankAccountNumber || iban),
          debit_xof: aggTotalDebitXof ?? aggDebitXof ?? 0,
        });
        startPolling({ aggRef: result.reference });
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
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.pollingScrollContent} showsVerticalScrollIndicator={false}>
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
                      {isAggOp ? fmtAgg(pendingDetails.amount_sent) : fmtXof(pendingDetails.amount_sent)}
                    </Text>
                  </View>
                  {!isAggOp && (
                    <View style={styles.feesRow}>
                      <Text style={styles.feesLabel}>{t('transferModal.feesDetail')}</Text>
                      <Text style={styles.feesValue}>{fmtXof(pendingDetails.fees)}</Text>
                    </View>
                  )}
                  <View style={[styles.feesRow, styles.feesTotalRow]}>
                    <Text style={styles.feesTotalLabel}>{t('transferModal.totalDebited')}</Text>
                    <Text style={styles.feesTotalValue}>
                      {isAggOp
                        ? fmtXof(pendingDetails.debit_xof ?? 0)
                        : fmtXof(pendingDetails.amount_sent + pendingDetails.fees)}
                    </Text>
                  </View>
                </View>
              )}
              <Button title={t('common.close')} onPress={() => { setPollingState('idle'); setPendingDetails(null); onClose(); }} style={{ marginTop: Spacing.lg }} />
            </ScrollView>
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
            {!isAdmin && transferBlocked && (
              <BlockedBanner message={transferBlockMessage} fallback={t('blocked.transferDefault')} />
            )}
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
            {!selectedCountry && !cryptoOpen ? (
              <CountryPickerStep
                operators={pickerOperators}
                groupByContinent
                onSelectCountry={(code) => { setSelectedCountry(code); setOperator(''); }}
                showCryptoTile={cryptoEnabled}
                cryptoLabel={t('depositModal.cryptoGroup')}
                onSelectCrypto={() => { setCryptoOpen(true); setOperator(''); }}
                label={t('transferModal.chooseCountry')}
              />
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
                      {opName(op)}
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
                      {opName(op)}
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
                {fmtXof(balance ?? 0, { decimals: 2 })}
              </Text>
            </View>

            {/* Chine : si la date de naissance (KYC) manque, on n'affiche AUCUN
                formulaire de retrait — juste une alerte jaune renvoyant au KYC. */}
            {chinaKycGate ? (
              <View style={styles.kycGateCard}>
                <FontAwesome6 name="triangle-exclamation" size={22} color={Colors.warning} iconStyle="solid" />
                <Text style={styles.kycGateTitle}>Complétez votre KYC</Text>
                <Text style={styles.kycGateText}>
                  Pour un envoi vers la Chine, votre date de naissance est requise. Mettez à jour et re-soumettez votre KYC, puis attendez sa validation pour continuer.
                </Text>
                <Button
                  title="Compléter mon KYC"
                  icon="id-card"
                  onPress={() => { onClose(); router.push('/kyc?edit=1'); }}
                  style={{ marginTop: Spacing.md }}
                />
              </View>
            ) : (
            <>
            {/* Montant + suite. Pour Fincra, le rail est porté par l'opérateur lui-même
                (cf. config.ts), plus de sélecteur intermédiaire. */}
            {(!isAggOp || !!aggRail) && (
            <>
            <Input
              label={t('transferModal.amountLabel', { currency: 'XOF' })}
              placeholder={`Min. ${fmtXof(
                (user?.country ?? '').toUpperCase() === 'NG'
                  ? transferMinNg
                  : (userCountry && countryFees[userCountry] ? transferMin : transferMinWorld)
              )}`}
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1'))}
              keyboardType="decimal-pad"
            />

            {/* Montant reçu par le bénéficiaire (devise Fincra) pour le XOF débité. */}
            {isAggOp && aggCurrency !== 'XOF' && numAmountXof > 0 && (
              <FincraConversionHint
                loading={aggRate.loading}
                error={aggRate.error || aggSendAmount === null}
                label={t('transferModal.fincraReceives')}
                amount={aggSendAmount}
                currency={aggCurrency}
              />
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
            {aggZoneList && !zoneHasContext && (
              <View style={{ gap: Spacing.xs }}>
                <Text style={styles.zoneLabel}>{t('transferModal.chooseCountry')}</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ gap: Spacing.xs, paddingVertical: 2 }}
                >
                  {aggZoneList.map((c) => (
                    <TouchableOpacity
                      key={c.code}
                      onPress={() => setAggZoneCountry(c.code)}
                      style={[styles.zoneChip, aggZoneCountry === c.code && styles.zoneChipSelected]}
                    >
                      <Text style={styles.zoneChipFlag}>{c.flag}</Text>
                      <Text style={[styles.zoneChipText, aggZoneCountry === c.code && styles.zoneChipTextSelected]}>
                        {c.name} +{c.phone}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}

            {/* Champ téléphone — visible pour les flux PayDunya/AfribaPay et pour Fincra mobile_money */}
            {(!isAggOp || aggRail === 'mobile_money') && (
              <>
                <Input
                  label={t('transferModal.phoneLabel')}
                  placeholder={isAggOp && aggRail === 'mobile_money'
                    ? '770000000'
                    : t('transferModal.phonePlaceholder')}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  prefix={isAggOp && aggRail === 'mobile_money'
                    ? (aggDialCode ? `+${aggDialCode}` : undefined)
                    : (dialCode || undefined)}
                />
                {dialCode ? (
                  <Text style={styles.phoneHint}>{t('transferModal.phoneHint')}</Text>
                ) : null}
              </>
            )}

            {/* Champs bénéficiaire bancaire (Fincra bank_transfer / SWIFT / SEPA) */}
            {isAggOp && aggRail && aggRail !== 'mobile_money' && (
              <View style={{ gap: Spacing.xs }}>
                {aggRail !== 'bank_transfer' && aggRail !== 'cny' && (
                  <Input
                    label="Nom du bénéficiaire"
                    placeholder="Prénom NOM"
                    value={bankAccountHolder}
                    onChangeText={setBankAccountHolder}
                  />
                )}
                {(aggRail === 'bank_transfer') && (
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
                    {/* Champs requis par devise (Klasha) : GHS / KES / ZAR */}
                    {isKlashaOp && aggCurrency === 'GHS' && (
                      <Input
                        label="Code agence (branch code) *"
                        placeholder="Code agence de la banque"
                        value={bankBranchCode}
                        onChangeText={setBankBranchCode}
                      />
                    )}
                    {isKlashaOp && aggCurrency === 'KES' && (
                      <Input
                        label="Code court banque (serviceCode) *"
                        placeholder="Short code du compte bénéficiaire"
                        value={bankServiceCode}
                        onChangeText={setBankServiceCode}
                      />
                    )}
                    {isKlashaOp && aggCurrency === 'ZAR' && (
                      <>
                        <Input
                          label="Téléphone du bénéficiaire *"
                          placeholder="ex: +27721234567"
                          value={bankMobileNumber}
                          onChangeText={setBankMobileNumber}
                          keyboardType="phone-pad"
                        />
                        <Input
                          label="Adresse du bénéficiaire *"
                          placeholder="Adresse complète"
                          value={bankRecipientAddress}
                          onChangeText={setBankRecipientAddress}
                        />
                        <Input
                          label="Email du bénéficiaire *"
                          placeholder="email@exemple.com"
                          value={bankRecipientEmail}
                          onChangeText={setBankRecipientEmail}
                          keyboardType="email-address"
                          autoCapitalize="none"
                        />
                      </>
                    )}
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
                {aggRail === 'SWIFT' && (
                  <>
                    {/* Pays de la banque (destinataire) — pilote la liste de banques. */}
                    <Text style={styles.fieldLabel}>Pays de la banque *</Text>
                    <TouchableOpacity style={styles.bankPickerBtn} onPress={() => setCountryPickerVisible(true)}>
                      <FontAwesome6 name="globe" size={14} color={Colors.textMuted} iconStyle="solid" />
                      <Text style={[styles.bankPickerText, !bankCountry && styles.bankPickerPlaceholder]} numberOfLines={1}>
                        {bankCountry
                          ? `${isoToFlag(bankCountry)} ${ALL_COUNTRIES.find((c) => c.code === bankCountry)?.name || bankCountry}`
                          : 'Sélectionner le pays de la banque'}
                      </Text>
                      <FontAwesome6 name="chevron-down" size={12} color={Colors.textMuted} />
                    </TouchableOpacity>
                    {/* Banque : picker si Fincra liste des banques pour ce pays. */}
                    {aggBanks.length > 0 && (
                      <>
                        <Text style={styles.fieldLabel}>Banque</Text>
                        <TouchableOpacity style={styles.bankPickerBtn} onPress={() => setBankPickerVisible(true)}>
                          <FontAwesome6 name="building-columns" size={14} color={Colors.textMuted} iconStyle="solid" />
                          <Text style={[styles.bankPickerText, !bankName && styles.bankPickerPlaceholder]} numberOfLines={1}>
                            {banksLoading ? 'Chargement des banques…' : (bankName || 'Sélectionner une banque')}
                          </Text>
                          <FontAwesome6 name="chevron-down" size={12} color={Colors.textMuted} />
                        </TouchableOpacity>
                      </>
                    )}
                    <Input
                      label="IBAN / Numéro de compte"
                      placeholder="ex: DE89 3704 0044 0532 0130 00"
                      value={iban}
                      onChangeText={setIban}
                      autoCapitalize="characters"
                    />
                    <Input
                      label="Code SWIFT / BIC *"
                      placeholder="ex: DEUTDEFF"
                      value={swiftCode}
                      onChangeText={setSwiftCode}
                      autoCapitalize="characters"
                    />
                    {/* Repli : saisie manuelle du nom de banque si aucune liste. */}
                    {aggBanks.length === 0 && (
                      <Input
                        label="Banque"
                        placeholder="ex: Deutsche Bank"
                        value={bankName}
                        onChangeText={setBankName}
                      />
                    )}
                  </>
                )}
                {aggRail === 'SEPA' && (
                  <>
                    {/* Pays de la banque (destinataire) — pilote la liste de banques SEPA. */}
                    <Text style={styles.fieldLabel}>Pays de la banque</Text>
                    <TouchableOpacity style={styles.bankPickerBtn} onPress={() => setCountryPickerVisible(true)}>
                      <FontAwesome6 name="globe" size={14} color={Colors.textMuted} iconStyle="solid" />
                      <Text style={[styles.bankPickerText, !bankCountry && styles.bankPickerPlaceholder]} numberOfLines={1}>
                        {bankCountry
                          ? `${isoToFlag(bankCountry)} ${ALL_COUNTRIES.find((c) => c.code === bankCountry)?.name || bankCountry}`
                          : 'Sélectionner le pays de la banque'}
                      </Text>
                      <FontAwesome6 name="chevron-down" size={12} color={Colors.textMuted} />
                    </TouchableOpacity>
                    {/* Banque : picker si Fincra liste des banques pour ce pays. */}
                    {aggBanks.length > 0 && (
                      <>
                        <Text style={styles.fieldLabel}>Banque</Text>
                        <TouchableOpacity style={styles.bankPickerBtn} onPress={() => setBankPickerVisible(true)}>
                          <FontAwesome6 name="building-columns" size={14} color={Colors.textMuted} iconStyle="solid" />
                          <Text style={[styles.bankPickerText, !bankName && styles.bankPickerPlaceholder]} numberOfLines={1}>
                            {banksLoading ? 'Chargement des banques…' : (bankName || 'Sélectionner une banque')}
                          </Text>
                          <FontAwesome6 name="chevron-down" size={12} color={Colors.textMuted} />
                        </TouchableOpacity>
                      </>
                    )}
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
                    {/* Repli : saisie manuelle du nom de banque si aucune liste. */}
                    {aggBanks.length === 0 && (
                      <Input
                        label="Banque (optionnel)"
                        placeholder="ex: BNP Paribas"
                        value={bankName}
                        onChangeText={setBankName}
                      />
                    )}
                  </>
                )}
                {aggRail === 'wire' && (
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
                {aggRail === 'cny' && (
                  <>
                    {/* La méthode (virement / UnionPay / Alipay) est portée par la tuile
                        choisie en haut → pas de sélecteur ici. */}
                    {/* Bénéficiaire (commun aux 3 méthodes). */}
                    <Input label="Prénom du bénéficiaire *" placeholder="Prénom" value={cnyFirstName} onChangeText={setCnyFirstName} />
                    <Input label="Nom du bénéficiaire *" placeholder="Nom" value={cnyLastName} onChangeText={setCnyLastName} />

                    {/* Sélecteur de banque (virement + UnionPay) */}
                    {(cnyService === 'BANK_ACCOUNT' || cnyService === 'BANK_CARD') && (
                      <>
                        <Text style={styles.fieldLabel}>Banque (Chine) *</Text>
                        <TouchableOpacity style={styles.bankPickerBtn} onPress={() => setBankPickerVisible(true)}>
                          <FontAwesome6 name="building-columns" size={14} color={Colors.textMuted} iconStyle="solid" />
                          <Text style={[styles.bankPickerText, !bankName && styles.bankPickerPlaceholder]} numberOfLines={1}>
                            {banksLoading ? 'Chargement des banques…' : (bankName || 'Sélectionner une banque')}
                          </Text>
                          <FontAwesome6 name="chevron-down" size={12} color={Colors.textMuted} />
                        </TouchableOpacity>
                      </>
                    )}

                    {/* Virement bancaire */}
                    {cnyService === 'BANK_ACCOUNT' && (
                      <>
                        <Input label="Numéro de compte *" placeholder="N° de compte du bénéficiaire" value={bankAccountNumber} onChangeText={setBankAccountNumber} />
                        <Input label="Titulaire du compte *" placeholder="Nom du titulaire" value={bankAccountHolder} onChangeText={setBankAccountHolder} />
                        <Input label="N° pièce d'identité du bénéficiaire *" placeholder="N° de pièce d'identité" value={cnyIdNumber} onChangeText={setCnyIdNumber} />
                        <Input label="Téléphone du bénéficiaire *" placeholder="ex: +8613699262597" value={cnyMobile} onChangeText={setCnyMobile} keyboardType="phone-pad" />
                        {/* La relation expéditeur↔bénéficiaire (requise par Klasha) est
                            renseignée automatiquement (SELF) — pas demandée au client. */}
                      </>
                    )}

                    {/* UnionPay (carte) */}
                    {cnyService === 'BANK_CARD' && (
                      <>
                        <Input label="Numéro de carte UnionPay *" placeholder="N° de carte" value={cnyCardNumber} onChangeText={setCnyCardNumber} keyboardType="numeric" />
                        <Input label="Titulaire de la carte *" placeholder="Nom du titulaire" value={cnyCardHolder} onChangeText={setCnyCardHolder} />
                      </>
                    )}

                    {/* Wallet (Alipay / WeChat) — nom + compte uniquement */}
                    {cnyService === 'WALLET' && (
                      <>
                        <Text style={styles.fieldLabel}>Identifiant {cnyWalletLabel} *</Text>
                        {/* WeChat = téléphone uniquement (pas d'email) → pas de sélecteur. */}
                        {cnyServiceCode !== 'WECHAT' && (
                          <View style={styles.cnyChipsRow}>
                            {([['MOBILE', 'Téléphone'], ['EMAIL', 'Email']] as const).map(([val, label]) => (
                              <TouchableOpacity key={val} style={[styles.cnyChip, cnyWalletAccountId === val && styles.cnyChipActive]} onPress={() => setCnyWalletAccountId(val)}>
                                <Text style={[styles.cnyChipText, cnyWalletAccountId === val && styles.cnyChipTextActive]}>{label}</Text>
                              </TouchableOpacity>
                            ))}
                          </View>
                        )}
                        <Input
                          label={cnyWalletAccountId === 'EMAIL' ? `Email ${cnyWalletLabel} *` : `Téléphone ${cnyWalletLabel} *`}
                          placeholder={cnyWalletAccountId === 'EMAIL' ? 'email@exemple.com' : 'ex: +8613699262597'}
                          value={cnyWalletAccount}
                          onChangeText={setCnyWalletAccount}
                          keyboardType={cnyWalletAccountId === 'EMAIL' ? 'email-address' : 'phone-pad'}
                          autoCapitalize="none"
                        />
                      </>
                    )}

                    <Text style={[styles.fieldLabel, { marginTop: Spacing.sm, opacity: 0.7 }]}>
                      Votre identité d'expéditeur (nom, pièce, date de naissance, adresse) est reprise automatiquement de votre profil (KYC).
                    </Text>
                  </>
                )}
              </View>
            )}

            <View style={styles.savedActionsRow}>
              {(!isAggOp || aggRail === 'mobile_money') && !!normalizedPhone && !savedPhones.some((item) => item.tel.replace(/\s+/g, '') === normalizedPhone) && (
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
              {isAggOp && aggRail && aggRail !== 'mobile_money' && !!(bankAccountNumber.trim() || iban.trim()) && (
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

            {(!isAggOp || aggRail === 'mobile_money') && savedPhones.length > 0 && (
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

            {(!isAggOp || aggRail === 'mobile_money') && savedPhonesLoadError && savedPhones.length === 0 && (
              <Text style={styles.savedErrorText}>{savedPhonesLoadError}</Text>
            )}

            {isAggOp && aggRail && aggRail !== 'mobile_money' && savedBanks.filter((b) => (b.currency || '').toUpperCase() === aggCurrency).length > 0 && (
              <View style={styles.savedBlock}>
                <Text style={styles.savedLabel}>{t('transferModal.savedBanks')}</Text>
                <View style={styles.savedList}>
                  {savedBanks.filter((b) => (b.currency || '').toUpperCase() === aggCurrency).map((b) => {
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
                || aggRateBlocking || feeUnavailable
                || (isAggOp
                    ? !aggRail
                      || (aggRail === 'mobile_money' && !phone)
                      || (aggRail === 'bank_transfer' && (!bankAccountHolder || !bankAccountNumber || !bankCode))
                      || (isKlashaOp && aggRail === 'bank_transfer' && aggCurrency === 'GHS' && !bankBranchCode)
                      || (isKlashaOp && aggRail === 'bank_transfer' && aggCurrency === 'KES' && !bankServiceCode)
                      || (isKlashaOp && aggRail === 'bank_transfer' && aggCurrency === 'ZAR' && (!bankMobileNumber || !bankRecipientAddress || !bankRecipientEmail))
                      || (aggRail === 'SWIFT' && (!bankAccountHolder || !iban || !swiftCode || !bankCountry))
                      || (aggRail === 'SEPA' && (!bankAccountHolder || !iban))
                      || (aggRail === 'wire' && (!bankAccountHolder || (!bankAccountNumber && !iban) || !bankName || !swiftCode || !bankCountry))
                      || (aggRail === 'cny' && (!cnyFirstName || !cnyLastName))
                      || (aggRail === 'cny' && cnyService === 'BANK_ACCOUNT' && (!cnyIdNumber || !cnyMobile || !bankCode || !bankName || !bankAccountNumber || !bankAccountHolder))
                      || (aggRail === 'cny' && cnyService === 'BANK_CARD' && (!bankCode || !bankName || !cnyCardNumber || !cnyCardHolder))
                      || (aggRail === 'cny' && cnyService === 'WALLET' && !cnyWalletAccount)
                    : !phone)
              }
              style={{ marginTop: Spacing.lg }}
            />
            </>
            )}
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
                <Text style={styles.confirmAmountCurrency}>XOF</Text>
              </View>
            </View>

            {/* Card destinataire */}
            <View style={styles.confirmCard}>
              <Text style={styles.confirmCardLabel}>{t('transferModal.recipient')}</Text>
              {(() => {
                // Décomposition propre des champs destinataire selon le rail.
                const isMM = !isAggOp || aggRail === 'mobile_money';
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
                    {isAggOp && aggRail
                      ? ` · ${aggRail === 'mobile_money' ? 'Mobile Money' : aggRail === 'bank_transfer' ? 'Virement bancaire' : aggRail === 'wire' ? 'Virement international' : aggRail}`
                      : ''}
                  </Text>
                </View>
              )}
            </View>

            {/* Card breakdown */}
            <View style={styles.confirmCard}>
              {isAggOp && aggCurrency !== 'XOF' && (
                <View style={styles.confirmBreakdownRow}>
                  <Text style={styles.confirmBreakdownLabel}>{t('transferModal.fincraReceives')}</Text>
                  <Text style={styles.confirmBreakdownValue}>{fmtAgg(numAmount)}</Text>
                </View>
              )}
              {/* Chine : taux appliqué (1 CNY = N XOF, cf. aggRate) */}
              {aggRail === 'cny' && aggRate.rate !== null && aggRate.rate > 0 && (
                <View style={styles.confirmBreakdownRow}>
                  <Text style={styles.confirmBreakdownLabel}>{t('transferModal.exchangeRate')}</Text>
                  <Text style={styles.confirmBreakdownValue}>
                    1 {aggCurrency} = {aggRate.rate.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} XOF
                  </Text>
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
                  {isAggOp
                    ? (aggTotalDebitXof !== null ? fmtXof(aggTotalDebitXof) : fmtAgg(numAmount))
                    : fmtXof(total)}
                </Text>
              </View>
            </View>

            {/* Chine : délai de réception estimé */}
            {aggRail === 'cny' && (
              <Text style={styles.confirmDeliveryNote}>{t('transferModal.chinaDeliveryEstimate')}</Text>
            )}

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
                      {op.name}
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
              {[bankName, bankAccountNumber || iban, aggCurrency].filter(Boolean).join(' · ')}
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
                      setBankName(item.name);
                      // SWIFT/SEPA : Fincra veut le BIC dans beneficiary.bankCode.
                      // On pose le BIC dans swiftCode/bic (que le payload mappe vers
                      // bankCode) et on LAISSE bankCode vide — le `code` Fincra local
                      // n'est PAS un BIC. bank_transfer : code banque + swift.
                      if (aggRail === 'SWIFT') {
                        setSwiftCode(item.swiftCode ?? '');
                        setBankCode('');
                        setBankSwiftCode('');
                      } else if (aggRail === 'SEPA') {
                        setBic(item.swiftCode ?? '');
                        setBankCode('');
                        setBankSwiftCode('');
                      } else {
                        setBankCode(item.code);
                        setBankSwiftCode(item.swiftCode ?? '');
                      }
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

      {/* Picker pays de la banque (SWIFT/SEPA) — modal de recherche */}
      <Modal visible={countryPickerVisible} transparent animationType="fade" onRequestClose={() => setCountryPickerVisible(false)}>
        <View style={styles.confirmOverlay}>
          <View style={[styles.confirmSheet, styles.bankPickerSheet]}>
            <View style={styles.bankPickerHeader}>
              <Text style={styles.confirmTitle}>Pays de la banque</Text>
              <TouchableOpacity onPress={() => setCountryPickerVisible(false)}>
                <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>
            <View style={styles.bankSearchRow}>
              <FontAwesome6 name="magnifying-glass" size={14} color={Colors.textMuted} />
              <TextInput
                style={styles.bankSearchInput}
                placeholder="Rechercher (nom ou code)"
                placeholderTextColor={Colors.textMuted}
                value={countrySearchQuery}
                onChangeText={setCountrySearchQuery}
                autoFocus
              />
            </View>
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              style={styles.bankList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.bankRow, bankCountry === item.code && styles.bankRowSelected]}
                  onPress={() => {
                    // Nouveau pays → banque à re-sélectionner (BIC remis à zéro).
                    setBankCountry(item.code);
                    setBankName('');
                    setBankCode('');
                    setBankSwiftCode('');
                    if (aggRail === 'SWIFT') setSwiftCode('');
                    if (aggRail === 'SEPA') setBic('');
                    setCountryPickerVisible(false);
                    setCountrySearchQuery('');
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={styles.bankRowName} numberOfLines={1}>{isoToFlag(item.code)} {item.name}</Text>
                    <Text style={styles.bankRowCode}>{item.code}</Text>
                  </View>
                  {bankCountry === item.code && (
                    <FontAwesome6 name="check" size={14} color={Colors.secondary} />
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.bankListEmpty}>Aucun pays trouvé.</Text>
              }
            />
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
  // Variante défilable (état success avec détails) : centre si court, défile si long.
  pollingScrollContent: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
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
  kycGateCard: {
    alignItems: 'center',
    backgroundColor: Colors.warning + '15',
    borderWidth: 1,
    borderColor: Colors.warning + '55',
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginTop: Spacing.md,
  },
  kycGateTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    textAlign: 'center',
  },
  kycGateText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.medium,
    textAlign: 'center',
    lineHeight: 20,
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
  confirmDeliveryNote: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontFamily: Fonts.medium,
    alignSelf: 'stretch',
    textAlign: 'center',
    marginBottom: Spacing.sm,
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
  cnyChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 4,
  },
  cnyChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.inputBg,
    marginRight: 8,
    marginBottom: 8,
  },
  cnyChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  cnyChipText: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.medium,
    color: Colors.text,
  },
  cnyChipTextActive: {
    color: Colors.white,
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
