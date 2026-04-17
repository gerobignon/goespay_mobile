import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES, setLanguage } from '../i18n';
import type { LanguageCode } from '../i18n';
import { Spacing, FontSize, type ColorPalette } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const styles = useThemedStyles(createStyles);

  return (
    <View style={styles.container}>
      {SUPPORTED_LANGUAGES.map((lang, i) => (
        <React.Fragment key={lang.code}>
          {i > 0 && <Text style={styles.separator}>|</Text>}
          <TouchableOpacity
            onPress={() => setLanguage(lang.code as LanguageCode)}
            style={styles.btn}
          >
            <Text
              style={[
                styles.label,
                i18n.language === lang.code && styles.active,
              ]}
            >
              {lang.flag} {lang.code.toUpperCase()}
            </Text>
          </TouchableOpacity>
        </React.Fragment>
      ))}
    </View>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  btn: { paddingHorizontal: Spacing.sm, paddingVertical: 4 },
  label: { fontSize: FontSize.md, color: Colors.textMuted },
  active: { color: Colors.primary, fontWeight: '700' },
  separator: { color: Colors.border, fontSize: FontSize.md, marginHorizontal: Spacing.xs },
});
