import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { API_BASE_URL } from '../constants/config';

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
    const token = await SecureStore.getItemAsync('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => {
    if (__DEV__) {
      console.log(`[API] ${response.config.method?.toUpperCase()} ${response.config.url} →`, JSON.stringify(response.data).substring(0, 600));
    }
    return response;
  },
  async (error) => {
    if (__DEV__) {
      console.log(`[API ERROR] ${error.config?.method?.toUpperCase()} ${error.config?.url} → ${error.response?.status}`, JSON.stringify(error.response?.data).substring(0, 400));
    }
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('auth_token');
    }
    return Promise.reject(error);
  }
);

export default api;

export async function checkApiConnection(): Promise<boolean> {
  try {
    await api.get('/ping', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}
