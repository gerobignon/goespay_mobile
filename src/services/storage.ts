/**
 * Storage abstraction layer: uses localStorage on web, expo-secure-store on mobile
 */
import { Platform } from 'react-native';

let storage: {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
};

// Detect if running on web or mobile
if (Platform.OS === 'web') {
  // WEB - use localStorage
  storage = {
    getItem: (key: string) => Promise.resolve(typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null),
    setItem: (key: string, value: string) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(key, value);
      }
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(key);
      }
      return Promise.resolve();
    },
  };
} else {
  // MOBILE - use expo-secure-store
  let SecureStore: any;
  try {
    SecureStore = require('expo-secure-store');
  } catch (e) {
    console.warn('[SafeStorage] expo-secure-store not available');
  }

  storage = {
    getItem: (key: string) => {
      if (SecureStore?.getItemAsync) {
        return SecureStore.getItemAsync(key);
      }
      return Promise.resolve(null);
    },
    setItem: (key: string, value: string) => {
      if (SecureStore?.setItemAsync) {
        return SecureStore.setItemAsync(key, value);
      }
      return Promise.resolve();
    },
    removeItem: (key: string) => {
      if (SecureStore?.deleteItemAsync) {
        return SecureStore.deleteItemAsync(key);
      }
      return Promise.resolve();
    },
  };
}

export const SafeStorage = storage;
