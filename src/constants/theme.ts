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
  // confirmAction: solid green used for primary "safe" actions (invoice/download buttons)
  confirmAction: '#198754',
  // positive: bright mint accent for incoming/"+" badges and copy confirmation
  positive: '#3ecf8e',
  border: 'rgba(255,255,255,0.15)',
  white: '#ffffff',
  black: '#000000',
};

export const LightColors: ColorPalette = {
  primary: '#3176FE',
  // Même doré que le thème sombre : l'accent de la marque ne change pas de
  // teinte d'un thème à l'autre.
  secondary: '#F4B228',
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
  confirmAction: '#198754',
  positive: '#1a9d6a',
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

// Standard sizes for circular icon containers / avatars used across rows & menus
export const IconSize = {
  sm: 24,
  md: 32,
  lg: 36,
  xl: 48,
  xxl: 64,
};

// Max width for centered modals / form cards on wide (desktop web) layouts
export const MODAL_MAX_WIDTH = 420;

/**
 * Returns `color` with the given alpha (0..1) as an rgba() string.
 * Accepts hex (#RGB / #RRGGBB) or existing rgb()/rgba() colors.
 * Replaces the scattered `color + '11'` / `color + '26'` opacity hacks.
 */
export function withAlpha(color: string, alpha: number): string {
  if (color.startsWith('#')) {
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((c) => c + c).join('');
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (match) {
    const [r, g, b] = match[1].split(',').map((p) => p.trim());
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return color;
}
