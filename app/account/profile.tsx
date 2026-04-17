import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ImageBackground,
  KeyboardAvoidingView,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { authService } from '../../src/services/authService';
import { Input } from '../../src/components/Input';
import { Button } from '../../src/components/Button';
import { Colors, type ColorPalette, Spacing, FontSize, BorderRadius, Fonts } from '../../src/constants/theme';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { ALL_COUNTRIES } from '../../src/constants/countries';
import { showAlert } from '../../src/stores/alertStore';
import { CustomAlert } from '../../src/components/CustomAlert';
import { useTheme } from '../../src/components/ThemeProvider';
import { useTranslation } from 'react-i18next';

export default function ProfileScreen() {
  const router = useRouter();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { user, setUser } = useAuthStore();
  const { t } = useTranslation();

  const isReadonly = user?.validate === 1;

  const [loading, setLoading] = useState(false);
  const [form, setFormState] = useState({
    name: user?.name || '',
    surname: user?.surname || '',
    phone: user?.phone || '',
    city: user?.city || '',
    address: user?.address || '',
    telegram: user?.telegram || '',
  });

  const setField = (key: string, value: string) =>
    setFormState((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setLoading(true);
    try {
      const updated = await authService.updateProfile(isReadonly ? { telegram: form.telegram } : form);
      setUser(updated);
      showAlert(t('common.success'), t('account.profileUpdated'));
    } catch (error: any) {
      showAlert(t('common.error'), error?.response?.data?.message || t('account.profileUpdateError'));
    } finally {
      setLoading(false);
    }
  };

  const countryName = ALL_COUNTRIES.find((c) => c.code === user?.country)?.name || user?.country || '';

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={isDark ? require('../../assets/bg_page.jpg') : require('../../assets/bg_page_light.jpg')}
        style={styles.background}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          >
            <ScrollView
              contentContainerStyle={styles.scroll}
              keyboardShouldPersistTaps="handled"
            >
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()}>
                  <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>{t('account.personalInfo')}</Text>
              </View>

              {isReadonly && (
                <View style={styles.verifiedBadge}>
                  <FontAwesome6 name="circle-check" size={16} color={Colors.success} />
                  <Text style={styles.verifiedText}>{t('account.verified')}</Text>
                </View>
              )}

              {/* Demande de modification */}
              <TouchableOpacity
                style={styles.modifRow}
                onPress={() => {
                  const subject = encodeURIComponent('Demande de modification de profil');
                  const body = encodeURIComponent(
                    `Bonjour,\n\nJe souhaite modifier les informations de mon compte (${user?.email}).\n\nChamp à modifier : \nNouvelle valeur : \n\nMerci.`
                  );
                  Linking.openURL(`mailto:support@goespay.io?subject=${subject}&body=${body}`);
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <FontAwesome6 name="pen-to-square" size={14} color={Colors.white} />
                  <Text style={[styles.accordionTitle, { color: Colors.white }]}>{t('account.requestModification')}</Text>
                </View>
                <FontAwesome6 name="envelope" size={14} color={Colors.white} />
              </TouchableOpacity>

              <View style={styles.formCard}>
                <Input
                  label={t('account.firstName')}
                  value={form.name}
                  onChangeText={(v) => setField('name', v)}
                  editable={!isReadonly}
                />
                <Input
                  label={t('account.lastName')}
                  value={form.surname}
                  onChangeText={(v) => setField('surname', v)}
                  editable={!isReadonly}
                />
                <Input
                  label={t('account.phone')}
                  value={form.phone}
                  onChangeText={(v) => setField('phone', v)}
                  editable={!isReadonly}
                  keyboardType="phone-pad"
                />
                <Input
                  label={t('account.country')}
                  value={countryName}
                  editable={false}
                />
                <Input
                  label={t('account.city')}
                  value={form.city}
                  onChangeText={(v) => setField('city', v)}
                  editable={!isReadonly}
                />
                <Input
                  label={t('account.walletAddress')}
                  value={form.address}
                  onChangeText={(v) => setField('address', v)}
                  editable={!isReadonly}
                />
                {user?.idnumber ? (
                  <Input label={t('account.idNumber')} value={user.idnumber} editable={false} />
                ) : null}
                {user?.idexp ? (
                  <Input label={t('account.idExpiry')} value={user.idexp} editable={false} />
                ) : null}
                <Input
                  label={t('account.telegram')}
                  value={form.telegram}
                  onChangeText={(v) => setField('telegram', v)}
                  editable={true}
                  prefix="@"
                  rightAction={isReadonly ? { icon: 'floppy-disk', onPress: handleSave, loading } : undefined}
                />
                {!isReadonly && (
                  <Button
                    title={t('common.save')}
                    onPress={handleSave}
                    loading={loading}
                    style={{ marginTop: Spacing.sm }}
                  />
                )}
              </View>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
        <CustomAlert />
      </ImageBackground>
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  background: { flex: 1 },
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
  modifRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.secondary,
    borderRadius: 16,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
  },
  accordionTitle: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: Fonts.semiBold,
  },
  formCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
});
