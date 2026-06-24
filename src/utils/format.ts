// Format brut (locale FR), sans conversion ni symbole.
export function formatAmount(amount: number): string {
  return amount.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 20,
  });
}

// Formate un montant XOF (canonique). Le multi-devise d'affichage a été retiré :
// le solde et tous les montants s'affichent désormais en XOF pour tout le monde.
// La devise étrangère n'intervient plus qu'au niveau d'une transaction (recharge/
// envoi), gérée localement par les modals (≈ crypto). Variante non-réactive.
export function formatXof(xofAmount: number, opts?: { withCode?: boolean; approx?: boolean; decimals?: number }): string {
  const formatted = xofAmount.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    // Par défaut pleine précision (pas d'arrondi) ; `decimals` permet de capper
    // l'affichage (ex. solde → 2 décimales).
    maximumFractionDigits: opts?.decimals ?? 20,
  });
  return `${formatted}${opts?.withCode === false ? '' : ' XOF'}`;
}

// Hook réactif (conservé pour compat) — formate toujours en XOF.
export function useFormatXof(): (xofAmount: number, opts?: { withCode?: boolean; approx?: boolean; decimals?: number }) => string {
  return (xofAmount: number, opts) => formatXof(xofAmount, opts);
}

// Devise d'affichage : toujours XOF (le sélecteur multi-devise a été supprimé).
export function useCurrencyCode(): string {
  return 'XOF';
}

// Variante non-réactive (hors composant).
export function currentCurrencyCode(): string {
  return 'XOF';
}

// Conserve l'ancien nom pour rétro-compat (équivalent à formatXof).
export function formatCurrency(amount: number): string {
  return formatXof(amount);
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
