import { useCallback, useRef } from 'react';
import type { AxiosRequestConfig } from 'axios';

/**
 * Clés d'idempotence des opérations financières.
 *
 * Un envoi d'argent qui se termine en erreur réseau laisse le client dans le
 * noir : la requête est peut-être arrivée, le débit peut-être passé. L'utilisateur
 * rappuie, et l'opération part deux fois. La clé d'idempotence lève l'ambiguïté :
 * elle est créée AU MOMENT où l'utilisateur valide, envoyée dans l'en-tête
 * `Idempotency-Key`, et REJOUÉE telle quelle si l'app retente la même soumission.
 * Le serveur reconnaît alors la clé et renvoie le résultat de la première
 * tentative au lieu d'exécuter une seconde fois.
 *
 * Elle est en revanche RÉGÉNÉRÉE dès que le formulaire change : un nouveau
 * montant, un nouveau destinataire, c'est une autre opération, qui doit pouvoir
 * passer même si la précédente a réussi.
 */

/** UUID v4, avec repli quand `crypto.randomUUID` n'existe pas (Hermes ancien). */
export function newIdempotencyKey(): string {
  const g = globalThis as any;

  if (typeof g?.crypto?.randomUUID === 'function') {
    return g.crypto.randomUUID();
  }

  if (typeof g?.crypto?.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    g.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variante RFC 4122
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  // Dernier recours : Math.random. Moins bon, mais la clé n'a besoin d'être
  // qu'unique pour cet utilisateur, pas imprévisible pour un tiers.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/** Config axios portant la clé, fusionnée avec celle de l'appelant. */
export function withIdempotency(
  key?: string,
  config: AxiosRequestConfig = {},
): AxiosRequestConfig {
  if (!key) return config;
  return { ...config, headers: { ...(config.headers || {}), 'Idempotency-Key': key } };
}

/**
 * Clé de soumission d'un formulaire.
 *
 * `signature` décrit l'opération telle qu'elle est saisie (montant, destinataire,
 * moyen…). Tant qu'elle ne bouge pas, la même clé est rendue : c'est ce qui rend
 * une nouvelle tentative inoffensive. Dès qu'elle change, une clé neuve est tirée.
 *
 * Rend une fonction plutôt qu'une valeur : la clé n'est tirée qu'à la validation,
 * pas à chaque frappe.
 */
export function useIdempotencyKey(signature: string): () => string {
  const held = useRef<{ signature: string; key: string } | null>(null);
  return useCallback(() => {
    if (!held.current || held.current.signature !== signature) {
      held.current = { signature, key: newIdempotencyKey() };
    }
    return held.current.key;
  }, [signature]);
}

/**
 * Variante pour les formulaires dont la saisie n'arrive qu'au moment de la
 * validation (feuille de saisie qui rend le montant dans son callback) : la
 * signature est passée à l'appel plutôt qu'au rendu. Même règle : clé rejouée
 * tant que la signature ne change pas, clé neuve sinon.
 */
export function useKeyedIdempotency(): (signature: string) => string {
  const held = useRef<{ signature: string; key: string } | null>(null);
  return useCallback((signature: string) => {
    if (!held.current || held.current.signature !== signature) {
      held.current = { signature, key: newIdempotencyKey() };
    }
    return held.current.key;
  }, []);
}
