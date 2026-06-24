import { useEffect, useRef, useState } from 'react';
import { walletService } from '../services/walletService';

// ─────────────────────────────────────────────────────────────────────────
// Taux Fincra — ISOLÉ du currencyStore global.
//
// wallet_fincra est canonique en XOF, et l'utilisateur saisit toujours dans la
// devise de son compte (XOF). On convertit ce montant vers la devise Fincra
// (NGN, GHS, USD…) pour ce que Fincra encaisse (dépôt) ou envoie (payout).
//
// `rate` = nombre de XOF pour 1 unité de la devise Fincra (taux DIRECT cur↔XOF
// + directionnel côté backend : side sell pour le dépôt, buy pour le payout). Donc :
//   - XOF → devise Fincra : montantFincra = montantXof / rate
//   - devise Fincra → XOF : montantXof   = montantFincra * rate
//
// Ces taux ne doivent JAMAIS alimenter currencyStore (ni l'inverse) : ils ne
// valent que pour Fincra.
// ─────────────────────────────────────────────────────────────────────────

interface CacheEntry {
  rate: number;
  ts: number;
}

const CACHE_TTL_MS = 5 * 60 * 1000; // aligné sur le cache backend (5 min)
const cache = new Map<string, CacheEntry>();

// Récupère le taux XOF (XOF pour 1 unité de $currency). null si indisponible.
// forDeposit : le DÉPÔT (encaissement) et le payout (versement) sont cotés
// DIFFÉREMMENT — Klasha (direct vs triangulé) ET Fincra (side buy vs sell) →
// cache et appel distincts par sens.
export async function fetchFincraRate(currency: string, isKlasha = false, forDeposit = false): Promise<number | null> {
  const cur = (currency || '').toUpperCase();
  if (!cur) return null;
  if (cur === 'XOF') return 1;

  // Le taux LIVE du form de DÉPÔT (Klasha ET Fincra) n'est JAMAIS caché : on veut
  // la valeur fraîche à chaque affichage (les payouts gardent leur cache 5 min).
  const liveOnly = forDeposit;

  // Cache namespacé : Klasha/Fincra ET dépôt vs payout cotent la même devise
  // différemment (Klasha : KLD/KL ; Fincra : FCD/FC).
  const key = (isKlasha ? (forDeposit ? 'KLD:' : 'KL:') : (forDeposit ? 'FCD:' : 'FC:')) + cur;
  if (!liveOnly) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return hit.rate;
  }

  try {
    const { rate_to_xof } = isKlasha
      ? await walletService.getKlashaRate(cur, forDeposit)
      : await walletService.getFincraRate(cur, forDeposit);
    if (typeof rate_to_xof !== 'number' || !isFinite(rate_to_xof) || rate_to_xof <= 0) return null;
    if (!liveOnly) cache.set(key, { rate: rate_to_xof, ts: Date.now() });
    return rate_to_xof;
  } catch {
    return null;
  }
}

export interface FincraRateState {
  rate: number | null;  // XOF pour 1 unité de la devise Fincra (null = indéterminé)
  loading: boolean;
  error: boolean;        // taux indisponible → bloquer la soumission
}

// Hook réactif : charge le taux XOF pour une devise Fincra donnée.
// Le taux est indépendant du montant → un seul fetch par devise et par sens.
// `enabled` permet de désactiver l'appel (ex : opérateur non-Fincra, ou XOF).
export function useFincraRate(currency: string, enabled: boolean = true, isKlasha: boolean = false, forDeposit: boolean = false): FincraRateState {
  const [state, setState] = useState<FincraRateState>({ rate: null, loading: false, error: false });
  const reqId = useRef(0);

  useEffect(() => {
    const cur = (currency || '').toUpperCase();

    if (!enabled || !cur) {
      setState({ rate: null, loading: false, error: false });
      return;
    }
    // XOF : conversion identité, pas de garde.
    if (cur === 'XOF') {
      setState({ rate: 1, loading: false, error: false });
      return;
    }

    const id = ++reqId.current;
    setState((s) => ({ ...s, loading: true, error: false }));

    (async () => {
      const rate = await fetchFincraRate(cur, isKlasha, forDeposit);
      if (id !== reqId.current) return; // appel obsolète
      setState({ rate, loading: false, error: rate === null });
    })();
  }, [currency, enabled, isKlasha, forDeposit]);

  return state;
}
