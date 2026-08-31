import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { ResponsiveModal } from '../src/components/ResponsiveModal';
import { useResponsive } from '../src/hooks/useResponsive';
import { FontAwesome6 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { compressImage, MAX_EDGE_DOCUMENT } from '../src/utils/imageCompress';
import { authService } from '../src/services/authService';
import { useAuthStore } from '../src/stores/authStore';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { GlassCard } from '../src/components/GlassCard';
import { Reveal, Bounce } from '../src/components/anim';
import { useColors } from '../src/components/ThemeProvider';
import { LinearGradient } from 'expo-linear-gradient';
import { Spacing, FontSize, BorderRadius, Fonts, withAlpha } from '../src/constants/theme';
import type { ColorPalette } from '../src/constants/theme';
import { useThemedStyles } from '../src/hooks/useThemedStyles';
import { showAlert } from '../src/stores/alertStore';
import { ALL_COUNTRIES } from '../src/constants/countries';
import { getApiErrorMessage } from '../src/utils/apiError';
import { useTranslation } from 'react-i18next';

const DOC_TYPES_KEYS = [
  { value: 'Passport', key: 'kyc.passport', icon: 'passport' },
  { value: 'Identity card', key: 'kyc.identityCard', icon: 'id-card' },
  { value: "Driver's license", key: 'kyc.driverLicense', icon: 'car' },
];

/** Cible d'une prise de vue (pièce ou selfie) — pilote la feuille caméra/galerie. */
type PhotoTarget = 'id' | 'selfie' | null;

/** Erreurs de saisie, par nom de champ. */
type Errors = Record<string, string>;

const STEP_COUNT = 4;

export default function KycScreen() {
  const router = useRouter();
  // Retour robuste : revient à l'écran précédent s'il existe, sinon va à l'accueil
  // (le KYC peut être ouvert directement, sans pile de navigation → back() inerte).
  const goBack = () => { if (router.canGoBack()) router.back(); else router.replace('/(tabs)'); };
  // Mode édition (?edit=1) : force le FORMULAIRE même si déjà validé / en attente,
  // pour permettre une re-soumission (ex. ajout de la date de naissance pour la Chine).
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const editMode = edit === '1';
  const { user, refreshProfile } = useAuthStore();
  const styles = useThemedStyles(createStyles);
  const colors = useColors();
  const { t } = useTranslation();
  const { contentMaxWidth } = useResponsive();
  const insets = useSafeAreaInsets();

  const DOC_TYPES = DOC_TYPES_KEYS.map((d) => ({ ...d, label: t(d.key) }));

  // Personal info state (pre-filled from user)
  const [country, setCountry] = useState(user?.country ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [stateProv, setStateProv] = useState(user?.state ?? '');
  const [postcode, setPostcode] = useState(user?.postcode ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [idnumber, setIdnumber] = useState(user?.idnumber ?? '');
  // BVN (Nigeria) : facultatif ici, exigé plus tard pour les cartes et les
  // comptes virtuels NGN, qui renvoient vers ce formulaire.
  const [bvn, setBvn] = useState(user?.bvn ?? '');
  // Date de naissance : 3 cases JJ / MM / AAAA, préremplies depuis le profil (YYYY-MM-DD).
  const bparts = (user?.birthdate ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const [birthDay, setBirthDay] = useState(bparts ? bparts[3] : '');
  const [birthMonth, setBirthMonth] = useState(bparts ? bparts[2] : '');
  const [birthYear, setBirthYear] = useState(bparts ? bparts[1] : '');
  // Date d'expiration : mois + année séparés. Prérempli depuis le profil, que la
  // valeur stockée soit « MM/YYYY » ou « JJ/MM/YYYY » → [2]=mois, [3]=année.
  const existingParts = (user?.idexp ?? '').match(/^(?:(\d{1,2})\/)?(\d{1,2})\/(\d{4})$/);
  const [idexpMonth, setIdexpMonth] = useState(existingParts ? existingParts[2] : '');
  const [idexpYear, setIdexpYear] = useState(existingParts ? existingParts[3] : '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [telegram, setTelegram] = useState(user?.telegram ?? '');

  // KYC docs state — type de pièce prérempli depuis la précédente soumission.
  const [docType, setDocType] = useState(user?.kyc_type ?? '');
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Assistant : étape courante + erreurs affichées (elles n'apparaissent qu'après
  // une tentative de passage à l'étape suivante, jamais pendant la frappe).
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<Errors>({});
  const scrollRef = useRef<ScrollView>(null);
  const progress = useRef(new Animated.Value(0)).current;

  // Country picker modal
  const [countryModalVisible, setCountryModalVisible] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  const selectedCountry = ALL_COUNTRIES.find((c) => c.code === country);
  const prefix = selectedCountry ? `+${selectedCountry.phone}` : '';

  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return ALL_COUNTRIES;
    const q = countrySearch.toLowerCase();
    return ALL_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [countrySearch]);

  // Aperçus effectifs : nouvelle photo prise, sinon celle déjà envoyée.
  const idPreview = fileUri ?? user?.kyc_file_url ?? null;
  const selfiePreview = selfieUri ?? user?.kyc_tof_url ?? null;

  const STEPS = [
    { label: t('kyc.identity'), icon: 'user-large' },
    { label: t('kyc.document'), icon: 'id-card' },
    { label: t('kyc.stepPhotos'), icon: 'camera' },
    { label: t('kyc.stepReview'), icon: 'circle-check' },
  ];

  /* ─────────────────────────── Validation ──────────────────────────────── */

  // Une seule source de vérité : sert à la fois au blocage du « Continuer », à
  // l'affichage des erreurs et à l'état (vert / gris) des pastilles du stepper.
  const validateStep = (i: number): Errors => {
    const e: Errors = {};
    const req = t('kyc.errRequired');
    if (i === 0) {
      if (!country) e.country = req;
      if (!city.trim()) e.city = req;
      if (!address.trim()) e.address = req;
      if (!phone.trim()) e.phone = req;
      // Code postal, province et date de naissance : facultatifs à la soumission.
      // Ils ne sont exigés qu'au moment d'un envoi vers la Chine, qui renvoie
      // alors vers ce formulaire. Saisis, ils doivent rester cohérents.
      const d = parseInt(birthDay, 10), m = parseInt(birthMonth, 10), y = parseInt(birthYear, 10);
      const birthTouched = !!birthDay || !!birthMonth || !!birthYear;
      if (birthTouched) {
        if (!birthDay || !birthMonth || birthYear.length !== 4) e.birthdate = t('kyc.errBirthdate');
        else if (isNaN(d) || d < 1 || d > 31 || isNaN(m) || m < 1 || m > 12 || y < 1900 || y > new Date().getFullYear()) {
          e.birthdate = t('kyc.errBirthdate');
        }
      }
    }
    if (i === 1) {
      if (!docType) e.docType = t('kyc.errDocType');
      if (!idnumber.trim()) e.idnumber = req;
      if (bvn.trim() && bvn.trim().length !== 11) e.bvn = t('kyc.errBvn');
      const m = parseInt(idexpMonth, 10);
      if (!idexpMonth || !idexpYear) e.idexp = req;
      else if (isNaN(m) || m < 1 || m > 12) e.idexp = t('kyc.errMonth');
      else if (idexpYear.length !== 4) e.idexp = t('kyc.errYear');
      else {
        const now = new Date();
        const y = parseInt(idexpYear, 10);
        if (y < now.getFullYear() || (y === now.getFullYear() && m < now.getMonth() + 1)) {
          e.idexp = t('kyc.errExpiryPast');
        }
      }
    }
    if (i === 2) {
      if (!idPreview) e.idPhoto = t('kyc.errIdPhoto');
      if (!selfiePreview) e.selfie = t('kyc.errSelfie');
    }
    return e;
  };

  const stepDone = [0, 1, 2].map((i) => Object.keys(validateStep(i)).length === 0);
  const allDone = stepDone.every(Boolean);

  // Barre de progression : avance avec l'étape courante, pas avec le remplissage
  // (le client doit voir « où il en est », pas un pourcentage qui recule).
  useEffect(() => {
    Animated.timing(progress, {
      toValue: (step + 1) / STEP_COUNT,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [step]);

  const scrollTop = () => scrollRef.current?.scrollTo({ y: 0, animated: true });

  const goToStep = (i: number) => {
    setErrors({});
    setStep(i);
    scrollTop();
  };

  const goNext = () => {
    const e = validateStep(step);
    setErrors(e);
    if (Object.keys(e).length > 0) return;
    setStep((s) => Math.min(s + 1, STEP_COUNT - 1));
    scrollTop();
  };

  const goPrev = () => {
    if (step === 0) { goBack(); return; }
    setErrors({});
    setStep((s) => s - 1);
    scrollTop();
  };

  // Pastille du stepper : on ne saute en avant que sur une étape atteignable
  // (toutes celles qui la précèdent sont valides) — sinon le retour est libre.
  const canJumpTo = (i: number) => i <= step || stepDone.slice(0, i).every(Boolean);

  /* ─────────────────────────── Photos ──────────────────────────────────── */

  const applyPhoto = async (uri: string, target: Exclude<PhotoTarget, null>) => {
    const compressed = await compressImage(uri, { maxEdge: MAX_EDGE_DOCUMENT });
    (target === 'id' ? setFileUri : setSelfieUri)(compressed);
    setErrors((prev) => ({ ...prev, [target === 'id' ? 'idPhoto' : 'selfie']: '' }));
  };

  // Caméra exclusivement : aucune photo issue de la galerie n'est acceptée pour
  // le KYC (la prise de vue en direct est ce qui rend la pièce vérifiable).
  const capturePhoto = async (target: Exclude<PhotoTarget, null>) => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') { showAlert(t('common.error'), t('kyc.cameraPermission')); return; }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, quality: 0.8 });
      if (!result.canceled && result.assets[0]) await applyPhoto(result.assets[0].uri, target);
    } catch {
      showAlert(t('common.error'), t('kyc.cameraUnavailable'));
    }
  };

  /* ─────────────────────────── Envoi ───────────────────────────────────── */

  const handleSubmit = async () => {
    // Filet : une étape peut avoir été invalidée après coup (photo retirée…).
    for (let i = 0; i < 3; i++) {
      const e = validateStep(i);
      if (Object.keys(e).length > 0) { setStep(i); setErrors(e); scrollTop(); return; }
    }
    // Date de naissance facultative : on n'envoie une valeur que si elle est complète.
    const birthdateIso = (birthDay && birthMonth && birthYear.length === 4)
      ? `${birthYear}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`
      : '';
    // Format « MM/YYYY » conservé tel quel : l'admin (validations.htm) découpe
    // idexp sur « / » et attend exactement deux parties.
    const idexpValue = `${idexpMonth.padStart(2, '0')}/${idexpYear}`;

    setLoading(true);
    try {
      await authService.uploadKyc(
        {
          type: docType,
          city: city.trim(),
          state: stateProv.trim(),
          postcode: postcode.trim(),
          address: address.trim(),
          idnumber: idnumber.trim(),
          bvn: bvn.trim(),
          birthdate: birthdateIso,
          idexp: idexpValue,
          phone: phone.trim(),
          country,
          telegram: telegram.trim(),
          resubmit: editMode,
        },
        fileUri,
        selfieUri
      );
      await refreshProfile();
      showAlert(
        t('kyc.docsSent'),
        t('kyc.docsSentMessage'),
        [{ text: 'OK', onPress: () => router.replace('/(tabs)') }]
      );
    } catch (error: any) {
      console.error('[KYC] upload failed', {
        status: error?.response?.status,
        data: error?.response?.data,
        message: error?.message,
      });
      showAlert(t('common.error'), getApiErrorMessage(error, t, t('kyc.uploadError')));
    } finally {
      setLoading(false);
    }
  };

  /* ─────────────────────────── Fragments ───────────────────────────────── */

  const renderHeader = (subtitle?: string) => (
    <View style={styles.header}>
      <Bounce style={styles.backBtn} scaleTo={0.9} onPress={goBack} hitSlop={8}>
        <FontAwesome6 name="arrow-left" size={16} color={colors.text} />
      </Bounce>
      <View style={styles.headerText}>
        <Text style={styles.title}>{t('kyc.title')}</Text>
        {!!subtitle && <Text style={styles.headerSub}>{subtitle}</Text>}
      </View>
      <View style={styles.backBtnGhost} />
    </View>
  );

  const renderField = (label: string, node: React.ReactNode, error?: string, wrapStyle?: any) => (
    <View style={[styles.field, wrapStyle]}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {node}
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );

  // Zone photo : aperçu plein cadre + « Reprendre », sinon appel à l'action.
  const renderPhotoPicker = (
    preview: string | null,
    target: Exclude<PhotoTarget, null>,
    icon: string,
    addLabel: string,
    error?: string
  ) => (
    <>
      <Bounce
        style={[styles.imagePicker, preview ? styles.imagePickerFilled : null, !!error && styles.imagePickerError] as any}
        scaleTo={0.98}
        onPress={() => capturePhoto(target)}
      >
        {preview ? (
          <>
            <Image source={{ uri: preview }} style={styles.previewImage} />
            <View style={styles.previewBadge}>
              <FontAwesome6 name="check" size={10} color={colors.white} />
            </View>
            <View style={styles.retakeChip}>
              <FontAwesome6 name="rotate-right" size={11} color={colors.white} />
              <Text style={styles.retakeText}>{t('kyc.retake')}</Text>
            </View>
          </>
        ) : (
          <View style={styles.placeholderContainer}>
            <View style={styles.placeholderIcon}>
              <FontAwesome6 name={icon} size={26} color={colors.primary} />
            </View>
            <Text style={styles.placeholderTitle}>{addLabel}</Text>
            <Text style={styles.placeholderHint}>{t('kyc.photoFormat')}</Text>
          </View>
        )}
      </Bounce>
      {!!error && <Text style={styles.fieldError}>{error}</Text>}
    </>
  );

  // Ligne du récapitulatif
  const renderSummaryRow = (label: string, value?: string | null) => (
    <View style={styles.sumRow} key={label}>
      <Text style={styles.sumLabel}>{label}</Text>
      <Text style={styles.sumValue} numberOfLines={1}>{value || '-'}</Text>
    </View>
  );

  const renderSummaryCard = (title: string, targetStep: number, rows: React.ReactNode) => (
    <Card style={styles.sectionCard}>
      <View style={styles.sumHead}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <TouchableOpacity onPress={() => goToStep(targetStep)} hitSlop={10} activeOpacity={0.7}>
          <Text style={styles.sumEdit}>{t('common.edit')}</Text>
        </TouchableOpacity>
      </View>
      {rows}
    </Card>
  );

  /* ─────────────────────────── États terminaux ─────────────────────────── */

  // --- État: validate == 2 (en attente) — sauf en mode édition (re-soumission) ---
  if (user?.validate === 2 && !editMode) {
    return (
      <ScreenBackground>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.contentWrapper, { maxWidth: contentMaxWidth }]}>
            {renderHeader()}
            <Reveal>
              <GlassCard style={styles.pendingContainer}>
                <LinearGradient colors={['#F4B228', '#e0951a']} style={styles.pendingIconGrad}>
                  <FontAwesome6 name="clock" size={44} color={colors.white} />
                </LinearGradient>
                <Text style={styles.pendingTitle}>{t('kyc.documentsReceived')}</Text>
                <Text style={styles.pendingText}>{t('kyc.pending')}</Text>
              </GlassCard>
            </Reveal>
            <Button
              title={t('kyc.backToDashboard')}
              onPress={() => router.replace('/(tabs)')}
              icon="house"
              style={{ marginTop: Spacing.xl }}
            />
          </View>
        </ScrollView>
      </ScreenBackground>
    );
  }

  // --- État: validate == 1 (déjà validé) — sauf en mode édition (re-soumission) ---
  if (user?.validate === 1 && !editMode) {
    return (
      <ScreenBackground>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.contentWrapper, { maxWidth: contentMaxWidth }]}>
            {renderHeader()}
            <Reveal>
              <GlassCard style={styles.pendingContainer}>
                <LinearGradient colors={['#3ecf8e', '#198754']} style={styles.pendingIconGrad}>
                  <FontAwesome6 name="circle-check" size={44} color={colors.white} />
                </LinearGradient>
                <Text style={styles.pendingTitle}>{t('kyc.accountVerified')}</Text>
                <Text style={styles.pendingText}>{t('kyc.approved')}</Text>
              </GlassCard>
            </Reveal>
            <Button title={t('common.back')} onPress={goBack} icon="arrow-left" style={{ marginTop: Spacing.xl }} />
          </View>
        </ScrollView>
      </ScreenBackground>
    );
  }

  /* ─────────────────────────── Assistant ───────────────────────────────── */

  const docLabel = DOC_TYPES.find((d) => d.value === docType)?.label;

  // edges={['top']} : la barre d'action gère elle-même l'inset bas — sinon
  // double comptage avec ScreenBackground → bande vide sous le footer (PWA / notch).
  return (
    <ScreenBackground edges={['top']} style={{ overflow: 'hidden' }}>
      <KeyboardAvoidingView
        style={{ flex: 1, width: '100%' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1, width: '100%' }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.contentWrapper, { maxWidth: contentMaxWidth }]}>
            {renderHeader(t('kyc.stepOf', { n: step + 1, total: STEP_COUNT }))}

            {/* Barre de progression continue */}
            <View style={styles.progressTrack}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
                    backgroundColor: allDone ? colors.positive : colors.primary,
                  },
                ]}
              />
            </View>

            {/* Stepper — pastilles cliquables */}
            <View style={styles.stepper}>
              {STEPS.map((s, i) => {
                const done = i < 3 ? stepDone[i] : allDone;
                const active = i === step;
                const reachable = canJumpTo(i);
                return (
                  <React.Fragment key={s.label}>
                    {i > 0 && <View style={[styles.stepLine, (i <= step || stepDone[i - 1]) && styles.stepLineDone]} />}
                    <Bounce
                      style={styles.stepItem}
                      scaleTo={0.92}
                      disabled={!reachable}
                      onPress={() => reachable && goToStep(i)}
                    >
                      <View style={[
                        styles.stepDot,
                        done && styles.stepDotDone,
                        active && styles.stepDotActive,
                        !reachable && styles.stepDotLocked,
                      ]}>
                        <FontAwesome6
                          name={done && !active ? 'check' : s.icon}
                          size={13}
                          color={active || (done && !active) ? colors.white : colors.textMuted}
                        />
                      </View>
                      <Text style={[styles.stepLabel, (active || done) && styles.stepLabelActive]} numberOfLines={1}>
                        {s.label}
                      </Text>
                    </Bounce>
                  </React.Fragment>
                );
              })}
            </View>

            {/* ── Étape 1 : identité ── */}
            {step === 0 && (
              <Reveal key="s0" offset={14}>
                <Card style={styles.sectionCard}>
                  {renderField(
                    t('kyc.country'),
                    <Bounce
                      style={[styles.countryPicker, !!errors.country && styles.inputErrorBox] as any}
                      scaleTo={0.99}
                      onPress={() => setCountryModalVisible(true)}
                    >
                      <View style={styles.countryPickerLeft}>
                        <FontAwesome6 name="globe" size={14} color={colors.textMuted} />
                        <Text
                          style={selectedCountry ? styles.countryPickerText : styles.countryPickerPlaceholder}
                          numberOfLines={1}
                        >
                          {selectedCountry ? `${selectedCountry.name} (+${selectedCountry.phone})` : t('kyc.selectCountry')}
                        </Text>
                      </View>
                      <FontAwesome6 name="chevron-down" size={12} color={colors.textMuted} />
                    </Bounce>,
                    errors.country
                  )}

                  <View style={styles.row}>
                    {renderField(
                      t('kyc.city'),
                      <Input placeholder={t('kyc.cityPlaceholder')} value={city} onChangeText={setCity} error={errors.city} containerStyle={styles.inputFlush} />,
                      undefined,
                      styles.col
                    )}
                    {renderField(
                      `${t('kyc.postcode')} ${t('kyc.optionalSuffix')}`,
                      <Input placeholder={t('kyc.postcodePlaceholder')} value={postcode} onChangeText={setPostcode} error={errors.postcode} containerStyle={styles.inputFlush} />,
                      undefined,
                      styles.col
                    )}
                  </View>

                  {renderField(
                    `${t('kyc.state')} ${t('kyc.optionalSuffix')}`,
                    <Input placeholder={t('kyc.statePlaceholder')} value={stateProv} onChangeText={setStateProv} error={errors.state} containerStyle={styles.inputFlush} />
                  )}

                  {renderField(
                    t('kyc.address'),
                    <Input placeholder={t('kyc.addressPlaceholder')} value={address} onChangeText={setAddress} error={errors.address} containerStyle={styles.inputFlush} />
                  )}

                  <View style={styles.divider} />

                  {renderField(
                    `${t('kyc.birthdate')} ${t('kyc.optionalSuffix')}`,
                    <View style={styles.dateRow}>
                      <Input
                        placeholder="JJ"
                        value={birthDay}
                        onChangeText={(v) => {
                          const digits = v.replace(/[^0-9]/g, '').slice(0, 2);
                          if (digits.length === 2) {
                            const n = parseInt(digits, 10);
                            if (n < 1) { setBirthDay('01'); return; }
                            if (n > 31) { setBirthDay('31'); return; }
                          }
                          setBirthDay(digits);
                        }}
                        keyboardType="number-pad"
                        maxLength={2}
                        textAlign="center"
                        containerStyle={styles.dateCell}
                      />
                      <Text style={styles.dateSep}>/</Text>
                      <Input
                        placeholder="MM"
                        value={birthMonth}
                        onChangeText={(v) => {
                          const digits = v.replace(/[^0-9]/g, '').slice(0, 2);
                          if (digits.length === 2) {
                            const n = parseInt(digits, 10);
                            if (n < 1) { setBirthMonth('01'); return; }
                            if (n > 12) { setBirthMonth('12'); return; }
                          }
                          setBirthMonth(digits);
                        }}
                        keyboardType="number-pad"
                        maxLength={2}
                        textAlign="center"
                        containerStyle={styles.dateCell}
                      />
                      <Text style={styles.dateSep}>/</Text>
                      <Input
                        placeholder="AAAA"
                        value={birthYear}
                        onChangeText={(v) => setBirthYear(v.replace(/[^0-9]/g, '').slice(0, 4))}
                        keyboardType="number-pad"
                        maxLength={4}
                        textAlign="center"
                        containerStyle={styles.dateCellWide}
                      />
                    </View>,
                    errors.birthdate
                  )}

                  {renderField(
                    t('kyc.whatsapp'),
                    <Input
                      placeholder={t('kyc.phonePlaceholder')}
                      value={phone}
                      onChangeText={setPhone}
                      keyboardType="phone-pad"
                      prefix={prefix || undefined}
                      error={errors.phone}
                      containerStyle={styles.inputFlush}
                    />
                  )}

                  {renderField(
                    t('kyc.telegramOptional'),
                    <Input placeholder="@username" value={telegram} onChangeText={setTelegram} containerStyle={styles.inputFlush} />
                  )}
                </Card>
              </Reveal>
            )}

            {/* ── Étape 2 : document ── */}
            {step === 1 && (
              <Reveal key="s1" offset={14}>
                <Card style={styles.sectionCard}>
                  <Text style={styles.fieldLabel}>{t('kyc.documentType')}</Text>
                  <View style={styles.docTypeContainer}>
                    {DOC_TYPES.map((dt) => {
                      const active = docType === dt.value;
                      return (
                        <Bounce
                          key={dt.value}
                          style={[styles.docTypeBtn, active ? styles.docTypeBtnActive : null] as any}
                          onPress={() => { setDocType(dt.value); setErrors((p) => ({ ...p, docType: '' })); }}
                        >
                          {active && (
                            <View style={styles.docTypeCheck}>
                              <FontAwesome6 name="check" size={9} color={colors.white} />
                            </View>
                          )}
                          <FontAwesome6 name={dt.icon} size={20} color={active ? colors.primary : colors.textMuted} />
                          <Text style={[styles.docTypeText, active && styles.docTypeTextActive]}>{dt.label}</Text>
                        </Bounce>
                      );
                    })}
                  </View>
                  {!!errors.docType && <Text style={styles.fieldError}>{errors.docType}</Text>}

                  {renderField(
                    t('kyc.idNumber'),
                    <Input placeholder={t('kyc.idNumberPlaceholder')} value={idnumber} onChangeText={setIdnumber} error={errors.idnumber} containerStyle={styles.inputFlush} />
                  )}

                  {country === 'NG' && renderField(
                    `${t('kyc.bvn')} ${t('kyc.optionalSuffix')}`,
                    <Input
                      placeholder={t('kyc.bvnPlaceholder')}
                      value={bvn}
                      onChangeText={(v) => setBvn(v.replace(/\D/g, '').slice(0, 11))}
                      keyboardType="number-pad"
                      maxLength={11}
                      error={errors.bvn}
                      containerStyle={styles.inputFlush}
                    />
                  )}

                  {renderField(
                    t('kyc.expiryDate'),
                    <View style={styles.dateRow}>
                      <Input
                        placeholder="MM"
                        value={idexpMonth}
                        onChangeText={(v) => {
                          const digits = v.replace(/[^0-9]/g, '').slice(0, 2);
                          if (digits.length === 2) {
                            const n = parseInt(digits, 10);
                            if (n < 1) { setIdexpMonth('01'); return; }
                            if (n > 12) { setIdexpMonth('12'); return; }
                          }
                          setIdexpMonth(digits);
                        }}
                        keyboardType="number-pad"
                        maxLength={2}
                        textAlign="center"
                        containerStyle={styles.dateCell}
                      />
                      <Text style={styles.dateSep}>/</Text>
                      <Input
                        placeholder="AAAA"
                        value={idexpYear}
                        onChangeText={(v) => setIdexpYear(v.replace(/[^0-9]/g, '').slice(0, 4))}
                        keyboardType="number-pad"
                        maxLength={4}
                        textAlign="center"
                        containerStyle={styles.dateCellWide}
                      />
                    </View>,
                    errors.idexp
                  )}
                </Card>
              </Reveal>
            )}

            {/* ── Étape 3 : photos ── */}
            {step === 2 && (
              <Reveal key="s2" offset={14}>
                <Card style={styles.sectionCard}>
                  <Text style={styles.photoLabel}>{t('kyc.idPhoto')}</Text>
                  <View style={styles.guideImageDocWrapper}>
                    <Image source={require('../assets/kyc_id_sample.jpg')} style={styles.guideImageFill} />
                  </View>
                  <Text style={styles.photoHint}>{t('kyc.idHint')}</Text>
                  {renderPhotoPicker(idPreview, 'id', 'id-card', t('kyc.addId'), errors.idPhoto)}

                  <View style={styles.divider} />

                  <Text style={styles.photoLabel}>{t('kyc.selfieWithId')}</Text>
                  <View style={styles.guideImageWrapper}>
                    <Image source={require('../assets/kyc_selfie_sample.jpg')} style={styles.guideImageFill} />
                  </View>
                  <Text style={styles.photoHint}>{t('kyc.selfieHint')}</Text>
                  {renderPhotoPicker(selfiePreview, 'selfie', 'camera-retro', t('kyc.addSelfie'), errors.selfie)}
                </Card>
              </Reveal>
            )}

            {/* ── Étape 4 : récapitulatif ── */}
            {step === 3 && (
              <Reveal key="s3" offset={14}>
                <View style={styles.reviewHero}>
                  <LinearGradient colors={['#3ecf8e', '#198754']} style={styles.reviewIcon}>
                    <FontAwesome6 name="clipboard-check" size={26} color={colors.white} />
                  </LinearGradient>
                  <Text style={styles.reviewTitle}>{t('kyc.reviewTitle')}</Text>
                </View>

                {renderSummaryCard(t('kyc.identity'), 0, (
                  <>
                    {renderSummaryRow(t('kyc.country'), selectedCountry?.name)}
                    {renderSummaryRow(t('kyc.city'), city)}
                    {renderSummaryRow(t('kyc.postcode'), postcode)}
                    {renderSummaryRow(t('kyc.state'), stateProv)}
                    {renderSummaryRow(t('kyc.address'), address)}
                    {renderSummaryRow(t('kyc.birthdate'), (birthDay && birthMonth && birthYear) ? `${birthDay}/${birthMonth}/${birthYear}` : '')}
                    {renderSummaryRow(t('kyc.whatsapp'), `${prefix} ${phone}`.trim())}
                    {!!telegram.trim() && renderSummaryRow('Telegram', telegram)}
                  </>
                ))}

                {renderSummaryCard(t('kyc.document'), 1, (
                  <>
                    {renderSummaryRow(t('kyc.documentType'), docLabel)}
                    {renderSummaryRow(t('kyc.idNumber'), idnumber)}
                    {country === 'NG' && renderSummaryRow(t('kyc.bvn'), bvn)}
                    {renderSummaryRow(t('kyc.expiryDate'), `${idexpMonth}/${idexpYear}`)}
                  </>
                ))}

                {renderSummaryCard(t('kyc.stepPhotos'), 2, (
                  <View style={styles.thumbRow}>
                    {[idPreview, selfiePreview].map((uri, i) => (
                      <View key={i} style={styles.thumbWrap}>
                        {uri ? <Image source={{ uri }} style={styles.thumb} /> : <View style={styles.thumb} />}
                        <View style={styles.thumbBadge}>
                          <FontAwesome6 name="check" size={9} color={colors.white} />
                        </View>
                      </View>
                    ))}
                  </View>
                ))}
              </Reveal>
            )}

            <View style={styles.laterWrap}>
              <Bounce style={styles.laterBtn} scaleTo={0.97} onPress={goBack}>
                <View style={styles.laterIcon}>
                  <FontAwesome6 name="clock-rotate-left" size={12} color={colors.textSecondary} />
                </View>
                <Text style={styles.laterText}>{t('common.completeLater')}</Text>
              </Bounce>
            </View>
          </View>{/* /maxWidth wrapper */}
        </ScrollView>

        {/* Barre d'action fixe — l'action principale reste sous le pouce */}
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
          <View style={[styles.footerInner, { maxWidth: contentMaxWidth }]}>
            <Bounce style={styles.footerBack} scaleTo={0.95} onPress={goPrev} disabled={loading}>
              <FontAwesome6 name="arrow-left" size={15} color={colors.text} />
            </Bounce>
            {step < STEP_COUNT - 1 ? (
              <Button
                title={t('common.next')}
                onPress={goNext}
                icon="arrow-right"
                style={styles.footerBtn}
              />
            ) : (
              <Button
                title={t('kyc.validateKyc')}
                onPress={handleSubmit}
                icon="fingerprint"
                loading={loading}
                disabled={!allDone}
                style={styles.footerBtn}
              />
            )}
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Country picker modal */}
      <ResponsiveModal visible={countryModalVisible} onClose={() => { setCountryModalVisible(false); setCountrySearch(''); }} width={420}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('kyc.selectCountry')}</Text>
            <TouchableOpacity onPress={() => { setCountryModalVisible(false); setCountrySearch(''); }} hitSlop={10}>
              <FontAwesome6 name="xmark" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalSearchRow}>
            <FontAwesome6 name="magnifying-glass" size={14} color={colors.textMuted} />
            <TextInput
              placeholder={t('kyc.searchCountry')}
              placeholderTextColor={colors.textMuted}
              value={countrySearch}
              onChangeText={setCountrySearch}
              style={styles.modalSearchInput}
              selectionColor={colors.secondary}
              autoCorrect={false}
            />
          </View>
          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const active = item.code === country;
              return (
                <TouchableOpacity
                  style={[styles.countryItem, active && styles.countryItemActive]}
                  onPress={() => {
                    setCountry(item.code);
                    setErrors((p) => ({ ...p, country: '' }));
                    setCountryModalVisible(false);
                    setCountrySearch('');
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.countryItemText, active && styles.countryItemTextActive]}>{item.name}</Text>
                  <Text style={styles.countryItemPhone}>+{item.phone}</Text>
                  {active && <FontAwesome6 name="check" size={13} color={colors.primary} style={{ marginLeft: Spacing.sm }} />}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </ResponsiveModal>
    </ScreenBackground>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  scroll: {
    padding: Spacing.lg,
    // La barre d'action est dans le flux (sous le ScrollView) : pas besoin de
    // réserver sa hauteur ici, sinon vide en fin de défilement.
    paddingBottom: Spacing.xl,
  },
  contentWrapper: {
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerText: {
    flex: 1,
    alignItems: 'center',
  },
  headerSub: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    marginTop: 2,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  backBtnGhost: {
    width: 36,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  // Progression
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  // Stepper
  stepper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  stepItem: {
    alignItems: 'center',
    width: 74,
    gap: 6,
  },
  stepDot: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  stepDotDone: {
    backgroundColor: Colors.positive,
    borderColor: Colors.positive,
  },
  stepDotLocked: {
    opacity: 0.5,
  },
  stepLine: {
    flex: 1,
    height: 2,
    marginTop: 16,
    borderRadius: 1,
    backgroundColor: Colors.border,
  },
  stepLineDone: {
    backgroundColor: Colors.positive,
  },
  stepLabel: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  stepLabelActive: {
    color: Colors.text,
  },
  // Sections
  sectionCard: {
    marginTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  // Champs
  field: {
    marginTop: Spacing.md,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  fieldError: {
    color: Colors.error,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    marginTop: 4,
  },
  inputFlush: {
    marginBottom: 0,
  },
  inputErrorBox: {
    borderColor: Colors.error,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  col: {
    flex: 1,
  },
  // Dates (JJ / MM / AAAA)
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  dateCell: {
    width: 64,
    marginBottom: 0,
  },
  dateCellWide: {
    width: 96,
    marginBottom: 0,
  },
  dateSep: {
    fontSize: FontSize.lg,
    color: Colors.textMuted,
    fontFamily: Fonts.bold,
  },
  // Sélecteur de pays
  countryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  countryPickerLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  countryPickerText: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  countryPickerPlaceholder: {
    flex: 1,
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  // Country modal
  modalContainer: {
    flex: 1,
    minHeight: 0,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  modalSearchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  modalSearchInput: {
    flex: 1,
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: Fonts.regular,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  countryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  countryItemActive: {
    backgroundColor: withAlpha(Colors.primary, 0.12),
  },
  countryItemText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Colors.text,
    flex: 1,
  },
  countryItemTextActive: {
    fontFamily: Fonts.bold,
    color: Colors.primary,
  },
  countryItemPhone: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontFamily: Fonts.regular,
    marginLeft: Spacing.sm,
  },
  // « Compléter plus tard » : pastille discrète, pas un lien souligné
  laterWrap: {
    alignItems: 'center',
    marginTop: Spacing.lg,
  },
  laterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: Spacing.md,
    borderRadius: BorderRadius.pill,
    // Teinte d'accent très diluée : lisible sur le fond clair comme sur le sombre
    // (inputBg est transparent en thème clair — il ne ferait pas de pastille).
    backgroundColor: withAlpha(Colors.secondary, 0.1),
    borderWidth: 1,
    borderColor: withAlpha(Colors.secondary, 0.25),
  },
  laterIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(Colors.secondary, 0.22),
  },
  laterText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  // Sélecteur de type de document
  docTypeContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  docTypeBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xs,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  docTypeBtnActive: {
    backgroundColor: withAlpha(Colors.primary, 0.12),
    borderColor: Colors.primary,
  },
  docTypeCheck: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docTypeText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
  },
  docTypeTextActive: {
    color: Colors.primary,
  },
  // Photos
  photoLabel: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  photoHint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  imagePicker: {
    height: 180,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: withAlpha(Colors.primary, 0.5),
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  imagePickerFilled: {
    borderStyle: 'solid',
    borderColor: Colors.positive,
  },
  imagePickerError: {
    borderColor: Colors.error,
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  placeholderIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: withAlpha(Colors.primary, 0.12),
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  placeholderTitle: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  placeholderHint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
  },
  previewImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  previewBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.positive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  retakeChip: {
    position: 'absolute',
    bottom: Spacing.sm,
    right: Spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.pill,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  retakeText: {
    color: Colors.white,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
  },
  // Image guide "process" : 596x342
  guideImageWrapper: {
    width: '100%',
    maxWidth: 420,
    aspectRatio: 596 / 342,
    alignSelf: 'center',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginVertical: Spacing.sm,
  },
  // Image guide "exemples piece" : 1201x836
  guideImageDocWrapper: {
    width: '100%',
    maxWidth: 420,
    aspectRatio: 1201 / 836,
    alignSelf: 'center',
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    marginVertical: Spacing.sm,
  },
  guideImageFill: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  // Récapitulatif
  reviewHero: {
    alignItems: 'center',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  reviewIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewTitle: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  sumHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sumEdit: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  sumRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: 7,
  },
  sumLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
  },
  sumValue: {
    flex: 1,
    textAlign: 'right',
    color: Colors.text,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  thumbRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  thumbWrap: {
    flex: 1,
    aspectRatio: 4 / 3,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: Colors.inputBg,
  },
  thumb: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  thumbBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.positive,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Barre d'action fixe
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.border,
    backgroundColor: Colors.cardSolid,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  footerInner: {
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  footerBack: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.inputBg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  footerBtn: {
    flex: 1,
  },
  // Pending / Validated state
  pendingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  pendingIconGrad: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 14,
    elevation: 6,
  },
  pendingTitle: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  pendingText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.md,
  },
});
