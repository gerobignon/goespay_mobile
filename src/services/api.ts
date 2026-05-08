import axios from 'axios';
import { SafeStorage } from './storage';
import { API_BASE_URL } from '../constants/config';
import i18n from '../i18n';

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
    // Sur web : récupère le cookie .goespay.io posé par le backend pour l'admin
    let url = '/ping';
    if (typeof document !== 'undefined') {
      const m = document.cookie.match(/(?:^|;\s*)goespay_admin=([^;]+)/);
      if (m) {
        // m[1] est déjà URL-encodé par setcookie() côté PHP, on l'envoie tel quel
        url += `?admin_token=${m[1]}`;
      }
    }
    const res = await api.get(url, { timeout: 5000 });
    return {
      connected: true,
      offline: res.data?.offline === 1,
      backendAdmin: res.data?.backend_admin === 1,
    };
  } catch {
    return { connected: false, offline: false, backendAdmin: false };
  }
}
