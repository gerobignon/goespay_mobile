import { create } from 'zustand';
import { SafeStorage } from '../services/storage';

const KEY = 'messaging_lock';

/**
 * Verrou d'entrée de la messagerie — OPTIONNEL et désactivé par défaut.
 *
 * Demander le code à chaque ouverture de l'onglet gênait plus qu'il ne
 * protégeait : la messagerie est un onglet de l'app, pas un coffre. Qui veut la
 * protection l'arme depuis Réglages › Sécurité ou depuis les réglages des
 * messages ; le réglage est local à l'appareil, comme le verrou dont il dépend.
 */
interface MessagingLockState {
  enabled: boolean;
  isLoaded: boolean;
  load: () => Promise<void>;
  setEnabled: (value: boolean) => Promise<void>;
}

export const useMessagingLockStore = create<MessagingLockState>((set, get) => ({
  enabled: false,
  isLoaded: false,

  load: async () => {
    if (get().isLoaded) return;
    const raw = await SafeStorage.getItem(KEY).catch(() => null);
    set({ enabled: raw === '1', isLoaded: true });
  },

  setEnabled: async (value) => {
    set({ enabled: value, isLoaded: true });
    if (value) await SafeStorage.setItem(KEY, '1');
    else await SafeStorage.removeItem(KEY);
  },
}));
