// service-worker.js

const CACHE_NAME = 'guardarrecibosinversiones-v1.1'; // Cambia este nombre si actualizas los archivos cacheados

// Lista de archivos que componen la "shell" de tu aplicación y que quieres cachear.
// Asegúrate de que las rutas sean correctas desde la raíz de tu sitio en GitHub Pages.
const urlsToCache = [
  './', // Representa la raíz, a menudo index.html
  './index.html',
  './manifest.json',
  './favicon.ico',
  // Iconos clave que usas en el manifest y/o en el banner de instalación
  './icons/android-launchericon-48-48.png',
  './icons/android-launchericon-72-72.png',
  './icons/android-launchericon-96-96.png',
  './icons/android-launchericon-144-144.png',
  './icons/android-launchericon-192-192.png', // Usado en el banner del index.html
  './icons/android-launchericon-512-512.png'
  // Si tienes otros archivos estáticos cruciales (CSS, JS locales), añádelos aquí.
];

// Evento 'install': Se dispara cuando el Service Worker se instala por primera vez.
self.addEventListener('install', event => {
  console.log('[Service Worker] Install event');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Opened cache:', CACHE_NAME);
        // cache.addAll() es atómico: si un archivo falla, toda la operación falla.
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('[Service Worker] All specified resources have been cached.');
        return self.skipWaiting(); // Fuerza al SW instalado a activarse inmediatamente.
      })
      .catch(error => {
        console.error('[Service Worker] Failed to cache resources during install:', error);
      })
  );
});

// Evento 'activate': Se dispara después de la instalación y cuando no hay Service Workers más antiguos controlando clientes.
// Es un buen lugar para limpiar cachés antiguas.
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activate event');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Claiming clients.');
      return self.clients.claim(); // Permite que el SW activado controle clientes inmediatamente.
    })
  );
});

// Evento 'fetch': Se dispara cada vez que la PWA realiza una petición de red (imágenes, scripts, XHR, etc.).
self.addEventListener('fetch', event => {
  // Solo nos interesan las peticiones GET para el cacheo.
  if (event.request.method !== 'GET') {
    // console.log('[Service Worker] Ignoring non-GET request:', event.request.method, event.request.url);
    return;
  }

  // Estrategia: Cache first, then network, para los assets de la PWA.
  // Excluir las peticiones a script.google.com del cacheo del Service Worker.
  // Estas siempre deben ir a la red.
  if (event.request.url.includes('script.google.com')) {
    // console.log('[Service Worker] Bypassing cache for Google Script URL:', event.request.url);
    // No interceptar, permitir que la petición vaya directamente a la red.
    // Devolver fetch(event.request) aquí si quieres manejar el error,
    // pero para Apps Script, es mejor dejar que el navegador lo maneje por defecto.
    return;
  }

  // Para los recursos de la PWA (shell)
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        // Si el recurso está en caché, devuélvelo.
        if (cachedResponse) {
          // console.log('[Service Worker] Serving from cache:', event.request.url);
          return cachedResponse;
        }

        // Si no está en caché, ve a la red.
        // console.log('[Service Worker] Fetching from network:', event.request.url);
        return fetch(event.request)
          .then(networkResponse => {
            // Verificar si recibimos una respuesta válida para cachear
            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
              return networkResponse; // Devolver la respuesta de red tal cual si no es cacheable
            }

            // IMPORTANTE: Clonar la respuesta. Una respuesta es un stream y
            // como queremos que el navegador consuma la respuesta, y también
            // la caché consuma la respuesta, necesitamos clonarla para tener dos streams.
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                // console.log('[Service Worker] Caching new resource:', event.request.url);
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          })
          .catch(error => {
            // Manejo de error de red: opcionalmente devolver una página offline genérica.
            console.warn('[Service Worker] Fetch failed; returning offline fallback (if configured). Error:', error);
            // Podrías tener un archivo 'offline.html' en tu urlsToCache
            // return caches.match('./offline.html');
            // O simplemente dejar que el error de red se propague si la cache falló.
            // Para esta PWA, si el index.html no se pudo cargar desde la red y no está en caché,
            // es un problema mayor. El index.html debería estar cacheado durante la instalación.
            // Si el error es para un recurso no esencial, el navegador mostrará el error estándar.
            // Si es una solicitud de navegación y falla, y quieres un fallback:
            if (event.request.mode === 'navigate') {
              return caches.match('./index.html'); // Intenta devolver el index.html como fallback.
            }
          });
      })
  );
});
