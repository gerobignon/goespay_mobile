import React, { createContext, useContext, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { useThemeStore, type ThemeMode } from '../stores/themeStore';
import { DarkColors, LightColors, type ColorPalette } from '../constants/theme';
import { Colors as MutableColors } from '../constants/theme';

interface ThemeContextValue {
  colors: ColorPalette;
  isDark: boolean;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  colors: DarkColors,
  isDark: true,
  mode: 'system',
  setMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const { mode, setMode, loadSavedMode } = useThemeStore();

  useEffect(() => {
    loadSavedMode();
  }, []);

  const isDark =
    mode === 'dark' ? true : mode === 'light' ? false : systemScheme !== 'light';

  const colors = isDark ? DarkColors : LightColors;

  // Keep the mutable Colors export in sync for StyleSheet usage
  Object.assign(MutableColors, colors);

  return (
    <ThemeContext.Provider value={{ colors, isDark, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useColors(): ColorPalette {
  return useContext(ThemeContext).colors;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
