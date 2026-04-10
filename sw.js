/**
 * Service Worker — Cifra PWA
 * Estrategia: cache-first para assets locales, network-only para API
 */

const CACHE_NAME = 'cifra-v4';

const ASSETS_LOCALES = [
    './',
    './index.html',
    './assets/css/styles.css',
    './assets/js/app.js',
    './manifest.json',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png'
];

// Instalar: cachear assets locales
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS_LOCALES))
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

// Fetch: API siempre por red; resto desde cache con fallback a red
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Llamadas a la API: siempre red (datos en tiempo real)
    if (url.pathname.includes('/api/')) return;

    // Recursos externos (CDN): red con fallback a cache
    if (url.origin !== self.location.origin) {
        event.respondWith(
            fetch(event.request).catch(() => caches.match(event.request))
        );
        return;
    }

    // Assets locales: cache primero, red como fallback
    event.respondWith(
        caches.match(event.request)
            .then(cached => cached || fetch(event.request).then(response => {
                // Guardar en cache si es una respuesta válida
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }))
    );
});
