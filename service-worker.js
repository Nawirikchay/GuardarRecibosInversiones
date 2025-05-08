const CACHE_NAME = 'mi-app-lanzador-cache-v1'; // Cambia 'mi-app-lanzador' si quieres
const urlsToCache = [
    './', // O './index.html'
    './index.html',
    './manifest.json',
    './favicon.ico',
    './icons/android-launchericon-192-192.png',
    './icons/android-launchericon-512-512.png'
    // NO añadas la URL de Apps Script aquí
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[ServiceWorker] Cache abierto, cacheando archivos de la carcasa');
                return cache.addAll(urlsToCache);
            })
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[ServiceWorker] Borrando cache antigua:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', event => {
    // Solo nos interesa responder a peticiones GET para los recursos de la carcasa
    if (event.request.method !== 'GET') {
        return;
    }

    // Para los archivos de la carcasa, usa estrategia Cache First.
    // Para todo lo demás (incluyendo la navegación a Apps Script después de la redirección),
    // simplemente deja que la red lo maneje.
    const requestUrl = new URL(event.request.url);

    // Verifica si la URL solicitada es uno de los archivos de la carcasa
    // o si es la raíz (que sirve index.html)
    const isShellAsset = urlsToCache.some(url => {
        // Normaliza la URL cacheada para la comparación
        const cachedUrlPath = new URL(url, self.location.origin).pathname;
        return requestUrl.pathname === cachedUrlPath;
    });


    if (isShellAsset || requestUrl.pathname === '/' || requestUrl.pathname === (self.location.pathname + 'index.html')) {
        event.respondWith(
            caches.match(event.request)
                .then(cachedResponse => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    return fetch(event.request).then(networkResponse => {
                        // Opcional: volver a cachear si algo cambió
                        // let responseToCache = networkResponse.clone();
                        // caches.open(CACHE_NAME).then(cache => {
                        //     cache.put(event.request, responseToCache);
                        // });
                        return networkResponse;
                    });
                })
        );
    } else {
        // Para cualquier otra petición, simplemente ve a la red.
        // Esto es importante para que la redirección a Apps Script funcione sin problemas.
        return;
    }
});
