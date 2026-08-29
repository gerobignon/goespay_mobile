/**
 * Destination d'une notification web, déposée par le service worker.
 *
 * Le clic sur une notification Web Push doit ouvrir le fil (ou la transaction)
 * concerné. Deux chemins existaient : `postMessage` vers un onglet déjà ouvert,
 * et `clients.openWindow(url)` quand l'app est fermée. Aucun des deux n'est
 * fiable en PWA installée sur iOS : `openWindow` y relance l'application sur son
 * `start_url` (l'accueil) en ignorant l'URL demandée, et un onglet gelé peut
 * rater le `postMessage`. Le client atterrissait donc sur l'accueil.
 *
 * On dépose donc la destination dans IndexedDB — le seul stockage accessible
 * DEPUIS un service worker — et l'application la relit au démarrage puis à
 * chaque retour au premier plan. Le chemin `postMessage` reste en place : quand
 * il fonctionne, la navigation est immédiate et la valeur rangée ici est
 * simplement consommée sans effet.
 */

const DB_NAME = 'goespay-push';
const STORE = 'targets';
const KEY = 'pending';

/** Au-delà, le clic appartient à une session passée : on ne détourne plus. */
const MAX_AGE_MS = 2 * 60 * 1000;

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch {
      return resolve(null);
    }
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
}

/**
 * Retire et retourne l'URL déposée par le service worker, si elle est fraîche.
 * La valeur est consommée dans tous les cas : un clic ne s'ouvre qu'une fois.
 */
export async function takeStoredNotificationUrl(): Promise<string | null> {
  const db = await openDb();
  if (!db) return null;

  return new Promise((resolve) => {
    let record: { url?: string; at?: number } | undefined;
    let tx: IDBTransaction;
    try {
      tx = db.transaction(STORE, 'readwrite');
    } catch {
      return resolve(null);
    }
    const store = tx.objectStore(STORE);
    const get = store.get(KEY);
    get.onsuccess = () => {
      record = get.result;
      if (record) store.delete(KEY);
    };
    tx.oncomplete = () => {
      db.close();
      if (!record?.url) return resolve(null);
      if (record.at && Date.now() - record.at > MAX_AGE_MS) return resolve(null);
      resolve(record.url);
    };
    tx.onerror = () => {
      db.close();
      resolve(null);
    };
  });
}
