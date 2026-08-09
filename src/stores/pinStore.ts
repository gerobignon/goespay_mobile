import { create } from 'zustand';
import { Platform } from 'react-native';
import {
  getLockMethod,
  setLockMethod,
  isPinSet,
  clearPin as clearPinSecure,
  type LockMethod,
} from '../services/secureAuthService';
import { isWebauthnSet, clearWebauthn } from '../services/webauthnService';

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
  clearPin: () => Promise<void>;
}

const isWeb = Platform.OS === 'web';

/**
 * Le verrou n'est réputé configuré que si le secret correspondant existe
 * VRAIMENT : un `pin_method` orphelin (PIN effacé, clé WebAuthn révoquée depuis
 * les réglages du navigateur…) verrouillerait sinon l'app sans issue.
 * `biometric` est natif-only, `webauthn` web-only.
 */
async function resolveSetupDone(method: LockMethod): Promise<boolean> {
  if (method === null) return false;
  if (method === 'biometric') return !isWeb;
  if (method === 'webauthn') return isWeb && (await isWebauthnSet());
  return isPinSet();
}

export const usePinStore = create<PinState>((set, get) => ({
  lockMethod: null,
  isLocked: false,
  isSetupDone: false,
  isInitialized: false,

  initialize: async () => {
    const method = await getLockMethod();
    const isSetupDone = await resolveSetupDone(method);
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
    set({ lockMethod: method, isSetupDone: await resolveSetupDone(method) });
  },

  // Désarme le verrou quelle que soit la méthode (PIN oublié, déconnexion).
  clearPin: async () => {
    await clearPinSecure();
    await clearWebauthn();
    set({ lockMethod: null, isSetupDone: false, isLocked: false });
  },
}));
