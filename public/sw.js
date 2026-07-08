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

  event.waitUntil(self.registration.showNotification(title, options));
});

// Construit l'URL de destination à partir des données de la notif.
// Miroir de la navigation native dans app/_layout.tsx.
function targetUrl(data) {
  data = data || {};
  if (data.transactionId && data.type) {
    return '/transaction/' + data.type + '/' + data.transactionId;
  }
  if (data.screen === 'history') {
    return '/history';
  }
  // home / kyc / fallback → accueil
  return '/';
}

// Clic sur la notif : focus l'onglet GoesPay existant (et navigue) ou en ouvre un.
self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  var url = targetUrl(event.notification.data);

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (clientList) {
        for (var i = 0; i < clientList.length; i++) {
          var client = clientList[i];
          if ('focus' in client) {
            if ('navigate' in client) {
              try { client.navigate(url); } catch (e) { /* cross-origin safe-guard */ }
            }
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});
