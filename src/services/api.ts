import axios from 'axios';
import { SafeStorage } from './storage';
import { API_BASE_URL } from '../constants/config';
import i18n from '../i18n';

/** Token admin posé en cookie .goespay.io par le backend October (web seulement). */
function readAdminCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)goespay_admin=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
}

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

api.interceptors.request.use(
  async (config) => {
    const token = await SafeStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['Accept-Language'] = i18n.language || 'fr';
    // Web : si un BackendUser October est connecté (cookie .goespay.io), on joint
    // son token admin pour bypasser la maintenance côté serveur (lecture & opérations).
    // En-tête et non paramètre d'URL : une query string finit dans les journaux
    // du serveur, l'historique du navigateur et l'en-tête Referer.
    const adminToken = readAdminCookie();
    if (adminToken) {
      config.headers['X-Admin-Token'] = adminToken;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const status = error.response?.status;
    const data = error.response?.data;
    if (status === 401 || (status === 403 && data?.account_suspended)) {
      // Dynamic import pour éviter une boucle circulaire api <-> authStore.
      try {
        const { useAuthStore } = await import('../stores/authStore');
        await useAuthStore.getState().logout();
      } catch {
        await SafeStorage.removeItem('auth_token');
      }
    }
    // KYC bloqué (expiré ou non actif) → flag pour l'UI
    const code = error.response?.data?.code;
    if (error.response?.status === 403 && (code === 'KYC_EXPIRED' || code === 'KYC_REQUIRED')) {
      error.kycBlocked = code;
    }
    return Promise.reject(error);
  }
);

export default api;

export interface ApiPingResult {
  connected: boolean;
  offline: boolean;
  backendAdmin: boolean;
}

export async function checkApiConnection(): Promise<ApiPingResult> {
  try {
    // Le cookie admin est joint par l'intercepteur, dans l'en-tête X-Admin-Token.
    const res = await api.get('/ping', { timeout: 5000 });
    return {
      connected: true,
      offline: res.data?.offline === 1,
      backendAdmin: res.data?.backend_admin === 1,
    };
  } catch {
    return { connected: false, offline: false, backendAdmin: false };
  }
}
