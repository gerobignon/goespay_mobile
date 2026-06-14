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
import SettingsRow from '../../src/components/SettingsRow';
import { useResponsive } from '../../src/hooks/useResponsive';

export default function SettingsScreen() {
  const router = useRouter();
  const { isDesktop } = useResponsive();
  const styles = useThemedStyles(createStyles);
  const { mode: themeMode, setMode: setThemeMode, isDark } = useTheme();
  const { t } = useTranslation();

  const changeLanguage = async (code: string) => {
    await setLanguage(code as any);
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
          <SettingsRow
            key={opt.key}
            icon={opt.icon}
            iconColor={themeMode === opt.key ? Colors.primary : Colors.textMuted}
            label={opt.label}
            description={opt.desc}
            onPress={() => setThemeMode(opt.key)}
            trailing={themeMode === opt.key ? (
              <FontAwesome6 name="circle-check" size={16} color={Colors.primary} />
            ) : undefined}
          />
        ))}
      </View>

      {/* Langue */}
      <View style={[styles.formCard, { marginTop: Spacing.lg }]}>
        <Text style={styles.sectionTitle}>
          <FontAwesome6 name="language" size={14} color={Colors.secondary} /> {t('account.language')}
        </Text>
        {SUPPORTED_LANGUAGES.map((lang) => (
          <SettingsRow
            key={lang.code}
            leadingInCircle={<Text style={{ fontSize: FontSize.md }}>{lang.flag}</Text>}
            label={lang.label}
            onPress={() => changeLanguage(lang.code)}
            trailing={i18n.language === lang.code ? (
              <FontAwesome6 name="circle-check" size={16} color={Colors.primary} />
            ) : undefined}
          />
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
});
