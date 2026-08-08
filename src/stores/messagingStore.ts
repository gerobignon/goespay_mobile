import { create } from 'zustand';
import { AppState } from 'react-native';
import { messagingService } from '../services/messagingService';
import type { ChatMessage, ChatPrefs, ChatReplyPreview, Conversation } from '../types';

/**
 * État de la messagerie in-app.
 *
 * Le temps réel est un sondage à deux vitesses : le fil ouvert interroge le
 * serveur toutes les quelques secondes en ne demandant que le delta, le reste
 * de l'app se contente du compteur de non-lus une fois par minute. Les push
 * couvrent l'app fermée ; le sondage couvre l'app ouverte. Aucun des deux ne
 * suffit seul, les deux ensemble ne demandent rien de plus au serveur qu'une
 * requête indexée.
 *
 * Les minuteries vivent hors du state : les remettre dans le store
 * déclencherait un rendu à chaque battement.
 */

const THREAD_POLL_MS = 4000;
const INBOX_POLL_MS = 60000;
/** Le serveur considère la frappe active 8 s : on renvoie le signal plus souvent. */
const TYPING_THROTTLE_MS = 4000;

let threadTimer: ReturnType<typeof setInterval> | null = null;
let inboxTimer: ReturnType<typeof setInterval> | null = null;
let lastTypingSent = 0;
/** Id local décroissant des messages en cours d'envoi (jamais confondu avec un id serveur). */
let tempSeq = -1;

const isActive = () => AppState.currentState === 'active';

/** Fusionne des messages entrants dans une liste, sans doublon, triés par id. */
function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] {
  if (incoming.length === 0) return current;
  const byId = new Map<number, ChatMessage>();
  for (const m of current) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, m);
  return Array.from(byId.values()).sort((a, b) => a.id - b.id);
}

/** Dernier id serveur connu d'un fil (ignore les envois optimistes, d'id négatif). */
function lastServerId(messages: ChatMessage[]): number {
  let max = 0;
  for (const m of messages) {
    if (m.id > max) max = m.id;
  }
  return max;
}

interface MessagingState {
  conversations: Conversation[];
  unreadTotal: number;
  prefs: ChatPrefs;

  /** Messages par conversation. */
  threads: Record<number, ChatMessage[]>;
  hasMore: Record<number, boolean>;
  activeId: number | null;

  isLoading: boolean;
  isLoadingThread: boolean;
  isSending: boolean;
  error: string | null;

  fetchConversations: (silent?: boolean) => Promise<void>;
  fetchUnread: () => Promise<void>;
  openSupport: () => Promise<number | null>;
  openDirect: (userId: number) => Promise<number>;

  loadThread: (id: number, silent?: boolean) => Promise<void>;
  loadOlder: (id: number) => Promise<void>;
  pollThread: (id: number) => Promise<void>;
  send: (
    id: number,
    body: string,
    imageUri?: string | null,
    replyTo?: ChatReplyPreview | null,
    attachment?: { type: string; ref: string } | null,
  ) => Promise<void>;
  retry: (id: number, tempId: number) => Promise<void>;
  markRead: (id: number) => Promise<void>;
  notifyTyping: (id: number) => void;
  setMuted: (id: number, muted: boolean) => Promise<void>;
  archiveConversation: (id: number) => Promise<void>;
  savePrefs: (prefs: Partial<ChatPrefs>) => Promise<void>;
  clearError: () => void;

  startThreadPolling: (id: number) => void;
  stopThreadPolling: () => void;
  startInboxPolling: () => void;
  stopInboxPolling: () => void;

  reset: () => void;
}

export const useMessagingStore = create<MessagingState>((set, get) => ({
  conversations: [],
  unreadTotal: 0,
  prefs: { discoverable: true, allow_unknown: true, show_presence: true },
  threads: {},
  hasMore: {},
  activeId: null,
  isLoading: false,
  isLoadingThread: false,
  isSending: false,
  error: null,

  fetchConversations: async (silent = false) => {
    if (!silent) set({ isLoading: true, error: null });
    try {
      const data = await messagingService.getConversations();
      set({
        conversations: data.conversations ?? [],
        unreadTotal: data.unread_total ?? 0,
        prefs: data.prefs ?? get().prefs,
        isLoading: false,
        error: null,
      });
    } catch (e: any) {
      set({
        isLoading: false,
        error: silent ? get().error : e?.response?.data?.error || 'Chargement impossible.',
      });
    }
  },

  fetchUnread: async () => {
    try {
      set({ unreadTotal: await messagingService.getUnread() });
    } catch {
      // Silencieux : c'est un badge, pas une opération.
    }
  },

  openSupport: async () => {
    try {
      const conv = await messagingService.openSupport();
      set((s) => ({ conversations: upsertConversation(s.conversations, conv) }));
      return conv.id;
    } catch (e: any) {
      set({ error: e?.response?.data?.error || 'Ouverture impossible.' });
      return null;
    }
  },

  /** Laisse remonter l'erreur : l'appelant doit pouvoir afficher le refus (blocage, inconnus). */
  openDirect: async (userId) => {
    const conv = await messagingService.openDirect(userId);
    set((s) => ({ conversations: upsertConversation(s.conversations, conv) }));
    return conv.id;
  },

  loadThread: async (id, silent = false) => {
    if (!silent) set({ isLoadingThread: true, activeId: id, error: null });
    else set({ activeId: id });
    try {
      const data = await messagingService.getMessages(id);
      set((s) => ({
        threads: { ...s.threads, [id]: data.messages ?? [] },
        hasMore: { ...s.hasMore, [id]: !!data.has_more },
        conversations: upsertConversation(s.conversations, data.conversation),
        isLoadingThread: false,
      }));
      // Le fil ouvert n'a plus de non-lus : le badge global suit sans attendre.
      get().fetchUnread();
    } catch (e: any) {
      set({
        isLoadingThread: false,
        error: e?.response?.data?.error || 'Conversation indisponible.',
      });
    }
  },

  loadOlder: async (id) => {
    const current = get().threads[id] || [];
    const oldest = current.find((m) => m.id > 0);
    if (!oldest || !get().hasMore[id]) return;
    try {
      const data = await messagingService.getMessages(id, { beforeId: oldest.id });
      set((s) => ({
        threads: { ...s.threads, [id]: mergeMessages(data.messages ?? [], s.threads[id] || []) },
        hasMore: { ...s.hasMore, [id]: !!data.has_more },
      }));
    } catch {
      // L'historique reste consultable au prochain essai.
    }
  },

  pollThread: async (id) => {
    const current = get().threads[id] || [];
    try {
      const data = await messagingService.getMessages(id, { afterId: lastServerId(current) });
      set((s) => ({
        threads: { ...s.threads, [id]: mergeMessages(s.threads[id] || [], data.messages ?? []) },
        conversations: upsertConversation(s.conversations, data.conversation),
      }));
      if ((data.messages ?? []).length > 0) {
        get().fetchUnread();
      }
    } catch {
      // Coupure réseau : le battement suivant rattrape.
    }
  },

  send: async (id, body, imageUri, replyTo, attachment) => {
    const text = (body || '').trim();
    if (!text && !imageUri && !attachment) return;

    // Envoi optimiste : la bulle apparaît immédiatement, marquée en attente.
    const tempId = tempSeq--;
    const optimistic: ChatMessage = {
      id: tempId,
      mine: true,
      is_system: false,
      body: text,
      attachment: null,
      author: null,
      // La citation est déjà affichable localement : la bulle optimiste la
      // montre sans attendre la réponse du serveur.
      reply_to: replyTo ?? null,
      item: null,
      created_at: new Date().toISOString(),
      pending: true,
      localImage: imageUri || undefined,
    };
    set((s) => ({
      threads: { ...s.threads, [id]: [...(s.threads[id] || []), optimistic] },
      isSending: true,
    }));

    try {
      const data = await messagingService.send(id, text, imageUri, replyTo?.id ?? null, attachment ?? null);
      set((s) => ({
        threads: {
          ...s.threads,
          [id]: mergeMessages(
            (s.threads[id] || []).filter((m) => m.id !== tempId),
            [data.message],
          ),
        },
        conversations: upsertConversation(s.conversations, data.conversation),
        isSending: false,
      }));
    } catch (e: any) {
      // Le message reste visible, marqué en échec et réessayable — le perdre
      // silencieusement serait pire que l'afficher barré.
      set((s) => ({
        threads: {
          ...s.threads,
          [id]: (s.threads[id] || []).map((m) =>
            m.id === tempId ? { ...m, pending: false, failed: true } : m,
          ),
        },
        isSending: false,
        error: e?.response?.data?.error || null,
      }));
    }
  },

  retry: async (id, tempId) => {
    const message = (get().threads[id] || []).find((m) => m.id === tempId);
    if (!message) return;
    set((s) => ({
      threads: { ...s.threads, [id]: (s.threads[id] || []).filter((m) => m.id !== tempId) },
    }));
    await get().send(id, message.body, message.localImage, message.reply_to);
  },

  markRead: async (id) => {
    try {
      const total = await messagingService.markRead(id);
      set((s) => ({
        unreadTotal: total,
        conversations: s.conversations.map((c) => (c.id === id ? { ...c, unread_count: 0 } : c)),
      }));
    } catch {
      // Le prochain chargement du fil remarquera la lecture.
    }
  },

  notifyTyping: (id) => {
    const now = Date.now();
    if (now - lastTypingSent < TYPING_THROTTLE_MS) return;
    lastTypingSent = now;
    messagingService.setTyping(id).catch(() => {});
  },

  setMuted: async (id, muted) => {
    set((s) => ({
      conversations: s.conversations.map((c) => (c.id === id ? { ...c, muted } : c)),
    }));
    try {
      await messagingService.setMuted(id, muted);
    } catch {
      set((s) => ({
        conversations: s.conversations.map((c) => (c.id === id ? { ...c, muted: !muted } : c)),
      }));
    }
  },

  archiveConversation: async (id) => {
    set((s) => ({ conversations: s.conversations.filter((c) => c.id !== id) }));
    try {
      await messagingService.archive(id);
    } catch {
      get().fetchConversations(true);
    }
  },

  savePrefs: async (prefs) => {
    const previous = get().prefs;
    set({ prefs: { ...previous, ...prefs } });
    try {
      set({ prefs: await messagingService.savePrefs(prefs) });
    } catch {
      set({ prefs: previous });
    }
  },

  clearError: () => set({ error: null }),

  startThreadPolling: (id) => {
    get().stopThreadPolling();
    threadTimer = setInterval(() => {
      if (isActive()) get().pollThread(id);
    }, THREAD_POLL_MS);
  },

  stopThreadPolling: () => {
    if (threadTimer) clearInterval(threadTimer);
    threadTimer = null;
  },

  startInboxPolling: () => {
    get().stopInboxPolling();
    inboxTimer = setInterval(() => {
      // Le fil ouvert sonde déjà : inutile de doubler la charge pendant ce temps.
      if (isActive() && !threadTimer) get().fetchUnread();
    }, INBOX_POLL_MS);
  },

  stopInboxPolling: () => {
    if (inboxTimer) clearInterval(inboxTimer);
    inboxTimer = null;
  },

  reset: () => {
    get().stopThreadPolling();
    get().stopInboxPolling();
    set({
      conversations: [],
      unreadTotal: 0,
      threads: {},
      hasMore: {},
      activeId: null,
      error: null,
    });
  },
}));

/** Insère ou remplace un fil, en gardant l'ordre par date de dernier message. */
function upsertConversation(list: Conversation[], conv?: Conversation | null): Conversation[] {
  if (!conv) return list;
  const next = list.some((c) => c.id === conv.id)
    ? list.map((c) => (c.id === conv.id ? conv : c))
    : [conv, ...list];

  return next.sort((a, b) => {
    const ta = a.last_message_at ? Date.parse(a.last_message_at) : 0;
    const tb = b.last_message_at ? Date.parse(b.last_message_at) : 0;
    return tb - ta;
  });
}
