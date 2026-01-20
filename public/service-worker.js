// Service Worker for Buckets PWA
const CACHE_VERSION = 'buckets-v3';
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-180x180.png',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/fonts/BBBDMSans-Regular.woff2',
  '/fonts/BBBDMSans-Medium.woff2',
  '/fonts/BBBDMSans-Bold.woff2',
  '/fonts/BBBDMSans-Light.woff2',
  '/Merchant Copy.ttf',
  '/Merchant Copy Wide.ttf'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[ServiceWorker] Installing...');
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[ServiceWorker] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    }).catch((error) => {
      console.error('[ServiceWorker] Failed to cache static assets:', error);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[ServiceWorker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((cacheName) => {
            return cacheName.startsWith('buckets-') &&
                   cacheName !== STATIC_CACHE &&
                   cacheName !== DYNAMIC_CACHE;
          })
          .map((cacheName) => {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
      );
    })
  );
  self.clients.claim();
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    // For Convex API calls, use network-first strategy
    if (url.hostname.includes('convex.cloud')) {
      event.respondWith(networkFirst(request));
      return;
    }
    // For external resources (fonts, CDN), let browser handle
    return;
  }

  // For same-origin requests, use cache-first for static assets
  if (isStaticAsset(request.url)) {
    event.respondWith(cacheFirst(request));
  } else {
    // For dynamic content, use network-first
    event.respondWith(networkFirst(request));
  }
});

// Cache-first strategy (good for static assets)
async function cacheFirst(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[ServiceWorker] Fetch failed:', error);
    // Return a fallback response if available
    return caches.match('/index.html');
  }
}

// Network-first strategy (good for API calls and dynamic content)
async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.error('[ServiceWorker] Network request failed:', error);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    // Return offline page or error
    return new Response('Offline - please check your connection', {
      status: 503,
      statusText: 'Service Unavailable',
      headers: new Headers({ 'Content-Type': 'text/plain' })
    });
  }
}

// Helper to check if a URL is a static asset
function isStaticAsset(url) {
  const staticExtensions = ['.html', '.css', '.js', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.woff', '.woff2', '.ttf', '.otf'];
  return staticExtensions.some(ext => url.endsWith(ext)) ||
         url.includes('/fonts/') ||
         url.includes('/icons/') ||
         url === location.origin ||
         url === location.origin + '/';
}

// Message event - allow clients to skip waiting
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
