import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ThemeMode = 'system' | 'light' | 'dark';

interface ThemeStore {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  loadSavedMode: () => Promise<void>;
}

const THEME_KEY = 'app_theme_mode';

export const useThemeStore = create<ThemeStore>((set) => ({
  mode: 'system',

  setMode: (mode) => {
    set({ mode });
    AsyncStorage.setItem(THEME_KEY, mode);
  },

  loadSavedMode: async () => {
    try {
      const saved = await AsyncStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark' || saved === 'system') {
        set({ mode: saved });
      }
    } catch {
      // ignore
    }
  },
}));
