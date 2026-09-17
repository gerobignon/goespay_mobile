/**
 * L'API signale ainsi une adresse email qui n'a aucun compte
 * (404 { account_missing: true, email }).
 */
export function isAccountMissing(error: any): boolean {
  return error?.response?.data?.account_missing === true;
}

/** L'adresse renvoyée par l'API, à défaut celle que l'utilisateur a saisie. */
export function accountMissingEmail(error: any, fallback: string): string {
  const fromApi = error?.response?.data?.email;
  return (typeof fromApi === 'string' && fromApi.trim()) || fallback.trim();
}
