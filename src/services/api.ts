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
  backendAdmin: boolean;
}

export async function checkApiConnection(): Promise<ApiPingResult> {
  try {
    // withCredentials sur web pour transmettre le cookie de session BackendUser (October CMS)
    const res = await api.get('/ping', { timeout: 5000, withCredentials: true });
    return {
      connected: true,
      offline: res.data?.offline === 1,
      backendAdmin: res.data?.backend_admin === 1,
    };
  } catch {
    return { connected: false, offline: false, backendAdmin: false };
  }
}
