/**
 * Service Worker — Cifra PWA
 * Estrategia: network-first para HTML (siempre fresco), cache-first para assets estáticos
 */

const CACHE_NAME = 'cifra-20260414-1';

const ASSETS_ESTATICOS = [
    './assets/css/styles.css',
    './assets/js/app.js',
    './manifest.json',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png'
];

// Instalar: cachear solo assets estáticos (no el HTML)
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_ESTATICOS))
            .then(() => self.skipWaiting())
    );
});

// Activar: limpiar caches viejas
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

// Fetch
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // API: siempre red
    if (url.pathname.includes('/api/')) return;

    // CDN externos: red con fallback a cache
    if (url.origin !== self.location.origin) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    // HTML (.php o raíz): siempre red, sin caché
    if (url.pathname.endsWith('.php') || url.pathname === '/' || url.pathname.endsWith('/')) {
        return; // deja pasar al navegador (fetch normal)
    }

    // Assets estáticos: cache-first, red como fallback
    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request).then(response => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }))
    );
});
