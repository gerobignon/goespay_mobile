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
  { icon: 'facebook', url: 'https://www.facebook.com/goespay', darkColor: '#1877F2', lightColor: '#1877F2' },
  { icon: 'instagram', url: 'https://instagram.com/goespaay', darkColor: '#E4405F', lightColor: '#E4405F' },
  { icon: 'x-twitter', url: 'https://twitter.com/goespaay', darkColor: '#fff', lightColor: '#000' },
  { icon: 'linkedin-in', url: 'https://linkedin.com/company/goespay', darkColor: '#0A66C2', lightColor: '#0A66C2' },
  { icon: 'youtube', url: 'https://youtube.com/channel/UCxooykyhvHYo_zAI1yckRsw', darkColor: '#FF0000', lightColor: '#FF0000' },
  { icon: 'telegram', url: 'https://t.me/goespaay', darkColor: '#26A5E4', lightColor: '#26A5E4' },
  { icon: 'whatsapp', url: 'https://wa.me/237659939340', darkColor: '#25D366', lightColor: '#25D366' },
  { icon: 'whatsapp', url: 'https://whatsapp.com/channel/0029Vb7k55BI7Be5dTCpti2v', darkColor: '#25D366', lightColor: '#25D366' },
];

export function DesktopFooter() {
  const year = new Date().getFullYear();
  const styles = useThemedStyles(createStyles);

  return (
    <ImageBackground source={bgDark} style={styles.footer} imageStyle={styles.bgImage}>
      <View style={styles.darken} pointerEvents="none" />
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
  darken: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,12,30,0.82)',
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
