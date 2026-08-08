import { Linking, Platform } from 'react-native';

/**
 * Ouverture d'un lien reçu dans un contenu rédigé (annonce du canal, carte
 * promo, objet joint à un message).
 *
 * Deux problèmes que `Linking.openURL` seul ne règle pas sur le web :
 *
 *  · Un lien qui pointe vers l'application elle-même (app.goespay.io/cards)
 *    partait dans un ONGLET, donc hors de la PWA installée sur iOS, et
 *    rechargeait toute l'application pour arriver sur un écran déjà présent.
 *    Ces liens-là doivent naviguer dans le routeur.
 *
 *  · `Linking.openURL` se traduit sur le web par `window.open(_, '_blank')`,
 *    que le navigateur bloque quand le clic n'est pas jugé « de confiance »
 *    (PWA standalone iOS en particulier) : le lien ne faisait alors RIEN, sans
 *    erreur — d'où un lien qui marche une fois sur deux. On retombe sur une
 *    navigation directe quand l'ouverture est refusée.
 */

/** Hôtes qui servent l'application (pas le site vitrine, qui reste externe). */
const APP_HOSTS = ['app.goespay.io'];

/** Premier segment des routes de l'app — cf. `app/`. */
const APP_ROUTES = [
  '',            // racine
  'cards',
  'kyc',
  'paylinks',
  'history',
  'affiliation',
  'support',
  'account',
  'messages',
  'transaction',
  'admin',
];

/**
 * Chemin interne correspondant à `url`, ou null si le lien mène ailleurs.
 *
 * Un lien vers goespay.io (blog, vitrine, reçu servi par le backend) n'est
 * PAS interne : il n'a pas d'écran d'application derrière.
 */
export function internalPathFor(url: string): string | null {
  const raw = (url || '').trim();

  // Chemin écrit tel quel dans l'annonce (« /cards »). `//` est exclu : c'est
  // une adresse d'un autre hôte, pas un chemin.
  if (raw.startsWith('/') && !raw.startsWith('//')) {
    const seg = raw.replace(/^\//, '').split(/[/?#]/)[0].toLowerCase();
    return APP_ROUTES.includes(seg) ? raw : null;
  }

  const m = /^https?:\/\/([^/?#]+)(.*)$/i.exec(raw);
  if (!m) return null;

  const host = m[1].toLowerCase().replace(/:\d+$/, '');
  const current =
    Platform.OS === 'web' && typeof window !== 'undefined'
      ? window.location.hostname.toLowerCase()
      : '';

  if (!APP_HOSTS.includes(host) && host !== current) return null;

  const path = m[2] || '/';
  const segment = path.replace(/^\//, '').split(/[/?#]/)[0].toLowerCase();
  if (!APP_ROUTES.includes(segment)) return null;

  return path.startsWith('/') ? path : '/' + path;
}

/** Ouvre un lien hors de l'application, avec repli si l'onglet est refusé. */
export function openExternal(url: string): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const win = window.open(url, '_blank', 'noopener');
    // `null` = ouverture bloquée (PWA standalone, bloqueur de fenêtres) :
    // sans ce repli, le lien restait sans effet.
    if (!win) window.location.href = url;
    return;
  }
  Linking.openURL(url).catch(() => {});
}

/**
 * Point d'entrée unique : navigue dans l'app si le lien y mène, sinon ouvre
 * à l'extérieur. Les schémas autres que http(s)/mailto/tel sont ignorés.
 *
 * @param push routeur expo-router (`router.push`), pour les liens internes.
 */
export function openLink(url: string, push?: (path: string) => void): void {
  const href = (url || '').trim();
  if (!href) return;

  if (/^(mailto:|tel:)/i.test(href)) {
    Linking.openURL(href).catch(() => {});
    return;
  }
  if (!/^https?:\/\//i.test(href) && !href.startsWith('/')) return;

  const internal = push ? internalPathFor(href) : null;
  if (!internal && !/^https?:\/\//i.test(href)) return;
  if (internal) {
    push!(internal);
    return;
  }

  openExternal(href);
}
