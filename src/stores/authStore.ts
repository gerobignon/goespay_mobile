import { create } from 'zustand';
import { SafeStorage } from '../services/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../types';
import { authService } from '../services/authService';
import { setLockMethod } from '../services/secureAuthService';
import { clearCredentials } from '../services/secureAuthService';
import { useCurrencyStore } from './currencyStore';
import { usePinStore } from './pinStore';

const REMEMBER_KEY = 'remember_me';
const CACHED_USER_KEY = 'cached_user';
const CACHED_BALANCE_KEY = 'cached_balance';

/**
 * Champs du profil que l'on accepte de garder en cache local.
 *
 * Le cache sert l'affichage hors ligne et l'ouverture instantanée : il n'a
 * besoin que de l'identité d'affichage et des drapeaux qui pilotent l'UI. Tout
 * ce qui relève de l'identité civile (telephone, adresse, numero de piece, date
 * de naissance, BVN, pieces KYC) reste sur le serveur et n'est relu que par un
 * GET /me authentifie. AsyncStorage n'est pas chiffre sur web (localStorage) et
 * survit a la desinstallation sur certains Android.
 */
const CACHEABLE_USER_FIELDS = [
  'id',
  'name',
  'surname',
  'email',
  'country',
  'currency',
  'currency_source',
  'avatar',
  'balance',
  'validate',
  'group',
  'referral_code',
  'created_at',
  'messaging_enabled',
  'login_method',
  'has_password',
  'idexp_expired',
  'idexp_days_left',
  'idexp_warning',
] as const;

/** Projection sans donnee d'identite, seule forme autorisee dans AsyncStorage. */
function cacheableUser(user: User): Partial<User> {
  const out: Record<string, unknown> = {};
  for (const key of CACHEABLE_USER_FIELDS) {
    const value = (user as unknown as Record<string, unknown>)[key];
    if (value !== undefined) out[key] = value;
  }
  return out as Partial<User>;
}

/** Ecrit le profil en cache, ampute des champs d'identite. */
async function cacheUser(user: User) {
  await AsyncStorage.setItem(CACHED_USER_KEY, JSON.stringify(cacheableUser(user)));
}

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  rememberMe: boolean;
  /**
   * `user` vient-il d'une reponse du serveur (profil complet) ou du cache local
   * (ampute des champs d'identite) ? Les ecrans qui affichent ou preremplissent
   * une donnee d'identite attendent `true`, sinon ils appellent `refreshProfile`.
   */
  profileComplete: boolean;

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
  profileComplete: false,

  login: async (email, password, remember = false) => {
    const response = await authService.login({ email, password });
    await SafeStorage.setItem('auth_token', response.token!);
    await AsyncStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');
    if (remember) {
      if (response.user) await cacheUser(response.user);
    }
    set({
      user: response.user,
      token: response.token,
      isAuthenticated: true,
      rememberMe: remember,
      profileComplete: true,
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
      await cacheUser(user);
    }
    set({ user, token, isAuthenticated: true, rememberMe: remember, profileComplete: true });
    const cs = useCurrencyStore.getState();
    await cs.hydrateFromUser(user?.currency, user?.currency_source);
    cs.fetchRates();
  },

  logout: async () => {
    await SafeStorage.removeItem('auth_token');
    await AsyncStorage.multiRemove([REMEMBER_KEY, CACHED_USER_KEY, CACHED_BALANCE_KEY]);
    // Passer par l'ACTION du store, pas seulement par le service : elle efface
    // le PIN, la clé WebAuthn ET remet l'état en mémoire à zéro. Sur natif le
    // process redémarre et masque l'oubli ; sur web l'onglet survit, et un
    // `isSetupDone` périmé renverrait vers l'écran de déverrouillage après une
    // reconnexion alors que plus aucun secret n'existe pour en sortir.
    await usePinStore.getState().clearPin();
    await setLockMethod(null);
    await clearCredentials();
    set({ user: null, token: null, isAuthenticated: false, rememberMe: false, profileComplete: false });
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
          // Cache = projection sans identite : `profileComplete` reste faux
          // jusqu'au retour du GET /me ci-dessous.
          const u = JSON.parse(cachedUser) as User;
          set({ token, user: u, isAuthenticated: true, isLoading: false, rememberMe: true, profileComplete: false });
          await useCurrencyStore.getState().hydrateFromUser(u.currency, u.currency_source);
          useCurrencyStore.getState().fetchRates();
          // Refresh profile in background
          authService.getProfile().then((user) => {
            set({ user, profileComplete: true });
            cacheUser(user);
            useCurrencyStore.getState().hydrateFromUser(user.currency, user.currency_source);
          }).catch(() => {});
          return;
        }
      }

      // No cache or no remember: fetch profile from API
      const user = await authService.getProfile();
      if (remember) {
        await cacheUser(user);
      }
      set({ token, user, isAuthenticated: true, isLoading: false, rememberMe: remember, profileComplete: true });
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
          set({ token, user: JSON.parse(cachedUser) as User, isAuthenticated: true, isLoading: false, rememberMe: true, profileComplete: false });
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
      set({ user, profileComplete: true });
      const remember = (await AsyncStorage.getItem(REMEMBER_KEY)) === '1';
      if (remember) {
        await cacheUser(user);
      }
      await useCurrencyStore.getState().hydrateFromUser(user.currency, user.currency_source);
    } catch {
      // silently fail
    }
  },

  setUser: (user) => set({ user, profileComplete: true }),
}));
