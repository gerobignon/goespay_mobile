// Résout un message d'erreur clair à partir d'une erreur axios/réseau.
//
// Priorité :
//   1. Message renvoyé par le backend (error / message / errors de validation)
//   2. Timeout (axios ECONNABORTED) → message dédié
//   3. Aucune réponse (réseau coupé / serveur injoignable) → message réseau
//   4. Erreur serveur 5xx → message serveur
//   5. Fallback fourni par l'appelant (spécifique à l'écran)
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
  if (!error?.response) return t('common.connectionError');
  if (error.response.status >= 500) return t('common.serverError');

  return fallback;
}
