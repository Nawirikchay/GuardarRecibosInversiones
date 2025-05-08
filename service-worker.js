const CACHE_NAME = 'mi-pwa-cache-v1';
const urlsToCache = [
    './', // Alias para index.html si start_url es './' o '/'
    './index.html',
    './manifest.json',
    './favicon.ico',
    './icons/android-launchericon-192-192.png',
    './icons/android-launchericon-512-512.png'
    // Puedes añadir más archivos estáticos de tu "carcasa" aquí si los tuvieras
];

// Evento install: se dispara cuando el Service Worker se instala por primera vez.
self.addEventListener('install', event => {
    console.log('[ServiceWorker] Instalando...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[ServiceWorker] Abriendo cache y añadiendo archivos de la carcasa');
                return cache.addAll(urlsToCache);
            })
            .then(() => {
                console.log('[ServiceWorker] Archivos de la carcasa cacheados exitosamente.');
                return self.skipWaiting(); // Fuerza al SW a activarse inmediatamente
            })
            .catch(error => {
                console.error('[ServiceWorker] Fallo al cachear archivos de la carcasa:', error);
            })
    );
});

// Evento activate: se dispara después de install, cuando el SW se activa.
// Es un buen lugar para limpiar caches antiguas.
self.addEventListener('activate', event => {
    console.log('[ServiceWorker] Activando...');
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
        }).then(() => {
            console.log('[ServiceWorker] Activado y caches antiguas limpiadas.');
            return self.clients.claim(); // Permite al SW tomar control de las páginas abiertas inmediatamente
        })
    );
});

// Evento fetch: se dispara cada vez que la PWA hace una petición de red (imágenes, scripts, etc.).
self.addEventListener('fetch', event => {
    // Solo nos interesa responder a peticiones GET
    if (event.request.method !== 'GET') {
        return;
    }

    // Estrategia: Cache primero, luego red para los recursos de la carcasa.
    // Para las peticiones al iframe de Apps Script, simplemente las dejamos pasar.
    if (urlsToCache.includes(new URL(event.request.url).pathname.substring(event.request.url.lastIndexOf('/') + 1)) || event.request.url.endsWith('/')) {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        // console.log('[ServiceWorker] Sirviendo desde cache:', event.request.url);
                        return response; // Servir desde la cache si está disponible
                    }
                    // console.log('[ServiceWorker] Recurso no en cache, buscando en red:', event.request.url);
                    return fetch(event.request).then(
                        networkResponse => {
                            // Opcional: si quieres volver a cachear dinámicamente si algo cambia (con cuidado)
                            // const responseToCache = networkResponse.clone();
                            // caches.open(CACHE_NAME).then(cache => {
                            //   cache.put(event.request, responseToCache);
                            // });
                            return networkResponse;
                        }
                    );
                })
                .catch(error => {
                    console.error('[ServiceWorker] Error en fetch:', error, event.request.url);
                    // Podrías devolver una página offline genérica aquí si lo deseas
                    // return caches.match('./offline.html');
                })
        );
    } else {
        // Para cualquier otra petición (como la del iframe a script.google.com),
        // simplemente la dejamos pasar a la red.
        // console.log('[ServiceWorker] Dejando pasar petición a la red (posiblemente iframe):', event.request.url);
        return; // Esto permite que la petición continúe a la red normalmente
    }
});
