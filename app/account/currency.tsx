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
import { useTranslation } from 'react-i18next';
import { CustomAlert } from '../../src/components/CustomAlert';
import { useResponsive } from '../../src/hooks/useResponsive';
import { useCurrencyStore, SUPPORTED_CURRENCIES } from '../../src/stores/currencyStore';
import { useAuthStore } from '../../src/stores/authStore';
import { authService } from '../../src/services/authService';
import { showAlert } from '../../src/stores/alertStore';

export default function CurrencyScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const styles = useThemedStyles(createStyles);
  const { isDark } = useTheme();
  const { t } = useTranslation();
  const userCurrency = useCurrencyStore((s) => s.userCurrency);
  const currencySource = useCurrencyStore((s) => s.currencySource);
  const setUserCurrencyLocal = useCurrencyStore((s) => s.setUserCurrency);
  const fetchRates = useCurrencyStore((s) => s.fetchRates);
  const setUser = useAuthStore((s) => s.setUser);
  const user = useAuthStore((s) => s.user);
  const [savingCurrency, setSavingCurrency] = React.useState<string | null>(null);

  const changeCurrency = async (code: string) => {
    if (code === userCurrency || savingCurrency) return;
    setSavingCurrency(code);
    try {
      await setUserCurrencyLocal(code, 'manual');
      const updated = await authService.updateProfile({ currency: code } as any);
      if (updated) setUser(updated);
      fetchRates();
      showAlert(t('common.success'), t('account.currencyChanged'));
    } catch (e: any) {
      await setUserCurrencyLocal(user?.currency || 'XOF', user?.currency_source || 'auto');
      showAlert(t('common.error'), t('account.currencyError'));
    } finally {
      setSavingCurrency(null);
    }
  };

  const content = (
    <>
      {!isDesktop && (
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <FontAwesome6 name="arrow-left" size={20} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.title}>{t('account.currency')}</Text>
        </View>
      )}
      {isDesktop && <Text style={styles.title}>{t('account.currency')}</Text>}

      <View style={styles.formCard}>
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
