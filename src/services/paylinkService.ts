import { Platform } from 'react-native';

import api from './api';

/** Qui supporte les frais d'encaissement du paiement. */
export type FeeBearer = 'payer' | 'owner';

export interface PayLink {
  id: number;
  code: string;
  /** URL publique à partager (page de paiement, ouverte sans compte). */
  url: string;
  title: string;
  description: string;
  /**
   * Illustration posée par le bénéficiaire, affichée sur la page de paiement.
   * À ne pas confondre avec l'affiche partageable, que le serveur compose
   * lui-même (voir posterImageUrl).
   */
  image_url: string | null;
  /** null = le payeur saisit le montant. */
  amount: number | null;
  currency: string;
  reusable: boolean;
  max_uses: number | null;
  uses_count: number;
  fee_bearer: FeeBearer;
  expires_at: string | null;
  is_active: boolean;
  /** Rangé par son propriétaire : hors de la liste courante, plus payable. */
  archived: boolean;
  archived_at: string | null;
  /** Faux dès qu'un paiement a été encaissé — le lien s'archive au lieu d'être supprimé. */
  can_delete: boolean;
  /** Encore payable (actif, non expiré, quota non atteint). */
  open: boolean;
  closed_reason: 'disabled' | 'expired' | 'used' | 'archived' | null;
  /** Cumul reçu sur ce lien (XOF). */
  received: number;
  created_at: string | null;
}

/**
 * Ce qui reste renvoyable au payeur d'un paiement encaissé. Absent quand le
 * paiement n'est remboursable en rien : échec, aucun numéro conservé, ou
 * corridor d'envoi fermé vers l'opérateur du payeur.
 */
export interface PayLinkRefundInfo {
  payment_id: number;
  /** Numéro du payeur, destinataire du remboursement. */
  phone: string;
  /** Plafond du remboursement (XOF) : le net encaissé, moins ce qui a déjà été renvoyé. */
  max: number;
  /** Cumul déjà remboursé (XOF). */
  refunded: number;
  refunded_at: string | null;
  /** Faux : plus rien à rembourser, ou aucun envoi ouvert vers ce payeur. */
  available: boolean;
}

export interface PayLinkPayment {
  id: number;
  reference: string;
  payer_name: string;
  payer_phone?: string;
  amount: number;
  fee: number;
  status: 'pending' | 'success' | 'fail';
  refund?: PayLinkRefundInfo | null;
  created_at: string | null;
}

export interface PayLinkRefundResult {
  message: string;
  withdraw_id: number;
  reference: string;
  amount: number;
  fees: number;
  total_debited: number;
  balance_after: number;
  payment: PayLinkPayment;
}

export interface CreatePayLinkInput {
  title: string;
  description?: string;
  /** Omis = montant libre. */
  amount?: number;
  reusable?: boolean;
  max_uses?: number;
  fee_bearer?: FeeBearer;
  expires_at?: string;
  /** Fichier local choisi par le client ; déclenche l'envoi en multipart. */
  imageUri?: string;
  /** Retire l'illustration existante (mise à jour seulement). */
  removeImage?: boolean;
}

/**
 * Ajoute l'image au corps multipart, en tenant les deux plateformes : le web
 * veut un Blob, le natif un descriptif { uri, name, type }.
 */
async function appendImage(form: FormData, uri: string): Promise<void> {
  const filename = uri.split('/').pop() || 'paylink.jpg';
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : 'image/jpeg';

  if (Platform.OS === 'web') {
    const resp = await fetch(uri);
    const blob = await resp.blob();
    form.append('image', blob, filename);
    return;
  }
  form.append('image', { uri, name: filename, type } as unknown as Blob);
}

export interface PayLinkList {
  links: PayLink[];
  /** Nombre de liens rangés, pour proposer l'accès aux archives. */
  archived_count: number;
}

export const paylinkService = {
  list: async (archived = false): Promise<PayLinkList> => {
    const response = await api.get('/me/paylinks', { params: archived ? { archived: 1 } : undefined });
    return {
      links: response.data.links ?? [],
      archived_count: response.data.archived_count ?? 0,
    };
  },

  /** Range un lien (ou le ressort). Un lien archivé n'est plus payable. */
  archive: async (id: number, archived = true): Promise<PayLink> => {
    const response = await api.post(`/me/paylinks/${id}/archive`, { archived });
    return response.data.link;
  },

  create: async (data: CreatePayLinkInput): Promise<PayLink> => {
    // Sans image, on reste en JSON : le multipart force à sérialiser les
    // booléens en chaînes, et le serveur les relit moins bien.
    if (!data.imageUri) {
      const { imageUri, removeImage, ...json } = data;
      const response = await api.post('/me/paylinks', json);
      return response.data.link;
    }

    const form = new FormData();
    form.append('title', data.title);
    form.append('description', data.description ?? '');
    if (data.amount != null) form.append('amount', String(data.amount));
    form.append('reusable', data.reusable ? '1' : '0');
    if (data.max_uses != null) form.append('max_uses', String(data.max_uses));
    if (data.fee_bearer) form.append('fee_bearer', data.fee_bearer);
    if (data.expires_at) form.append('expires_at', data.expires_at);
    await appendImage(form, data.imageUri);

    const response = await api.post('/me/paylinks', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.link;
  },

  update: async (
    id: number,
    data: Partial<Pick<PayLink, 'title' | 'description' | 'is_active' | 'expires_at'>>
      & { imageUri?: string; removeImage?: boolean },
  ): Promise<PayLink> => {
    if (!data.imageUri && !data.removeImage) {
      const response = await api.put(`/me/paylinks/${id}`, data);
      return response.data.link;
    }

    // October ne lit pas le corps multipart d'un PUT : on passe par POST avec
    // _method, la surcharge de méthode que Laravel comprend.
    const form = new FormData();
    form.append('_method', 'PUT');
    if (data.title != null) form.append('title', data.title);
    if (data.description != null) form.append('description', data.description);
    if (data.is_active != null) form.append('is_active', data.is_active ? '1' : '0');
    if (data.expires_at != null) form.append('expires_at', data.expires_at);
    if (data.removeImage) form.append('remove_image', '1');
    else if (data.imageUri) await appendImage(form, data.imageUri);

    const response = await api.post(`/me/paylinks/${id}`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data.link;
  },

  remove: async (id: number): Promise<void> => {
    await api.delete(`/me/paylinks/${id}`);
  },

  payments: async (id: number): Promise<PayLinkPayment[]> => {
    const response = await api.get(`/me/paylinks/${id}/payments`);
    return response.data.payments ?? [];
  },

  /**
   * Rembourse un paiement reçu, vers le numéro du payeur.
   * `amount` omis = tout ce qui reste remboursable. Les frais d'envoi
   * s'ajoutent au montant et sont débités au bénéficiaire.
   */
  refund: async (paymentId: number, amount?: number): Promise<PayLinkRefundResult> => {
    const response = await api.post(`/me/paylinks/payments/${paymentId}/refund`,
      amount != null ? { amount } : {});
    return response.data;
  },
};
