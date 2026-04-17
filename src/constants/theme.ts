import { Platform } from 'react-native';

export type ColorPalette = typeof DarkColors;

export const DarkColors = {
  primary: '#3176FE',
  secondary: '#F4B228',
  info: '#104fcc',
  light: '#d8e3f7',
  background: '#171e2b',
  surface: 'rgba(255,255,255,0.06)',
  surfaceBorder: 'rgba(255,255,255,0.1)',
  card: 'rgba(30,40,60,1)',
  cardSolid: '#1e283c',
  text: '#ffffff',
  textMuted: 'rgba(255,255,255,0.75)',
  textSecondary: 'rgba(255,255,255,0.8)',
  inputBg: 'rgba(255,255,255,0.1)',
  success: '#619261',
  error: '#ff295b',
  warning: '#ffee38',
  pending: '#F4B228',
  border: 'rgba(255,255,255,0.15)',
  white: '#ffffff',
  black: '#000000',
};

export const LightColors: ColorPalette = {
  primary: '#3176FE',
  secondary: '#3176FE',
  info: '#104fcc',
  light: '#d8e3f7',
  background: '#f0f2f5',
  surface: '#f5f5f5',
  surfaceBorder: 'rgba(0,0,0,0.08)',
  card: '#ffffff',
  cardSolid: '#ffffff',
  text: '#1a1a2e',
  textMuted: 'rgba(0,0,0,0.55)',
  textSecondary: 'rgba(0,0,0,0.65)',
  inputBg: 'transparent',
  success: '#619261',
  error: '#ff295b',
  warning: '#b45309',
  pending: '#F4B228',
  border: 'rgba(0,0,0,0.1)',
  white: '#ffffff',
  black: '#000000',
};

// Mutable object that ThemeProvider keeps in sync with the active palette
export const Colors: ColorPalette = { ...DarkColors };

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const BorderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 50,
};

const webBump = Platform.OS === 'web' ? 2 : 0;

export const FontSize = {
  xs: 10 + webBump,
  sm: 12 + webBump,
  md: 14 + webBump,
  lg: 16 + webBump,
  xl: 20 + webBump,
  xxl: 28 + webBump,
  hero: 48 + webBump,
};

export const Fonts = {
  regular: 'Quicksand_400Regular',
  medium: 'Quicksand_500Medium',
  semiBold: 'Quicksand_600SemiBold',
  bold: 'Quicksand_700Bold',
};

export const Shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
};
