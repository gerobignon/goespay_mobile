/**
 * Formats de date de la messagerie. Une conversation se lit à deux échelles :
 * l'heure exacte sur une bulle, l'ancienneté approximative dans la liste.
 */

/**
 * Signature minimale de `t` utilisée ici. Volontairement plus permissive que
 * TFunction : celle de i18next attend un objet d'options en second argument,
 * ce qui rendrait `t` non assignable dès qu'on passe une valeur par défaut.
 */
export type Translate = (key: string, defaultValue?: any) => any;

/** Heure d'une bulle : « 14:32 ». */
export function messageTime(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

/** Séparateur de jour : « Aujourd'hui », « Hier », sinon la date. */
export function dayLabel(iso: string | null, t: Translate): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const same = (a: Date, b: Date) =>
      a.getDate() === b.getDate() && a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();

    if (same(d, today)) return String(t('messages.today', "Aujourd'hui"));
    if (same(d, yesterday)) return String(t('messages.yesterday', 'Hier'));

    return d.toLocaleDateString(undefined, { day: '2-digit', month: 'long', year: 'numeric' });
  } catch {
    return '';
  }
}

/** Vrai si deux messages appartiennent à des jours différents. */
export function isNewDay(previous: string | null, current: string | null): boolean {
  if (!current) return false;
  if (!previous) return true;
  try {
    const a = new Date(previous);
    const b = new Date(current);
    return a.toDateString() !== b.toDateString();
  } catch {
    return false;
  }
}

/** Ancienneté compacte pour la liste : « 3 min », « 2 h », « hier », « 12/03 ». */
export function shortAgo(iso: string | null, t: Translate): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    const secs = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
    if (secs < 60) return String(t('messages.justNow', 'à l’instant'));
    if (secs < 3600) return `${Math.floor(secs / 60)} min`;
    if (secs < 86400) return `${Math.floor(secs / 3600)} h`;
    if (secs < 172800) return String(t('messages.yesterdayShort', 'hier'));
    return d.toLocaleDateString(undefined, { day: '2-digit', month: '2-digit' });
  } catch {
    return '';
  }
}

/**
 * « En ligne » ou dernière apparition. Rendu vide quand l'autre a masqué sa
 * présence : le serveur envoie alors online=false et last_seen_at=null.
 */
export function presenceLabel(
  online: boolean,
  lastSeenAt: string | null,
  t: Translate,
): string {
  if (online) return String(t('messages.online', 'En ligne'));
  if (!lastSeenAt) return '';
  return `${t('messages.lastSeen', 'Vu')} ${shortAgo(lastSeenAt, t)}`;
}

/** Initiales d'un nom, pour l'avatar sans photo. */
export function initialsOf(name: string): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
