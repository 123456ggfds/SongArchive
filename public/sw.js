const CACHE_NAME = 'songarchive-v1';
const ASSETS = [
  '/SongArchive/',
  '/SongArchive/index.html',
  '/SongArchive/manifest.json',
  '/SongArchive/icon-192.png',
  '/SongArchive/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
