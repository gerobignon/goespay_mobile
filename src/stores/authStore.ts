import { create } from 'zustand';
import { SafeStorage } from '../services/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../types';
import { authService } from '../services/authService';
import { clearPin, setLockMethod } from '../services/secureAuthService';
import { clearCredentials } from '../services/secureAuthService';
import { useCurrencyStore } from './currencyStore';

const REMEMBER_KEY = 'remember_me';
const CACHED_USER_KEY = 'cached_user';
const CACHED_BALANCE_KEY = 'cached_balance';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  rememberMe: boolean;

  login: (email: string, password: string, remember?: boolean) => Promise<void>;
  loginWithToken: (token: string, user: User, remember?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  loadToken: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  setUser: (user: User) => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  rememberMe: false,

  login: async (email, password, remember = false) => {
    const response = await authService.login({ email, password });
    await SafeStorage.setItem('auth_token', response.token!);
    await AsyncStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
    if (remember) {
      await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(response.user));
    }
    set({
      user: response.user,
      token: response.token,
      isAuthenticated: true,
      rememberMe: remember,
    });
    // Hydrate la devise depuis le profil + récupère les taux
    const cs = useCurrencyStore.getState();
    await cs.hydrateFromUser(response.user?.currency, response.user?.currency_source);
    cs.fetchRates();
  },

  loginWithToken: async (token, user, remember = false) => {
    await SafeStorage.setItem('auth_token', token);
    await AsyncStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
    if (remember) {
      await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
    }
    set({ user, token, isAuthenticated: true, rememberMe: remember });
    const cs = useCurrencyStore.getState();
    await cs.hydrateFromUser(user?.currency, user?.currency_source);
    cs.fetchRates();
  },

  logout: async () => {
    await SafeStorage.removeItem('auth_token');
    await AsyncStorage.multiRemove([REMEMBER_KEY, CACHED_USER_KEY, CACHED_BALANCE_KEY]);
    await clearPin();
    await setLockMethod(null);
    await clearCredentials();
    set({ user: null, token: null, isAuthenticated: false, rememberMe: false });
  },

  loadToken: async () => {
    try {
      const token = await SafeStorage.getItem('auth_token');
      const remember = (await AsyncStorage.getItem(REMEMBER_KEY)) === '1';

      // Hydrate la devise depuis le cache (rapide, avant fetch profil)
      await useCurrencyStore.getState().init();

      if (!token) {
        set({ isLoading: false });
        return;
      }

      // If remember me, load cached user immediately for instant display
      if (remember) {
        const cachedUser = await AsyncStorage.getItem(CACHED_USER_KEY);
        if (cachedUser) {
          const u: User = JSON.parse(cachedUser);
          set({ token, user: u, isAuthenticated: true, isLoading: false, rememberMe: true });
          await useCurrencyStore.getState().hydrateFromUser(u.currency, u.currency_source);
          useCurrencyStore.getState().fetchRates();
          // Refresh profile in background
          authService.getProfile().then((user) => {
            set({ user });
            AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
            useCurrencyStore.getState().hydrateFromUser(user.currency, user.currency_source);
          }).catch(() => {});
          return;
        }
      }

      // No cache or no remember: fetch profile from API
      const user = await authService.getProfile();
      if (remember) {
        await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
      }
      set({ token, user, isAuthenticated: true, isLoading: false, rememberMe: remember });
      await useCurrencyStore.getState().hydrateFromUser(user.currency, user.currency_source);
      useCurrencyStore.getState().fetchRates();
    } catch {
      // If not remembered, clear everything
      const remember = (await AsyncStorage.getItem(REMEMBER_KEY)) === '1';
      if (!remember) {
        await SafeStorage.removeItem('auth_token');
        set({ token: null, user: null, isAuthenticated: false, isLoading: false });
      } else {
        // Remembered but offline: try cached data
        const cachedUser = await AsyncStorage.getItem(CACHED_USER_KEY);
        const token = await SafeStorage.getItem('auth_token');
        if (cachedUser && token) {
          set({ token, user: JSON.parse(cachedUser), isAuthenticated: true, isLoading: false, rememberMe: true });
        } else {
          await SafeStorage.removeItem('auth_token');
          set({ token: null, user: null, isAuthenticated: false, isLoading: false });
        }
      }
    }
  },

  refreshProfile: async () => {
    try {
      const user = await authService.getProfile();
      set({ user });
      const remember = (await AsyncStorage.getItem(REMEMBER_KEY)) === '1';
      if (remember) {
        await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
      }
      await useCurrencyStore.getState().hydrateFromUser(user.currency, user.currency_source);
    } catch {
      // silently fail
    }
  },

  setUser: (user) => set({ user }),
}));
