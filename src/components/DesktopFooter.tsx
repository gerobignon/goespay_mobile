import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, ImageBackground } from 'react-native';
import { useRouter } from 'expo-router';
import { FontAwesome6 } from '@expo/vector-icons';
import { Colors, type ColorPalette, Spacing, FontSize, Fonts } from '../constants/theme';
import { useThemedStyles } from '../hooks/useThemedStyles';
import { useTheme } from './ThemeProvider';

const bgDark = require('../../assets/bg_page.jpg');
const bgLight = require('../../assets/bg_page_light.jpg');

const SOCIALS = [
  { icon: 'facebook', url: 'https://facebook.com/goespay', darkColor: '#1877F2', lightColor: '#1877F2' },
  { icon: 'instagram', url: 'https://instagram.com/goespay', darkColor: '#E4405F', lightColor: '#E4405F' },
  { icon: 'tiktok', url: 'https://tiktok.com/@goespay', darkColor: '#fff', lightColor: '#000' },
];

export function DesktopFooter() {
  const year = new Date().getFullYear();
  const styles = useThemedStyles(createStyles);

  return (
    <ImageBackground source={bgDark} style={styles.footer} imageStyle={styles.bgImage}>
      <View style={styles.inner}>
        <Text style={styles.copyright}>
          ©2024-{year} | GOES INDUSTRIES SARL | Tous droits réservés
        </Text>
        <View style={styles.socials}>
          {SOCIALS.map((s) => (
            <TouchableOpacity key={s.url} onPress={() => Linking.openURL(s.url)} activeOpacity={0.7}>
              <FontAwesome6 name={s.icon} size={16} color="rgba(255,255,255,0.55)" iconStyle="brands" />
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </ImageBackground>
  );
}

const createStyles = (Colors: ColorPalette) => StyleSheet.create({
  footer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.12)',
    paddingVertical: Spacing.md,
    overflow: 'hidden',
  },
  bgImage: {
    resizeMode: 'cover',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    maxWidth: 1200,
    width: '100%',
    alignSelf: 'center',
  },
  copyright: {
    fontSize: FontSize.xs,
    fontFamily: Fonts.regular,
    color: 'rgba(255,255,255,0.55)',
  },
  socials: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
});
