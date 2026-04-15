import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../types';
import { authService } from '../services/authService';
import { clearPin, setLockMethod } from '../services/secureAuthService';
import { clearCredentials } from '../services/secureAuthService';

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
    await SecureStore.setItemAsync('auth_token', response.token!);
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
  },

  loginWithToken: async (token, user, remember = false) => {
    await SecureStore.setItemAsync('auth_token', token);
    await AsyncStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
    if (remember) {
      await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
    }
    set({ user, token, isAuthenticated: true, rememberMe: remember });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('auth_token');
    await AsyncStorage.multiRemove([REMEMBER_KEY, CACHED_USER_KEY, CACHED_BALANCE_KEY]);
    await clearPin();
    await setLockMethod(null);
    await clearCredentials();
    set({ user: null, token: null, isAuthenticated: false, rememberMe: false });
  },

  loadToken: async () => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      const remember = (await AsyncStorage.getItem(REMEMBER_KEY)) === '1';

      if (!token) {
        set({ isLoading: false });
        return;
      }

      // If remember me, load cached user immediately for instant display
      if (remember) {
        const cachedUser = await AsyncStorage.getItem(CACHED_USER_KEY);
        if (cachedUser) {
          set({ token, user: JSON.parse(cachedUser), isAuthenticated: true, isLoading: false, rememberMe: true });
          // Refresh profile in background
          authService.getProfile().then((user) => {
            set({ user });
            AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(user));
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
    } catch {
      // If not remembered, clear everything
      const remember = (await AsyncStorage.getItem(REMEMBER_KEY)) === '1';
      if (!remember) {
        await SecureStore.deleteItemAsync('auth_token');
        set({ token: null, user: null, isAuthenticated: false, isLoading: false });
      } else {
        // Remembered but offline: try cached data
        const cachedUser = await AsyncStorage.getItem(CACHED_USER_KEY);
        const token = await SecureStore.getItemAsync('auth_token');
        if (cachedUser && token) {
          set({ token, user: JSON.parse(cachedUser), isAuthenticated: true, isLoading: false, rememberMe: true });
        } else {
          await SecureStore.deleteItemAsync('auth_token');
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
    } catch {
      // silently fail
    }
  },

  setUser: (user) => set({ user }),
}));
