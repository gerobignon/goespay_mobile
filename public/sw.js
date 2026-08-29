/* GoesPay — Service Worker (Web Push uniquement).
 * Volontairement SANS handler `fetch` : il n'intercepte ni ne met en cache
 * les requêtes réseau, donc n'interfère pas avec l'app Expo. Il gère seulement
 * la réception d'une notification push et le clic dessus. */

self.addEventListener('install', function () {
  // Activation immédiate de la nouvelle version du SW.
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});

// Réception d'un push : le backend envoie un JSON {title, body, data}.
self.addEventListener('push', function (event) {
  var payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'GoesPay', body: event.data ? event.data.text() : '' };
  }

  var title = payload.title || 'GoesPay';
  var options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: payload.data || {},
    vibrate: [200, 100, 200],
    tag: (payload.data && payload.data.transactionId) || undefined,
  };

  event.waitUntil(
    self.registration
      .showNotification(title, options)
      .then(function () {
        return syncBadge(payload.data && payload.data.badge);
      })
      .then(function () {
        // Prévient les onglets ouverts (l'app rafraîchit ses données / badges).
        return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
          list.forEach(function (client) {
            client.postMessage({ type: 'push', data: payload.data || {} });
          });
        });
      })
  );
});

// Pastille de décompte sur l'icône de la PWA installée (Badging API).
// Le compte vient du payload s'il est fourni, sinon du nombre de notifs affichées.
function syncBadge(explicit) {
  if (!self.navigator || !self.navigator.setAppBadge) {
    return Promise.resolve();
  }
  var count = parseInt(explicit, 10);
  if (count > 0) {
    return self.navigator.setAppBadge(count).catch(function () {});
  }
  return self.registration
    .getNotifications()
    .then(function (list) {
      if (list.length > 0) return self.navigator.setAppBadge(list.length);
      return self.navigator.clearAppBadge ? self.navigator.clearAppBadge() : undefined;
    })
    .catch(function () {});
}

// Construit l'URL de destination à partir des données de la notif.
// Miroir de la navigation native dans app/_layout.tsx.
function targetUrl(data) {
  data = data || {};
  if (data.transactionId && data.type) {
    return '/transaction/' + data.type + '/' + data.transactionId;
  }
  if (data.screen === 'messages') {
    return data.conversationId ? '/messages/' + data.conversationId : '/support';
  }
  if (data.screen === 'messages_requests') {
    return '/messages/requests';
  }
  if (data.screen === 'admin_dev') {
    return data.taskId ? '/admin/kanban?task=' + data.taskId : '/admin/kanban';
  }
  if (data.screen === 'cards') {
    return '/cards';
  }
  if (data.screen === 'history') {
    return '/history';
  }
  // home / kyc / fallback → accueil
  return '/';
}

/* Destination du clic, déposée pour l'application.
 *
 * `openWindow` est ignoré par la PWA installée sur iOS : elle se relance sur son
 * start_url (l'accueil) quelle que soit l'URL demandée, et un onglet gelé peut
 * rater le postMessage. On range donc la cible dans IndexedDB — seul stockage
 * accessible depuis un service worker — et l'app la relit au démarrage comme au
 * retour au premier plan (src/utils/webNotificationTarget.ts). */
var DB_NAME = 'goespay-push';
var STORE = 'targets';
var KEY = 'pending';

function openDb() {
  return new Promise(function (resolve) {
    if (typeof indexedDB === 'undefined') return resolve(null);
    var req;
    try {
      req = indexedDB.open(DB_NAME, 1);
    } catch (e) {
      return resolve(null);
    }
    req.onupgradeneeded = function () {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = function () { resolve(req.result); };
    req.onerror = function () { resolve(null); };
  });
}

function storeTarget(url) {
  return openDb().then(function (db) {
    if (!db) return;
    return new Promise(function (resolve) {
      var tx;
      try {
        tx = db.transaction(STORE, 'readwrite');
      } catch (e) {
        return resolve();
      }
      tx.objectStore(STORE).put({ url: url, at: Date.now() }, KEY);
      tx.oncomplete = function () { db.close(); resolve(); };
      tx.onerror = function () { db.close(); resolve(); };
    });
  });
}

// Clic sur la notif : focus l'onglet GoesPay existant (et navigue) ou en ouvre un.
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = targetUrl(event.notification.data);

  event.waitUntil(
    syncBadge(0)
      .then(function () {
        // Rangée AVANT d'ouvrir : si la PWA se relance sur l'accueil, elle
        // retrouvera la destination et s'y rendra elle-même.
        return storeTarget(url);
      })
      .then(function () {
        return openTarget(url);
      })
  );
});

/**
 * Amène l'utilisateur sur `url`.
 *
 * Quand une fenêtre GoesPay est déjà ouverte, on la focalise et on lui DEMANDE
 * de naviguer (postMessage → routeur Expo). `client.navigate()` rechargerait
 * toute l'application — plusieurs secondes d'écran blanc pour ouvrir une
 * conversation — et échoue silencieusement sur un client non contrôlé par ce
 * service worker, ce qui laissait l'app ouverte sur la page en cours : c'était
 * la cause du « ça ouvre l'app mais pas la discussion ».
 *
 * Sans fenêtre ouverte, openWindow charge l'URL profonde (le serveur renvoie
 * index.html pour toute route, l'app est une SPA).
 */
function openTarget(url) {
  return self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) {
          try {
            client.postMessage({ type: 'navigate', url: url });
          } catch (e) {
            // Fenêtre hors de portée : on retombe sur le rechargement.
            if ('navigate' in client) {
              try { client.navigate(url); } catch (e2) { /* cross-origin safe-guard */ }
            }
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    });
}
