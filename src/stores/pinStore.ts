import { create } from 'zustand';
import {
  getLockMethod,
  setLockMethod,
  isPinSet,
  type LockMethod,
} from '../services/secureAuthService';

interface PinState {
  // État courant
  lockMethod: LockMethod;
  isLocked: boolean;       // app verrouillée, doit passer par unlock
  isSetupDone: boolean;    // PIN/bio déjà configuré
  isInitialized: boolean;

  // Actions
  initialize: () => Promise<void>;
  lock: () => void;
  unlock: () => void;
  setMethod: (method: LockMethod) => Promise<void>;
}

export const usePinStore = create<PinState>((set, get) => ({
  lockMethod: null,
  isLocked: false,
  isSetupDone: false,
  isInitialized: false,

  initialize: async () => {
    const method = await getLockMethod();
    const pinSet = await isPinSet();
    // Setup fait si méthode définie ET (pin configuré OU biométrie)
    const isSetupDone = method !== null && (method === 'biometric' || pinSet);
    set({
      lockMethod: method,
      isSetupDone,
      isLocked: isSetupDone, // verrouillé au démarrage si configuré
      isInitialized: true,
    });
  },

  lock: () => set({ isLocked: true }),

  unlock: () => set({ isLocked: false }),

  setMethod: async (method) => {
    await setLockMethod(method);
    const pinSet = await isPinSet();
    const isSetupDone = method !== null && (method === 'biometric' || pinSet);
    set({ lockMethod: method, isSetupDone });
  },
}));
