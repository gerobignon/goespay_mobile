import { Platform } from 'react-native';
import api from './api';
import type {
  AttachableItem,
  BlockedUser,
  ChatMessage,
  ChatPrefs,
  ChatVisibility,
  ContactRequest,
  Conversation,
  PeerCard,
  PublicProfile,
  ReportReason,
} from '../types';

/**
 * Messagerie in-app : fil support (client ↔ équipe) et fils directs
 * (client ↔ client). Toutes les routes sont sous `/messaging`.
 *
 * Le temps réel est un sondage : le fil ouvert redemande ce qui est arrivé
 * après le dernier id connu (`after_id`), le reste de l'app ne sonde que le
 * compteur de non-lus.
 */

/** Ajoute une image (URI locale) à un FormData, web et natif. */
async function appendImage(form: FormData, uri: string): Promise<void> {
  const filename = uri.split('/').pop() || 'photo.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';

  if (Platform.OS === 'web') {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    form.append('image', blob, filename);
  } else {
    form.append('image', { uri, name: filename, type } as unknown as Blob);
  }
}

export const messagingService = {
  /** Liste des fils + total non lus + préférences, en un appel. */
  getConversations: async (): Promise<{
    conversations: Conversation[];
    unread_total: number;
    prefs: ChatPrefs;
  }> => {
    const { data } = await api.get('/messaging/conversations', {
      params: { platform: Platform.OS },
    });
    return data;
  },

  /** Sondage de fond : le strict minimum pour le badge. */
  getUnread: async (): Promise<number> => {
    const { data } = await api.get<{ unread_total: number }>('/messaging/unread', {
      params: { platform: Platform.OS },
    });
    return data.unread_total ?? 0;
  },

  openSupport: async (): Promise<Conversation> => {
    const { data } = await api.post<{ conversation: Conversation }>('/messaging/support');
    return data.conversation;
  },

  openDirect: async (userId: number): Promise<Conversation> => {
    const { data } = await api.post<{ conversation: Conversation }>('/messaging/direct', {
      user_id: userId,
    });
    return data.conversation;
  },

  /**
   * Messages du fil.
   *  - `afterId` : delta du sondage (ce qui est arrivé depuis).
   *  - `beforeId` : remontée d'historique (ne marque pas le fil comme lu).
   */
  getMessages: async (
    conversationId: number,
    opts: { afterId?: number; beforeId?: number; limit?: number } = {},
  ): Promise<{ conversation: Conversation; messages: ChatMessage[]; has_more: boolean }> => {
    const { data } = await api.get(`/messaging/conversations/${conversationId}/messages`, {
      params: {
        after_id: opts.afterId || undefined,
        before_id: opts.beforeId || undefined,
        limit: opts.limit || undefined,
        platform: Platform.OS,
      },
    });
    return data;
  },

  send: async (
    conversationId: number,
    body: string,
    imageUri?: string | null,
    replyToId?: number | null,
    attachment?: { type: string; ref: string } | null,
  ): Promise<{ message: ChatMessage; conversation: Conversation }> => {
    if (!imageUri) {
      const { data } = await api.post(`/messaging/conversations/${conversationId}/messages`, {
        body,
        reply_to_id: replyToId || undefined,
        attachment_type: attachment?.type,
        attachment_ref: attachment?.ref,
      });
      return data;
    }

    const form = new FormData();
    form.append('body', body ?? '');
    if (replyToId) form.append('reply_to_id', String(replyToId));
    if (attachment) {
      form.append('attachment_type', attachment.type);
      form.append('attachment_ref', attachment.ref);
    }
    await appendImage(form, imageUri);

    const { data } = await api.post(`/messaging/conversations/${conversationId}/messages`, form, {
      headers: Platform.OS === 'web'
        ? { 'Content-Type': undefined as any }
        : { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  markRead: async (conversationId: number): Promise<number> => {
    const { data } = await api.post<{ unread_total: number }>(
      `/messaging/conversations/${conversationId}/read`,
    );
    return data.unread_total ?? 0;
  },

  setTyping: async (conversationId: number, on = true): Promise<void> => {
    await api.post(`/messaging/conversations/${conversationId}/typing`, on ? {} : { off: 1 });
  },

  setMuted: async (conversationId: number, muted: boolean): Promise<void> => {
    await api.post(`/messaging/conversations/${conversationId}/mute`, { muted });
  },

  archive: async (conversationId: number): Promise<void> => {
    await api.post(`/messaging/conversations/${conversationId}/archive`);
  },

  /** Comptes déjà liés : filleuls, parrain, bénéficiaires de transferts. */
  getContacts: async (): Promise<PeerCard[]> => {
    const { data } = await api.get<{ contacts: PeerCard[] }>('/messaging/contacts');
    return data.contacts ?? [];
  },

  /**
   * Envoie une invitation. La réponse est identique que le compte existe ou
   * non — c'est voulu : l'écran ne peut donc pas afficher « compte trouvé ».
   */
  invite: async (identifier: string, note = ''): Promise<string> => {
    const { data } = await api.post<{ message: string }>('/messaging/requests', {
      identifier,
      note,
    });
    return data.message;
  },

  getRequests: async (): Promise<{ incoming: ContactRequest[]; outgoing: ContactRequest[] }> => {
    const { data } = await api.get('/messaging/requests');
    return { incoming: data.incoming ?? [], outgoing: data.outgoing ?? [] };
  },

  acceptRequest: async (id: number): Promise<Conversation> => {
    const { data } = await api.post<{ conversation: Conversation }>(`/messaging/requests/${id}/accept`);
    return data.conversation;
  },

  declineRequest: async (id: number): Promise<void> => {
    await api.post(`/messaging/requests/${id}/decline`);
  },

  /** Types joignables dans ce fil, et objets d'un type donné. */
  getAttachables: async (
    conversationId: number,
    type?: string,
  ): Promise<{ types: string[]; items: AttachableItem[] }> => {
    const { data } = await api.get(`/messaging/conversations/${conversationId}/attachables`, {
      params: type ? { type } : undefined,
    });
    return { types: data.types ?? [], items: data.items ?? [] };
  },

  getVisibility: async (): Promise<ChatVisibility> => {
    const { data } = await api.get<{ visibility: ChatVisibility }>('/messaging/visibility');
    return data.visibility;
  },

  saveVisibility: async (visibility: Partial<ChatVisibility>): Promise<void> => {
    await api.put('/messaging/prefs', { visibility });
  },

  search: async (query: string): Promise<PeerCard[]> => {
    const { data } = await api.get<{ results: PeerCard[] }>('/messaging/directory', {
      params: { q: query },
    });
    return data.results ?? [];
  },

  getProfile: async (userId: number): Promise<PublicProfile> => {
    const { data } = await api.get<{ profile: PublicProfile }>(`/messaging/users/${userId}`);
    return data.profile;
  },

  getBlocked: async (): Promise<BlockedUser[]> => {
    const { data } = await api.get<{ blocked: BlockedUser[] }>('/messaging/blocks');
    return data.blocked ?? [];
  },

  block: async (userId: number): Promise<BlockedUser[]> => {
    const { data } = await api.post<{ blocked: BlockedUser[] }>('/messaging/blocks', {
      user_id: userId,
    });
    return data.blocked ?? [];
  },

  unblock: async (userId: number): Promise<BlockedUser[]> => {
    const { data } = await api.delete<{ blocked: BlockedUser[] }>(`/messaging/blocks/${userId}`);
    return data.blocked ?? [];
  },

  report: async (
    userId: number,
    reason: ReportReason,
    details: string,
    conversationId?: number | null,
  ): Promise<string> => {
    const { data } = await api.post<{ message: string }>('/messaging/reports', {
      user_id: userId,
      reason,
      details,
      conversation_id: conversationId ?? undefined,
    });
    return data.message;
  },

  getPrefs: async (): Promise<ChatPrefs> => {
    const { data } = await api.get<{ prefs: ChatPrefs }>('/messaging/prefs');
    return data.prefs;
  },

  savePrefs: async (prefs: Partial<ChatPrefs>): Promise<ChatPrefs> => {
    const { data } = await api.put<{ prefs: ChatPrefs }>('/messaging/prefs', prefs);
    return data.prefs;
  },
};
