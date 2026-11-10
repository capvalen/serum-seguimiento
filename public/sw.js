/*
 * Service worker mínimo.
 *
 * Chrome exige un service worker con handler `fetch` para considerar la app
 * instalable (PWA). No cachea nada: solo deja pasar las peticiones a la red,
 * así que nunca sirve contenido desactualizado.
 */
self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  // Passthrough: la red responde siempre.
  event.respondWith(fetch(event.request))
})
