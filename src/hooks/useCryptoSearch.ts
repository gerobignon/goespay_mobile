import { useMemo, useState } from 'react';
import type { CryptoRate } from '../stores/cryptoStore';

/** En dessous de ce nombre de devises, la recherche n'apporte rien. */
const SEARCH_THRESHOLD = 12;

const matches = (rate: CryptoRate, q: string): boolean =>
  (rate.code || '').toLowerCase().includes(q) ||
  (rate.name || '').toLowerCase().includes(q) ||
  (rate.network || '').toLowerCase().includes(q);

/**
 * Tri + recherche de la liste crypto. Depuis que le catalogue NOWPayments est
 * synchronisé automatiquement, l'admin peut activer des dizaines de devises :
 * les plus courantes remontent en tête et un champ de recherche apparaît.
 *
 * `selectedCode` reste toujours affichée, même hors résultats : sans elle,
 * l'utilisateur ne verrait plus sur quelle devise porte le montant saisi.
 */
export function useCryptoSearch(rates: CryptoRate[], selectedCode?: string) {
  const [query, setQuery] = useState('');

  const sorted = useMemo(
    // L'ordre serveur (actives, puis priorité catalogue) est déjà pertinent :
    // on ne fait que remonter les devises courantes.
    () => [...rates].sort((a, b) => Number(!!b.is_popular) - Number(!!a.is_popular)),
    [rates]
  );

  const { cryptos, hits } = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { cryptos: sorted, hits: sorted.length };

    const selected = (selectedCode || '').toUpperCase();
    const found = sorted.filter((r) => matches(r, q));
    const selectedRate =
      selected && !found.some((r) => (r.code || '').toUpperCase() === selected)
        ? sorted.find((r) => (r.code || '').toUpperCase() === selected)
        : undefined;

    return {
      cryptos: selectedRate ? [selectedRate, ...found] : found,
      hits: found.length,
    };
  }, [sorted, query, selectedCode]);

  return {
    query,
    setQuery,
    /** Liste à afficher (triée, filtrée, sélection conservée). */
    cryptos,
    /** Afficher le champ de recherche ? */
    showSearch: rates.length >= SEARCH_THRESHOLD,
    /** Recherche en cours sans aucune correspondance. */
    empty: rates.length > 0 && query.trim() !== '' && hits === 0,
  };
}
