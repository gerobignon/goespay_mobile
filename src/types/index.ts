export interface User {
  id: number;
  name: string;
  surname: string;
  email: string;
  phone: string;
  prefix?: string;
  telegram?: string;
  country: string;
  city?: string;
  address?: string;
  idnumber?: string;
  idexp?: string;
  birthdate?: string; // AAAA-MM-JJ (KYC, requis payouts Chine)
  state?: string;     // province / état (KYC, senderAddress Chine)
  postcode?: string;  // code postal (KYC, senderAddress Chine)
  kyc_type?: string;            // type de pièce KYC précédemment soumis
  kyc_file_url?: string | null; // document KYC déjà uploadé
  kyc_tof_url?: string | null;  // selfie KYC déjà uploadé
  idexp_expired?: boolean;
  idexp_days_left?: number | null;
  idexp_warning?: boolean;
  avatar?: string;
  balance?: number;
  validate: 0 | 1 | 2;
  group: string;
  referral_code?: string;
  created_at?: string;
  currency?: string;
  currency_source?: 'auto' | 'manual';
  /** Droit d'accès à la messagerie in-app, accordé par le serveur. */
  messaging_enabled?: boolean;
}

export interface Transaction {
  id: number;
  user_id: number;
  type: 'deposit' | 'withdraw' | 'transfer' | 'crypto';
  amount: number;
  amount_sent?: number;
  real?: number;
  statut: string | number;
  mode?: string;
  reference?: string;
  note?: string;
  de?: string;
  phone?: string;
  receiver_id?: number;
  receiver_name?: string;
  receiver_email?: string;
  currency_src?: string;
  dollar?: number;
  currency_dest?: string;
  fee_xof?: number;
  meta?: { account_name?: string; bank?: string; [k: string]: any } | null;
  address?: string;
  cp_id?: string;
  cp_hash?: string;
  provider?: string;
  tx_id?: string;
  avant?: number;
  apres?: number;
  /** Dépôt encaissé via un lien de paiement (absent pour une recharge ordinaire). */
  paylink?: {
    code: string;
    title: string;
    payer: string;
    email?: string;
    fee?: number;
  } | null;
  created_at: string;
  updated_at?: string;
}

export interface SavedPhone {
  id: number;
  name?: string;
  tel: string;
  type?: 'transfer' | 'deposit';
  operator?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SavedWallet {
  id: number;
  name?: string;
  currency: string;
  address: string;
  created_at?: string;
  updated_at?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  token?: string;
  user?: User;
  two_factor_required?: boolean;
  temp_token?: string;
}

export interface RegisterRequest {
  name: string;
  surname: string;
  email: string;
  password: string;
  password_confirmation: string;
  parrain_code?: string;
}

export interface AffiliationStats {
  unpayed: number;
  payed: number;
  total: number;
  children: number;
  referral_code: string;
}

export interface AffiliationChild {
  id: number;
  name: string;
  email: string;
  created_at: string | null;
}

/** Bonus de bienvenue KYC : montant, état et progression des 2 conditions. */
export interface WelcomeBonus {
  amount: number;
  /** 'none' = pas encore attribué (KYC non validé) ; 'blocked' ; 'unlocked'. */
  state: 'none' | 'blocked' | 'unlocked';
  /** Condition A : volume de transactions sortantes cumulé (XOF). */
  volume: { current: number; target: number };
  /** Condition B : filleuls ayant validé leur KYC + fait ≥1 transaction. */
  filleuls: { current: number; target: number };
  /** L'annonce du déblocage a déjà été vue — mémoire serveur, pas appareil. */
  celebrated?: boolean;
}

export interface AffiliationHistoryItem {
  id: number;
  type: string;
  commission: number;
  payed: string;
  filleul_id: number;
  filleul_name: string | null;
  created_at: string | null;
}

export interface DepositRequest {
  amount: number;
  moyen: string;
  tel: string;
  otp?: string;
}

export interface TransferRequest {
  amount: number;
  moyen: string;
  tel: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

// ─── Board Kanban Dev (admin) ────────────────────────────────────────────────

export type DevStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'later';
export type DevPriority = 'urgent' | 'high' | 'medium' | 'low' | 'frozen';

export interface DevSubtask {
  label: string;
  done: boolean;
}

export interface DevAssignee {
  id: number;
  label: string;
}

export interface DevTask {
  id: number;
  title: string;
  description: string | null;
  status: DevStatus;
  priority: DevPriority;
  category: string | null;
  platform: string | null;
  assigned_to: number | null;
  assignee: DevAssignee | null;
  due_date: string | null; // AAAA-MM-JJ
  sort: number;
  completed_at: string | null;
  image_url: string | null;
  subtasks: DevSubtask[];
  subtask_stats: { total: number; done: number };
  comments_count: number;
  unread_count: number;
  created_at: string | null;
  updated_at: string | null;
}

export interface DevCommentQuote {
  text: string;
  target_id: number | null;
}

export interface DevComment {
  id: number;
  task_id: number;
  user_id: number | null;
  author_name: string;
  is_mine: boolean;
  body: string;
  quote: DevCommentQuote | null;
  editable: boolean;
  created_at: string | null;
}

export interface DevRefItem {
  label: string;
  color?: string;
  icon?: string;
}

export interface DevColumn {
  key: DevStatus;
  label: string;
  icon: string;
}

export interface DevBoard {
  columns: DevColumn[];
  priorities: Record<string, DevRefItem>;
  categories: Record<string, DevRefItem>;
  platforms: Record<string, DevRefItem>;
  assignees: DevAssignee[];
  tasks_by_status: Record<string, DevTask[]>;
  backlog: DevTask[];
  counts: { total: number; backlog: number; archived: number; new_tasks: number };
  me: { id: number };
}

/** Payload d'enregistrement d'une tâche (création/édition). */
export interface DevTaskInput {
  id?: number;
  title: string;
  description?: string | null;
  status: DevStatus;
  priority: DevPriority;
  category?: string | null;
  platform?: string | null;
  assigned_to?: number | null;
  due_date?: string | null;
  subtasks?: DevSubtask[];
  /** URI locale d'une image à joindre (RN) ; null/absent = inchangée. */
  imageUri?: string | null;
  /** Retirer la pièce jointe existante. */
  removeImage?: boolean;
}

// ─── Messagerie in-app ───────────────────────────────────────────────────────

export type ConversationType = 'support' | 'direct' | 'broadcast';
export type ConversationStatus = 'open' | 'pending' | 'closed';
export type ContactSource = 'transfer' | 'referral' | 'sponsor';
export type ReportReason = 'scam' | 'spam' | 'harassment' | 'other';

/**
 * Relation avec un autre client :
 *  - friend   : invitation acceptée — seule relation qui ouvre un fil
 *  - known    : lien déjà établi (parrainage, transfert) — nom visible, mais
 *               discuter demande quand même une invitation
 *  - stranger : rien
 */
export type ChatRelation = 'self' | 'friend' | 'known' | 'stranger';

/** Niveau de visibilité d'une information du profil. */
export type VisibilityLevel = 'public' | 'friends' | 'private';

export interface ChatVisibility {
  name: VisibilityLevel;
  avatar: VisibilityLevel;
  country: VisibilityLevel;
  member_since: VisibilityLevel;
  verified: VisibilityLevel;
  presence: VisibilityLevel;
}

/**
 * Fiche publique d'un autre client (jamais d'email ni de téléphone).
 * Les champs cachés par ses réglages arrivent vides plutôt qu'absents.
 */
export interface PeerCard {
  id: number;
  name: string;
  avatar: string | null;
  country: string;
  verified: boolean;
  member_since: string | null;
  online: boolean;
  last_seen_at: string | null;
  relation: ChatRelation;
  /** null quand le serveur ne l'a pas calculé (listes, pour rester léger). */
  is_contact: boolean | null;
  /** Présent dans la liste des personnes connues : peut-on déjà écrire ? */
  can_message?: boolean;
  source?: ContactSource;
}

/** Invitation à discuter, reçue ou envoyée. */
export interface ContactRequest {
  id: number;
  direction: 'incoming' | 'outgoing';
  note: string;
  created_at: string | null;
  peer: PeerCard | null;
}

export interface PublicProfile extends PeerCard {
  blocked_by_me: boolean;
  conversation_id: number | null;
}

export interface Conversation {
  id: number;
  type: ConversationType;
  status: ConversationStatus;
  title: string;
  avatar: string | null;
  peer: PeerCard | null;
  preview: string;
  last_message_at: string | null;
  unread_count: number;
  muted: boolean;
  /** Dernier message lu par l'interlocuteur → accusé de lecture sur mes bulles. */
  peer_read_id: number;
  peer_typing: boolean;
  /** Canal de diffusion : on y lit, on n'y répond pas. */
  read_only?: boolean;
}

export interface ChatAuthor {
  id: number;
  name: string;
  avatar: string | null;
  /** Réponse du support : toujours anonyme côté client, jamais l'agent nommé. */
  is_agent: boolean;
}

export interface ChatAttachment {
  url: string | null;
  thumb: string | null;
}

/** Extrait du message auquel celui-ci répond. */
export interface ChatReplyPreview {
  id: number;
  author: string;
  body: string;
  photo: boolean;
  mine: boolean;
}

/** Objet de l'application porté par un message. */
export type MessageItemType =
  | 'paylink'
  | 'transfer'
  | 'transaction'
  | 'card'
  | 'virtual_account'
  | 'statement';

export interface MessageItem {
  type: MessageItemType;
  ref: string;
  /** Instantané figé à l'envoi, complété du statut à jour quand il bouge. */
  meta: Record<string, any>;
}

/** Un objet proposé au choix dans le menu « joindre ». */
export interface AttachableItem {
  ref: string;
  title?: string;
  kind?: string;
  amount?: number | null;
  currency?: string;
  status?: string;
  date?: string;
  active?: boolean;
  outgoing?: boolean;
}

export interface ChatMessage {
  id: number;
  mine: boolean;
  is_system: boolean;
  body: string;
  /** « html » uniquement sur une annonce du canal GoesPay ; sinon texte brut. */
  format?: 'text' | 'html';
  attachment: ChatAttachment | null;
  author: ChatAuthor | null;
  reply_to: ChatReplyPreview | null;
  item: MessageItem | null;
  created_at: string | null;
  /** Champs locaux de l'envoi optimiste (jamais renvoyés par le serveur). */
  pending?: boolean;
  failed?: boolean;
  localImage?: string;
}

export interface ChatPrefs {
  discoverable: boolean;
  allow_unknown: boolean;
  show_presence: boolean;
}

export interface BlockedUser {
  id: number;
  name: string;
  avatar: string | null;
}
