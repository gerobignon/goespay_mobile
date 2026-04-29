import { useCurrencyStore } from '../stores/currencyStore';

// Format brut (locale FR), sans conversion ni symbole.
export function formatAmount(amount: number): string {
  const value = Math.floor(amount * 100) / 100;
  return value.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// Formate un montant XOF (canonique) dans la devise utilisateur.
// Ex : 5000 XOF → "≈ 8.93 USD" (si user en USD), ou "5 000 XOF" (si user en XOF).
// Variante non-réactive : pour usage hors composant (alerts, receipts, logs).
export function formatXof(xofAmount: number, opts?: { withCode?: boolean; approx?: boolean }): string {
  const { formatFromXof } = useCurrencyStore.getState();
  return formatFromXof(xofAmount, { approx: true, withCode: true, ...opts });
}

// Hook réactif : se met à jour quand la devise/les taux changent.
export function useFormatXof(): (xofAmount: number, opts?: { withCode?: boolean; approx?: boolean }) => string {
  const userCurrency = useCurrencyStore((s) => s.userCurrency);
  const rates = useCurrencyStore((s) => s.rates);
  return (xofAmount: number, opts) => {
    const decimals = useCurrencyStore.getState().decimalsFor(userCurrency);
    const value = userCurrency === 'XOF' || !rates[userCurrency]
      ? xofAmount
      : xofAmount * rates[userCurrency];
    const formatted = value.toLocaleString('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    const withCode = opts?.withCode !== false;
    const approx = opts?.approx !== false;
    const prefix = approx && userCurrency !== 'XOF' ? '≈ ' : '';
    return `${prefix}${formatted}${withCode ? ` ${userCurrency}` : ''}`;
  };
}

// Hook qui retourne uniquement le code devise courant (réactif).
export function useCurrencyCode(): string {
  return useCurrencyStore((s) => s.userCurrency);
}

// Variante non-réactive (hors composant).
export function currentCurrencyCode(): string {
  return useCurrencyStore.getState().userCurrency;
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
