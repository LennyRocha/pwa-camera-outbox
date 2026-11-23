const CACHE_STATIC_NAME = "static-camera-outbox-v1";
const STATIC_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  console.log("Service Worker instalado");
  //self.skipWaiting(); // Forzamos a que el SW se active inmediatamente
  event.waitUntil(
    caches.open(CACHE_STATIC_NAME).then((cache) => {
      return cache.addAll(STATIC_FILES);
    }),
  );
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activado");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_STATIC_NAME) {
            console.log(
              "Service Worker: Limpiando cache antigua",
            );
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
});

self.addEventListener("fetch", (e) =>
  e.respondWith(cacheFirst(e.request)),
);

const cacheFirst = (request) => {
  return caches.match(request).then((resCache) => {
    console.log(resCache);
    if (resCache) return resCache;
    return fetch(request).then((resNetwork) =>
      caches.open(CACHE_VERSION).then((cache) => {
        console.log("Cacheando nuevo recurso", resNetwork);
        cache.put(request, resNetwork.clone());
        return resNetwork;
      }),
    );
  });
};
