// Résout un message d'erreur clair à partir d'une erreur axios/réseau.
//
// Priorité :
//   1. Message renvoyé par le backend (error / message / errors de validation)
//      → c'est TOUJOURS le vrai message, on le montre en priorité absolue.
//   2. Timeout (axios ECONNABORTED) → message dédié (l'opération a pu aboutir).
//   3. Réponse présente mais sans message exploitable → 5xx = erreur serveur,
//      sinon le fallback spécifique à l'écran.
//   4. Aucune réponse lisible → on NE blâme PAS le réseau de l'utilisateur par
//      défaut : on distingue un appareil réellement hors-ligne d'un serveur
//      injoignable (timeout passerelle, 5xx Cloudflare, etc.).
export function getApiErrorMessage(
  error: any,
  t: (key: string) => string,
  fallback: string
): string {
  const data = error?.response?.data;
  const fromBody =
    data?.error
    || data?.message
    || (data?.errors && typeof data.errors === 'object'
        ? Object.values(data.errors).flat().filter(Boolean).join('\n')
        : null);
  if (fromBody && typeof fromBody === 'string' && fromBody.trim()) return fromBody;

  const msg = String(error?.message || '');
  if (error?.code === 'ECONNABORTED' || /timeout/i.test(msg)) return t('common.timeout');

  // Une réponse existe (avec CORS) mais sans message exploitable (page HTML d'une
  // passerelle, corps vide…). 5xx → serveur ; sinon fallback de l'écran.
  if (error?.response) {
    return error.response.status >= 500 ? t('common.serverError') : fallback;
  }

  // Aucune réponse : message honnête (jamais « vérifiez votre réseau » par défaut).
  return noConnectionMessage(t);
}

/**
 * Message honnête quand la requête n'a renvoyé AUCUNE réponse lisible.
 * Web : si l'appareil est réellement hors-ligne, on le dit ; sinon c'est le
 * serveur qui est injoignable (on ne fait pas porter le chapeau au réseau du
 * client). Natif : `navigator.onLine` est indéfini → message « serveur ».
 */
export function noConnectionMessage(t: (key: string) => string): string {
  const offline =
    typeof navigator !== 'undefined' && (navigator as any)?.onLine === false;
  return offline ? t('common.offline') : t('common.serverUnreachable');
}
