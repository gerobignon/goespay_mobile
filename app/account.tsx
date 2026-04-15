import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TouchableWithoutFeedback,
  Animated,
  PanResponder,
  Dimensions,
  KeyboardAvoidingView,
  Keyboard,
  Platform,
  Image,
  Alert,
  ImageBackground,
  Modal,
  Switch,
  Linking,
  Clipboard,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuthStore } from '../src/stores/authStore';
import { usePinStore } from '../src/stores/pinStore';
import {
  isBiometricAvailable,
  clearPin,
  savePin,
  setLockMethod,
  getLockMethod,
  type LockMethod,
} from '../src/services/secureAuthService';
import { authService } from '../src/services/authService';
import { Input } from '../src/components/Input';
import { OtpInput } from '../src/components/OtpInput';
import { Button } from '../src/components/Button';
import { PinPad } from '../src/components/PinPad';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../src/constants/theme';
import { API_BASE_URL } from '../src/constants/config';
import { ALL_COUNTRIES } from '../src/constants/countries';
import { showAlert } from '../src/stores/alertStore';
import { CustomAlert } from '../src/components/CustomAlert';

export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, setUser, logout, refreshProfile } = useAuthStore();
  const { lockMethod: storeLockMethod, setMethod } = usePinStore();
  const [loading, setLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const isReadonly = user?.validate === 1;

  // Sécurité
  const [bioAvailable, setBioAvailable] = useState(false);
  const [currentLockMethod, setCurrentLockMethod] = useState<LockMethod>(null);
  const [pinModalVisible, setPinModalVisible] = useState(false);
  const [pinStep, setPinStep] = useState<'password' | 'enter' | 'confirm'>('password');
  const [pinPasswordCheck, setPinPasswordCheck] = useState('');
  const [pinPasswordError, setPinPasswordError] = useState<string | null>(null);
  const [pinPasswordLoading, setPinPasswordLoading] = useState(false);
  const [firstPin, setFirstPin] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinReset, setPinReset] = useState(false);

  // 2FA
  const [twoFaEnabled, setTwoFaEnabled] = useState(false);
  const [twoFaModalVisible, setTwoFaModalVisible] = useState(false);
  const [twoFaStep, setTwoFaStep] = useState<'qr' | 'code' | 'disable' | 'recovery'>('qr');
  const [twoFaSecret, setTwoFaSecret] = useState('');
  const [twoFaQrUrl, setTwoFaQrUrl] = useState('');
  const [twoFaCode, setTwoFaCode] = useState('');
  const [twoFaDisablePassword, setTwoFaDisablePassword] = useState('');
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [twoFaRecoveryCodes, setTwoFaRecoveryCodes] = useState<string[]>([]);

  useEffect(() => {
    isBiometricAvailable().then(setBioAvailable);
    getLockMethod().then(setCurrentLockMethod);
    authService.get2faStatus().then((s) => setTwoFaEnabled(s.enabled)).catch(() => {});
  }, []);

  const handleSwitchToBio = async () => {
    await setLockMethod('biometric');
    await clearPin();
    await setMethod('biometric');
    setCurrentLockMethod('biometric');
    showAlert('Succès', 'Biométrie activée.');
  };

  const handleSwitchToPin = () => {
    setPinStep('password');
    setPinPasswordCheck('');
    setPinPasswordError(null);
    setFirstPin('');
    setPinError(null);
    setPinModalVisible(true);
  };

  const handlePinPasswordCheck = async () => {
    if (!pinPasswordCheck.trim()) {
      setPinPasswordError('Entrez votre mot de passe.');
      return;
    }
    setPinPasswordLoading(true);
    try {
      // Vérification silencieuse via login (ne stocke pas le nouveau token)
      await authService.login({ email: user!.email, password: pinPasswordCheck });
      setPinPasswordError(null);
      setPinStep('enter');
    } catch {
      setPinPasswordError('Mot de passe incorrect.');
    } finally {
      setPinPasswordLoading(false);
    }
  };

  const handlePinFirst = (pin: string) => {
    setFirstPin(pin);
    setPinError(null);
    setPinReset((v) => !v); // vide le clavier avant la confirmation
    setPinStep('confirm');
  };

  const handlePinConfirm = async (pin: string) => {
    if (pin !== firstPin) {
      setPinError('Les PIN ne correspondent pas.');
      setPinReset((v) => !v);
      setPinStep('enter');
      setFirstPin('');
      return;
    }
    await savePin(pin);
    await setLockMethod('pin');
    await setMethod('pin');
    setCurrentLockMethod('pin');
    setPinModalVisible(false);
    showAlert('Succès', 'Code PIN configuré.');
  };

  // 2FA handlers
  const handleEnable2fa = async () => {
    setTwoFaLoading(true);
    try {
      const data = await authService.enable2fa();
      setTwoFaSecret(data.secret);
      setTwoFaQrUrl(data.qr_url || '');
      setTwoFaStep('qr');
      setTwoFaModalVisible(true);
    } catch (e: any) {
      showAlert('Erreur', e?.response?.data?.error || 'Impossible d\'activer le 2FA.');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleConfirm2fa = async () => {
    if (twoFaCode.length !== 6) {
      showAlert('Erreur', 'Entrez un code à 6 chiffres.');
      return;
    }
    setTwoFaLoading(true);
    try {
      const res = await authService.confirm2fa(twoFaCode);
      setTwoFaEnabled(true);
      setTwoFaCode('');
      setTwoFaRecoveryCodes(res.recovery_codes ?? []);
      setTwoFaStep('recovery');
    } catch (e: any) {
      showAlert('Erreur', e?.response?.data?.error || 'Code incorrect.');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const handleDisable2fa = async () => {
    if (!twoFaDisablePassword.trim()) {
      showAlert('Erreur', 'Entrez votre mot de passe.');
      return;
    }
    setTwoFaLoading(true);
    try {
      await authService.disable2fa(twoFaDisablePassword);
      setTwoFaEnabled(false);
      setTwoFaModalVisible(false);
      setTwoFaDisablePassword('');
      showAlert('Succès', '2FA désactivé.');
    } catch (e: any) {
      showAlert('Erreur', e?.response?.data?.error || 'Mot de passe incorrect.');
    } finally {
      setTwoFaLoading(false);
    }
  };

  const [form, setForm] = useState({
    name: user?.name || '',
    surname: user?.surname || '',
    phone: user?.phone || '',
    city: user?.city || '',
    address: user?.address || '',
    telegram: user?.telegram || '',
  });

  const setField = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setLoading(true);
    try {
      const updated = await authService.updateProfile(isReadonly ? { telegram: form.telegram } : form);
      setUser(updated);
      showAlert('Succès', 'Profil mis à jour.');
    } catch (error: any) {
      showAlert(
        'Erreur',
        error?.response?.data?.message || 'Erreur lors de la mise à jour.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarPick = async () => {
    Alert.alert('Choisir une photo', 'Comment souhaitez-vous ajouter votre photo ?', [
      {
        text: 'Prendre une photo',
        onPress: async () => {
          const { granted } = await ImagePicker.requestCameraPermissionsAsync();
          if (!granted) { showAlert('Erreur', 'Permission caméra refusée.'); return; }
          const result = await ImagePicker.launchCameraAsync({
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            try {
              await authService.uploadAvatar(result.assets[0].uri);
              await refreshProfile();
              showAlert('Succès', 'Avatar mis à jour.');
            } catch {
              showAlert('Erreur', "Impossible de mettre à jour l'avatar.");
            }
          }
        },
      },
      {
        text: 'Galerie',
        onPress: async () => {
          const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (!granted) { showAlert('Erreur', 'Permission galerie refusée.'); return; }
          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.8,
          });
          if (!result.canceled && result.assets[0]) {
            try {
              await authService.uploadAvatar(result.assets[0].uri);
              await refreshProfile();
              showAlert('Succès', 'Avatar mis à jour.');
            } catch {
              showAlert('Erreur', "Impossible de mettre à jour l'avatar.");
            }
          }
        },
      },
      { text: 'Annuler', style: 'cancel' },
    ]);
  };

  const [formOpen, setFormOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwModalVisible, setPwModalVisible] = useState(false);

  const SCREEN_HEIGHT = Dimensions.get('window').height;
  const DEFAULT_H = SCREEN_HEIGHT * 0.92;
  const MIN_H = SCREEN_HEIGHT * 0.3;
  const MAX_H = SCREEN_HEIGHT * 0.92;

  const makePanResponder = (sheetHeight: Animated.Value, lastHeight: React.MutableRefObject<number>) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, { dy }) => {
        sheetHeight.setValue(Math.max(MIN_H, Math.min(MAX_H, lastHeight.current - dy)));
      },
      onPanResponderRelease: (_, { dy }) => {
        const clampedH = Math.max(MIN_H, Math.min(MAX_H, lastHeight.current - dy));
        lastHeight.current = clampedH;
        Animated.spring(sheetHeight, { toValue: clampedH, useNativeDriver: false, bounciness: 4 }).start();
      },
    });

  const pwSheetHeight = useRef(new Animated.Value(DEFAULT_H)).current;
  const pwLastHeight = useRef(DEFAULT_H);
  const pwPanResponder = useRef(makePanResponder(pwSheetHeight, pwLastHeight)).current;

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      const kbHeight = e.endCoordinates.height;
      Animated.timing(pwSheetHeight, {
        toValue: Math.max(MIN_H, pwLastHeight.current - kbHeight),
        duration: 150,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      Animated.timing(pwSheetHeight, {
        toValue: pwLastHeight.current,
        duration: 150,
        useNativeDriver: false,
      }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [pwSheetHeight]);

  const twoFaSheetHeight = useRef(new Animated.Value(DEFAULT_H)).current;
  const twoFaLastHeight = useRef(DEFAULT_H);
  const twoFaPanResponder = useRef(makePanResponder(twoFaSheetHeight, twoFaLastHeight)).current;

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const showSub = Keyboard.addListener('keyboardDidShow', (e) => {
      const kbHeight = e.endCoordinates.height;
      Animated.timing(twoFaSheetHeight, {
        toValue: Math.max(MIN_H, twoFaLastHeight.current - kbHeight),
        duration: 150,
        useNativeDriver: false,
      }).start();
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      Animated.timing(twoFaSheetHeight, {
        toValue: twoFaLastHeight.current,
        duration: 150,
        useNativeDriver: false,
      }).start();
    });
    return () => { showSub.remove(); hideSub.remove(); };
  }, [twoFaSheetHeight]);

  const handleClosePwModal = () => {
    const hasData = !!currentPassword || !!newPassword || !!confirmPassword;
    if (hasData) {
      showAlert(
        'Annuler le changement ?',
        'Les informations saisies seront perdues.',
        [
          { text: 'Continuer la saisie' },
          { text: 'Quitter', onPress: () => { setPwModalVisible(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); } },
        ],
      );
    } else {
      setPwModalVisible(false);
    }
  };

  const handleCloseTwoFaModal = () => {
    const hasData = !!twoFaCode || !!twoFaDisablePassword;
    if (hasData) {
      showAlert(
        'Annuler la configuration ?',
        'Les informations saisies seront perdues.',
        [
          { text: 'Continuer la saisie' },
          { text: 'Quitter', onPress: () => { setTwoFaModalVisible(false); setTwoFaCode(''); setTwoFaDisablePassword(''); } },
        ],
      );
    } else {
      setTwoFaModalVisible(false);
      setTwoFaCode('');
      setTwoFaDisablePassword('');
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword.trim()) {
      showAlert('Erreur', 'Veuillez entrer votre mot de passe actuel.');
      return;
    }
    if (newPassword.length < 6) {
      showAlert('Erreur', 'Le nouveau mot de passe doit faire au moins 6 caractères.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('Erreur', 'Les mots de passe ne correspondent pas.');
      return;
    }
    setPwLoading(true);
    try {
      await authService.changePassword({
        current_password: currentPassword,
        password: newPassword,
        password_confirmation: confirmPassword,
      });
      showAlert('Succès', 'Mot de passe modifié avec succès.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPwModalVisible(false);
    } catch (error: any) {
      const message =
        error?.response?.data?.error ||
        error?.response?.data?.message ||
        'Erreur lors du changement de mot de passe.';
      showAlert('Erreur', message);
    } finally {
      setPwLoading(false);
    }
  };

  const handleLogout = () => {
    showAlert('Déconnexion', 'Voulez-vous vous déconnecter ?', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Déconnecter', style: 'destructive', onPress: async () => {
          await logout();
          usePinStore.setState({ lockMethod: null, isSetupDone: false, isLocked: false });
        }
      },
    ], 'warning');
  };

  const countryName = ALL_COUNTRIES.find((c) => c.code === user?.country)?.name || user?.country || '';

  const avatarSource = user?.avatar
    ? { uri: user.avatar.startsWith('http') ? user.avatar : `${API_BASE_URL.replace('/api/mobile/v1', '')}${user.avatar}` }
    : null;

  return (
    <ImageBackground
      source={require('../assets/bg_page.jpg')}
      style={styles.background}
    >
      <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>Mon compte</Text>
        </View>

        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity style={styles.avatarWrapper} onPress={handleAvatarPick}>
            {avatarSource ? (
              <Image source={avatarSource} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <FontAwesome6 name="user" size={32} color={Colors.textMuted} />
              </View>
            )}
            <View style={styles.avatarBadge}>
              <FontAwesome6 name="camera" size={10} color={Colors.white} />
            </View>
          </TouchableOpacity>
          <Text style={styles.userName}>
            {user?.surname} {user?.name}
          </Text>
          <Text style={styles.userEmail}>{user?.email}</Text>
        </View>

        {isReadonly && (
          <View style={styles.verifiedBadge}>
            <FontAwesome6 name="circle-check" size={16} color={Colors.success} />
            <Text style={styles.verifiedText}>Compte vérifié</Text>
          </View>
        )}

        {/* KYC link */}
        {user?.validate === 0 && (
          <Button
            title="Vérifier mon identité (KYC)"
            icon="id-card"
            variant="secondary"
            onPress={() => router.push('/kyc')}
            style={{ marginBottom: Spacing.lg }}
          />
        )}

        {/* Form — accordéon */}
        <TouchableOpacity
          style={styles.accordionHeader}
          onPress={() => setFormOpen((v) => !v)}
          activeOpacity={0.7}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <FontAwesome6 name="user-pen" size={14} color={Colors.secondary} />
            <Text style={styles.accordionTitle}>Informations personnelles</Text>
          </View>
          <FontAwesome6
            name={formOpen ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={Colors.textMuted}
          />
        </TouchableOpacity>

        {formOpen && (
        <View style={styles.formCard}>
          <Input
            label="Prénom"
            value={form.name}
            onChangeText={(v) => setField('name', v)}
            editable={!isReadonly}
          />
          <Input
            label="Nom"
            value={form.surname}
            onChangeText={(v) => setField('surname', v)}
            editable={!isReadonly}
          />
          <Input
            label="Téléphone"
            value={form.phone}
            onChangeText={(v) => setField('phone', v)}
            editable={!isReadonly}
            keyboardType="phone-pad"
          />
          <Input
            label="Pays"
            value={countryName}
            editable={false}
          />
          <Input
            label="Ville"
            value={form.city}
            onChangeText={(v) => setField('city', v)}
            editable={!isReadonly}
          />
          <Input
            label="Adresse"
            value={form.address}
            onChangeText={(v) => setField('address', v)}
            editable={!isReadonly}
          />
          {user?.idnumber ? (
            <Input
              label="N° pièce d'identité"
              value={user.idnumber}
              editable={false}
            />
          ) : null}
          {user?.idexp ? (
            <Input
              label="Date d'expiration"
              value={user.idexp}
              editable={false}
            />
          ) : null}
          <Input
            label="Telegram"
            value={form.telegram}
            onChangeText={(v) => setField('telegram', v)}
            editable={true}
            prefix="@"
            rightAction={isReadonly ? { icon: 'floppy-disk', onPress: handleSave, loading } : undefined}
          />
          {!isReadonly && (
            <Button
              title="Enregistrer"
              onPress={handleSave}
              loading={loading}
              style={{ marginTop: Spacing.sm }}
            />
          )}

          <TouchableOpacity
            style={styles.changeRequestRow}
            onPress={() => {
              const subject = encodeURIComponent('Demande de modification de profil');
              const body = encodeURIComponent(
                `Bonjour,\n\nJe souhaite modifier les informations de mon compte (${user?.email}).\n\nChamp à modifier : \nNouvelle valeur : \n\nMerci.`
              );
              Linking.openURL(`mailto:support@goespay.io?subject=${subject}&body=${body}`);
            }}
          >
            <FontAwesome6 name="pen-to-square" size={14} color={Colors.secondary} />
            <Text style={styles.changeRequestText}>Demander une modification</Text>
          </TouchableOpacity>
        </View>
        )}

        {/* Section Sécurité */}
        <View style={[styles.formCard, { marginTop: Spacing.lg }]}>
          <Text style={styles.sectionTitle}>
            <FontAwesome6 name="shield-halved" size={14} color={Colors.secondary} /> Sécurité
          </Text>

          {/* PIN */}
          <TouchableOpacity
            style={styles.securityRow}
            onPress={handleSwitchToPin}
          >
            <View style={styles.securityIcon}>
              <FontAwesome6 name="hashtag" size={16} color={currentLockMethod === 'pin' ? Colors.primary : Colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.securityLabel}>Code PIN</Text>
              <Text style={styles.securityDesc}>
                {currentLockMethod === 'pin' ? 'Actif — appuyez pour changer' : 'Inactif'}
              </Text>
            </View>
            {currentLockMethod === 'pin' && (
              <FontAwesome6 name="circle-check" size={16} color={Colors.primary} />
            )}
          </TouchableOpacity>

          {/* Biométrie */}
          {bioAvailable && (
            <TouchableOpacity
              style={styles.securityRow}
              onPress={handleSwitchToBio}
            >
              <View style={styles.securityIcon}>
                <FontAwesome6 name="fingerprint" size={16} color={currentLockMethod === 'biometric' ? Colors.secondary : Colors.textMuted} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.securityLabel}>Face ID / Touch ID</Text>
                <Text style={styles.securityDesc}>
                  {currentLockMethod === 'biometric' ? 'Actif' : 'Inactif — appuyez pour activer'}
                </Text>
              </View>
              {currentLockMethod === 'biometric' && (
                <FontAwesome6 name="circle-check" size={16} color={Colors.secondary} />
              )}
            </TouchableOpacity>
          )}

          {/* Modifier mot de passe */}
          <TouchableOpacity
            style={styles.securityRow}
            onPress={() => setPwModalVisible(true)}
          >
            <View style={styles.securityIcon}>
              <FontAwesome6 name="lock" size={16} color={Colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.securityLabel}>Mot de passe</Text>
              <Text style={styles.securityDesc}>Modifier le mot de passe</Text>
            </View>
            <FontAwesome6 name="chevron-right" size={14} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* 2FA */}
          <TouchableOpacity
            style={styles.securityRow}
            onPress={() => {
              if (twoFaEnabled) {
                setTwoFaStep('disable');
                setTwoFaModalVisible(true);
              } else {
                handleEnable2fa();
              }
            }}
          >
            <View style={styles.securityIcon}>
              <FontAwesome6 name="mobile-screen" size={16} color={twoFaEnabled ? Colors.success : Colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.securityLabel}>Authentification 2 facteurs</Text>
              <Text style={styles.securityDesc}>
                {twoFaEnabled ? 'Actif — Double authentification' : 'Inactif — appuyez pour activer'}
              </Text>
            </View>
            {twoFaEnabled && (
              <FontAwesome6 name="circle-check" size={16} color={Colors.success} />
            )}
          </TouchableOpacity>
        </View>

        <Button
          title="Se déconnecter"
          onPress={handleLogout}
          variant="outline"
          icon="right-from-bracket"
          style={{ marginTop: Spacing.xl }}
        />
      </ScrollView>
      </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Modal 2FA */}
      <Modal visible={twoFaModalVisible} animationType="slide" transparent onRequestClose={handleCloseTwoFaModal}>
        <TouchableWithoutFeedback onPress={handleCloseTwoFaModal}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <TouchableWithoutFeedback>
              <Animated.View style={[styles.modalSheet, { height: twoFaSheetHeight, paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
                <View style={styles.modalHandleContainer} {...twoFaPanResponder.panHandlers}>
                  <View style={styles.modalHandle} />
                </View>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {twoFaStep === 'disable' ? 'Désactiver le 2FA' : twoFaStep === 'recovery' ? 'Codes de récupération' : 'Double authentification (2FA)'}
                  </Text>
                  <TouchableOpacity onPress={handleCloseTwoFaModal}>
                    <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>

            {twoFaStep === 'qr' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.twoFaInstruction}>
                  1. Ouvrez une app d'authentification (<Text style={{ color: Colors.secondary }}>Google Authenticator</Text>, <Text style={{ color: Colors.secondary }}>Authy</Text>, <Text style={{ color: Colors.secondary }}>Microsoft Authenticator</Text>…){'\n'}
                  2. Scannez ce QR code :
                </Text>
                {twoFaQrUrl ? (
                  <View style={{ alignSelf: 'center', marginVertical: Spacing.md, backgroundColor: '#ffffff', borderRadius: 12, padding: 10 }}>
                    <Image
                      source={{ uri: twoFaQrUrl }}
                      style={{ width: 150, height: 150, borderRadius: 4 }}
                    />
                  </View>
                ) : null}
                <Text style={styles.twoFaInstruction}>
                  Ou entrez manuellement ce code secret :
                </Text>
                <TouchableOpacity
                  style={styles.secretBox}
                  onPress={() => {
                    Clipboard.setString(twoFaSecret);
                    showAlert('Copié', 'Code secret copié dans le presse-papiers.');
                  }}
                >
                  <Text style={styles.secretText}>{twoFaSecret}</Text>
                  <Text style={styles.secretHint}>Appuyer pour copier</Text>
                </TouchableOpacity>
                <Text style={[styles.twoFaInstruction, { marginTop: Spacing.md }]}>
                  4. Entrez le code à 6 chiffres généré par l'app :
                </Text>
                <OtpInput value={twoFaCode} onChange={setTwoFaCode} onComplete={handleConfirm2fa} />
                <Button
                  title="Confirmer"
                  onPress={handleConfirm2fa}
                  loading={twoFaLoading}
                  style={{ marginTop: Spacing.sm }}
                />
              </ScrollView>
            )}

            {twoFaStep === 'disable' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.twoFaInstruction}>
                  Entrez votre mot de passe pour désactiver le 2FA.
                </Text>
                <Input
                  label="Mot de passe"
                  value={twoFaDisablePassword}
                  onChangeText={setTwoFaDisablePassword}
                  secureTextEntry
                  placeholder="••••••••"
                />
                <Button
                  title="Désactiver le 2FA"
                  onPress={handleDisable2fa}
                  loading={twoFaLoading}
                  variant="outline"
                  style={{ marginTop: Spacing.sm }}
                />
              </ScrollView>
            )}

            {twoFaStep === 'recovery' && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={[styles.twoFaInstruction, { color: Colors.warning ?? Colors.secondary, fontFamily: Fonts.bold }]}>
                  ⚠️ Conservez ces codes de récupération en lieu sûr.
                </Text>
                <Text style={styles.twoFaInstruction}>
                  Ces codes permettent d'accéder à votre compte si vous perdez accès à votre application d'authentification. Chaque code ne peut être utilisé qu'une seule fois.
                </Text>
                <View style={styles.secretBox}>
                  {twoFaRecoveryCodes.map((code, i) => (
                    <Text key={i} style={[styles.secretText, { marginVertical: 2 }]}>{code}</Text>
                  ))}
                </View>
                <Button
                  title="Copier tous les codes"
                  onPress={() => {
                    Clipboard.setString(twoFaRecoveryCodes.join('\n'));
                    showAlert('Copié', 'Codes de récupération copiés dans le presse-papiers.');
                  }}
                  style={{ marginTop: Spacing.md }}
                />
                <Button
                  title="J'ai sauvegardé mes codes"
                  onPress={() => setTwoFaModalVisible(false)}
                  variant="outline"
                  style={{ marginTop: Spacing.sm }}
                />
              </ScrollView>
            )}
              </Animated.View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Modal PIN Setup */}
      <Modal visible={pinModalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {pinStep === 'password' ? 'Confirmer votre identité' : pinStep === 'enter' ? 'Nouveau PIN' : 'Confirmer le PIN'}
              </Text>
              <TouchableOpacity onPress={() => setPinModalVisible(false)}>
                <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            {pinStep === 'password' && (
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <Text style={styles.twoFaInstruction}>
                  Entrez votre mot de passe pour modifier votre PIN.
                </Text>
                <Input
                  label="Mot de passe actuel"
                  value={pinPasswordCheck}
                  onChangeText={setPinPasswordCheck}
                  secureTextEntry
                  placeholder="••••••••"
                  error={pinPasswordError || undefined}
                />
                <Button
                  title="Continuer"
                  onPress={handlePinPasswordCheck}
                  loading={pinPasswordLoading}
                  style={{ marginTop: Spacing.sm }}
                />
              </ScrollView>
            )}

            {(pinStep === 'enter' || pinStep === 'confirm') && (
              <View style={{ alignItems: 'center', paddingTop: Spacing.md }}>
                <PinPad
                  length={4}
                  onComplete={pinStep === 'enter' ? handlePinFirst : handlePinConfirm}
                  error={pinError}
                  reset={pinReset}
                  label={pinStep === 'enter' ? 'Choisissez un PIN à 4 chiffres' : 'Confirmez votre PIN'}
                />
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
      <Modal visible={pwModalVisible} animationType="slide" transparent onRequestClose={handleClosePwModal}>
        <CustomAlert />
        <TouchableWithoutFeedback onPress={handleClosePwModal}>
          <KeyboardAvoidingView
            style={styles.modalOverlay}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <TouchableWithoutFeedback>
              <Animated.View style={[styles.modalSheet, { height: pwSheetHeight, paddingBottom: Math.max(insets.bottom, Spacing.lg) }]}>
                <View style={styles.modalHandleContainer} {...pwPanResponder.panHandlers}>
                  <View style={styles.modalHandle} />
                </View>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Changer le mot de passe</Text>
                  <TouchableOpacity onPress={handleClosePwModal}>
                    <FontAwesome6 name="xmark" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Input
                label="Mot de passe actuel"
                placeholder="••••••••"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
              />
              <Input
                label="Nouveau mot de passe"
                placeholder="Min. 6 caractères"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              <Input
                label="Confirmer le mot de passe"
                placeholder="••••••••"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
              <Button
                title="Modifier le mot de passe"
                onPress={handleChangePassword}
                icon="lock"
                loading={pwLoading}
                style={{ marginTop: Spacing.sm }}
              />
            </ScrollView>
              </Animated.View>
            </TouchableWithoutFeedback>
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>
      </Modal>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    padding: Spacing.lg,
    paddingTop: Spacing.xxl + Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  avatarWrapper: {
    width: 90,
    height: 90,
    borderRadius: 45,
    marginBottom: Spacing.sm,
  },
  avatarImg: {
    width: 90,
    height: 90,
    borderRadius: 45,
    borderWidth: 2,
    borderColor: Colors.secondary,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.border,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: Colors.background,
  },
  userName: {
    fontSize: FontSize.lg,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
  userEmail: {
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginTop: 2,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(97,146,97,0.15)',
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(97,146,97,0.3)',
  },
  verifiedText: {
    color: Colors.success,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
  },
  accordionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 16,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 2,
  },
  accordionTitle: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
  },
  formCard: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  changeRequestRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: Spacing.md,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    backgroundColor: 'rgba(244,178,40,0.1)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(244,178,40,0.25)',
  },
  changeRequestText: {
    color: Colors.secondary,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
  },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  securityIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  securityLabel: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: Fonts.medium,
  },
  securityDesc: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    marginTop: 1,
  },
  twoFaInstruction: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.regular,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  secretBox: {
    backgroundColor: Colors.inputBg,
    borderRadius: 10,
    padding: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secretText: {
    color: Colors.secondary,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
    letterSpacing: 2,
    textAlign: 'center',
  },
  secretHint: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: BorderRadius.xl,
    borderTopRightRadius: BorderRadius.xl,
    padding: Spacing.lg,
    overflow: 'hidden',
  },
  modalHandleContainer: {
    alignSelf: 'stretch',
    alignItems: 'center',
    paddingTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontFamily: Fonts.bold,
    color: Colors.text,
  },
});
