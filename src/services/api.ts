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

if (__DEV__) {
  console.log('[API] Base URL:', API_BASE_URL);
}

api.interceptors.request.use(
  async (config) => {
    const token = await SafeStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    config.headers['Accept-Language'] = i18n.language || 'fr';
    if (__DEV__) {
      console.log(`[API →] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      try { console.log(`[API ✓] ${response.config.method?.toUpperCase()} ${response.config.url} → ${response.status}`, String(JSON.stringify(response.data)).substring(0, 600)); } catch {}
    }
    return response;
  },
  async (error) => {
    if (__DEV__) {
      const isNetwork = !error.response;
      try {
        console.log(
          `[API ✗] ${error.config?.method?.toUpperCase()} ${error.config?.baseURL}${error.config?.url} → ${isNetwork ? 'NETWORK ERROR' : error.response?.status}`,
          isNetwork ? error.message : String(JSON.stringify(error.response?.data)).substring(0, 400),
        );
      } catch {}
    }
    if (error.response?.status === 401) {
      await SafeStorage.removeItem('auth_token');
    }
    return Promise.reject(error);
  }
);

export default api;

export interface ApiPingResult {
  connected: boolean;
  offline: boolean;
}

export async function checkApiConnection(): Promise<ApiPingResult> {
  try {
    const res = await api.get('/ping', { timeout: 5000 });
    return { connected: true, offline: res.data?.offline === 1 };
  } catch {
    return { connected: false, offline: false };
  }
}
