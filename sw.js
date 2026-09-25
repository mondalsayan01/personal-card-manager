const CACHE = 'cardhub-v4';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  '/favicon/site.webmanifest',
  '/favicon/apple-touch-icon.png',
  '/favicon/favicon-16x16.png',
  '/favicon/favicon-32x32.png',
  '/favicon/favicon-96x96.png',
  '/favicon/favicon.ico',
  '/favicon/favicon.svg',
  '/favicon/web-app-manifest-192x192.png',
  '/favicon/web-app-manifest-512x512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // local-only app: serve from cache first, fall back to network
  e.respondWith(caches.match(e.request).then((res) => res || fetch(e.request)));
});