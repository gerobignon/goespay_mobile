import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  FlatList,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ScreenBackground } from '../src/components/ScreenBackground';
import { useResponsive } from '../src/hooks/useResponsive';
import { FontAwesome6 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { authService } from '../src/services/authService';
import { useAuthStore } from '../src/stores/authStore';
import { Input } from '../src/components/Input';
import { Button } from '../src/components/Button';
import { Card } from '../src/components/Card';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../src/constants/theme';
import type { ColorPalette } from '../src/constants/theme';
import { useThemedStyles } from '../src/hooks/useThemedStyles';
import { showAlert } from '../src/stores/alertStore';
import { ALL_COUNTRIES } from '../src/constants/countries';
import { useTranslation } from 'react-i18next';

const DOC_TYPES_KEYS = [
  { value: 'Passport', key: 'kyc.passport' },
  { value: 'Identity card', key: 'kyc.identityCard' },
  { value: "Driver's license", key: 'kyc.driverLicense' },
];

export default function KycScreen() {
  const router = useRouter();
  const { user, refreshProfile } = useAuthStore();
  const styles = useThemedStyles(createStyles);
  const { t } = useTranslation();
  const { contentMaxWidth } = useResponsive();

  const DOC_TYPES = DOC_TYPES_KEYS.map((d) => ({ value: d.value, label: t(d.key) }));

  // Personal info state (pre-filled from user)
  const [country, setCountry] = useState(user?.country ?? '');
  const [city, setCity] = useState(user?.city ?? '');
  const [address, setAddress] = useState(user?.address ?? '');
  const [idnumber, setIdnumber] = useState(user?.idnumber ?? '');
  // Date d'expiration : mois + année séparés
  const existingParts = (user?.idexp ?? '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const [idexpMonth, setIdexpMonth] = useState(existingParts ? existingParts[2] : '');
  const [idexpYear, setIdexpYear] = useState(existingParts ? existingParts[3] : '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [telegram, setTelegram] = useState(user?.telegram ?? '');

  // KYC docs state
  const [docType, setDocType] = useState('');
  const [fileUri, setFileUri] = useState<string | null>(null);
  const [selfieUri, setSelfieUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  const takePhoto = async (setter: (uri: string) => void) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      showAlert('Permission requise', "L'accès à la caméra est nécessaire pour le KYC.");
      return;
    }
    try {
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets[0]) {
        setter(result.assets[0].uri);
      }
    } catch {
      showAlert('Caméra indisponible', 'Veuillez vérifier que la caméra est accessible.');
    }
  };

  const handleSubmit = async () => {
    if (!city.trim()) { showAlert('Erreur', 'Veuillez entrer votre ville.'); return; }
    if (!address.trim()) { showAlert('Erreur', 'Veuillez entrer votre adresse.'); return; }
    if (!idnumber.trim()) { showAlert('Erreur', 'Veuillez entrer le numéro de votre pièce.'); return; }
    if (!idexpMonth.trim() || !idexpYear.trim()) { showAlert('Erreur', "Veuillez entrer la date d'expiration."); return; }
    const monthNum = parseInt(idexpMonth, 10);
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) { showAlert('Erreur', 'Mois invalide (1-12).'); return; }
    if (idexpYear.length !== 4) { showAlert('Erreur', 'Année invalide (4 chiffres).'); return; }
    const idexp = `${idexpMonth.padStart(2, '0')}/${idexpYear}`;
    if (!phone.trim()) { showAlert('Erreur', 'Veuillez entrer votre numéro de téléphone.'); return; }
    if (!docType) { showAlert('Erreur', 'Veuillez choisir un type de document.'); return; }
    if (!fileUri) { showAlert('Erreur', "Veuillez ajouter la photo de votre pièce d'identité."); return; }
    if (!selfieUri) { showAlert('Erreur', 'Veuillez ajouter votre selfie.'); return; }

    setLoading(true);
    try {
      await authService.uploadKyc(
        {
          type: docType,
          city: city.trim(),
          address: address.trim(),
          idnumber: idnumber.trim(),
          idexp: idexp.trim(),
          phone: phone.trim(),
          country,
          telegram: telegram.trim(),
        },
        fileUri,
        selfieUri
      );
      await refreshProfile();
      showAlert(
        t('kyc.docsSent'),
        t('kyc.docsSentMessage'),
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      const msg = error?.response?.data?.error
        || error?.response?.data?.message
        || (error?.response?.data?.errors ? Object.values(error.response.data.errors).flat().join('\n') : null)
        || "Erreur lors de l'envoi des documents.";
      showAlert('Erreur', msg as string);
    } finally {
      setLoading(false);
    }
  };

  // --- État: validate == 2 (en attente) ---
  if (user?.validate === 2) {
    return (
      <ScreenBackground>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.contentWrapper, { maxWidth: contentMaxWidth }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>{t('kyc.title')}</Text>
            <View style={{ width: 20 }} />
          </View>

          <Card>
            <View style={styles.pendingContainer}>
              <View style={styles.pendingIcon}>
                <FontAwesome6 name="clock" size={48} color={Colors.secondary} />
              </View>
              <Text style={styles.pendingTitle}>{t('kyc.documentsReceived')}</Text>
              <Text style={styles.pendingText}>
                {t('kyc.pending')}
              </Text>
            </View>
          </Card>

          <Button
            title="Retour au tableau de bord"
            onPress={() => router.replace('/(tabs)')}
            icon="house"
            style={{ marginTop: Spacing.xl }}
          />
          </View>
        </ScrollView>
      </ScreenBackground>
    );
  }

  // --- État: validate == 1 (déjà validé) ---
  if (user?.validate === 1) {
    return (
      <ScreenBackground>
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.contentWrapper, { maxWidth: contentMaxWidth }]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()}>
              <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.title}>{t('kyc.title')}</Text>
            <View style={{ width: 20 }} />
          </View>

          <Card>
            <View style={styles.pendingContainer}>
              <View style={[styles.pendingIcon, { backgroundColor: Colors.primary + '20' }]}>
                <FontAwesome6 name="circle-check" size={48} color={Colors.primary} />
              </View>
              <Text style={styles.pendingTitle}>{t('kyc.accountVerified')}</Text>
              <Text style={styles.pendingText}>
                {t('kyc.approved')}
              </Text>
            </View>
          </Card>

          <Button
            title="Retour"
            onPress={() => router.back()}
            icon="arrow-left"
            style={{ marginTop: Spacing.xl }}
          />
          </View>
        </ScrollView>
      </ScreenBackground>
    );
  }

  // --- État: validate == 0 (non vérifié) ---
  return (
    <ScreenBackground>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={[styles.contentWrapper, { maxWidth: contentMaxWidth }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('kyc.title')}</Text>
          <View style={{ width: 20 }} />
        </View>

        {/* Instructions */}
        <Card>
          <View style={styles.instructionRow}>
            <FontAwesome6 name="fingerprint" size={20} color={Colors.secondary} />
            <Text style={styles.instructions}>
              Vérifiez votre identité pour accéder à toutes les fonctionnalités de votre compte.
            </Text>
          </View>
        </Card>

        {/* Aperçu du processus */}
        <Image source={require('../assets/vali1.png')} style={styles.guideImage} />

        {/* ── Informations personnelles ── */}
        <Text style={styles.sectionTitle}>
          <FontAwesome6 name="user-gear" size={14} color={Colors.secondary} />
          {'  '}Informations personnelles
        </Text>
        <Card style={{ gap: Spacing.sm }}>
          {/* Pays */}
          <Text style={styles.fieldLabel}>{t('kyc.country')}</Text>
          <TouchableOpacity
            style={styles.countryPicker}
            onPress={() => setCountryModalVisible(true)}
            activeOpacity={0.7}
          >
            <Text style={selectedCountry ? styles.countryPickerText : styles.countryPickerPlaceholder}>
              {selectedCountry ? `${selectedCountry.name} (+${selectedCountry.phone})` : t('kyc.selectCountry')}
            </Text>
            <FontAwesome6 name="chevron-down" size={12} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* Ville */}
          <Text style={styles.fieldLabel}>{t('kyc.city')}</Text>
          <Input placeholder="Votre ville" value={city} onChangeText={setCity} />

          {/* Adresse */}
          <Text style={styles.fieldLabel}>{t('kyc.address')}</Text>
          <Input placeholder="Adresse complète" value={address} onChangeText={setAddress} />

          {/* N° pièce d'identité */}
          <Text style={styles.fieldLabel}>N° pièce d'identité</Text>
          <Input placeholder="Numéro de la pièce" value={idnumber} onChangeText={setIdnumber} />

          {/* Date d'expiration */}
          <Text style={styles.fieldLabel}>{t('kyc.expiryDate')}</Text>
          <View style={styles.expiryRow}>
            <View style={styles.expiryField}>
              <Input
                placeholder="MM"
                value={idexpMonth}
                onChangeText={(v) => setIdexpMonth(v.replace(/[^0-9]/g, '').slice(0, 2))}
                keyboardType="number-pad"
              />
            </View>
            <Text style={styles.expirySep}>/</Text>
            <View style={styles.expiryFieldWide}>
              <Input
                placeholder="AAAA"
                value={idexpYear}
                onChangeText={(v) => setIdexpYear(v.replace(/[^0-9]/g, '').slice(0, 4))}
                keyboardType="number-pad"
              />
            </View>
          </View>

          {/* Téléphone */}
          <Text style={styles.fieldLabel}>{t('kyc.whatsapp')} {prefix ? `(${prefix})` : ''}</Text>
          <Input
            placeholder="Numéro sans indicatif"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          {/* Telegram */}
          <Text style={styles.fieldLabel}>{t('kyc.telegramOptional')}</Text>
          <Input placeholder="@username" value={telegram} onChangeText={setTelegram} />
        </Card>

        {/* ── Type de document ── */}
        <Text style={styles.sectionTitle}>
          <FontAwesome6 name="id-card" size={14} color={Colors.secondary} />
          {'  '}Type de document
        </Text>
        <View style={styles.docTypeContainer}>
          {DOC_TYPES.map((dt) => (
            <TouchableOpacity
              key={dt.value}
              style={[
                styles.docTypeBtn,
                docType === dt.value && styles.docTypeBtnActive,
              ]}
              onPress={() => setDocType(dt.value)}
              activeOpacity={0.7}
            >
              <FontAwesome6
                name={dt.value === 'Passport' ? 'passport' : dt.value === 'Identity card' ? 'id-card' : 'car'}
                size={16}
                color={docType === dt.value ? Colors.white : Colors.textMuted}
              />
              <Text
                style={[
                  styles.docTypeText,
                  docType === dt.value && styles.docTypeTextActive,
                ]}
              >
                {dt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Photo pièce d'identité (visible seulement si docType choisi) ── */}
        {docType ? (
          <>
            <Text style={styles.sectionTitle}>
              <FontAwesome6 name="camera" size={14} color={Colors.secondary} />
              {'  '}Photo de la pièce d'identité
            </Text>
            <Image source={require('../assets/vali0.jpg')} style={styles.guideImage} />
            <TouchableOpacity
              style={styles.imagePicker}
              onPress={() => takePhoto(setFileUri)}
              activeOpacity={0.7}
            >
              {fileUri ? (
                <Image source={{ uri: fileUri }} style={styles.previewImage} />
              ) : (
                <View style={styles.placeholderContainer}>
                  <View style={styles.placeholderIcon}>
                    <FontAwesome6 name="id-card" size={28} color={Colors.textMuted} />
                  </View>
                  <Text style={styles.placeholderTitle}>{t('kyc.addId')}</Text>
                  <Text style={styles.placeholderHint}>JPG ou PNG • Max 8 Mo</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* ── Selfie avec la pièce ── */}
            <Text style={styles.sectionTitle}>
              <FontAwesome6 name="user" size={14} color={Colors.secondary} />
              {'  '}Selfie avec la pièce + "GOESPAY"
            </Text>
            <Image source={require('../assets/vali2.png')} style={styles.guideImage} />
            <Card style={{ marginBottom: Spacing.sm, paddingVertical: Spacing.sm }}>
              <View style={styles.instructionRow}>
                <FontAwesome6 name="circle-info" size={14} color={Colors.secondary} />
                <Text style={styles.selfieHint}>
                  Prenez un selfie en tenant votre pièce d'identité et un papier écrit "GOESPAY" visible.
                </Text>
              </View>
            </Card>
            <TouchableOpacity
              style={styles.imagePicker}
              onPress={() => takePhoto(setSelfieUri)}
              activeOpacity={0.7}
            >
              {selfieUri ? (
                <Image source={{ uri: selfieUri }} style={styles.previewImage} />
              ) : (
                <View style={styles.placeholderContainer}>
                  <View style={styles.placeholderIcon}>
                    <FontAwesome6 name="camera-retro" size={28} color={Colors.textMuted} />
                  </View>
                  <Text style={styles.placeholderTitle}>{t('kyc.addSelfie')}</Text>
                  <Text style={styles.placeholderHint}>JPG ou PNG • Max 8 Mo</Text>
                </View>
              )}
            </TouchableOpacity>
          </>
        ) : null}

        <Button
          title="Valider le KYC"
          onPress={handleSubmit}
          icon="fingerprint"
          loading={loading}
          disabled={!docType || !fileUri || !selfieUri || !city || !address || !idnumber || !idexpMonth || !idexpYear || !phone}
          style={{ marginTop: Spacing.xl, marginBottom: Spacing.xxl }}
        />

        <TouchableOpacity
          style={styles.laterBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
        >
          <FontAwesome6 name="rectangle-xmark" size={14} color={Colors.textMuted} />
          <Text style={styles.laterText}>{t('common.completeLater')}</Text>
        </TouchableOpacity>
        </View>{/* /maxWidth wrapper */}
      </ScrollView>

      {/* Country picker modal */}
      <Modal visible={countryModalVisible} animationType="slide" transparent={false}>
        <SafeAreaView style={[styles.modalContainer, { flex: 1 }]} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t('kyc.selectCountry')}</Text>
            <TouchableOpacity onPress={() => { setCountryModalVisible(false); setCountrySearch(''); }}>
              <FontAwesome6 name="xmark" size={20} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.modalSearchRow}>
            <FontAwesome6 name="magnifying-glass" size={14} color={Colors.textMuted} />
            <TextInput
              placeholder="Rechercher un pays..."
              placeholderTextColor={Colors.textMuted}
              value={countrySearch}
              onChangeText={setCountrySearch}
              style={styles.modalSearchInput}
              selectionColor={Colors.secondary}
              autoCorrect={false}
            />
          </View>
          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[
                  styles.countryItem,
                  item.code === country && styles.countryItemActive,
                ]}
                onPress={() => {
                  setCountry(item.code);
                  setCountryModalVisible(false);
                  setCountrySearch('');
                }}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.countryItemText,
                  item.code === country && styles.countryItemTextActive,
                ]}>
                  {item.name}
                </Text>
                <Text style={styles.countryItemPhone}>+{item.phone}</Text>
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
    </ScreenBackground>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  scroll: {
    padding: Spacing.lg,
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
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  instructionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  instructions: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: FontSize.md,
    fontFamily: Fonts.bold,
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  // Date d'expiration : deux champs côte à côte
  expiryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  expiryField: {
    width: 80,
  },
  expiryFieldWide: {
    flex: 1,
  },
  expirySep: {
    fontSize: FontSize.lg,
    color: Colors.textMuted,
    fontFamily: Fonts.bold,
  },
  // Field labels & country picker
  fieldLabel: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
    marginBottom: 4,
    marginTop: Spacing.sm,
  },
  countryPicker: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  countryPickerText: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    color: Colors.text,
  },
  countryPickerPlaceholder: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  // Country modal
  modalContainer: {
    flex: 1,
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
    backgroundColor: Colors.primary + '20',
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
  // Later button
  laterBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    marginTop: Spacing.sm,
  },
  laterText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    textDecorationLine: 'underline',
  },
  // Document type selector
  docTypeContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  docTypeBtn: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  docTypeBtnActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  docTypeText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.semiBold,
    textAlign: 'center',
  },
  docTypeTextActive: {
    color: Colors.white,
  },
  // Image pickers
  imagePicker: {
    height: 180,
    backgroundColor: Colors.inputBg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  placeholderIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.border + '50',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  placeholderTitle: {
    color: Colors.textSecondary,
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
  guideImage: {
    width: '100%',
    height: undefined,
    aspectRatio: 16 / 9,
    resizeMode: 'contain',
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
  },
  selfieHint: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    lineHeight: 18,
  },
  // Pending / Validated state
  pendingContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  pendingIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.secondary + '20',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
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
