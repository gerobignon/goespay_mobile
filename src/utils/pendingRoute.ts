/**
 * Destination mise en attente le temps que l'app soit en état de l'afficher.
 *
 * Trois arrivées poussent une destination alors que le routeur n'est pas encore
 * prêt à la montrer :
 *   · tap sur une notification qui LANCE l'app (démarrage à froid) ;
 *   · tap sur une notification alors que le verrou PIN est actif ;
 *   · ouverture d'une URL (PWA, clic sur une notification web) sur un compte
 *     verrouillé.
 * Dans les trois cas la garde de navigation du layout racine faisait un
 * `replace` vers l'accueil ou l'écran de déverrouillage, et la destination était
 * perdue : taper la notification d'un message ouvrait l'accueil.
 *
 * On la range donc ici, et le layout la rejoue dès que l'app est authentifiée,
 * déverrouillée et montée.
 *
 * Volontairement hors de Zustand : personne n'a besoin de s'abonner à cette
 * valeur, et la relire dans un effet déjà déclenché par le déverrouillage
 * suffit. Une valeur en attente est consommée UNE fois.
 */
export interface PendingRoute {
  pathname: string;
  params?: Record<string, string>;
}

let pending: PendingRoute | null = null;

/** Range une destination. La plus récente gagne : c'est le dernier geste du client. */
export function setPendingRoute(route: PendingRoute | null): void {
  pending = route;
}

/** Retire et retourne la destination en attente, ou null. */
export function takePendingRoute(): PendingRoute | null {
  const route = pending;
  pending = null;
  return route;
}

export function hasPendingRoute(): boolean {
  return pending !== null;
}

/**
 * Chemins qu'il ne sert à rien de mémoriser : y revenir après déverrouillage
 * n'apprend rien au client, et rejouer un écran d'authentification le
 * renverrait dans la boucle dont il vient de sortir.
 */
const NEVER_REMEMBER = ['/login', '/register', '/unlock', '/setup-pin', '/forgot-password'];

export function isWorthRemembering(pathname: string): boolean {
  if (!pathname || pathname === '/') return false;
  // `usePathname` gomme les groupes : /(auth)/unlock ressort en /unlock.
  if (pathname.startsWith('/(auth)')) return false;
  return !NEVER_REMEMBER.includes(pathname);
}
