import { useEffect, useRef, useState } from 'react';
import { walletService, TransferQuote, TransferQuoteRequest, DepositQuote } from '../services/walletService';

// ─────────────────────────────────────────────────────────────────────────
// Devis d'envoi — le backend calcule, l'app affiche.
//
// Avant, l'app convertissait elle-même le XOF saisi via /fincra/rates ou
// /klasha/rates, pendant que l'exécution recalculait le coût réel (cotation
// provider, taux live). Résultat : le total affiché n'était pas le total
// débité, et un envoi qui vidait le solde tombait en « Solde insuffisant ».
//
// Désormais : POST /transfer/quote renvoie montant reçu + frais + total, et
// l'exécution rejoue ce devis via `quote_id`. L'app n'applique plus aucun taux.
// ─────────────────────────────────────────────────────────────────────────

const DEBOUNCE_MS = 600;
// Marge avant expiration : on renouvelle le devis un peu avant l'échéance pour
// que l'utilisateur n'appuie jamais sur « Envoyer » avec un devis périmé.
const REFRESH_BEFORE_MS = 20 * 1000;

export interface TransferQuoteState {
  quote: TransferQuote | null;
  loading: boolean;
  error: string | null;   // message backend (taux indisponible…) si échec
  refresh: () => void;    // force un nouveau devis (ex. refus « taux a changé »)
}

/**
 * Devis réactif. Recalculé (avec debounce) à chaque changement de montant ou de
 * paramètre, puis renouvelé automatiquement avant son expiration.
 * `enabled` = false → aucun appel (opérateur non-agrégateur, montant vide…).
 */
export function useTransferQuote(params: TransferQuoteRequest | null, enabled: boolean): TransferQuoteState {
  const [state, setState] = useState<Omit<TransferQuoteState, 'refresh'>>({ quote: null, loading: false, error: null });
  const [tick, setTick] = useState(0);   // incrémenté pour renouveler un devis qui va expirer
  const reqId = useRef(0);

  // Clé stable : évite de relancer un devis quand seule l'identité de l'objet change.
  const key = params && enabled
    ? [params.aggregator, params.rail, params.currency, params.amount_xof,
       params.country || '', params.operator || '', params.service || '', params.serviceCode || ''].join('|')
    : '';

  useEffect(() => {
    if (!key || !params) {
      reqId.current++;
      setState({ quote: null, loading: false, error: null });
      return;
    }

    const id = ++reqId.current;
    setState((s) => ({ ...s, loading: true, error: null }));

    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const debounce = setTimeout(async () => {
      try {
        const quote = await walletService.createTransferQuote(params);
        if (id !== reqId.current) return;   // paramètres changés entre-temps
        setState({ quote, loading: false, error: null });

        // Renouvellement auto avant expiration (le taux est figé côté serveur).
        const msLeft = quote.expires_at * 1000 - Date.now() - REFRESH_BEFORE_MS;
        refreshTimer = setTimeout(() => {
          if (id === reqId.current) setTick((t) => t + 1);
        }, Math.max(msLeft, 30 * 1000));
      } catch (e: any) {
        if (id !== reqId.current) return;
        setState({
          quote: null,
          loading: false,
          error: e?.response?.data?.error || 'quote_failed',
        });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(debounce);
      if (refreshTimer) clearTimeout(refreshTimer);
    };
    // `key` porte tous les paramètres réellement significatifs ; `tick` force le
    // renouvellement d'un devis proche de l'expiration.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  return { ...state, refresh: () => setTick((t) => t + 1) };
}

export interface DepositQuoteRequest {
  aggregator: 'fincra' | 'klasha';
  currency: string;
  amount: number;      // montant encaissé, dans la devise du moyen
  method?: string;
}

export interface DepositQuoteState {
  quote: DepositQuote | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Devis de dépôt : crédit XOF figé par le backend. Même règle que l'envoi —
 * ce qui est annoncé à l'écran est ce qui sera crédité au wallet.
 */
export function useDepositQuote(params: DepositQuoteRequest | null, enabled: boolean): DepositQuoteState {
  const [state, setState] = useState<Omit<DepositQuoteState, 'refresh'>>({ quote: null, loading: false, error: null });
  const [tick, setTick] = useState(0);
  const reqId = useRef(0);

  const key = params && enabled
    ? [params.aggregator, params.currency, params.amount, params.method || ''].join('|')
    : '';

  useEffect(() => {
    if (!key || !params) {
      reqId.current++;
      setState({ quote: null, loading: false, error: null });
      return;
    }

    const id = ++reqId.current;
    setState((s) => ({ ...s, loading: true, error: null }));

    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const debounce = setTimeout(async () => {
      try {
        const quote = await walletService.createDepositQuote(params);
        if (id !== reqId.current) return;
        setState({ quote, loading: false, error: null });
        const msLeft = quote.expires_at * 1000 - Date.now() - REFRESH_BEFORE_MS;
        refreshTimer = setTimeout(() => {
          if (id === reqId.current) setTick((t) => t + 1);
        }, Math.max(msLeft, 30 * 1000));
      } catch (e: any) {
        if (id !== reqId.current) return;
        setState({ quote: null, loading: false, error: e?.response?.data?.error || 'quote_failed' });
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(debounce);
      if (refreshTimer) clearTimeout(refreshTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, tick]);

  return { ...state, refresh: () => setTick((t) => t + 1) };
}
