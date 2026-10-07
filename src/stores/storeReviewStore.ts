import { useEffect, useRef } from 'react';
import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Invitation à noter l'app sur les stores, après une opération réussie.
 *
 * Deux déclencheurs :
 *   - le client ferme le modal de l'opération sur l'écran de succès ;
 *   - il l'a fermé pendant l'attente du statut : on continue de vérifier en
 *     arrière-plan, et l'invitation s'ouvre quand le statut passe en succès.
 */

const KEY = 'store_review';
const DAY = 24 * 60 * 60 * 1000;
// Sans réaction, l'invitation revient au plus une fois par semaine ; « Plus tard » la repousse d'un mois.
const RESHOW_AFTER = 7 * DAY;
const SNOOZE = 30 * DAY;
// Suivi d'une opération fermée en attente : toutes les 15 s pendant 30 min.
const WATCH_EVERY = 15 * 1000;
const WATCH_FOR = 30 * 60 * 1000;
// Laisse le modal de l'opération finir de se fermer avant d'ouvrir l'invitation.
const OPEN_DELAY = 400;

type PromptState = { ratedAt?: number; shownAt?: number; snoozeUntil?: number };

export type ReviewStatus = 'success' | 'fail' | 'pending';
export type ReviewStatusCheck = () => Promise<ReviewStatus>;

async function readState(): Promise<PromptState> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeState(patch: PromptState): Promise<void> {
  try {
    const current = await readState();
    await AsyncStorage.setItem(KEY, JSON.stringify({ ...current, ...patch }));
  } catch {}
}

interface StoreReviewState {
  visible: boolean;
  request: () => Promise<void>;
  markRated: () => void;
  snooze: () => void;
  hide: () => void;
}

export const useStoreReviewStore = create<StoreReviewState>((set, get) => ({
  visible: false,

  request: async () => {
    if (get().visible) return;
    const s = await readState();
    const now = Date.now();
    if (s.ratedAt) return;
    if (s.snoozeUntil && now < s.snoozeUntil) return;
    // En dev, pas d'espacement d'une semaine : chaque test d'opération la rouvre.
    if (!__DEV__ && s.shownAt && now - s.shownAt < RESHOW_AFTER) return;
    await writeState({ shownAt: now });
    set({ visible: true });
  },

  markRated: () => {
    writeState({ ratedAt: Date.now() });
    set({ visible: false });
  },

  snooze: () => {
    writeState({ snoozeUntil: Date.now() + SNOOZE });
    set({ visible: false });
  },

  hide: () => set({ visible: false }),
}));

export function requestStoreReview(delay = OPEN_DELAY): void {
  setTimeout(() => { useStoreReviewStore.getState().request(); }, delay);
}

/** Suit en arrière-plan une opération fermée en attente ; invitation au passage en succès. */
export function watchForStoreReview(check: ReviewStatusCheck): void {
  const startedAt = Date.now();
  let timer: ReturnType<typeof setInterval> | null = null;
  let busy = false;
  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  const tick = async () => {
    if (busy) return;
    if (Date.now() - startedAt > WATCH_FOR) { stop(); return; }
    busy = true;
    try {
      const status = await check();
      if (status === 'success') { stop(); requestStoreReview(0); }
      else if (status === 'fail') stop();
    } catch {
      // Réseau : on retente au prochain passage.
    } finally {
      busy = false;
    }
  };
  timer = setInterval(tick, WATCH_EVERY);
}

type Outcome = { kind: 'success' } | { kind: 'pending'; check: ReviewStatusCheck } | null;

/**
 * À brancher dans un modal d'opération : il note l'issue (succès, ou attente
 * avec la vérification de statut à rejouer), et la fermeture du modal déclenche
 * l'invitation ou le suivi en arrière-plan.
 */
export function useStoreReviewOnClose(visible: boolean) {
  const outcome = useRef<Outcome>(null);
  const wasVisible = useRef(visible);

  useEffect(() => {
    if (wasVisible.current && !visible) {
      const o = outcome.current;
      outcome.current = null;
      if (o?.kind === 'success') requestStoreReview();
      else if (o?.kind === 'pending') watchForStoreReview(o.check);
    }
    wasVisible.current = visible;
  }, [visible]);

  return useRef({
    success: () => { outcome.current = { kind: 'success' }; },
    pending: (check: ReviewStatusCheck) => { outcome.current = { kind: 'pending', check }; },
    clear: () => { outcome.current = null; },
  }).current;
}
