import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ImageBackground,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts } from '../../src/constants/theme';
import { useThemedStyles } from '../../src/hooks/useThemedStyles';
import { useTheme } from '../../src/components/ThemeProvider';
import type { ThemeMode } from '../../src/stores/themeStore';
import { useTranslation } from 'react-i18next';
import i18n from '../../src/i18n';
import { SUPPORTED_LANGUAGES, setLanguage } from '../../src/i18n';
import { CustomAlert } from '../../src/components/CustomAlert';
import { useResponsive } from '../../src/hooks/useResponsive';
import { useCurrencyStore, SUPPORTED_CURRENCIES } from '../../src/stores/currencyStore';
import { useAuthStore } from '../../src/stores/authStore';
import { authService } from '../../src/services/authService';
import { showAlert } from '../../src/stores/alertStore';

export default function SettingsScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const styles = useThemedStyles(createStyles);
  const { mode: themeMode, setMode: setThemeMode, isDark } = useTheme();
  const { t } = useTranslation();
  const userCurrency = useCurrencyStore((s) => s.userCurrency);
  const currencySource = useCurrencyStore((s) => s.currencySource);
  const setUserCurrencyLocal = useCurrencyStore((s) => s.setUserCurrency);
  const fetchRates = useCurrencyStore((s) => s.fetchRates);
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);
  const [savingCurrency, setSavingCurrency] = React.useState<string | null>(null);

  const changeLanguage = async (code: string) => {
    await setLanguage(code as any);
  };

  const changeCurrency = async (code: string) => {
    if (code === userCurrency || savingCurrency) return;
    setSavingCurrency(code);
    try {
      // Optimistic local update for instant feedback
      await setUserCurrencyLocal(code, 'manual');
      // Persist on backend
      const updated = await authService.updateProfile({ currency: code } as any);
      if (updated) setUser(updated);
      // Refresh rates if needed
      fetchRates();
      showAlert(t('common.success'), t('account.currencyChanged'));
    } catch (e: any) {
      // Rollback on error
      await setUserCurrencyLocal(user?.currency || 'XOF', user?.currency_source || 'auto');
      showAlert(t('common.error'), t('account.currencyError'));
    } finally {
      setSavingCurrency(null);
    }
  };

  const themeOptions: { key: ThemeMode; label: string; desc: string; icon: string }[] = [
    { key: 'system', label: t('account.themeSystem'), desc: t('account.themeSystemDesc', 'Suit le thème du système'), icon: 'mobile-screen' },
    { key: 'light', label: t('account.themeLight'), desc: t('account.themeLightDesc', 'Thème clair'), icon: 'sun' },
    { key: 'dark', label: t('account.themeDark'), desc: t('account.themeDarkDesc', 'Thème sombre'), icon: 'moon' },
  ];

  const content = (
    <>
      {!isDesktop && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('account.customization')}</Text>
        </View>
      )}
      {isDesktop && <Text style={styles.title}>{t('account.customization')}</Text>}

      {/* Thème */}
      <View style={styles.formCard}>
        <Text style={styles.sectionTitle}>
          <FontAwesome6 name="palette" size={14} color={Colors.secondary} /> {t('account.theme')}
        </Text>
        {themeOptions.map((opt) => (
          <TouchableOpacity
            key={opt.key}
            style={styles.securityRow}
            onPress={() => setThemeMode(opt.key)}
          >
            <View style={styles.securityIcon}>
              <FontAwesome6 name={opt.icon} size={16} color={themeMode === opt.key ? Colors.primary : Colors.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.securityLabel}>{opt.label}</Text>
              <Text style={styles.securityDesc}>{opt.desc}</Text>
            </View>
            {themeMode === opt.key && (
              <FontAwesome6 name="circle-check" size={16} color={Colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>

      {/* Devise */}
      <View style={[styles.formCard, { marginTop: Spacing.lg }]}>
        <Text style={styles.sectionTitle}>
          <FontAwesome6 name="coins" size={14} color={Colors.secondary} /> {t('account.currency')}
        </Text>
        <Text style={styles.sectionDesc}>{t('account.currencyDesc')}</Text>
        {SUPPORTED_CURRENCIES.map((code) => {
          const isActive = userCurrency === code;
          const isSaving = savingCurrency === code;
          return (
            <TouchableOpacity
              key={code}
              style={styles.securityRow}
              onPress={() => changeCurrency(code)}
              disabled={!!savingCurrency}
            >
              <View style={styles.securityIcon}>
                <Text style={{ fontFamily: Fonts.bold, fontSize: FontSize.xs, color: isActive ? Colors.primary : Colors.textMuted }}>
                  {code}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.securityLabel}>{code}</Text>
                {isActive && (
                  <Text style={styles.securityDesc}>
                    {currencySource === 'manual' ? t('account.currencyManualTag') : t('account.currencyAutoTag')}
                  </Text>
                )}
              </View>
              {isSaving ? (
                <FontAwesome6 name="spinner" size={16} color={Colors.textMuted} />
              ) : isActive ? (
                <FontAwesome6 name="circle-check" size={16} color={Colors.primary} />
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Langue */}
      <View style={[styles.formCard, { marginTop: Spacing.lg }]}>
        <Text style={styles.sectionTitle}>
          <FontAwesome6 name="language" size={14} color={Colors.secondary} /> {t('account.language')}
        </Text>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <TouchableOpacity
            key={lang.code}
            style={styles.securityRow}
            onPress={() => changeLanguage(lang.code)}
          >
            <Text style={{ fontSize: FontSize.lg, marginRight: Spacing.sm }}>{lang.flag}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.securityLabel}>{lang.label}</Text>
            </View>
            {i18n.language === lang.code && (
              <FontAwesome6 name="circle-check" size={16} color={Colors.primary} />
            )}
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  if (isDesktop) {
    return (
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: 0 }]}>
        {content}
        <CustomAlert />
      </ScrollView>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ImageBackground
        source={isDark ? require('../../assets/bg_page.jpg') : require('../../assets/bg_page_light.jpg')}
        style={styles.background}
      >
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
          <ScrollView contentContainerStyle={styles.scroll}>
            {content}
          </ScrollView>
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
  formCard: {
    backgroundColor: Colors.card,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    fontFamily: Fonts.semiBold,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionDesc: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    marginTop: -Spacing.sm,
    marginBottom: Spacing.md,
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
});
